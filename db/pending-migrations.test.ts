import assert from "node:assert/strict";
import { test } from "node:test";
import { pendingMigrations } from "./pending-migrations.ts";

test("returns unapplied migrations in filename order, ignoring non-SQL files", () => {
  const files = ["0002_entries.sql", ".gitkeep", "0001_users.sql", "0003_media.sql"];
  assert.deepEqual(pendingMigrations(files, ["0001_users.sql"]), [
    "0002_entries.sql",
    "0003_media.sql",
  ]);
});

test("returns nothing when everything is applied", () => {
  assert.deepEqual(pendingMigrations(["0001_users.sql"], ["0001_users.sql"]), []);
});

test("rejects a badly named migration file", () => {
  assert.throws(() => pendingMigrations(["users.sql"], []), /must be named like/);
});

test("rejects an applied migration whose file has gone", () => {
  assert.throws(
    () => pendingMigrations(["0002_entries.sql"], ["0001_users.sql"]),
    /missing from db\/migrations: 0001_users.sql/,
  );
});

test("rejects a new migration numbered before one already applied", () => {
  assert.throws(
    () =>
      pendingMigrations(
        ["0001_users.sql", "0002_media.sql", "0003_entries.sql"],
        ["0001_users.sql", "0003_entries.sql"],
      ),
    /renumber them: 0002_media.sql/,
  );
});
