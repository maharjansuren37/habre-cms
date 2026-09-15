import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limiter.ts";

const MINUTE = 60_000;

function limiterWithClock(options: { limit: number; windowMs: number; maxKeys: number }) {
  let time = 0;
  const limiter = createRateLimiter({ ...options, now: () => time });
  return { limiter, advance: (ms: number) => (time += ms) };
}

test("a key is blocked once it reaches the limit, not before", () => {
  const { limiter } = limiterWithClock({ limit: 3, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("amara@example.org");
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), false);
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), true);
});

test("other keys are unaffected", () => {
  const { limiter } = limiterWithClock({ limit: 1, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("jonas@example.org"), false);
});

test("a blocked key is unblocked when the window from its first failure ends", () => {
  const { limiter, advance } = limiterWithClock({ limit: 2, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("203.0.113.7");
  advance(10 * MINUTE);
  limiter.recordFailure("203.0.113.7");
  assert.equal(limiter.isBlocked("203.0.113.7"), true);
  advance(5 * MINUTE - 1);
  assert.equal(limiter.isBlocked("203.0.113.7"), true);
  advance(1);
  assert.equal(limiter.isBlocked("203.0.113.7"), false);
});

test("after the window ends, counting starts again from zero", () => {
  const { limiter, advance } = limiterWithClock({ limit: 2, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("amara@example.org");
  limiter.recordFailure("amara@example.org");
  advance(15 * MINUTE);
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), false);
});

test("reset clears a key's failures", () => {
  const { limiter } = limiterWithClock({ limit: 2, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("amara@example.org");
  limiter.recordFailure("amara@example.org");
  limiter.reset("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), false);
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), false);
});

test("forgive takes back exactly one failure", () => {
  const { limiter } = limiterWithClock({ limit: 2, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("203.0.113.7");
  limiter.recordFailure("203.0.113.7");
  limiter.forgive("203.0.113.7");
  assert.equal(limiter.isBlocked("203.0.113.7"), false);
  limiter.recordFailure("203.0.113.7");
  assert.equal(limiter.isBlocked("203.0.113.7"), true);
});

test("forgiving a key with no failures does nothing", () => {
  const { limiter } = limiterWithClock({ limit: 1, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.forgive("203.0.113.7");
  limiter.recordFailure("203.0.113.7");
  assert.equal(limiter.isBlocked("203.0.113.7"), true);
});

test("at the key cap, the oldest key is forgotten to make room", () => {
  const { limiter } = limiterWithClock({ limit: 1, windowMs: 15 * MINUTE, maxKeys: 2 });
  limiter.recordFailure("first");
  limiter.recordFailure("second");
  limiter.recordFailure("third");
  assert.equal(limiter.isBlocked("first"), false);
  assert.equal(limiter.isBlocked("second"), true);
  assert.equal(limiter.isBlocked("third"), true);
});

test("a key whose window has ended can be blocked again in a new window", () => {
  const { limiter, advance } = limiterWithClock({ limit: 2, windowMs: 15 * MINUTE, maxKeys: 100 });
  limiter.recordFailure("amara@example.org");
  limiter.recordFailure("amara@example.org");
  advance(15 * MINUTE);
  limiter.recordFailure("amara@example.org");
  limiter.recordFailure("amara@example.org");
  assert.equal(limiter.isBlocked("amara@example.org"), true);
});
