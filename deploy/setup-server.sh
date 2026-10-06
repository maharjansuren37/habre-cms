#!/usr/bin/env bash
# Prepares a fresh or existing Ubuntu 24.04 server for Habre CMS (D9, D14).
# Safe to run again: each step checks before it acts.
#
# Run from a local checkout (the server has no git; it has rsync):
#   rsync -a --delete deploy/ ocwebserver:/tmp/habre-deploy/
#   rsync -a db/roles.sql ocwebserver:/tmp/habre-deploy/roles.sql   # after the line above, which deletes it
#   ssh ocwebserver 'sudo bash /tmp/habre-deploy/setup-server.sh'
#
# It never replaces the main Caddyfile and never reconfigures a PostgreSQL it did
# not install (plan section 8). Generated secrets are written straight to the
# environment file and never printed.
set -euo pipefail

NODE_VERSION="26.8.2"
# From https://nodejs.org/dist/v26.8.2/SHASUMS256.txt, pinned here so a changed
# download fails instead of installing.
NODE_SHA256="40e1d3225c1c9ae9a2671c98ecb9857e4d5555026394f348645676798840d5c5"

APP_USER="habre_cms"
DB_NAME="habre_cms"
# The role the web app connects as; $APP_USER above owns the database.
APP_ROLE="habre_cms_app"
# Set only when this run generates a new env file.
NEW_APP_PASSWORD=""
APP_DIR="/srv/habre-cms"
CONFIG_DIR="/etc/habre-cms"
ENV_FILE="$CONFIG_DIR/production.env"
# Root-only, and deliberately not the app's file: the app never reads these.
BACKUP_ENV_FILE="$CONFIG_DIR/backup.env"
CADDYFILE="/etc/caddy/Caddyfile"
CADDY_SITE="/etc/caddy/sites/habre-cms.caddy"
# The platform's access log and the sites' (deploy/caddy/habre-cms.caddy).
CADDY_LOGS=(/var/log/caddy/habre-cms-access.log /var/log/caddy/habre-cms-public-access.log)
# Caddy's own environment for the site file: the two domains and the Cloudflare
# token. Root-only; the owner fills it in. Loaded by the drop-in below.
CADDY_ENV_FILE="/etc/caddy/habre-cms.env"
CADDY_DROPIN="/etc/systemd/system/caddy.service.d/habre-cms.conf"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { printf '==> %s\n' "$*"; }
fail() { printf 'setup-server: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "run as root (sudo bash $0)"
. /etc/os-release
[[ "$ID" == "ubuntu" && "$VERSION_ID" == "24.04" ]] || fail "expected Ubuntu 24.04, found $PRETTY_NAME"
[[ "$(uname -m)" == "x86_64" ]] || fail "expected x86_64, found $(uname -m)"

install_node() {
  local target="/opt/node-v$NODE_VERSION-linux-x64"
  if [[ -x "$target/bin/node" ]]; then
    log "Node $NODE_VERSION already installed"
  else
    log "Installing Node $NODE_VERSION"
    local download
    download="$(mktemp -d)"
    curl -fsSL -o "$download/node.tar.xz" \
      "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
    echo "$NODE_SHA256  $download/node.tar.xz" | sha256sum --check --quiet \
      || fail "Node download does not match the pinned checksum"
    tar -xJf "$download/node.tar.xz" -C /opt
    rm -rf "$download"
  fi
  # Node's official Linux build links against libatomic, which minimized Ubuntu
  # images (Oracle's included) leave out.
  if ! dpkg-query -W -f='${Status}' libatomic1 2>/dev/null | grep -q "install ok installed"; then
    log "Installing libatomic1 for Node"
    apt-get update -q
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q libatomic1
  fi
  for tool in node npm npx; do
    ln -sfn "$target/bin/$tool" "/usr/local/bin/$tool"
  done
  /usr/local/bin/node --version >/dev/null || fail "Node $NODE_VERSION is installed but does not run"
}

install_postgres() {
  if dpkg-query -W -f='${Status}' postgresql-16 2>/dev/null | grep -q "install ok installed"; then
    log "PostgreSQL 16 already installed - leaving its configuration alone"
    return
  fi
  log "Installing PostgreSQL 16"
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q postgresql-16
  # Sized for a 1 GB server shared with other sites (plan section 8, memory budget).
  # Ubuntu's defaults already listen on localhost only.
  cat > /etc/postgresql/16/main/conf.d/habre-cms.conf <<'CONF'
shared_buffers = 128MB
max_connections = 20
CONF
  systemctl restart postgresql
}

create_app_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "User $APP_USER exists"
  else
    log "Creating system user $APP_USER"
    useradd --system --home-dir "$APP_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
  fi
  install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$APP_DIR" "$APP_DIR/releases"
}

role_exists() {
  sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = '${1:-$APP_USER}'" | grep -q 1
}

# The app role (D152): db/roles.sql, copied beside this script (see the header),
# is the one definition of it. The password reaches psql through stdin as a
# \set line, so it never appears in the process list. Needs the database to exist.
run_roles_sql() {
  local password="$1"
  [[ -f "$DEPLOY_DIR/roles.sql" ]] || fail "$DEPLOY_DIR/roles.sql is missing; copy db/roles.sql beside this script (see the header)"
  { printf "\\set app_password '%s'\n" "$password"; cat "$DEPLOY_DIR/roles.sql"; } \
    | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME"
}

# The database password exists only in the environment file, so both are created
# together: a new file always comes with a matching password.
create_database_and_env_file() {
  install -d -m 750 -o root -g "$APP_USER" "$CONFIG_DIR"

  if [[ -f "$ENV_FILE" ]]; then
    log "$ENV_FILE exists - keeping its secrets"
    role_exists || fail "$ENV_FILE exists but the $APP_USER database role does not; restore the role or move the file aside and rerun"
  else
    log "Generating database password and JWT_SECRET into $ENV_FILE"
    local db_password jwt_secret
    db_password="$(openssl rand -hex 32)"
    NEW_APP_PASSWORD="$(openssl rand -hex 32)"
    jwt_secret="$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')"
    # printf is a shell builtin, so the password never appears in the process list.
    if role_exists; then
      printf "alter role %s with login password '%s';\n" "$APP_USER" "$db_password" \
        | sudo -u postgres psql -q -v ON_ERROR_STOP=1
    else
      printf "create role %s with login password '%s';\n" "$APP_USER" "$db_password" \
        | sudo -u postgres psql -q -v ON_ERROR_STOP=1
    fi
    (
      umask 077
      printf '%s\n' \
        "# Habre CMS production secrets. Generated by deploy/setup-server.sh; never commit." \
        "# The app connects as habre_cms_app, which owns nothing; migrations run as the owner." \
        "DATABASE_URL=postgres://$APP_ROLE:$NEW_APP_PASSWORD@127.0.0.1:5432/$DB_NAME" \
        "DATABASE_OWNER_URL=postgres://$APP_USER:$db_password@127.0.0.1:5432/$DB_NAME" \
        "JWT_SECRET=$jwt_secret" \
        "# Item 16a - the platform and sites origins. Fill in once the domains exist:" \
        "# PLATFORM_URL=" "# SITES_URL=" \
        "# Item 5 - images. Fill in once the R2 bucket and token exist:" \
        "# R2_ACCOUNT_ID=" "# R2_ACCESS_KEY_ID=" "# R2_SECRET_ACCESS_KEY=" \
        "# R2_BUCKET=" "# R2_PUBLIC_URL=" > "$ENV_FILE"
    )
  fi
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  if sudo -u postgres psql -tAc "select 1 from pg_database where datname = '$DB_NAME'" | grep -q 1; then
    log "Database $DB_NAME exists"
  else
    log "Creating database $DB_NAME owned by $APP_USER"
    sudo -u postgres psql -q -v ON_ERROR_STOP=1 \
      -c "create database $DB_NAME owner $APP_USER" \
      -c "revoke all on database $DB_NAME from public"
  fi

  if [[ -n "$NEW_APP_PASSWORD" ]]; then
    # A new env file means a new password; roles.sql only sets one when it
    # creates the role, so set it here too if the role was already there.
    if role_exists "$APP_ROLE"; then
      printf "alter role %s with password '%s';\n" "$APP_ROLE" "$NEW_APP_PASSWORD" \
        | sudo -u postgres psql -q -v ON_ERROR_STOP=1
    fi
    log "Creating database role $APP_ROLE"
    run_roles_sql "$NEW_APP_PASSWORD"
  elif role_exists "$APP_ROLE"; then
    log "Role $APP_ROLE exists - refreshing its grants"
    # The password is only used when the role is absent, so this one is unused.
    run_roles_sql "$(openssl rand -hex 32)"
  else
    # An existing server: its env file has DATABASE_URL for the owner. Secrets
    # in it are never overwritten here, so this one-time change is by hand.
    log "NOTE: $ENV_FILE predates the $APP_ROLE role. By hand, once: run db/roles.sql as postgres"
    log "      with a new password, set DATABASE_OWNER_URL to today's DATABASE_URL, then point"
    log "      DATABASE_URL at $APP_ROLE (item 15a, Production needs). Nothing was changed."
  fi
}

install_service() {
  log "Installing systemd unit"
  install -m 644 "$DEPLOY_DIR/habre-cms.service" /etc/systemd/system/habre-cms.service
  systemctl daemon-reload
  systemctl enable --quiet habre-cms.service
  # A release is put in place by `deploy`; until then there is nothing to start.
  if [[ -e "$APP_DIR/current/server.js" ]]; then
    systemctl restart habre-cms.service
  else
    log "No release in $APP_DIR/current yet - service enabled, not started"
  fi
}

# Prints what Caddy's environment lacks for the site file and returns non-zero
# if anything is: the Cloudflare DNS module, either domain, or the token. Takes
# the env file and the output of `caddy list-modules`, so it runs anywhere.
# Never prints a value.
check_caddy_env() {
  local env_file=$1 modules=$2 missing=0 name value
  if ! grep -qE '^dns\.providers\.cloudflare( |$)' <<<"$modules"; then
    printf 'setup-server: Caddy lacks the dns.providers.cloudflare module. Add it with: caddy add-package github.com/caddy-dns/cloudflare\n' >&2
    missing=1
  fi
  if [[ ! -r $env_file ]]; then
    printf 'setup-server: %s is missing.\n' "$env_file" >&2
    return 1
  fi
  for name in HABRE_PLATFORM_DOMAIN HABRE_SITES_DOMAIN CLOUDFLARE_API_TOKEN; do
    value=$(sed -n "s/^${name}=//p" "$env_file" | tail -n 1)
    value=${value//[\"\' ]/}
    if [[ -z $value ]]; then
      printf 'setup-server: %s is empty in %s.\n' "$name" "$env_file" >&2
      missing=1
    fi
  done
  return "$missing"
}

install_caddy_site() {
  command -v caddy >/dev/null || fail "Caddy is not installed"

  # Created once, never overwritten: the values are the owner's.
  if [[ ! -e $CADDY_ENV_FILE ]]; then
    install -m 600 -o root -g root /dev/null "$CADDY_ENV_FILE"
    cat > "$CADDY_ENV_FILE" <<'ENV'
# Caddy's environment for Habre (deploy/caddy/habre-cms.caddy). Fill in, then
# run setup-server.sh again. The domains must agree with PLATFORM_URL
# (https://app.<platform domain>) and SITES_URL (https://<sites domain>) in
# /etc/habre-cms/production.env.
HABRE_PLATFORM_DOMAIN=
HABRE_SITES_DOMAIN=
# DNS edit on the sites domain's zone only, for the wildcard certificate.
CLOUDFLARE_API_TOKEN=
ENV
    log "Created $CADDY_ENV_FILE - fill it in"
  fi

  # The token is read by the running Caddy, so a new drop-in or a changed env
  # file needs a restart; a reload keeps the old process and its environment.
  local restart=false
  if ! cmp -s "$DEPLOY_DIR/caddy/caddy-habre-cms.conf" "$CADDY_DROPIN"; then
    log "Installing the caddy.service drop-in"
    install -d -m 755 "$(dirname "$CADDY_DROPIN")"
    install -m 644 "$DEPLOY_DIR/caddy/caddy-habre-cms.conf" "$CADDY_DROPIN"
    systemctl daemon-reload
    restart=true
  fi
  local started
  started=$(systemctl show -p ActiveEnterTimestamp --value caddy)
  if [[ -z $started ]] || (( $(stat -c %Y "$CADDY_ENV_FILE") > $(date -d "$started" +%s) )); then
    restart=true
  fi

  check_caddy_env "$CADDY_ENV_FILE" "$(caddy list-modules)" \
    || fail "Caddy is not ready for the site file; nothing installed. See needs-you.md (Caddy with the Cloudflare DNS module)."

  log "Installing Caddy site file"
  install -d -m 755 "$(dirname "$CADDY_SITE")"
  install -m 644 "$DEPLOY_DIR/caddy/habre-cms.caddy" "$CADDY_SITE"
  # Caddy runs as the caddy user and cannot open a log file owned by root -
  # which is what `sudo caddy validate` leaves behind if it gets there first,
  # and the reload then fails with "permission denied" while the old config
  # keeps serving. Create them correctly before either happens.
  local caddy_log
  for caddy_log in "${CADDY_LOGS[@]}"; do
    if [[ ! -e $caddy_log ]]; then
      install -m 640 -o caddy -g caddy /dev/null "$caddy_log"
    else
      chown caddy:caddy "$caddy_log"
    fi
  done

  local import_line="import $CADDY_SITE"
  if ! grep -qxF "$import_line" "$CADDYFILE"; then
    local backup
    backup="$CADDYFILE.bak-habre-cms-$(date +%Y%m%d%H%M%S)"
    cp -p "$CADDYFILE" "$backup"
    printf '\n%s\n' "$import_line" >> "$CADDYFILE"
    log "Added import line to $CADDYFILE (backup: $backup)"
    if ! caddy validate --config "$CADDYFILE" --adapter caddyfile --envfile "$CADDY_ENV_FILE" >/dev/null 2>&1; then
      cp -p "$backup" "$CADDYFILE"
      fail "Caddy rejected the new config; $CADDYFILE restored from $backup. Check with: caddy validate --config $CADDYFILE --envfile $CADDY_ENV_FILE"
    fi
  fi
  caddy validate --config "$CADDYFILE" --adapter caddyfile --envfile "$CADDY_ENV_FILE" >/dev/null 2>&1 \
    || fail "Caddy config does not validate; not reloading. Check with: caddy validate --config $CADDYFILE --envfile $CADDY_ENV_FILE"
  if [[ $restart == true ]]; then
    log "Restarting Caddy: its environment changed"
    systemctl restart caddy
  else
    systemctl reload caddy
  fi
}

install_backup() {
  log "Installing the backup script and timer"
  install -m 700 "$DEPLOY_DIR/backup-db.sh" /usr/local/sbin/habre-cms-backup
  install -m 644 "$DEPLOY_DIR/habre-cms-backup.service" /etc/systemd/system/habre-cms-backup.service
  install -m 644 "$DEPLOY_DIR/habre-cms-backup.timer" /etc/systemd/system/habre-cms-backup.timer
  systemctl daemon-reload
  # The credentials are the owner's to add; enabling a timer that cannot work
  # would report a nightly failure nobody asked for.
  if [[ -s "$BACKUP_ENV_FILE" ]]; then
    systemctl enable --quiet --now habre-cms-backup.timer
  else
    log "No $BACKUP_ENV_FILE yet - backup timer installed, not enabled"
  fi
}

install_node
install_postgres
create_app_user
create_database_and_env_file
install_service
install_caddy_site
install_backup
log "Done. Next: deploy a release to $APP_DIR/current, then run migrations and create-admin."
