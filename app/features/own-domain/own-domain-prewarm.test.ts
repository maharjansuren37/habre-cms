import assert from "node:assert/strict";
import { test } from "node:test";
import { prewarmRequest, prewarmWith } from "./own-domain-prewarm.ts";

test("the pre-warm is one HEAD to the domain's https root that does not follow redirects", () => {
  const request = prewarmRequest("example.org");
  assert.equal(request.url, "https://example.org/");
  assert.equal(request.init.method, "HEAD");
  assert.equal(request.init.redirect, "manual");
});

test("the pre-warm makes one request and never throws when it fails", async () => {
  const urls: string[] = [];
  const logs: Record<string, unknown>[] = [];
  await prewarmWith("example.org", {
    fetch: async (url) => {
      urls.push(String(url));
      throw new Error("tls handshake failed");
    },
    log: (line) => logs.push(line),
  });
  assert.deepEqual(urls, ["https://example.org/"]);
  assert.equal(logs[0]?.event, "own_domain_prewarm_failed");
});

test("the pre-warm passes an abort signal so it cannot hang", async () => {
  let signal: AbortSignal | null | undefined;
  await prewarmWith("example.org", {
    fetch: async (_url, init) => {
      signal = init?.signal;
      return new Response(null, { status: 200 });
    },
    log: () => {},
  });
  assert.ok(signal instanceof AbortSignal);
});
