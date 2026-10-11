"""GovFix AI service. Writes only ai_suggestions and notifications.audio_path, as ai_writer (docs/AI.md)."""

import base64
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from . import classify, dupes, voice
from .supa import User, as_user, current_user, db, my_profile, rows, visible_request

state = {"embeddings": False}


@asynccontextmanager
async def lifespan(_):
    try:  # load once at startup, never on the first request
        dupes.model()
        state["embeddings"] = True
    except Exception:
        pass  # duplicates are skipped; /health shows it
    yield


app = FastAPI(title="GovFix AI", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def insert(conn, request_id, type_, payload, confidence, provider, model):
    return conn.execute(
        "insert into ai_suggestions (request_id, type, payload, confidence, provider, model)"
        " values (%s, %s, %s, %s, %s, %s) returning id",
        (request_id, type_, Jsonb(payload), confidence, provider, model),
    ).fetchone()["id"]


def ai_offline(conn) -> bool:
    return conn.execute("select ai_offline from app_settings where id = 1").fetchone()["ai_offline"]


@app.get("/health")
def health():
    out = {"ok": True, "groq": bool(classify.groq_keys() and os.getenv("GROQ_MODEL")),
           "embeddings": state["embeddings"], "keyword": True, "elevenlabs": voice.configured(),
           "vision": bool(os.getenv("GROQ_VISION_MODEL")), "db": False, "ai_offline": None}
    try:
        with db() as conn:
            out["ai_offline"], out["db"] = ai_offline(conn), True
    except Exception:
        pass
    return out


class SuggestIn(BaseModel):
    request_id: UUID


@app.post("/suggest")
def suggest(body: SuggestIn, u: User = Depends(current_user)):
    rid = str(body.request_id)
    visible_request(u, rid)
    with db() as conn:
        req = conn.execute(
            "select r.id, r.description, r.ward_id, coalesce(r.loc_x, l.x) as x, coalesce(r.loc_z, l.z) as z"
            " from requests r left join landmarks l on l.id = r.landmark_id where r.id = %s", (rid,)).fetchone()
        keywords = {c["code"]: c["keywords"] for c in conn.execute("select code, keywords from categories")}
        offline = ai_offline(conn)

        c = None if offline else classify.llm_classify(req["description"], set(keywords))
        provider, model = ("llm", os.getenv("GROQ_MODEL")) if c else ("keyword", "categories.keywords")
        c = c or classify.keyword_classify(req["description"], keywords)
        made = [insert(conn, rid, "category", {"category_code": c.category_code, "rationale": c.rationale},
                       round(c.confidence, 3), provider, model)]
        if provider == "llm":
            ex = c.extracted.model_dump() | {"spans": classify.spans(req["description"], c.extracted)}
            made.append(insert(conn, rid, "extraction", ex, None, "llm", model))

        if state["embeddings"]:
            for d in dupes.find(conn, req, c.category_code):
                made.append(insert(conn, rid, "duplicate", d, d["score"], "local", dupes.MODEL))

        if not offline and (v := photo_category(u, rid, set(keywords))):
            made.append(insert(conn, rid, "photo_category", v, v["confidence"], "vision", os.getenv("GROQ_VISION_MODEL")))
    return {"ok": True, "provider": provider, "suggestion_ids": [str(m) for m in made]}


def photo_category(u: User, rid: str, codes: set[str]) -> dict | None:
    """First report photo -> category via a Groq vision model. Skipped silently when unavailable."""
    model = os.getenv("GROQ_VISION_MODEL")
    photos = model and rows(u, f"request_photos?request_id=eq.{rid}&kind=eq.report&select=storage_path&order=created_at&limit=1")
    if not photos:
        return None
    img = as_user(u, "GET", f"/storage/v1/object/authenticated/complaint-photos/{photos[0]['storage_path']}")
    if img.status_code != 200:
        return None
    raw = classify.groq_chat([{"role": "user", "content": [
        {"type": "text", "text": f"Civic complaint photo. Categories: {', '.join(sorted(codes))}. Return only JSON"
                                 ' {"category_code": "...", "confidence": 0-1, "visible_issue": "short neutral English"}.'},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(img.content).decode()}},
    ]}], model=model, timeout=12)
    try:
        v = json.loads(raw or "")
        if v.get("category_code") in codes and 0 <= float(v.get("confidence", -1)) <= 1:
            return {"category_code": v["category_code"], "confidence": float(v["confidence"]),
                    "visible_issue": str(v.get("visible_issue", ""))[:200]}
    except (ValueError, TypeError, AttributeError):
        pass
    return None


DRAFT = """Write a short update for a citizen of Navnagar about their complaint.
Language: {language}. Max 2 sentences. Plain, polite words ({polite}).
Facts you may use (do not add others): {facts}
Do not promise anything beyond the deadline given. Do not blame anyone. Do not mention AI.
Return only JSON: {{"text": "..."}}"""
IST = timezone(timedelta(hours=5, minutes=30))  # Navnagar time; India has no DST


def ist(ts: str | None) -> str | None:
    return datetime.fromisoformat(ts).astimezone(IST).strftime("%a %d %b, %I:%M %p") if ts else None


LANG = {"en": ("English", "polite"), "hi": ("Hindi", "आप"), "mr": ("Marathi", "आपण")}


class DraftIn(BaseModel):
    request_id: UUID
    event: str = "update"
    language: Literal["en", "hi", "mr"] | None = None


@app.post("/draft-reply")
def draft_reply(body: DraftIn, u: User = Depends(current_user)):
    if my_profile(u)["role"] not in ("officer", "dept_head"):
        raise HTTPException(403, "Only the officer or Department Head drafts citizen updates.")
    rid = str(body.request_id)
    found = rows(u, f"requests?id=eq.{rid}&select=ticket_no,state,language,resolution_due_at,"
                    "categories(name_en),departments(name_en),officer:profiles!requests_assigned_officer_id_fkey(full_name)")
    if not found:
        raise HTTPException(404, "This request doesn't exist.")
    r = found[0]
    question = rows(u, f"request_messages?request_id=eq.{rid}&kind=eq.info_question&select=body&order=created_at.desc&limit=1")
    facts = {k: v for k, v in {
        "event": body.event, "ticket": r["ticket_no"], "state": r["state"],
        "category": (r["categories"] or {}).get("name_en"), "department": (r["departments"] or {}).get("name_en"),
        "officer_first_name": ((r["officer"] or {}).get("full_name") or "").split(" ")[0] or None,
        "deadline": ist(r["resolution_due_at"]), "officer_question": question[0]["body"] if question else None,
    }.items() if v}
    lang = body.language or r["language"]
    name, polite = LANG[lang]
    with db() as conn:
        if ai_offline(conn):
            return {"ok": False, "message": "AI is offline. Write the update yourself."}
        raw = classify.groq_chat([{"role": "user", "content": DRAFT.format(
            language=name, polite=polite, facts=json.dumps(facts, ensure_ascii=False))}])
        try:
            text = str(json.loads(raw or "")["text"]).strip()
        except (ValueError, KeyError, TypeError):
            text = ""
        if not text:
            return {"ok": False, "message": "No draft right now. Write the update yourself."}
        sid = insert(conn, rid, "draft_reply", {"text": text, "language": lang, "event": body.event, "facts": facts},
                     None, "llm", os.getenv("GROQ_MODEL"))
    return {"ok": True, "suggestion_id": str(sid), "text": text}


class TtsIn(BaseModel):
    notification_id: UUID | None = None
    text: str | None = None
    language: Literal["en", "hi", "mr"] = "en"


@app.post("/tts")
def tts(body: TtsIn, u: User = Depends(current_user)):
    text, lang = (body.text or "")[:1000], body.language
    if body.notification_id:
        found = rows(u, f"notifications?id=eq.{body.notification_id}&select=body,language")  # own rows only (RLS)
        if not found:
            raise HTTPException(404, "Notification not found.")
        text, lang = found[0]["body"], found[0]["language"]
    path = voice.tts(u, text, lang)
    if not path:
        return {"fallback": "browser"}
    if body.notification_id:
        with db() as conn:
            conn.execute("update notifications set audio_path = %s where id = %s and user_id = %s",
                         (path, str(body.notification_id), u.id))
    return {"audio_path": path}


@app.get("/niva/session")
def niva_session(u: User = Depends(current_user)):
    if not (voice.configured() and os.getenv("ELEVENLABS_AGENT_ID")):
        raise HTTPException(503, "NIVA isn't available. Use the typed form.")
    try:
        return voice.niva_session(my_profile(u))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "NIVA isn't available. Use the typed form.")
