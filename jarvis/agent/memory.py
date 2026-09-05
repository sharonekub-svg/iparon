"""זיכרון: עובדה אחת, קובץ מתוארך אחד.

זה המקום היחיד בכל הפרויקט שכותב לדיסק תוכן של המשתמש.
כל כתיבה מחזירה בדיוק מה נכתב, כדי שאפשר יהיה להקריא את זה בקול.
"""

import os
import re
import datetime

import data

SAFE = re.compile(r"[^\w֐-׿ -]+")


def _slug(text: str, limit: int = 48) -> str:
    s = SAFE.sub("", text).strip()
    s = re.sub(r"\s+", "-", s)
    return (s[:limit].rstrip("-") or "עובדה")


def write(fact: str, tag: str = "") -> dict:
    """כותב עובדה אחת. מחזיר את הנתיב ואת הטקסט המדויק שנשמר."""
    fact = (fact or "").strip()
    if not fact:
        raise ValueError("אין מה לשמור — הטקסט ריק.")
    if len(fact) > 2000:
        raise ValueError("ארוך מדי לעובדה אחת. פצל לשתיים.")

    now = datetime.datetime.now()
    folder = data.memory_dir()
    base = f"{now:%Y-%m-%d}-{_slug(fact)}"

    path = os.path.join(folder, base + ".md")
    n = 2
    while os.path.exists(path):
        path = os.path.join(folder, f"{base}-{n}.md")
        n += 1

    body = (
        "---\n"
        f"date: {now:%Y-%m-%d %H:%M}\n"
        f"tag: {tag or 'כללי'}\n"
        "source: נאמר לג'ארוויס\n"
        "---\n\n"
        f"{fact}\n"
    )
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)

    return {"path": path, "file": os.path.basename(path),
            "fact": fact, "tag": tag or "כללי",
            "date": f"{now:%Y-%m-%d %H:%M}"}


def read_all() -> list[dict]:
    folder = data.memory_dir()
    out = []
    for name in sorted(os.listdir(folder), reverse=True):
        if not name.endswith(".md"):
            continue
        full = os.path.join(folder, name)
        try:
            with open(full, encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        meta, body = {}, text
        if text.startswith("---"):
            _, _, rest = text.partition("---\n")
            head, _, body = rest.partition("---\n")
            for line in head.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
        out.append({"file": name, "date": meta.get("date", name[:10]),
                    "tag": meta.get("tag", "כללי"), "fact": body.strip()})
    return out


def as_context(limit: int = 40) -> str:
    """הזיכרון כטקסט לתוך הפרומפט."""
    items = read_all()[:limit]
    if not items:
        return ""
    lines = [f"- ({it['date']}) {it['fact']}" for it in items]
    return "\n".join(lines)
