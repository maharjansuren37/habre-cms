import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "#app/features/users/users.server.ts";
import { checkSessionUser } from "./session-check.ts";

const activeUser: User = {
  id: "6f1d3c2a-8b4e-4f6a-9c1d-2e3f4a5b6c7d",
  email: "amara.okafor@example.org",
  name: "Amara Okafor",
  role: "editor",
  tokenVersion: 2,
  deactivatedAt: null,
};
const claims = { userId: activeUser.id, tokenVersion: 2 };

test("an active user whose token version matches gets the session user, and nothing more", () => {
  assert.deepEqual(checkSessionUser(claims, activeUser), {
    ok: true,
    user: {
      id: activeUser.id,
      email: "amara.okafor@example.org",
      name: "Amara Okafor",
      role: "editor",
    },
  });
});

test("a user who no longer exists is refused", () => {
  assert.deepEqual(checkSessionUser(claims, null), { ok: false, reason: "no_user" });
});

test("a deactivated user is refused, even with a matching token version", () => {
  const deactivated = { ...activeUser, deactivatedAt: new Date("2026-09-14T09:00:00Z") };
  assert.deepEqual(checkSessionUser(claims, deactivated), { ok: false, reason: "deactivated" });
});

test("a token from before the user's sessions were revoked is refused", () => {
  const revoked = { ...activeUser, tokenVersion: 3 };
  assert.deepEqual(checkSessionUser(claims, revoked), { ok: false, reason: "token_revoked" });
});

test("the role comes from the user row, not from anything the token carried", () => {
  const promoted = { ...activeUser, role: "admin" as const };
  const result = checkSessionUser(claims, promoted);
  assert.equal(result.ok && result.user.role, "admin");
});
