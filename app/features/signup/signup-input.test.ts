import assert from "node:assert/strict";
import { test } from "node:test";
import { isSignupBodyAllowed, signupSchema } from "./signup-input.ts";

const valid = {
  name: "Lena Novak",
  email: "Lena@Example.org",
  password: "correct horse battery",
  address: " Lena-Novak ",
  invite: "7K2Q-M9XD-HC4V",
};

test("a complete form parses, with email and address normalised", () => {
  const result = signupSchema("invite").parse(valid);
  assert.equal(result.email, "lena@example.org");
  assert.equal(result.address, "lena-novak");
  assert.equal(result.invite, "7K2Q-M9XD-HC4V");
});

test("the invite code is required in invite mode", () => {
  for (const invite of ["", "   ", undefined]) {
    const result = signupSchema("invite").safeParse({ ...valid, invite });
    assert.equal(result.success, false, String(invite));
    assert.deepEqual(result.error?.issues[0]?.path, ["invite"]);
    assert.equal(result.error?.issues[0]?.message, "Enter your invite code.");
  }
});

test("the invite code is ignored in open mode", () => {
  const { invite: _, ...rest } = valid;
  const result = signupSchema("open").parse({ ...rest, invite: "whatever" });
  assert.equal("invite" in result, false);
  assert.equal(signupSchema("open").safeParse(rest).success, true);
});

test("each field's error carries its own path and message", () => {
  const result = signupSchema("open").safeParse({
    ...valid,
    name: "",
    email: "nope",
    password: "short",
    address: "ab",
  });
  assert.equal(result.success, false);
  const paths = result.error?.issues.map((i) => i.path[0]);
  assert.deepEqual(paths, ["name", "email", "password", "address"]);
});

test("a body declared over 8 KB is refused", () => {
  assert.equal(isSignupBodyAllowed(new Headers({ "Content-Length": String(8 * 1024) })), true);
  assert.equal(isSignupBodyAllowed(new Headers({ "Content-Length": String(8 * 1024 + 1) })), false);
});

test("a body with no declared length is refused", () => {
  assert.equal(isSignupBodyAllowed(new Headers()), false);
});
