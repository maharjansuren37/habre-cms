import assert from "node:assert/strict";
import { test } from "node:test";
import { refusalMessage, renewalDate } from "./start-refusals.ts";

test("a refusal at 31 October 23:59 UTC says the allowance renews on 1 November", () => {
  const now = new Date("2026-10-31T23:59:00Z");
  assert.equal(renewalDate(now), "1 November");
  assert.equal(
    refusalMessage("allowance", now),
    "Your site has used this month's AI allowance. It renews on 1 November. You can start blank instead.",
  );
});

test("on 31 December the allowance renews on 1 January", () => {
  assert.equal(renewalDate(new Date("2026-12-31T12:00:00Z")), "1 January");
});

test("on 1 October the allowance renews on 1 November", () => {
  assert.equal(renewalDate(new Date("2026-10-01T00:00:00Z")), "1 November");
});

test("the busy refusal asks to try again in a minute", () => {
  assert.equal(
    refusalMessage("busy", new Date()),
    "Habre is busy building other sites. Try again in a minute.",
  );
});

test("the site_busy refusal says a draft is already being built", () => {
  assert.equal(
    refusalMessage("site_busy", new Date()),
    "A draft for your site is already being built. Wait for it to finish, then try again.",
  );
});

test("the daily refusal says ten drafts were started today", () => {
  assert.equal(
    refusalMessage("daily", new Date()),
    "You've started 10 drafts today. Try again tomorrow, or start blank.",
  );
});
