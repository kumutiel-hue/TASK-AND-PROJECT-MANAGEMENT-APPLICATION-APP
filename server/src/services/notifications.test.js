import test from "node:test";
import assert from "node:assert/strict";
import { getDueReminderDetails } from "./notifications.js";

test("due reminders label tasks due the next UTC day", () => {
  const reminder = getDueReminderDetails(
    {
      _id: "task-1",
      assigneeUser: "user-1",
      title: "Review proposal",
      dueDate: new Date("2025-06-11T00:00:00.000Z"),
    },
    new Date("2025-06-10T12:00:00.000Z"),
  );

  assert.equal(reminder.title, "Task due tomorrow");
  assert.equal(reminder.body, "“Review proposal” is due on 2025-06-11.");
  assert.equal(reminder.dedupeKey, "due:task-1:user-1:2025-06-11");
});

test("due reminders catch up tasks due today after a scheduler interruption", () => {
  const reminder = getDueReminderDetails(
    {
      _id: "task-1",
      assigneeUser: "user-1",
      title: "Review proposal",
      dueDate: new Date("2025-06-10T00:00:00.000Z"),
    },
    new Date("2025-06-10T12:00:00.000Z"),
  );

  assert.equal(reminder.title, "Task due today");
  assert.equal(reminder.dedupeKey, "due:task-1:user-1:2025-06-10");
});

test("due reminder deduplication is stable per task, assignee, and due date", () => {
  const task = {
    _id: "task-1",
    assigneeUser: "user-1",
    title: "Review proposal",
    dueDate: new Date("2025-06-11T00:00:00.000Z"),
  };

  const firstRun = getDueReminderDetails(task, new Date("2025-06-10T10:00:00.000Z"));
  const repeatedRun = getDueReminderDetails(task, new Date("2025-06-10T23:00:00.000Z"));
  const nextAssignee = getDueReminderDetails({ ...task, assigneeUser: "user-2" }, new Date("2025-06-10T23:00:00.000Z"));

  assert.equal(firstRun.dedupeKey, repeatedRun.dedupeKey);
  assert.notEqual(firstRun.dedupeKey, nextAssignee.dedupeKey);
});
