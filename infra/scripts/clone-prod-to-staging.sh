#!/bin/sh
# Refill staging's database from production, with the people taken out.
#
#   ./clone-prod-to-staging.sh
#
# Everything staging holds is replaced. Nothing in production is written to:
# the only thing done there is a read-only dump.
#
# Until production exists, this exits saying so — staging starts on an empty
# schema plus the seed instead, which is the correct answer, not a failure.
set -eu
. "$(dirname "$0")/env.sh"

PROD_DIR=${PROD_DIR:-/opt/pokerstudio/prod}
STAGING_DIR=${STAGING_DIR:-/opt/pokerstudio/staging}
SQL="$(dirname "$0")/anonymise-staging.sql"
STAMP=$(date +%Y-%m-%d_%H%M)

prod_compose() {
  ( cd "$PROD_DIR" && docker compose -p pokerstudio-prod -f docker-compose.yml -f docker-compose.prod.yml "$@" )
}
staging_compose() {
  ( cd "$STAGING_DIR" && docker compose -p pokerstudio-staging -f docker-compose.yml -f docker-compose.staging.yml "$@" )
}

if [ ! -f "$PROD_DIR/docker-compose.yml" ] || ! prod_compose ps --status running postgres | grep -q postgres; then
  echo "production is not running on this host — nothing to clone." >&2
  echo "Staging keeps the schema its migrations built; seed it instead." >&2
  exit 0
fi

DUMP="$STAGING_DIR/backups/prod_for_staging_$STAMP.sql.gz"
mkdir -p "$STAGING_DIR/backups"

echo "1/4  dumping production (read-only)…"
prod_compose exec -T postgres pg_dump -U pokerstudio --clean --if-exists pokerstudio | gzip > "$DUMP"
gzip -t "$DUMP"

echo "2/4  restoring into staging…"
gunzip -c "$DUMP" | staging_compose exec -T postgres psql -v ON_ERROR_STOP=1 -U pokerstudio -d pokerstudio >/dev/null

echo "3/4  marking this database as a staging copy…"
staging_compose exec -T postgres psql -v ON_ERROR_STOP=1 -U pokerstudio -d pokerstudio -c \
  "CREATE TABLE IF NOT EXISTS _staging_marker (cloned_at timestamptz NOT NULL DEFAULT now());
   INSERT INTO _staging_marker DEFAULT VALUES;" >/dev/null

echo "4/4  anonymising…"
staging_compose exec -T postgres psql -v ON_ERROR_STOP=1 -U pokerstudio -d pokerstudio < "$SQL" >/dev/null

# The copy exists only to fill staging. Leaving real production data lying
# around in a file is the leak this whole script is trying to avoid.
rm -f "$DUMP"

echo
echo "staging now holds an anonymised copy of production."
echo "Every session, token and device was destroyed: sign in with a new account,"
echo "or promote one with ADMIN_EMAILS in $STAGING_DIR/.env."
