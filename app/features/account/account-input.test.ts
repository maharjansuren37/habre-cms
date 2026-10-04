import assert from "node:assert/strict";
import { test } from "node:test";
import { isAccountFormBodyAllowed, parseAccountIntent, parseAccountName } from "./account-input.ts";

test("the three forms are told apart by their intent", () => {
  for (const intent of ["name", "email", "password"] as const) {
    assert.equal(parseAccountIntent(intent), intent);
  }
});

test("an unknown, missing or non-text intent is refused", () => {
  for (const value of ["delete", "Name", "", null, undefined, new File([], "x")]) {
    assert.equal(parseAccountIntent(value), null);
  }
});

test("a name is trimmed", () => {
  assert.deepEqual(parseAccountName("  Amara Okafor  "), { ok: true, name: "Amara Okafor" });
});

test("a blank name is refused with the name rule's message", () => {
  assert.deepEqual(parseAccountName("   "), { ok: false, message: "Enter a name." });
  assert.deepEqual(parseAccountName(null), { ok: false, message: "Enter a name." });
});

test("a name over 100 characters is refused", () => {
  const result = parseAccountName("a".repeat(101));
  assert.equal(result.ok, false);
});

test("a form body within 8 KB is allowed", () => {
  assert.equal(isAccountFormBodyAllowed(new Headers({ "Content-Length": "200" })), true);
});

test("a form body over 8 KB, or with no valid length, is refused", () => {
  assert.equal(isAccountFormBodyAllowed(new Headers({ "Content-Length": "9000" })), false);
  assert.equal(isAccountFormBodyAllowed(new Headers()), false);
  assert.equal(isAccountFormBodyAllowed(new Headers({ "Content-Length": "abc" })), false);
});
