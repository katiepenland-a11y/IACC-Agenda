#!/usr/bin/env bash
# Download the agenda's current files from www.gdhf.digital (public URLs, cache-busted).
#   gdhf/fetch_site.sh WORK
set -euo pipefail
W="$1"; OUT="$W/live"; SITE="https://www.gdhf.digital"
mkdir -p "$OUT/js"
bust="nocache=$(date +%s)"
curl -sSf --retry 3 -o "$OUT/agenda-2026.html" "$SITE/agenda-2026?$bust"
for f in js/agenda-2026.js js/agenda-2026-app.js js/agenda-photos.js; do
  curl -sSf --retry 3 -o "$OUT/$f" "$SITE/$f?$bust"
done
# the bio files the agenda page loads
for f in $(grep -oE 'src="/js/agenda-bios-[0-9]+\.js' "$OUT/agenda-2026.html" | sed 's|src="/||'); do
  curl -sSf --retry 3 -o "$OUT/$f" "$SITE/$f?$bust"
done
echo "site: files fetched ($(ls "$OUT/js" | wc -l) scripts)"
