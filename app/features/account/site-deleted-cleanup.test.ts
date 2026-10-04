import assert from "node:assert/strict";
import { test } from "node:test";
import { notifyMembers, removeStorageObjects } from "./site-deleted-cleanup.ts";

test("every key is removed", async () => {
  const removed: string[] = [];
  await removeStorageObjects(
    ["sites/1/a.jpg", "sites/1/b.jpg"],
    async (key) => {
      removed.push(key);
    },
    () => {},
  );
  assert.deepEqual(removed, ["sites/1/a.jpg", "sites/1/b.jpg"]);
});

test("a failed removal is logged with its key, never thrown, and the rest still go", async () => {
  const removed: string[] = [];
  const logged: string[] = [];
  await removeStorageObjects(
    ["sites/1/a.jpg", "sites/1/b.jpg"],
    async (key) => {
      if (key === "sites/1/a.jpg") throw new Error("boom");
      removed.push(key);
    },
    (line) => logged.push(line),
  );
  assert.deepEqual(removed, ["sites/1/b.jpg"]);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /sites\/1\/a\.jpg/);
});

test("each member gets a notice, and a failed send is reported without stopping the rest", async () => {
  const sent: string[] = [];
  let failures = 0;
  await notifyMembers(
    [
      { name: "A", email: "a@example.test" },
      { name: "B", email: "b@example.test" },
    ],
    "lena-bakes",
    async (message) => {
      if (message.to === "a@example.test") throw new Error("smtp down");
      sent.push(message.to);
    },
    () => {
      failures += 1;
    },
  );
  assert.deepEqual(sent, ["b@example.test"]);
  assert.equal(failures, 1);
});
