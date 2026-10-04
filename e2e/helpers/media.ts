import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { siteOneId } from "./sites.ts";
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

/**
 * Test-only: a media row with no R2 object behind it, so tests that only need
 * the row (its alt text, size and URL on a rendered page) run in CI, which
 * holds no storage credentials. An `img` keeps its role and name when its file
 * 404s. `uploadedBy` is a test user's email; delete the row with
 * `deleteTestMedia` before deleting that user.
 */
export function insertTestMediaRow(options: {
  uploadedBy: string;
  altText?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const { uploadedBy, altText = "A test image", width = 640, height = 480 } = options;
  const key = `e2e-test/${randomUUID()}.jpg`;
  return withDatabase(async (sql) => {
    const siteId = await siteOneId();
    const [row] = await sql<{ id: string }[]>`
      insert into media (site_id, storage_key, filename, mime_type, byte_size, width, height, alt_text, uploaded_by)
      select ${siteId}, ${key}, ${`${key.slice(9)}`}, 'image/jpeg', 1, ${width}, ${height}, ${altText}, id
      from users where email = ${uploadedBy}
      returning id
    `;
    if (!row) throw new Error(`no user ${uploadedBy} to own the test media row`);
    return row.id;
  });
}

/** Test-only: the filename a seeded row shows in the picker, where a thumbnail's button is named by it. */
export function testMediaFilename(id: string): Promise<string> {
  return withDatabase(async (sql) => {
    const [row] = await sql<{ filename: string }[]>`select filename from media where id = ${id}`;
    if (!row) throw new Error(`no media row ${id}`);
    return row.filename;
  });
}
