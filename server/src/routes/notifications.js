import { Router } from "express";
import Notification from "../models/Notification.js";

const router = Router();

router.get("/", async (request, response, next) => {
  try {
    const notifications = await Notification.find({
      workspace: request.workspaceId,
      recipient: request.authUser._id,
    }).sort({ createdAt: -1 }).limit(100).lean();
    response.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", async (request, response, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: request.params.id,
        workspace: request.workspaceId,
        recipient: request.authUser._id,
      },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      response.status(404).json({ message: "Notification not found" });
      return;
    }
    response.json(notification);
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", async (request, response, next) => {
  try {
    await Notification.updateMany(
      {
        workspace: request.workspaceId,
        recipient: request.authUser._id,
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
