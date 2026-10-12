import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyHost } from "./host-routing.ts";

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
    platformHost: true,
  });
});

test("a public path on the platform host is not found, unlogged", () => {
  assert.deepEqual(classify("app.habre.ai", "/posts/x"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
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

test("the platform host allows /legal/terms and /legal/privacy, and /privacy alone is not found (F-428)", () => {
  for (const path of ["/legal/terms", "/legal/privacy"]) {
    assert.deepEqual(classify("app.habre.ai", path), { kind: "allow" }, path);
  }
  assert.deepEqual(classify("app.habre.ai", "/privacy"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
});

test("/legal/terms on a site host redirects to the platform's, and /legal and /privacy stay the site's (F-428)", () => {
  assert.deepEqual(classify("lena.habre.page", "/legal/terms"), {
    kind: "redirect",
    to: "https://app.habre.ai/legal/terms",
  });
  assert.deepEqual(classify("surenmaharjan.fyi", "/legal/privacy"), {
    kind: "redirect",
    to: "https://app.habre.ai/legal/privacy",
  });
  for (const path of ["/legal", "/privacy"]) {
    assert.deepEqual(classify("lena.habre.page", path), { kind: "subdomain", label: "lena" }, path);
    assert.deepEqual(
      classify("surenmaharjan.fyi", path),
      { kind: "domain", host: "surenmaharjan.fyi" },
      path,
    );
  }
});

test("/legal/ is not found on the platform host and stays the site's on a site host (F-437)", () => {
  assert.deepEqual(classify("app.habre.ai", "/legal/"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
  assert.deepEqual(classify("lena.habre.page", "/legal/"), { kind: "subdomain", label: "lena" });
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

test("a trailing dot on the host is ignored, with or without a port", () => {
  assert.deepEqual(classify("lena.habre.page.", "/"), { kind: "subdomain", label: "lena" });
  assert.deepEqual(classify("surenmaharjan.fyi.", "/"), {
    kind: "domain",
    host: "surenmaharjan.fyi",
  });
  assert.deepEqual(
    classifyHost({
      method: "GET",
      pathname: "/",
      search: "",
      requestHost: "lena.localhost.:3100",
      platformOrigin: "http://127.0.0.1:3100",
      sitesOrigin: "http://localhost:3100",
    }),
    { kind: "subdomain", label: "lena" },
  );
});

test("the platform host with a trailing dot redirects to the bare platform, and a POST is not found", () => {
  // A form posted from app.habre.ai. carries that Origin, which the cross-site
  // check refuses (F-278), so the platform is only ever served at its own host.
  assert.deepEqual(classify("app.habre.ai.", "/admin/posts", "GET", "?q=1"), {
    kind: "redirect",
    to: "https://app.habre.ai/admin/posts?q=1",
  });
  assert.deepEqual(classify("app.habre.ai.", "/"), {
    kind: "redirect",
    to: "https://app.habre.ai/",
  });
  assert.deepEqual(classify("app.habre.ai.", "/admin/login", "POST"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
  assert.deepEqual(classify("app.habre.ai.", "/healthz"), { kind: "allow" });
});

test("/robots.txt is allowed on the platform host, and /sitemap.xml is still not found there", () => {
  assert.deepEqual(classify("app.habre.ai", "/robots.txt"), { kind: "allow" });
  assert.deepEqual(classify("app.habre.ai", "/sitemap.xml"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
});

test("/robots.txt on a site host is that site's, by subdomain or by own domain", () => {
  assert.deepEqual(classify("lena.habre.page", "/robots.txt"), {
    kind: "subdomain",
    label: "lena",
  });
  assert.deepEqual(classify("lena.example", "/robots.txt"), {
    kind: "domain",
    host: "lena.example",
  });
});

test("POST /_contact is a site's on a site host and not found on the platform host", () => {
  assert.deepEqual(classify("lena.habre.page", "/_contact", "POST"), {
    kind: "subdomain",
    label: "lena",
  });
  assert.deepEqual(classify("app.habre.ai", "/_contact", "POST"), {
    kind: "not-found",
    foreignHost: false,
    platformHost: true,
  });
});

test("POST /webhooks/stripe is allowed on the platform host and not found on a site host", () => {
  assert.deepEqual(classify("app.habre.ai", "/webhooks/stripe", "POST"), { kind: "allow" });
  assert.deepEqual(classify("lena.habre.page", "/webhooks/stripe", "POST"), {
    kind: "not-found",
    foreignHost: false,
  });
  assert.deepEqual(classify("lena.example", "/webhooks/stripe", "POST"), {
    kind: "not-found",
    foreignHost: true,
  });
});

test("/_caddy/ask is allowed only on a loopback host, with or without a port", () => {
  for (const host of [
    "127.0.0.1",
    "127.0.0.1:3000",
    "localhost",
    "localhost:3100",
    "[::1]",
    "[::1]:3000",
  ]) {
    assert.deepEqual(classify(host, "/_caddy/ask"), { kind: "allow" }, host);
    assert.deepEqual(classify(host, "/_caddy/ask", "HEAD"), { kind: "allow" }, host);
  }
});

test("/_caddy/ask on the platform host, a site's host or an own domain is not found", () => {
  for (const host of ["app.habre.ai", "lena.habre.page", "habre.page", "surenmaharjan.fyi"]) {
    assert.deepEqual(
      classify(host, "/_caddy/ask"),
      { kind: "not-found", foreignHost: false },
      host,
    );
  }
});

test("/_caddy/ask on a loopback host is not found for a POST", () => {
  assert.deepEqual(classify("127.0.0.1:3000", "/_caddy/ask", "POST"), {
    kind: "not-found",
    foreignHost: false,
  });
});

test("/_caddy/ask is checked before the sites host, which is localhost in development", () => {
  const local = (requestHost: string) =>
    classifyHost({
      method: "GET",
      pathname: "/_caddy/ask",
      search: "?domain=x.example",
      requestHost,
      platformOrigin: "http://app.localhost:3000",
      sitesOrigin: "http://localhost:3000",
    });
  assert.deepEqual(local("localhost:3000"), { kind: "allow" });
  assert.deepEqual(local("app.localhost:3000"), { kind: "not-found", foreignHost: false });
  assert.deepEqual(local("lena.localhost:3000"), { kind: "not-found", foreignHost: false });
});

const ASK_VARIANTS = ["/_caddy/ask/", "/_Caddy/Ask", "/%5Fcaddy/ask", "/%5fCADDY/ask//"];

test("variants of /_caddy/ask are not found on every non-loopback host (F-421)", () => {
  for (const host of ["app.habre.ai", "lena.habre.page", "habre.page", "surenmaharjan.fyi"]) {
    for (const path of ASK_VARIANTS) {
      assert.deepEqual(
        classify(host, path),
        { kind: "not-found", foreignHost: false },
        host + path,
      );
    }
  }
});

test("variants of /_caddy/ask are handled like the path itself on a loopback host (F-421)", () => {
  for (const path of ASK_VARIANTS) {
    assert.deepEqual(classify("127.0.0.1:3000", path), { kind: "allow" }, path);
    assert.deepEqual(classify("127.0.0.1:3000", path, "POST"), {
      kind: "not-found",
      foreignHost: false,
    });
  }
});

test("a malformed escape in the path is not the ask path (F-421)", () => {
  assert.notDeepEqual(classify("127.0.0.1:3000", "/%E0%A4%A/_caddy/ask"), { kind: "allow" });
  assert.notDeepEqual(classify("127.0.0.1:3000", "/%ZZ"), { kind: "allow" });
});
