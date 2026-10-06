import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaObjectKeys, mediaSources, socialKey, webpKey } from "./media-objects.ts";

const dir = "sites/s1/u1/";
const resized = { storageKey: "sites/s1/u1/1600.webp", variantWidths: [480, 960, 1600] };
const legacy = { storageKey: "sites/s1/u2.jpg", variantWidths: null };
const asUploaded = { storageKey: "sites/s1/u3.gif", variantWidths: [] };

test("keys inside an upload's directory are named by width and by social", () => {
  assert.equal(webpKey(dir, 480), "sites/s1/u1/480.webp");
  assert.equal(socialKey(dir), "sites/s1/u1/social.jpg");
});

test("a resized row owns every size and the social image", () => {
  assert.deepEqual(mediaObjectKeys(resized), [
    "sites/s1/u1/480.webp",
    "sites/s1/u1/960.webp",
    "sites/s1/u1/1600.webp",
    "sites/s1/u1/social.jpg",
  ]);
});

test("a row not yet optimised owns only its one object", () => {
  assert.deepEqual(mediaObjectKeys(legacy), ["sites/s1/u2.jpg"]);
});

test("a row stored as uploaded owns only its one object", () => {
  assert.deepEqual(mediaObjectKeys(asUploaded), ["sites/s1/u3.gif"]);
});

test("a resized row's sources pick src, thumbnail, srcset and social", () => {
  assert.deepEqual(mediaSources("https://m.test", resized), {
    src: "https://m.test/sites/s1/u1/1600.webp",
    srcset:
      "https://m.test/sites/s1/u1/480.webp 480w, https://m.test/sites/s1/u1/960.webp 960w, https://m.test/sites/s1/u1/1600.webp 1600w",
    thumbnail: "https://m.test/sites/s1/u1/480.webp",
    social: "https://m.test/sites/s1/u1/social.jpg",
  });
});

test("src is the widest size up to 1600 even when 2400 exists", () => {
  const row = { storageKey: "sites/s1/u1/2400.webp", variantWidths: [480, 960, 1600, 2400] };
  const sources = mediaSources("https://m.test", row);
  assert.equal(sources.src, "https://m.test/sites/s1/u1/1600.webp");
  assert.match(sources.srcset ?? "", /2400\.webp 2400w$/);
});

test("a small upload's only size is src, thumbnail and in srcset", () => {
  const row = { storageKey: "sites/s1/u1/300.webp", variantWidths: [300] };
  const sources = mediaSources("https://m.test", row);
  assert.equal(sources.src, "https://m.test/sites/s1/u1/300.webp");
  assert.equal(sources.thumbnail, "https://m.test/sites/s1/u1/300.webp");
  assert.equal(sources.srcset, "https://m.test/sites/s1/u1/300.webp 300w");
});

test("a row not yet optimised is its one object everywhere, with no srcset", () => {
  const url = "https://m.test/sites/s1/u2.jpg";
  assert.deepEqual(mediaSources("https://m.test", legacy), {
    src: url,
    srcset: null,
    thumbnail: url,
    social: url,
  });
});

test("a row stored as uploaded is its one object everywhere, with no srcset", () => {
  const url = "https://m.test/sites/s1/u3.gif";
  assert.deepEqual(mediaSources("https://m.test", asUploaded), {
    src: url,
    srcset: null,
    thumbnail: url,
    social: url,
  });
});
