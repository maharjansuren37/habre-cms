import assert from "node:assert/strict";
import { test } from "node:test";
import { verificationEmail } from "./verification-email.ts";

const ADMIN_URL = "https://cms.example.test";

test("the text carries the confirm link with the token", () => {
  const { text } = verificationEmail(ADMIN_URL, "abc-DEF_123", "Lena Novak");
  assert.match(text, /^https:\/\/cms\.example\.test\/verify\?token=abc-DEF_123$/m);
});

test("a trailing slash on the admin URL does not double up", () => {
  const { text } = verificationEmail(`${ADMIN_URL}/`, "tok");
  assert.ok(text.includes("https://cms.example.test/verify?token=tok"));
  assert.ok(!text.includes("//verify"));
});

test("it says the link works once and for 24 hours", () => {
  const { text } = verificationEmail(ADMIN_URL, "tok");
  assert.match(text, /24 hours/);
  assert.match(text, /once/i);
});

test("it greets by first name when it has one", () => {
  assert.match(verificationEmail(ADMIN_URL, "tok", "Lena Novak").text, /^Hi Lena,/);
  assert.match(verificationEmail(ADMIN_URL, "tok").text, /^Hi,/);
});

test("it is plain text: no HTML", () => {
  const { subject, text } = verificationEmail(ADMIN_URL, "tok", "Lena <b>Novak</b>");
  assert.ok(!subject.includes("<"));
  assert.ok(!text.includes("<b>"));
  assert.ok(subject.length > 0);
});
