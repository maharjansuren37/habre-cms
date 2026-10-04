import assert from "node:assert/strict";
import { test } from "node:test";
import { emailEnvSchema, isEmailOn } from "./email-env.server.ts";

const from = "Habre <hello@example.test>";
// Not parseEnv: database-env.server.ts parses process.env when imported.
const parse = (source: NodeJS.ProcessEnv) => emailEnvSchema.parse(source);

test("signup off with no email variables parses, and the mode defaults to off", () => {
  const env = parse({});
  assert.equal(env.SIGNUP_MODE, "off");
  assert.equal(env.SMTP_URL, undefined);
  assert.equal(env.EMAIL_FROM, undefined);
});

test("blank email variables count as unset", () => {
  assert.equal(parse({ SIGNUP_MODE: "", SMTP_URL: "", EMAIL_FROM: "" }).SIGNUP_MODE, "off");
});

test("an unknown signup mode is refused", () => {
  assert.throws(() => parse({ SIGNUP_MODE: "closed" }), /SIGNUP_MODE/);
});

test("invite without SMTP_URL throws naming SMTP_URL", () => {
  assert.throws(() => parse({ SIGNUP_MODE: "invite", EMAIL_FROM: from }), /SMTP_URL/);
});

test("open without EMAIL_FROM throws naming EMAIL_FROM", () => {
  assert.throws(
    () => parse({ SIGNUP_MODE: "open", SMTP_URL: "smtp://127.0.0.1:1025" }),
    /EMAIL_FROM/,
  );
});

test("the missing-variable message never contains a value", () => {
  assert.throws(
    () => parse({ SIGNUP_MODE: "invite", SMTP_URL: "smtps://u:secretpw@h.example:465" }),
    (error: Error) => /EMAIL_FROM/.test(error.message) && !error.message.includes("secretpw"),
  );
});

test("smtp:// to a host that is not loopback is refused", () => {
  assert.throws(() => parse({ SMTP_URL: "smtp://mail.example.com" }), /SMTP_URL/);
});

test("smtp:// to a loopback host parses", () => {
  for (const url of [
    "smtp://127.0.0.1:1025",
    "smtp://127.0.1.5:25",
    "smtp://localhost:1025",
    "smtp://[::1]:1025",
  ]) {
    assert.equal(parse({ SMTP_URL: url, EMAIL_FROM: from }).SMTP_URL, url);
  }
});

test("smtps:// to a remote host parses", () => {
  const url = "smtps://user:pass@smtp.resend.com:465";
  assert.equal(parse({ SIGNUP_MODE: "invite", SMTP_URL: url, EMAIL_FROM: from }).SMTP_URL, url);
});

test("other schemes are refused", () => {
  assert.throws(() => parse({ SMTP_URL: "http://127.0.0.1:1025" }), /SMTP_URL/);
});

test("EMAIL_FROM without an address is refused", () => {
  assert.throws(() => parse({ EMAIL_FROM: "Habre" }), /EMAIL_FROM/);
});

test("EMAIL_FROM accepts a bare address and Name <address>", () => {
  const smtp = "smtp://127.0.0.1:1025";
  const bare = "hello@example.test";
  assert.equal(parse({ SMTP_URL: smtp, EMAIL_FROM: bare }).EMAIL_FROM, bare);
  assert.equal(parse({ SMTP_URL: smtp, EMAIL_FROM: from }).EMAIL_FROM, from);
});

test("SMTP_URL alone with signup off throws naming EMAIL_FROM", () => {
  assert.throws(() => parse({ SMTP_URL: "smtp://127.0.0.1:1025" }), /EMAIL_FROM/);
});

test("EMAIL_FROM alone with signup off throws naming SMTP_URL", () => {
  assert.throws(() => parse({ EMAIL_FROM: from }), /SMTP_URL/);
});

test("the one-alone message never contains a value", () => {
  assert.throws(
    () => parse({ SMTP_URL: "smtps://u:secretpw@h.example:465" }),
    (error: Error) => /EMAIL_FROM/.test(error.message) && !error.message.includes("secretpw"),
  );
});

test("both email variables set with signup off parses", () => {
  const env = parse({ SMTP_URL: "smtp://127.0.0.1:1025", EMAIL_FROM: from });
  assert.equal(env.EMAIL_FROM, from);
});

test("isEmailOn is true only when both variables are set", () => {
  assert.equal(isEmailOn({ SMTP_URL: "smtp://127.0.0.1:1025", EMAIL_FROM: from }), true);
  assert.equal(isEmailOn({}), false);
  assert.equal(isEmailOn({ SMTP_URL: "smtp://127.0.0.1:1025" }), false);
  assert.equal(isEmailOn({ EMAIL_FROM: from }), false);
  assert.equal(isEmailOn({ SMTP_URL: "", EMAIL_FROM: "" }), false);
});
