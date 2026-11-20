import mongoose from "mongoose";

const workspaceMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["Administrator", "Project Manager", "Team Member"],
      default: "Team Member",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    members: { type: [workspaceMemberSchema], default: [] },
    timezone: { type: String, default: "UTC" },
  },
  { timestamps: true },
);

export default mongoose.model("Workspace", workspaceSchema);
