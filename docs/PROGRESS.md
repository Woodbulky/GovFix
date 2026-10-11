# Progress log

Update at the end of every phase (done by `/commit-phase`). Newest entry first.

| Phase | Lane | Status | Commit | Time |
|---|---|---|---|---|
| P0 Scaffold | A | done | 55b374d | 2026-10-11 14:00 |
| P1 Database and seed | A | done | 1c7116d | 2026-10-11 14:15 |
| P2 Workflow engine | A | done | (this commit) | 2026-10-11 15:30 |
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
- [x] ElevenLabs agent NIVA created per docs/NIVA.md (English default + Marathi + Hindi, Hinglish Mode, Sarah voice, prompt, 5 vars, Language override, authentication on); voice IDs in `.env`; Marathi TTS tested. Client tools are registered in P7
- [ ] Delete the blank line before `{{first_message}}` in the English (default) first message, then Publish
- [x] `GROQ_API_KEY` (15 valid keys) and `GROQ_MODEL=openai/gpt-oss-120b` in `.env` (set in Render later; Lane C may pick another model in P6)
- [ ] Vercel project (root dir `apps/web`) and Render service (from `render.yaml`) connected to the GitHub repo
- [ ] Seed photos in `supabase/seed/photos/` (own photos; no faces or number plates)

## Decisions

- 2026-10-11: Deploy on Vercel (web) + Render free tier (AI) + Supabase cloud. Docker and local Supabase dropped; engine tests run against the cloud project. LLM is Groq only (Gemini and Ollama dropped), keyword classifier as the fallback. sentence-transformers swapped for fastembed (same model, ONNX) to fit Render's 512 MB. City layout lives at `apps/web/src/features/city/layout/navnagar.json`.

- 2026-10-11: **English is the default language** (Studio). NIVA agent default = English (Marathi, Hindi as additional languages); web first load = `en` when nothing is stored; `profiles.preferred_language` default and the sign-up trigger fallback = `en` (migration `20261011090400`). Demo users keep their own languages (Sunita mr, Ramesh hi, Aisha en), and NIVA starts each session in the user's language through the language override.
- 2026-10-11: The ElevenLabs free plan refuses library voices over the API (402). NIVA uses Sarah (premade, copied to My Voices, `gJU2icYQsdEmbGJ65Z8W`); the API accepts it, including Marathi. Upgrade to Starter only if the 10k characters a month run short.

## Entries

### P2 Workflow engine (done 2026-10-11 15:30)
- Built: 7 migrations. `engine_base` (`now_sim`, `append_audit` + `audit_hash` with advisory lock 4242, `_refusal`/`_deny` helpers, `notify` with en/hi/mr citizen templates, `sla_ratio`/`sla_status_of` as PostgREST computed fields + `sla_status(id)`), `engine_transition` (`transition_request` over `workflow_transitions` with a guard registry and an effect registry, in the WORKFLOW.md check order; `create_request`, `attach_photo`), `engine_sweep_admin` (`run_escalation_sweep` + pg_cron job `govfix-escalation-sweep` every minute, `time_machine_advance`, `set_ai_offline`, `verify_audit_chain`, `tamper_demo`, `decide_suggestion`, `send_citizen_update`, `add_staff_note`, `update_sla_policy`, `mark_read`), `engine_public` (`public_markers`, `track_request`, `my_request_timeline`, `resolve_landmark`, `locate_point`), `reset_demo` + 25-request scenario, plus two fix migrations. `npm run demo:reset` (`scripts/demo-reset.ts`). Types regenerated. Tests: `tests/engine/workflow.test.ts` + `time-audit.test.ts` cover all 20 WORKFLOW.md tests; with `rls.test.ts` that's 45/45 passing against the cloud project.
- Scenario: tickets 000117 to 000141, so the first demo complaint is **NMC-2026-000142**. 000131 is the open water leak 250 m from Ghantaghar Chowk, submitted 20h ago (assigned to Patil, at risk). After the reset sweep: 4 past deadline (3 at L1, 000127 at L2), 1 triage escalation (000120), 2 NEEDS_INFO, 3 RESOLVED awaiting confirmation, 1 REOPENED, 3 CLOSED, 2 REJECTED (000139 merged into 000131). All 10 wards.
- Deviations (why):
  - `assign`/`reassign` set `assigned_officer_id` implicitly (any transition that requires `officer_id`); workflow.yaml lists no effect for it, and adding one would change the workflow config.
  - `clear_department` also clears `category_code`: a reroute sends the request back for a fresh triage.
  - Extra validations that refuse (and log) instead of erroring: `INVALID_FIELD:category_code|department_code|reason_code|ai_suggestion_id`. `create_request` and `attach_photo` refuse with codes too. `attach_photo` checks the object really exists in the bucket under the caller's folder.
  - Notifications beyond the PRD table: `rejected` (citizen, on reject/merge) and `info_provided` (officer, on the citizen's reply). Staff-facing texts are English only.
  - Test 10: auto-close (72h) always closes a RESOLVED request before the 7-day reopen window ends, so the reopen-window guard can only refuse if auto-close hasn't run. The test raises `auto_close_hours` for its duration and restores it.
  - Calls with no `auth.uid()` (service role, pg_cron) act as `system`; that's how `npm run demo:reset` works. The demo-mode check still applies to them.
  - `reset_demo` also deletes SLA policy versions created in the demo (`created_by is not null`).
  - Engine tests now `reset_demo()` in `beforeAll` too (they need the clock at zero and an intact chain), and test 10/20 briefly change `app_settings` (`auto_close_hours`, `demo_mode`). Never run them during a presentation.
  - `postgres` 3.4.9 added as a root dev dependency (test 17 connects as `ai_writer`).
- Known issues: the scenario's RESOLVED requests have no proof photo rows (no seed photos yet). `locate_point` can't refuse river clicks: the river isn't in the database (stub layout), so the picker has to refuse them client-side until Lane D adds it. `track_request` has no rate limit on phone-digit guesses (marked `ponytail:`). Advisor: the "SECURITY DEFINER callable" warnings are by design (RPCs are the only write path); search_path warnings fixed.
- For the next lanes: P3/P4/P5 call these through `apps/web/src/lib/rpc.ts`, which doesn't exist yet; whoever touches it first creates it. Use `select=*,sla_status_of,sla_ratio` on `requests` for SLA badges. Staff tabs should call `run_escalation_sweep()` every 30s.
- Manual steps for Studio: none new.

### Setup check (2026-10-11 15:10)
- All green: lint, typecheck, web tests, web build, AI tests, `db push` ("up to date"), engine/RLS tests 25/25.
- Connections verified: `SUPABASE_DB_URL` (db push), `AI_DATABASE_URL` (ai_writer via the aws-0 pooler), ElevenLabs agent read and signed-URL issue (authentication on), Groq (15 unique valid keys; one key is listed twice in `.env`), Marathi TTS with the NIVA voice.
- NIVA agent as configured: default `en`, presets `mr`/`hi` with `{{first_message}}`, LLM `deepseek-v41-flash`, TTS `eleven_v4_turbo`, voice `gJU2icYQsdEmbGJ65Z8W`, 5 dynamic-variable placeholders, Language override on, no tools yet.
- Supabase advisor: only the accepted warnings remain (`my_role`/`my_department` callable by design, Supabase's `rls_auto_enable` event trigger, leaked-password protection is a dashboard toggle).


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
