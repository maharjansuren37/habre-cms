import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { test } from "node:test";
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from "./password.server.ts";

test("a hashed password verifies", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
});

test("a wrong password does not verify", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery stable", stored), false);
});

test("hashes record the current scrypt parameters", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.match(stored, /^scrypt\$32768\$8\$3\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/);
});

test("hashing the same password twice gives different hashes", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
});

test("a hash made with other parameters verifies using the parameters it records", async () => {
  const salt = Buffer.from("0123456789abcdef");
  const key = scryptSync("older password here", salt, 32, { N: 1024, r: 4, p: 1 });
  const stored = `scrypt$1024$4$1$${salt.toString("base64")}$${key.toString("base64")}`;
  assert.equal(await verifyPassword("older password here", stored), true);
  assert.equal(await verifyPassword("older password hers", stored), false);
});

test("the same password in composed and decomposed Unicode verifies", async () => {
  const stored = await hashPassword("café au lait please");
  assert.equal(await verifyPassword("café au lait please", stored), true);
});

test("malformed stored values never verify and never throw", async () => {
  const good = await hashPassword("correct horse battery staple");
  const [, , , , salt, key] = good.split("$");
  const malformed = [
    "",
    "not a hash",
    `bcrypt$32768$8$3$${salt}$${key}`,
    `scrypt$32768$8$3$${salt}`,
    `scrypt$32768$8$3$${salt}$${key}$extra`,
    `scrypt$abc$8$3$${salt}$${key}`,
    `scrypt$30000$8$3$${salt}$${key}`,
    `scrypt$1073741824$8$3$${salt}$${key}`,
    `scrypt$32768$0$3$${salt}$${key}`,
    `scrypt$32768$8$99$${salt}$${key}`,
    `scrypt$32768$8$3$$${key}`,
    `scrypt$32768$8$3$${salt}$not*base64`,
    `scrypt$32768$8$3$${salt}$${key.slice(0, 8)}`,
  ];
  for (const stored of malformed) {
    assert.equal(await verifyPassword("correct horse battery staple", stored), false, stored);
  }
});

test("checking against the dummy hash takes about as long as checking a real hash", async () => {
  const stored = await hashPassword("correct horse battery staple");
  const realStart = performance.now();
  await verifyPassword("wrong password entirely", stored);
  const realDuration = performance.now() - realStart;

  const dummyStart = performance.now();
  await verifyAgainstDummyHash("wrong password entirely");
  const dummyDuration = performance.now() - dummyStart;

  // A generous bound: a skipped scrypt run is ~0 ms against a real one's ~100+ ms.
  assert.ok(
    dummyDuration > realDuration * 0.5,
    `dummy ${dummyDuration.toFixed(0)} ms vs real ${realDuration.toFixed(0)} ms`,
  );
});
