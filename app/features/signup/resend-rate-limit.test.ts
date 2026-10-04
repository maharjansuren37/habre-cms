import assert from "node:assert/strict";
import { test } from "node:test";
import { createResendLimits } from "./resend-rate-limit.server.ts";

test("the fourth request for one email in an hour is refused, from any address", () => {
  const limits = createResendLimits();
  for (let n = 1; n <= 3; n++) assert.equal(limits.attempt(`10.0.0.${n}`, "a@example.test"), null);
  assert.equal(limits.attempt("10.0.0.9", "a@example.test"), "email");
  assert.equal(limits.attempt("10.0.0.9", "b@example.test"), null);
});

test("the sixth request from one address in an hour is refused, for any email", () => {
  const limits = createResendLimits();
  for (let n = 1; n <= 5; n++) assert.equal(limits.attempt("10.0.0.1", `u${n}@example.test`), null);
  assert.equal(limits.attempt("10.0.0.1", "fresh@example.test"), "ip");
});

test("the limits open again after an hour", () => {
  let now = 0;
  const limits = createResendLimits({ now: () => now });
  for (let n = 0; n < 3; n++) limits.attempt("10.0.0.1", "a@example.test");
  assert.equal(limits.attempt("10.0.0.1", "a@example.test"), "email");
  now = 60 * 60 * 1000;
  assert.equal(limits.attempt("10.0.0.1", "a@example.test"), null);
});
