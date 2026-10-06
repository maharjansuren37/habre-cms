import { AwsClient } from "aws4fetch";
import { env } from "#app/lib/env.server.ts";

// R2's S3-compatible API (D7): signed, server-only writes. Never how a visitor
// reads an image back - that goes through R2_PUBLIC_URL (media-url.ts).
const client = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

function objectUrl(key: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
}

/** Every object has its own key, so none ever changes: cache it for a year (D174). */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Writes one object. Throws on anything but a 2xx, naming the R2 status. */
export async function uploadObject(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  const response = await client.fetch(objectUrl(key), {
    method: "PUT",
    // A view (sharp's Buffer) is copied to its own ArrayBuffer-backed array, the type fetch accepts.
    body: body instanceof ArrayBuffer ? body : new Uint8Array(body),
    headers: { "Content-Type": contentType, "Cache-Control": cacheControl },
  });
  if (!response.ok) {
    throw new Error(`R2 upload failed for ${key}: ${response.status} ${await response.text()}`);
  }
}

/**
 * Removes one object. A 404 is treated as success - the row is what
 * `deleteMedia` deletes first (the plan's data rule), so by the time this
 * runs the object may already be the only thing left, or already gone.
 */
export async function deleteObject(key: string): Promise<void> {
  const response = await client.fetch(objectUrl(key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed for ${key}: ${response.status} ${await response.text()}`);
  }
}
