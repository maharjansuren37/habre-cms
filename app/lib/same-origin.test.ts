import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedPlatformRequest, isAllowedRequest, isAllowedSiteRequest } from "./same-origin.ts";

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

const SITE_ORIGIN = "https://lena.habre.page";

function siteAllowed(method: string, pathname: string, headers: Record<string, string> = {}) {
  return isAllowedSiteRequest(method, pathname, new Headers(headers), SITE_ORIGIN);
}

test("a site accepts a contact post from its own origin", () => {
  assert.equal(siteAllowed("POST", "/_contact", { Origin: SITE_ORIGIN }), true);
});

test("a site accepts a contact post with no Origin only when Sec-Fetch-Site is same-origin", () => {
  assert.equal(siteAllowed("POST", "/_contact", { "Sec-Fetch-Site": "same-origin" }), true);
  assert.equal(siteAllowed("POST", "/_contact", { "Sec-Fetch-Site": "cross-site" }), false);
});

test("a contact post from the platform or another site is refused", () => {
  for (const origin of ["https://app.habre.ai", "https://other.habre.page", "null"]) {
    assert.equal(siteAllowed("POST", "/_contact", { Origin: origin }), false, origin);
  }
});

test("a contact post with no origin evidence is refused", () => {
  assert.equal(siteAllowed("POST", "/_contact"), false);
});

test("no other state-changing request is accepted on a site, even from its own origin", () => {
  const headers = { Origin: SITE_ORIGIN };
  for (const path of ["/admin/posts", "/_contact/x", "/posts", "/", "/_contact/"]) {
    assert.equal(siteAllowed("POST", path, headers), false, path);
  }
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    assert.equal(siteAllowed(method, "/_contact", headers), false, method);
  }
});

test("reading a site is unchanged", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(siteAllowed(method, "/posts/x", { Origin: "https://evil.example" }), true, method);
  }
});

function platformAllowed(method: string, pathname: string, headers: Record<string, string> = {}) {
  return isAllowedPlatformRequest(method, pathname, new Headers(headers), APP_ORIGIN);
}

test("Stripe's webhook is the one platform POST that needs no origin", () => {
  assert.equal(platformAllowed("POST", "/webhooks/stripe"), true);
  assert.equal(
    platformAllowed("post", "/webhooks/stripe", { Origin: "https://evil.example" }),
    true,
  );
});

test("the webhook exemption is that path and that method alone", () => {
  for (const path of ["/webhooks/stripe/x", "/webhooks/stripe/", "/webhooks", "/admin/plan"]) {
    assert.equal(platformAllowed("POST", path), false, path);
  }
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    assert.equal(platformAllowed(method, "/webhooks/stripe"), false, method);
  }
});

test("the platform check is otherwise the origin check", () => {
  assert.equal(platformAllowed("POST", "/admin/plan", { Origin: APP_ORIGIN }), true);
  assert.equal(platformAllowed("POST", "/admin/plan", { Origin: "https://evil.example" }), false);
  assert.equal(platformAllowed("GET", "/admin/plan"), true);
});

test("a site host refuses a post to the webhook path", () => {
  const SITE_ORIGIN = "https://lena.habre.page";
  assert.equal(
    isAllowedSiteRequest(
      "POST",
      "/webhooks/stripe",
      new Headers({ Origin: SITE_ORIGIN }),
      SITE_ORIGIN,
    ),
    false,
  );
});
