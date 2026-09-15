// Creates an admin account. The first admin is made here, on the server, never by
// a web setup page - an open setup page belongs to whoever reaches it first.
//
//   npm run create-admin -- --email you@example.org --name "Your Name"
//
// Asks for the password twice when run in a terminal; reads one line from stdin
// when piped. Never prints the password or its hash.
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { hashPassword } from "#app/features/auth/password.server.ts";
import { newUserSchema } from "#app/features/users/user-input.ts";
import { createUser } from "#app/features/users/users.server.ts";
import { sql } from "#app/lib/db.server.ts";

const USAGE = 'Usage: npm run create-admin -- --email you@example.org --name "Your Name"';

async function createAdmin(): Promise<number> {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
    strict: true,
  });
  if (values.email === undefined || values.name === undefined) {
    console.error(USAGE);
    return 1;
  }

  const password = process.stdin.isTTY ? await askPasswordTwice() : await readFirstLineOfStdin();
  if (password === null) {
    console.error("The passwords do not match. Nothing was created.");
    return 1;
  }

  const input = newUserSchema.safeParse({ email: values.email, name: values.name, password });
  if (!input.success) {
    for (const issue of input.error.issues) console.error(issue.message);
    console.error("Nothing was created.");
    return 1;
  }

  const result = await createUser({
    email: input.data.email,
    name: input.data.name,
    passwordHash: await hashPassword(input.data.password),
    role: "admin",
  });
  if (!result.ok) {
    console.error("A user with that email already exists.");
    return 1;
  }

  console.log(`Created admin ${result.user.email}. They can log in at /admin/login.`);
  return 0;
}

/** Returns the password, or null when the two entries differ. */
async function askPasswordTwice(): Promise<string | null> {
  const first = await askHidden("Password: ");
  const second = await askHidden("Password again: ");
  return first === second ? first : null;
}

async function askHidden(prompt: string): Promise<string> {
  let isMuted = false;
  // readline echoes typed characters to its output; this output drops them.
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!isMuted) process.stdout.write(chunk);
      callback();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write(prompt);
    isMuted = true;
    return await reader.question("");
  } finally {
    isMuted = false;
    reader.close();
    process.stdout.write("\n");
  }
}

async function readFirstLineOfStdin(): Promise<string> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  // Only the line ending is removed: spaces can be part of a password.
  return text.split(/\r?\n/, 1)[0];
}

try {
  process.exitCode = await createAdmin();
} catch (error) {
  // Ctrl-C at the password prompt rejects the readline question with AbortError.
  if (error instanceof Error && error.name === "AbortError") {
    console.error("Cancelled. Nothing was created.");
    process.exitCode = 130;
  } else {
    console.error("Creating the admin failed:", error);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
