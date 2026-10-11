"""ElevenLabs: TTS voice notes and NIVA signed sessions. Keys never leave this service (golden rule 7)."""

import hashlib
import os

import httpx

from .supa import User, as_user

EL = "https://api.elevenlabs.io/v1"
FIRST_MESSAGE = {
    "en": "Hi, I'm NIVA from Navnagar Municipal Corporation. How can I help you today?",
    "mr": "नमस्कार! मी निवा, नवनगर महानगरपालिकेची डिजिटल सहाय्यक. मी तुमची कशी मदत करू?",
    "hi": "नमस्ते! मैं निवा हूँ, नवनगर नगर निगम की डिजिटल सहायक। बताइए, मैं आपकी क्या मदद करूँ?",
}


def configured() -> bool:
    return bool(os.getenv("ELEVENLABS_API_KEY"))


def voice_for(language: str) -> str | None:
    return os.getenv(f"ELEVENLABS_VOICE_ID_{language.upper()}") or os.getenv("ELEVENLABS_VOICE_ID_EN")


def tts(u: User, text: str, language: str) -> str | None:
    """mp3 in voice-notes/{uid}/{sha256(text+voice)}.mp3, uploaded with the caller's JWT. None -> browser speech."""
    voice = voice_for(language)
    if not configured() or not voice or not text.strip():
        return None
    path = f"{u.id}/{hashlib.sha256((text + voice).encode()).hexdigest()[:32]}.mp3"
    obj = f"/storage/v1/object/voice-notes/{path}"
    try:
        if as_user(u, "HEAD", f"/storage/v1/object/authenticated/voice-notes/{path}").status_code == 200:
            return path  # cached
        r = httpx.post(f"{EL}/text-to-speech/{voice}", timeout=20,
                       headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
                       json={"text": text, "model_id": os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2")})
        if r.status_code != 200:
            return None
        up = as_user(u, "POST", obj, content=r.content, headers={"Content-Type": "audio/mpeg", "x-upsert": "true"})
        return path if up.status_code == 200 else None
    except httpx.HTTPError:
        return None


def niva_session(profile: dict) -> dict:
    """Signed URL for the private NIVA agent plus the dynamic variables the web sends (current_page is added there)."""
    lang = profile["preferred_language"]
    r = httpx.get(f"{EL}/convai/conversation/get-signed-url", timeout=10,
                  params={"agent_id": os.environ["ELEVENLABS_AGENT_ID"]},
                  headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]})
    r.raise_for_status()
    return {
        "signed_url": r.json()["signed_url"],
        "language": lang,
        "dynamic_variables": {
            "user_name": profile["full_name"].split()[0],
            "user_role": profile["role"],
            "language": lang,
            "first_message": FIRST_MESSAGE.get(lang, FIRST_MESSAGE["en"]),
        },
    }
