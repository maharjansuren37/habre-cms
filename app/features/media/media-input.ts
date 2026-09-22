import { imageSize } from "image-size";
import { z } from "zod";
import { isStorableText } from "#app/features/blocks/inline-runs.ts";

// Matches the media table's own byte_size check and quality-bar.md's cap.
// Exported so the action can also check the real bytes read, not just the
// declared header.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Whether an upload's declared size is small enough to read, checked before
 * the body is parsed - the same guard `isEntryBodySizeAllowed` applies to an
 * entry save, against the upload cap instead of the entry one.
 */
export function isUploadSizeAllowed(headers: Headers): boolean {
  const declared = Number(headers.get("Content-Length"));
  return Number.isFinite(declared) && declared > 0 && declared <= MAX_UPLOAD_BYTES;
}

/** What this project calls an allowed image type, and its stored form. */
const ALLOWED_IMAGE_TYPES: Record<string, { mimeType: string; extension: string }> = {
  jpg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
  gif: { mimeType: "image/gif", extension: "gif" },
};

export type DetectImageResult =
  | { ok: true; mimeType: string; extension: string; width: number; height: number }
  | { ok: false };

/**
 * What an upload's own bytes say it is - never the browser's `Content-Type`,
 * which a crafted upload can set to anything. Catches a renamed non-image the
 * same way the block schema catches a value the editor could not have sent.
 */
export function detectImage(buffer: Uint8Array): DetectImageResult {
  let size: { type?: string; width: number; height: number };
  try {
    size = imageSize(buffer);
  } catch {
    return { ok: false };
  }
  const allowed = size.type ? ALLOWED_IMAGE_TYPES[size.type] : undefined;
  if (!allowed) return { ok: false };
  return { ok: true, mimeType: allowed.mimeType, extension: allowed.extension, ...size };
}

export const altTextSchema = z
  .string()
  .trim()
  .min(1, { message: "Add alt text describing this image before uploading." })
  .max(250, { message: "Alt text can be up to 250 characters." })
  .refine(isStorableText, { message: "The alt text has a character that cannot be stored." });

export const filenameSchema = z
  .string()
  .trim()
  .min(1, { message: "This file has no name." })
  .max(255, { message: "Filenames can be up to 255 characters." })
  .refine(isStorableText, { message: "The filename has a character that cannot be stored." });
