"""המוח: קריאה ל-Claude, כולל חיפוש אינטרנט אמיתי.

ספרייה סטנדרטית בלבד — אין pip install, ולכן HTTP גולמי ולא ה-SDK.
המפתח נשאר כאן בשרת. הוא לא מגיע לדפדפן לעולם.

חיפוש האינטרנט רץ בצד של Anthropic ככלי שרת (web_search), כך שאין
צורך במפתח נפרד לגוגל. יש לזה מחיר — ראה ledger.py ואת README.
"""

import os
import json
import time
import urllib.error
import urllib.request

import ledger

API_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
MODEL = os.environ.get("JARVIS_MODEL", "claude-opus-5")
EFFORT = os.environ.get("JARVIS_EFFORT", "medium")   # low | medium | high | xhigh | max
MAX_TOKENS = 8000
TIMEOUT = 180

# כלי חיפוש שרת. הווריאנט הזה נתמך ב-Opus 5 / 4.8 / 4.7 / 4.6 ו-Sonnet 5.
WEB_SEARCH_TOOL = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 6,
    "user_location": {
        "type": "approximate",
        "country": "IL",
        "timezone": "Asia/Jerusalem",
    },
}
# דגמים ישנים יותר תומכים רק בווריאנט הבסיסי
LEGACY_WEB_SEARCH = {"type": "web_search_20250305", "name": "web_search", "max_uses": 6}


class ModelUnavailable(Exception):
    """אין מפתח, אין רשת, או ה-API סירב. תמיד נאמר בקול, לעולם לא בשקט."""


def api_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    return key or None


def available() -> bool:
    return api_key() is not None


def status() -> dict:
    return {
        "available": available(),
        "model": MODEL,
        "effort": EFFORT,
        "web_search": available(),
        "reason": None if available() else
                  "אין ANTHROPIC_API_KEY. ג'ארוויס רץ במצב ללא מודל.",
    }


def _post(payload: dict) -> dict:
    key = api_key()
    if not key:
        raise ModelUnavailable("אין ANTHROPIC_API_KEY")

    req = urllib.request.Request(
        f"{API_URL}/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:400]
        if exc.code == 401:
            raise ModelUnavailable("המפתח נדחה (401). בדוק את ANTHROPIC_API_KEY.") from exc
        if exc.code == 429:
            raise ModelUnavailable("חריגה ממכסת הבקשות (429). נסה בעוד רגע.") from exc
        if exc.code == 400 and "credit" in body.lower():
            raise ModelUnavailable("אין יתרה בחשבון ה-API.") from exc
        raise ModelUnavailable(f"שגיאת API {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise ModelUnavailable(f"אין חיבור ל-API: {exc.reason}") from exc


def _uses_modern_search() -> bool:
    return any(tag in MODEL for tag in
               ("opus-5", "opus-4-8", "opus-4-7", "opus-4-6", "sonnet-5", "sonnet-4-6",
                "fable-5", "mythos-5"))


def converse(system: str, messages: list[dict], local_tools: list[dict],
             run_local_tool, web: bool = True) -> dict:
    """סבב שיחה מלא, כולל לולאת כלים.

    מחזיר: {"text", "cards", "tools_used", "sources", "usage", "searches"}
    """
    ledger.assert_under_cap()

    tools = list(local_tools)
    if web:
        tools.append(WEB_SEARCH_TOOL if _uses_modern_search() else LEGACY_WEB_SEARCH)

    convo = list(messages)
    cards: list[dict] = []
    sources: list[dict] = []
    used: list[str] = []
    searches = 0
    in_tok = out_tok = 0

    for _turn in range(8):
        payload = {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "system": system,
            "messages": convo,
            "tools": tools,
            "output_config": {"effort": EFFORT},
        }
        resp = _post(payload)

        usage = resp.get("usage", {})
        in_tok += usage.get("input_tokens", 0)
        out_tok += usage.get("output_tokens", 0)

        content = resp.get("content", [])
        stop = resp.get("stop_reason")

        if stop == "refusal":
            detail = (resp.get("stop_details") or {}).get("explanation") or ""
            raise ModelUnavailable(f"המודל סירב לענות. {detail}".strip())

        # תוצאות חיפוש -> מקורות לכרטיס
        for block in content:
            if block.get("type") == "web_search_tool_result":
                searches += 1
                body = block.get("content")
                if isinstance(body, dict) and body.get("error_code"):
                    cards.append({
                        "kind": "error",
                        "title": "החיפוש נכשל",
                        "body": f"קוד: {body['error_code']}",
                    })
                    continue
                for item in (body or []):
                    if item.get("type") == "web_search_result":
                        sources.append({
                            "title": item.get("title") or item.get("url", ""),
                            "url": item.get("url", ""),
                            "age": item.get("page_age"),
                        })

        # pause_turn: המודל עצר באמצע פעולה ארוכה — ממשיכים אותו
        if stop == "pause_turn":
            convo.append({"role": "assistant", "content": content})
            continue

        if stop != "tool_use":
            ledger.record(MODEL, in_tok, out_tok, searches)
            return {
                "text": _text_of(content),
                "cards": cards,
                "tools_used": used,
                "sources": _dedupe(sources),
                "searches": searches,
                "usage": {"input": in_tok, "output": out_tok},
            }

        # כלים מקומיים
        convo.append({"role": "assistant", "content": content})
        results = []
        for block in content:
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            used.append(name)
            try:
                out = run_local_tool(name, block.get("input") or {})
            except Exception as exc:  # כלי שנפל לא מפיל את השיחה
                results.append({
                    "type": "tool_result", "tool_use_id": block["id"],
                    "is_error": True,
                    "content": f"הכלי {name} נכשל: {exc}",
                })
                cards.append({"kind": "error", "title": f"הכלי {name} נכשל",
                              "body": str(exc)})
                continue
            if out.get("card"):
                cards.append(out["card"])
            results.append({
                "type": "tool_result", "tool_use_id": block["id"],
                "content": out.get("for_model", out.get("spoken", "")),
            })
        convo.append({"role": "user", "content": results})

    ledger.record(MODEL, in_tok, out_tok, searches)
    return {
        "text": "נתקעתי בלולאה של כלים ועצרתי.",
        "cards": cards, "tools_used": used, "sources": _dedupe(sources),
        "searches": searches, "usage": {"input": in_tok, "output": out_tok},
    }


def _text_of(content: list[dict]) -> str:
    return "\n".join(b.get("text", "") for b in content
                     if b.get("type") == "text").strip()


def _dedupe(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for it in items:
        if it["url"] in seen:
            continue
        seen.add(it["url"])
        out.append(it)
    return out
