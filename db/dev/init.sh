#!/bin/sh
# Development only: runs once, when the Docker volume is first created.
# Mirrors production - the owner role owns the database and is not a superuser,
# so a migration needing superuser fails here first; the app connects as a
# second role (habre_cms_app) that owns nothing, made by db/roles.sql.
#
# roles.sql is found at $HABRE_ROLES_SQL. compose.yaml mounts it outside
# /docker-entrypoint-initdb.d on purpose: the postgres entrypoint would run any
# .sql in there against the wrong database and without the password variable.
# In CI this script runs from the checkout, so the default is the repo's file.
set -eu

ROLES_SQL="${HABRE_ROLES_SQL:-$(dirname "$0")/../roles.sql}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_password="$HABRE_DB_PASSWORD" <<'SQL'
CREATE ROLE habre_cms LOGIN PASSWORD :'app_password';
CREATE DATABASE habre_cms OWNER habre_cms;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname habre_cms \
  -v app_password="$HABRE_APP_DB_PASSWORD" -f "$ROLES_SQL"
