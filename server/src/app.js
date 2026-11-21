import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import eventsRouter from "./routes/events.js";
import notificationsRouter from "./routes/notifications.js";
import projectActivityRouter from "./routes/projectActivity.js";
import projectFilesRouter from "./routes/projectFiles.js";
import projectsRouter from "./routes/projects.js";
import tasksRouter from "./routes/tasks.js";
import teamRouter from "./routes/team.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedLocalOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return /^(10|192\.168)\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
  } catch {
    return false;
  }
}

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isAllowedLocalOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
app.use("/api/auth", authRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/projects", requireAuth, projectFilesRouter);
app.use("/api/projects", requireAuth, projectActivityRouter);
app.use("/api/projects", requireAuth, projectsRouter);
app.use("/api/tasks", requireAuth, tasksRouter);
app.use("/api/team", requireAuth, teamRouter);
app.use("/api/events", requireAuth, eventsRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
