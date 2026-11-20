import nodemailer from "nodemailer";

export class EmailConfigurationError extends Error {
  constructor() {
    super("Email notifications are not configured. Set SMTP_HOST, SMTP_PORT, and EMAIL_FROM.");
    this.name = "EmailConfigurationError";
  }
}

function getSmtpConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim() || "";
  const password = process.env.SMTP_PASS || "";
  const from = process.env.EMAIL_FROM?.trim();

  if (
    !host
    || !Number.isInteger(port)
    || port < 1
    || port > 65535
    || !from
    || Boolean(user) !== Boolean(password)
  ) {
    throw new EmailConfigurationError();
  }

  return { host, port, user, password, from };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendEmail({ to, subject, text, html }) {
  const { host, port, user, password, from } = getSmtpConfiguration();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass: password } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transporter.sendMail({ from, to, subject, text, html });
}

export async function sendAuthNotification({ event, email, name }) {
  const timestamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const safeName = escapeHtml(name);
  const isRegistration = event === "register";
  const subject = isRegistration
    ? "Your NexaFlow account was created"
    : "New sign-in to NexaFlow";
  const text = isRegistration
    ? `Hello ${name},\n\nYour NexaFlow account was created successfully.\n\nIf you did not create this account, contact your workspace administrator.`
    : `Hello ${name},\n\nA sign-in to your NexaFlow account occurred at ${timestamp}.\n\nIf this was not you, change your password from Settings after signing in and contact your workspace administrator.`;
  const html = isRegistration
    ? `<p>Hello ${safeName},</p><p>Your NexaFlow account was created successfully.</p><p>If you did not create this account, contact your workspace administrator.</p>`
    : `<p>Hello ${safeName},</p><p>A sign-in to your NexaFlow account occurred at ${timestamp}.</p><p>If this was not you, change your password from Settings after signing in and contact your workspace administrator.</p>`;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

export async function sendWorkspaceInvitation({ email, name, workspaceName, inviteUrl }) {
  const safeName = escapeHtml(name);
  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  await sendEmail({
    to: email,
    subject: `Invitation to join ${workspaceName} on NexaFlow`,
    text: `Hello ${name},\n\nYou have been invited to join ${workspaceName} on NexaFlow. Accept your invitation by creating an account here:\n${inviteUrl}\n\nThis invitation expires in 7 days.`,
    html: `<p>Hello ${safeName},</p><p>You have been invited to join ${safeWorkspace} on NexaFlow.</p><p><a href="${safeInviteUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
  });
}

export async function sendWorkspaceNotification({ email, name, subject, message, link }) {
  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message);
  const safeLink = escapeHtml(link);
  await sendEmail({
    to: email,
    subject,
    text: `Hello ${name},\n\n${message}\n\nOpen NexaFlow: ${link}`,
    html: `<p>Hello ${safeName},</p><p>${safeMessage}</p><p><a href="${safeLink}">Open NexaFlow</a></p>`,
  });
}
