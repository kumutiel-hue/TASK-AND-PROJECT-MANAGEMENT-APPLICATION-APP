import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { runDueDateReminders, runWeeklySummaries } from "./services/notifications.js";
import { migrateLegacyWorkspace } from "./services/workspaceMigration.js";

const port = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to start the NexaFlow API.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await migrateLegacyWorkspace();
  const runNotificationJobs = async () => {
    await Promise.all([runDueDateReminders(), runWeeklySummaries()]);
  };
  const reminderTimer = setInterval(() => {
    runNotificationJobs().catch((error) => {
      console.error("NexaFlow scheduled notification job failed:", error);
    });
  }, 15 * 60 * 1000);
  reminderTimer.unref();
  runNotificationJobs().catch((error) => {
    console.error("NexaFlow scheduled notification job failed:", error);
  });
  app.listen(port, () => {
    console.log(`NexaFlow API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("NexaFlow API failed to start:", error);
  process.exit(1);
});
