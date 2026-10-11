import assert from "node:assert/strict";
import { test } from "node:test";
import { contactNotificationEmail, notificationRecipients } from "./notification-email.ts";

const base = {
  siteTitle: "Lena's Bakery",
  visitorName: "Sam Visitor",
  visitorEmail: "sam@example.org",
  message: "Hello,\n  do you open <b>early</b> on Sundays?\n\nThanks & bye",
  pageTitle: "Opening hours",
  messagesUrl: "https://app.example.org/admin/messages",
};

test("a name with a newline gives a one-line subject", () => {
  const { subject } = contactNotificationEmail({
    ...base,
    visitorName: "Sam\r\nBcc: x@y.z\tJones",
  });
  assert.equal(subject, "New message from Sam Bcc: x@y.z Jones on Lena's Bakery");
  assert.doesNotMatch(subject, /[\r\n\t]/);
});

test("a site title with control characters is collapsed in the subject", () => {
  const { subject } = contactNotificationEmail({ ...base, siteTitle: "  Lena\n\u0000 Bakery  " });
  assert.equal(subject, "New message from Sam Visitor on Lena Bakery");
});

test("a 300-character name gives a subject of at most 120 characters", () => {
  const { subject } = contactNotificationEmail({ ...base, visitorName: "n".repeat(300) });
  assert.ok(subject.length <= 120, `length ${subject.length}`);
  assert.ok(subject.startsWith("New message from nnn"));
});

test("the message and the visitor's address appear unchanged in the body", () => {
  const { text } = contactNotificationEmail(base);
  assert.ok(text.includes(base.message));
  assert.ok(text.includes("sam@example.org"));
  assert.ok(text.includes("Sam Visitor"));
  assert.ok(text.includes("Opening hours"));
});

test("the body ends with the Messages link and the reply line", () => {
  const { text } = contactNotificationEmail(base);
  assert.ok(text.includes("https://app.example.org/admin/messages"));
  assert.ok(text.includes("Reply to this email to answer them."));
  assert.ok(text.indexOf(base.message) < text.indexOf("https://app.example.org/admin/messages"));
});

test("the builder adds no HTML of its own", () => {
  const { text } = contactNotificationEmail({
    ...base,
    message: "plain words",
    visitorName: "Sam",
    siteTitle: "Bakery",
    pageTitle: "Hours",
  });
  assert.doesNotMatch(text, /<[a-z!/]/i);
  assert.doesNotMatch(text, /<html/i);
});

test("recipients are the setting alone when it is set", () => {
  assert.deepEqual(notificationRecipients("  owner@example.org ", ["a@example.org"]), [
    "owner@example.org",
  ]);
});

test("recipients are the de-duplicated lower-cased admins when the setting is blank", () => {
  assert.deepEqual(
    notificationRecipients("   ", ["Ann@Example.org", "bob@example.org", "ann@example.org"]),
    ["ann@example.org", "bob@example.org"],
  );
});

test("recipients are empty when there is no setting and no admin", () => {
  assert.deepEqual(notificationRecipients("", []), []);
});
