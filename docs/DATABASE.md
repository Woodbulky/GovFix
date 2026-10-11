# Database (Supabase Postgres)

Everything consequential lives here: the workflow engine, role enforcement, SLA maths, escalation and the audit chain. The frontend and the AI service are clients.

## Extensions and types

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create type app_role      as enum ('citizen','officer','dept_head','manager','commissioner');
create type request_state as enum ('SUBMITTED','TRIAGED','ASSIGNED','IN_PROGRESS','NEEDS_INFO','RESOLVED','REOPENED','CLOSED','REJECTED');
create type channel       as enum ('web','voice','staff','system','api');
create type audit_outcome as enum ('accepted','refused');
```

## Tables

```sql
create table app_settings (
  id int primary key default 1 check (id = 1),
  sim_offset_seconds bigint not null default 0,
  ai_offline   boolean not null default false,
  demo_mode    boolean not null default true,
  triage_hours int not null default 4,
  reopen_window_hours int not null default 168,
  auto_close_hours    int not null default 72,
  warn_at numeric not null default 0.75
);

create table departments (
  code text primary key,                  -- WTR SWM RDS ELE SAN HLT
  name_en text not null, name_hi text not null, name_mr text not null,
  head_id uuid                            -- FK to profiles added after profiles exists
);

create table wards (
  id smallint primary key,                -- 1..10
  name_en text not null, name_hi text not null, name_mr text not null,
  polygon jsonb not null,                 -- [[x,z],...] in city metres, same as the 3D layout
  center_x real not null, center_z real not null
);

create table landmarks (
  id serial primary key,
  ward_id smallint not null references wards,
  name_en text not null, name_hi text not null, name_mr text not null,
  aliases text[] not null default '{}',   -- romanised + Devanagari variants for NIVA matching
  x real not null, z real not null
);

create table categories (
  code text primary key,
  department_code text references departments,   -- null for 'other'
  name_en text not null, name_hi text not null, name_mr text not null,
  icon text not null,
  keywords text[] not null default '{}'          -- keyword-fallback classifier (en/hi/mr + romanised)
);

create table sla_policies (                      -- versioned: never update, insert a new row
  id serial primary key,
  category_code text not null references categories,
  resolution_hours int not null check (resolution_hours > 0),
  effective_from timestamptz not null,
  created_by uuid, note text
);

create table workflow_transitions (
  action text not null,
  from_state request_state not null,
  to_state request_state not null,
  allowed_roles text[] not null,                 -- includes 'system'
  requires text[] not null default '{}',
  guards   text[] not null default '{}',
  effects  text[] not null default '{}',
  primary key (action, from_state)
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role app_role not null default 'citizen',
  department_code text references departments,   -- officers and dept heads
  phone text,                                    -- fictional
  preferred_language text not null default 'en' check (preferred_language in ('en','hi','mr')),
  large_text boolean not null default false,
  created_at timestamptz not null default now()
);

create table officer_wards (
  officer_id uuid references profiles on delete cascade,
  ward_id smallint references wards,
  primary key (officer_id, ward_id)
);

create sequence ticket_seq start 100;

create table requests (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null,                -- NMC-2026-000142
  citizen_id uuid not null references profiles,
  channel channel not null,
  language text not null,
  description text not null,
  transcript text,                               -- NIVA conversation transcript, if voice
  ward_id smallint not null references wards,
  landmark_id int references landmarks,
  loc_x real, loc_z real,
  category_hint text,                            -- what the citizen picked ("not sure" = null); not authoritative
  category_code text references categories,     -- set only by triage
  department_code text references departments,  -- set only by triage
  state request_state not null default 'SUBMITTED',
  assigned_officer_id uuid references profiles,
  submitted_at timestamptz not null,
  triage_due_at timestamptz not null,
  triage_escalated_at timestamptz,
  sla_policy_id int references sla_policies,
  sla_clock_start timestamptz,
  resolution_due_at timestamptz,
  paused_since timestamptz,
  paused_seconds int not null default 0,
  escalation_level smallint not null default 0,  -- resolution-stage escalation: 0, 1, 2
  resolved_at timestamptz,
  closed_at timestamptz,
  duplicate_of uuid references requests,
  reopen_count smallint not null default 0,
  updated_at timestamptz not null
);

create table request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests on delete cascade,
  kind text not null check (kind in ('report','proof')),
  storage_path text not null,
  uploaded_by uuid not null references profiles,
  created_at timestamptz not null
);

create table request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests on delete cascade,
  author_id uuid references profiles,            -- null = system
  kind text not null check (kind in ('info_question','info_reply','citizen_update','staff_note')),
  visibility text not null check (visibility in ('citizen','staff')),
  body text not null,
  language text,
  ai_suggestion_id uuid,                         -- set when an AI draft was used
  created_at timestamptz not null
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests on delete cascade,
  type text not null check (type in ('category','extraction','duplicate','draft_reply','photo_category')),
  payload jsonb not null,
  confidence numeric check (confidence between 0 and 1),
  provider text not null check (provider in ('llm','local','keyword','vision')),
  model text,
  status text not null default 'pending' check (status in ('pending','accepted','edited','dismissed')),
  decided_by uuid references profiles,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  request_id uuid references requests on delete cascade,
  kind text not null,
  title text not null, body text not null, language text not null,
  audio_path text,                               -- voice-notes bucket; null → browser speech fallback
  read_at timestamptz,
  created_at timestamptz not null
);

create table audit_events (
  id bigserial primary key,
  ts timestamptz not null default now(),         -- wall-clock
  sim_ts timestamptz not null,                   -- now_sim() at the time
  actor_id uuid,                                 -- null = SYSTEM
  actor_role text not null,                      -- app_role or 'system'
  channel channel not null,
  request_id uuid references requests on delete set null,
  action text not null,                          -- transition action, or create_request, escalate, ai_suggestion_decided,
                                                 -- sla_policy_updated, time_advanced, ai_offline_toggled, demo_reset, ...
  from_state request_state,
  to_state request_state,
  outcome audit_outcome not null,
  code text,                                     -- refusal code
  reason text,
  payload jsonb not null default '{}',
  prev_hash text not null,
  hash text not null
);
create index on audit_events (request_id, id);
```

## Grants and RLS

- `revoke insert, update, delete on all tables in schema public from anon, authenticated;` then grant only `select` where RLS allows it. Writes happen only through `SECURITY DEFINER` RPCs owned by `postgres`, each with `set search_path = public`.
- Helper: `my_role()` is `stable security definer` and returns the caller's `app_role` (or null).
- **requests** select: citizen → own; officer → assigned to them, or department + covered ward; dept_head → own department; manager and commissioner → all.
- **request_photos / request_messages** follow request visibility. Citizens see only `visibility = 'citizen'` messages.
- **ai_suggestions** select: staff on visible requests. Citizens never see them.
- **audit_events** select: commissioner → all; manager → all; dept_head → their department's requests; officer → their requests; citizen → none (citizens get the public timeline through `track_request` / `my_request_timeline`).
- **notifications**: own rows only. Update `read_at` through the `mark_read()` RPC.
- **Reference tables** (departments, wards, landmarks, categories, sla_policies, workflow_transitions): readable by everyone, including anon.
- **audit_events** has a `before update or delete` trigger that raises unless `current_setting('govfix.tamper_demo', true) = 'on'`.

### `ai_writer` role (golden rule 3, enforced physically)

```sql
create role ai_writer login password '...';      -- password from env, set in a migration via a seed script
grant usage on schema public to ai_writer;
grant select on requests, request_photos, categories, landmarks, wards, app_settings, ai_suggestions to ai_writer;
grant insert on ai_suggestions to ai_writer;
grant update (audio_path) on notifications to ai_writer;
-- no other grants. Test 17 in WORKFLOW.md proves UPDATE on requests is denied.
```

The AI service connects with `AI_DATABASE_URL` through the Supavisor **session pooler** (user `ai_writer.<project_ref>`, port 5432; copy the host from the dashboard's Connect panel). Render has no IPv6, and the direct `db.<ref>.supabase.co` host is IPv6-only. The migration creates `ai_writer` as `nologin`; `scripts/set-ai-writer-password.ts` (or one SQL statement in the dashboard) runs `alter role ai_writer login password '...'` from env, so the password never lands in git. If the pooler won't accept the custom role, fall back to an `insert_ai_suggestion()` RPC called with the service key, keep test 17 as proof that the role itself is locked down, and record the choice in PROGRESS.md.

## RPCs (all `security definer`, `set search_path = public`)

| Function | Who | Does |
|---|---|---|
| `now_sim()` | all | `now() + sim_offset_seconds` |
| `create_request(p jsonb)` | citizen | Validates ward (required), landmark/coords, description; ticket from `ticket_seq`; `triage_due_at`; audit `create_request` with channel and, for voice, `payload.confirmation_text` + conversation id |
| `attach_photo(request_id, storage_path, kind)` | owner citizen (`report`, while SUBMITTED) or assigned officer (`proof`) | Inserts `request_photos`, audit |
| `transition_request(...)` | per workflow | See WORKFLOW.md |
| `decide_suggestion(id, decision, edited_payload)` | staff | Marks a suggestion accepted/edited/dismissed, audit. **Changes nothing on the request** |
| `send_citizen_update(request_id, body, ai_suggestion_id)` | assigned officer, dept head | Citizen-visible message + notification, audit |
| `add_staff_note(request_id, body)` | staff with visibility | Staff-only message, audit |
| `run_escalation_sweep()` | staff, pg_cron | See WORKFLOW.md. Returns `{escalated, auto_closed}` |
| `sla_status(request_id)` | anyone who can see it | `untriaged / on_track / at_risk / breached / paused / done` |
| `update_sla_policy(category_code, hours, note)` | commissioner | Inserts a new version, audit |
| `time_machine_advance(seconds)` | commissioner + demo_mode | Shifts the offset, audit `time_advanced`, runs the sweep |
| `set_ai_offline(bool)` | commissioner + demo_mode | Audit `ai_offline_toggled` |
| `reset_demo()` | commissioner + demo_mode | Truncates request data and audit (writes a new genesis row), resets the clock, loads the scenario |
| `verify_audit_chain()` | commissioner, manager | `{ ok, checked, broken_at }` |
| `tamper_demo(event_id)` | commissioner + demo_mode | Sets `govfix.tamper_demo = on` locally and edits one row's `reason` without rehashing |
| `public_markers()` | anon | Non-terminal requests (plus closed in the last 7 days): category, state, ward, coords rounded to 25 m, sla_status, escalation level, age. No ids that reveal people, no text, no photos |
| `track_request(ticket_no, phone_last4)` | anon | Public timeline: states, dates, department, officer name, deadline |
| `my_request_timeline(request_id)` | owner | Same, for signed-in citizens |
| `resolve_landmark(query, ward_hint)` | authenticated | Case- and script-insensitive match on names and aliases → `{found, ...}` or `{found:false, suggestions}`. Never guesses |
| `locate_point(x, z)` | authenticated | Point-in-polygon → ward, plus the nearest landmark within 300 m |
| `mark_read(notification_id)` | owner | Sets `read_at` |

## Audit hash chain

- `append_audit(...)` is the only insert path. It takes `pg_advisory_xact_lock(4242)` so the chain never forks under concurrency.
- `prev_hash` = previous row's `hash`. Genesis = 64 zeros.
- `hash = encode(digest(concat_ws('|', prev_hash, id, sim_ts, coalesce(actor_id::text,'SYSTEM'), actor_role, channel, coalesce(request_id::text,''), action, coalesce(from_state::text,''), coalesce(to_state::text,''), outcome, coalesce(code,''), coalesce(reason,''), payload::text), 'sha256'), 'hex')`
- `jsonb::text` is canonical (sorted keys), so recomputation is stable.
- `verify_audit_chain()` recomputes in id order and returns the first mismatch.

## Storage buckets (all private; signed URLs only)

| Bucket | Path | Write | Read |
|---|---|---|---|
| complaint-photos | `{user_id}/{uuid}.jpg` | Owner citizen | Owner + staff who can see the request (via `request_photos` join) |
| proof-photos | `{officer_id}/{uuid}.jpg` | Officer | Staff + owner citizen |
| voice-notes | `{user_id}/{notification_id}.mp3` | AI service | Owner |

Client-side: compress to ≤1600 px and ≤1 MB, strip EXIF (includes GPS) before upload. Seed photos live in `supabase/seed/photos/`.

## Realtime

Add `requests`, `notifications` and `audit_events` to the `supabase_realtime` publication. RLS still filters what each client receives. Boards, queues, the city markers and notification badges update live.

## Seed data

- `01_workflow.sql`: generated from `config/workflow.yaml`.
- `02_city.sql`: wards and landmarks generated from the city layout JSON (docs/CITY.md). One source, so the 3D city and the database always agree.
- `03_reference.sql`: departments and categories with keyword lists.
- Demo users: `scripts/seed-users.ts` via the auth admin API, then profiles, `officer_wards`, `departments.head_id`.
- Demo scenario: `reset_demo()` loads about 25 requests across all wards and states, with times relative to `now_sim()`. It includes at least 3 already past deadline, 1 at L2, 2 in NEEDS_INFO, 3 RESOLVED awaiting confirmation, and an open water leak 250 m from Ghantaghar submitted 20h ago (the duplicate candidate for demo step 3).
