import assert from "node:assert/strict";
import { test } from "node:test";
import { emailSchema, nameSchema, newPasswordSchema, newUserSchema } from "./user-input.ts";

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

test("an email is trimmed and lowercased", () => {
  assert.equal(emailSchema.parse("  Amara.Okafor@Example.ORG "), "amara.okafor@example.org");
});

test("something that is not an email address is rejected", () => {
  const result = emailSchema.safeParse("amara at example");
  assert.equal(result.success, false);
  assert.match(firstMessage(result) ?? "", /Enter an email address/);
});

test("a name is trimmed", () => {
  assert.equal(nameSchema.parse("  Amara Okafor  "), "Amara Okafor");
});

test("an empty or whitespace-only name is rejected", () => {
  for (const name of ["", "   "]) {
    const result = nameSchema.safeParse(name);
    assert.equal(result.success, false, JSON.stringify(name));
    assert.equal(firstMessage(result), "Enter a name.");
  }
});

test("a name over 100 characters is rejected", () => {
  assert.equal(nameSchema.safeParse("a".repeat(100)).success, true);
  assert.equal(nameSchema.safeParse("a".repeat(101)).success, false);
});

test("an 11-character password is rejected with a message naming the minimum", () => {
  const result = newPasswordSchema.safeParse("elevenchars");
  assert.equal(result.success, false);
  assert.equal(firstMessage(result), "Use at least 12 characters for the password.");
});

test("a 12-character password is accepted as typed, spaces included", () => {
  assert.equal(newPasswordSchema.parse(" twelve char"), " twelve char");
});

test("a password over 200 characters is rejected", () => {
  assert.equal(newPasswordSchema.safeParse("p".repeat(200)).success, true);
  assert.equal(newPasswordSchema.safeParse("p".repeat(201)).success, false);
});

test("a new user is normalised as a whole", () => {
  assert.deepEqual(
    newUserSchema.parse({
      email: " You@Example.org",
      name: " You ",
      password: "correct horse battery",
    }),
    { email: "you@example.org", name: "You", password: "correct horse battery" },
  );
});
