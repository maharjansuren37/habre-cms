import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSitemapXml, MAX_SITEMAP_URLS } from "./sitemap-xml.ts";

const day = (iso: string) => new Date(`${iso}T23:59:59Z`);

test("each url is a loc at the main origin with its lastmod as a UTC date", () => {
  const xml = buildSitemapXml("https://a.example", [
    { path: "/about", lastmod: day("2026-03-04") },
  ]);
  assert.match(
    xml,
    /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  assert.match(
    xml,
    /<url><loc>https:\/\/a\.example\/about<\/loc><lastmod>2026-03-04<\/lastmod><\/url>/,
  );
  assert.match(xml, /<\/urlset>\n?$/);
});

test("the order given is the order written", () => {
  const xml = buildSitemapXml("http://x.test", [
    { path: "/", lastmod: day("2026-01-01") },
    { path: "/posts", lastmod: day("2026-01-01") },
    { path: "/b", lastmod: day("2026-01-01") },
    { path: "/a", lastmod: day("2026-01-01") },
  ]);
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [
    "http://x.test/",
    "http://x.test/posts",
    "http://x.test/b",
    "http://x.test/a",
  ]);
});

test("the five XML characters are escaped in a loc", () => {
  const xml = buildSitemapXml("http://x.test", [
    { path: `/a&b<c>d"e'f`, lastmod: day("2026-01-01") },
  ]);
  assert.match(xml, /<loc>http:\/\/x\.test\/a&amp;b&lt;c&gt;d&quot;e&apos;f<\/loc>/);
});

test("no urls gives an empty urlset", () => {
  const xml = buildSitemapXml("http://x.test", []);
  assert.doesNotMatch(xml, /<url>/);
  assert.match(xml, /<urlset[^>]*><\/urlset>/);
});

test("more than 50,000 urls are cut to the first 50,000", () => {
  const urls = Array.from({ length: MAX_SITEMAP_URLS + 5 }, (_, i) => ({
    path: `/p${i}`,
    lastmod: day("2026-01-01"),
  }));
  const xml = buildSitemapXml("http://x.test", urls);
  assert.equal(xml.split("<url>").length - 1, MAX_SITEMAP_URLS);
  assert.match(xml, new RegExp(`/p${MAX_SITEMAP_URLS - 1}<`));
  assert.doesNotMatch(xml, new RegExp(`/p${MAX_SITEMAP_URLS}<`));
});
