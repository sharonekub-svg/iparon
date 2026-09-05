"""תזמור השיחה.

אחראי על: הרכבת הפרומפט, זיכרון השיחה (10 תורות), והמסלול החלופי
כשאין מודל. המסלול החלופי אף פעם לא מתחזה למודל — הוא מסמן את עצמו.
"""

import os
import collections

import data
import vault
import tools
import model
import memory
import ledger
import websearch

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPT_FILE = os.path.join(HERE, "prompt.md")
CLAUDE_MD = os.path.join(os.path.dirname(HERE), "CLAUDE.md")

MAX_TURNS = 10
_history: collections.deque = collections.deque(maxlen=MAX_TURNS * 2)


def search_mode() -> str:
    """auto | anthropic | free — איזה מנוע חיפוש בשימוש."""
    mode = os.environ.get("JARVIS_SEARCH", "auto").strip().lower()
    if mode not in ("auto", "anthropic", "free"):
        mode = "auto"
    if mode == "auto":
        return "anthropic" if model.available() else "free"
    return mode


def _read(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return ""


def build_system() -> str:
    parts = [_read(PROMPT_FILE)]

    who = _read(CLAUDE_MD)
    if who:
        parts.append("## מי זה שרון\n\n" + who)

    facts = memory.as_context()
    if facts:
        parts.append("## מה שביקש שאזכור\n\n" + facts)

    v = vault.get()
    info = data.describe()
    stat = [f"מצב נתונים: {'דמו' if info['demo'] else 'אמיתי'}",
            f"קבצים באינדקס: {len(v.notes)}, קשרים: {len(v.edges)}"]
    if v.notes:
        stat.append("סוגים: " + ", ".join(
            f"{k} ({n})" for k, n in v.counts().items()))
    if info["warning"]:
        stat.append("אזהרה: " + info["warning"])
    parts.append("## מצב המערכת\n\n" + "\n".join(stat))

    return "\n\n".join(p for p in parts if p)


def history() -> list[dict]:
    return list(_history)


def reset_history():
    _history.clear()


def ask(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return _reply("לא שמעתי כלום.", degraded="empty")

    if not model.available():
        return _no_model(text)

    _history.append({"role": "user", "content": text})
    mode = search_mode()
    use_native_search = mode == "anthropic"

    try:
        out = model.converse(
            system=build_system(),
            messages=list(_history),
            local_tools=tools.definitions(include_web=(mode == "free")),
            run_local_tool=tools.run,
            web=use_native_search,
        )
    except ledger.SpendCapReached as exc:
        _history.pop()
        return _reply(str(exc), degraded="spend_cap",
                      cards=[{"kind": "error", "title": "תקרת הוצאה",
                              "body": str(exc)}])
    except model.ModelUnavailable as exc:
        _history.pop()
        ledger.record(model.MODEL, 0, 0, 0, failed=True)
        return _reply(f"המודל לא זמין. {exc}", degraded="model_error",
                      cards=[{"kind": "error", "title": "המודל לא זמין",
                              "body": str(exc)}])

    answer = out["text"] or "לא יצא לי משפט. נסה לנסח אחרת."
    _history.append({"role": "assistant", "content": answer})

    cards = list(out["cards"])
    if out["sources"]:
        cards.append({"kind": "web", "title": "מקורות מהרשת",
                      "query": text[:80],
                      "results": [{"title": s["title"], "url": s["url"],
                                   "snippet": ""} for s in out["sources"]]})
    return _reply(answer, cards=cards, tools_used=out["tools_used"],
                  usage=out["usage"], searches=out["searches"])


# ── בלי מודל ──────────────────────────────────────────────────────────

GREETING = {"שלום", "היי", "הי", "הלו", "אהלן", "מה נשמע", "מה קורה",
            "בוקר טוב", "ערב טוב", "לילה טוב", "תודה", "hello", "hi"}


def _looks_like_smalltalk(text: str) -> bool:
    low = text.strip().lower().rstrip("?!.")
    if low in GREETING:
        return True
    return len(low.split()) <= 3 and any(g in low for g in GREETING)


def _no_model(text: str) -> dict:
    """אין מודל. מנתבים לפי ציון מול הקבצים, ואומרים את זה במפורש."""
    banner = ("אני רץ בלי מודל שפה — אין ANTHROPIC_API_KEY. "
              "זה ניתוב לפי מילים, לא הבנה.")

    if _looks_like_smalltalk(text):
        return _reply("שומע אותך. " + banner, degraded="no_model")

    v = vault.get()
    hits = v.search(text, limit=4)
    strong = [h for h in hits if h["score"] >= 2.0]

    if strong:
        files = ", ".join(h["file"] for h in strong)
        return _reply(
            f"בלי מודל אני יכול רק להצביע על קבצים. {len(strong)} מתאימים: {files}. "
            + banner,
            degraded="no_model", tools_used=["search_brain"],
            cards=[{"kind": "search", "title": f"בקבצים: {text[:60]}",
                    "query": text, "results": strong}])

    # אין התאמה בקבצים — מנסים חיפוש חינמי ברשת
    try:
        results = websearch.search(text, limit=5)
    except websearch.SearchUnavailable as exc:
        return _reply(
            f"אין התאמה בקבצים, והחיפוש ברשת לא זמין. {exc} " + banner,
            degraded="no_model",
            cards=[{"kind": "error", "title": "אין מודל ואין חיפוש",
                    "body": str(exc)}])

    return _reply(
        f"מצאתי {len(results)} תוצאות ברשת. אני לא יכול לסכם אותן בלי מודל — "
        "הן על המסך. " + banner,
        degraded="no_model", tools_used=["research_web"],
        cards=[{"kind": "web", "title": f"ברשת: {text[:60]}",
                "query": text, "results": results}])


def _reply(text: str, cards=None, tools_used=None, degraded=None,
           usage=None, searches=0) -> dict:
    return {
        "text": text,
        "cards": cards or [],
        "tools_used": tools_used or [],
        "degraded": degraded,
        "usage": usage or {},
        "searches": searches,
        "spend": ledger.summary(),
        "model": model.status(),
        "search_mode": search_mode(),
    }
