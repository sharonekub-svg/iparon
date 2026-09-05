"""הקובץ היחיד שיודע איפה הנתונים האמיתיים.

JARVIS_DEMO=1 (ברירת מחדל) -> data/demo, פיקציה מלאה, בטוח להקלטת מסך.
JARVIS_DEMO=0                -> התיקיות האמיתיות מ-JARVIS_VAULT.

שום קובץ אחר בפרויקט לא קורא את משתני הסביבה האלה. אם צריך לדעת
"על מה ג'ארוויס מסתכל", התשובה נמצאת כאן ורק כאן.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DEMO_DIR = os.path.join(ROOT, "data", "demo")
MEMORY_DIR = os.path.join(ROOT, "memory")

# גודל מקסימלי לקובץ בודד — מעבר לזה מדלגים
MAX_FILE_BYTES = 2 * 1024 * 1024

SKIP_DIRS = {
    "node_modules", ".git", ".next", "dist", "build", "__pycache__",
    ".venv", "venv", ".cache", "vendor", ".obsidian", ".trash",
}

READABLE_EXT = {".md", ".markdown", ".txt", ".pdf"}


def is_demo() -> bool:
    """ברירת המחדל היא דמו. צריך לבחור במפורש לצאת ממנו."""
    return os.environ.get("JARVIS_DEMO", "1").strip() != "0"


def sources() -> list[str]:
    """התיקיות שג'ארוויס קורא מהן. קריאה בלבד, תמיד."""
    if is_demo():
        return [DEMO_DIR]

    raw = os.environ.get("JARVIS_VAULT", "").strip()
    if not raw:
        return []
    out = []
    for part in raw.split(os.pathsep):
        part = os.path.expanduser(part.strip())
        if part and os.path.isdir(part):
            out.append(os.path.abspath(part))
    return out


def describe() -> dict:
    """תיאור המצב לתצוגה בממשק — כולל אזהרה כשאין מקור."""
    src = sources()
    return {
        "demo": is_demo(),
        "sources": src,
        "ok": bool(src),
        "warning": (
            None if src else
            ("JARVIS_DEMO=0 אבל JARVIS_VAULT ריק או לא קיים — "
             "אין תיקייה לקרוא ממנה.")
        ),
    }


def memory_dir() -> str:
    """המקום היחיד שמותר לכתוב אליו."""
    os.makedirs(MEMORY_DIR, exist_ok=True)
    return MEMORY_DIR
