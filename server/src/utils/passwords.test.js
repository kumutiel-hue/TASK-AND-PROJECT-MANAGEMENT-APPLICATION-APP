import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./passwords.js";

test("password hashes are salted and verify only the matching password", async () => {
  const password = "taskflow-test-password";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("incorrect-password", firstHash), false);
});

test("malformed password hashes are rejected", async () => {
  assert.equal(await verifyPassword("any-password", "not-a-valid-hash"), false);
});
