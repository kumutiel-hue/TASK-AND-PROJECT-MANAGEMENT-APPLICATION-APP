import { createHash } from "node:crypto";
import AuthSession from "../models/AuthSession.js";
import Workspace from "../models/Workspace.js";

export const SESSION_COOKIE_NAME = "taskflow_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(request) {
  const cookieHeader = request.headers.cookie || "";
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return valueParts.join("=");
  }
  return "";
}

export function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production";
  const attributes = [
    "Path=/api",
    "HttpOnly",
    `SameSite=${secure ? "None" : "Lax"}`,
    `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`,
  ];
  if (secure) attributes.push("Secure");
  response.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=${token}; ${attributes.join("; ")}`);
}

export function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production";
  const attributes = [
    "Path=/api",
    "HttpOnly",
    `SameSite=${secure ? "None" : "Lax"}`,
    "Max-Age=0",
  ];
  if (secure) attributes.push("Secure");
  response.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; ${attributes.join("; ")}`);
}

export async function requireAuth(request, response, next) {
  const token = readSessionToken(request);
  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const session = await AuthSession.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).populate("user", "name email role notificationPreferences");
    if (!session?.user) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const workspace = await Workspace.findOne({ "members.user": session.user._id })
      .select("_id name members")
      .lean();
    const membership = workspace?.members.find((member) => member.user.toString() === session.user._id.toString());
    if (!membership) {
      response.status(403).json({ message: "Workspace membership is required" });
      return;
    }

    request.authUser = session.user;
    request.authSessionId = session._id;
    request.workspaceId = workspace._id;
    request.workspaceName = workspace.name;
    request.workspaceRole = membership.role;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWorkspaceRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.workspaceRole)) {
      response.status(403).json({ message: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
