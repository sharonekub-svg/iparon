#!/usr/bin/env python3
"""ג'ארוויס — שרת HTTP + API.

ספרייה סטנדרטית בלבד. הרצה:  python3 agent/main.py
"""

import os
import sys
import json
import socket
import mimetypes
import http.server
import socketserver
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UI = os.path.join(ROOT, "ui")
sys.path.insert(0, HERE)

# בקונסולה של ווינדוס קידוד ברירת המחדל אינו UTF-8, והדפסת עברית
# מפילה את התוכנית ב-UnicodeEncodeError לפני שהשרת בכלל עולה.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


# ── .env ──────────────────────────────────────────────────────────────
def load_env():
    """טוען .env לפני כל השאר. לא דורס משתנים שכבר קיימים."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    if os.name != "nt":   # לווינדוס אין הרשאות יוניקס — האזהרה תהיה שקרית
        mode = os.stat(path).st_mode & 0o777
        if mode & 0o077:
            print(f"⚠  ל-.env יש הרשאות {oct(mode)}. הרץ: chmod 600 .env")
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


load_env()

import data      # noqa: E402
import vault     # noqa: E402
import brain     # noqa: E402
import tools     # noqa: E402
import model     # noqa: E402
import voice     # noqa: E402
import memory    # noqa: E402
import ledger    # noqa: E402

MAX_BODY = 25 * 1024 * 1024   # הקלטה של דקה נכנסת בנוח


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "Jarvis"
    protocol_version = "HTTP/1.1"

    # ── עזרים ─────────────────────────────────────────────────────────
    def _send(self, code: int, body: bytes, ctype: str, extra: dict = None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        # הכל מקומי; אין מקור חיצוני שמותר לו לפנות לשרת הזה
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, payload, code: int = 200):
        self._send(code, json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    def _error(self, code: int, message: str):
        self._json({"error": message}, code)

    def _body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        if length > MAX_BODY:
            raise ValueError("הבקשה גדולה מדי")
        return self.rfile.read(length)

    def _json_body(self) -> dict:
        raw = self._body()
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except ValueError as exc:
            raise ValueError(f"JSON לא תקין: {exc}") from exc

    def parse_request(self) -> bool:
        """מקדימים לקודד באחוזים כל בייט לא-ASCII בשורת הבקשה.

        http.server מפענח את השורה כ-latin-1 ואז מפצל על רווחים. הבייט
        השני של האות נ הוא 0xA0, שהוא NO-BREAK SPACE ב-latin-1 — ולכן
        כל כתובת שמכילה נ בעברית גולמית נדחית כ-400. הקידוד כאן מייתר
        את זה, ודפדפן שמקודד לבד ממילא לא מושפע.
        """
        raw = self.raw_requestline
        if any(b > 0x7F for b in raw):
            out = bytearray()
            for b in raw:
                if b > 0x7F:
                    out += b"%%%02X" % b
                else:
                    out.append(b)
            self.raw_requestline = bytes(out)
        return super().parse_request()

    def _path(self) -> str:
        """שורת הבקשה מפוענחת כ-latin-1 ב-http.server. מחזירים אותה ל-UTF-8,
        אחרת כל נתיב עם עברית גולמית נשבר."""
        try:
            return self.path.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return self.path

    def log_message(self, fmt, *args):
        if os.environ.get("JARVIS_VERBOSE"):
            super().log_message(fmt, *args)

    # ── GET ───────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self._path())
        path = urllib.parse.unquote(parsed.path)
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            return self._static("index.html")
        if path.startswith("/ui/"):
            return self._static(path[4:])

        if path == "/api/status":
            return self._json(self._status())
        if path == "/api/graph":
            return self._json(vault.get().graph())
        if path == "/api/note":
            nid = (query.get("id") or [""])[0]
            note = vault.get().note(nid)
            return self._json(note) if note else self._error(404, "אין הערה כזאת")
        if path == "/api/path":
            a = (query.get("a") or [""])[0]
            b = (query.get("b") or [""])[0]
            return self._json({"path": vault.get().path_between(a, b)})
        if path == "/api/memory":
            return self._json({"items": memory.read_all()})
        if path == "/api/spend":
            return self._json(ledger.summary())
        if path == "/api/history":
            return self._json({"turns": brain.history()})

        return self._error(404, "אין נתיב כזה")

    def _status(self) -> dict:
        v = vault.get()
        info = data.describe()
        return {
            "vault": {
                "demo": info["demo"], "ok": info["ok"],
                "warning": info["warning"],
                "sources": [os.path.basename(s) for s in info["sources"]],
                "notes": len(v.notes), "edges": len(v.edges),
                "counts": v.counts(), "hubs": v.hubs(8),
            },
            "model": model.status(),
            "voice": voice.status(),
            "search_mode": brain.search_mode(),
            "spend": ledger.summary(),
            "memory": len(memory.read_all()),
        }

    def _static(self, rel: str):
        rel = rel.lstrip("/")
        full = os.path.normpath(os.path.join(UI, rel))
        if not full.startswith(UI) or not os.path.isfile(full):
            return self._error(404, "אין קובץ כזה")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype == "application/javascript":
            ctype += "; charset=utf-8"
        with open(full, "rb") as fh:
            self._send(200, fh.read(), ctype)

    # ── POST ──────────────────────────────────────────────────────────
    def do_POST(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self._path()).path)
        try:
            if path == "/api/ask":
                body = self._json_body()
                return self._json(brain.ask(body.get("text", "")))

            if path == "/api/tool":
                body = self._json_body()
                name = body.get("name", "")
                if name not in tools.REGISTRY:
                    return self._error(400, f"אין כלי בשם {name}")
                out = tools.run(name, body.get("args") or {})
                return self._json({"text": out["spoken"],
                                   "cards": [out["card"]] if out.get("card") else [],
                                   "tools_used": [name],
                                   "direct": True})

            if path == "/api/speak":
                body = self._json_body()
                try:
                    audio = voice.speak(body.get("text", ""))
                except voice.VoiceUnavailable as exc:
                    return self._error(503, str(exc))
                return self._send(200, audio, "audio/mpeg")

            if path == "/api/listen":
                raw = self._body()
                mime = self.headers.get("Content-Type") or "audio/webm"
                try:
                    return self._json(voice.listen(raw, mime))
                except voice.VoiceUnavailable as exc:
                    return self._error(503, str(exc))

            if path == "/api/reindex":
                v = vault.get(rebuild=True)
                return self._json({"notes": len(v.notes), "edges": len(v.edges),
                                   "counts": v.counts()})

            if path == "/api/reset":
                brain.reset_history()
                return self._json({"ok": True})

            return self._error(404, "אין נתיב כזה")

        except ValueError as exc:
            return self._error(400, str(exc))
        except Exception as exc:                     # לא נופלים בשקט
            import traceback
            if os.environ.get("JARVIS_VERBOSE"):
                traceback.print_exc()
            return self._error(500, f"שגיאת שרת: {exc}")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = int(os.environ.get("JARVIS_PORT", "8765"))
    host = os.environ.get("JARVIS_HOST", "127.0.0.1")

    info = data.describe()
    v = vault.get(rebuild=True)

    print("─" * 58)
    print("  ג'ארוויס")
    print("─" * 58)
    print(f"  נתונים : {'דמו (בטוח להקלטה)' if info['demo'] else 'אמיתי'}")
    print(f"  אינדקס : {len(v.notes)} קבצים, {len(v.edges)} קשרים")
    if info["warning"]:
        print(f"  ⚠      : {info['warning']}")

    ms, vs = model.status(), voice.status()
    print(f"  מודל   : {ms['model'] if ms['available'] else 'חסר — ' + ms['reason']}")
    print(f"  חיפוש  : {brain.search_mode()}"
          + ("  (חינם, DuckDuckGo)" if brain.search_mode() == "free"
             else "  (Anthropic, ~0.01$ לחיפוש)"))
    print(f"  קול    : {'ElevenLabs' if vs['available'] else 'חסר — ' + vs['reason']}")
    sp = ledger.summary()
    print(f"  הוצאה  : {sp['total_usd']:.4f}$ מתוך תקרה {sp['cap_usd']:.2f}$")
    print("─" * 58)
    print(f"  http://{host}:{port}")
    print("─" * 58)

    try:
        with Server((host, port), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nנעצר.")
    except OSError as exc:
        # 48 מק, 98 לינוקס, 10048 ווינדוס
        if exc.errno in (48, 98, 10048):
            print(f"\nהפורט {port} תפוס.")
            print(f"  מק/לינוקס:  JARVIS_PORT=8766 python3 agent/main.py")
            print(f"  ווינדוס:    set JARVIS_PORT=8766  ואז  python agent\\main.py")
            sys.exit(1)
        raise


if __name__ == "__main__":
    main()
