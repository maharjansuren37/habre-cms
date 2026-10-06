import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { deleteTestMedia, insertTestMediaRow } from "./helpers/media.ts";
import { createSite, createSiteAdmin, deleteSite } from "./helpers/sites.ts";
import { withDatabase } from "./helpers/users.ts";

// Database only - no page. Setup and checks run as the owner, so the foreign
// key itself is what is under test, not row-level security. Both sites are the
// test's own: site 1's shared rows are never touched (F-103).

let siteA: string;
let siteB: string;

test.beforeAll(async () => {
  siteA = await createSite("seo-a");
  siteB = await createSite("seo-b");
});

test.afterAll(async () => {
  await deleteSite(siteA);
  await deleteSite(siteB);
});

test("an entry cannot use another site's image", async () => {
  const tag = randomUUID().slice(0, 8);
  const adminA = await createSiteAdmin(siteA, "Seo A");
  const adminB = await createSiteAdmin(siteB, "Seo B");
  const mediaA = await insertTestMediaRow({ uploadedBy: adminA.email, siteId: siteA });
  const mediaB = await insertTestMediaRow({ uploadedBy: adminB.email, siteId: siteB });

  await withDatabase(async (sql) => {
    const [entry] = await sql<{ id: string }[]>`
      insert into entries (site_id, type, title, slug, blocks, blocks_format, status, author_id)
      select ${siteA}, 'page', ${tag}, ${tag}, ${sql.json({ type: "doc", content: [] })}, 'v4', 'draft', id
      from users where email = ${adminA.email}
      returning id
    `;

    // New entries start with no search fields and no image.
    const [fresh] = await sql`
      select seo_title, seo_description, social_image_media_id from entries where id = ${entry.id}
    `;
    expect(fresh).toEqual({ seo_title: "", seo_description: "", social_image_media_id: null });

    // Another site's media row is refused by the foreign key.
    const refused = await sql`
      update entries set social_image_media_id = ${mediaB} where id = ${entry.id}
    `.then(
      () => null,
      (error: { code?: string; constraint_name?: string }) => error,
    );
    expect(refused?.code).toBe("23503");
    expect(refused?.constraint_name).toBe("entries_social_image_media_id_fkey");

    // Its own site's row is accepted...
    await sql`update entries set social_image_media_id = ${mediaA} where id = ${entry.id}`;
    const [set] = await sql`select social_image_media_id from entries where id = ${entry.id}`;
    expect(set.social_image_media_id).toBe(mediaA);

    // ...and deleting that image clears the reference, not the entry.
    await sql`delete from media where id = ${mediaA}`;
    const [cleared] = await sql`
      select social_image_media_id, site_id from entries where id = ${entry.id}
    `;
    expect(cleared).toEqual({ social_image_media_id: null, site_id: siteA });
  });

  await deleteTestMedia(mediaB);
});
