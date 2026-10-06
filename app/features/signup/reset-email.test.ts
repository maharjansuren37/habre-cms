import assert from "node:assert/strict";
import { test } from "node:test";
import { RESET_LIFETIME_HOURS, resetEmail } from "./reset-email.ts";

const PLATFORM_URL = "https://cms.example.test";

test("the text carries the reset link with the token", () => {
  const { text } = resetEmail(PLATFORM_URL, "abc-DEF_123", "Lena Novak");
  assert.match(text, /^https:\/\/cms\.example\.test\/reset-password\?token=abc-DEF_123$/m);
});

test("a trailing slash on the admin URL does not double up", () => {
  const { text } = resetEmail(`${PLATFORM_URL}/`, "tok");
  assert.ok(text.includes("https://cms.example.test/reset-password?token=tok"));
  assert.ok(!text.includes("//reset-password"));
});

test("the token is percent-encoded in the link", () => {
  const { text } = resetEmail(PLATFORM_URL, "a b&c");
  assert.ok(text.includes("token=a%20b%26c"));
});

test("it says the link works once and for 1 hour", () => {
  const { text } = resetEmail(PLATFORM_URL, "tok");
  assert.equal(RESET_LIFETIME_HOURS, 1);
  assert.match(text, /once and for 1 hour/);
});

test("it says what to do if the person did not ask", () => {
  const { text } = resetEmail(PLATFORM_URL, "tok");
  assert.match(
    text,
    /If you didn't ask for this, ignore this email\. Your password has not changed\./,
  );
});

test("it greets by first name when it has one", () => {
  assert.match(resetEmail(PLATFORM_URL, "tok", "Lena Novak").text, /^Hi Lena,/);
  assert.match(resetEmail(PLATFORM_URL, "tok").text, /^Hi,/);
});

test("it is plain text with the right subject: no HTML", () => {
  const { subject, text } = resetEmail(PLATFORM_URL, "tok", "Lena <b>Novak</b>");
  assert.equal(subject, "Reset your Habre password");
  assert.ok(!subject.includes("<"));
  assert.ok(!text.includes("<b>"));
});
