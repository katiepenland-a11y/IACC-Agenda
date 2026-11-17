"""Turn the raw GDHF download (gdhf/fetch_gdhf.sh) into one clean file plus a coverage check.

    python3 -I gdhf/build_gdhf.py WORK

Reads  WORK/platform/  agenda.json, speakers.json, topic-groups.json, topics.json,
                       events/<id>.json, descriptions/<resource id>.json
Writes WORK/gdhf-agenda.json  sessions (title, description, date, start/end, tags by group,
                              speakers with name, affiliation, bio, photo) and speakers
       WORK/coverage.md       how many sessions/speakers have each field, and what's missing
Exit 0 when everything was read; 2 if the download looks broken.
"""
import collections, datetime, glob, json, os, sys
from zoneinfo import ZoneInfo

W = sys.argv[1]; P = f"{W}/platform"
load = lambda p: json.load(open(p))
agenda = load(f"{P}/agenda.json"); speakers = load(f"{P}/speakers.json")
groups = {g["id"]: g for g in load(f"{P}/topic-groups.json")}
topics = {t["id"]: t for t in load(f"{P}/topics.json")}
details = {e["id"]: e for e in map(load, glob.glob(f"{P}/events/*.json"))}

problems = []
if not isinstance(agenda, list) or not agenda: problems.append("no sessions returned")
if not isinstance(speakers, list): problems.append("speaker list missing")
missing = [e["id"] for e in agenda if e["id"] not in details]
if missing: problems.append(f"{len(missing)} session detail files missing")
if problems:
    print("REFUSED:", "; ".join(problems)); sys.exit(2)

def doc_text(doc):  # rich-text document -> plain text, paragraphs split by blank lines
    if not doc: return ""
    if isinstance(doc, str): return doc.strip()
    def inline(n):
        if n.get("type") == "text": return n.get("text", "")
        if n.get("type") == "hard_break": return "\n"
        return "".join(inline(c) for c in n.get("content") or [])
    paras = []
    for n in doc.get("content") or []:
        if n.get("type") in ("bullet_list", "ordered_list", "bulletList", "orderedList"):
            paras += ["• " + inline(li).strip() for li in n.get("content") or []]
        else:
            paras.append(inline(n))
    return "\n\n".join(p.strip() for p in paras if p.strip())

def page_text(res):  # text blocks of a session page, in page order
    out = []
    def walk(r):
        for rc in r.get("resource_contents") or []:
            if isinstance(rc.get("content"), dict): out.append(doc_text(rc["content"]))
        for c in sorted(r.get("children") or [], key=lambda c: c.get("weight") or 0): walk(c)
    walk(res); return "\n\n".join(t for t in out if t)

def tz_of(e): return ZoneInfo(e.get("timezone") or "Asia/Bangkok")
def local(ts, tz): return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(tz)

by_event = collections.defaultdict(list)
people = {}
for x in sorted(speakers, key=lambda x: x.get("weight") or 0):
    pid = x.get("user_id") or x.get("speaker_id") or x.get("id")
    s = {"name": " ".join((x.get("name") or "").split()),
         "affiliation": " ".join((x.get("affiliation") or "").split()),
         "bio": doc_text(x.get("biography")),
         "photo": x.get("image") or ""}
    if not s["name"]: continue
    if s["name"] not in [p["name"] for p in by_event[x["event_id"]]]: by_event[x["event_id"]].append(s)
    key = s["name"].lower()
    prev = people.get(key)  # keep the most complete record per person
    if not prev or sum(map(bool, s.values())) > sum(map(bool, prev.values())): people[key] = s

for lst_ in by_event.values():  # fill gaps from the person's most complete record
    for s in lst_:
        best = people[s["name"].lower()]
        for k in ("affiliation", "bio", "photo"): s[k] = s[k] or best[k]

sessions = []
for a in agenda:
    e = {**a, **details[a["id"]]}; tz = tz_of(e)
    st, et = local(e["start_time"], tz), local(e["end_time"], tz)
    short = (e.get("short_description") or "").strip()
    rid = e.get("description_resource_id"); rp = f"{P}/descriptions/{rid}.json"
    full = page_text(load(rp)) if rid and os.path.exists(rp) else ""
    tags = collections.defaultdict(list)
    for t in e.get("event_topics") or []:
        g = groups.get((topics.get(t["id"]) or t).get("event_topic_group_id"))
        tags[g["title"].strip() if g else "Other"].append(t["title"].strip())
    sessions.append({
        "id": e["id"], "title": " ".join(e["title"].split()),
        "date": st.date().isoformat(), "start": st.strftime("%H:%M"), "end": et.strftime("%H:%M"),
        "timezone": str(tz), "start_utc": e["start_time"], "end_utc": e["end_time"],
        "description": short or full, "full_description": full,
        "tags": dict(tags), "speakers": by_event.get(e["id"], []),
        "url": f"https://gdhf.conference.tc/t/gdhf-2026/events/{e.get('slug', '')}"})
sessions.sort(key=lambda s: (s["start_utc"], s["title"]))

json.dump({"generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
           "source": "https://gdhf.conference.tc/t/gdhf-2026/events/agenda",
           "sessions": sessions, "speakers": sorted(people.values(), key=lambda s: s["name"].lower())},
          open(f"{W}/gdhf-agenda.json", "w"), ensure_ascii=False, indent=1)

ppl = list(people.values()); n = len(sessions)
no_desc = [s for s in sessions if not s["description"]]
no_tags = [s for s in sessions if not s["tags"]]
no_spk = [s for s in sessions if not s["speakers"]]
rows = [("Sessions", n, n), ("— with a description", n - len(no_desc), n),
        ("— with tags", n - len(no_tags), n), ("— with speakers", n - len(no_spk), n),
        ("Speakers", len(ppl), len(ppl)),
        ("— with affiliation", sum(bool(p["affiliation"]) for p in ppl), len(ppl)),
        ("— with bio", sum(bool(p["bio"]) for p in ppl), len(ppl)),
        ("— with photo", sum(bool(p["photo"]) for p in ppl), len(ppl))]
md = ["# GDHF 2026 agenda pull — coverage", "", "| | Have | Of |", "|---|---|---|"]
md += [f"| {a} | {b} | {c} |" for a, b, c in rows]
def lst(title, items):
    if items: md.extend(["", f"## {title} ({len(items)})", ""] + [f"- {x}" for x in items])
lst("Sessions with no description", [f"{s['date']} {s['start']} {s['title']}" for s in no_desc])
lst("Speakers with no bio", [p["name"] for p in ppl if not p["bio"]])
lst("Speakers with no photo", [p["name"] for p in ppl if not p["photo"]])
open(f"{W}/coverage.md", "w").write("\n".join(md) + "\n")
print("\n".join(md[:len(rows) + 4]))
