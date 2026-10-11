# AI service (`services/ai`)

FastAPI on :8787. Every endpoint requires the caller's Supabase JWT. It writes only to `ai_suggestions` and `notifications.audio_path` through the `ai_writer` role (docs/DATABASE.md).

## Endpoints

| Method | Path | Who calls | Does |
|---|---|---|---|
| GET | /health | anyone | Provider status: groq, embeddings, keyword, elevenlabs, db; plus the `ai_offline` flag. Also the warm-up ping for Render's free tier |
| POST | /suggest `{request_id}` | Web after create, or the "Get suggestion" button | Category + extraction + duplicates (+ photo category if a photo exists and a vision provider is up) → `ai_suggestions` rows |
| POST | /draft-reply `{request_id, event, language}` | Officer / Dept Head screen | Draft citizen update → `ai_suggestions` (type `draft_reply`) |
| POST | /tts `{notification_id}` or `{text, language}` | Web | ElevenLabs TTS → `voice-notes` bucket; returns `{audio_path}` or `{fallback: "browser"}` |
| GET | /niva/session | Web NIVA screen | ElevenLabs signed URL for the agent + dynamic variables from the caller's profile |

## Provider chain

Order: **Groq → keyword**. If `app_settings.ai_offline` is true, skip straight to keyword.
- Groq gets 8 seconds and must return JSON that validates against the pydantic schema. Otherwise, fall back to keyword.
- Store `provider` (`llm` for Groq, `keyword`, `local` for our own on-server embedding model, `vision` for photo categorisation) and `model` on each suggestion.
- Model names come from env (`GROQ_MODEL`, `GROQ_VISION_MODEL`). Don't hardcode them.

## Hosting (Render free tier)

- `render.yaml`, root dir `services/ai`, `PYTHON_VERSION=3.11`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Health check: `/health`.
- 512 MB RAM: no torch. The embedding model is downloaded in the **build** command into a folder inside the service, never on first request.
- Sleeps after 15 min idle (about a minute to wake). The web app pings `/health` on load, and we open it before judging.
- CORS allows only `ALLOWED_ORIGINS` (the Vercel URL plus `http://localhost:5173`).
- JWT check: HS256 with `SUPABASE_JWT_SECRET` (this project still uses legacy JWT signing). If the project moves to asymmetric signing keys, verify against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` instead.

## Categorisation + extraction prompt

System:
```
You classify civic complaints for Navnagar Municipal Corporation (a fictional city).
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
```

Schema:
```json
{
  "category_code": "water_leak",
  "confidence": 0.94,
  "rationale": "Describes water leaking continuously from a pipe in a lane.",
  "extracted": {
    "problem_summary_en": "Water leaking in the lane for two days",
    "landmark_text": "घंटाघर चौकाजवळ",
    "ward_text": null,
    "since_text": "दोन दिवसांपासून",
    "urgency_cues": [],
    "language": "mr"
  }
}
```

This produces two suggestion rows: `category` (code + confidence + rationale) and `extraction` (fields + character offsets into the original text, used for highlighting). Compute the offsets in Python by searching for the extracted span.

## Keyword fallback

Uses `categories.keywords`: English, Devanagari Hindi/Marathi, and romanised forms. Examples for `water_leak`: leak, leakage, pipe burst, गळती, गळतंय, पाणी गळ, लीक, पाइप फट, pani gal. Score = number of matched keywords per category. Confidence = min(0.6, 0.3 + 0.1 × hits). No match → `other` at 0.2. Unit-test it with 20 labelled examples (5 per language plus code-mixed) in `services/ai/tests/data/labelled.jsonl`, and report accuracy per provider in the README. Report misses honestly.

## Duplicate detection (local ML, works offline)

- Model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` through **fastembed** (ONNX, CPU, fits in 512 MB), loaded once at startup. Downloaded in the Render build step, never on demo day. Suggestions use provider `local`. Confirm fastembed still lists this model; if not, pick its closest multilingual model and record it in PROGRESS.md.
- Candidates: non-terminal requests in the last 72 sim-hours that are in the same ward or within 500 m.
- Score = 0.6 × cosine(description embeddings) + 0.25 × (same suggested category) + 0.15 × proximity (1 at 0 m, linear to 0 at 500 m).
- Suggest when the score is ≥ 0.75. Payload: `{candidate_request_id, ticket_no, score, distance_m, cosine}`. Only the Manager can merge.

## Photo categorisation (Should tier)

If `GROQ_VISION_MODEL` is set, send the first report photo with the category list and get `{category_code, confidence, visible_issue}`. Stored as `photo_category`, provider `vision`. When it agrees with the text category, show both chips; when it disagrees, highlight the disagreement for the Manager. Skip silently when no vision provider is available.

## Draft replies

```
Write a short update for a citizen of Navnagar about their complaint.
Language: {{language}}. Max 2 sentences. Plain, polite words (आपण / आप).
Facts you may use (do not add others): {{facts_json}}  // state, category, department, officer first name, deadline if set, officer's question
Do not promise anything beyond the deadline given. Do not blame anyone. Do not mention AI.
```

Shown as an editable draft. It is only sent through `send_citizen_update()` by a person.

## Voice-note templates (deterministic, not LLM)

`apps/web/src/i18n/voice-templates.json`, keyed by event × language, with `{{ticket}}`, `{{department}}`, `{{deadline}}`, `{{question}}` placeholders. Example `resolved.mr`: "नमस्कार, तुमची तक्रार {{ticket}} सोडवली असे नोंदवले आहे. काम पूर्ण झाले असल्यास ॲपमध्ये खात्री करा, अन्यथा 'अजून समस्या आहे' निवडा." TTS reads the filled template. Cache by sha256(text + voice).
