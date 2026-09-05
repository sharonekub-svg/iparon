"""חיפוש אינטרנט חינמי, בלי מפתח ובלי חשבון.

זו הדרך השנייה לחפש. הראשונה היא כלי החיפוש של Anthropic (model.py),
שנותן תוצאות טובות יותר אבל עולה כסף.

כאן מגרדים מנועי חיפוש שמגישים HTML פשוט. זה שביר במהות: מנועי חיפוש
חוסמים בקשות אוטומטיות, וכשזה קורה נגיד את זה בקול ולא נחזיר רשימה
ריקה בשקט. יש כאן שלושה מנועים בשרשרת — אם אחד נחסם, מנסים את הבא.

לאבחון:  python agent/websearch.py --diag
"""

import re
import ssl
import html
import socket
import urllib.parse
import urllib.error
import urllib.request

TIMEOUT = 20

# כותרות של דפדפן אמיתי. בלעדיהן חלק מהמנועים מנתקים מיד.
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/131.0.0.0 Safari/537.36"),
    "Accept": ("text/html,application/xhtml+xml,application/xml;q=0.9,"
               "image/avif,image/webp,*/*;q=0.8"),
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "close",
}

TAGS = re.compile(r"<[^>]+>")

# סורקים אלמנטים ומסווגים לפי ה-class, במקום להניח סדר תכונות.
# הגרסה הקודמת דרשה ש-class יופיע לפני href, וב-HTML האמיתי הסדר הפוך —
# ולכן היא לא מצאה כלום.
A_RE = re.compile(r"<a\s+([^>]*?)>(.*?)</a>", re.S | re.I)
TD_RE = re.compile(r"<td\s+([^>]*?)>(.*?)</td>", re.S | re.I)
ATTR_RE = re.compile(r'([\w-]+)\s*=\s*"([^"]*)"', re.S)

# שמות ה-class שמסמנים תוצאה, בכל שלושת המנועים
LINK_CLASSES = ("result-link", "result__a")
SNIP_CLASSES = ("result-snippet", "result__snippet")


def _attrs(raw: str) -> dict:
    return {k.lower(): v for k, v in ATTR_RE.findall(raw)}


class SearchUnavailable(Exception):
    """החיפוש לא זמין. נאמר בקול — אף פעם לא מחזירים ריק כאילו אין תוצאות."""


def _clean(fragment: str) -> str:
    return html.unescape(TAGS.sub("", fragment)).strip()


def _real_url(href: str) -> str:
    """המנועים עוטפים לפעמים קישורים ב-redirect. מחלצים את היעד."""
    href = html.unescape(href)
    if href.startswith("//"):
        href = "https:" + href
    parsed = urllib.parse.urlparse(href)
    if "duckduckgo.com" in parsed.netloc and "/l/" in parsed.path:
        target = urllib.parse.parse_qs(parsed.query).get("uddg")
        if target:
            return urllib.parse.unquote(target[0])
    return href


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read()
    return raw.decode("utf-8", "replace")


def _parse(page: str, limit: int) -> list[dict]:
    """סורק את הדף לפי סדר, ומזווג כל קישור-תוצאה עם התקציר שאחריו."""
    found = []
    for regex in (A_RE, TD_RE):
        for m in regex.finditer(page):
            found.append((m.start(), _attrs(m.group(1)), m.group(2)))
    found.sort(key=lambda item: item[0])

    results, pending = [], None
    for _pos, attrs, inner in found:
        cls = attrs.get("class", "")
        if any(c in cls for c in LINK_CLASSES):
            if pending:
                results.append(pending)
            url = _real_url(attrs.get("href", ""))
            title = _clean(inner)
            pending = ({"title": title, "url": url, "snippet": ""}
                       if title and url.startswith("http") else None)
        elif pending and any(c in cls for c in SNIP_CLASSES):
            pending["snippet"] = _clean(inner)
            results.append(pending)
            pending = None
        if len(results) >= limit:
            return results[:limit]
    if pending:
        results.append(pending)
    return results[:limit]


# שרשרת המנועים. הראשון שמחזיר תוצאות מנצח.
ENGINES = [
    ("lite.duckduckgo.com",
     lambda q: "https://lite.duckduckgo.com/lite/?" + urllib.parse.urlencode({"q": q})),
    ("html.duckduckgo.com",
     lambda q: "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": q})),
    ("duckduckgo.com/html",
     lambda q: "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": q})),
]


def _why(exc: Exception) -> str:
    """תרגום שגיאת רשת למשהו שאפשר לפעול לפיו."""
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code in (403, 429):
            return f"נחסם ({exc.code}) — המנוע מזהה בקשה אוטומטית"
        return f"שגיאת HTTP {exc.code}"
    if isinstance(exc, urllib.error.URLError):
        reason = exc.reason
        if isinstance(reason, ssl.SSLError):
            return "כשל TLS"
        if isinstance(reason, socket.timeout):
            return "פסק זמן"
        text = str(reason)
        if "10054" in text or "reset" in text.lower():
            return "החיבור נותק בכוח — חסימה של המנוע או של הרשת"
        if "10060" in text or "timed out" in text.lower():
            return "פסק זמן — כנראה חסימה ברמת הרשת"
        return text
    return str(exc)


def search(query: str, limit: int = 6) -> list[dict]:
    tried = []
    for name, url_of in ENGINES:
        try:
            page = _fetch(url_of(query))
        except Exception as exc:
            tried.append(f"{name}: {_why(exc)}")
            continue
        results = _parse(page, limit)
        if results:
            return results
        tried.append(f"{name}: ענה, אבל בלי תוצאות שידעתי לקרוא")

    raise SearchUnavailable(
        "כל מנועי החיפוש החינמיים נכשלו. " + " | ".join(tried))


# ── אבחון ─────────────────────────────────────────────────────────────

def diagnose():
    """בודק מה בדיוק נחסם: האינטרנט בכלל, או רק מנועי החיפוש."""
    print("בודק גישה לרשת. זה לוקח כמה שניות.\n")

    checks = [
        ("האינטרנט בכלל", "https://example.com/"),
        ("Anthropic (למוח)", "https://api.anthropic.com/v1/models"),
        ("ElevenLabs (לקול)", "https://api.elevenlabs.io/v1/models"),
        ("lite.duckduckgo.com", "https://lite.duckduckgo.com/lite/?q=test"),
        ("html.duckduckgo.com", "https://html.duckduckgo.com/html/?q=test"),
        ("duckduckgo.com", "https://duckduckgo.com/html/?q=test"),
    ]

    reached, dns_failed, search_ok = [], [], []
    for label, url in checks:
        is_search = "duckduckgo" in url
        try:
            req = urllib.request.Request(url, headers=HEADERS, method="GET")
            with urllib.request.urlopen(req, timeout=15) as resp:
                size = len(resp.read(4000))
            print(f"  ✓  {label:<24} עונה ({resp.status}, {size} בייטים)")
            reached.append(label)
            if is_search:
                search_ok.append(label)
        except urllib.error.HTTPError as exc:
            # כל תשובת HTTP — גם 401 וגם 404 — מוכיחה שהגענו לשרת.
            # רק חסימה אמיתית מסומנת באיקס.
            blocked = exc.code in (403, 429)
            note = {401: " (הגענו — חסר מפתח)",
                    404: " (הגענו — הנתיב לא קיים, וזה בסדר)",
                    403: " (נחסם)", 429: " (יותר מדי בקשות)"}.get(exc.code, " (הגענו)")
            print(f"  {'✗' if blocked else '✓'}  {label:<24} HTTP {exc.code}{note}")
            if not blocked:
                reached.append(label)
                if is_search:
                    search_ok.append(label)
        except Exception as exc:
            why = _why(exc)
            print(f"  ✗  {label:<24} {why}")
            if "getaddrinfo" in why or "11001" in why:
                dns_failed.append(label)

    print()
    if not reached:
        print("מסקנה: אין גישה לאינטרנט מפייתון בכלל.")
        print("  כנראה חומת אש, אנטי-וירוס, או רשת של בית ספר.")
    elif search_ok:
        print("מסקנה: החיפוש החינמי אמור לעבוד.")
        print(f"  {len(search_ok)} מנועים ענו. נסה:  python agent/websearch.py רעיונות לאתר")
    else:
        print("מסקנה: האינטרנט עובד, אבל מנועי החיפוש חוסמים בקשות אוטומטיות.")
        print("  זה לא משהו שמתקנים בקוד. הפתרון הוא מפתח Anthropic,")
        print("  שנותן חיפוש אמיתי דרך השרתים שלהם.")

    if dns_failed:
        print()
        print(f"  הערה: {', '.join(dns_failed)} נכשל בפענוח שם (DNS) בלבד.")
        print("  זה לא מעיד על שאר החיבורים — הם נבדקו בנפרד.")


if __name__ == "__main__":
    import sys, json
    args = sys.argv[1:]
    if not args or args[0] == "--diag":
        diagnose()
    else:
        try:
            print(json.dumps(search(" ".join(args)), ensure_ascii=False, indent=2))
        except SearchUnavailable as exc:
            print("נכשל:", exc)
