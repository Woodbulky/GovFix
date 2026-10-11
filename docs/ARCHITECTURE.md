# Architecture

```
┌──────────────────────── Browser (apps/web, Vercel) ────────────────────────┐
│ React + Vite + TS                                                           │
│  • Citizen / staff / admin screens (role-based routes)                      │
│  • City explorer (three.js via react-three-fiber), 2D SVG fallback          │
│  • NIVA call screen (@elevenlabs/react) with client tools                   │
│  • supabase-js: auth session, RPC calls, realtime subscriptions             │
└───────┬───────────────────────────────┬──────────────────────────┬─────────┘
        │ RPC + realtime (RLS)          │ HTTPS (user JWT)         │ WebRTC/WebSocket
        ▼                               ▼                          ▼
┌──────────── Supabase cloud ───────┐ ┌──── services/ai (Render) ──┐ ┌── ElevenLabs ──┐
│ Postgres: workflow engine (SQL),  │ │ FastAPI :8787              │ │ NIVA agent     │
│  RLS, audit chain, pg_cron sweep  │◄┤  /suggest  /draft-reply    │ │ (STT+LLM+TTS)  │
│ Auth (email+password)             │ │  /tts  /niva/session       │ │ TTS for voice  │
│ Storage (photos, voice notes)     │ │  /health                   │ │ notes          │
│ Realtime                          │ │ Groq → keyword; int8 ONNX  │ └────────────────┘
└───────────────────────────────────┘ │ embeddings (local, CPU)    │
                                      │ DB: ai_writer via pooler   │
                                      └────────────────────────────┘
```

## Key flows

**Typed complaint.** Web uploads photos to Storage → `create_request()` → `attach_photo()` ×n → POST `/suggest {request_id}` → the AI service writes `ai_suggestions` → realtime updates the Manager's triage queue.

**Voice complaint.** The web asks `/niva/session` for a signed URL → starts the ElevenLabs conversation with dynamic variables (name, role, language). NIVA calls client tools in the browser. `update_draft` fills the draft card; `submit_complaint` calls `create_request()` with the citizen's own session and `channel = 'voice'`. Then the same path as typed.

**Triage.** Manager opens the drawer → reads the suggestions → optionally `decide_suggestion()` → `transition_request(action='triage', payload={category_code}, ai_suggestion_id)`. SQL sets the department and deadline.

**Escalation.** pg_cron (every minute), the Time Machine and staff tabs (every 30s) call `run_escalation_sweep()`. Notifications are inserted, and the web asks `/tts` to voice citizen-facing ones.

**Voice notes.** Notification created → web (or the AI service when polling `notifications` where `audio_path is null` and kind is citizen-facing) → `/tts` → mp3 into `voice-notes` → `audio_path` set. Playback falls back to `speechSynthesis` when `audio_path` is null.

## Repo layout

```
GovFix/
├─ CLAUDE.md
├─ .claude/commands/            commit-phase.md, next-phase.md
├─ render.yaml                 Render blueprint for services/ai
├─ config/workflow.yaml
├─ docs/                        PRD, WORKFLOW, DATABASE, AI, NIVA, CITY, DESIGN, PHASES, PROGRESS, mockups/
├─ apps/web/                   vercel.json (SPA rewrite)
│  ├─ public/                   fonts are bundled via @fontsource; poster images
│  └─ src/
│     ├─ app/                   router, providers, layouts (PublicLayout, CitizenLayout, StaffLayout)
│     ├─ components/ui/         shadcn
│     ├─ components/            StatusChip, SlaBadge, EscalationBadge, ProviderBadge, Stepper, Timeline, PhotoUploader
│     ├─ features/
│     │  ├─ auth/               login, demo role switcher
│     │  ├─ public/             home, track, departments
│     │  ├─ report/             typed flow, location picker (2D/3D)
│     │  ├─ citizen/            my complaints, detail, notifications, profile
│     │  ├─ triage/             manager queue, drawer, duplicates
│     │  ├─ department/         board, to-assign, escalations, officers
│     │  ├─ officer/            my work
│     │  ├─ request-detail/     shared 3-panel view
│     │  ├─ ai/                 suggestions panel
│     │  ├─ niva/               call screen, client tools, draft store
│     │  ├─ city/               scene, generators, controls, markers, layers, minimap
│     │  └─ admin/              overview, audit, workflow-sla, time-machine, api-console, users
│     ├─ i18n/                  en.json, hi.json, mr.json, voice-templates.json
│     └─ lib/                   supabase.ts, rpc.ts, queries.ts, database.types.ts, realtime.ts, time.ts
├─ services/ai/
│  ├─ app/                      main.py, providers/, classify.py, duplicates.py, tts.py, niva.py, db.py, auth.py
│  └─ tests/
├─ supabase/
│  ├─ migrations/
│  └─ seed/                     01_workflow.sql 02_city.sql 03_reference.sql photos/
└─ scripts/                     gen-workflow.ts, gen-city-seed.ts, seed-users.ts, set-ai-writer-password.ts, demo-reset.ts
```

## Environment

See `.env.example`. Only `VITE_*` values reach the browser, and none of them are secrets. The AI service verifies the caller's Supabase JWT (`SUPABASE_JWT_SECRET`) on every endpoint.

## Deployment and demo-day topology

| Piece | Host | Config |
|---|---|---|
| apps/web | Vercel | Root dir `apps/web`, build `npm run build`, output `dist`. `vercel.json` rewrites every path to `/index.html`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_SERVICE_URL` (the Render URL), `VITE_DEMO_MODE` |
| services/ai | Render free web service | `render.yaml` (see docs/AI.md "Hosting"). Env: Groq, ElevenLabs, `AI_DATABASE_URL` (pooler), `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS` |
| Database etc. | Supabase cloud | Migrations applied with `npm run db:push`. Add the Vercel URL to Auth → URL configuration |

- **No local Supabase and no Docker.** Development also runs against the cloud project (`npm run dev` and `npm run ai` locally, pointed at it).
- **Demo day:** present from the deployed Vercel URL. Before judging: open `/health` on Render to wake it, run `npm run demo:reset`, and check the Supabase project isn't paused (free projects pause after 7 days idle).
- **Fallbacks:** AI offline toggle (keyword), NIVA down (typed form), WebGL off (2D map). There is no offline database: carry a phone hotspot as the network fallback.
