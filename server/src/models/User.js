import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["Administrator", "Project Manager", "Team Member"],
      default: "Team Member",
    },
    notificationPreferences: {
      taskAssignments: { type: Boolean, default: true },
      dueDateReminders: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
