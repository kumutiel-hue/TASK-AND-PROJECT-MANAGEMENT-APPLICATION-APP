import { Router } from "express";
import CalendarEvent from "../models/CalendarEvent.js";
import { requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activityLog.js";

const router = Router();

router.get("/", async (request, response, next) => {
  try {
    const events = await CalendarEvent.find({ workspace: request.workspaceId })
      .sort({ date: 1, title: 1 })
      .lean();
    response.json(events);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const event = await CalendarEvent.create({
      title: request.body?.title,
      description: request.body?.description,
      date: request.body?.date,
      kind: request.body?.kind,
      workspace: request.workspaceId,
    });
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "created",
      entityType: "Calendar event",
      entityId: event._id,
      summary: `${request.authUser.name} created calendar event “${event.title}”.`,
    });
    response.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: request.params.id, workspace: request.workspaceId },
      {
        title: request.body.title,
        description: request.body.description,
        date: request.body.date,
        kind: request.body.kind,
      },
      { new: true, runValidators: true },
    );
    if (!event) {
      return response.status(404).json({ message: "Calendar event not found" });
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "updated",
      entityType: "Calendar event",
      entityId: event._id,
      summary: `${request.authUser.name} updated calendar event “${event.title}”.`,
    });
    response.json(event);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireWorkspaceRole("Administrator", "Project Manager"), async (request, response, next) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({
      _id: request.params.id,
      workspace: request.workspaceId,
    });
    if (!event) {
      return response.status(404).json({ message: "Calendar event not found" });
    }
    await recordActivity({
      workspaceId: request.workspaceId,
      actorId: request.authUser._id,
      action: "deleted",
      entityType: "Calendar event",
      entityId: event._id,
      summary: `${request.authUser.name} deleted calendar event “${event.title}”.`,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
