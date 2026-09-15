import assert from "node:assert/strict";
import { test } from "node:test";
import { isLoginBodySizeAllowed, parseLoginForm } from "./login-input.ts";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

test("credentials come back with the email normalised and the password as typed", () => {
  assert.deepEqual(
    parseLoginForm(form({ email: "  Amara@Example.ORG ", password: " spaced pass " })),
    { ok: true, email: "amara@example.org", password: " spaced pass " },
  );
});

test("a short existing password is not rejected by the new-password rules", () => {
  const result = parseLoginForm(form({ email: "amara@example.org", password: "short" }));
  assert.equal(result.ok, true);
});

test("empty or missing fields each get their own message", () => {
  assert.deepEqual(parseLoginForm(form({ email: "  ", password: "" })), {
    ok: false,
    fieldErrors: { email: "Enter your email.", password: "Enter your password." },
  });
  assert.deepEqual(parseLoginForm(new FormData()), {
    ok: false,
    fieldErrors: { email: "Enter your email.", password: "Enter your password." },
  });
});

test("an email that is not shaped like one says so", () => {
  const result = parseLoginForm(form({ email: "amara", password: "anything" }));
  assert.equal(result.ok, false);
  assert.match((!result.ok && result.fieldErrors.email) || "", /Enter an email address/);
});

test("an uploaded file in place of a field is treated as empty", () => {
  const formData = form({ password: "anything" });
  formData.set("email", new Blob(["amara@example.org"]));
  assert.deepEqual(parseLoginForm(formData), {
    ok: false,
    fieldErrors: { email: "Enter your email.", password: undefined },
  });
});

test("a password over 200 characters is refused before any password check", () => {
  const result = parseLoginForm(form({ email: "amara@example.org", password: "p".repeat(201) }));
  assert.deepEqual(result, {
    ok: false,
    fieldErrors: { email: undefined, password: "Use at most 200 characters for the password." },
  });
});

test("a login body up to 8 KB may be read", () => {
  assert.equal(isLoginBodySizeAllowed(new Headers({ "Content-Length": "72" })), true);
  assert.equal(isLoginBodySizeAllowed(new Headers({ "Content-Length": "8192" })), true);
});

test("a larger, unknown or malformed body size is refused", () => {
  for (const length of ["8193", "104857600", "-1", "12abc", ""]) {
    assert.equal(isLoginBodySizeAllowed(new Headers({ "Content-Length": length })), false, length);
  }
  assert.equal(isLoginBodySizeAllowed(new Headers()), false);
});
