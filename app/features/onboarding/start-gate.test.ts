import assert from "node:assert/strict";
import { test } from "node:test";
import { startGate } from "./start-gate.ts";

const clear = { aiOn: true, suspended: false, published: false };

test("the gate offers onboarding when AI is on, the site is live and nothing is published", () => {
  assert.deepEqual(startGate(clear), { kind: "offer" });
});

test("the gate sends to the admin when AI is off", () => {
  assert.deepEqual(startGate({ ...clear, aiOn: false }), { kind: "redirect", to: "/admin" });
});

test("the gate sends to the admin when the site is suspended", () => {
  assert.deepEqual(startGate({ ...clear, suspended: true }), { kind: "redirect", to: "/admin" });
});

test("the gate sends to the admin when anything is published", () => {
  assert.deepEqual(startGate({ ...clear, published: true }), { kind: "redirect", to: "/admin" });
});
