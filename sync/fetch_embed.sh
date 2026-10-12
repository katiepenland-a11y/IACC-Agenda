#!/usr/bin/env bash
# Download the embed's current files from conference-agenda.lanlan.site (public URLs).
# The day partials aren't served on their own, so they are cut out of the
# published embed page (sync/extract_partials.py checks they cut out cleanly).
#   sync/fetch_embed.sh WORK
set -euo pipefail
W="$1"; OUT="$W/live"; SITE="https://conference-agenda.lanlan.site"
mkdir -p "$OUT/js" "$OUT/data" "$OUT/_partials"
bust="nocache=$(date +%s)"
for f in embed js/agenda.js js/platform-skin.js js/speakers-data.js js/speakers-photos.js js/speakers-view.js js/speaker-bios.js \
         data/speaker-bios-1.json data/speaker-bios-2.json data/speaker-bios-3.json data/speaker-bios-4.json; do
  dest="$OUT/$f"; [ "$f" = embed ] && dest="$OUT/embed.html"
  curl -sSf --retry 3 -o "$dest" "$SITE/$f?$bust"
done
python3 -I "$(dirname "$0")/extract_partials.py" "$OUT"
