# GovFix

Municipal grievance workflow engine for the fictional city of **Navnagar** (Navnagar Municipal Corporation, NMC), with **NIVA**, a multilingual voice assistant, and an explorable 3D city.

- Repo: https://github.com/Woodbulky/GovFix (branch `main`)
- Event: VORTEXA 3.0, a 12-hour hackathon. Problem statement **G-02 GovFix**, track **municipal grievance resolution**.
- Partner: **ElevenLabs** (powers NIVA's voice).
- Lead: Studio. Studio directs, you build. Ask before anything that breaks a golden rule or changes scope.

## What GovFix does

Citizens report civic issues (water, garbage, roads, streetlights, drainage, stray animals) by talking to NIVA in Marathi, Hindi or English, or by typing, with photos and a location picked on the city map. The Grievance Cell Manager triages each request to a department, the Department Head assigns a field officer, the officer resolves it with photo proof, and the citizen confirms or reopens. Every request gets a deadline from an SLA table; overdue requests escalate automatically up the hierarchy. Every action, including refused attempts, lands in a tamper-evident audit log. AI suggests categories, extracts details, spots duplicates and drafts replies, but only people and the workflow engine ever change a request.

**NIVA** = **N**avigation and **I**nclusive **V**oice **A**ssistant. It files complaints by voice, reads status aloud, and navigates the app and the 3D city ("show open garbage complaints in Ward 3").

## Read before writing code

| File | Read when |
|---|---|
| docs/PROBLEM_STATEMENT.md | Always. Judged requirements and how we prove each one |
| docs/PRD.md | Roles, hierarchy, every tab and screen, demo script |
| docs/WORKFLOW.md + config/workflow.yaml | Anything touching states, roles, SLA, escalation |
| docs/DATABASE.md | Schema, RLS, RPCs, audit chain, storage |
| docs/ARCHITECTURE.md | Stack, folders, data flow, env vars |
| docs/AI.md | AI service, prompts, provider chain, fallbacks |
| docs/NIVA.md | Voice assistant: prompt, tools, guardrails |
| docs/CITY.md | 3D city: layout, realism, navigation, markers, photos |
| docs/DESIGN.md | Visual system. The mockup is a first draft, not a spec |
| docs/PHASES.md | Build order, lanes, acceptance criteria |
| docs/PROGRESS.md | Current status. Update after every phase |

## Golden rules (judges test these; never break them)

1. **Only `transition_request()` changes a request's state, department, officer or deadline.** It is a Postgres `SECURITY DEFINER` function. `anon` and `authenticated` have no INSERT/UPDATE/DELETE grants on `requests`. The UI hides invalid actions, but the database is the authority.
2. **Refusals are recorded, not thrown.** A refused attempt writes an `audit_events` row with `outcome = 'refused'` and returns `{ ok: false, code, message }`. Never `RAISE` for a business refusal: it rolls back the audit insert.
3. **AI never writes to `requests`.** LLM output, classifier output and NIVA all go to `ai_suggestions` (or a client-side draft). A human action applies a suggestion, and its audit row references the suggestion id. The AI service connects as a Postgres role that physically cannot update `requests`.
4. **Deadlines come only from `sla_policies`, computed in SQL. Business time comes only from `now_sim()`.** Never use `now()` or `Date.now()` for SLA logic. The Time Machine shifts `now_sim()`.
5. **The demo works with AI off.** AI offline gives the keyword classifier. NIVA down gives the typed form. WebGL off gives the 2D map. Every suggestion stores its `provider` (`llm`, `local`, `keyword`, `vision`) and the UI shows it.
6. **Fictional data only.** Fictional city, wards, landmarks and people. Emails end in `@navnagar.test`. No real personal data, no real Pune place names, no photos with identifiable faces or number plates.
7. **Secrets stay server-side.** Service-role, ElevenLabs and LLM keys live only in `services/ai` and `scripts`. Never commit `.env`.
8. **Every number on screen comes from the database.** No hardcoded or invented stats. The mockup's numbers are placeholders.
9. **Neutral language.** UI copy, AI drafts and notifications never blame or accuse an officer, department or citizen. Overdue means "past its deadline", nothing more.
10. **The mockup is a draft.** `docs/mockups/v0-first-draft.png` is Studio's first exploration. Use it for mood and layout ideas; where it differs from docs/DESIGN.md, follow DESIGN.md.

## Phases and commits

- Work phase by phase from docs/PHASES.md. A phase is done only when its acceptance criteria pass.
- **At the end of every phase, run `/commit-phase <N> <summary>`** (see `.claude/commands/commit-phase.md`). It runs the checks, updates docs/PROGRESS.md, commits, pushes to `origin main`, and posts a summary.
- Commit messages: `feat(phase-N): <what>` for phase work, `fix(<area>): ...` for fixes, `docs: ...` for docs.
- Small commits inside a phase are fine once checks pass.
- Never commit `.env*` (except `.env.example`), keys, `supabase/.temp` or `node_modules`. Never force-push or rewrite history.
- Parallel sessions: each session owns one lane (see PHASES.md) and its folders. Run `git pull --rebase origin main` before every commit. Resolve conflicts; never discard a teammate's work.
- First time only: check `git remote -v`. If origin is missing: `git remote add origin https://github.com/Woodbulky/GovFix.git` and `git branch -M main`.

## Stack (pin exact versions; no major bumps mid-hackathon)

- **apps/web**: React 18, Vite, TypeScript (strict), Tailwind CSS, shadcn/ui, react-router, @tanstack/react-query, zustand, react-i18next, @supabase/supabase-js v2, @elevenlabs/react, three + @react-three/fiber v8 + @react-three/drei v9 (the React 18 compatible set), @dnd-kit/core, browser-image-compression, lucide-react, @fontsource/anek-latin, @fontsource/anek-devanagari, @fontsource/mukta.
- **supabase/**: Postgres with pgcrypto and pg_cron, Supabase Auth (email + password), Storage, Realtime. The workflow engine is SQL (plpgsql). Migrations live in `supabase/migrations`. **Cloud only** (project ref `xwojruafxtczmqwsasgk`, region ap-northeast-2). No Docker and no local Supabase.
- **services/ai**: Python 3.11, FastAPI, uvicorn, pydantic v2, httpx, psycopg 3, onnxruntime + sentencepiece (no torch) running the int8 ONNX export of `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. LLM: Groq only.
- **Tests**: Vitest (web, plus engine tests against the cloud project; they create their own data and finish with `reset_demo()`), pytest (AI service).
- **Root**: npm workspaces.

## Deployment

| Piece | Host | Notes |
|---|---|---|
| apps/web | **Vercel** | Root dir `apps/web`, Vite static build, `vercel.json` SPA rewrite. Only `VITE_*` env vars |
| services/ai | **Render** (free web service) | `render.yaml`. Sleeps after 15 min idle: hit `/health` before judging. Holds Groq, ElevenLabs and `ai_writer` secrets |
| Database, auth, storage, realtime, cron | **Supabase cloud** | Render connects through the Supavisor pooler (Render has no IPv6, the direct DB host is IPv6-only) |

## Commands (create these in Phase 0)

```bash
npm install
npm run db:push               # apply new migrations + seed to the cloud project (supabase db push --include-seed)
npm run seed:users            # demo accounts (needs service key)
npm run gen:workflow          # config/workflow.yaml -> supabase/seed/01_workflow.sql
npm run gen:city              # apps/web/src/features/city/layout/navnagar.json -> supabase/seed/02_city.sql
npm run db:types              # regenerate apps/web/src/lib/database.types.ts
npm run dev                   # web on :5173
npm run ai                    # AI service on :8787
npm run demo:reset            # clear requests, reset sim clock, load demo scenario
npm run lint && npm run typecheck && npm test && npm run test:engine && npm run test:ai
```

## Conventions

- All database calls go through `apps/web/src/lib/rpc.ts` (typed wrappers around `supabase.rpc`) and `apps/web/src/lib/queries.ts`. No `.from('requests').update()` anywhere; it would fail anyway.
- Regenerate types after every migration (`npm run db:types`).
- Feature folders: `apps/web/src/features/<feature>/`.
- Every user-facing string goes through i18n (`en`, `hi`, `mr`). Citizen screens ship in all three; staff screens may ship English first.
- One `StatusChip`, one `SlaBadge`, one `EscalationBadge`, one `ProviderBadge` component. Never hand-roll status colours.
- Accessibility floor: labelled controls, visible focus, 4.5:1 contrast, 44px touch targets, `prefers-reduced-motion` respected, status never shown by colour alone.
- Migrations are append-only: a new file per change, never edit an applied one.
- Keep files under ~400 lines; split by responsibility.
- Before calling a phase done, click through it in the browser as the relevant demo users (see docs/PRD.md).

## Definitions

- **Sim time**: `now_sim() = now() + app_settings.sim_offset_seconds`. The UI shows a "Sim time" badge whenever the offset is non-zero.
- **Demo mode**: `app_settings.demo_mode = true` enables the role switcher, Time Machine, API Console and tamper demo. With it false, those features are hidden in the UI and refused by the database.
- **Ticket number**: `NMC-YYYY-NNNNNN` from a sequence, e.g. `NMC-2026-000142`.

## When unsure

Pick the stricter reading of docs/PROBLEM_STATEMENT.md. Record any deviation, with the reason, in docs/PROGRESS.md. Ask Studio before changing a golden rule, the role model or the workflow.
