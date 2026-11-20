import { Router } from "express";
import Activity from "../models/Activity.js";
import Project from "../models/Project.js";

const router = Router();

router.get("/:projectId/activity", async (request, response, next) => {
  try {
    const project = await Project.exists({
      _id: request.params.projectId,
      workspace: request.workspaceId,
    });
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    const activity = await Activity.find({
      workspace: request.workspaceId,
      project: request.params.projectId,
    })
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    response.json(activity);
  } catch (error) {
    next(error);
  }
});

export default router;
