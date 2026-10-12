# IACC 2026 agenda embed sync

Keeps the agenda embed at https://conference-agenda.lanlan.site/embed matching the
IACC participant platform at https://iacc.conference.tc/t/2026/events/agenda (the
source of truth). A scheduled Claude session runs it every weekday at 4 PM US Eastern;
the steps it follows are in [`sync/RUNBOOK.md`](sync/RUNBOOK.md).

| File | What it does |
|---|---|
| `sync/fetch_platform.sh` | Downloads sessions, speakers and session details from the platform (read-only; needs `IACC_COOKIE`). |
| `sync/fetch_embed.sh` | Downloads the embed's current files from the Lanlan site. |
| `sync/sync.py` | Compares the two and writes the edits that bring the embed in line, plus a plain-language report. |
| `sync/backup.sh` | Saves the embed's current files to `backups/` before each run. |
| `backups/` | One folder per run: the files as they were before it, `MANIFEST.json` (Lanlan version to restore) and `REPORT.md`. |

Run a check by hand (changes nothing):

```sh
WORK=$(mktemp -d)
sync/fetch_platform.sh "$WORK" && sync/fetch_embed.sh "$WORK" && python3 -I sync/sync.py "$WORK"
```

`IACC_COOKIE` is the platform's `_wfro` login cookie. It expires about 30 days after it
was issued (the current one around 4 November 2026); when it does, runs stop and report
it, and a fresh value has to be set in the environment.
