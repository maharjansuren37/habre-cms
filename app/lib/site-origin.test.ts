import assert from "node:assert/strict";
import { test } from "node:test";
import { mainHost, mainOrigin, siteOrigin, sitesHost } from "./site-origin.ts";

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

const withDomain = { subdomain: "lena", ownDomain: "lena.example" };
const noDomain = { subdomain: "lena", ownDomain: null };

test("over http a site's main host is its subdomain, even with an own domain", () => {
  assert.equal(mainHost(withDomain, "http://localhost:3100"), "lena.localhost:3100");
});

test("over https a site's main host is its own domain", () => {
  assert.equal(mainHost(withDomain, "https://habre.page"), "lena.example");
});

test("over https a site with no own domain has its subdomain, port kept", () => {
  assert.equal(mainHost(noDomain, "https://localhost:3101"), "lena.localhost:3101");
});

test("the main origin takes its scheme from the sites URL", () => {
  assert.equal(mainOrigin(withDomain, "https://habre.page"), "https://lena.example");
  assert.equal(mainOrigin(withDomain, "http://localhost:3100"), "http://lena.localhost:3100");
});
