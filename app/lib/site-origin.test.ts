import assert from "node:assert/strict";
import { test } from "node:test";
import { siteOrigin, sitesHost } from "./site-origin.ts";

test("a site's origin is its address in front of the sites domain, with the sites scheme", () => {
  assert.equal(siteOrigin("lena", "https://habre.page"), "https://lena.habre.page");
});

test("a site's origin keeps the sites port", () => {
  assert.equal(
    siteOrigin("surenmaharjan", "http://localhost:3100"),
    "http://surenmaharjan.localhost:3100",
  );
});

test("a trailing slash on the sites URL changes nothing", () => {
  assert.equal(siteOrigin("lena", "https://habre.page/"), "https://lena.habre.page");
});

test("the sites host is the host with its port", () => {
  assert.equal(sitesHost("https://habre.page"), "habre.page");
  assert.equal(sitesHost("http://localhost:3100/"), "localhost:3100");
});
