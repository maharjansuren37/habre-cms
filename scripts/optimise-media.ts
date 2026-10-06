// Gives every image uploaded before item 17b its sizes (D158, D174). Run it on the server.
//
//   npm run optimise-media
//
// For each media row not yet optimised (`variant_widths is null`): read its
// object, make the WebP sizes and social JPEG, write them, then point the row
// at them and delete the old object. An animated GIF is kept as uploaded and
// only re-written with the cache header. Safe to re-run: finished rows are
// skipped, and a row that fails is logged by id and skipped. Exits 1 if any
// row failed. The storage limit is not checked: these images are already
// stored, and the limit refuses new uploads, never existing media.
import { optimiseImage } from "#app/features/media/optimise-image.server.ts";
import {
  deleteObject,
  getObject,
  IMMUTABLE_CACHE_CONTROL,
  uploadObject,
} from "#app/features/media/r2.server.ts";
import { generateUploadDirectory } from "#app/features/media/storage-key.ts";
import { resizedObjects } from "#app/features/media/stored-objects.server.ts";
import { inSite, sql } from "#app/lib/db.server.ts";
import { exitCodeFor, type OptimiseCounts, summaryLine } from "./optimise-media-summary.ts";

type LegacyRow = { id: string; storageKey: string; mimeType: string };

async function legacyRows(siteId: string): Promise<LegacyRow[]> {
  return inSite(
    siteId,
    (tx) => tx<LegacyRow[]>`
      select id, storage_key as "storageKey", mime_type as "mimeType"
      from media
      where site_id = ${siteId} and variant_widths is null
      order by created_at
    `,
  );
}

async function removeObjects(keys: string[]): Promise<void> {
  for (const key of keys) await deleteObject(key);
}

/** One row. Returns what happened, or throws with the reason it failed. */
async function optimiseRow(siteId: string, row: LegacyRow): Promise<"optimised" | "kept"> {
  const original = await getObject(row.storageKey);
  if (original === null) throw new Error("its object is missing from storage");
  const optimised = await optimiseImage(Buffer.from(original));
  if (optimised.kind === "unreadable") throw new Error("the image could not be read");
  if (optimised.kind === "too-large") throw new Error("the image is over the pixel limit");

  if (optimised.kind === "as-uploaded") {
    // Same key, same bytes, now with the cache header.
    await uploadObject(row.storageKey, original, row.mimeType, IMMUTABLE_CACHE_CONTROL);
    await inSite(
      siteId,
      (tx) => tx`
        update media set variant_widths = '{}'
        where site_id = ${siteId} and id = ${row.id} and variant_widths is null
      `,
    );
    return "kept";
  }

  const resized = resizedObjects(
    generateUploadDirectory(siteId),
    optimised.sizes,
    optimised.social,
  );
  for (const object of resized.objects) {
    await uploadObject(object.key, object.bytes, object.contentType, IMMUTABLE_CACHE_CONTROL);
  }
  const updated = await inSite(
    siteId,
    (tx) => tx`
      update media set
        storage_key = ${resized.widestKey},
        mime_type = 'image/webp',
        width = ${resized.width},
        height = ${resized.height},
        variant_widths = ${resized.variantWidths}::integer[],
        byte_size = ${resized.storedBytes}
      where site_id = ${siteId} and id = ${row.id} and variant_widths is null
    `,
  );
  if (updated.count === 0) {
    // Deleted or finished meanwhile: what was just written belongs to no row.
    await removeObjects(resized.objects.map((object) => object.key));
    return "optimised";
  }
  await deleteObject(row.storageKey);
  return "optimised";
}

async function optimiseMedia(): Promise<number> {
  const counts: OptimiseCounts = { optimised: 0, keptAsUploaded: 0, failed: 0 };
  const sites = await sql<{ id: string }[]>`select id from sites order by id`;
  for (const site of sites) {
    for (const row of await legacyRows(site.id)) {
      try {
        const outcome = await optimiseRow(site.id, row);
        if (outcome === "optimised") counts.optimised++;
        else counts.keptAsUploaded++;
        console.log(
          `media ${row.id} ${outcome === "optimised" ? "optimised" : "kept as uploaded"}`,
        );
      } catch (error) {
        counts.failed++;
        console.error(
          `media ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  console.log(summaryLine(counts));
  return exitCodeFor(counts);
}

try {
  process.exitCode = await optimiseMedia();
} catch (error) {
  console.error("Optimising media failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
