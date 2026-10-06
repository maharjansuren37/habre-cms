import { randomInt } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { logIn } from "./helpers/auth.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { STORAGE_REASON, skipWithoutStorage } from "./helpers/storage.ts";
import { withDatabase } from "./helpers/users.ts";

// Real R2 (local only, like the other upload specs): every stored object, its
// cache header, its metadata, and its removal on delete (17b step 3).
test.skip(skipWithoutStorage, STORAGE_REASON);

let siteId: string;

test.beforeEach(async ({ page }) => {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
  siteId = await createSite("media-optimise");
  await logIn(page, await createSiteAdmin(siteId, "Optimise Admin"));
});

test.afterEach(async () => {
  await deleteSite(siteId);
});

type Row = {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  variantWidths: number[] | null;
};

async function upload(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.goto("/admin/media");
  await page.getByLabel("Image").setInputFiles({ name, mimeType, buffer });
  await page.getByLabel("Alt text").fill("A test image");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status")).toContainText("was uploaded");
  return withDatabase(async (sql) => {
    const [row] = await sql<Row[]>`
      select storage_key as "storageKey", mime_type as "mimeType", byte_size::int as "byteSize",
        width, height, variant_widths as "variantWidths"
      from media where site_id = ${siteId} and filename = ${name}`;
    if (!row) throw new Error("the uploaded row was not found");
    return row;
  });
}

// A query string so an edge cache that saw a key earlier cannot answer for it.
const fetchKey = (key: string) =>
  fetch(`${process.env.R2_PUBLIC_URL}/${key}?t=${Date.now()}-${Math.random()}`);

async function deleteImage(page: Page, name: string) {
  await page.goto("/admin/media");
  await page.getByRole("link", { name: `Delete ${name}` }).click();
  await page.getByRole("button", { name: "Delete image" }).click();
  await expect(page.getByRole("status")).toContainText("was deleted");
}

test("a JPEG with GPS is stored as WebP sizes and a social JPEG, cached, stripped, and deleted with every object", async ({
  page,
}) => {
  const jpeg = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#336699" },
  })
    .withExif({
      IFD0: { Copyright: "someone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "27/1 42/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const row = await upload(page, "gps.jpg", "image/jpeg", jpeg);

  // Orientation 6: displayed 800 wide, 1200 tall.
  expect(row.variantWidths).toEqual([480, 800]);
  expect(row.mimeType).toBe("image/webp");
  expect(row.width).toBe(800);
  expect(row.height).toBe(1200);
  const directory = row.storageKey.slice(0, row.storageKey.lastIndexOf("/") + 1);
  expect(row.storageKey).toBe(`${directory}800.webp`);
  const keys = [`${directory}480.webp`, `${directory}800.webp`, `${directory}social.jpg`];

  const bodies: Buffer[] = [];
  for (const key of keys) {
    const response = await fetchKey(key);
    expect(response.status, key).toBe(200);
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl, key).toContain("max-age=31536000");
    expect(cacheControl, key).toContain("immutable");
    bodies.push(Buffer.from(await response.arrayBuffer()));
  }
  expect(row.byteSize).toBe(bodies.reduce((sum, body) => sum + body.length, 0));

  const meta = await sharp(bodies[1]).metadata();
  expect(meta.exif).toBeUndefined();
  expect(meta.xmp).toBeUndefined();
  expect(meta.icc).toBeUndefined();
  expect(meta.width).toBe(800);

  // The upload itself is not kept: nothing at the old flat key, no other .jpg object.
  expect(keys.filter((key) => /\.jpe?g$/.test(key))).toEqual([`${directory}social.jpg`]);
  const flatKey = `${directory.slice(0, -1)}.jpg`;
  expect((await fetchKey(flatKey)).status).toBe(404);

  await deleteImage(page, "gps.jpg");
  for (const key of keys) {
    await expect.poll(async () => (await fetchKey(key)).status, { message: key }).toBe(404);
  }
});

test("an animated GIF is stored as uploaded, as one object", async ({ page }) => {
  const frame = { create: { width: 8, height: 8, channels: 3 as const, background: "#ff0000" } };
  const first = await sharp(frame).raw().toBuffer();
  const second = await sharp({ create: { ...frame.create, background: "#0000ff" } })
    .raw()
    .toBuffer();
  const gif = await sharp(Buffer.concat([first, second]), {
    raw: { width: 8, height: 16, channels: 3, pageHeight: 8 },
  })
    .gif({ loop: 0, delay: [100, 100] })
    .toBuffer();
  expect((await sharp(gif, { animated: true }).metadata()).pages).toBe(2);

  const row = await upload(page, "spin.gif", "image/gif", gif);

  expect(row.variantWidths).toEqual([]);
  expect(row.mimeType).toBe("image/gif");
  expect(row.byteSize).toBe(gif.length);
  const response = await fetchKey(row.storageKey);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control") ?? "").toContain("immutable");
  expect(Buffer.from(await response.arrayBuffer()).equals(gif)).toBe(true);

  await deleteImage(page, "spin.gif");
  await expect.poll(async () => (await fetchKey(row.storageKey)).status).toBe(404);
});
