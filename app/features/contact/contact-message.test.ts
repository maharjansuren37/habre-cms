import assert from "node:assert/strict";
import { test } from "node:test";
import { contactMessageSchema, parseContactAnswer } from "./contact-message.ts";

const ok = { name: "Lena", email: "lena@example.test", message: "Hello" };
const parse = (patch: Partial<Record<keyof typeof ok, string>>) =>
  contactMessageSchema.safeParse({ ...ok, ...patch });

test("a valid message parses", () => {
  assert.deepEqual(parse({}).data, ok);
});

test("fields are trimmed", () => {
  assert.deepEqual(parse({ name: "  Lena ", message: "\n hi \n" }).data, {
    ...ok,
    name: "Lena",
    message: "hi",
  });
});

test("name is 1 to 100 characters", () => {
  assert.equal(parse({ name: "" }).success, false);
  assert.equal(parse({ name: "   " }).success, false);
  assert.equal(parse({ name: "a" }).success, true);
  assert.equal(parse({ name: "a".repeat(100) }).success, true);
  assert.equal(parse({ name: "a".repeat(101) }).success, false);
});

test("email is at most 254 characters", () => {
  const local = (n: number) => `${"a".repeat(n - "@b.co".length)}@b.co`;
  assert.equal(parse({ email: local(254) }).success, true);
  assert.equal(parse({ email: local(255) }).success, false);
  assert.equal(parse({ email: "" }).success, false);
});

test("an address needs an @ with something on both sides", () => {
  for (const email of ["lena.example.test", "@example.test", "lena@", "a b@c.d"]) {
    assert.equal(parse({ email }).success, false, email);
  }
});

test("message is 1 to 5000 characters", () => {
  assert.equal(parse({ message: "" }).success, false);
  assert.equal(parse({ message: "a" }).success, true);
  assert.equal(parse({ message: "a".repeat(5000) }).success, true);
  assert.equal(parse({ message: "a".repeat(5001) }).success, false);
});

test("a message of only whitespace is invalid", () => {
  assert.equal(parse({ message: " \n\t \n " }).success, false);
});

test("control characters are stripped before the length check, newlines kept", () => {
  assert.equal(parse({ message: "a\u0000b\u0007c\nd\u007F" }).data?.message, "abc\nd");
  assert.equal(parse({ message: "\u0000\u0001" }).success, false);
  assert.equal(parse({ message: `${"a".repeat(5000)}\u0000\u0000` }).success, true);
});

test("only the four answer codes are read from ?contact=", () => {
  for (const code of ["sent", "invalid", "again", "busy"]) {
    assert.equal(parseContactAnswer(code), code);
  }
  for (const value of [null, "", "bogus", "SENT", "sent ", "__proto__"]) {
    assert.equal(parseContactAnswer(value), undefined);
  }
});

test("an address cannot carry mailto parameters or extra recipients", () => {
  for (const email of [
    "a@b.c?bcc=x%40y.z",
    "a@b.c&body=hi",
    "a@b.c,d@e.f",
    "<a@b.c>",
    "a%40b@c.d",
  ]) {
    const result = contactMessageSchema.safeParse({ name: "Ann", email, message: "Hi" });
    assert.equal(result.success, false, email);
  }
});
