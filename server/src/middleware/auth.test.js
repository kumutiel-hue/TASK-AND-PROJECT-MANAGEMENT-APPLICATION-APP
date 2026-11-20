import test from "node:test";
import assert from "node:assert/strict";
import { requireWorkspaceRole } from "./auth.js";

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("workspace role middleware allows configured roles", () => {
  const response = createResponse();
  let continued = false;

  requireWorkspaceRole("Administrator", "Project Manager")(
    { workspaceRole: "Project Manager" },
    response,
    () => { continued = true; },
  );

  assert.equal(continued, true);
  assert.equal(response.statusCode, null);
});

test("workspace role middleware rejects other roles", () => {
  const response = createResponse();
  let continued = false;

  requireWorkspaceRole("Administrator")(
    { workspaceRole: "Team Member" },
    response,
    () => { continued = true; },
  );

  assert.equal(continued, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, "You do not have permission to perform this action");
});
