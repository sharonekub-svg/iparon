"""חיפוש אינטרנט חינמי, בלי מפתח ובלי חשבון.

זו הדרך השנייה לחפש. הראשונה היא כלי החיפוש של Anthropic (model.py),
שנותן תוצאות טובות יותר אבל עולה כסף. כאן מגרדים את הגרסה הקלה של
DuckDuckGo — חינם לגמרי, אבל שביר: אם הם ישנו את ה-HTML, זה יישבר,
ואז נגיד את זה בקול ולא נחזיר רשימה ריקה בשקט.
"""

import re
import html
import urllib.parse
import urllib.request

ENDPOINT = "https://lite.duckduckgo.com/lite/"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
TIMEOUT = 20

RESULT_LINK = re.compile(
    r'<a[^>]+class="result-link"[^>]*href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.S | re.I)
SNIPPET = re.compile(
    r'<td[^>]*class="result-snippet"[^>]*>(?P<text>.*?)</td>', re.S | re.I)
TAGS = re.compile(r"<[^>]+>")


class SearchUnavailable(Exception):
    """החיפוש לא זמין. נאמר בקול — אף פעם לא מחזירים ריק כאילו אין תוצאות."""


def _clean(fragment: str) -> str:
    return html.unescape(TAGS.sub("", fragment)).strip()


def _real_url(href: str) -> str:
    """DuckDuckGo עוטף לפעמים קישורים ב-redirect. מחלצים את היעד."""
    if href.startswith("//"):
        href = "https:" + href
    parsed = urllib.parse.urlparse(href)
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        target = urllib.parse.parse_qs(parsed.query).get("uddg")
        if target:
            return target[0]
    return href


def search(query: str, limit: int = 6) -> list[dict]:
    body = urllib.parse.urlencode({"q": query, "kl": "il-he"}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body,
        headers={"User-Agent": UA,
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            page = resp.read().decode("utf-8", "replace")
    except Exception as exc:
        raise SearchUnavailable(f"אין גישה למנוע החיפוש: {exc}") from exc

    links = list(RESULT_LINK.finditer(page))
    snippets = [_clean(m.group("text")) for m in SNIPPET.finditer(page)]

    if not links:
        raise SearchUnavailable(
            "מנוע החיפוש החזיר דף שאני לא יודע לקרוא. "
            "ייתכן שהמבנה שלו השתנה, או שהבקשה נחסמה.")

    out = []
    for i, m in enumerate(links[:limit]):
        out.append({
            "title": _clean(m.group("title")),
            "url": _real_url(html.unescape(m.group("url"))),
            "snippet": snippets[i] if i < len(snippets) else "",
        })
    return out


if __name__ == "__main__":
    import sys, json
    q = " ".join(sys.argv[1:]) or "רעיונות לאתר"
    try:
        print(json.dumps(search(q), ensure_ascii=False, indent=2))
    except SearchUnavailable as exc:
        print("נכשל:", exc)
