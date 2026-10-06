import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_INPUT_PIXELS, tooLargeMessage, UNREADABLE_MESSAGE } from "./upload-refusals.ts";

test("an unreadable image is refused with advice to save it as a JPEG or PNG", () => {
  assert.equal(
    UNREADABLE_MESSAGE,
    "This image could not be read. Try saving it again as a JPEG or PNG.",
  );
});

test("a too-large image is refused naming the megapixel cap", () => {
  assert.equal(
    tooLargeMessage(MAX_INPUT_PIXELS),
    "This image is larger than 40 megapixels. Resize it and try again.",
  );
});

test("the megapixel figure follows the cap", () => {
  assert.equal(
    tooLargeMessage(80_000_000),
    "This image is larger than 80 megapixels. Resize it and try again.",
  );
});
