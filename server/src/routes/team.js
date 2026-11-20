import { randomBytes } from "node:crypto";
import { Router } from "express";
import AuthSession from "../models/AuthSession.js";
import { requireWorkspaceRole, hashSessionToken } from "../middleware/auth.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import WorkspaceInvitation from "../models/WorkspaceInvitation.js";
import {
  EmailConfigurationError,
  sendWorkspaceInvitation,
  sendWorkspaceNotification,
} from "../services/authEmailNotifications.js";
import { recordActivity } from "../services/activityLog.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invitationDurationMs = 7 * 24 * 60 * 60 * 1000;

async function deliverInvitation(invitation, workspaceName, request) {
  const token = randomBytes(32).toString("base64url");
  invitation.tokenHash = hashSessionToken(token);
  invitation.expiresAt = new Date(Date.now() + invitationDurationMs);
  invitation.acceptedAt = null;
  await invitation.save();
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
  const inviteUrl = `${clientUrl}/#/register/${token}`;
  await sendWorkspaceInvitation({
    email: invitation.email,
    name: invitation.name,
    workspaceName,
    inviteUrl,
  });
}

router.get("/", async (request, response, next) => {
  try {
    const members = await TeamMember.find({ workspace: request.workspaceId })
      .sort({ name: 1 })
      .lean();
    response.json(members);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts", async (request, response, next) => {
  try {
    const workspace = await Workspace.findById(request.workspaceId)
      .populate("members.user", "name email role")
      .lean();
    response.json((workspace?.members || []).filter((member) => member.user).map((member) => ({
      _id: member.user._id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })));
  } catch (error) {
    next(error);
  }
});

router.get("/invitations", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const invitations = await WorkspaceInvitation.find({
      workspace: request.workspaceId,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    }).select("email name role expiresAt createdAt").sort({ createdAt: -1 }).lean();
    response.json(invitations);
  } catch (error) {
    next(error);
  }
});

router.post("/invitations", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const role = request.body?.role === "Project Manager" ? "Project Manager" : "Team Member";
  if (!name || name.length > 100 || !emailPattern.test(email) || email.length > 254) {
    response.status(400).json({ message: "Enter a valid name and email address" });
    return;
  }
  if (role === "Project Manager" && request.workspaceRole !== "Administrator") {
    response.status(403).json({ message: "Only an administrator can invite a project manager" });
    return;
  }

  try {
    const workspace = await Workspace.findById(request.workspaceId).select("name members");
    const existingAccount = await User.findOne({ email });
    if (existingAccount) {
      if (workspace.members.some((member) => member.user.equals(existingAccount._id))) {
        response.status(409).json({ message: "This person is already a workspace member" });
        return;
      }
      if (role === "Project Manager" && request.workspaceRole !== "Administrator") {
        response.status(403).json({ message: "Only an administrator can add a project manager" });
        return;
      }
      const membership = await Workspace.updateOne(
        { _id: request.workspaceId, "members.user": { $ne: existingAccount._id } },
        { $push: { members: { user: existingAccount._id, role } } },
      );
      if (!membership.modifiedCount) {
        response.status(409).json({ message: "This person is already a workspace member" });
        return;
      }
      const previousRole = existingAccount.role;
      try {
        existingAccount.role = role;
        await existingAccount.save();
        await TeamMember.findOneAndUpdate(
          { workspace: request.workspaceId, email },
          {
            $set: { workspace: request.workspaceId, email, account: existingAccount._id, status: "Active", name, role },
          },
          { upsert: true, runValidators: true },
        );
        await WorkspaceInvitation.deleteMany({
          workspace: request.workspaceId,
          email,
          acceptedAt: null,
        });
      } catch (error) {
        await Workspace.updateOne(
          { _id: request.workspaceId },
          { $pull: { members: { user: existingAccount._id } } },
        );
        existingAccount.role = previousRole;
        await existingAccount.save();
        throw error;
      }
      await recordActivity({
        workspaceId: request.workspaceId,
        actorId: request.authUser._id,
        action: "invited",
        entityType: "Team member",
        entityId: existingAccount._id,
        summary: `${request.authUser.name} invited ${name} to the workspace.`,
      });
      let emailNotificationStatus = "sent";
      try {
        await sendWorkspaceNotification({
          email,
          name,
          subject: `You have been added to ${workspace.name} on NexaFlow`,
          message: `You now have ${role} access to ${workspace.name}.`,
          link: `${(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim()}/#/login`,
        });
      } catch (error) {
        emailNotificationStatus = error instanceof EmailConfigurationError ? "not_configured" : "failed";
        console.error("NexaFlow workspace membership email failed:", error.message);
      }
      response.status(201).json({ message: `${name} was added to the workspace`, emailNotificationStatus });
      return;
    }

    const invitation = await WorkspaceInvitation.findOneAndUpdate(
      { workspace: request.workspaceId, email },
      {
        $set: {
          workspace: request.workspaceId,
          email,
          name,
          role,
          tokenHash: randomBytes(32).toString("hex"),
          expiresAt: new Date(Date.now() + invitationDurationMs),
          acceptedAt: null,
          invitedBy: request.authUser._id,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    await TeamMember.findOneAndUpdate(
      { workspace: request.workspaceId, email },
      { $set: { workspace: request.workspaceId, name, email, role, account: null, status: "Pending" } },
      { upsert: true, new: true, runValidators: true },
    );
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "invited",
      entityType: "Team member",
      entityId: invitation._id,
      summary: `${request.authUser.name} invited ${name} to the workspace.`,
    });
    try {
      await deliverInvitation(invitation, workspace.name, request);
    } catch (error) {
      if (error instanceof EmailConfigurationError) {
        response.status(503).json({ message: "Invitation created but not sent. Configure SMTP and resend it." });
        return;
      }
      throw error;
    }
    response.status(201).json({ message: `Invitation sent to ${email}` });
  } catch (error) {
    next(error);
  }
});

router.post("/invitations/:id/resend", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const invitation = await WorkspaceInvitation.findOne({
      _id: request.params.id,
      workspace: request.workspaceId,
      acceptedAt: null,
    });
    if (!invitation) {
      response.status(404).json({ message: "Invitation not found" });
      return;
    }
    if (invitation.role === "Project Manager" && request.workspaceRole !== "Administrator") {
      response.status(403).json({ message: "Only an administrator can resend this invitation" });
      return;
    }
    const workspace = await Workspace.findById(request.workspaceId).select("name");
    await deliverInvitation(invitation, workspace.name, request);
    response.json({ message: `Invitation sent to ${invitation.email}` });
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      response.status(503).json({ message: "Invitation not sent. Check the SMTP configuration." });
      return;
    }
    next(error);
  }
});

router.delete("/invitations/:id", requireWorkspaceRole("Administrator"), async (request, response, next) => {
  try {
    const invitation = await WorkspaceInvitation.findOneAndDelete({
      _id: request.params.id,
      workspace: request.workspaceId,
      acceptedAt: null,
    });
    if (!invitation) {
      response.status(404).json({ message: "Invitation not found" });
      return;
    }
    await TeamMember.deleteOne({
      workspace: request.workspaceId,
      email: invitation.email,
      status: "Pending",
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response) => {
  response.status(410).json({ message: "Use a workspace invitation to add a member" });
});

router.put("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const fields = Object.fromEntries(["name", "email", "role"]
      .filter((field) => Object.hasOwn(request.body || {}, field))
      .map((field) => [field, request.body[field]]));
    const member = await TeamMember.findOne({
      _id: request.params.id,
      workspace: request.workspaceId,
      status: "Active",
    });
    if (!member) {
      return response.status(404).json({ message: "Team member not found" });
    }
    if (member.account) {
      if (request.workspaceRole !== "Administrator") {
        return response.status(403).json({ message: "Only an administrator can edit account roles" });
      }
      if (fields.email && fields.email.trim().toLowerCase() !== member.email) {
        return response.status(400).json({ message: "Account email addresses are changed in profile settings" });
      }
      if (fields.role && fields.role !== member.role) {
        const workspace = await Workspace.findById(request.workspaceId);
        const membership = workspace.members.find((entry) => entry.user.equals(member.account));
        if (membership?.role === "Administrator" && fields.role !== "Administrator") {
          const adminCount = workspace.members.filter((entry) => entry.role === "Administrator").length;
          if (adminCount <= 1) {
            return response.status(409).json({ message: "The workspace must have at least one administrator" });
          }
        }
        if (membership) membership.role = fields.role;
        await workspace.save();
        await User.updateOne({ _id: member.account }, { $set: { role: fields.role } });
      }
      if (fields.name) {
        await User.updateOne({ _id: member.account }, { $set: { name: fields.name.trim() } });
      }
    }
    Object.assign(member, fields);
    await member.save();
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "updated",
      entityType: "Team member",
      entityId: member._id,
      summary: `${request.authUser.name} updated ${member.name}'s workspace access.`,
    });
    response.json(member);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireWorkspaceRole("Administrator"), async (request, response, next) => {
  try {
    const member = await TeamMember.findOne({
      _id: request.params.id,
      workspace: request.workspaceId,
      status: "Active",
    });
    if (!member) {
      return response.status(404).json({ message: "Team member not found" });
    }
    if (member.account) {
      const workspace = await Workspace.findById(request.workspaceId);
      const membership = workspace.members.find((entry) => entry.user.equals(member.account));
      if (membership?.role === "Administrator" && workspace.members.filter((entry) => entry.role === "Administrator").length <= 1) {
        return response.status(409).json({ message: "The workspace must have at least one administrator" });
      }
      await Workspace.updateOne(
        { _id: request.workspaceId },
        { $pull: { members: { user: member.account } } },
      );
      await AuthSession.deleteMany({ user: member.account });
    }
    await member.deleteOne();
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "removed",
      entityType: "Team member",
      entityId: member._id,
      summary: `${request.authUser.name} removed ${member.name} from the workspace.`,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
