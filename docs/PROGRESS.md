# Progress log

Update at the end of every phase (done by `/commit-phase`). Newest entry first.

| Phase | Lane | Status | Commit | Time |
|---|---|---|---|---|
| P0 Scaffold | A | done | 55b374d | 2026-10-11 14:00 |
| P1 Database and seed | A | done | 1c7116d | 2026-10-11 14:15 |
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
- [x] `SUPABASE_DB_URL` in `.env`. `npm run db:push` and `npm run db:types` both work
- [ ] **Rotate (if not done) the Groq, ElevenLabs and service-role keys**: they were briefly in `.env.example`. Moved to `.env` before the first commit, so they never reached git
- [ ] ElevenLabs agent NIVA created per docs/NIVA.md; voice IDs in `.env`; Marathi voice tested
- [ ] `GROQ_MODEL` in `.env` (`GROQ_API_KEY` set (and later in Render)
- [ ] Vercel project (root dir `apps/web`) and Render service (from `render.yaml`) connected to the GitHub repo
- [ ] Seed photos in `supabase/seed/photos/` (own photos; no faces or number plates)

## Decisions

- 2026-10-11: Deploy on Vercel (web) + Render free tier (AI) + Supabase cloud. Docker and local Supabase dropped; engine tests run against the cloud project. LLM is Groq only (Gemini and Ollama dropped), keyword classifier as the fallback. sentence-transformers swapped for fastembed (same model, ONNX) to fit Render's 512 MB. City layout lives at `apps/web/src/features/city/layout/navnagar.json`.

## Entries

### Fix after P1 (2026-10-11 14:40)
- `npm run db:push` verified against the cloud: the migrations show as already applied, the seeds re-ran cleanly, and a second push reports "up to date". `npm run db:types` now uses `--db-url` (the CLI's logged-in account had no access to this project) and writes the file only on success. Both call the Supabase CLI without a shell, so passwords in the URL are passed intact.
- `AI_DATABASE_URL` verified: it connects as `ai_writer`.
- One unexplained failure in `test:engine`: anon read of departments/categories failed once right after a push, then passed 4 runs in a row. Watch for it.

### P1 Database and seed (done 2026-10-11 14:15)
- Built: 4 migrations (schema; grants + RLS + `my_role()`/`my_department()` + citizen-profile trigger on sign-up; `ai_writer` + storage buckets/policies + realtime + audit append-only trigger; advisor fix). `gen-workflow.ts` -> `01_workflow.sql` (departments, categories, first SLA versions, transitions, app_settings), `gen-city-seed.ts` -> `02_city.sql`, hand-written `03_reference.sql` (keywords in en/hi/mr + romanised). `seed-users.ts` (18 PRD users, officer_wards, department heads; idempotent), `set-ai-writer-password.ts` (`npm run ai:password`). Types regenerated. `tests/engine/rls.test.ts`: 25 tests, all passing against the cloud project.
- Verified: `ai_writer` logs in through the **aws-0** session pooler (`aws-0-ap-northeast-2.pooler.supabase.com:5432`, user `ai_writer.xwojruafxtczmqwsasgk`), can SELECT requests, gets `permission denied` on UPDATE requests. So no `insert_ai_suggestion()` RPC fallback is needed.
- Deviations (why):
  - Category names (en/hi/mr) added to `config/workflow.yaml`. Seeds run alphabetically, and `sla_policies` (01) references `categories`, so categories must be created in 01 too. Labels only; the workflow is unchanged. `03_reference.sql` now only sets keywords.
  - Default privileges for anon/authenticated revoked in `public`, including function EXECUTE from PUBLIC. **Every new RPC (P2+) needs an explicit `grant execute on function ... to authenticated` (and `anon` for `public_markers`/`track_request`).**
  - Anon has no SELECT grant at all on requests and other private tables (permission denied, not empty rows). This is the stricter reading.
  - `ai_writer` also gets SELECT on `notifications` (needed to find rows with `audio_path is null`), plus RLS policies scoped `to ai_writer` (RLS applies to it).
  - Profiles: citizens can read their own profile and staff profiles (officer name on cards); staff can read all. No direct profile writes; P3/P4 needs an `update_my_profile()` RPC.
  - `request_photos.storage_path` = object name inside the bucket (`report` -> complaint-photos, `proof` -> proof-photos). Voice notes are uploaded with the owner's JWT into `voice-notes/{user_id}/...` (no service key in the AI service).
  - `apps/web/src/features/city/layout/navnagar.json` is a **stub** (10 rectangular wards, 16 landmarks). Lane D replaces it; keep ward ids and landmark order stable, then `npm run gen:city`.
  - Migrations and seeds were applied through the Supabase MCP (no DB password yet). Versions in `supabase_migrations.schema_migrations` match the filenames, so `npm run db:push` will treat them as applied. The seeds are idempotent, so `--include-seed` can re-run them.
- Known issues: `npm run db:push` and `npm run db:types` are still blocked on `SUPABASE_DB_URL` / `supabase login` (see the checklist). Advisor warnings left on purpose: `my_role`/`my_department` executable by anon (spec: callable by all; returns null for anon), Supabase's own `rls_auto_enable` event trigger, and leaked-password protection (dashboard setting).
- Manual steps for Studio: put `AI_DATABASE_URL` in `.env`/Render with the `AI_WRITER_PASSWORD` from `.env` and the aws-0 host above. Demo password is `DEMO_PASSWORD` in `.env`.

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
