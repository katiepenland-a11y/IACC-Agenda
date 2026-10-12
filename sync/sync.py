"""Bring the Lanlan agenda embed (conference-agenda.lanlan.site/embed) in line with
the IACC participant platform (iacc.conference.tc), which is the source of truth.

    python3 -I sync/sync.py WORK

Reads   WORK/platform/  agenda.json, speakers.json, events/<id>.json   (sync/fetch_platform.sh)
        WORK/live/      the embed's current files                       (sync/fetch_embed.sh)
Writes  WORK/out/       the updated files, same paths as on the site
        WORK/patches.json          {site path: [{find, replace}, ...]} in apply order
        WORK/expected_sha256.json  {site path: sha256 of the updated file}
        WORK/report.md             what changed, in plain words

Exit 0: nothing to change. Exit 10: changes ready to apply. Exit 2: refused (the
platform data looks wrong, e.g. half the sessions missing) — needs a person.

Only the content the platform owns is rewritten: times, titles, session types and
themes, descriptions whose wording really changed, speakers, job titles, photos and
bios. Editorial cleanup on the embed (tidied descriptions, hand-written speaker lists'
layout) is left alone, and nothing on iacc.conference.tc is ever written to.
"""
import base64, collections, datetime, difflib, glob, hashlib, html, json, os, re, sys, unicodedata

W = sys.argv[1]
PLAT, LIVE, OUT = f"{W}/platform", f"{W}/live", f"{W}/out"
TODAY = datetime.date.today().isoformat()
DAYS = range(1, 5)
UTC_OFFSET = datetime.timedelta(hours=-4)  # conference time: AST, no daylight saving

PARTIALS = [f"_partials/agenda-day-{d}.html" for d in DAYS]
DATA_FILES = ["js/speakers-data.js", "js/speakers-photos.js"] + [f"data/speaker-bios-{i}.json" for i in range(1, 5)]

TYPE = {"Workshop": "workshop", "Break": "break", "Plenary": "plenary", "Film Festival": "cinema",
        "Social Event": "networking", "Concert": "concert"}
TYPE_LABEL = {v: k for k, v in TYPE.items()}
PALETTE = ["#F59B00", "#69A525", "#98211E", "#507A8E", "#1EAFE1", "#878278", "#5D7D8F"]


def read(p): return open(p, encoding="utf-8").read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)
def nfc(s): return unicodedata.normalize("NFC", s)
def norm(s):  # same as platform-skin.js norm(): NFC, lower, non letter/number runs -> one space
    s = nfc(s or "").lower()
    return " ".join("".join(c if c.isalnum() else " " for c in s).split())
def local(iso): return datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")) + UTC_OFFSET
def clock(t): return t.strftime("%-I:%M %p")
def clean_name(n): return re.sub(r"[\s,]+$", "", (n or "").strip())
def esc(s): return html.escape(s, quote=True)
def slug(label): return norm(label).replace(" ", "-")
def jsobj(text): return json.loads(text[text.index("{"): text.rindex("}") + 1])

# ---------------------------------------------------------------- platform data
agenda = json.load(open(f"{PLAT}/agenda.json"))
speakers = json.load(open(f"{PLAT}/speakers.json"))
details = {}
for f in glob.glob(f"{PLAT}/events/*.json"):
    e = json.load(open(f)); details[e["id"]] = e

live_files = {p: read(f"{LIVE}/{p}") for p in PARTIALS + DATA_FILES}
live_sessions = sum(live_files[p].count('<li class="session"') for p in PARTIALS)

# Refuse obviously broken input rather than wiping the agenda.
problems = []
if not isinstance(agenda, list) or len(agenda) < 0.8 * live_sessions:
    problems.append(f"platform returned {len(agenda) if isinstance(agenda, list) else 'no'} sessions; the embed has {live_sessions}")
if not isinstance(speakers, list) or len(speakers) < 50:
    problems.append(f"platform returned {len(speakers) if isinstance(speakers, list) else 'no'} speaker rows")
missing_details = [e["id"] for e in agenda if e["id"] not in details]
if missing_details:
    problems.append(f"{len(missing_details)} session detail files missing")
if problems:
    write(f"{W}/report.md", "# Sync refused\n\n" + "\n".join(f"- {p}" for p in problems) + "\n")
    print("REFUSED:", "; ".join(problems)); sys.exit(2)

by_event = collections.defaultdict(list)
for x in sorted(speakers, key=lambda x: x["weight"]):
    n = clean_name(x["name"])
    if n and n not in [p[0] for p in by_event[x["event_id"]]]:
        by_event[x["event_id"]].append((n, (x["affiliation"] or "").strip()))

report = collections.defaultdict(list)

# ---------------------------------------------------------------- descriptions
def clean_desc(d):
    d = (d or "").replace("\r", "")
    d = re.sub(r"(?m)^[^\n]*?\(please[^)]*\)\s*(?:\(\d+/\d+\))?[ \t]*", "", d)  # submission-form prompts
    d = re.sub(r"\s*\(\d+/\d+\)", "", d)
    rap = None
    m = re.search(r"\s*Rapporteur:\s*(.+?)\s*$", d, re.S)
    if m: rap = " ".join(m.group(1).split()); d = d[:m.start()]
    paras = [" ".join(p.split()) for p in re.split(r"\n\s*\n", d.strip()) if p.strip()]
    return paras, rap

def desc_html(raw):
    paras, rap = clean_desc(raw)
    full = "<br><br>".join(esc(p) for p in paras)
    if rap: full += f" <em>Rapporteur: {esc(rap)}</em>"
    plain = " ".join(paras)
    short = esc(plain[:160].rsplit(" ", 1)[0].rstrip(",;:.–- ")) + "…" if len(plain) > 160 else esc(plain)
    return short, full, (plain + (f" Rapporteur: {rap}" if rap else ""))

def same_words(a, b, cutoff=0.97):
    a, b = norm(a).split(), norm(b).split()
    return (not a and not b) or difflib.SequenceMatcher(None, a, b, autojunk=False).ratio() >= cutoff

# ---------------------------------------------------------------- hand-written speaker lists
def bio_text(doc):
    acc = []
    def walk(n):
        if isinstance(n, dict):
            if n.get("type") == "text": acc.append(n.get("text", ""))
            if n.get("type") == "hard_break": acc.append(" ")
            for c in n.get("content", []) or []: walk(c)
            if n.get("type") == "paragraph": acc.append(" ")
    walk(doc); return " ".join("".join(acc).split())

_all_partials = "".join(live_files[p] for p in PARTIALS)
_inline = {html.unescape(m) for m in re.findall(
    r'<strong>([^<]*)</strong>(?:(?!</div></div>).)*class="bio-toggle"', _all_partials)}
INLINE_BIO = {clean_name(x["name"]): bio_text(x["biography"]) for x in speakers if clean_name(x["name"]) in _inline}

def initials(n):
    w = n.split(); return (w[0][0] + (w[-1][0] if len(w) > 1 else "")).upper()

def org_html(a):
    if not a: return ""
    if len(a) <= 44: return f'<span class="org">{esc(a)}</span>'
    cut = a[:42].rsplit(" ", 1)[0].rstrip(",;:.–-&( ")
    return (f'<span class="org"><span class="org-short">{esc(cut)}…</span><span class="org-full is-hidden">'
            f'{esc(a)}</span> <button type="button" class="org-toggle">more</button></span>')

def grid(people):
    out = ['<div class="speakers-grid">']
    for i, (n, a) in enumerate(people):
        bio = ""
        if INLINE_BIO.get(n):
            bio = (' <button type="button" class="bio-toggle">Bio</button>'
                   f'<p class="speaker-bio is-hidden">{esc(INLINE_BIO[n])}</p>')
        out.append(f'<div class="speaker"><span class="avatar" style="background:{PALETTE[i % len(PALETTE)]}">'
                   f'{esc(initials(n))}</span><div><strong>{esc(n)}</strong>{org_html(a)}{bio}</div></div>')
    out.append("</div>"); return "".join(out)

# ---------------------------------------------------------------- sessions
def topics_of(e):
    t = [x["title"] for x in e["event_topics"]]
    return [TYPE[x] for x in t if x in TYPE], [x for x in t if x not in TYPE]

def tags_html(types, themes):
    return ("".join(f'<span class="tag tag-type type-{t}">{TYPE_LABEL[t]}</span>' for t in types) +
            "".join(f'<span class="tag tag-theme theme-{slug(t)}">{esc(t)}</span>' for t in themes))

def new_li(e):
    st, et = local(e["start_time"]), local(e["end_time"])
    types, themes = topics_of(e)
    body = f"<h3>{esc(' '.join(e['title'].split()))}</h3>"
    raw = details[e["id"]].get("short_description") or ""
    if clean_desc(raw)[0]:
        short, full, _ = desc_html(raw)
        body += (f'<p class="session-desc"><span class="desc-short">{short}</span><span class="desc-full is-hidden">'
                 f'{full}</span></p><button type="button" class="desc-toggle">More</button>')
    body += f'<div class="session-tags">{tags_html(types, themes)}</div>'
    return (f'<li class="session" data-type="{" ".join(types)}" data-themes="{" ".join(slug(t) for t in themes)}">'
            f'<div class="session-time"><span>{clock(st)}</span><span>{clock(et)}</span></div>'
            f'<div class="session-body">{body}</div></li>')

def li_title(li): return html.unescape(re.search(r"<h3>(.*?)</h3>", li, re.S).group(1))
def li_start(li): return re.search(r'<div class="session-time"><span>(.*?)</span>', li).group(1)
def minutes(clock_str):
    t = datetime.datetime.strptime(clock_str, "%I:%M %p"); return t.hour * 60 + t.minute

def update_li(li, e, day):
    old = li
    st, et = local(e["start_time"]), local(e["end_time"])
    li = re.sub(r'<div class="session-time"><span>.*?</span><span>.*?</span></div>',
                f'<div class="session-time"><span>{clock(st)}</span><span>{clock(et)}</span></div>', li, count=1)
    live_t = " ".join(e["title"].split())
    if " ".join(li_title(li).split()) != live_t:
        li = re.sub(r"<h3>.*?</h3>", f"<h3>{esc(live_t)}</h3>", li, count=1, flags=re.S)
        report["Titles"].append(f"Day {day}: “{' '.join(li_title(old).split())}” → “{live_t}”")
    types, themes = topics_of(e)
    cur = re.search(r'data-type="([^"]*)"', li).group(1).split()
    types = [t for t in cur if t in types] + [t for t in types if t not in cur]
    li = re.sub(r'data-type="[^"]*"', f'data-type="{" ".join(types)}"', li, count=1)
    cur_th = re.search(r'data-themes="([^"]*)"', li).group(1).split()
    want_th = [slug(t) for t in themes]
    if set(cur_th) != set(want_th):
        li = re.sub(r'data-themes="[^"]*"', f'data-themes="{" ".join(want_th)}"', li, count=1)
    li = re.sub(r'<div class="session-tags">.*?</div>', f'<div class="session-tags">{tags_html(types, themes)}</div>',
                li, count=1, flags=re.S)
    # descriptions: only when the wording really changed (keeps the embed's tidy-ups)
    raw = details[e["id"]].get("short_description") or ""
    m = re.search(r'<span class="desc-full is-hidden">(.*?)</span></p>', li, re.S)
    cur_text = html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))) if m else ""
    short, full, plain = desc_html(raw)
    if not same_words(cur_text, plain) and clean_desc(raw)[0]:
        if m:
            li = re.sub(r'<span class="desc-short">.*?</span><span class="desc-full is-hidden">.*?</span></p>',
                        f'<span class="desc-short">{short}</span><span class="desc-full is-hidden">{full}</span></p>',
                        li, count=1, flags=re.S)
        else:
            li = li.replace("<div class=\"session-tags\">",
                            f'<p class="session-desc"><span class="desc-short">{short}</span><span class="desc-full is-hidden">'
                            f'{full}</span></p><button type="button" class="desc-toggle">More</button><div class="session-tags">', 1)
        report["Descriptions"].append(f"Day {day}: {live_t}")
    # hand-written speaker list (index.html shows it; the embed uses speakers-data.js)
    had_grid = '<div class="speakers-grid">' in li
    li = re.sub(r'<div class="speakers-grid">.*?</div></div></div>(?=</div></li>$)', "", li, flags=re.S)
    people = by_event.get(e["id"], [])
    if had_grid and people:
        li = li[:-len("</div></li>")] + grid(people) + "</div></li>"
    was = re.search(r'<div class="session-time"><span>(.*?)</span><span>(.*?)</span>', old).groups()
    if was != (clock(st), clock(et)):
        report["Times"].append(f"Day {day}: {live_t}: {was[0]}–{was[1]} → {clock(st)}–{clock(et)}")
    return li

new_files = {}
matched = 0
for d in DAYS:
    src = live_files[f"_partials/agenda-day-{d}.html"]
    a = src.index('<ol class="session-list">') + len('<ol class="session-list">'); b = src.rindex("</ol>")
    lis = re.findall(r'<li class="session".*?</li>', src[a:b], re.S)
    assert "".join(lis) == src[a:b], f"day {d}: unexpected markup between sessions"
    evs = sorted([e for e in agenda if local(e["start_time"]).day == d], key=lambda e: (e["start_time"], e["weight"]))
    pool = list(enumerate(lis))
    slots = []  # (position key, html)
    pending = []
    for e in evs:
        want = norm(e["title"])
        cands = [p for p in pool if norm(li_title(p[1])) == want]
        if not cands:
            close = difflib.get_close_matches(want, [norm(li_title(p[1])) for p in pool], 1, 0.85)
            cands = [p for p in pool if close and norm(li_title(p[1])) == close[0]]
        if not cands:
            pending.append(e); continue
        st = local(e["start_time"])
        idx, li = min(cands, key=lambda p: abs(minutes(li_start(p[1])) - (st.hour * 60 + st.minute)))
        pool.remove((idx, li)); matched += 1
        slots.append((idx, update_li(li, e, d)))
    for idx, li in pool:
        report["Removed sessions"].append(f"Day {d}: {' '.join(li_title(li).split())} ({li_start(li)})")
    # new sessions go after the last session that starts no later than they do
    for e in pending:
        st = local(e["start_time"]); m = st.hour * 60 + st.minute
        before = [k for k, li in slots if minutes(li_start(li)) <= m]
        slots.append(((max(before) if before else -1) + 0.5, new_li(e)))
        report["New sessions"].append(f"Day {d}: {' '.join(e['title'].split())} ({clock(st)})")
    new_files[f"_partials/agenda-day-{d}.html"] = src[:a] + "".join(li for _, li in sorted(slots, key=lambda s: s[0])) + src[b:]

if len(report["Removed sessions"]) + len(report["New sessions"]) > max(10, 0.15 * live_sessions):
    write(f"{W}/report.md", "# Sync refused\n\nToo many sessions would be added or removed at once — check the platform.\n\n"
          + "\n".join(f"- {x}" for x in report["Removed sessions"] + report["New sessions"]) + "\n")
    print("REFUSED: too many sessions added/removed"); sys.exit(2)

# ---------------------------------------------------------------- speakers-data.js (keeps key order)
SD, SD_TITLE = {}, {}
for e in sorted(agenda, key=lambda e: (e["start_time"], e["weight"])):
    if by_event.get(e["id"]):
        st = local(e["start_time"])
        key = f"panel-{st.day}|{clock(st)}|{norm(e['title'])}"
        SD[key] = [list(x) for x in by_event[e["id"]]]; SD_TITLE[key] = " ".join(e["title"].split())
old_sd = jsobj(live_files["js/speakers-data.js"])
order = [k for k in old_sd if k in SD]
for i, k in enumerate(SD):
    if k in order: continue
    prev = [p for p in list(SD)[:i] if p in order]
    order.insert(order.index(prev[-1]) + 1 if prev else 0, k)
if {k: SD[k] for k in order} != old_sd:
    new_files["js/speakers-data.js"] = (
        f"/* Speakers for the IACC 2026 agenda embed. Generated {TODAY} from\n"
        "   iacc.conference.tc — speaker names and job titles only.\n"
        "   Rendered by js/platform-skin.js. Re-generate; don't hand-edit. */\n"
        "window.IACC_SPEAKERS = " + json.dumps({k: SD[k] for k in order}, ensure_ascii=False, indent=1) + ";\n")
    old_people = {(n, t) for v in old_sd.values() for n, t in v}
    new_people = {(n, t) for v in SD.values() for n, t in v}
    on = {n for n, _ in old_people}; nn = {n for n, _ in new_people}
    for n in sorted(nn - on): report["Speakers added"].append(n)
    for n in sorted(on - nn): report["Speakers removed"].append(n)
    old_t = dict(old_people);
    for n, t in sorted(new_people):
        if n in on and (n, t) not in old_people: report["Job titles"].append(f"{n}: {t}")
    for k in order:
        if k in old_sd and old_sd[k] != SD[k] and [p[0] for p in old_sd[k]] != [p[0] for p in SD[k]]:
            report["Session line-ups changed"].append(SD_TITLE[k])

# ---------------------------------------------------------------- speakers-photos.js
PH = {}
for x in sorted(speakers, key=lambda x: clean_name(x["name"])):
    img = x["image"] or ""; n = clean_name(x["name"])
    m = re.match(r"https://cdn\.filestackcontent\.com/([A-Za-z0-9]+)\?policy=([^&]+)&signature=([0-9a-f]+)", img)
    if not m or n in PH: continue  # stock silhouettes are skipped: they get the coloured initial
    pol = json.loads(base64.b64decode(m.group(2) + "=" * (-len(m.group(2)) % 4)))
    PH[n] = [m.group(1), pol["expiry"], m.group(3)]
old_ph = jsobj(live_files["js/speakers-photos.js"])
if PH != old_ph:
    new_files["js/speakers-photos.js"] = (
        f"/* Speaker photos for the IACC 2026 agenda embed. Generated {TODAY} from\n"
        "   iacc.conference.tc. name -> [Filestack handle, policy expiry, signature];\n"
        "   js/platform-skin.js rebuilds the resized URL the platform's Avatar uses.\n"
        "   Stock silhouettes are left out (those speakers get the coloured initial).\n"
        "   Re-generate; don't hand-edit. */\n"
        "window.IACC_SPEAKER_PHOTOS = {\n" +
        ",\n".join(f" {json.dumps(k, ensure_ascii=False)}: [{json.dumps(v[0])}, {v[1]}, {json.dumps(v[2])}]" for k, v in PH.items()) +
        "\n};\n")
    for n in PH:
        if n not in old_ph: report["Photos added"].append(n)
        elif PH[n][0] != old_ph[n][0]: report["Photos changed"].append(n)
    for n in old_ph:
        if n not in PH: report["Photos removed"].append(n)

# ---------------------------------------------------------------- bios (keeps the existing 4-file split)
def bio_html(doc):
    if not doc: return ""
    def inline(nodes):
        s = ""
        for n in nodes or []:
            if n.get("type") == "hard_break": s += "<br>"; continue
            if n.get("type") != "text": s += inline(n.get("content")); continue
            t = html.escape(n.get("text", ""), quote=False)
            for mk in n.get("marks", []) or []:
                if mk["type"] == "bold": t = f"<strong>{t}</strong>"
                elif mk["type"] == "italic": t = f"<em>{t}</em>"
                elif mk["type"] == "link":
                    href = (mk.get("attrs") or {}).get("href", "")
                    if re.match(r"https?://", href): t = f'<a href="{esc(href)}">{t}</a>'
            s += t
        return s
    paras = [inline(p.get("content")) for p in doc.get("content", []) if p.get("type") == "paragraph"]
    return "".join(f"<p>{p.strip()}</p>" for p in paras if re.sub(r"<br>|\s", "", p))

BIOS = {}
for x in speakers:
    n = clean_name(x["name"]); h = nfc(bio_html(x["biography"]))
    if h and n not in BIOS: BIOS[n] = h
old_parts = [json.loads(live_files[f"data/speaker-bios-{i}.json"]) for i in range(1, 5)]
old_all = {k: v for p in old_parts for k, v in p.items()}
firsts = [min(p, key=str.lower) if p else "" for p in old_parts]
parts = [{n: BIOS[n] for n in p if n in BIOS} for p in old_parts]
placed = {n for p in parts for n in p}
for n in sorted(set(BIOS) - placed, key=str.lower):
    k = max([i for i, f in enumerate(firsts) if f and f.lower() <= n.lower()] or [0]); parts[k][n] = BIOS[n]
for i, p in enumerate(parts, 1):
    path = f"data/speaker-bios-{i}.json"
    if p != old_parts[i - 1]:
        items = sorted(p.items(), key=lambda kv: kv[0].lower())
        new_files[path] = "{\n" + ",\n".join(f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}"
                                             for k, v in items) + "\n}\n"
for n in sorted(BIOS):
    if n not in old_all: report["Bios added"].append(n)
    elif nfc(old_all[n]) != BIOS[n]: report["Bios updated"].append(n)
for n in sorted(old_all):
    if n not in BIOS: report["Bios removed"].append(n)

# ---------------------------------------------------------------- patches
def units(s):  # sessions / lines, so the diff runs on small pieces
    return re.split(r'(?<=\n)|(?=<li class="session")', s)

def make_patches(a, b):
    """find/replace pairs that turn a into b when applied in order; each find is unique when applied."""
    ua, ub = units(a), units(b)
    spans = []  # (a_start, a_end, replacement) in a-offsets
    pos_a = [0]
    for u in ua: pos_a.append(pos_a[-1] + len(u))
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ua, ub, autojunk=False).get_opcodes():
        if tag == "equal": continue
        sa, sb = "".join(ua[i1:i2]), "".join(ub[j1:j2])
        base = pos_a[i1]
        if tag == "replace" and len(sa) < 20000 and len(sb) < 20000:
            for t, k1, k2, l1, l2 in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes():
                if t != "equal": spans.append([base + k1, base + k2, sb[l1:l2]])
        else:
            spans.append([base, pos_a[i2], sb])
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < 60:
            merged[-1] = [merged[-1][0], s[1], merged[-1][2] + a[merged[-1][1]:s[0]] + s[2]]
        else:
            merged.append(s)
    x, out = a, []
    for i1, i2, rep in reversed(merged):  # right to left: earlier offsets stay valid
        c = 20
        while True:
            find = x[max(0, i1 - c):i2 + c]
            if x.count(find) == 1: break
            c += 20
        new = x[max(0, i1 - c):i1] + rep + x[i2:i2 + c]
        x = x[:max(0, i1 - c)] + new + x[i2 + c:]
        out.append({"find": find, "replace": new})
    assert x == b
    return out

patches, expected = {}, {}
for path, text in new_files.items():
    text = nfc(text)
    old = nfc(live_files[path])
    if text == old: continue
    write(f"{OUT}/{path}", text)
    patches[path] = make_patches(old, text)
    expected[path] = hashlib.sha256(text.encode("utf-8")).hexdigest()
json.dump(patches, open(f"{W}/patches.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(expected, open(f"{W}/expected_sha256.json", "w"), indent=1)

# ---------------------------------------------------------------- report
lines = [f"# Agenda sync {TODAY}", "",
         f"Platform: {len(agenda)} sessions, {len(speakers)} speaker listings. Embed sessions matched: {matched}.", ""]
if not patches:
    lines.append("No differences: the embed already matches iacc.conference.tc.")
else:
    lines.append("Files to update: " + ", ".join(f"`{p}` ({len(v)} edits)" for p, v in patches.items()))
    for k in ["Times", "Titles", "New sessions", "Removed sessions", "Descriptions", "Session line-ups changed",
              "Speakers added", "Speakers removed", "Job titles", "Photos added", "Photos changed", "Photos removed",
              "Bios added", "Bios updated", "Bios removed"]:
        if report[k]:
            lines += ["", f"## {k} ({len(report[k])})"] + [f"- {x}" for x in report[k]]
write(f"{W}/report.md", "\n".join(lines) + "\n")
print("\n".join(lines))
sys.exit(10 if patches else 0)
