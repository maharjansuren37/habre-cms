import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressMatches,
  deletionCase,
  isDeleteFormBodyAllowed,
  parseDeleteExpect,
  parseDeleteForm,
} from "./account-delete-input.ts";

test("expect accepts leave and site and nothing else", () => {
  assert.equal(parseDeleteExpect("leave"), "leave");
  assert.equal(parseDeleteExpect("site"), "site");
  assert.equal(parseDeleteExpect("Leave"), null);
  assert.equal(parseDeleteExpect(""), null);
  assert.equal(parseDeleteExpect(null), null);
  assert.equal(parseDeleteExpect(["leave"]), null);
});

test("leaving needs only the current password, kept exactly as typed", () => {
  assert.deepEqual(parseDeleteForm("leave", undefined, "  p a s s  "), {
    ok: true,
    expect: "leave",
    address: "",
    currentPassword: "  p a s s  ",
  });
});

test("a blank current password is refused below the field", () => {
  const result = parseDeleteForm("leave", undefined, "");
  assert.deepEqual(result, {
    ok: false,
    errors: { currentPassword: "Enter your current password." },
    typedAddress: "",
  });
});

test("a missing or non-text password is refused", () => {
  const result = parseDeleteForm("leave", undefined, null);
  assert.equal(result.ok, false);
  assert.equal(
    result.ok === false && result.errors.currentPassword,
    "Enter your current password.",
  );
});

test("taking the site needs the typed address as well", () => {
  const result = parseDeleteForm("site", "   ", "pw");
  assert.deepEqual(result, {
    ok: false,
    errors: { address: "Type the site's address to confirm." },
    typedAddress: "   ",
  });
});

test("taking the site keeps the typed address and reports both errors", () => {
  const ok = parseDeleteForm("site", " Mysite ", "pw");
  assert.deepEqual(ok, { ok: true, expect: "site", address: " Mysite ", currentPassword: "pw" });
  const both = parseDeleteForm("site", "", "");
  assert.equal(both.ok, false);
  assert.deepEqual(both.ok === false && Object.keys(both.errors).sort(), [
    "address",
    "currentPassword",
  ]);
});

test("the address matches trimmed and ignoring case", () => {
  assert.equal(addressMatches("  MySite ", "mysite"), true);
  assert.equal(addressMatches("mysite", "mysite"), true);
});

test("a different or empty address does not match", () => {
  assert.equal(addressMatches("mysit", "mysite"), false);
  assert.equal(addressMatches("my site", "mysite"), false);
  assert.equal(addressMatches("", "mysite"), false);
});

test("the body cap is the Users forms' 8 KB, and needs a declared length", () => {
  assert.equal(isDeleteFormBodyAllowed(new Headers({ "Content-Length": "8192" })), true);
  assert.equal(isDeleteFormBodyAllowed(new Headers({ "Content-Length": "8193" })), false);
  assert.equal(isDeleteFormBodyAllowed(new Headers()), false);
});

test("a member who is not the last active admin leaves, on any site", () => {
  assert.equal(deletionCase({ isLastActiveAdmin: false, isOldestSite: false }), "leave");
  assert.equal(deletionCase({ isLastActiveAdmin: false, isOldestSite: true }), "leave");
});

test("the last active admin takes the site, unless it is the oldest site", () => {
  assert.equal(deletionCase({ isLastActiveAdmin: true, isOldestSite: false }), "site");
  assert.equal(deletionCase({ isLastActiveAdmin: true, isOldestSite: true }), "refused");
});
