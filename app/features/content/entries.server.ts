import { BLOCKS_FORMAT, type Block } from "#app/features/blocks/blocks.ts";
import type { Role } from "#app/features/users/roles.ts";
import { sql } from "#app/lib/db.server.ts";
import type { EntryInput } from "./entry-input.ts";
import { nextFreeSlug, slugFromTitle } from "./slug.ts";

export type Entry = {
  id: string;
  type: "post" | "page";
  title: string;
  slug: string;
  blocks: Block[];
  status: "draft" | "published";
  authorId: string;
  version: number;
  updatedAt: Date;
};

/** Who is asking. Ownership is decided from this, never from the form. */
export type Actor = { id: string; role: Role };

const entryColumns = sql`
  id, type, title, slug, blocks, status,
  author_id as "authorId",
  version,
  updated_at as "updatedAt"
`;

/** Authors see only their own entries; editors and admins see every one. */
function ownedBy(actor: Actor) {
  return actor.role === "author" ? sql`and author_id = ${actor.id}` : sql``;
}

export async function findEntryForUser(id: string, actor: Actor): Promise<Entry | null> {
  const [entry] = await sql<Entry[]>`
    select ${entryColumns} from entries
    where id = ${id} and type = 'post' ${ownedBy(actor)}
  `;
  return entry ?? null;
}

export async function createDraft(input: EntryInput, authorId: string): Promise<Entry> {
  const base = slugFromTitle(input.title);
  // Only addresses that could collide with this one, not the whole table.
  const taken = await sql<{ slug: string }[]>`
    select slug from entries where type = 'post' and slug like ${`${base}%`}
  `;
  const slug = nextFreeSlug(
    base,
    taken.map((row) => row.slug),
  );

  const [entry] = await sql<Entry[]>`
    insert into entries ${sql({
      type: "post",
      title: input.title,
      slug,
      // sql.json, not JSON.stringify: the column is jsonb, and a string would
      // be stored as a JSON string rather than the array itself.
      blocks: sql.json(input.blocks),
      blocks_format: BLOCKS_FORMAT,
      status: "draft",
      author_id: authorId,
    })}
    returning ${entryColumns}
  `;
  return entry;
}

export type UpdateResult =
  | { ok: true; entry: Entry }
  // The entry moved on since this editor loaded it - someone else saved, or the
  // same person in another tab. Never resolved by overwriting.
  | { ok: false; reason: "stale" }
  | { ok: false; reason: "not_found" };

/**
 * Saves a draft, but only over the version the editor loaded. The version is
 * part of the `where`, so two saves racing from the same version cannot both
 * win - the second changes no rows and is told, rather than silently replacing
 * work it never saw.
 */
export async function updateDraft(
  id: string,
  input: EntryInput,
  version: number,
  actor: Actor,
): Promise<UpdateResult> {
  const [entry] = await sql<Entry[]>`
    update entries set
      title = ${input.title},
      blocks = ${sql.json(input.blocks)},
      blocks_format = ${BLOCKS_FORMAT},
      version = version + 1,
      updated_at = now()
    where id = ${id} and version = ${version} and type = 'post' ${ownedBy(actor)}
    returning ${entryColumns}
  `;
  if (entry) return { ok: true, entry };

  // No row changed: either this person cannot see it at all, or its version moved.
  const existing = await findEntryForUser(id, actor);
  return existing ? { ok: false, reason: "stale" } : { ok: false, reason: "not_found" };
}
