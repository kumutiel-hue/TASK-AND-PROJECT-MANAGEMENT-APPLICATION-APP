import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: ["Planning", "In Progress", "On Hold", "Completed"],
      default: "Planning",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    manager: { type: String, trim: true, maxlength: 100, default: "" },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "TeamMember" }],
    startDate: { type: Date },
    dueDate: { type: Date },
    progress: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("Project", projectSchema);
