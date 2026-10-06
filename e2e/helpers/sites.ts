import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PORT } from "./ports.ts";
import { PASSWORD, type TestUser, withDatabase } from "./users.ts";

let siteOne: string | undefined;
/** The oldest site: the one today's install became. Test users made by `createAdmin` belong to it. */
export async function siteOneId(): Promise<string> {
  siteOne ??= await withDatabase(async (sql) => {
    const [row] = await sql<{ id: string }[]>`select id from sites order by created_at, id limit 1`;
    if (!row) throw new Error("no site exists");
    return row.id;
  });
  return siteOne;
}

/** Makes a site and its settings row, and returns the site's id and its address
 *  (subdomain). The subdomain gets a random suffix so parallel workers never collide. */
export function createSiteWithAddress(subdomain: string): Promise<{ id: string; address: string }> {
  const unique = `${subdomain}-${randomUUID().slice(0, 8)}`;
  return withDatabase(async (sql) => {
    const [site] = await sql<{ id: string }[]>`
      insert into sites (subdomain) values (${unique}) returning id
    `;
    await sql`insert into site_settings (site_id, site_title) values (${site.id}, ${unique})`;
    return { id: site.id, address: unique };
  });
}

/** Like `createSiteWithAddress`, for tests that only need the id. */
export async function createSite(subdomain: string): Promise<string> {
  return (await createSiteWithAddress(subdomain)).id;
}

// The app's own hash function, run by node (the e2e project cannot import app/),
// once: scrypt is slow on purpose and every test user shares the password.
let passwordHash: string | undefined;
function testPasswordHash(): string {
  passwordHash ??= execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      'import { hashPassword } from "#app/features/auth/password.server.ts"; console.log(await hashPassword(process.env.TEST_PASSWORD));',
    ],
    { env: { ...process.env, TEST_PASSWORD: PASSWORD }, encoding: "utf8" },
  ).trim();
  return passwordHash;
}

/** Makes an admin member of this site, with the shared test password. */
export async function createSiteAdmin(siteId: string, name = "Site Admin"): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@example.test`;
  const hash = testPasswordHash();
  await withDatabase(async (sql) => {
    await sql.begin(async (tx) => {
      const [user] = await tx<{ id: string }[]>`
        insert into users (email, name, password_hash, email_verified_at)
        values (${email}, ${name}, ${hash}, now())
        returning id
      `;
      await tx`insert into site_members (site_id, user_id, role) values (${siteId}, ${user.id}, 'admin')`;
    });
  });
  return { email, name, password: PASSWORD };
}

/** Test cleanup, in dependency order: settings, content, memberships and their users, the site. */
export function deleteSite(siteId: string): Promise<void> {
  return withDatabase(async (sql) => {
    await sql.begin(async (tx) => {
      const members = await tx<{ userId: string }[]>`
        select user_id as "userId" from site_members where site_id = ${siteId}
      `;
      const userIds = members.map((member) => member.userId);
      await tx`delete from site_settings where site_id = ${siteId}`;
      await tx`delete from entries where site_id = ${siteId}`;
      await tx`delete from media where site_id = ${siteId}`;
      await tx`delete from site_members where site_id = ${siteId}`;
      if (userIds.length > 0) await tx`delete from users where id in ${tx(userIds)}`;
      await tx`delete from sites where id = ${siteId}`;
    });
  });
}

/** The URL of a public page: each site is served at `http://<address>.localhost:<port>`. */
export function siteUrl(path: string, address = "surenmaharjan"): string {
  return `http://${address}.localhost:${PORT}${path}`;
}
