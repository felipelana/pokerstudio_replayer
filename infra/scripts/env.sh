#!/bin/sh
# Shared by the scripts that talk to a running environment. Sourced, never run.
#
# Every environment is one compose project, one overlay and one directory. This
# is the single place that knows that, so a script only has to say "staging".
set -eu

ps_env_select() {
  PS_ENV="${1:-}"
  case "$PS_ENV" in
    staging)
      PS_PROJECT=pokerstudio-staging
      PS_OVERLAY=docker-compose.staging.yml
      PS_DIR=${PS_DIR:-/opt/pokerstudio/staging}
      ;;
    prod | production)
      PS_ENV=prod
      PS_PROJECT=pokerstudio-prod
      PS_OVERLAY=docker-compose.prod.yml
      PS_DIR=${PS_DIR:-/opt/pokerstudio/prod}
      ;;
    *)
      echo "usage: $0 <staging|prod> ..." >&2
      exit 2
      ;;
  esac

  if [ ! -f "$PS_DIR/docker-compose.yml" ]; then
    echo "no compose file in $PS_DIR — is this the right server?" >&2
    exit 1
  fi
}

# Runs docker compose against the selected environment.
ps_compose() {
  ( cd "$PS_DIR" && docker compose -p "$PS_PROJECT" -f docker-compose.yml -f "$PS_OVERLAY" "$@" )
}
