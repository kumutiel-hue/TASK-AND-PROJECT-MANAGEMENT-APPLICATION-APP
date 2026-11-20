import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { sendWorkspaceNotification } from "./authEmailNotifications.js";

const taskLink = "#/tasks";
const projectLink = (projectId) => `#/projects/${projectId}`;

export function getDueReminderDetails(task, now = new Date()) {
  const startOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dueDate = new Date(task.dueDate);
  const dateKey = dueDate.toISOString().slice(0, 10);
  return {
    title: dueDate < startOfTomorrow ? "Task due today" : "Task due tomorrow",
    body: `“${task.title}” is due on ${dateKey}.`,
    dedupeKey: `due:${task._id}:${task.assigneeUser}:${dateKey}`,
  };
}

async function createNotification({
  workspaceId,
  user,
  kind,
  title,
  body,
  link,
  dedupeKey,
  emailPreference,
}) {
  if (!user) return;

  let notification;
  try {
    notification = await Notification.create({
      workspace: workspaceId,
      recipient: user._id,
      kind,
      title,
      body,
      link,
      dedupeKey,
    });
  } catch (error) {
    if (error.code === 11000 && dedupeKey) return;
    console.error("NexaFlow in-app notification could not be saved:", error.message);
    return;
  }

  if (!emailPreference || !user.notificationPreferences?.[emailPreference]) return;

  try {
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
      .split(",")[0]
      .trim()
      .replace(/\/$/, "");
    await sendWorkspaceNotification({
      email: user.email,
      name: user.name,
      subject: title,
      message: body,
      link: `${clientUrl}/${link}`,
    });
    notification.emailedAt = new Date();
    await notification.save();
  } catch (error) {
    console.error(`NexaFlow ${kind} email could not be delivered:`, error.message);
  }
}

export async function notifyTaskAssignment({ workspaceId, actorId, task, previousAssigneeId = null }) {
  const assigneeId = task.assigneeUser?._id || task.assigneeUser;
  if (!assigneeId || assigneeId.toString() === previousAssigneeId?.toString()) return;
  if (assigneeId.toString() === actorId.toString()) return;
  const [user, isMember] = await Promise.all([
    User.findById(assigneeId).select("name email notificationPreferences"),
    Workspace.exists({ _id: workspaceId, "members.user": assigneeId }),
  ]);
  if (!isMember) return;
  await createNotification({
    workspaceId,
    user,
    kind: "task_assignment",
    title: "A task was assigned to you",
    body: `You are now assigned to “${task.title}”.`,
    link: taskLink,
    emailPreference: "taskAssignments",
  });
}

export async function notifyProjectUpdate({ workspaceId, actorId, project, action }) {
  const workspace = await Workspace.findById(workspaceId).select("members");
  if (!workspace) return;
  const userIds = workspace.members
    .map((member) => member.user)
    .filter((userId) => userId.toString() !== actorId.toString());
  const users = await User.find({ _id: { $in: userIds } })
    .select("name email notificationPreferences");
  await Promise.all(users.map((user) => createNotification({
    workspaceId,
    user,
    kind: "project_update",
    title: `Project ${action}`,
    body: `“${project.name}” was ${action}.`,
    link: projectLink(project._id),
    emailPreference: "projectUpdates",
  })));
}

export async function runDueDateReminders(now = new Date()) {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await Task.find({
    status: { $ne: "Completed" },
    dueDate: { $gte: startOfToday, $lt: startOfDayAfterTomorrow },
    assigneeUser: { $ne: null },
  }).select("workspace title dueDate assigneeUser");

  for (const task of tasks) {
    const [user, isMember] = await Promise.all([
      User.findById(task.assigneeUser).select("name email notificationPreferences"),
      Workspace.exists({ _id: task.workspace, "members.user": task.assigneeUser }),
    ]);
    if (!user || !isMember) continue;
    const reminder = getDueReminderDetails(task, now);
    await createNotification({
      workspaceId: task.workspace,
      user,
      kind: "due_reminder",
      title: reminder.title,
      body: reminder.body,
      link: taskLink,
      dedupeKey: reminder.dedupeKey,
      emailPreference: "dueDateReminders",
    });
  }
}

export async function runWeeklySummaries(now = new Date()) {
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
  ));
  const weekKey = monday.toISOString().slice(0, 10);
  const workspaces = await Workspace.find().select("_id");

  for (const workspace of workspaces) {
    const [activityCount, members] = await Promise.all([
      Activity.countDocuments({ workspace: workspace._id, createdAt: { $gte: weekStart } }),
      Workspace.findById(workspace._id)
        .select("members")
        .populate({
          path: "members.user",
          match: { "notificationPreferences.weeklySummary": true },
          select: "name email notificationPreferences",
        }),
    ]);
    for (const member of members?.members || []) {
      if (!member.user) continue;
      await createNotification({
        workspaceId: workspace._id,
        user: member.user,
        kind: "project_update",
        title: "Your weekly NexaFlow summary",
        body: `${activityCount} workspace updates were recorded in the last 7 days.`,
        link: "#/notifications",
        dedupeKey: `weekly:${member.user._id}:${weekKey}`,
        emailPreference: "weeklySummary",
      });
    }
  }
}
