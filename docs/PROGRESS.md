# Progress log

Update at the end of every phase (done by `/commit-phase`). Newest entry first.

| Phase | Lane | Status | Commit | Time |
|---|---|---|---|---|
| P0 Scaffold | A | done | (this commit) | 2026-10-11 14:00 |
| P1 Database and seed | A | todo | | |
| P2 Workflow engine | A | todo | | |
| P3 Auth and shell | B | todo | | |
| P4 Citizen | B | todo | | |
| P5 Staff | A | todo | | |
| P6 AI service | C | todo | | |
| P7 NIVA | C | todo | | |
| P8a City geometry | D | todo | | |
| P8b City integration | D | todo | | |
| P9 Admin and proof tools | A | todo | | |
| P10 Demo hardening | all | todo | | |

## Manual steps waiting on Studio
- [x] Supabase cloud project created (`xwojruafxtczmqwsasgk`, ap-northeast-2)
- [x] `SUPABASE_SERVICE_ROLE_KEY` in `.env`; `DEMO_PASSWORD` and `AI_WRITER_PASSWORD` generated into `.env` by Claude (change them if you like)
- [ ] `SUPABASE_DB_URL` in `.env` (dashboard > Connect > Session pooler, with the DB password). Needed by `npm run db:push`
- [ ] `npx supabase login` once (needed by `npm run db:types`)
- [ ] **Rotate the Groq, ElevenLabs and service-role keys**: they were briefly in `.env.example`. Moved to `.env` before the first commit, so they never reached git
- [ ] ElevenLabs agent NIVA created per docs/NIVA.md; voice IDs in `.env`; Marathi voice tested
- [ ] `GROQ_MODEL` in `.env` (`GROQ_API_KEY` set (and later in Render)
- [ ] Vercel project (root dir `apps/web`) and Render service (from `render.yaml`) connected to the GitHub repo
- [ ] Seed photos in `supabase/seed/photos/` (own photos; no faces or number plates)

## Decisions

- 2026-10-11: Deploy on Vercel (web) + Render free tier (AI) + Supabase cloud. Docker and local Supabase dropped; engine tests run against the cloud project. LLM is Groq only (Gemini and Ollama dropped), keyword classifier as the fallback. sentence-transformers swapped for fastembed (same model, ONNX) to fit Render's 512 MB. City layout lives at `apps/web/src/features/city/layout/navnagar.json`.

## Entries

### P0 Scaffold (done 2026-10-11 14:00)
- Built: npm workspaces (`apps/web`); Vite + React 18 + TS strict + Tailwind 3 with DESIGN.md tokens as CSS variables and a Tailwind theme; @fontsource Anek Latin/Devanagari + Mukta; react-i18next en/hi/mr with a token/typography check page; shadcn `components.json` + `cn()` (components added as needed); ESLint 9 + Prettier + Vitest; `services/ai` FastAPI `/health` managed with **uv** (fetches Python 3.11 itself); `render.yaml`; `apps/web/vercel.json`; `supabase init` with seeds at `supabase/seed/*.sql`; all root scripts.
- Deviations: `npm run db:push` runs `supabase db push --db-url $SUPABASE_DB_URL` (no `supabase link`, which needs an access token). Python deps via uv instead of a bare venv, so `npm run ai` works the same on Windows and Linux. Only the P0 web deps are installed; three, @elevenlabs/react, @dnd-kit and browser-image-compression get installed by the lanes that need them.
- Known issues: `npm run db:push` can't reach the cloud project until `SUPABASE_DB_URL` is set. The P1 migrations are applied through the Supabase MCP in the meantime, with matching migration versions so `db push` stays in sync.
- Manual steps for Studio: see the checklist above.

<!-- Template
### P<N> <name> (done <time>)
- Built:
- Deviations from docs (why):
- Known issues:
- Manual steps for Studio:
-->
