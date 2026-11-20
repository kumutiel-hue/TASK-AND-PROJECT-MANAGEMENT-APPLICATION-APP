import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["Pending", "Active"], default: "Active" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^\S+@\S+\.\S+$/,
    },
    role: {
      type: String,
      enum: ["Administrator", "Project Manager", "Team Member"],
      default: "Team Member",
    },
  },
  { timestamps: true },
);

teamMemberSchema.index({ workspace: 1, email: 1 }, { unique: true });

export default mongoose.model("TeamMember", teamMemberSchema);
