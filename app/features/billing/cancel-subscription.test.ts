import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelForDeletion } from "./cancel-subscription.ts";

function fakeClient(error?: unknown) {
  const cancelled: string[] = [];
  return {
    cancelled,
    client: {
      subscriptions: {
        async cancel(id: string) {
          cancelled.push(id);
          if (error !== undefined) throw error;
          return {};
        },
      },
    },
  };
}

test("a subscription is cancelled once, by id", async () => {
  const { client, cancelled } = fakeClient();
  assert.equal(await cancelForDeletion("sub_1", client), "cancelled");
  assert.deepEqual(cancelled, ["sub_1"]);
});

test("a site with no subscription never calls Stripe", async () => {
  const { client, cancelled } = fakeClient();
  assert.equal(await cancelForDeletion(null, client), "none");
  assert.deepEqual(cancelled, []);
});

test("with billing off (no client) nothing is called and deletion may go on", async () => {
  assert.equal(await cancelForDeletion("sub_1", null), "none");
});

test("a subscription Stripe no longer has counts as already cancelled", async () => {
  const { client } = fakeClient(Object.assign(new Error("gone"), { code: "resource_missing" }));
  assert.equal(await cancelForDeletion("sub_1", client), "already");
});

test("any other failure is unavailable, so deletion stops", async () => {
  for (const error of [
    Object.assign(new Error("down"), { type: "StripeConnectionError" }),
    Object.assign(new Error("key"), { type: "StripeAuthenticationError" }),
    new Error("boom"),
  ]) {
    const { client } = fakeClient(error);
    assert.equal(await cancelForDeletion("sub_1", client), "unavailable");
  }
});
