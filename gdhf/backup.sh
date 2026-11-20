#!/usr/bin/env bash
# Save a copy of the agenda's current live files before an update.
#   gdhf/backup.sh WORK LANLAN_DEPLOYMENT_ID
# Creates gdhf/backups/<date>_<time>-ET/ with the files (same paths as on the site) and
# MANIFEST.json (Lanlan deployment id to restore, sha256 of every file).
set -euo pipefail
W="$1"; DEPLOY="$2"
ROOT="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(TZ=America/New_York date +%Y-%m-%d_%H%M)-ET"
DEST="$ROOT/backups/$STAMP"; mkdir -p "$DEST"
(cd "$W/live" && cp -r --parents js "$DEST/")
python3 -I - "$DEST" "$DEPLOY" "$STAMP" <<'PY'
import hashlib, json, os, sys
dest, deploy, stamp = sys.argv[1:4]
files = {}
for root, _, names in os.walk(dest):
    for n in sorted(names):
        p = os.path.join(root, n); rel = os.path.relpath(p, dest)
        files[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()
json.dump({"taken": stamp, "site": "https://www.gdhf.digital/agenda-2026",
           "lanlan_site_id": "9e98e5f0-dbc8-486c-b8e4-5d638b998b33",
           "lanlan_deployment_id_to_restore": deploy, "files": files},
          open(os.path.join(dest, "MANIFEST.json"), "w"), indent=1)
PY
echo "$DEST"
