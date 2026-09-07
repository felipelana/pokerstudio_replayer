#!/bin/sh
# Daily dump kept for 14 days. Add to cron:
#   0 3 * * * /srv/pokerstudio/infra/scripts/backup.sh >> /var/log/pokerstudio-backup.log 2>&1
set -eu
DIR="$(dirname "$0")/../docker/backups"
mkdir -p "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
docker compose -f "$(dirname "$0")/../docker/docker-compose.yml" exec -T postgres \
  pg_dump -U pokerstudio pokerstudio | gzip > "$DIR/pokerstudio_$STAMP.sql.gz"
find "$DIR" -name 'pokerstudio_*.sql.gz' -mtime +14 -delete
echo "backup written: $DIR/pokerstudio_$STAMP.sql.gz"
