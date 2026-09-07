#!/bin/sh
# Restore a dump:  ./restore.sh backups/pokerstudio_2026-09-07_0300.sql.gz
set -eu
FILE="$1"
COMPOSE="$(dirname "$0")/../docker/docker-compose.yml"
gunzip -c "$FILE" | docker compose -f "$COMPOSE" exec -T postgres psql -U pokerstudio -d pokerstudio
echo "restored from $FILE"
