# Build phases

Each phase ends with `/commit-phase <N> <summary>`. Don't start a phase until its dependencies are committed.

## Lanes for parallel Claude Code sessions (12 hours)

| Time | Lane A (core, Studio) | Lane B (citizen UI) | Lane C (AI + NIVA) | Lane D (city) |
|---|---|---|---|---|
| 0:00–0:40 | P0 scaffold | Write i18n strings, collect seed photos | ElevenLabs agent setup + Marathi voice test (NIVA.md) | Author `navnagar.json` |
| 0:40–2:30 | P1 database, P2 engine | P3 shell (after P1) | P6 AI service (standalone) | P8a city geometry on a standalone route |
| 2:30–6:00 | P5 staff workspaces | P4 citizen | P7 NIVA | P8a continued |
| 6:00–8:30 | P9 admin & proof tools | P4 finish, notifications, voice notes | P6/P7 wiring into triage + report | P8b markers, props, photos, picker |
| 8:30–10:00 | Integration fixes | a11y + i18n review | Fallback drills | Performance pass |
| 10:00–12:00 | P10 demo hardening and two full rehearsals (everyone) | | | |

Folder ownership: A owns `supabase/`, `config/`, `scripts/`, `features/{triage,department,officer,request-detail,admin}`. B owns `features/{public,report,citizen,auth}`, `i18n/`. C owns `services/ai/`, `features/{ai,niva}`. D owns `features/city/`. Shared components (`components/`) are changed only by Lane A or with a heads-up.

---

## P0: Scaffold (Lane A)
Read first: CLAUDE.md, ARCHITECTURE.md, DESIGN.md (tokens, type)
- npm workspaces: `apps/web` (Vite React TS strict), `services/ai` (FastAPI with `/health`), `supabase init` + `supabase link --project-ref xwojruafxtczmqwsasgk`, `config/`, `scripts/`.
- `apps/web/vercel.json` (SPA rewrite) and root `render.yaml` for services/ai.
- Tailwind + shadcn/ui. DESIGN.md tokens as CSS variables and a Tailwind theme. Fonts via @fontsource.
- ESLint, Prettier, Vitest, pytest. `.gitignore` covering node_modules, dist, `.env*` (but not `.env.example`), `supabase/.temp`, `.venv`, `__pycache__`.
- All root scripts from CLAUDE.md (stubs allowed).
- Git remote set to https://github.com/Woodbulky/GovFix.git.

**Done when:** `npm run dev` shows a token/typography test page in en/hi/mr; `npm run ai` → `/health` 200; `npm run db:push` reaches the cloud project; lint, typecheck and test pass.
Commit: `feat(phase-0): scaffold web, ai service and supabase`

## P1: Database and seed (Lane A)
Read first: DATABASE.md, WORKFLOW.md, config/workflow.yaml, CITY.md (layout section)
- Migrations: extensions, enums, tables, grants and revokes, RLS, the `ai_writer` role, storage buckets and policies, realtime publication, audit no-update trigger.
- `scripts/gen-workflow.ts`, `scripts/gen-city-seed.ts` (uses Lane D's `navnagar.json`; a stub with 10 wards and 15 landmarks is fine until D lands it), `03_reference.sql` with category keywords.
- `scripts/seed-users.ts` with every PRD demo user, `officer_wards`, department heads. `scripts/set-ai-writer-password.ts`.
- `npm run db:types`.

**Done when:** `npm run db:push && npm run seed:users` is clean on the cloud project; tests prove anon can't read requests, authenticated can't insert or update requests directly, and reference tables are readable.
Commit: `feat(phase-1): schema, rls, seed data and demo users`

## P2: Workflow engine (Lane A)
Read first: WORKFLOW.md, DATABASE.md (RPCs, audit chain)
- `now_sim`, `my_role`, `append_audit`, `create_request`, `attach_photo`, `transition_request` (generic: reads the transitions table, guard registry, effect registry), `sla_status`, `run_escalation_sweep` + pg_cron schedule, `time_machine_advance`, `set_ai_offline`, `verify_audit_chain`, `tamper_demo`, `decide_suggestion`, `send_citizen_update`, `add_staff_note`, `update_sla_policy`, `public_markers`, `track_request`, `my_request_timeline`, `resolve_landmark`, `locate_point`, `mark_read`, `reset_demo` with the scenario.
- `tests/engine/*.test.ts`: all 20 tests from WORKFLOW.md.

**Done when:** all 20 engine tests pass, and `reset_demo()` loads the scenario.
Commit: `feat(phase-2): workflow engine, sla escalation and audit chain`

## P3: Auth and app shell (Lane B)
Read first: PRD.md (roles, screens), DESIGN.md
- Login (email + password). Demo role switcher, shown only when `VITE_DEMO_MODE` is true and `demo_mode` is on: it signs in as a seeded user, so the token really changes.
- Layouts (Public, Citizen, Staff), role-based routes and sidebar items exactly as in PRD.md, a "Not available for your role" page.
- Header: language switch, large text, NIVA button placeholder, Sim time badge.
- `rpc.ts` typed wrappers, `queries.ts`, a realtime hook, and the shared StatusChip, SlaBadge, EscalationBadge and ProviderBadge components.

**Done when:** every demo user lands on the right home, sees only their tabs, and a pasted URL for another role's page shows the not-available page.
Commit: `feat(phase-3): auth, role-based shell and shared status components`

## P4: Citizen experience (Lane B)
Read first: PRD.md (Public, Citizen), DESIGN.md, CITY.md (2D fallback, picker)
- Public: Home (poster hero until the city lands), Track, Departments.
- Report (typed): 4 steps, 2D location picker (`CityMap2D`), photos (compress, strip EXIF, upload, `attach_photo`), review, success. Calls `/suggest` after creation (ignores failure).
- My complaints, Complaint detail (stepper, public timeline, photos, Send reply / Yes, it's fixed / Still a problem), Notifications with voice-note playback and browser speech fallback, Profile.

**Done when:** Sunita files a complaint with a photo; Ramesh can't see it; reply, confirm and reopen work and show refusal messages when invalid; all citizen screens work in en, hi and mr.
Commit: `feat(phase-4): citizen reporting, tracking and notifications`

## P5: Staff workspaces (Lane A)
Read first: PRD.md (Officer, Dept Head, Manager), WORKFLOW.md
- Shared Request Detail (3 panels; AI panel shows "No suggestion yet" until P6 is wired).
- Manager: triage queue, triage drawer (category picker, deadline preview, merge, reject), duplicates list, all requests.
- Dept Head: Kanban board (@dnd-kit; each drop calls `transition_request` with `expected_state`; refusals snap back with a toast), To assign (eligibility from guards, greyed with reasons), Escalations, Officers.
- Officer: My work, start / ask info / resolve with proof photo, send update.
- Realtime refresh everywhere. Staff tabs call `run_escalation_sweep()` every 30s.

**Done when:** a full lifecycle works by clicking as Meera → Deshmukh → Patil → Sunita; an invalid board drop is refused, toasted and logged; reroute works.
Commit: `feat(phase-5): manager triage, department board and officer workflow`

## P6: AI service (Lane C)
Read first: AI.md, DATABASE.md (ai_writer)
- Endpoints, provider chain (Groq → keyword), JWT verification, `ai_writer` connection, keyword fallback, multilingual duplicate detection, optional vision, draft replies, `/tts`, `/niva/session`.
- Labelled set (20 examples) with an accuracy report per provider in the README.
- Web: AI Suggestions panel (Accept / Edit / Dismiss → `decide_suggestion`; Accept pre-fills the triage drawer), ProviderBadge, draft reply → `send_citizen_update`, highlighted extracted spans.

**Done when:** deployed on Render and `/health` is 200 from the Vercel origin; the Marathi water-leak text gives `water_leak` ≥0.8 from `llm` (Groq); the AI offline toggle gives `keyword`; the seeded near-duplicate is suggested; the `ai_writer` update test passes; the service down means triage still works manually.
Commit: `feat(phase-6): ai suggestions with local and keyword fallbacks`

## P7: NIVA (Lane C)
Read first: NIVA.md, DESIGN.md (call screen)
- Manual first: Studio confirms the agent exists and the env vars are set.
- Call screen, conversation hook with dynamic variables, all client tools, draft card, voice submission (`channel = 'voice'`, transcript, confirmation_text), status tools, navigation and accessibility tools, page summaries, voice notes for notifications.
- Fallback to typed with the draft preserved.

**Done when:** the 7 manual tests in NIVA.md pass.
Commit: `feat(phase-7): NIVA voice assistant with navigation tools`

## P8: Navnagar 3D city (Lane D; P8a can start right after P0)
Read first: CITY.md, DESIGN.md
- P8a: layout JSON, worker generation, terrain, river, bridges, roads, buildings by ward character, vegetation, sky and sun from sim time, traffic, the three navigation modes, minimap, search, 2D fallback. Can run on a standalone route with no DB.
- P8b: markers from `public_markers()` / RLS requests with realtime, clustering, issue props, photo drawer and billboard, the 3D location picker replacing 2D in Report, NIVA `fly_to` / `filter_city`, the home hero.

**Done when:** 60 fps in overview on the team laptop; walk mode collides with buildings; a new complaint's pin appears live; props vanish when resolved; photos are hidden for the public; the picker returns ward + landmark; the WebGL-off path shows 2D.
Commits: `feat(phase-8a): procedural navnagar city and navigation`, `feat(phase-8b): live complaints, issue props and photos in the city`

## P9: Admin and proof tools (Lane A)
Read first: PRD.md (Commissioner), PROBLEM_STATEMENT.md
- Overview (live queries), All requests, Escalations, Audit log (filters, Verify chain, Tamper demo), Workflow & SLA (Mermaid diagram from the table, transition table, versioned SLA editor), Time Machine, API Console, Users.

**Done when:** demo script steps 5, 6, 8 and 9 in PRD.md work end to end.
Commit: `feat(phase-9): admin overview, audit verification, time machine and api console`

## P10: Demo hardening (everyone)
- `npm run demo:reset` gives a fixed scenario; seed photos are in place (if real photos are missing, generate illustrated placeholders so nothing breaks).
- README: setup, run, judge guide (logins, the 9-step script), AI accuracy table, fallback instructions.
- Contrast and keyboard pass, Marathi and Hindi copy review by Studio, performance pass on the presenting laptop.
- Production deploy: Vercel (web) and Render (AI) from `main`, Vercel URL added to Supabase Auth redirect URLs and the AI service's `ALLOWED_ORIGINS`.
- Fallback drill: AI offline toggle, Render asleep (wake via `/health`), NIVA down, WebGL off, phone hotspot.
- Two full rehearsals of the PRD demo script, timed.

**Done when:** two clean rehearsals under 5 minutes.
Commit: `chore(phase-10): demo hardening`, then `git tag v1.0-demo && git push origin --tags`.
