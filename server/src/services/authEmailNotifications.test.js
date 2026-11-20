import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailConfigurationError,
  sendAuthNotification,
} from "./authEmailNotifications.js";

test("authentication email delivery reports missing SMTP configuration", async () => {
  const previousHost = process.env.SMTP_HOST;
  process.env.SMTP_HOST = "";

  try {
    await assert.rejects(
      sendAuthNotification({
        event: "login",
        email: "person@example.com",
        name: "Example User",
      }),
      EmailConfigurationError,
    );
  } finally {
    if (previousHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previousHost;
  }
});
