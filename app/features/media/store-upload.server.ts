import { env } from "#app/lib/env.server.ts";
import { insertMedia, storageUsed } from "./media.server.ts";
import { altTextSchema, detectImage, filenameSchema, MAX_UPLOAD_BYTES } from "./media-input.ts";
import { toPickedMedia } from "./media-objects.ts";
import type { PickedMedia } from "./media-picker-dialog.client.ts";
import { optimiseImage } from "./optimise-image.server.ts";
import { IMMUTABLE_CACHE_CONTROL, uploadObject } from "./r2.server.ts";
import { generateStorageKey, generateUploadDirectory } from "./storage-key.ts";
import { fitsStorage, formatStorageLimit } from "./storage-limit.ts";
import { resizedObjects } from "./stored-objects.server.ts";
import { MAX_INPUT_PIXELS, tooLargeMessage, UNREADABLE_MESSAGE } from "./upload-refusals.ts";

/** Who uploads: the member's id and the site the image belongs to. */
export type UploadActor = { id: string; siteId: string };

export type StoreUploadResult =
  | { ok: true; media: PickedMedia }
  | { ok: false; problem: string; status: 400 | 413 };

function refuse(problem: string, status: 400 | 413): StoreUploadResult {
  return { ok: false, problem, status };
}

function storageRefusal(limit: number): StoreUploadResult {
  return refuse(
    `This image would take your site past its ${formatStorageLimit(limit)} of storage. Delete images you no longer use, then try again. Paid plans with more storage are coming soon.`,
    413,
  );
}

/**
 * The one way an image gets into a site's library (Media's upload and
 * Settings' logo): checks, storage cap, resized sizes, R2 objects, then the
 * row. `file` and `altText` are the raw form values. The request-level
 * size-header check stays with the caller, before it reads the form.
 */
export async function storeUpload(
  actor: UploadActor,
  file: unknown,
  altTextValue: unknown,
): Promise<StoreUploadResult> {
  if (!(file instanceof File) || file.size === 0) {
    return refuse("Choose an image to upload.", 400);
  }
  // The caller's header check is on the declared size; this is the real one.
  if (file.size > MAX_UPLOAD_BYTES) {
    return refuse("This image is larger than 10 MB. Choose a smaller file and try again.", 413);
  }
  const altText = altTextSchema.safeParse(altTextValue ?? "");
  if (!altText.success) {
    return refuse(altText.error.issues[0]?.message ?? "Add alt text before uploading.", 400);
  }
  const filename = filenameSchema.safeParse(file.name);
  if (!filename.success) {
    return refuse(filename.error.issues[0]?.message ?? "This file has no usable name.", 400);
  }

  const buffer = await file.arrayBuffer();
  const detected = detectImage(new Uint8Array(buffer));
  if (!detected.ok) {
    return refuse("This file is not a JPEG, PNG, WebP or GIF image.", 400);
  }

  // A site already full is refused before resizing, so it costs no CPU. No lock:
  // two uploads at once can each pass by one file (accepted).
  const limit = env.STORAGE_LIMIT_BYTES;
  const used = limit === null ? 0 : await storageUsed(actor.siteId);
  if (limit !== null && used >= limit) return storageRefusal(limit);

  const bytes = Buffer.from(buffer);
  const started = performance.now();
  const optimised = await optimiseImage(bytes);
  const resizeMs = Math.round(performance.now() - started);
  if (optimised.kind === "unreadable") return refuse(UNREADABLE_MESSAGE, 400);
  if (optimised.kind === "too-large") return refuse(tooLargeMessage(MAX_INPUT_PIXELS), 400);

  // What is stored: every resized object, or the upload itself for an animated GIF.
  const resized =
    optimised.kind === "resized"
      ? resizedObjects(generateUploadDirectory(actor.siteId), optimised.sizes, optimised.social)
      : null;
  const objects = resized
    ? resized.objects
    : [
        {
          key: generateStorageKey(actor.siteId, detected.extension),
          bytes,
          contentType: detected.mimeType,
        },
      ];
  const storedBytes = resized
    ? resized.storedBytes
    : objects.reduce((sum, object) => sum + object.bytes.byteLength, 0);
  if (limit !== null && !fitsStorage(used, storedBytes, limit)) return storageRefusal(limit);

  // R2 objects first, then the row (the plan's data rule) - a failure between
  // leaves harmless orphaned objects. Written one at a time: five small writes,
  // and a failure stops at the first.
  for (const object of objects) {
    await uploadObject(object.key, object.bytes, object.contentType, IMMUTABLE_CACHE_CONTROL);
  }
  const row = {
    storageKey: resized ? resized.widestKey : objects[0].key,
    filename: filename.data,
    mimeType: resized ? "image/webp" : detected.mimeType,
    byteSize: storedBytes,
    width: resized?.width ?? detected.width,
    height: resized?.height ?? detected.height,
    altText: altText.data,
    variantWidths: resized?.variantWidths ?? [],
    colours: optimised.kind === "resized" ? optimised.colours : [],
  };
  const { id } = await insertMedia(actor.siteId, row, actor.id);
  console.info(
    `media upload site=${actor.siteId} resize_ms=${resizeMs} bytes_in=${buffer.byteLength} bytes_stored=${storedBytes}`,
  );
  return { ok: true, media: toPickedMedia(env.R2_PUBLIC_URL, { id, ...row }) };
}
