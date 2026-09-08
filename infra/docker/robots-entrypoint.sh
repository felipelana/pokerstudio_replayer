#!/bin/sh
# A staging copy of the site must never be indexed. The production image ships
# the real robots.txt; this only rewrites it when the environment says staging.
set -e
if [ "${ROBOTS_POLICY}" = "noindex" ]; then
  printf 'User-agent: *\nDisallow: /\n' > /usr/share/nginx/html/robots.txt
  echo "robots.txt set to noindex (staging)"
fi
