import { Router } from "express";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activityLog.js";
import { notifyTaskAssignment } from "../services/notifications.js";

const router = Router();
const editableFields = [
  "title",
  "description",
  "project",
  "status",
  "priority",
  "assignee",
  "assigneeUser",
  "dueDate",
];

function taskFields(body) {
  return Object.fromEntries(editableFields
    .filter((field) => Object.hasOwn(body || {}, field))
    .map((field) => [field, body[field]]));
}

async function validateProject(projectId, workspaceId) {
  if (!projectId) return true;
  return Boolean(await Project.exists({ _id: projectId, workspace: workspaceId }));
}

async function applyAssignee(fields, workspaceId) {
  if (!Object.hasOwn(fields, "assigneeUser")) return true;
  if (!fields.assigneeUser) {
    fields.assigneeUser = null;
    fields.assignee = "";
    return true;
  }
  const user = await User.findOne({
    _id: fields.assigneeUser,
    role: { $in: ["Administrator", "Project Manager", "Team Member"] },
  }).select("name");
  if (!user || !(await Workspace.exists({
    _id: workspaceId,
    "members.user": user._id,
  }))) return false;
  fields.assignee = user.name;
  return true;
}

function canManageTask(request, task) {
  return ["Administrator", "Project Manager"].includes(request.workspaceRole)
    || task.assigneeUser?.toString() === request.authUser._id.toString();
}

router.get("/", async (request, response, next) => {
  try {
    const tasks = await Task.find({ workspace: request.workspaceId })
      .populate("project", "name")
      .populate("assigneeUser", "name email")
      .sort({ updatedAt: -1 })
      .lean();
    response.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const fields = taskFields(request.body);
    if (!(await validateProject(fields.project, request.workspaceId))) {
      response.status(400).json({ message: "Choose a project from this workspace" });
      return;
    }
    if (!(await applyAssignee(fields, request.workspaceId))) {
      response.status(400).json({ message: "Choose an active member of this workspace" });
      return;
    }
    const task = await Task.create({ ...fields, workspace: request.workspaceId });
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: task.project,
      action: "created",
      entityType: "Task",
      entityId: task._id,
      summary: `${request.authUser.name} created task “${task.title}”.`,
    });
    void notifyTaskAssignment({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      task,
    }).catch((error) => console.error("NexaFlow task assignment notification failed:", error.message));
    response.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (request, response, next) => {
  try {
    const existing = await Task.findOne({ _id: request.params.id, workspace: request.workspaceId });
    if (!existing) {
      return response.status(404).json({ message: "Task not found" });
    }
    const fields = taskFields(request.body);
    if (!canManageTask(request, existing)) {
      return response.status(403).json({ message: "You can only update tasks assigned to you" });
    }
    if (request.workspaceRole === "Team Member" && Object.keys(fields).some((field) => field !== "status")) {
      return response.status(403).json({ message: "Team members can only update their assigned task status" });
    }
    if (Object.hasOwn(fields, "project") && !(await validateProject(fields.project, request.workspaceId))) {
      response.status(400).json({ message: "Choose a project from this workspace" });
      return;
    }
    if (!(await applyAssignee(fields, request.workspaceId))) {
      response.status(400).json({ message: "Choose an active member of this workspace" });
      return;
    }
    const previousAssigneeId = existing.assigneeUser;
    const task = await Task.findOneAndUpdate(
      { _id: request.params.id, workspace: request.workspaceId },
      fields,
      {
        new: true,
        runValidators: true,
      },
    ).populate("project", "name").populate("assigneeUser", "name email");
    if (!task) {
      return response.status(404).json({ message: "Task not found" });
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: task.project?._id || task.project,
      action: "updated",
      entityType: "Task",
      entityId: task._id,
      summary: `${request.authUser.name} updated task “${task.title}”.`,
    });
    void notifyTaskAssignment({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      task,
      previousAssigneeId,
    }).catch((error) => console.error("NexaFlow task assignment notification failed:", error.message));
    response.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: request.params.id, workspace: request.workspaceId });
    if (!task) {
      return response.status(404).json({ message: "Task not found" });
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      projectId: task.project,
      action: "deleted",
      entityType: "Task",
      entityId: task._id,
      summary: `${request.authUser.name} deleted task “${task.title}”.`,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
