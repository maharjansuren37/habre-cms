#!/bin/sh
# Development only: runs once, when the Docker volume is first created.
# Mirrors production - the app connects as a role that owns its database and is
# not a superuser, so a migration needing superuser fails here first.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_password="$HABRE_DB_PASSWORD" <<'SQL'
CREATE ROLE habre_cms LOGIN PASSWORD :'app_password';
CREATE DATABASE habre_cms OWNER habre_cms;
SQL
