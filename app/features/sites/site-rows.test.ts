import assert from "node:assert/strict";
import { test } from "node:test";
import { toMemberSite, toPublicSite } from "./site-rows.ts";

test("a public site carries its plan, free and paid", () => {
  const row = { id: "s1", subdomain: "lena", ownDomain: null };
  assert.deepEqual(toPublicSite({ ...row, plan: "free" }), { ...row, plan: "free" });
  assert.deepEqual(toPublicSite({ ...row, plan: "paid" }), { ...row, plan: "paid" });
});

test("a member's site carries its plan, free and paid", () => {
  const row = { subdomain: "lena", suspended: false };
  assert.deepEqual(toMemberSite({ ...row, plan: "free" }), { ...row, plan: "free" });
  assert.deepEqual(toMemberSite({ ...row, plan: "paid" }), { ...row, plan: "paid" });
});
