"""קול: ElevenLabs לשני הכיוונים.

החוצה — text-to-speech.
פנימה  — Scribe (speech-to-text, scribe_v1).

לא משתמשים ב-Web Speech API של הדפדפן: הוא קיים רק בכרום, שולח את
ההקלטה לגוגל, ובברייב הוא קליפה ריקה שנכשלת בשקט — מדברים ולא קורה כלום,
בלי שגיאה. במקום זה מקליטים ב-MediaRecorder ומתמללים כאן בשרת.

מפתח ה-API נמצא כאן בלבד. הוא לא מגיע לדפדפן, לא ל-devtools ולא
להקלטת מסך.
"""

import os
import json
import uuid
import urllib.error
import urllib.request

API = "https://api.elevenlabs.io/v1"
TIMEOUT = 120

# קול ברירת מחדל של ElevenLabs. אפשר להחליף ב-ELEVENLABS_VOICE_ID.
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"

# flash מהיר וזול ותומך בעברית. אם ההגייה לא טובה, נסה
# eleven_multilingual_v2 דרך משתנה הסביבה.
TTS_MODEL = os.environ.get("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
STT_MODEL = os.environ.get("ELEVENLABS_STT_MODEL", "scribe_v1")
LANGUAGE = os.environ.get("JARVIS_LANG", "heb")


class VoiceUnavailable(Exception):
    """הקול לא זמין. תמיד נאמר על המסך — אף פעם לא נכשל בשקט."""


def api_key() -> str | None:
    return os.environ.get("ELEVENLABS_API_KEY", "").strip() or None


def available() -> bool:
    return api_key() is not None


def voice_id() -> str:
    return os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or DEFAULT_VOICE


def status() -> dict:
    return {
        "available": available(),
        "tts_model": TTS_MODEL,
        "stt_model": STT_MODEL,
        "voice_id": voice_id() if available() else None,
        "reason": None if available() else
                  "אין ELEVENLABS_API_KEY. אין דיבור ואין תמלול.",
    }


def _request(url: str, data: bytes, headers: dict) -> bytes:
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:300]
        if exc.code == 401:
            raise VoiceUnavailable("המפתח של ElevenLabs נדחה (401).") from exc
        if exc.code == 422:
            raise VoiceUnavailable(f"בקשה לא תקינה ל-ElevenLabs: {body}") from exc
        if exc.code == 429:
            raise VoiceUnavailable("חריגה ממכסת ElevenLabs (429).") from exc
        raise VoiceUnavailable(f"שגיאת ElevenLabs {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise VoiceUnavailable(f"אין חיבור ל-ElevenLabs: {exc.reason}") from exc


# ── החוצה: טקסט -> דיבור ──────────────────────────────────────────────

def speak(text: str) -> bytes:
    """מחזיר בייטים של mp3."""
    key = api_key()
    if not key:
        raise VoiceUnavailable("אין ELEVENLABS_API_KEY — אין דיבור.")
    text = (text or "").strip()
    if not text:
        raise VoiceUnavailable("אין טקסט להקריא.")
    if len(text) > 5000:
        text = text[:5000]

    payload = json.dumps({
        "text": text,
        "model_id": TTS_MODEL,
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
    }).encode("utf-8")

    return _request(
        f"{API}/text-to-speech/{voice_id()}?output_format=mp3_44100_128",
        payload,
        {"xi-api-key": key, "content-type": "application/json",
         "accept": "audio/mpeg"},
    )


# ── פנימה: אודיו -> טקסט ──────────────────────────────────────────────

def _multipart(fields: dict[str, str], filename: str,
               audio: bytes, mime: str) -> tuple[bytes, str]:
    boundary = "----jarvis" + uuid.uuid4().hex
    out = bytearray()
    for name, value in fields.items():
        out += f"--{boundary}\r\n".encode()
        out += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        out += value.encode("utf-8") + b"\r\n"
    out += f"--{boundary}\r\n".encode()
    out += (f'Content-Disposition: form-data; name="file"; '
            f'filename="{filename}"\r\n').encode()
    out += f"Content-Type: {mime}\r\n\r\n".encode()
    out += audio + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"


def listen(audio: bytes, mime: str = "audio/webm") -> dict:
    """מחזיר {'text': ..., 'language': ...}."""
    key = api_key()
    if not key:
        raise VoiceUnavailable("אין ELEVENLABS_API_KEY — אין תמלול.")
    if not audio:
        raise VoiceUnavailable("לא הגיע אודיו.")
    if len(audio) < 1200:
        raise VoiceUnavailable("ההקלטה קצרה מדי. לחץ על המיקרופון ודבר.")

    ext = {"audio/webm": "webm", "audio/ogg": "ogg",
           "audio/mp4": "mp4", "audio/mpeg": "mp3",
           "audio/wav": "wav"}.get(mime.split(";")[0].strip(), "webm")

    fields = {"model_id": STT_MODEL, "tag_audio_events": "false"}
    if LANGUAGE:
        fields["language_code"] = LANGUAGE

    body, content_type = _multipart(fields, f"turn.{ext}", audio, mime)
    raw = _request(f"{API}/speech-to-text", body,
                   {"xi-api-key": key, "content-type": content_type})
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except ValueError as exc:
        raise VoiceUnavailable("Scribe החזיר תשובה שאינה JSON.") from exc

    text = (parsed.get("text") or "").strip()
    if not text:
        raise VoiceUnavailable("לא זוהה דיבור בהקלטה.")
    return {"text": text, "language": parsed.get("language_code") or LANGUAGE}
