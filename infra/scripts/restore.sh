#!/bin/sh
# Restore a dump over an environment's database. Everything it holds is lost.
#
#   ./restore.sh staging /opt/pokerstudio/staging/backups/prod_2026-09-07_0300.sql.gz
set -eu
. "$(dirname "$0")/env.sh"
ps_env_select "${1:-}"
FILE="${2:-}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "usage: $0 <staging|prod> <dump.sql.gz>" >&2; exit 2; }

# Production is not restored by habit. Saying so out loud is the whole guard.
if [ "$PS_ENV" = "prod" ] && [ "${PS_CONFIRM:-}" != "yes-restore-production" ]; then
  echo "refusing to overwrite production. Re-run with:" >&2
  echo "  PS_CONFIRM=yes-restore-production $0 prod $FILE" >&2
  exit 1
fi

echo "restoring $FILE into $PS_ENV…"
gunzip -c "$FILE" | ps_compose exec -T postgres psql -v ON_ERROR_STOP=1 -U pokerstudio -d pokerstudio
echo "restored from $FILE"
