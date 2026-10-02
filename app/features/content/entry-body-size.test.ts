import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENTRY_TOO_LONG_MESSAGE,
  encodedFormBytes,
  isEntryBodySizeAllowed,
  isEntryFormSizeAllowed,
  MAX_ENTRY_BODY_BYTES,
} from "./entry-body-size.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** The fixed part of `blocks=...&title=t`, so a test can fill the rest to a byte. */
function formOfBytes(total: number): FormData {
  const overhead = "title=t&blocks=".length;
  return form({ title: "t", blocks: "a".repeat(total - overhead) });
}

test("a form's size is the byte length of the url-encoded body the browser sends", () => {
  // "a b" -> "a+b", '{"x":1}' -> "%7B%22x%22%3A1%7D", "é" -> "%C3%A9".
  const submitted = form({ title: "a b", blocks: '{"x":1}', note: "é" });
  const body = "title=a+b&blocks=%7B%22x%22%3A1%7D&note=%C3%A9";
  assert.equal(encodedFormBytes(submitted), body.length);
});

test("a form of exactly 1 MB encoded may be submitted, one byte more may not", () => {
  assert.equal(MAX_ENTRY_BODY_BYTES, 1024 * 1024);
  assert.equal(isEntryFormSizeAllowed(formOfBytes(MAX_ENTRY_BODY_BYTES)), true);
  assert.equal(isEntryFormSizeAllowed(formOfBytes(MAX_ENTRY_BODY_BYTES + 1)), false);
});

test("text that encodes larger than it looks is counted as it is sent", () => {
  // 400,000 quote characters are 400 KB typed but 1.2 MB encoded (%22 each).
  assert.equal(isEntryFormSizeAllowed(form({ blocks: '"'.repeat(400_000) })), false);
});

const withLength = (value: string) => new Headers({ "Content-Length": value });

test("a declared body up to 1 MB is read", () => {
  assert.equal(isEntryBodySizeAllowed(withLength("1")), true);
  assert.equal(isEntryBodySizeAllowed(withLength(String(MAX_ENTRY_BODY_BYTES))), true);
});

test("a declared body over 1 MB, of no size, or of unknown size is refused", () => {
  for (const value of [String(MAX_ENTRY_BODY_BYTES + 1), "0", "abc", "-5"]) {
    assert.equal(isEntryBodySizeAllowed(withLength(value)), false, value);
  }
  assert.equal(isEntryBodySizeAllowed(new Headers()), false);
});

test("the refusal is the one plain sentence the writer reads", () => {
  assert.equal(
    ENTRY_TOO_LONG_MESSAGE,
    "This is too long to save. Remove some text and save again.",
  );
});
