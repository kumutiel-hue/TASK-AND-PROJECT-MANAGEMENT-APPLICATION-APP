import Activity from "../models/Activity.js";

export async function recordActivity({
  workspaceId,
  actorId,
  projectId = null,
  action,
  entityType,
  entityId,
  summary,
}) {
  try {
    await Activity.create({
      workspace: workspaceId,
      actor: actorId,
      project: projectId,
      action,
      entityType,
      entityId,
      summary,
    });
  } catch (error) {
    console.error("NexaFlow activity log could not be saved:", error.message);
  }
}
