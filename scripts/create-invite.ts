// Creates a single-use invite code for signup (D158). Run it on the server.
//
//   npm run create-invite -- --note "for Lena"
//
// Prints the code once. Only its hash is stored, so a lost code cannot be shown
// again - make another. Never prints the hash.
import { parseArgs } from "node:util";
import { generateInviteCode, hashInviteCode } from "#app/features/signup/invite-code.ts";
import { sql } from "#app/lib/db.server.ts";

const USAGE = 'Usage: npm run create-invite -- [--note "for Lena"]  (note: at most 200 characters)';
const MAX_NOTE_LENGTH = 200;

async function createInvite(): Promise<number> {
  const { values } = parseArgs({ options: { note: { type: "string" } }, strict: true });
  const note = values.note ?? "";
  if (note.length > MAX_NOTE_LENGTH) {
    console.error(USAGE);
    console.error("Nothing was created.");
    return 1;
  }

  const code = generateInviteCode();
  await sql`insert into invites (code_hash, note) values (${hashInviteCode(code)}, ${note})`;

  console.log(code);
  return 0;
}

try {
  process.exitCode = await createInvite();
} catch (error) {
  console.error("Creating the invite failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
