import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { MAX_INPUT_PIXELS, optimiseImage } from "./optimise-image.server.ts";

async function expectResized(bytes: Buffer) {
  const result = await optimiseImage(bytes);
  assert.equal(result.kind, "resized");
  if (result.kind !== "resized") throw new Error("unreachable");
  return result;
}

test("a rotated camera JPEG with GPS comes back upright, sized by its oriented width, with no metadata", async () => {
  // Stored 3000x2000 with orientation 6: displayed 2000 wide, 3000 tall.
  const input = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#336699" },
  })
    .withExif({
      IFD0: { Copyright: "someone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "27/1 42/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .withIccProfile("p3")
    .jpeg()
    .toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.orientation, 6);
  assert.ok(before.exif);
  assert.ok(before.icc);

  const result = await expectResized(input);
  assert.deepEqual(
    result.sizes.map((s) => s.width),
    [480, 960, 1600, 2000],
  );
  for (const size of result.sizes) {
    const out = await sharp(size.bytes).metadata();
    assert.equal(out.format, "webp");
    assert.equal(out.width, size.width);
    assert.equal(out.height, size.height);
    assert.equal(out.exif, undefined);
    assert.equal(out.xmp, undefined);
    assert.equal(out.icc, undefined);
    assert.equal(out.orientation, undefined);
  }
  const widest = result.sizes[3];
  assert.equal(widest.width, 2000);
  assert.equal(widest.height, 3000);
  const social = await sharp(result.social.bytes).metadata();
  assert.equal(social.format, "jpeg");
  assert.equal(social.width, 1200);
  assert.equal(social.height, 1800);
  assert.equal(result.social.width, 1200);
  assert.equal(result.social.height, 1800);
  assert.equal(social.exif, undefined);
  assert.equal(social.icc, undefined);
  assert.equal(social.orientation, undefined);
});

test("XMP and IPTC in the upload are not in any output", async () => {
  const input = await sharp({
    create: { width: 600, height: 400, channels: 3, background: "#aa5500" },
  })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(input).metadata()).xmp);
  const result = await expectResized(input);
  for (const out of [...result.sizes, result.social]) {
    assert.equal((await sharp(out.bytes).metadata()).xmp, undefined);
  }
});

test("a 700 px PNG gives 480 and 700 and a 700 px social image", async () => {
  const input = await sharp({
    create: { width: 700, height: 350, channels: 3, background: "#00aa00" },
  })
    .png()
    .toBuffer();
  const result = await expectResized(input);
  assert.deepEqual(
    result.sizes.map((s) => [s.width, s.height]),
    [
      [480, 240],
      [700, 350],
    ],
  );
  assert.equal(result.social.width, 700);
  assert.equal(result.social.height, 350);
});

test("a PNG with transparency gives a social JPEG whose corner is white", async () => {
  const input = await sharp({
    create: { width: 800, height: 600, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const result = await expectResized(input);
  const { data, info } = await sharp(result.social.bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  assert.deepEqual([data[0], data[1], data[2]], [255, 255, 255]);
});

test("a two-frame GIF is kept as uploaded", async () => {
  const frames = Buffer.concat([Buffer.alloc(20 * 20 * 3, 0), Buffer.alloc(20 * 20 * 3, 255)]);
  const gif = await sharp(frames, { raw: { width: 20, height: 40, channels: 3, pageHeight: 20 } })
    .gif()
    .toBuffer();
  assert.equal((await sharp(gif, { pages: -1 }).metadata()).pages, 2);
  assert.deepEqual(await optimiseImage(gif), { kind: "as-uploaded" });
});

test("an animated GIF whose frames together pass the pixel cap is still kept as uploaded", async () => {
  // Each frame is small; stacked, they are over MAX_INPUT_PIXELS.
  const side = 1000;
  const count = Math.floor(MAX_INPUT_PIXELS / (side * side)) + 1;
  const frames = Buffer.concat(
    Array.from({ length: count }, (_, i) => Buffer.alloc(side * side * 3, i % 2 ? 255 : 0)),
  );
  const gif = await sharp(frames, {
    raw: { width: side, height: side * count, channels: 3, pageHeight: side },
    limitInputPixels: false,
  })
    .gif()
    .toBuffer();
  assert.equal((await sharp(gif, { pages: -1 }).metadata()).pages, count);
  assert.deepEqual(await optimiseImage(gif), { kind: "as-uploaded" });
});

test("a one-frame GIF is resized like any other image", async () => {
  const gif = await sharp({
    create: { width: 600, height: 300, channels: 3, background: "#0000ff" },
  })
    .gif()
    .toBuffer();
  const result = await expectResized(gif);
  assert.deepEqual(
    result.sizes.map((s) => s.width),
    [480, 600],
  );
});

test("random bytes are unreadable", async () => {
  const bytes = Buffer.from(Array.from({ length: 2000 }, (_, i) => (i * 7919 + 13) % 251));
  assert.deepEqual(await optimiseImage(bytes), { kind: "unreadable" });
});

test("an image over the pixel cap is too large, without being decoded", async () => {
  const input = await sharp({
    create: { width: 8000, height: 6000, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  assert.ok(8000 * 6000 > MAX_INPUT_PIXELS);
  assert.deepEqual(await optimiseImage(input), { kind: "too-large" });
});

test("a failed call does not stop the next one", async () => {
  const good = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  const [bad, ok] = await Promise.all([optimiseImage(Buffer.from("nope")), optimiseImage(good)]);
  assert.equal(bad.kind, "unreadable");
  assert.equal(ok.kind, "resized");
});
