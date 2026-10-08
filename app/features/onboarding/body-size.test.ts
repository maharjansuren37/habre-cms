import assert from "node:assert/strict";
import { test } from "node:test";
import { isAboutBodyAllowed, MAX_ABOUT_BODY_BYTES } from "./body-size.ts";

const withLength = (value: string) => new Headers({ "Content-Length": value });

test("a declared body from 1 byte up to 32 KB is read", () => {
  assert.equal(MAX_ABOUT_BODY_BYTES, 32 * 1024);
  assert.equal(isAboutBodyAllowed(withLength("1")), true);
  assert.equal(isAboutBodyAllowed(withLength(String(MAX_ABOUT_BODY_BYTES))), true);
});

test("a declared body over 32 KB, of no size, or of unknown size is refused", () => {
  for (const value of [String(MAX_ABOUT_BODY_BYTES + 1), "0", "abc", "-5"]) {
    assert.equal(isAboutBodyAllowed(withLength(value)), false, value);
  }
  assert.equal(isAboutBodyAllowed(new Headers()), false);
});
