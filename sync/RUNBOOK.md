# Weekday agenda sync — runbook

Followed by the scheduled Claude session every weekday at 4 PM US Eastern. It keeps
the Lanlan agenda embed (https://conference-agenda.lanlan.site/embed) in line with the
IACC participant platform (https://iacc.conference.tc/t/2026/events/agenda), which is
the source of truth.

**Hard rules**

- Never change anything on iacc.conference.tc. The scripts only send GET requests.
- On Lanlan, only touch site `df74876f-a0c7-420c-a245-174ec9cde521` (conference-agenda),
  and only the files listed in `patches.json`. Don't change site settings or publishing mode.
- Always take the backup (step 3) before any change. If the backup can't be saved and
  pushed, stop without changing the site.
- Don't print the `IACC_COOKIE` value.

## Steps

All commands run from the repo root on branch `claude/charming-hypatia-gnpsl5`
(`git fetch origin claude/charming-hypatia-gnpsl5 && git checkout claude/charming-hypatia-gnpsl5 && git pull origin claude/charming-hypatia-gnpsl5`).
Use a fresh work directory, e.g. `WORK=$(mktemp -d)`.

1. **Fetch the platform (read-only):** `sync/fetch_platform.sh "$WORK"`
   - Exit 3: the login token (`IACC_COOKIE`, the `_wfro` cookie) was refused or is
     missing. Stop. Report that the token needs renewing; nothing was changed.
   - Exit 4: network trouble. Stop and report it; nothing was changed.
2. **Fetch the embed:** `sync/fetch_embed.sh "$WORK"`
3. **Backup (every run, before anything else changes):**
   - Lanlan `list_snapshots` (site above, `limit: 1`) → the current deployment id.
   - `sync/backup.sh "$WORK" <deployment id>` → prints the backup folder.
   - `git add backups && git commit -m "Backup before agenda sync <folder name>"` and
     `git push -u origin claude/charming-hypatia-gnpsl5` (retry up to 4 times on network
     errors, waiting 2, 4, 8, 16 s). If it can't be pushed, stop and report it.
4. **Work out the changes:** `python3 -I sync/sync.py "$WORK"`
   - Exit 0: nothing to change. Go to step 7.
   - Exit 2: refused because the platform data looks wrong (`$WORK/report.md` says why).
     Change nothing; go to step 7 and report it.
   - Exit 10: changes are in `$WORK/patches.json`. Continue.
5. **Apply:** for each file in `patches.json`, in the order listed, call Lanlan
   `patch_file` with `site_id` above, `path` = the file, and its `patches` exactly as
   written (send at most 40 patches per call, in order). The last call for a file
   returns `deployed_sha256`; it must equal that file's value in
   `$WORK/expected_sha256.json`.
   - If a file's checksum doesn't match, or a patch fails: run steps 2 and 4 again in a
     new work directory (fresh edits against what is live now) and apply those once.
   - If it still fails: `restore_snapshot` with the deployment id saved in step 3
     (`confirm: true`), check the site is back, and report the failure.
6. **Verify:** in a new work directory, run `sync/fetch_embed.sh` and `sync/sync.py`
   again (reuse the platform files: copy `$WORK/platform` across first). It must exit 0
   ("No differences"). If it doesn't, handle it as in step 5's retry/rollback rule.
7. **Record and report:** copy `$WORK/report.md` to `<backup folder>/REPORT.md`, commit
   ("Agenda sync report <folder name>") and push. Finish with a short summary: what
   changed (or "no changes"), the backup folder, and anything that needs a person —
   token renewal, a refusal, a rollback.

## Reverting to an earlier version

Every run leaves `backups/<date>_<time>-ET/` with the files as they were before that
run and `MANIFEST.json`.

- **Quickest:** Lanlan `restore_snapshot` with `lanlan_deployment_id_to_restore` from
  that folder's `MANIFEST.json` (Lanlan keeps the last 20 deploys).
- **If that deploy is no longer kept:** upload the backup's files with Lanlan
  `update_file`, one per path: `_partials/agenda-day-1.html` … `-4.html`, `js/*.js`
  and `data/*.json`. (`embed.html` in the backup is the published page for reference;
  the site's own `embed.html` is a template and shouldn't be overwritten with it.)
