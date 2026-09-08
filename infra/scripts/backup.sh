#!/bin/sh
# A dump of one environment's database, kept for 14 days.
#
#   ./backup.sh prod
#
# In cron, on the server:
#   0 3 * * * /opt/pokerstudio/repo/infra/scripts/backup.sh prod >> /var/log/pokerstudio-backup.log 2>&1
set -eu
. "$(dirname "$0")/env.sh"
ps_env_select "${1:-}"

DIR="$PS_DIR/backups"
mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
FILE="$DIR/${PS_ENV}_$STAMP.sql.gz"

ps_compose exec -T postgres pg_dump -U pokerstudio pokerstudio | gzip > "$FILE"
find "$DIR" -name "${PS_ENV}_*.sql.gz" -mtime +14 -delete

# A dump that cannot be read back is not a backup.
gzip -t "$FILE"
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"
