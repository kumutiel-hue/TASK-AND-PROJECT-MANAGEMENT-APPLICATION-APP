import mongoose from "mongoose";

const calendarEventSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    date: {
      type: String,
      required: true,
      validate: {
        validator(value) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const date = new Date(`${value}T00:00:00.000Z`);
          return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
        },
        message: "Date must be a valid calendar date in YYYY-MM-DD format",
      },
    },
    kind: {
      type: String,
      enum: ["Meeting", "Deadline", "Reminder"],
      default: "Meeting",
    },
  },
  { timestamps: true },
);

export default mongoose.model("CalendarEvent", calendarEventSchema);
