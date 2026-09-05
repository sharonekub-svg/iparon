"""ספר חשבונות. כל קריאה למודל נרשמת, כולל כשלונות.

מעל התקרה — עצירה מלאה, עם הודעה ברורה. בלי הפתעות בסוף החודש.
"""

import os
import json
import time
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_DIR = os.path.join(os.path.dirname(HERE), ".state")
LEDGER = os.path.join(STATE_DIR, "spend.json")

# דולר למיליון טוקנים. נכון ל-2026-09; מחירים משתנים — ראה README.
PRICES = {
    "claude-opus-5":    (5.00, 25.00),
    "claude-opus-4-8":  (5.00, 25.00),
    "claude-sonnet-5":  (2.00, 10.00),
    "claude-haiku-4-5": (1.00,  5.00),
    "claude-fable-5-1": (10.00, 50.00),
}
DEFAULT_PRICE = (5.00, 25.00)

# חיפוש אינטרנט: 10 דולר ל-1000 חיפושים
SEARCH_USD = 10.0 / 1000


class SpendCapReached(Exception):
    pass


def cap_usd() -> float:
    try:
        return float(os.environ.get("JARVIS_SPEND_CAP_USD", "2.00"))
    except ValueError:
        return 2.00


def _load() -> dict:
    try:
        with open(LEDGER, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"total_usd": 0.0, "calls": 0, "searches": 0, "entries": []}


def _save(state: dict):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = LEDGER + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, LEDGER)


def cost_of(model: str, in_tok: int, out_tok: int, searches: int = 0) -> float:
    price_in, price_out = PRICES.get(model, DEFAULT_PRICE)
    return (in_tok / 1e6 * price_in
            + out_tok / 1e6 * price_out
            + searches * SEARCH_USD)


def record(model: str, in_tok: int, out_tok: int, searches: int = 0,
           failed: bool = False) -> dict:
    state = _load()
    usd = cost_of(model, in_tok, out_tok, searches)
    state["total_usd"] = round(state.get("total_usd", 0.0) + usd, 6)
    state["calls"] = state.get("calls", 0) + 1
    state["searches"] = state.get("searches", 0) + searches
    state.setdefault("entries", []).append({
        "at": datetime.datetime.now().isoformat(timespec="seconds"),
        "model": model, "in": in_tok, "out": out_tok,
        "searches": searches, "usd": round(usd, 6), "failed": failed,
    })
    state["entries"] = state["entries"][-300:]   # לא נותנים לקובץ לתפוח
    _save(state)
    return state


def summary() -> dict:
    state = _load()
    cap = cap_usd()
    total = state.get("total_usd", 0.0)
    return {
        "total_usd": round(total, 4),
        "total_ils": round(total * 3.7, 2),      # שער מקורב, להמחשה בלבד
        "cap_usd": cap,
        "remaining_usd": round(max(cap - total, 0), 4),
        "calls": state.get("calls", 0),
        "searches": state.get("searches", 0),
        "blocked": total >= cap,
    }


def assert_under_cap():
    s = summary()
    if s["blocked"]:
        raise SpendCapReached(
            f"נעצרתי: הגעת לתקרת ההוצאה ({s['cap_usd']:.2f}$). "
            f"הוצאת עד עכשיו {s['total_usd']:.2f}$. "
            "להמשיך — הרם את JARVIS_SPEND_CAP_USD."
        )


def reset():
    _save({"total_usd": 0.0, "calls": 0, "searches": 0, "entries": []})
