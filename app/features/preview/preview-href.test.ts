import assert from "node:assert/strict";
import { test } from "node:test";
import { previewHref } from "./preview-href.ts";

const site = {
  pageSlugs: new Set(["about", "contact", "welcome"]),
  homeSlug: "welcome",
  siteOrigin: "http://lena.localhost:3000",
};

test("the site's front door and the home page's own address go to the preview's home", () => {
  assert.equal(previewHref("/", site), "/admin/preview");
  assert.equal(previewHref("/welcome", site), "/admin/preview");
});

test("a page's address stays inside the preview", () => {
  assert.equal(previewHref("/contact", site), "/admin/preview/contact");
});

test("a page's query and fragment are kept", () => {
  assert.equal(previewHref("/about?x=1#team", site), "/admin/preview/about?x=1#team");
  assert.equal(previewHref("/#x", site), "/admin/preview#x");
});

test("an unknown slug goes to the live site", () => {
  assert.equal(previewHref("/nope", site), "http://lena.localhost:3000/nope");
});

test("a post's address goes to the live site", () => {
  assert.equal(previewHref("/posts/hello", site), "http://lena.localhost:3000/posts/hello");
});

test("external, mail, fragment and protocol-relative links are unchanged", () => {
  assert.equal(previewHref("https://example.com/x", site), "https://example.com/x");
  assert.equal(previewHref("mailto:a@b.c", site), "mailto:a@b.c");
  assert.equal(previewHref("#top", site), "#top");
  assert.equal(previewHref("//evil.example", site), "//evil.example");
});
