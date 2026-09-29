import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeHref, parseInlineHtml, type Run, runsSchema, runsToHtml } from "./inline-runs.ts";

const runs = (html: string) => parseInlineHtml(html);

test("plain text becomes one run with no marks", () => {
  assert.deepEqual(runs("Hello there"), { ok: true, runs: [{ text: "Hello there" }] });
});

test("empty text becomes no runs", () => {
  assert.deepEqual(runs(""), { ok: true, runs: [] });
  assert.deepEqual(runs("  <b> </b> "), { ok: true, runs: [] });
});

test("bold and italic become separate runs, keeping the space between them", () => {
  assert.deepEqual(runs("<b>a</b> <i>b</i>"), {
    ok: true,
    runs: [{ text: "a", bold: true }, { text: " " }, { text: "b", italic: true }],
  });
});

test("strong and em are read as bold and italic", () => {
  assert.deepEqual(runs("<strong>a</strong><em>b</em>"), {
    ok: true,
    runs: [
      { text: "a", bold: true },
      { text: "b", italic: true },
    ],
  });
});

test("nested and overlapping marks apply to exactly the text inside them", () => {
  assert.deepEqual(runs("<b>one <i>two</b> three</i> four"), {
    ok: true,
    runs: [
      { text: "one ", bold: true },
      { text: "two", bold: true, italic: true },
      { text: " three", italic: true },
      { text: " four" },
    ],
  });
});

test("neighbouring text with the same marks is merged into one run", () => {
  assert.deepEqual(runs("<b>a</b><b>b</b>c<span>d</span>"), {
    ok: true,
    runs: [{ text: "ab", bold: true }, { text: "cd" }],
  });
});

test("a link keeps its address, and ignores the editor's target and rel", () => {
  assert.deepEqual(
    runs('See <a href="https://example.com/" target="_blank" rel="nofollow">this <b>page</b></a>'),
    {
      ok: true,
      runs: [
        { text: "See " },
        { text: "this ", href: "https://example.com/" },
        { text: "page", bold: true, href: "https://example.com/" },
      ],
    },
  );
});

test("an inner link wins until it closes, and a link without an address is plain text", () => {
  assert.deepEqual(runs('<a href="/a">x<a href="/b">y</a>z</a><a>w</a>'), {
    ok: true,
    runs: [
      { text: "x", href: "/a" },
      { text: "y", href: "/b" },
      { text: "z", href: "/a" },
      { text: "w" },
    ],
  });
});

test("entities are decoded once, so escaped markup stays literal text", () => {
  assert.deepEqual(runs("&lt;img src=x onerror=alert(1)&gt; &amp;amp; &#39;&#x41;&nbsp;&bogus;"), {
    ok: true,
    runs: [{ text: "<img src=x onerror=alert(1)> &amp; 'A &bogus;" }],
  });
});

test("whitespace and line breaks collapse to single spaces, trimmed at the ends", () => {
  assert.deepEqual(runs("  a<br>b \n <b> c </b>  "), {
    ok: true,
    runs: [{ text: "a b " }, { text: "c", bold: true }],
  });
});

test("a < that cannot start a tag is kept, and comments are dropped", () => {
  assert.deepEqual(runs("1 < 2 <!-- note -->and 3"), {
    ok: true,
    runs: [{ text: "1 < 2 and 3" }],
  });
});

test("links to unsafe addresses are refused, however they are disguised", () => {
  for (const href of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java&#x09;script:alert(1)",
    " javascript:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//evil.example",
    "/\\evil.example",
  ]) {
    assert.deepEqual(
      runs(`<a href="${href.replace(/"/g, "&quot;")}">x</a>`),
      { ok: false, reason: "unsafe_link" },
      href,
    );
  }
  assert.deepEqual(runs("<a href=javascript:alert(1)>x</a>"), { ok: false, reason: "unsafe_link" });
});

test("control characters and spaces are stripped before the address is judged", () => {
  // Only a character between slashes, or before `#`, shows whether it was
  // stripped: one left inside a scheme is refused by the scheme check anyway.
  for (const character of ["\u0001", "\u001f", " ", "\u007f"]) {
    assert.equal(isSafeHref(`/${character}/evil.example`), false, JSON.stringify(character));
  }
  assert.equal(isSafeHref("\u0001#top"), true);
});

test("web, email, site-relative and fragment links are accepted", () => {
  for (const href of [
    "https://example.com",
    "HTTP://example.com",
    "mailto:a@b.c",
    "/about",
    "#top",
  ]) {
    assert.equal(isSafeHref(href), true, href);
    assert.deepEqual(runs(`<a href='${href}'>x</a>`), { ok: true, runs: [{ text: "x", href }] });
  }
  assert.equal(isSafeHref("x".repeat(2_049)), false);
});

test("text over 20,000 characters is refused, not truncated", () => {
  assert.deepEqual(runs("a".repeat(20_000)), { ok: true, runs: [{ text: "a".repeat(20_000) }] });
  assert.deepEqual(runs("a".repeat(20_001)), { ok: false, reason: "too_long" });
});

test("hostile nesting returns a result instead of throwing", () => {
  assert.deepEqual(runs(`${"<b>".repeat(9_000)}deep`), {
    ok: true,
    runs: [{ text: "deep", bold: true }],
  });
  assert.deepEqual(runs(`${"<b>".repeat(50_000)}deep`), {
    ok: false,
    reason: "too_much_formatting",
  });
  assert.deepEqual(runs("</b></i></a>ok"), { ok: true, runs: [{ text: "ok" }] });
  assert.deepEqual(runs('before <a href="https://example.com'), {
    ok: true,
    runs: [{ text: "before" }],
  });
});

test("each bound is refused with its own reason", () => {
  assert.deepEqual(runs("<b>a</b>b".repeat(1_001)), { ok: false, reason: "too_much_formatting" });
  assert.deepEqual(runs(`<a href="https://example.com/${"x".repeat(2_048)}">x</a>`), {
    ok: false,
    reason: "link_too_long",
  });
  assert.deepEqual(runs("<a href='//example.com'>x</a>"), { ok: false, reason: "unsafe_link" });
});

test("a NUL character is dropped from text and links, since the database cannot store it", () => {
  assert.deepEqual(runs('a\u0000b <a href="/x\u0000y">c</a>'), {
    ok: true,
    runs: [{ text: "ab " }, { text: "c", href: "/xy" }],
  });
  assert.deepEqual(runs("&#0;"), { ok: true, runs: [{ text: "&#0;" }] });
});

test("the stored shape refuses a NUL character in text or a link", () => {
  assert.equal(runsSchema.safeParse([{ text: "a\u0000b" }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "x", href: "/x\u0000y" }]).success, false);
});

test("the stored shape refuses a lone surrogate, which jsonb rejects the same way", () => {
  // `JSON.stringify` escapes it rather than dropping it, and PostgreSQL then
  // refuses the value - "Unicode low surrogate must follow a high surrogate" -
  // so it is a 500 out of the save unless it is caught here (F-49).
  const lone = `a${String.fromCharCode(0xd800)}b`;
  assert.equal(lone.isWellFormed(), false);
  assert.equal(runsSchema.safeParse([{ text: lone }]).success, false);
  assert.equal(isSafeHref(`/x${String.fromCharCode(0xdc00)}y`), false);
  // A real pair is text like any other.
  assert.equal(runsSchema.safeParse([{ text: "a\u{1f600}b" }]).success, true);
});

test("runsToHtml escapes text and link addresses", () => {
  assert.equal(
    runsToHtml([
      { text: "<script>alert(1)</script> & more" },
      { text: "x", href: '/a"onmouseover="alert(1)' },
    ]),
    '&lt;script&gt;alert(1)&lt;/script&gt; &amp; more<a href="/a&quot;onmouseover=&quot;alert(1)">x</a>',
  );
  assert.equal(runsToHtml([]), "");
});

test("runs survive a trip through HTML unchanged", () => {
  const samples: Run[][] = [
    [],
    [{ text: "plain" }],
    [{ text: "a", bold: true }, { text: " and " }, { text: "b", italic: true }],
    [
      { text: "go ", href: "https://example.com/?a=1&b=2" },
      { text: "here", bold: true, italic: true, href: "https://example.com/?a=1&b=2" },
      { text: "now", href: "#top" },
    ],
    [{ text: "<b>not bold</b> &amp; 'quoted' \"too\"" }],
  ];
  for (const sample of samples) {
    assert.deepEqual(parseInlineHtml(runsToHtml(sample)), { ok: true, runs: sample });
  }
});

test("the stored shape refuses what the parser would never produce", () => {
  assert.equal(runsSchema.safeParse([{ text: "x", href: "javascript:alert(1)" }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "" }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "x", bold: false }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "x", underline: true }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "a" }, { text: "b" }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "a".repeat(20_001) }]).success, false);
  assert.equal(runsSchema.safeParse([{ text: "a", bold: true }, { text: "b" }]).success, true);
});
