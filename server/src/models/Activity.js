import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, maxlength: 60 },
    entityType: { type: String, required: true, enum: ["Project", "Task", "Team member", "Calendar event"] },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    summary: { type: String, required: true, maxlength: 240 },
  },
  { timestamps: true },
);

activitySchema.index({ workspace: 1, project: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
