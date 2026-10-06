import assert from "node:assert/strict";
import { test } from "node:test";
import { EMAIL_CHANGE_LIFETIME_HOURS, emailChangeEmail } from "./email-change-email.ts";

const PLATFORM_URL = "https://cms.example.test";

test("the text carries the confirm link with the token", () => {
  const { text } = emailChangeEmail(PLATFORM_URL, "abc-DEF_123", "Lena Novak");
  assert.match(text, /^https:\/\/cms\.example\.test\/confirm-email\?token=abc-DEF_123$/m);
});

test("a trailing slash on the admin URL does not double up", () => {
  const { text } = emailChangeEmail(`${PLATFORM_URL}/`, "tok");
  assert.ok(text.includes("https://cms.example.test/confirm-email?token=tok"));
  assert.ok(!text.includes("//confirm-email"));
});

test("the token is percent-encoded in the link", () => {
  assert.ok(emailChangeEmail(PLATFORM_URL, "a b&c").text.includes("token=a%20b%26c"));
});

test("it says the link works once and for 24 hours", () => {
  const { text } = emailChangeEmail(PLATFORM_URL, "tok");
  assert.equal(EMAIL_CHANGE_LIFETIME_HOURS, 24);
  assert.match(text, /The link works once and for 24 hours\./);
});

test("it says what to do if the person did not ask", () => {
  assert.match(
    emailChangeEmail(PLATFORM_URL, "tok").text,
    /If you didn't ask for this, ignore this email\. Nothing changes until the link is used\./,
  );
});

test("it greets by first name when it has one", () => {
  assert.match(emailChangeEmail(PLATFORM_URL, "tok", "Lena Novak").text, /^Hi Lena,/);
  assert.match(emailChangeEmail(PLATFORM_URL, "tok").text, /^Hi,/);
});

test("it is plain text with the right subject: no markup from the name", () => {
  const { subject, text } = emailChangeEmail(PLATFORM_URL, "tok", "<b>Lena</b> Novak");
  assert.equal(subject, "Confirm your new Habre email");
  assert.ok(!text.includes("<"));
  assert.ok(!text.includes(">"));
  assert.match(text, /^Hi bLena\/b,/);
});
