import { Router } from "express";
import FileAsset from "../models/FileAsset.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import TeamMember from "../models/TeamMember.js";
import { requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activityLog.js";
import { notifyProjectUpdate } from "../services/notifications.js";

const router = Router();
const editableFields = [
  "name",
  "description",
  "status",
  "priority",
  "manager",
  "teamMembers",
  "startDate",
  "dueDate",
  "progress",
];

function projectFields(body) {
  return Object.fromEntries(editableFields
    .filter((field) => Object.hasOwn(body || {}, field))
    .map((field) => [field, body[field]]));
}

async function validateTeamMembers(memberIds, workspaceId) {
  if (!Array.isArray(memberIds)) return false;
  const uniqueIds = [...new Set(memberIds.map(String))];
  if (uniqueIds.length !== memberIds.length) return false;
  const count = await TeamMember.countDocuments({
    _id: { $in: uniqueIds },
    workspace: workspaceId,
    status: "Active",
  });
  return count === uniqueIds.length;
}

router.get("/", async (request, response, next) => {
  try {
    const projects = await Project.find({ workspace: request.workspaceId })
      .populate("teamMembers", "name email role")
      .sort({ updatedAt: -1 })
      .lean();
    response.json(projects);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const fields = projectFields(request.body);
    if (fields.teamMembers && !(await validateTeamMembers(fields.teamMembers, request.workspaceId))) {
      response.status(400).json({ message: "Choose active team members from this workspace" });
      return;
    }
    const project = await Project.create({ ...fields, workspace: request.workspaceId });
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: project._id,
      action: "created",
      entityType: "Project",
      entityId: project._id,
      summary: `${request.authUser.name} created project “${project.name}”.`,
    });
    void notifyProjectUpdate({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      project,
      action: "created",
    }).catch((error) => console.error("NexaFlow project notifications failed:", error.message));
    response.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    const project = await Project.findOne({ _id: request.params.id, workspace: request.workspaceId })
      .populate("teamMembers", "name email role")
      .lean();
    if (!project) {
      return response.status(404).json({ message: "Project not found" });
    }
    response.json(project);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const fields = projectFields(request.body);
    if (fields.teamMembers && !(await validateTeamMembers(fields.teamMembers, request.workspaceId))) {
      response.status(400).json({ message: "Choose active team members from this workspace" });
      return;
    }
    const project = await Project.findOneAndUpdate(
      { _id: request.params.id, workspace: request.workspaceId },
      fields,
      { new: true, runValidators: true },
    ).populate("teamMembers", "name email role");
    if (!project) {
      return response.status(404).json({ message: "Project not found" });
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: project._id,
      action: "updated",
      entityType: "Project",
      entityId: project._id,
      summary: `${request.authUser.name} updated project “${project.name}”.`,
    });
    void notifyProjectUpdate({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      project,
      action: "updated",
    }).catch((error) => console.error("NexaFlow project notifications failed:", error.message));
    response.json(project);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const project = await Project.findOne({ _id: request.params.id, workspace: request.workspaceId });
    if (!project) {
      return response.status(404).json({ message: "Project not found" });
    }
    const [hasTasks, hasFiles] = await Promise.all([
      Task.exists({ project: project._id, workspace: request.workspaceId }),
      FileAsset.exists({ project: project._id, workspace: request.workspaceId }),
    ]);
    if (hasTasks || hasFiles) {
      response.status(409).json({
        message: "This project still has tasks or files. Reassign or delete them before deleting the project.",
      });
      return;
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: project._id,
      action: "deleted",
      entityType: "Project",
      entityId: project._id,
      summary: `${request.authUser.name} deleted project “${project.name}”.`,
    });
    await project.deleteOne();
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
