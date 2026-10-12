import assert from "node:assert/strict";
import { test } from "node:test";
import { storageRefusalMessage } from "#app/features/media/upload-refusals.ts";
import { refusalMessage } from "#app/features/onboarding/start-refusals.ts";
import { allowanceUpgradeSentence, storageUpgradeSentence, upgradeHint } from "./upgrade-hint.ts";

test("with billing off the hint is coming soon, whatever the plan", () => {
  assert.equal(upgradeHint("free", false), "coming-soon");
  assert.equal(upgradeHint("paid", false), "coming-soon");
});

test("with billing on a Free site is pointed at the Plan page and a Launch site at nothing", () => {
  assert.equal(upgradeHint("free", true), "plan-page");
  assert.equal(upgradeHint("paid", true), "none");
});

test("the storage sentence follows the hint", () => {
  assert.equal(
    storageUpgradeSentence("coming-soon"),
    " Paid plans with more storage are coming soon.",
  );
  assert.equal(
    storageUpgradeSentence("plan-page"),
    " An admin can upgrade on the Plan page for more storage.",
  );
  assert.equal(storageUpgradeSentence("none"), "");
});

test("the allowance sentence follows the hint", () => {
  assert.equal(allowanceUpgradeSentence("coming-soon"), " Paid plans are coming soon.");
  assert.equal(
    allowanceUpgradeSentence("plan-page"),
    " An admin can upgrade on the Plan page for a larger allowance.",
  );
  assert.equal(allowanceUpgradeSentence("none"), "");
});

test("the storage refusal says the limit, what to do, and the hint", () => {
  assert.equal(
    storageRefusalMessage("500 MB", "plan-page"),
    "This image would take your site past its 500 MB of storage. Delete images you no longer use, then try again. An admin can upgrade on the Plan page for more storage.",
  );
  assert.equal(
    storageRefusalMessage("1000 MB", "none"),
    "This image would take your site past its 1000 MB of storage. Delete images you no longer use, then try again.",
  );
});

test("the allowance refusal ends with the hint, and the other refusals are unchanged", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  assert.equal(
    refusalMessage("allowance", now, "plan-page"),
    "Your site has used this month's AI allowance. It renews on 1 November. You can start blank instead. An admin can upgrade on the Plan page for a larger allowance.",
  );
  assert.equal(
    refusalMessage("allowance", now, "none"),
    "Your site has used this month's AI allowance. It renews on 1 November. You can start blank instead.",
  );
  assert.equal(
    refusalMessage("busy", now, "plan-page"),
    "Habre is busy building other sites. Try again in a minute.",
  );
});
