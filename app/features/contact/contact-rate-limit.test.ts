import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactLimits } from "./contact-rate-limit.server.ts";

test("the sixth attempt from one address to one site is blocked", () => {
  const limits = createContactLimits();
  for (let n = 0; n < 5; n++) assert.equal(limits.attempt("site-a", "10.0.0.1"), null);
  assert.equal(limits.attempt("site-a", "10.0.0.1"), "ip");
});

test("another address, or another site, is unaffected", () => {
  const limits = createContactLimits();
  for (let n = 0; n < 6; n++) limits.attempt("site-a", "10.0.0.1");
  assert.equal(limits.attempt("site-a", "10.0.0.2"), null);
  assert.equal(limits.attempt("site-b", "10.0.0.1"), null);
});

test("the 101st attempt on a site in an hour is blocked, from any address", () => {
  const limits = createContactLimits();
  for (let n = 0; n < 100; n++) assert.equal(limits.attempt("site-a", `10.0.${n}.1`), null);
  assert.equal(limits.attempt("site-a", "10.9.9.9"), "site");
  assert.equal(limits.attempt("site-b", "10.9.9.9"), null);
});

test("the limits open again after an hour", () => {
  let now = 0;
  const limits = createContactLimits({ now: () => now });
  for (let n = 0; n < 6; n++) limits.attempt("site-a", "10.0.0.1");
  assert.equal(limits.attempt("site-a", "10.0.0.1"), "ip");
  now = 60 * 60 * 1000;
  assert.equal(limits.attempt("site-a", "10.0.0.1"), null);
});
