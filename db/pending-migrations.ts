const MIGRATION_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

/**
 * Works out which migration files still need applying, in order.
 * Throws when the directory and the database's record disagree, because
 * applying anything on top of a disagreement makes it worse.
 */
export function pendingMigrations(files: readonly string[], applied: readonly string[]): string[] {
  const migrations = files.filter((file) => file.endsWith(".sql"));

  const malformed = migrations.filter((file) => !MIGRATION_NAME.test(file));
  if (malformed.length > 0) {
    throw new Error(
      `Migration files must be named like 0001_create_users.sql: ${malformed.join(", ")}`,
    );
  }

  const available = new Set(migrations);
  const missing = applied.filter((file) => !available.has(file));
  if (missing.length > 0) {
    throw new Error(`Applied migrations are missing from db/migrations: ${missing.join(", ")}`);
  }

  const appliedSet = new Set(applied);
  const pending = migrations.filter((file) => !appliedSet.has(file)).sort();
  const lastApplied = [...applied].sort().at(-1);
  const outOfOrder = lastApplied === undefined ? [] : pending.filter((file) => file < lastApplied);
  if (outOfOrder.length > 0) {
    throw new Error(
      `Unapplied migrations sort before already-applied ${lastApplied}; renumber them: ${outOfOrder.join(", ")}`,
    );
  }

  return pending;
}
