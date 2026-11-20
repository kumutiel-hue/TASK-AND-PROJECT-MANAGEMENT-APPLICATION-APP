import { randomUUID } from "node:crypto";
import { Router } from "express";
import FileAsset from "../models/FileAsset.js";
import Project from "../models/Project.js";
import { requireWorkspaceRole } from "../middleware/auth.js";
import {
  createProjectFileDownloadUrl,
  createProjectFileUploadUrl,
  deleteProjectFileObject,
  isAllowedProjectFileType,
  MAX_PROJECT_FILE_SIZE,
  StorageConfigurationError,
  verifyProjectFileUpload,
} from "../services/s3Storage.js";

const router = Router();

async function findProject(request, response) {
  const project = await Project.exists({
    _id: request.params.projectId,
    workspace: request.workspaceId,
  });
  if (!project) {
    response.status(404).json({ message: "Project not found" });
    return false;
  }
  return true;
}

router.get("/:projectId/files", async (request, response, next) => {
  try {
    if (!(await findProject(request, response))) return;
    const files = await FileAsset.find({
      workspace: request.workspaceId,
      project: request.params.projectId,
    }).sort({ createdAt: -1 }).lean();
    response.json(files);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:projectId/files/upload-url",
  requireWorkspaceRole("Administrator", "Project Manager"),
  async (request, response, next) => {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    const contentType = typeof request.body?.contentType === "string"
      ? request.body.contentType.trim().toLowerCase()
      : "";
    const size = Number(request.body?.size);
    if (!name || name.length > 180 || !isAllowedProjectFileType(contentType)) {
      response.status(400).json({ message: "Choose a supported file with a valid name" });
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > MAX_PROJECT_FILE_SIZE) {
      response.status(400).json({ message: "Files must be between 1 byte and 25 MB" });
      return;
    }

    try {
      if (!(await findProject(request, response))) return;
      const key = `${request.workspaceId}/${request.params.projectId}/${request.authUser._id}/${randomUUID()}`;
      const uploadUrl = await createProjectFileUploadUrl({ key, contentType, size });
      response.json({ key, uploadUrl, contentType, size });
    } catch (error) {
      if (error instanceof StorageConfigurationError) {
        response.status(503).json({ message: error.message });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/:projectId/files",
  requireWorkspaceRole("Administrator", "Project Manager"),
  async (request, response, next) => {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    const key = typeof request.body?.key === "string" ? request.body.key : "";
    const contentType = typeof request.body?.contentType === "string"
      ? request.body.contentType.trim().toLowerCase()
      : "";
    const size = Number(request.body?.size);
    const keyPrefix = `${request.workspaceId}/${request.params.projectId}/${request.authUser._id}/`;
    if (
      !name
      || name.length > 180
      || !key.startsWith(keyPrefix)
      || !isAllowedProjectFileType(contentType)
      || !Number.isInteger(size)
      || size < 1
      || size > MAX_PROJECT_FILE_SIZE
    ) {
      response.status(400).json({ message: "File metadata is invalid" });
      return;
    }

    try {
      if (!(await findProject(request, response))) return;
      const uploadedObject = await verifyProjectFileUpload({ key });
      if (uploadedObject.ContentLength !== size || uploadedObject.ContentType !== contentType) {
        response.status(400).json({ message: "Uploaded file does not match the requested metadata" });
        return;
      }
      let file;
      try {
        file = await FileAsset.create({
          workspace: request.workspaceId,
          project: request.params.projectId,
          uploadedBy: request.authUser._id,
          name,
          key,
          contentType,
          size,
        });
      } catch (error) {
        if (error.code !== 11000) {
          try {
            await deleteProjectFileObject({ key });
          } catch (cleanupError) {
            console.error("NexaFlow untracked project file could not be removed:", cleanupError.message);
          }
        }
        throw error;
      }
      response.status(201).json(file);
    } catch (error) {
      if (error instanceof StorageConfigurationError) {
        response.status(503).json({ message: error.message });
        return;
      }
      next(error);
    }
  },
);

router.get("/:projectId/files/:fileId/download", async (request, response, next) => {
  try {
    const file = await FileAsset.findOne({
      _id: request.params.fileId,
      project: request.params.projectId,
      workspace: request.workspaceId,
    });
    if (!file) {
      response.status(404).json({ message: "File not found" });
      return;
    }
    response.json({ downloadUrl: await createProjectFileDownloadUrl(file) });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      response.status(503).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.delete(
  "/:projectId/files/:fileId",
  requireWorkspaceRole("Administrator", "Project Manager"),
  async (request, response, next) => {
    try {
      const file = await FileAsset.findOne({
        _id: request.params.fileId,
        project: request.params.projectId,
        workspace: request.workspaceId,
      });
      if (!file) {
        response.status(404).json({ message: "File not found" });
        return;
      }
      await deleteProjectFileObject(file);
      await file.deleteOne();
      response.status(204).send();
    } catch (error) {
      if (error instanceof StorageConfigurationError) {
        response.status(503).json({ message: error.message });
        return;
      }
      next(error);
    }
  },
);

export default router;
