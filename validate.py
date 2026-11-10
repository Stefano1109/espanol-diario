"""Validate one block file:  python validate.py blocks/h45.py
Prints OK or a list of problems to fix."""
import importlib.util, json, re, sys, os
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
CJK = re.compile(r"[一-鿿]")
path = sys.argv[1]
h = int(re.search(r"h(\d+)\.py$", path).group(1))
syl = {b["h"]: b for b in json.load(open(os.path.join(HERE, "syllabus.json"), encoding="utf-8"))}[h]
used = set(open(os.path.join(HERE, "used_words.txt"), encoding="utf-8").read().split("\n"))
errs = []
# words already taken by OTHER finished blocks in blocks/ (marked with a .done file)
import glob
other = {}
for f in glob.glob(os.path.join(HERE, "blocks", "h*.py")):
    oh = int(re.search(r"h(\d+)\.py$", f).group(1))
    if oh == h or not os.path.exists(f[:-3] + ".done"): continue
    try:
        sp = importlib.util.spec_from_file_location(f"o{oh}", f); om = importlib.util.module_from_spec(sp); sp.loader.exec_module(om)
        for d in om.DAYS:
            for w in d["words"]: other[w["w"].strip().lower()] = oh
    except Exception: pass

def err(m):
    errs.append(m)

try:
    spec = importlib.util.spec_from_file_location("blk", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    DAYS = mod.DAYS
except Exception as e:
    print("IMPORT ERROR:", repr(e)); sys.exit(1)

def nonempty(v):
    return isinstance(v, str) and v.strip() != ""

def zh(v, where):
    if not nonempty(v) or not CJK.search(v): err(f"{where}: must be Chinese text, got {v!r}")

def en(v, where):
    if not nonempty(v) or CJK.search(v): err(f"{where}: must be English text (no Chinese), got {v!r}")

def es(v, where, maxw=None):
    if not nonempty(v) or CJK.search(v): err(f"{where}: must be Spanish text, got {v!r}")
    elif maxw and len(v.split()) > maxw: err(f"{where}: {len(v.split())} words, keep it to {maxw} or fewer: {v!r}")

def opts3(z, e, where):
    if not (isinstance(z, list) and len(z) == 3 and len(set(z)) == 3): err(f"{where}: need 3 different Chinese options")
    else:
        for i, o in enumerate(z): zh(o, f"{where} zh option {i}")
    if not (isinstance(e, list) and len(e) == 3 and len(set(e)) == 3): err(f"{where}: need 3 different English options")
    else:
        for i, o in enumerate(e): en(o, f"{where} en option {i}")

days = [d["day"] for d in DAYS]
if days != syl["days"]:
    err(f"day numbers must be exactly {syl['days'][0]}..{syl['days'][-1]} in order, got {days}")
seen = {}
for d in DAYS:
    n = d.get("day"); t = f"day {n}"
    want = "listen" if (syl["days"].index(n) if n in syl["days"] else 0) % 2 == 0 else "speak"
    if d.get("type") != want: err(f"{t}: type must be {want}")
    for k in ("theme", "grammar"): zh(d.get(k), f"{t} {k}")
    for k in ("themeEn", "grammarEn"): en(d.get(k), f"{t} {k}")
    es(d.get("themeEs"), f"{t} themeEs")
    ws = d.get("words", [])
    if len(ws) != 5: err(f"{t}: needs exactly 5 words, has {len(ws)}")
    for i, w in enumerate(ws):
        wt = f"{t} word {i} ({w.get('w')})"
        es(w.get("w"), wt + " w"); es(w.get("ex"), wt + " ex", 18)
        for k in ("pos", "zh", "exZh", "note"): zh(w.get(k), f"{wt} {k}")
        for k in ("posEn", "en", "exEn", "noteEn"): en(w.get(k), f"{wt} {k}")
        key = (w.get("w") or "").strip().lower()
        if key in used: err(f"{wt}: already taught earlier in the course (see used_words.txt), choose another word")
        if key in other: err(f"{wt}: already used in finished block h{other[key]}, choose another word")
        if key in seen: err(f"{wt}: duplicate of day {seen[key]} in this block")
        seen[key] = n
    if d.get("type") == "listen":
        ps = d.get("pairs", [])
        if len(ps) != 3: err(f"{t}: needs 3 sound pairs")
        for i, p in enumerate(ps):
            es(p.get("a"), f"{t} pair {i} a"); es(p.get("b"), f"{t} pair {i} b")
            if p.get("a") == p.get("b"): err(f"{t} pair {i}: a and b must differ")
            zh(p.get("az"), f"{t} pair {i} az"); zh(p.get("bz"), f"{t} pair {i} bz")
            en(p.get("azEn"), f"{t} pair {i} azEn"); en(p.get("bzEn"), f"{t} pair {i} bzEn")
        ss = d.get("sentences", [])
        if len(ss) != 6: err(f"{t}: needs 6 listening sentences")
        for i, s in enumerate(ss):
            es(s.get("es"), f"{t} sentence {i}", 20); opts3(s.get("opts"), s.get("optsEn"), f"{t} sentence {i}")
        dl = d.get("dialogue", {})
        zh(dl.get("title"), f"{t} dialogue title"); en(dl.get("titleEn"), f"{t} dialogue titleEn")
        voices = {dl.get("A", {}).get("voice"), dl.get("B", {}).get("voice")}
        if voices != {"f", "m"}: err(f"{t}: dialogue speakers must have voices 'f' and 'm' (one each)")
        for k in ("A", "B"):
            if not nonempty(dl.get(k, {}).get("name")) or not nonempty(dl.get(k, {}).get("nameEn")): err(f"{t}: speaker {k} needs name and nameEn")
            elif CJK.search(dl[k]["nameEn"]): err(f"{t}: speaker {k} nameEn must be English")
        ls = dl.get("lines", [])
        lo, hi = syl["lines"]
        if not lo <= len(ls) <= hi: err(f"{t}: dialogue needs {lo}–{hi} lines, has {len(ls)}")
        if {l.get("s") for l in ls} != {"A", "B"}: err(f"{t}: dialogue lines must use both A and B")
        for i, l in enumerate(ls):
            es(l.get("es"), f"{t} line {i}", 28); zh(l.get("zh"), f"{t} line {i} zh"); en(l.get("en"), f"{t} line {i} en")
        qs = dl.get("qs", [])
        if len(qs) != 5: err(f"{t}: needs 5 dialogue questions")
        for i, q in enumerate(qs):
            zh(q.get("q"), f"{t} q{i}"); en(q.get("qEn"), f"{t} q{i} qEn"); opts3(q.get("opts"), q.get("optsEn"), f"{t} q{i}")
    if d.get("type") == "speak":
        prev = next((x for x in DAYS if x.get("day") == n - 1), None)
        if prev and prev.get("theme") != d.get("theme"): err(f"{t}: theme must equal day {n-1}'s theme")
        wu = d.get("warmup", [])
        if len(wu) != 4: err(f"{t}: needs 4 warm-ups")
        for i, u in enumerate(wu): es(u.get("es"), f"{t} warmup {i}"); zh(u.get("tip"), f"{t} warmup {i} tip"); en(u.get("tipEn"), f"{t} warmup {i} tipEn")
        sh = d.get("shadow", [])
        if len(sh) != 5: err(f"{t}: needs 5 shadow sentences")
        for i, s in enumerate(sh): es(s.get("es"), f"{t} shadow {i}", 16); zh(s.get("zh"), f"{t} shadow {i} zh"); en(s.get("en"), f"{t} shadow {i} en")
        role = d.get("roleplay", {}).get("role")
        if role not in ("A", "B"): err(f"{t}: role must be 'A' or 'B'")
        elif prev and sum(1 for l in prev["dialogue"]["lines"] if l["s"] == role) < 3: err(f"{t}: role {role} needs at least 3 lines in day {n-1}'s dialogue")
        sb = d.get("subs", [])
        if len(sb) != 2: err(f"{t}: needs 2 substitution patterns")
        tot = 0
        for i, p in enumerate(sb):
            es(p.get("pattern"), f"{t} sub {i} pattern")
            if "___" not in (p.get("pattern") or ""): err(f"{t} sub {i}: pattern must contain ___")
            for j, it in enumerate(p.get("items", [])):
                tot += 1
                if not nonempty(it.get("cue")): err(f"{t} sub {i}.{j}: cue is empty")
                en(it.get("cueEn"), f"{t} sub {i}.{j} cueEn"); es(it.get("es"), f"{t} sub {i}.{j} es", 16)
        if not 4 <= tot <= 6: err(f"{t}: substitution items must total 4–6, has {tot}")
        qq = d.get("questions", [])
        if len(qq) != 4: err(f"{t}: needs 4 questions")
        for i, q in enumerate(qq): es(q.get("es"), f"{t} question {i}"); zh(q.get("zh"), f"{t} question {i} zh"); en(q.get("en"), f"{t} question {i} en"); es(q.get("sample"), f"{t} question {i} sample", 20)
        f = d.get("free", {})
        zh(f.get("prompt"), f"{t} free prompt"); en(f.get("promptEn"), f"{t} free promptEn"); es(f.get("frame"), f"{t} free frame")
        if len(f.get("checklist", [])) != 3 or len(f.get("checklistEn", [])) != 3: err(f"{t}: free checklist needs 3 Chinese and 3 English items")
        else:
            for i in range(3): zh(f["checklist"][i], f"{t} checklist {i}"); en(f["checklistEn"][i], f"{t} checklistEn {i}")

if errs:
    print(f"{len(errs)} PROBLEM(S):"); [print(" -", e) for e in errs[:80]]
    if len(errs) > 80: print(f" … and {len(errs) - 80} more")
    sys.exit(1)
open(path[:-3] + ".done", "w").close()
print(f"OK — block h{h}: {len(DAYS)} days, {sum(len(d['words']) for d in DAYS)} words")
