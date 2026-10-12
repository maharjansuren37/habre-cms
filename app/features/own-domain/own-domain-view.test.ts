import assert from "node:assert/strict";
import { test } from "node:test";
import { outcomeMessage, ownDomainState, refusalMessage } from "./own-domain-view.ts";

const waiting = { verifiedAt: null };
const verified = { verifiedAt: new Date() };

test("a Free site with billing on and no domain is offered Launch", () => {
  assert.equal(ownDomainState({ plan: "free", billingOn: true, row: null }), "free-billing");
});

test("a Free site with billing off and no domain is told paid plans are coming", () => {
  assert.equal(ownDomainState({ plan: "free", billingOn: false, row: null }), "free-no-billing");
});

test("a Launch site with no domain gets the form, billing on or off", () => {
  assert.equal(ownDomainState({ plan: "paid", billingOn: true, row: null }), "none");
  assert.equal(ownDomainState({ plan: "paid", billingOn: false, row: null }), "none");
});

test("an unverified domain is waiting, on any plan", () => {
  for (const plan of ["free", "paid"] as const) {
    assert.equal(ownDomainState({ plan, billingOn: true, row: waiting }), "waiting");
  }
});

test("a verified domain stays verified on a Free site", () => {
  for (const plan of ["free", "paid"] as const) {
    for (const billingOn of [true, false]) {
      assert.equal(ownDomainState({ plan, billingOn, row: verified }), "verified");
    }
  }
});

test("every refusal and outcome has its own sentence", () => {
  const refusals = [
    "empty",
    "invalid",
    "ip",
    "reserved",
    "free",
    "has_domain",
    "taken",
    "rate_limited",
  ] as const;
  const outcomes = ["verified", "no-txt", "wrong-txt", "not-pointing", "lookup-failed"] as const;
  const all = [...refusals.map(refusalMessage), ...outcomes.map(outcomeMessage)];
  for (const text of all) assert.ok(text.length > 10);
  assert.equal(new Set(all).size, all.length);
});

test("the copy is the agreed wording", () => {
  assert.equal(refusalMessage("empty"), "Type your domain, like example.org.");
  assert.equal(refusalMessage("free"), "Your own domain is part of Launch.");
  assert.match(refusalMessage("rate_limited"), /ten checks in the last hour/);
  assert.match(outcomeMessage("no-txt"), /cannot see the verification record yet/);
  assert.match(outcomeMessage("not-pointing"), /grey cloud/);
});
