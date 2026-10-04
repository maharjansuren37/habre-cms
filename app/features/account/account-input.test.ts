import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAccountFormBodyAllowed,
  parseAccountEmail,
  parseAccountIntent,
  parseAccountName,
  parseAccountPassword,
} from "./account-input.ts";

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

test("a current and a long enough new password are accepted untrimmed", () => {
  assert.deepEqual(parseAccountPassword(" old pass ", "  a new passphrase  "), {
    ok: true,
    currentPassword: " old pass ",
    newPassword: "  a new passphrase  ",
  });
});

test("a missing current password is refused beside its field", () => {
  for (const value of ["", null, undefined, new File([], "x")]) {
    const result = parseAccountPassword(value, "a new passphrase");
    assert.deepEqual(result, {
      ok: false,
      errors: { currentPassword: "Enter your current password." },
    });
  }
});

test("a new password under 12 characters is refused beside its field", () => {
  const result = parseAccountPassword("old", "short");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.currentPassword, undefined);
    assert.match(result.errors.newPassword ?? "", /12/);
  }
});

test("both fields can be refused at once", () => {
  const result = parseAccountPassword("", "short");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.currentPassword);
    assert.ok(result.errors.newPassword);
  }
});

test("a new email is trimmed and lowercased, with the password kept as typed", () => {
  assert.deepEqual(parseAccountEmail("  New@Example.org ", " pw ", "me@example.org"), {
    ok: true,
    newEmail: "new@example.org",
    currentPassword: " pw ",
  });
});

test("an invalid address is refused with the email rule's message, and the typed value is returned", () => {
  assert.deepEqual(parseAccountEmail("not an address", "pw", "me@example.org"), {
    ok: false,
    errors: { newEmail: "Enter an email address like name@example.org." },
    typed: "not an address",
  });
});

test("the current address is refused after trimming and lowercasing", () => {
  assert.deepEqual(parseAccountEmail("  ME@Example.org ", "pw", "me@example.org"), {
    ok: false,
    errors: { newEmail: "That's already your email." },
    typed: "  ME@Example.org ",
  });
});

test("a missing current password is refused, beside any email error", () => {
  assert.deepEqual(parseAccountEmail("new@example.org", "", "me@example.org"), {
    ok: false,
    errors: { currentPassword: "Enter your current password." },
    typed: "new@example.org",
  });
  assert.deepEqual(parseAccountEmail("nope", null, "me@example.org").ok, false);
});
