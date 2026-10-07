import assert from "node:assert/strict";
import { test } from "node:test";
import { homeState } from "./home-state.ts";

const base = { published: false, applied: false, offered: false, latestFinished: null } as const;

test("a used draft with nothing published is ready", () => {
  assert.equal(homeState({ ...base, applied: true, latestFinished: "applied" }), "ready");
});

test("a used draft is not ready once something is published", () => {
  assert.equal(homeState({ ...base, applied: true, published: true }), "none");
});

test("an offer with an unused succeeded run is review", () => {
  assert.equal(homeState({ ...base, offered: true, latestFinished: "succeeded" }), "review");
});

test("an offer with no finished run is start", () => {
  assert.equal(homeState({ ...base, offered: true }), "start");
});

test("review wins over start only when the latest finished run succeeded", () => {
  assert.equal(homeState({ ...base, offered: true, latestFinished: "applied" }), "start");
});

test("nothing offered and nothing applied is none", () => {
  assert.equal(homeState(base), "none");
  assert.equal(homeState({ ...base, latestFinished: "succeeded" }), "none");
});
