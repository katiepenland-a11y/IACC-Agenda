# GDHF daily agenda sync — runbook

Followed by the scheduled Claude session every day. It keeps the agenda on
https://www.gdhf.digital/agenda-2026 (Lanlan site `9e98e5f0-dbc8-486c-b8e4-5d638b998b33`,
"gdhf-digital") in line with the GDHF participant platform
https://gdhf.conference.tc/t/gdhf-2026/events/agenda, which is the source of truth.

What the website shows, from the platform:
- every session that is **not invite-only** (invite-only / restricted sessions stay off the website);
- title, day and time (Bangkok), session type, track, mode (in person / virtual / hybrid), short description;
- speakers in the platform's order with affiliation and bio, and a photo (the site's own photo
  where it has one, otherwise the platform's). The speakers page (/speakers-2026) follows the agenda
  data on its own.

**Hard rules**

- Never change anything on gdhf.conference.tc. The scripts only send GET requests.
- On Lanlan, only touch site `9e98e5f0-dbc8-486c-b8e4-5d638b998b33`, and only the files in
  `plan.json`. Don't change site settings, other pages or other sites (never the IACC
  `conference-agenda` site).
- Always take the backup (step 3) before any change. If the backup can't be saved and pushed, stop
  without changing the site.
- Don't print the `GDHF_COOKIE` value.
- Scheduled runs never pass `--allow-many` or `--migrate-app`.

## Steps

All commands run from the repo root on branch `claude/sleepy-ramanujan-8rwdfs`
(`git fetch origin claude/sleepy-ramanujan-8rwdfs && git checkout claude/sleepy-ramanujan-8rwdfs && git pull origin claude/sleepy-ramanujan-8rwdfs`).
Use a fresh work directory, e.g. `WORK=$(mktemp -d)`.

1. **Fetch the platform (read-only):** `gdhf/fetch_platform.sh "$WORK"`
   - Exit 3: the login token (`GDHF_COOKIE`, the `_wfro` cookie for gdhf.conference.tc) was refused
     or is missing. Stop. Report that the token needs renewing; nothing was changed.
   - Exit 4: network trouble. Stop and report it; nothing was changed.
2. **Fetch the website:** `gdhf/fetch_site.sh "$WORK"`
3. **Backup (every run, before anything else changes):**
   - Lanlan `list_snapshots` (site above, `limit: 1`) → the current deployment id.
   - `gdhf/backup.sh "$WORK" <deployment id>` → prints the backup folder.
   - `git add gdhf/backups && git commit -m "GDHF: backup before agenda sync <folder name>"` and
     `git push -u origin claude/sleepy-ramanujan-8rwdfs` (retry up to 4 times on network errors,
     waiting 2, 4, 8, 16 s). If it can't be pushed, stop and report it.
4. **Work out the changes:** `python3 -I gdhf/build.py "$WORK"`
   - Exit 0: nothing to change. Go to step 7.
   - Exit 2: refused because the platform data looks wrong (`$WORK/report.md` says why). Change
     nothing; go to step 7 and report it. Only when a person has checked the platform and approved
     it, re-run with `--allow-many`.
   - Exit 10: changes are in `$WORK/plan.json`. Continue.
5. **Apply:** for each entry in `plan.json`, in order:
   - `"method": "patch"` → Lanlan `patch_file` with the site id above, `path`, and its `patches`
     exactly as written, in order. Send them in consecutive batches of at most 40 patches and about
     30,000 characters per call (a single bigger patch goes on its own).
   - `"method": "replace"` → Lanlan `update_file` with `path` and the full text of `content_file`.
     If that file is over 60,000 bytes, don't send it: stop, restore (below) if anything was already
     changed, and report that a person needs to look.
   - The last call for each file returns `deployed_sha256`; it must equal that file's value in
     `$WORK/expected_sha256.json`.
   - If a checksum doesn't match or a patch fails: run steps 2 and 4 again in a new work directory
     (copy `$WORK/platform` across) and apply that plan once.
   - If it still fails: Lanlan `restore_snapshot` with the deployment id saved in step 3
     (`confirm: true`), check the site is back, and report the failure.
6. **Verify:** in a new work directory, copy `$WORK/platform` across, run `gdhf/fetch_site.sh` and
   `python3 -I gdhf/build.py` again. It must exit 0 ("No differences"). If it doesn't, handle it as
   in step 5's retry/rollback rule.
7. **Record and report:** copy `$WORK/report.md` to `<backup folder>/REPORT.md`, `git add gdhf`
   (this includes `gdhf/id-map.json`), commit ("GDHF: agenda sync report <folder name>") and push.
   Finish with a short summary for the conference team: what changed on the website (or "no
   changes"), the backup folder, and anything that needs a person — token renewal, a refusal,
   hand-made overrides found in js/agenda-2026-app.js, a rollback.

## Reverting to an earlier version

Every run leaves `gdhf/backups/<date>_<time>-ET/` with the agenda files as they were before that run
and `MANIFEST.json`.

- **Quickest:** Lanlan `restore_snapshot` with `lanlan_deployment_id_to_restore` from that folder's
  `MANIFEST.json` (Lanlan keeps the last 20 deploys; other pages edited since then are rolled back too).
- **If that deploy is no longer kept, or other pages changed since:** put back only the agenda files
  from the backup with Lanlan `patch_file`/`update_file` (`js/agenda-2026.js`, `js/agenda-2026-app.js`,
  `js/agenda-photos.js`, `js/agenda-bios-*.js`).

## Notes

- `gdhf/id-map.json` ties each platform session to the id the website uses, so visitors' saved
  sessions survive renames and time changes. Don't edit it by hand.
- Bios: the full bios live in `js/agenda-bios-*.js`; a speaker's entry in `js/agenda-2026.js` may hold
  a shortened copy. The sync only writes a bio when the platform's says something different, and
  keeps the website's bio when the platform has none yet.
- `GDHF_COOKIE` expires about 30 days after it was issued; runs then stop with exit 3 and a fresh value
  has to be set in the environment's settings.
