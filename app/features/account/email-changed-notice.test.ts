import assert from "node:assert/strict";
import { test } from "node:test";
import { emailChangedNotice } from "./email-changed-notice.ts";

test("the subject says the email was changed", () => {
  assert.equal(emailChangedNotice("Lena").subject, "Your Habre email was changed");
});

test("the text says what happened and what to do if it was not them", () => {
  const { text } = emailChangedNotice("Lena");
  assert.match(text, /The email address for your Habre account was just changed\./);
  assert.match(text, /This address will no longer get emails about it\./);
  assert.match(text, /If you made this change, there's nothing to do\./);
  assert.match(
    text,
    /If you didn't, someone may have your password\. Reply to this email and we'll help you get your account back\./,
  );
});

test("it never names an address", () => {
  assert.ok(!emailChangedNotice("Lena Novak").text.includes("@"));
});

test("it greets by first name when it has one", () => {
  assert.match(emailChangedNotice("Lena Novak").text, /^Hi Lena,/);
  assert.match(emailChangedNotice().text, /^Hi,/);
});

test("it is plain text: no markup from the name", () => {
  const { text } = emailChangedNotice("<b>Lena</b> Novak");
  assert.ok(!text.includes("<"));
  assert.ok(!text.includes(">"));
  assert.match(text, /^Hi bLena\/b,/);
});
