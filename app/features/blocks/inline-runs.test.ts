import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeHref, isStorableText } from "./inline-runs.ts";

test("links to unsafe addresses are refused, however they are disguised", () => {
  for (const href of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//evil.example",
    "/\\evil.example",
  ]) {
    assert.equal(isSafeHref(href), false, href);
  }
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
  }
  assert.equal(isSafeHref(""), false);
  assert.equal(isSafeHref("x".repeat(2_049)), false);
});

test("text the database cannot store - a NUL or a lone surrogate - is refused", () => {
  // PostgreSQL refuses both in jsonb, so each was a 500 out of a save (F-47, F-49).
  assert.equal(isStorableText("a\u0000b"), false);
  assert.equal(isStorableText(`a${String.fromCharCode(0xd800)}b`), false);
  assert.equal(isSafeHref("/x\u0000y"), false);
  assert.equal(isSafeHref(`/x${String.fromCharCode(0xdc00)}y`), false);
  // A real pair is text like any other.
  assert.equal(isStorableText("a\u{1f600}b"), true);
});
