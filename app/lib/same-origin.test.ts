import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequest } from "./same-origin.ts";

const APP_ORIGIN = "https://cms.example.org";

function allowed(method: string, headers: Record<string, string> = {}) {
  return isAllowedRequest(method, new Headers(headers), APP_ORIGIN);
}

test("reading requests are allowed from anywhere", () => {
  for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
    assert.equal(allowed(method, { Origin: "https://evil.example" }), true, method);
  }
});

test("a state-changing request from the app's own origin is allowed", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
    assert.equal(allowed(method, { Origin: APP_ORIGIN }), true, method);
  }
});

test("a state-changing request from any other origin is refused", () => {
  const otherOrigins = [
    "https://evil.example",
    "http://cms.example.org",
    "https://cms.example.org:8443",
    "https://sub.cms.example.org",
    "null",
  ];
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    for (const origin of otherOrigins) {
      assert.equal(allowed(method, { Origin: origin }), false, `${method} from ${origin}`);
    }
  }
});

test("a mismatched Origin is refused even when Sec-Fetch-Site claims same-origin", () => {
  assert.equal(
    allowed("POST", { Origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" }),
    false,
  );
});

test("without Origin, only Sec-Fetch-Site same-origin is allowed", () => {
  assert.equal(allowed("POST", { "Sec-Fetch-Site": "same-origin" }), true);
  for (const site of ["same-site", "cross-site", "none"]) {
    assert.equal(allowed("POST", { "Sec-Fetch-Site": site }), false, site);
  }
});

test("a state-changing request with neither header is refused", () => {
  assert.equal(allowed("POST"), false);
});
