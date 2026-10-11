"""Category + extraction. Provider chain: Groq (llm) -> keyword. docs/AI.md."""

import json
import os
import random

import httpx
from pydantic import BaseModel, Field

SYSTEM = """You classify civic complaints for Navnagar Municipal Corporation (a fictional city).
Input may be Marathi, Hindi, English, or a mix, possibly a voice transcript.
Return ONLY JSON matching the schema. No prose.

Categories:
- drainage_overflow: sewage/drain/gutter overflowing, blocked drains, sewage on road
- water_leak: pipe burst, leaking pipeline, water wasted on road
- no_water_supply: no water, low pressure, irregular supply, dirty tap water
- garbage_not_collected: garbage not picked up, overflowing bins, dumping
- streetlight_out: street light not working, flickering, pole damaged
- stray_animals: stray dogs/cattle causing danger or nuisance
- pothole: potholes, damaged road surface, open trench left unfilled
- other: anything else

Rules:
- Extract only what is stated. Use null when something is not mentioned. Never invent a ward, landmark or date.
- urgency_cues: copy exact phrases that indicate risk to people (injury, children, live wire, sewage in drinking water, accident).
- confidence is your probability (0-1) that category_code is correct.
- rationale: one short neutral English sentence. Never blame anyone.

Schema:
{"category_code": "water_leak", "confidence": 0.94, "rationale": "...",
 "extracted": {"problem_summary_en": "...", "landmark_text": "... or null", "ward_text": null,
               "since_text": "... or null", "urgency_cues": [], "language": "mr|hi|en"}}

Copy landmark_text, ward_text, since_text and urgency_cues exactly as they appear in the input (same script)."""

SPAN_FIELDS = ("landmark_text", "ward_text", "since_text")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class Extracted(BaseModel):
    problem_summary_en: str | None = None
    landmark_text: str | None = None
    ward_text: str | None = None
    since_text: str | None = None
    urgency_cues: list[str] = []
    language: str | None = None


class Classification(BaseModel):
    category_code: str
    confidence: float = Field(ge=0, le=1)
    rationale: str
    extracted: Extracted = Extracted()


def groq_keys() -> list[str]:
    # Several keys may be given comma-separated; a rate-limited key falls through to the next.
    return [k.strip() for k in os.getenv("GROQ_API_KEY", "").split(",") if k.strip()]


def groq_chat(messages: list[dict], model: str | None = None, json_mode: bool = True, timeout: float = 8) -> str | None:
    """One chat completion; None on any failure (the caller falls back). Total budget ~`timeout` seconds."""
    keys = groq_keys()
    model = model or os.getenv("GROQ_MODEL")
    if not keys or not model:
        return None
    random.shuffle(keys)
    body = {"model": model, "messages": messages, "temperature": 0}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    for key in keys[:3]:
        try:
            r = httpx.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {key}"}, timeout=timeout)
        except httpx.HTTPError:
            return None  # timeout or network: don't burn more of the budget
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"]
        if r.status_code not in (401, 403, 429):
            return None
    return None


def llm_classify(text: str, codes: set[str]) -> Classification | None:
    raw = groq_chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}])
    if raw is None:
        return None
    try:
        c = Classification.model_validate(json.loads(raw))
    except (ValueError, TypeError):
        return None
    return c if c.category_code in codes else None


def keyword_classify(text: str, keywords: dict[str, list[str]]) -> Classification:
    """Hits = matched keywords per category (lower-cased substrings). Confidence = min(0.6, 0.3 + 0.1 x hits)."""
    low = text.lower()
    hits = {code: [k for k in kws if k.lower() in low] for code, kws in keywords.items()}
    code, matched = max(hits.items(), key=lambda kv: len(kv[1]), default=("other", []))
    if not matched:
        return Classification(category_code="other", confidence=0.2, rationale="No category keywords matched.")
    return Classification(
        category_code=code,
        confidence=min(0.6, 0.3 + 0.1 * len(matched)),
        rationale=f"Matched keywords: {', '.join(matched[:4])}.",
    )


def spans(text: str, ex: Extracted) -> list[dict]:
    """Character offsets of extracted phrases in the original text, for highlighting.
    Python indexes code points and JS indexes UTF-16 units; they agree for Devanagari and Latin (all BMP)."""
    found = []
    for field, value in [(f, getattr(ex, f)) for f in SPAN_FIELDS] + [("urgency", c) for c in ex.urgency_cues]:
        start = text.find(value) if value else -1
        if start >= 0:
            found.append({"field": field, "start": start, "end": start + len(value), "text": value})
    return sorted(found, key=lambda s: s["start"])
