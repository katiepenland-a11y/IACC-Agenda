"""Bring the GDHF 2026 agenda on www.gdhf.digital/agenda-2026 in line with the participant
platform gdhf.conference.tc (the source of truth).

    python3 -I gdhf/build.py WORK [--allow-many] [--migrate-app]

Reads   WORK/platform/  (gdhf/fetch_platform.sh)  agenda, speakers, topics, events/<id>.json
        WORK/live/      (gdhf/fetch_site.sh)      the site's current agenda files
        gdhf/id-map.json  platform event id -> the session id the website uses (kept stable so
                          visitors' saved sessions survive)
Writes  WORK/out/js/...            the updated files
        WORK/plan.json             [{path, method: "patch"|"replace", patches|content_file}] in apply order
        WORK/expected_sha256.json  {site path: sha256 of the updated file}
        WORK/report.md             what changes, in plain words
        gdhf/id-map.json           updated with any new sessions

What the website shows is generated from the platform:
  - every session that is NOT invite-only (restricted) on the platform, with its title, day and
    time (Bangkok), session type, track, mode, short description and speakers
  - each speaker's name, affiliation and full bio, in the platform's order
  - a photo for every speaker: the site's own photo where it has one, otherwise the platform's
Mode: "Virtual" + "In-person" topics -> Hybrid Livestream; "Virtual" only -> Virtual; otherwise In-person.
A speaker's bio stays as the site has it while it says the same as the platform; when the platform's
bio differs, the full platform bio is written to the speaker. If the platform has no bio, the site's is kept.

Exit 0: nothing to change. Exit 10: changes ready (plan.json). Exit 2: refused, the platform
data looks wrong (e.g. many sessions vanished) - needs a person; --allow-many overrides once
a person has checked. --migrate-app: one-time removal of the hand-maintained override layer in
js/agenda-2026-app.js (scheduled runs never pass it).
"""
import datetime, difflib, glob, hashlib, json, os, re, sys, unicodedata

W = sys.argv[1]
ALLOW_MANY = "--allow-many" in sys.argv[2:]
MIGRATE_APP = "--migrate-app" in sys.argv[2:]
HERE = os.path.dirname(os.path.abspath(__file__))
PLAT, LIVE, OUT = f"{W}/platform", f"{W}/live", f"{W}/out"
IDMAP_PATH = f"{HERE}/id-map.json"
BKK = datetime.timedelta(hours=7)  # Asia/Bangkok, no daylight saving
AGENDA_JS, APP_JS, PHOTOS_JS = "js/agenda-2026.js", "js/agenda-2026-app.js", "js/agenda-photos.js"
MAX_ADD_REMOVE = 15
FORMATS = ["Plenary", "Pre-formed Panel", "Interactive Workshop", "Lightning Talk", "Individual Presentation",
           "Sponsored Session", "Poster Presentation", "Solution Demonstration", "Discovery Stage", "Reception",
           "Spotlight Session"]  # the type filters js/agenda-2026-app.js offers
APP_MARKER = "/* SOURCE OF TRUTH: gdhf.conference.tc."

def read(p): return open(p, encoding="utf-8").read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(s)
def nfc(s): return unicodedata.normalize("NFC", s or "")
def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower().replace("’", "'")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
def jdump(o): return json.dumps(o, ensure_ascii=False, separators=(",", ":"))
def jsobj(text, start_marker):
    i = text.index("{", text.index(start_marker)); o, end = json.JSONDecoder().raw_decode(text[i:]); return o, i, i + end

# ---------------------------------------------------------------- platform
agenda = json.load(open(f"{PLAT}/agenda.json"))
speakers = json.load(open(f"{PLAT}/speakers.json"))
groups = {g["id"]: g["title"].strip() for g in json.load(open(f"{PLAT}/topic-groups.json"))}
topics = {t["id"]: (groups.get(t.get("event_topic_group_id")), t["title"].strip()) for t in json.load(open(f"{PLAT}/topics.json"))}
details = {}
for f in glob.glob(f"{PLAT}/events/*.json"):
    e = json.load(open(f)); details[e["id"]] = e
pages = {}
for f in glob.glob(f"{PLAT}/descriptions/*.json"):
    r = json.load(open(f)); pages[r["id"]] = r

def pm_text(doc):  # ProseMirror doc -> plain text, paragraphs split by a blank line
    paras = []
    def inline(n):
        if n.get("type") == "text": return n.get("text", "")
        if n.get("type") == "hard_break": return "\n"
        return "".join(inline(c) for c in n.get("content") or [])
    def walk(n):
        if not isinstance(n, dict): return
        if n.get("type") in ("paragraph", "heading"): paras.append(inline(n)); return
        if n.get("type") == "list_item" or n.get("type") == "listItem": paras.append("• " + inline(n).strip()); return
        for c in n.get("content") or []: walk(c)
    walk(doc or {})
    return "\n\n".join(p.strip() for p in paras if p.strip())

def page_text(res):
    out = []
    def walk(r):
        for rc in r.get("resource_contents") or []:
            if isinstance(rc.get("content"), dict): out.append(pm_text(rc["content"]))
        for c in sorted(r.get("children") or [], key=lambda c: c.get("weight") or 0): walk(c)
    walk(res); return "\n\n".join(x for x in out if x)

def clean_text(t):  # tidy whitespace; keep paragraphs (blank line) and single line breaks
    t = nfc(t).replace("\r", "").replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n")]
    t = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return t

def bkk(iso):
    t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")) + BKK
    return t.strftime("%Y-%m-%d"), f"{t.hour}:{t.minute:02d}"

by_event = {}
for x in sorted(speakers, key=lambda x: (x.get("weight") or 0, x.get("created_at") or "")):
    if x.get("deleted_at"): continue
    n = re.sub(r"[\s,]+$", "", nfc(x.get("name") or "").strip())
    if not n: continue
    lst = by_event.setdefault(x["event_id"], [])
    if n in [p["n"] for p in lst]: continue
    lst.append({"n": n, "a": clean_text(x.get("affiliation") or ""), "b": clean_text(pm_text(x.get("biography"))),
                "_img": x.get("image") or ""})

public = [e for e in agenda if not e.get("restricted") and not e.get("deleted_at")]
hidden = [e for e in agenda if e.get("restricted")]

# ---------------------------------------------------------------- live site
live = {p: read(f"{LIVE}/{p}") for p in (AGENDA_JS, APP_JS, PHOTOS_JS)}
live_sessions = jsobj(live[AGENDA_JS], "GDHF_AGENDA")[0]["sessions"]
live_by_id = {s["id"]: s for s in live_sessions}

# ---------------------------------------------------------------- stable ids
idmap = json.load(open(IDMAP_PATH)) if os.path.exists(IDMAP_PATH) else {}
used_ids = set(idmap.values())
def key_of(title, d, s): return (norm(title), d, s)
live_keys = {}
for s in live_sessions: live_keys.setdefault(key_of(s["t"], s["d"], s["s"]), s["id"])
live_titles = {}
for s in live_sessions: live_titles.setdefault(norm(s["t"]), []).append(s["id"])
for e in public:
    if e["id"] in idmap: continue
    d, s = bkk(e["start_time"])
    cand = live_keys.get(key_of(e["title"], d, s))
    if not cand or cand in used_ids:  # same title elsewhere, or a renamed session in the same slot
        cand = next((i for i in live_titles.get(norm(e["title"]), []) if i not in used_ids), None)
    if not cand or cand in used_ids:
        best, best_r = None, 0.0
        for ls in live_sessions:
            if ls["id"] in used_ids or (ls["d"], ls["s"]) != (d, s): continue
            a, b = norm(e["title"]), norm(ls["t"])
            r = 0.9 if (a and b and (a in b or b in a)) else difflib.SequenceMatcher(None, a, b).ratio()
            if r > best_r: best, best_r = ls["id"], r
        cand = best if best_r >= 0.6 else None
    if not cand or cand in used_ids: cand = "p" + e["id"].replace("-", "")[:8]
    idmap[e["id"]] = cand; used_ids.add(cand)

# ---------------------------------------------------------------- build sessions
# The site's own data is updated in place (same layout, same key order), so a day's changes
# reach the site as a few small edits. Full bios live in js/agenda-bios-*.js (window.AGENDA_BIOS);
# a speaker's "b" may be a shortened copy ending in "…" that the page expands from there.
AB = {}
for f in sorted(glob.glob(f"{LIVE}/js/agenda-bios-*.js")):
    t = read(f); AB.update(json.loads(t[t.index(",{") + 1:t.rindex(");")]))
def ws(x): return " ".join((x or "").split())
bios_kept_site = []

def mins(t): h, m = t.split(":"); return int(h) * 60 + int(m)

def speaker(p, old):
    """the speaker entry for the site: the old entry where the platform agrees with it"""
    if old is None:
        return {"n": p["n"], "a": p["a"], "b": p["b"]}
    q = dict(old); q["n"] = p["n"]
    if q.get("a", "") != p["a"]: q["a"] = p["a"]
    full_now = AB.get(old["n"]) if ws(AB.get(old["n"])) else old.get("b", "")
    stub = ws(old.get("b", ""))
    same = ws(p["b"]) in (ws(full_now), stub) or (stub.endswith("…") and ws(p["b"]).startswith(stub[:-1].strip()[:100]))
    if not p["b"].strip():
        if stub: bios_kept_site.append(p["n"])  # the platform has no bio yet: keep the site's
    elif not same:
        q["b"] = p["b"]  # full bio; the page shows it as is (no longer matches the old stub)
    return q

def session(e, old):
    g = {}
    for t in e.get("event_topics") or []:
        grp, title = topics.get(t["id"], (None, t.get("title", "")))
        g.setdefault(grp, []).append(title.strip())
    types = g.get("Session Type", [])
    real = [t for t in types if t != "Sponsored Session"]
    sponsored = "Sponsored Session" in types or any(t.startswith("Sponsored ") for t in types)
    theme = (g.get("Track") or [""])[0]
    modes = g.get("Session Mode", [])
    mode = ("Hybrid Livestream" if "In-person" in modes else "Virtual") if "Virtual" in modes else "In-person"
    fmt = next((t for t in real if t in FORMATS), "") or ("Sponsored Session" if sponsored else "")
    tags = real + (["Sponsored Session"] if sponsored else []) + ([theme] if theme else []) + [mode]
    det = details.get(e["id"], {})
    desc = det.get("short_description") or ""
    if not desc.strip() and det.get("description_resource_id") in pages: desc = page_text(pages[det["description_resource_id"]])
    desc = clean_text(desc)
    d, s = bkk(e["start_time"]); _, en = bkk(e["end_time"])
    o = dict(old) if old else {}
    new = {"id": idmap[e["id"]], "t": clean_text(e["title"]), "d": d, "s": s, "e": en,
           "tags": o["tags"] if old and sorted(o.get("tags", [])) == sorted(tags) else tags,
           "fmt": fmt, "theme": theme, "mode": mode,
           "desc": o["desc"] if old and ws(o.get("desc")) == ws(desc) else desc}
    olds = {p["n"]: p for p in (o.get("sp") or [])}
    oldk = {norm(p["n"]): p for p in (o.get("sp") or [])}
    new["sp"] = [speaker(p, olds.get(p["n"]) or oldk.get(norm(p["n"]))) for p in by_event.get(e["id"], [])]
    if old and "sum" in o and new["desc"] == o["desc"]: new["sum"] = o["sum"]
    if old:  # keep the site's key order
        new = {k: new[k] for k in list(o.keys()) if k in new} | {k: v for k, v in new.items() if k not in o}
    return new

built = {idmap[e["id"]]: session(e, live_by_id.get(idmap[e["id"]])) for e in public}
new_sessions = [built[s["id"]] for s in live_sessions if s["id"] in built]  # the site's order...
for s in sorted((v for k, v in built.items() if k not in live_by_id), key=lambda s: (s["d"], mins(s["s"]))):
    at = next((i for i, x in enumerate(new_sessions) if (x["d"], mins(x["s"])) > (s["d"], mins(s["s"]))), len(new_sessions))
    new_sessions.insert(at, s)  # ...with new sessions slotted in by time
new_agenda = "window.GDHF_AGENDA = " + jdump({"sessions": new_sessions}) + ";\n"

# ---------------------------------------------------------------- photos
photos, pi, pj = jsobj(live[PHOTOS_JS], "window.AGENDA_PHOTOS")
new_photos = dict(photos)
photos_added = []
for e in public:
    for p in by_event.get(e["id"], []):
        if p["n"] not in new_photos and p["_img"]:
            new_photos[p["n"]] = p["_img"]; photos_added.append(p["n"])
new_photos_js = live[PHOTOS_JS][:pi] + jdump(new_photos) + live[PHOTOS_JS][pj:]

# ---------------------------------------------------------------- app (override layer)
app = live[APP_JS]
app_overrides = APP_MARKER not in app
new_app = app
if app_overrides and MIGRATE_APP:
    a = app.index("  /* PENDING:")
    b = app.index("  /* Drop placeholder speakers")
    new_app = app[:a] + (
        "  " + APP_MARKER + " The daily agenda sync (IACC-Agenda repo, gdhf/) updates\n"
        "     js/agenda-2026.js from the platform, so removals, moves and swaps are made there, not here. */\n\n") + app[b:]
    # a full bio written by the sync (no "…") is shown as is, never swapped for an older copy in agenda-bios-*.js
    cut_line = '    var cut = /…\\s*$/.test(b);\n'
    check = '    if (!cut) return b;\n'
    if cut_line in new_app and check in new_app:
        new_app = new_app.replace(check, "", 1).replace(cut_line, cut_line + check, 1)

# ---------------------------------------------------------------- report
report = {}
def add(k, v): report.setdefault(k, []).append(v)
nb = {s["id"]: s for s in new_sessions}
def label(s): return f"{s['d'][5:]} {s['s']} {s['t'][:110]}"
for sid, s in nb.items():
    o = live_by_id.get(sid)
    if not o: add("Sessions added", label(s)); continue
    if o["t"] != s["t"]: add("Titles", f"{o['t'][:90]} → {s['t'][:90]}")
    if (o["d"], o["s"], o["e"]) != (s["d"], s["s"], s["e"]): add("Times", f"{s['t'][:90]}: {o['d'][5:]} {o['s']}–{o['e']} → {s['d'][5:]} {s['s']}–{s['e']}")
    if (o.get("fmt"), o.get("theme"), o.get("mode")) != (s["fmt"], s["theme"], s["mode"]):
        add("Type, track or mode", f"{s['t'][:80]}: {o.get('fmt')}/{o.get('theme') or '-'}/{o.get('mode')} → {s['fmt']}/{s['theme'] or '-'}/{s['mode']}")
    if norm(o.get("desc")) != norm(s["desc"]): add("Descriptions", s["t"][:110])
    on = [p["n"] for p in o.get("sp", [])]; nn = [p["n"] for p in s["sp"]]
    for n in nn:
        if n not in on: add("Speakers added", f"{n} — {s['t'][:80]}")
    for n in on:
        if n not in nn: add("Speakers removed", f"{n} — {s['t'][:80]}")
    op = {p["n"]: p for p in o.get("sp", [])}
    for p in s["sp"]:
        q = op.get(p["n"])
        if q and q.get("a", "") != p.get("a", ""): add("Affiliations", f"{p['n']}: {q.get('a') or '(none)'} → {p['a'] or '(none)'}")
        if q and norm(q.get("b", "")) != norm(p.get("b", "")): add("Bios", p["n"])
for sid, o in live_by_id.items():
    if sid not in nb: add("Sessions removed", label(o) + (" (invite-only on the platform)" if any(idmap.get(h["id"]) == sid for h in hidden) else ""))
for n in photos_added: add("Photos added (from the platform)", n)

added, removed = len(report.get("Sessions added", [])), len(report.get("Sessions removed", []))
refused = None
if len(public) < 100: refused = f"the platform returned only {len(public)} public sessions"
elif added + removed > MAX_ADD_REMOVE and not ALLOW_MANY:
    refused = f"{added} sessions would be added and {removed} removed in one run (more than {MAX_ADD_REMOVE})"

# ---------------------------------------------------------------- plan
def units(s): return re.split(r'(?<=\n)|(?=\{"id":"s)|(?=\{"id":"p)|(?=\{"n":)|(?=,"[^"{}]{2,80}":"/images/)|(?=,"[^"{}]{2,80}":"https://)', s)
def make_patches(a, b):
    """find/replace pairs that turn a into b when applied in order; each find is unique when applied."""
    ua, ub = units(a), units(b)
    pos = [0]
    for u in ua: pos.append(pos[-1] + len(u))
    spans = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ua, ub, autojunk=False).get_opcodes():
        if tag == "equal": continue
        if tag == "replace" and i2 - i1 == j2 - j1:
            off = pos[i1]
            for ka, kb in zip(ua[i1:i2], ub[j1:j2]):
                if ka != kb:
                    for t, k1, k2, l1, l2 in difflib.SequenceMatcher(None, ka, kb, autojunk=False).get_opcodes():
                        if t != "equal": spans.append([off + k1, off + k2, kb[l1:l2]])
                off += len(ka)
        else:
            spans.append([pos[i1], pos[i2], "".join(ub[j1:j2])])
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < 60:
            merged[-1] = [merged[-1][0], s[1], merged[-1][2] + a[merged[-1][1]:s[0]] + s[2]]
        else: merged.append(s)
    x, out = a, []
    for i1, i2, rep in reversed(merged):
        c = 20
        while True:
            find = x[max(0, i1 - c):i2 + c]
            if find and x.count(find) == 1: break
            c += 20
        new = x[max(0, i1 - c):i1] + rep + x[i2:i2 + c]
        x = x[:max(0, i1 - c)] + new + x[i2 + c:]
        out.append({"find": find, "replace": new})
    assert x == b
    return out

new_files = {AGENDA_JS: nfc(new_agenda), PHOTOS_JS: nfc(new_photos_js), APP_JS: new_app}
plan, expected = [], {}
if not refused:
    for path in (APP_JS, PHOTOS_JS, AGENDA_JS):  # app first, so it never meets data it doesn't expect
        text, old = new_files[path], live[path]
        if text == old: continue
        write(f"{OUT}/{path}", text)
        expected[path] = hashlib.sha256(text.encode("utf-8")).hexdigest()
        pt = make_patches(old, text)
        if sum(len(p["find"]) for p in pt) > 0.5 * len(old) or len(pt) > 400:
            plan.append({"path": path, "method": "replace", "content_file": f"{OUT}/{path}", "bytes": len(text.encode("utf-8"))})
        else:
            plan.append({"path": path, "method": "patch", "patches": pt})
    json.dump(idmap, open(IDMAP_PATH, "w"), indent=1, sort_keys=True)
json.dump(plan, open(f"{W}/plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(expected, open(f"{W}/expected_sha256.json", "w"), indent=1)

today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
lines = [f"# GDHF agenda sync {today}", "",
         f"Platform: {len(agenda)} sessions, {len(hidden)} invite-only (kept off the website), {len(public)} shown. "
         f"Website before this run: {len(live_sessions)} sessions.", ""]
if app_overrides and not MIGRATE_APP:
    lines += ["**Needs a person:** js/agenda-2026-app.js has hand-made session overrides again (removals, moves or swaps). "
              "They change what the platform says, so the website may not match it. Ask Claude to remove them, and make the "
              "change on gdhf.conference.tc instead.", ""]
if refused:
    lines += [f"**Refused, nothing changed:** {refused}. A person should check gdhf.conference.tc; if it is right, "
              "re-run with --allow-many.", ""]
elif not plan:
    lines.append("No differences: the website already matches gdhf.conference.tc.")
else:
    lines.append("Files to update: " + ", ".join(f"`{p['path']}` ({'full rewrite' if p['method'] == 'replace' else str(len(p['patches'])) + ' edits'})" for p in plan))
    if app_overrides and MIGRATE_APP:
        lines += ["", "One-time: removed the hand-maintained overrides (hidden sessions, removed/moved/swapped speakers, replacement "
                  "descriptions) from js/agenda-2026-app.js; bios now come from the platform with each speaker."]
if bios_kept_site: report["Bios kept from the website (none on the platform yet)"] = sorted(set(bios_kept_site))
for k in ["Sessions added", "Sessions removed", "Titles", "Times", "Type, track or mode", "Descriptions", "Speakers added",
          "Speakers removed", "Affiliations", "Bios", "Bios kept from the website (none on the platform yet)", "Photos added (from the platform)"]:
    if report.get(k): lines += ["", f"## {k} ({len(report[k])})"] + [f"- {x}" for x in report[k]]
write(f"{W}/report.md", "\n".join(lines) + "\n")
print("\n".join(lines))
sys.exit(2 if refused else (10 if plan else 0))
