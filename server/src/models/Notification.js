import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, required: true, enum: ["task_assignment", "project_update", "due_reminder"] },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 500 },
    link: { type: String, required: true, maxlength: 300 },
    dedupeKey: { type: String, unique: true, sparse: true },
    readAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ workspace: 1, recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
