# GovFix · Navnagar Municipal Corporation

GovFix is a municipal grievance workflow engine for the fictional city of **Navnagar**. Citizens report civic issues by talking to **NIVA**, a voice assistant that speaks Marathi, Hindi and English, or by typing. They can attach photos and pick the location in a 3D city. After that, the workflow runs:

- the Grievance Cell triages each complaint to a department;
- the Department Head assigns a field officer;
- the officer resolves it with a photo as proof;
- the citizen confirms the fix or reopens the complaint.

Deadlines come from an SLA table, and anything past its deadline escalates automatically. Every action, including refused attempts, lands in a tamper-evident audit log. AI only ever makes suggestions; people and the workflow engine make every change.

VORTEXA 3.0 · problem statement **G-02 GovFix** · voice by **ElevenLabs**.

| Piece | Where | Stack |
|---|---|---|
| Web | `apps/web` (Vercel) | React 18, Vite, TypeScript, Tailwind, react-three-fiber, @elevenlabs/react |
| Workflow engine, auth, storage, realtime | `supabase/` (Supabase cloud) | Postgres plpgsql, RLS, pg_cron |
| AI service | `services/ai` (Render) | FastAPI, Groq, keyword fallback, multilingual MiniLM (int8 ONNX) |

Full docs live in `docs/`: PRD, WORKFLOW, DATABASE, AI, NIVA, CITY, DESIGN, PHASES and PROGRESS.

## Setup

You need Node 20.6 or newer, [uv](https://docs.astral.sh/uv/) (it installs Python 3.11 for you), and access to the Supabase cloud project.

```bash
npm install
cp .env.example .env          # then fill in the values (ask the team; never commit .env)
cd services/ai && uv sync && cd ../..
npm run db:push               # migrations + seed (already applied on the shared project)
npm run seed:users            # the 18 demo accounts
npm run demo:reset            # seed photos + the fixed demo scenario
```

## Run

Run each of these in its own terminal:

```bash
npm run ai     # AI service on http://localhost:8787  (check /health)
npm run dev    # web on http://localhost:5173
```

On the first start, the AI service downloads the duplicate-detection model (about 120 MB). The database is the cloud project, so there's nothing to run locally for it.

Checks: `npm run lint && npm run typecheck && npm test && npm run test:engine && npm run test:ai`. Close any staff tabs before `test:engine`, because their 30-second escalation sweep can move test requests mid-run.

## Deploy

Deploy **Render** (AI service) first, because Vercel needs its URL. Connect the two afterwards.

### Render (AI service)

Create it as a manual **Web Service**, not a Blueprint. Connect `Woodbulky/GovFix`, branch `main`, and fill in:

| Field | Value |
|---|---|
| Root Directory | `services/ai` |
| Runtime | Python 3 |
| Build Command | `pip install uv && uv export --no-dev --no-hashes -o requirements.txt && pip install -r requirements.txt && python -c "from app.dupes import model; model()"` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Plan | Free (the service uses about 280 MB of the 512 MB limit) |

Environment variables:
- `PYTHON_VERSION=3.11.11`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (same value as `VITE_SUPABASE_ANON_KEY`)
- `AI_DATABASE_URL` (the Supavisor pooler URL, because Render has no IPv6)
- `SUPABASE_JWT_SECRET`
- `ALLOWED_ORIGINS` (the Vercel URL and `http://localhost:5173`, comma-separated)
- `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_TTS_MODEL`
- `ELEVENLABS_VOICE_ID_MR`, `ELEVENLABS_VOICE_ID_HI`, `ELEVENLABS_VOICE_ID_EN`

When it's live, `https://<service>.onrender.com/health` should return `ok`, with `groq`, `embeddings` and `db` all `true`.

### Vercel (web)

Import the repo and set **Root Directory** to `apps/web` (Vite is detected automatically, and `vercel.json` handles page links). Add these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AI_SERVICE_URL` (the Render URL, with no trailing `/`)
- `VITE_DEMO_MODE=true`
- `VITE_DEMO_PASSWORD` (same value as `DEMO_PASSWORD`)

Only `VITE_*` values belong on Vercel; they're compiled into the browser bundle.

### Connect the two

- **Render:** add the Vercel URL to `ALLOWED_ORIGINS`.
- **Supabase:** under **Authentication → URL Configuration**, set **Site URL** to the Vercel URL and add `https://<app>.vercel.app/**` under **Redirect URLs**.

## Judge guide

Every account uses the demo password. In demo mode, the header's role switcher signs in as any of them.

| Login | Role | Who |
|---|---|---|
| sunita@navnagar.test | Citizen | Sunita Jadhav, Marathi, Ward 7 |
| ramesh@navnagar.test | Citizen | Ramesh Shinde, Hindi, Ward 3 |
| aisha@navnagar.test | Citizen | Aisha Khan, English, Ward 5 |
| patil@navnagar.test | Field Officer | Ganesh Patil, Water, wards 5–8 |
| kale@navnagar.test | Field Officer | Priya Kale, Water, wards 1–4, 9, 10 |
| more@navnagar.test | Field Officer | Sachin More, Electrical |
| deshmukh@navnagar.test | Department Head | Vikram Deshmukh, Water |
| meera@navnagar.test | Grievance Cell Manager | Meera Kulkarni |
| commissioner@navnagar.test | Commissioner | Rajesh Naik |

More officers and department heads are listed in `docs/PRD.md`. Run `npm run demo:reset` (or use **Reset demo** in the Time Machine) before the script.

### The 5-minute script

1. **Voice intake.** As Sunita, tap **Talk to NIVA** and say "आमच्या गल्लीत दोन दिवसांपासून पाणी गळतंय, घंटाघर चौकाजवळ." NIVA asks one follow-up, offers a photo and reads the complaint back. After she says "हो", ticket NMC-2026-000142 appears with channel voice.
2. **City.** The new pin drops near Ghantaghar in Ward 7. Fly in, walk the street, and see the leak prop and her photo.
3. **Triage.** As Meera, the AI chip suggests Water leak (`llm`) and a possible duplicate, NMC-2026-000131. Compare the two side by side and confirm the category. The deadline is computed in SQL.
4. **Assign.** As Deshmukh, drag the card to Assigned and pick Patil (Kale is greyed out with a reason). Then drag it to Closed: the move is refused, a toast appears, and the attempt is logged.
5. **API Console.** As the Commissioner, act as Sunita and call `resolve` on her In-progress complaint → `ROLE_NOT_PERMITTED`. Act as Officer More and call `start` → `GUARD_FAILED:is_assigned_officer`. Both attempts are logged.
6. **Time Machine.** +20h turns the badge amber. +5h more escalates to L1 for Deshmukh with a red badge, and Sunita gets a Marathi voice update.
7. **Resolve and reopen.** As Patil, start work and resolve with a proof photo. As Sunita, choose **Still a problem**: the complaint becomes REOPENED with a fresh deadline.
8. **Audit.** As the Commissioner, filter on 000142 to see every step, refusals included. **Verify chain** shows ✓; run the tamper demo, and Verify shows ✗ at the exact row.
9. **AI offline.** Flip the toggle in the Time Machine and file a typed complaint. The suggestion chip says `keyword`, and the workflow is unaffected.

## AI accuracy

Measured on 20 labelled complaints in English, Hindi and Marathi (`services/ai/tests/data/labelled.jsonl`). Re-run with `cd services/ai && PYTHONIOENCODING=utf-8 uv run --env-file ../../.env python -m app.eval`.

| Provider | Correct | Accuracy |
|---|---|---|
| `llm` (Groq, openai/gpt-oss-120b) | 20/20 | 100% |
| `keyword` (offline fallback) | 15/20 | 75% |

## Fallbacks

| What fails | What happens | How to show it |
|---|---|---|
| LLM / Groq | Category suggestions come from the keyword classifier; the chip says `keyword` | **AI offline** toggle in the Time Machine |
| Render asleep (free plan sleeps after 15 min) | The first request takes about 30 s | Open `<render-url>/health` a minute before presenting |
| AI service down | Triage works by hand; notification voice notes use the browser's speech | Stop `npm run ai` |
| NIVA / ElevenLabs | The call falls back to the typed form, with the draft kept | Deny the microphone, or end the call with **Switch to typing** |
| WebGL off | The city and the location picker show the 2D map | Disable hardware acceleration in the browser |

## Data

All people, places and photos are fictional. Seed photos in `supabase/seed/photos/` are illustrated placeholders made by `scripts/gen-placeholder-photos.py`; real photos (no faces or number plates) can replace them under the same names.
