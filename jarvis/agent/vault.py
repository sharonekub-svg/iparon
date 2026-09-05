"""תיקיות -> אינדקס -> גרף.

קריאה בלבד. אין כאן שום פעולת כתיבה, בכוונה.
"""

import os
import re
import math
import time
import zlib
import datetime

import data

# ── ניתוח טקסט ────────────────────────────────────────────────────────

WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")
FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)

# אותיות עבריות, לטיניות וספרות. מפריד על כל השאר.
TOKEN = re.compile(r"[֐-׿]+|[A-Za-z]{2,}|\d+")

# מילות עצירה — עברית ואנגלית. מסננות רעש בחיפוש.
STOP = set("""
של את זה אני לא על עם כי אם או גם רק כל מה מי איך למה כמה אבל אז יש אין
היה היא הוא הם הן אנחנו אתם זאת אלה הזה הזאת יותר פחות עוד כבר עד לפי בין
לי לו לה לנו להם שלי שלו שלה שלנו שלהם אחד אחת שתי שני הרבה מאוד ככה
the and for you are but not with that this from have has was were will
""".split())

TYPE_ALIASES = {
    "idea": "רעיון", "research": "מחקר", "competitor": "מתחרה",
    "money": "כסף", "learning": "לימוד", "personal": "אישי",
}


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP and len(t) > 1]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER.match(text)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            meta[k.strip().lower()] = v.strip()
    return meta, text[m.end():]


# ── PDF ───────────────────────────────────────────────────────────────
# חילוץ טקסט מ-PDF בספרייה הסטנדרטית בלבד. עובד על חלק מהקבצים.
# עברית ב-PDF חוזרת לעיתים קרובות הפוכה או משובשת בלי להתריע, ולכן
# כל תוצאה מקבלת ציון ביטחון, ותוצאה חשודה מסומנת במקום להיבלע בשקט.

PDF_STREAM = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.S)
PDF_TEXT_OP = re.compile(rb"\((?:\\.|[^\\()])*\)")


def _pdf_extract(path: str) -> tuple[str, float]:
    """מחזיר (טקסט, ביטחון 0..1). ביטחון נמוך = אל תסמוך על זה."""
    try:
        with open(path, "rb") as fh:
            raw = fh.read(data.MAX_FILE_BYTES)
    except OSError:
        return "", 0.0

    chunks = []
    for blob in PDF_STREAM.findall(raw):
        try:
            blob = zlib.decompress(blob)
        except zlib.error:
            pass  # לא דחוס, או דחוס בדרך שאנחנו לא מפענחים
        for lit in PDF_TEXT_OP.findall(blob):
            try:
                s = lit[1:-1].decode("utf-8", "ignore")
            except Exception:
                continue
            s = s.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
            if s.strip():
                chunks.append(s)

    text = " ".join(chunks)
    if not text.strip():
        return "", 0.0

    # היוריסטיקת ביטחון: כמה מהתווים הם אותיות אמיתיות
    letters = sum(1 for c in text if c.isalpha())
    conf = letters / max(len(text), 1)

    # עברית הפוכה: סימן מובהק הוא ריבוי מילים עבריות שהיפוכן שכיח יותר.
    # לא ניתן לזהות בוודאות, לכן מורידים ביטחון על כל PDF עברי.
    if re.search(r"[֐-׿]", text):
        conf = min(conf, 0.45)

    return text, round(conf, 2)


# ── טעינת קובץ ────────────────────────────────────────────────────────

def _read_file(path: str) -> dict | None:
    ext = os.path.splitext(path)[1].lower()
    if ext not in data.READABLE_EXT:
        return None
    try:
        size = os.path.getsize(path)
    except OSError:
        return None
    if size > data.MAX_FILE_BYTES:
        return None

    confidence = 1.0
    if ext == ".pdf":
        body, confidence = _pdf_extract(path)
        meta = {}
        if not body.strip():
            body = ""  # נשאר כצומת בגרף, בלי תוכן לחיפוש
    else:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                text = fh.read(data.MAX_FILE_BYTES)
        except OSError:
            return None
        meta, body = parse_frontmatter(text)

    stem = os.path.splitext(os.path.basename(path))[0]
    title = meta.get("title") or stem
    kind = meta.get("type") or _infer_type(stem, path)
    kind = TYPE_ALIASES.get(kind, kind)

    try:
        mtime = os.path.getmtime(path)
    except OSError:
        mtime = 0.0
    date = meta.get("date") or datetime.date.fromtimestamp(
        mtime or time.time()).isoformat()

    return {
        "id": stem,
        "path": path,
        "file": os.path.basename(path),
        "title": title,
        "type": kind,
        "date": date,
        "body": body,
        "ext": ext,
        "confidence": confidence,
        "links": [l.strip() for l in WIKILINK.findall(body)],
        "tokens": tokenize(title + " " + title + " " + body),
        "chars": len(body),
    }


def _infer_type(stem: str, path: str) -> str:
    """בלי front-matter: מנחשים מהקידומת בשם הקובץ, אחרת מתיקיית האב."""
    head = stem.split("-", 1)[0]
    if head in TYPE_ALIASES.values() or head in TYPE_ALIASES:
        return TYPE_ALIASES.get(head, head)
    parent = os.path.basename(os.path.dirname(path))
    return parent if parent and parent != "demo" else "הערה"


# ── האינדקס ───────────────────────────────────────────────────────────

class Vault:
    def __init__(self):
        self.notes: dict[str, dict] = {}
        self.order: list[str] = []
        self.df: dict[str, int] = {}
        self.edges: list[tuple[str, str]] = []
        self.adj: dict[str, set[str]] = {}
        self.built_at = 0.0
        self.skipped: list[str] = []

    # ── בנייה ─────────────────────────────────────────────────────────
    def build(self) -> "Vault":
        self.__init__()
        for root_dir in data.sources():
            for dirpath, dirnames, filenames in os.walk(root_dir):
                dirnames[:] = [d for d in dirnames
                               if d not in data.SKIP_DIRS and not d.startswith(".")]
                for fn in sorted(filenames):
                    if fn.startswith("."):
                        continue
                    full = os.path.join(dirpath, fn)
                    note = _read_file(full)
                    if note is None:
                        if os.path.splitext(fn)[1].lower() in data.READABLE_EXT:
                            self.skipped.append(fn)
                        continue
                    # התנגשות שמות: הקובץ השני מקבל סיומת ייחודית
                    nid = note["id"]
                    if nid in self.notes:
                        nid = f"{nid}~{len(self.notes)}"
                        note["id"] = nid
                    self.notes[nid] = note
                    self.order.append(nid)

        self._index_terms()
        self._link()
        self.built_at = time.time()
        return self

    def _index_terms(self):
        for note in self.notes.values():
            for term in set(note["tokens"]):
                self.df[term] = self.df.get(term, 0) + 1

    def _link(self):
        # מפתח חיפוש רך: גם לפי id וגם לפי כותרת
        by_key: dict[str, str] = {}
        for nid, note in self.notes.items():
            by_key.setdefault(nid.lower(), nid)
            by_key.setdefault(note["title"].lower(), nid)

        self.adj = {nid: set() for nid in self.notes}
        seen = set()
        for nid, note in self.notes.items():
            for raw in note["links"]:
                target = by_key.get(raw.lower())
                if not target or target == nid:
                    continue
                self.adj[nid].add(target)
                self.adj[target].add(nid)
                pair = tuple(sorted((nid, target)))
                if pair not in seen:
                    seen.add(pair)
                    self.edges.append(pair)

    # ── שאילתות ───────────────────────────────────────────────────────
    def degree(self, nid: str) -> int:
        return len(self.adj.get(nid, ()))

    def hubs(self, n: int = 10) -> list[dict]:
        ranked = sorted(self.notes.values(),
                        key=lambda x: (-self.degree(x["id"]), x["title"]))
        return [{"id": x["id"], "title": x["title"], "type": x["type"],
                 "degree": self.degree(x["id"])} for x in ranked[:n]]

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for note in self.notes.values():
            out[note["type"]] = out.get(note["type"], 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """דירוג tf-idf פשוט + בונוס כותרת. מחזיר גם ציון, כדי שהניתוב
        יוכל להחליט אם בכלל שווה לענות מהקבצים."""
        terms = tokenize(query)
        if not terms or not self.notes:
            return []
        n_docs = len(self.notes)
        results = []
        for nid, note in self.notes.items():
            score = 0.0
            hit_terms = set()
            title_l = note["title"].lower()
            for term in terms:
                tf = note["tokens"].count(term)
                if not tf:
                    if term in title_l:
                        score += 1.2
                        hit_terms.add(term)
                    continue
                idf = math.log(1 + n_docs / (1 + self.df.get(term, 0)))
                score += (1 + math.log(tf)) * idf
                hit_terms.add(term)
                if term in title_l:
                    score += 2.0
            if score <= 0:
                continue
            # כיסוי: כמה מהמילים בשאלה בכלל הופיעו
            coverage = len(hit_terms) / len(terms)
            score *= 0.4 + 0.6 * coverage
            results.append({
                "id": nid,
                "title": note["title"],
                "file": note["file"],
                "type": note["type"],
                "date": note["date"],
                "score": round(score, 3),
                "coverage": round(coverage, 2),
                "confidence": note["confidence"],
                "excerpt": self._excerpt(note, terms),
                "degree": self.degree(nid),
            })
        results.sort(key=lambda r: -r["score"])
        return results[:limit]

    @staticmethod
    def _excerpt(note: dict, terms: list[str], width: int = 220) -> str:
        body = re.sub(r"\s+", " ", note["body"]).strip()
        if not body:
            return ""
        low = body.lower()
        pos = -1
        for term in terms:
            pos = low.find(term)
            if pos >= 0:
                break
        if pos < 0:
            return body[:width] + ("…" if len(body) > width else "")
        start = max(0, pos - width // 3)
        end = min(len(body), start + width)
        return ("…" if start else "") + body[start:end] + ("…" if end < len(body) else "")

    def path_between(self, a: str, b: str) -> list[str]:
        """המסלול הקצר ביותר. BFS — הגרף קטן."""
        if a not in self.adj or b not in self.adj:
            return []
        if a == b:
            return [a]
        prev = {a: None}
        queue = [a]
        while queue:
            nxt = []
            for node in queue:
                for neighbour in self.adj[node]:
                    if neighbour in prev:
                        continue
                    prev[neighbour] = node
                    if neighbour == b:
                        path = [b]
                        while prev[path[-1]] is not None:
                            path.append(prev[path[-1]])
                        return path[::-1]
                    nxt.append(neighbour)
            queue = nxt
        return []

    def graph(self) -> dict:
        return {
            "nodes": [{
                "id": nid,
                "title": n["title"],
                "type": n["type"],
                "date": n["date"],
                "degree": self.degree(nid),
                "chars": n["chars"],
                "file": n["file"],
                "confidence": n["confidence"],
            } for nid, n in self.notes.items()],
            "edges": [{"source": a, "target": b} for a, b in self.edges],
            "counts": self.counts(),
            "hubs": self.hubs(10),
        }

    def note(self, nid: str) -> dict | None:
        n = self.notes.get(nid)
        if not n:
            return None
        return {**{k: v for k, v in n.items() if k != "tokens"},
                "degree": self.degree(nid),
                "neighbours": sorted(self.adj.get(nid, ()))}


_VAULT: Vault | None = None


def get(rebuild: bool = False) -> Vault:
    global _VAULT
    if _VAULT is None or rebuild:
        _VAULT = Vault().build()
    return _VAULT


# ── שלב 1: הדפסת מה שנמצא ─────────────────────────────────────────────
if __name__ == "__main__":
    info = data.describe()
    print(f"מצב: {'דמו' if info['demo'] else 'נתונים אמיתיים'}")
    for s in info["sources"]:
        print(f"  מקור: {s}")
    if info["warning"]:
        print(f"  ⚠  {info['warning']}")

    v = get(rebuild=True)
    print(f"\nנמצאו {len(v.notes)} קבצים, {len(v.edges)} קשרים.\n")

    print("לפי סוג:")
    for kind, count in v.counts().items():
        print(f"  {count:>3}  {kind}")

    print("\n10 הצמתים המקושרים ביותר:")
    for i, hub in enumerate(v.hubs(10), 1):
        print(f"  {i:>2}. {hub['degree']:>2} קשרים   {hub['title']}  [{hub['type']}]")

    low = [n for n in v.notes.values() if n["confidence"] < 0.6]
    if low:
        print(f"\n⚠  {len(low)} קבצים עם חילוץ טקסט לא אמין (כנראה PDF):")
        for n in low[:5]:
            print(f"     {n['file']}  ביטחון {n['confidence']}")
    if v.skipped:
        print(f"\nדולגו {len(v.skipped)} קבצים (גדולים מדי או לא קריאים).")
