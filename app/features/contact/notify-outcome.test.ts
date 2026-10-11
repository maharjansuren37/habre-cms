import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverToAll } from "./notify-outcome.ts";

const mail = (to: string) => ({ to, subject: "s", text: "t", replyTo: "v@example.org" });

test("one rejected recipient does not stop the rest, and any success counts", async () => {
  const sent: string[] = [];
  const result = await deliverToAll(["a@x.test", "b@x.test", "c@x.test"], mail, async (m) => {
    if (m.to === "b@x.test") throw new Error("rejected");
    sent.push(m.to);
  });

  assert.deepEqual(sent, ["a@x.test", "c@x.test"]);
  assert.deepEqual(result, { accepted: 2, failed: 1 });
});

test("a sender that always throws gives no throw and no accepted send", async () => {
  const result = await deliverToAll(["a@x.test", "b@x.test"], mail, async () => {
    throw new Error("connection refused");
  });

  assert.deepEqual(result, { accepted: 0, failed: 2 });
});

test("no recipients is nothing accepted and nothing failed", async () => {
  const result = await deliverToAll([], mail, async () => {
    throw new Error("never called");
  });

  assert.deepEqual(result, { accepted: 0, failed: 0 });
});
