#!/usr/bin/env bash
# Read-only download of the agenda from iacc.conference.tc (the source of truth).
# Only GET requests are made; nothing on the platform is changed.
#   sync/fetch_platform.sh WORK      needs IACC_COOKIE (the _wfro login token)
# Exit 3 if the token is missing, expired or rejected.
set -euo pipefail
W="$1"; OUT="$W/platform"; mkdir -p "$OUT/events"
API="https://iacc.conference.tc/api/v2"
SCOPE="scope=session&scope_id=51823dde-5742-4115-8f32-b2a0b2b3a144"
[ -n "${IACC_COOKIE:-}" ] || { echo "IACC_COOKIE is not set" >&2; exit 3; }

get() {  # get URL FILE
  local code
  for attempt in 1 2 3; do
    code=$(curl -sS -X GET -o "$2" -w '%{http_code}' -H "Cookie: _wfro=$IACC_COOKIE" -H "Accept: application/json" "$1" || echo 000)
    case "$code" in
      200) return 0 ;;
      401|403) echo "platform refused the login token (HTTP $code) for $1 — IACC_COOKIE needs renewing" >&2; exit 3 ;;
    esac
    sleep $((attempt * 3))
  done
  echo "could not fetch $1 (HTTP $code)" >&2; exit 4
}

get "$API/events/agenda?$SCOPE" "$OUT/agenda.json"
get "$API/event-speakers?$SCOPE" "$OUT/speakers.json"
python3 -I -c 'import json,sys; [print(e["id"]) for e in json.load(open(sys.argv[1]))]' "$OUT/agenda.json" > "$OUT/ids.txt"
while read -r id; do get "$API/events/$id?$SCOPE" "$OUT/events/$id.json"; done < "$OUT/ids.txt"
echo "platform: $(wc -l < "$OUT/ids.txt") sessions fetched"
