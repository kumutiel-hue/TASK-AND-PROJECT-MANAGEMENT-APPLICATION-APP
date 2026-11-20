import mongoose from "mongoose";

const workspaceInvitationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: {
      type: String,
      enum: ["Project Manager", "Team Member"],
      default: "Team Member",
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    acceptedAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

workspaceInvitationSchema.index({ workspace: 1, email: 1 }, { unique: true });

export default mongoose.model("WorkspaceInvitation", workspaceInvitationSchema);
