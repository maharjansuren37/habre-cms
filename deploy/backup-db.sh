#!/usr/bin/env bash
# Nightly PostgreSQL backup to the private R2 bucket. Installed as
# /usr/local/sbin/habre-cms-backup and run by habre-cms-backup.service.
#
# Credentials come from /etc/habre-cms/backup.env (root-only), deliberately not
# from the app's own environment file: the app has no business reading them, so
# an app compromise cannot reach the backups.
set -euo pipefail

ENV_FILE=/etc/habre-cms/backup.env
DUMP_DIR=/var/backups/habre-cms
STAMP_FILE=/var/lib/habre-cms/last-backup
KEEP_LOCAL_DAYS=7
DB=habre_cms

fail() { printf 'habre-cms-backup: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "run as root"
[[ -r $ENV_FILE ]] || fail "$ENV_FILE is missing or unreadable"
set -a; . "$ENV_FILE"; set +a
for name in BACKUP_R2_ACCOUNT_ID BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY BACKUP_R2_BUCKET; do
  [[ -n ${!name:-} ]] || fail "$name is not set in $ENV_FILE"
done

install -d -m 700 "$DUMP_DIR"
install -d -m 755 "$(dirname "$STAMP_FILE")"
object="$DB-$(date -u +%Y%m%dT%H%M%SZ).dump"
dump="$DUMP_DIR/$object"

# pg_dump over the local socket as the postgres superuser: a consistent snapshot
# while the app keeps writing, and no database password for this job to hold.
# Copying the data directory instead would capture a half-written transaction.
sudo -u postgres pg_dump --format=custom "$DB" > "$dump" || { rm -f "$dump"; fail "pg_dump failed"; }
chmod 600 "$dump"

# A dump that cannot be read back is worse than none, because it looks like
# protection. Delete it rather than leave it in the directory.
pg_restore --list "$dump" >/dev/null 2>&1 || { rm -f "$dump"; fail "dump failed its check and was deleted"; }
size=$(stat -c %s "$dump")

# curl signs the S3 request itself, so nothing extra is installed on the server.
# The credentials go in through a config file on stdin, never the command line,
# where `ps` would show them.
r2() {
  printf 'user = "%s:%s"\n' "$BACKUP_R2_ACCESS_KEY_ID" "$BACKUP_R2_SECRET_ACCESS_KEY" \
    | curl -sS --max-time 600 -K - --aws-sigv4 "aws:amz:auto:s3" "$@"
}
url="https://$BACKUP_R2_ACCOUNT_ID.r2.cloudflarestorage.com/$BACKUP_R2_BUCKET/$object"

code=$(r2 -o /dev/null -w '%{http_code}' --upload-file "$dump" "$url")
[[ $code == 200 ]] || fail "upload of $object returned HTTP $code"

# Ask the bucket what it actually stored - an upload that returns 200 with a
# truncated body is the failure this catches.
remote_size=$(r2 -I "$url" | awk 'tolower($1) == "content-length:" { print $2 + 0 }')
[[ $remote_size == "$size" ]] || fail "$object is $size bytes locally but $remote_size in the bucket"

printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ) $object $size bytes" > "$STAMP_FILE"
echo "habre-cms-backup: uploaded $object ($size bytes)"

# Local copies are a convenience for a fast restore; the bucket is the backup.
find "$DUMP_DIR" -maxdepth 1 -name "$DB-*.dump" -mtime "+$KEEP_LOCAL_DAYS" -delete
