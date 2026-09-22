import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { withDatabase } from "./users.ts";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "..", "app/features/media/fixtures");
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Uploads a real fixture through the real action - R2 object and row both
 * written, the same as a person uploading through the browser - so the
 * picker's thumbnail is a real, loadable image, not a stand-in. The upload
 * name carries a random suffix so two tests running in parallel never race
 * on the same filename when looking the row back up.
 */
export async function uploadTestMedia(
  request: APIRequestContext,
  origin: string,
  fixture: string,
  altText: string,
): Promise<{ id: string; filename: string }> {
  const extension = path.extname(fixture);
  const filename = `${path.basename(fixture, extension)}-${randomUUID()}${extension}`;
  const response = await request.post(`${origin}/admin/media`, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: filename,
        mimeType: MIME_TYPES[extension] ?? "application/octet-stream",
        buffer: readFileSync(path.join(FIXTURES_DIR, fixture)),
      },
      altText,
    },
  });
  if (!response.ok()) {
    throw new Error(
      `test upload of ${fixture} failed: ${response.status()} ${await response.text()}`,
    );
  }
  const id = await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`select id from media where filename = ${filename}`;
    return row?.id;
  });
  if (!id) throw new Error(`uploaded ${filename} but its row was not found`);
  return { id, filename };
}

/** Test cleanup only - removes the row. An R2 object left in the dev bucket
 *  is harmless test residue; this does not reach it. */
export function deleteTestMedia(id: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql`delete from media where id = ${id}`;
  });
}
