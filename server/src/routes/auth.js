import { randomBytes } from "node:crypto";
import { Router } from "express";
import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/passwords.js";
import TeamMember from "../models/TeamMember.js";
import Workspace from "../models/Workspace.js";
import WorkspaceInvitation from "../models/WorkspaceInvitation.js";
import {
  EmailConfigurationError,
  sendAuthNotification,
} from "../services/authEmailNotifications.js";
import {
  clearSessionCookie,
  hashSessionToken,
  readSessionToken,
  requireAuth,
  SESSION_DURATION_MS,
  setSessionCookie,
} from "../middleware/auth.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    notificationPreferences: user.notificationPreferences,
  };
}

async function createSession(user, response) {
  const token = randomBytes(32).toString("base64url");
  await AuthSession.create({
    user: user._id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  setSessionCookie(response, token);
}

async function deliverAuthNotification(user, event) {
  try {
    await sendAuthNotification({ event, email: user.email, name: user.name });
    return "sent";
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      console.warn(`NexaFlow ${event} email notification not sent: ${error.message}`);
      return "not_configured";
    }
    console.error(`NexaFlow ${event} email notification failed:`, error.message);
    return "failed";
  }
}

router.post("/register", async (request, response, next) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  if (!name || name.length > 100) {
    response.status(400).json({ message: "Name is required and must be 100 characters or fewer" });
    return;
  }
  if (!emailPattern.test(email) || email.length > 254) {
    response.status(400).json({ message: "Enter a valid email address" });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    response.status(400).json({ message: "Password must be between 8 and 128 characters" });
    return;
  }

  try {
    const workspace = await Workspace.findOne({ slug: "acme" });
    if (!workspace) {
      throw new Error("The default workspace has not been initialized.");
    }

    const invitationToken = typeof request.body?.invitationToken === "string"
      ? request.body.invitationToken
      : "";
    const invitation = invitationToken
      ? await WorkspaceInvitation.findOne({
        workspace: workspace._id,
        tokenHash: hashSessionToken(invitationToken),
        email,
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      })
      : null;
    if (!invitation && workspace.members.length > 0) {
      response.status(403).json({ message: "Registration requires a valid workspace invitation." });
      return;
    }

    if (invitationToken && !invitation) {
      response.status(400).json({ message: "This workspace invitation is invalid or has expired." });
      return;
    }

    let user;
    try {
      user = await User.create({
        name,
        email,
        passwordHash: await hashPassword(password),
        role: invitation?.role || "Administrator",
      });
    } catch (error) {
      if (error.code === 11000) {
        response.status(409).json({ message: "An account with this email already exists" });
        return;
      }
      throw error;
    }

    let membershipAdded = false;
    let invitationClaimed = false;
    try {
      if (invitation) {
        const claim = await WorkspaceInvitation.updateOne(
          {
            _id: invitation._id,
            acceptedAt: null,
            expiresAt: { $gt: new Date() },
          },
          { $set: { acceptedAt: new Date() } },
        );
        if (!claim.modifiedCount) {
          const error = new Error("This workspace invitation is invalid or has expired.");
          error.statusCode = 400;
          throw error;
        }
        invitationClaimed = true;
      }
      const membership = await Workspace.updateOne(
        invitation
          ? { _id: workspace._id, "members.user": { $ne: user._id } }
          : { _id: workspace._id, "members.0": { $exists: false } },
        { $push: { members: { user: user._id, role: invitation?.role || "Administrator" } } },
      );
      if (!membership.modifiedCount) {
        const error = new Error(invitation
          ? "This workspace invitation could not be accepted."
          : "Registration now requires a valid workspace invitation.");
        error.statusCode = invitation ? 400 : 403;
        throw error;
      }
      membershipAdded = true;
      await TeamMember.findOneAndUpdate(
        { workspace: workspace._id, email },
        {
          $set: { account: user._id, status: "Active", name, role: invitation?.role || "Administrator" },
          $setOnInsert: { workspace: workspace._id, email },
        },
        { upsert: true, runValidators: true },
      );
    } catch (error) {
      if (membershipAdded) {
        await Workspace.updateOne(
          { _id: workspace._id },
          { $pull: { members: { user: user._id } } },
        );
      }
      await TeamMember.updateOne(
        { workspace: workspace._id, email, account: user._id },
        invitation
          ? { $set: { account: null, status: "Pending" } }
          : { $set: { account: null, status: "Active" } },
      );
      if (invitationClaimed) {
        await WorkspaceInvitation.updateOne(
          { _id: invitation._id },
          { $set: { acceptedAt: null } },
        );
      }
      await User.deleteOne({ _id: user._id });
      if (error.statusCode) {
        response.status(error.statusCode).json({ message: error.message });
        return;
      }
      throw error;
    }
    await createSession(user, response);
    const emailNotificationStatus = await deliverAuthNotification(user, "register");
    response.status(201).json({
      user: publicUser(user),
      workspace: { _id: workspace._id, name: workspace.name },
      emailNotificationStatus,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (request, response, next) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!emailPattern.test(email) || !password || password.length > 128) {
    response.status(401).json({ message: "Invalid email or password" });
    return;
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }
    if (!(await Workspace.exists({ "members.user": user._id }))) {
      response.status(403).json({ message: "This account is not a member of an active workspace" });
      return;
    }
    await createSession(user, response);
    const emailNotificationStatus = await deliverAuthNotification(user, "login");
    response.json({ user: publicUser(user), emailNotificationStatus });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (request, response) => {
  response.json({
    user: publicUser(request.authUser),
    workspace: { _id: request.workspaceId, name: request.workspaceName, role: request.workspaceRole },
  });
});

router.put("/preferences", requireAuth, async (request, response, next) => {
  const preferences = request.body?.notificationPreferences;
  const preferenceKeys = ["taskAssignments", "dueDateReminders", "projectUpdates", "weeklySummary"];
  if (
    !preferences
    || typeof preferences !== "object"
    || Array.isArray(preferences)
    || preferenceKeys.some((key) => typeof preferences[key] !== "boolean")
  ) {
    response.status(400).json({ message: "All notification preferences must be boolean values" });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      request.authUser._id,
      { $set: { notificationPreferences: Object.fromEntries(preferenceKeys.map((key) => [key, preferences[key]])) } },
      { new: true, runValidators: true },
    );
    if (!user) {
      response.status(404).json({ message: "Account not found" });
      return;
    }
    response.json({ notificationPreferences: user.notificationPreferences });
  } catch (error) {
    next(error);
  }
});

router.put("/profile", requireAuth, async (request, response, next) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  if (!name || name.length > 100) {
    response.status(400).json({ message: "Name is required and must be 100 characters or fewer" });
    return;
  }
  if (!emailPattern.test(email) || email.length > 254) {
    response.status(400).json({ message: "Enter a valid email address" });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      request.authUser._id,
      { name, email },
      { new: true, runValidators: true },
    );
    if (!user) {
      response.status(404).json({ message: "Account not found" });
      return;
    }
    await TeamMember.updateOne(
      { workspace: request.workspaceId, account: user._id },
      { $set: { name: user.name, email: user.email } },
    );
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.put("/password", requireAuth, async (request, response, next) => {
  const currentPassword = typeof request.body?.currentPassword === "string"
    ? request.body.currentPassword
    : "";
  const newPassword = typeof request.body?.newPassword === "string"
    ? request.body.newPassword
    : "";

  if (!currentPassword) {
    response.status(400).json({ message: "Enter your current password" });
    return;
  }
  if (currentPassword.length > 128) {
    response.status(400).json({ message: "Current password must be 128 characters or fewer" });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    response.status(400).json({ message: "New password must be between 8 and 128 characters" });
    return;
  }

  try {
    const user = await User.findById(request.authUser._id).select("+passwordHash");
    if (!user) {
      response.status(404).json({ message: "Account not found" });
      return;
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      response.status(400).json({ message: "Current password is incorrect" });
      return;
    }
    if (currentPassword === newPassword) {
      response.status(400).json({ message: "Choose a password different from your current one" });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await AuthSession.deleteMany({
      user: user._id,
      _id: { $ne: request.authSessionId },
    });
    response.json({ message: "Password updated. Other active sessions have been signed out." });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (request, response, next) => {
  const token = readSessionToken(request);
  try {
    if (token) {
      await AuthSession.deleteOne({ tokenHash: hashSessionToken(token) });
    }
    clearSessionCookie(response);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
