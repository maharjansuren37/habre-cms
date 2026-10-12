import assert from "node:assert/strict";
import { test } from "node:test";
import { launchAdds, planName } from "./plan-view.ts";

const MB = 1024 * 1024;

test("the plan is named Free or Launch", () => {
  assert.equal(planName("free"), "Free");
  assert.equal(planName("paid"), "Launch");
});

test("Launch adds more storage, a larger AI allowance and no footer link", () => {
  const lines = launchAdds(
    { storageBytes: 500 * MB, aiCredits: 1000 },
    { storageBytes: 10240 * MB, aiCredits: 6000 },
  );
  assert.deepEqual(lines, [
    "10 GB of storage instead of 500 MB",
    "A larger monthly AI allowance",
    'No "Made with Habre" link in your site\'s footer',
  ]);
});

test("equal limits add only the footer link", () => {
  const same = { storageBytes: 500 * MB, aiCredits: 1000 };
  assert.deepEqual(launchAdds(same, same), ['No "Made with Habre" link in your site\'s footer']);
});

test("an unlimited Launch limit is named as no limit", () => {
  const lines = launchAdds(
    { storageBytes: 500 * MB, aiCredits: 1000 },
    { storageBytes: null, aiCredits: null },
  );
  assert.equal(lines[0], "No storage limit");
  assert.equal(lines[1], "No monthly AI limit");
});
