# GDHF 2026 agenda pull

Pulls every session of GDHF 2026 (https://gdhf.conference.tc/t/gdhf-2026/events/agenda)
with its title, description, date, start/end time, tags (room, session type, mode, track)
and speakers (name, affiliation, bio, photo). Read-only: only GET requests are sent.

| File | What it does |
|---|---|
| `fetch_gdhf.sh` | Downloads sessions, speakers, tags and session pages (needs `GDHF_COOKIE`). |
| `build_gdhf.py` | Turns the download into `gdhf-agenda.json` and a `coverage.md` check. |

```sh
WORK=$(mktemp -d)
gdhf/fetch_gdhf.sh "$WORK" && python3 -I gdhf/build_gdhf.py "$WORK"
```

`GDHF_COOKIE` is the value of the `_wfro` cookie set when you're logged in to
gdhf.conference.tc. It's set in the cloud environment's settings, never committed. It
expires about 30 days after it's issued; when it does, `fetch_gdhf.sh` exits 3 and says so.
