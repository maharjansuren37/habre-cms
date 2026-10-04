import assert from "node:assert/strict";
import { test } from "node:test";
import { generateInviteCode, hashInviteCode, normaliseInviteCode } from "./invite-code.ts";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const FORMAT = new RegExp(`^[${ALPHABET}]{4}-[${ALPHABET}]{4}-[${ALPHABET}]{4}$`);

test("a generated code is three groups of four from the alphabet", () => {
  for (let i = 0; i < 100; i++) assert.match(generateInviteCode(), FORMAT);
});

test("a generated code never contains 0, O, 1, I or L", () => {
  for (let i = 0; i < 200; i++) assert.doesNotMatch(generateInviteCode(), /[01OIL]/);
});

test("1,000 generated codes are all distinct", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 1000; i++) codes.add(generateInviteCode());
  assert.equal(codes.size, 1000);
});

test("normalising trims, uppercases and drops spaces and dashes", () => {
  assert.equal(normaliseInviteCode("7k2q m9xd-hc4v "), "7K2QM9XDHC4V");
});

test("a typed code hashes the same as the shown code", () => {
  assert.equal(hashInviteCode("7k2q m9xd-hc4v "), hashInviteCode("7K2Q-M9XD-HC4V"));
});

test("the hash is 64 lowercase hex characters", () => {
  assert.match(hashInviteCode("7K2Q-M9XD-HC4V"), /^[0-9a-f]{64}$/);
});

test("different codes hash differently", () => {
  assert.notEqual(hashInviteCode("7K2Q-M9XD-HC4V"), hashInviteCode("7K2Q-M9XD-HC4W"));
});
