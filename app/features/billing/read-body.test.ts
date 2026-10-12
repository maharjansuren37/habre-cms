import assert from "node:assert/strict";
import { test } from "node:test";
import { readTextUpTo } from "./read-body.ts";

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

test("a body within the cap is returned whole, across chunks", async () => {
  assert.equal(await readTextUpTo(streamOf('{"a":', "1}"), 10), '{"a":1}');
});

test("a body exactly at the cap is returned", async () => {
  assert.equal(await readTextUpTo(streamOf("12345"), 5), "12345");
});

test("a body over the cap is null, even when it arrives in small chunks", async () => {
  assert.equal(await readTextUpTo(streamOf("123", "456"), 5), null);
});

test("no body is the empty string", async () => {
  assert.equal(await readTextUpTo(null, 5), "");
});

test("multi-byte characters are counted as bytes", async () => {
  assert.equal(await readTextUpTo(streamOf("ééé"), 5), null);
});
