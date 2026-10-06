import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyHost, resolveHostRouting } from "./host-routing.ts";

const HOSTS = {
  publicHost: "surenmaharjan.fyi",
  adminHost: "cms.surenmaharjan.fyi",
  publicOrigin: "https://surenmaharjan.fyi",
  adminOrigin: "https://cms.surenmaharjan.fyi",
};

function decide(overrides: {
  method?: string;
  pathname: string;
  search?: string;
  requestHost: string;
  publicHost?: string;
  adminHost?: string;
}) {
  return resolveHostRouting({
    method: "GET",
    search: "",
    ...HOSTS,
    ...overrides,
  });
}

test("allows everything when the two hosts are equal (development, single-host test server)", () => {
  assert.deepEqual(
    decide({
      pathname: "/admin/posts",
      requestHost: "127.0.0.1:3000",
      publicHost: "127.0.0.1:3000",
      adminHost: "127.0.0.1:3000",
    }),
    { kind: "allow" },
  );
});

test("answers /healthz on the admin host without redirecting", () => {
  assert.deepEqual(decide({ pathname: "/healthz", requestHost: HOSTS.adminHost }), {
    kind: "allow",
  });
});

test("answers /healthz on the public host without redirecting", () => {
  assert.deepEqual(decide({ pathname: "/healthz", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});

test("redirects the admin host's bare / to /admin", () => {
  assert.deepEqual(decide({ pathname: "/", requestHost: HOSTS.adminHost }), {
    kind: "redirect",
    to: "/admin",
  });
});

test("refuses a POST to / on the admin host rather than redirecting it", () => {
  assert.deepEqual(decide({ method: "POST", pathname: "/", requestHost: HOSTS.adminHost }), {
    kind: "not-found",
  });
});

test("allows an admin path on the admin host", () => {
  assert.deepEqual(decide({ pathname: "/admin/posts", requestHost: HOSTS.adminHost }), {
    kind: "allow",
  });
});

test("does not treat a path that merely starts with 'admin' as an admin path", () => {
  assert.deepEqual(decide({ pathname: "/adminfoo", requestHost: HOSTS.adminHost }), {
    kind: "redirect",
    to: "https://surenmaharjan.fyi/adminfoo",
  });
});

test("redirects a public path on the admin host to the public host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/posts/hello", search: "?ref=x", requestHost: HOSTS.adminHost }),
    { kind: "redirect", to: "https://surenmaharjan.fyi/posts/hello?ref=x" },
  );
});

test("refuses a non-GET/HEAD public path on the admin host rather than redirecting it", () => {
  assert.deepEqual(
    decide({ method: "POST", pathname: "/posts/hello", requestHost: HOSTS.adminHost }),
    { kind: "not-found" },
  );
});

test("redirects an admin path on the public host to the admin host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/admin/posts", search: "?page=2", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/admin/posts?page=2" },
  );
});

test("refuses a non-GET/HEAD admin path on the public host rather than redirecting it", () => {
  assert.deepEqual(
    decide({ method: "POST", pathname: "/admin/posts", requestHost: HOSTS.publicHost }),
    { kind: "not-found" },
  );
});

test("allows a public path on the public host", () => {
  assert.deepEqual(decide({ pathname: "/posts/hello", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});

test("refuses a request whose host matches neither", () => {
  assert.deepEqual(decide({ pathname: "/", requestHost: "evil.example" }), {
    kind: "not-found",
  });
});

test("allows /signup, the pages under it and /verify on the admin host", () => {
  for (const pathname of ["/signup", "/signup/sent", "/verify"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), { kind: "allow" });
  }
});

test("redirects /signup and /verify on the public host to the admin host, query string included", () => {
  assert.deepEqual(
    decide({ pathname: "/verify", search: "?token=abc", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/verify?token=abc" },
  );
  assert.deepEqual(
    decide({ method: "HEAD", pathname: "/signup/sent", requestHost: HOSTS.publicHost }),
    { kind: "redirect", to: "https://cms.surenmaharjan.fyi/signup/sent" },
  );
});

test("refuses a POST to /signup or /verify on the public host rather than redirecting it", () => {
  for (const pathname of ["/signup", "/verify"]) {
    assert.deepEqual(decide({ method: "POST", pathname, requestHost: HOSTS.publicHost }), {
      kind: "not-found",
    });
  }
});

test("treats /signupx and /verify/x as public paths", () => {
  for (const pathname of ["/signupx", "/verify/x"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.publicHost }), { kind: "allow" });
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), {
      kind: "redirect",
      to: `https://surenmaharjan.fyi${pathname}`,
    });
  }
});

test("treats /forgot-password and /reset-password like admin paths on both hosts", () => {
  for (const pathname of ["/forgot-password", "/reset-password"]) {
    assert.deepEqual(decide({ pathname, requestHost: HOSTS.adminHost }), { kind: "allow" });
    assert.deepEqual(decide({ pathname, search: "?token=abc", requestHost: HOSTS.publicHost }), {
      kind: "redirect",
      to: `https://cms.surenmaharjan.fyi${pathname}?token=abc`,
    });
    assert.deepEqual(decide({ method: "POST", pathname, requestHost: HOSTS.publicHost }), {
      kind: "not-found",
    });
  }
});

test("treats /forgot-passwords as a public path", () => {
  assert.deepEqual(decide({ pathname: "/forgot-passwords", requestHost: HOSTS.publicHost }), {
    kind: "allow",
  });
});

const PLATFORM = "https://app.habre.ai";
const SITES = "https://habre.page";

function classify(requestHost: string, pathname: string, method = "GET", search = "") {
  return classifyHost({
    method,
    pathname,
    search,
    requestHost,
    platformOrigin: PLATFORM,
    sitesOrigin: SITES,
  });
}

test("the platform host allows the platform paths", () => {
  for (const path of ["/admin", "/admin/posts", "/signup", "/verify", "/confirm-email"]) {
    assert.deepEqual(classify("app.habre.ai", path), { kind: "allow" }, path);
  }
});

test("/ on the platform host redirects to /admin, and a POST there is not found", () => {
  assert.deepEqual(classify("app.habre.ai", "/"), { kind: "redirect", to: "/admin" });
  assert.deepEqual(classify("app.habre.ai", "/", "HEAD"), { kind: "redirect", to: "/admin" });
  assert.deepEqual(classify("app.habre.ai", "/", "POST"), {
    kind: "not-found",
    foreignHost: false,
  });
});

test("a public path on the platform host is not found, unlogged", () => {
  assert.deepEqual(classify("app.habre.ai", "/posts/x"), { kind: "not-found", foreignHost: false });
});

test("a host under the sites domain is looked up by its label", () => {
  assert.deepEqual(classify("lena.habre.page", "/posts/x"), { kind: "subdomain", label: "lena" });
  assert.deepEqual(classify("lena.habre.page", "/"), { kind: "subdomain", label: "lena" });
});

test("the bare sites host and a two-label name under it are not found, unlogged", () => {
  assert.deepEqual(classify("habre.page", "/"), { kind: "not-found", foreignHost: false });
  assert.deepEqual(classify("a.b.habre.page", "/"), { kind: "not-found", foreignHost: false });
});

test("a label that is not a valid subdomain is not found, unlogged", () => {
  assert.deepEqual(classify("-x.habre.page", "/"), { kind: "not-found", foreignHost: false });
  assert.deepEqual(classify("a_b.habre.page", "/"), { kind: "not-found", foreignHost: false });
});

test("any other host is looked up as an own domain, lowercased", () => {
  assert.deepEqual(classify("surenmaharjan.fyi", "/"), {
    kind: "domain",
    host: "surenmaharjan.fyi",
  });
  assert.deepEqual(classify("SurenMaharjan.FYI", "/posts/x"), {
    kind: "domain",
    host: "surenmaharjan.fyi",
  });
});

test("upper-case hosts match the platform and sites hosts", () => {
  assert.deepEqual(classify("APP.Habre.AI", "/admin"), { kind: "allow" });
  assert.deepEqual(classify("Lena.HABRE.page", "/"), { kind: "subdomain", label: "lena" });
});

test("a platform path on a site host redirects to the platform for GET and HEAD, keeping the query", () => {
  assert.deepEqual(classify("lena.habre.page", "/admin/posts", "GET", "?status=draft"), {
    kind: "redirect",
    to: "https://app.habre.ai/admin/posts?status=draft",
  });
  assert.deepEqual(classify("surenmaharjan.fyi", "/signup", "HEAD"), {
    kind: "redirect",
    to: "https://app.habre.ai/signup",
  });
});

test("a POST to a platform path on a site host is not found, logged only for a foreign host", () => {
  assert.deepEqual(classify("lena.habre.page", "/admin/posts", "POST"), {
    kind: "not-found",
    foreignHost: false,
  });
  assert.deepEqual(classify("surenmaharjan.fyi", "/admin/posts", "POST"), {
    kind: "not-found",
    foreignHost: true,
  });
});

test("/healthz answers on the platform host, a site host and an unknown host", () => {
  for (const host of ["app.habre.ai", "lena.habre.page", "habre.page", "unknown.example"]) {
    assert.deepEqual(classify(host, "/healthz"), { kind: "allow" }, host);
  }
});

test("the sites host's port is part of the match", () => {
  const local = (requestHost: string) =>
    classifyHost({
      method: "GET",
      pathname: "/",
      search: "",
      requestHost,
      platformOrigin: "http://127.0.0.1:3100",
      sitesOrigin: "http://localhost:3100",
    });
  assert.deepEqual(local("surenmaharjan.localhost:3100"), {
    kind: "subdomain",
    label: "surenmaharjan",
  });
  assert.deepEqual(local("127.0.0.1:3100"), { kind: "redirect", to: "/admin" });
  // Another port is not under the sites domain: looked up whole, and misses.
  assert.deepEqual(local("surenmaharjan.localhost:3200"), {
    kind: "domain",
    host: "surenmaharjan.localhost:3200",
  });
});

test("the platform host is never read as a site, even when it sits under the sites domain", () => {
  const nested = classifyHost({
    method: "GET",
    pathname: "/admin",
    search: "",
    requestHost: "app.localhost:3000",
    platformOrigin: "http://app.localhost:3000",
    sitesOrigin: "http://localhost:3000",
  });
  assert.deepEqual(nested, { kind: "allow" });
});
