-- GovFix schema: extensions, enums, tables. See docs/DATABASE.md.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create type app_role      as enum ('citizen','officer','dept_head','manager','commissioner');
create type request_state as enum ('SUBMITTED','TRIAGED','ASSIGNED','IN_PROGRESS','NEEDS_INFO','RESOLVED','REOPENED','CLOSED','REJECTED');
create type channel       as enum ('web','voice','staff','system','api');
create type audit_outcome as enum ('accepted','refused');

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
  code text primary key,
  name_en text not null, name_hi text not null, name_mr text not null,
  head_id uuid
);

create table wards (
  id smallint primary key,
  name_en text not null, name_hi text not null, name_mr text not null,
  polygon jsonb not null,                 -- [[x,z],...] city metres, same as the 3D layout
  center_x real not null, center_z real not null
);

create table landmarks (
  id serial primary key,
  ward_id smallint not null references wards,
  name_en text not null, name_hi text not null, name_mr text not null,
  aliases text[] not null default '{}',
  x real not null, z real not null
);

create table categories (
  code text primary key,
  department_code text references departments,   -- null for 'other'
  name_en text not null, name_hi text not null, name_mr text not null,
  icon text not null,
  keywords text[] not null default '{}'
);

create table sla_policies (                      -- versioned: never update, insert a new row
  id serial primary key,
  category_code text not null references categories,
  resolution_hours int not null check (resolution_hours > 0),
  effective_from timestamptz not null,
  created_by uuid, note text
);
create index on sla_policies (category_code, effective_from desc);

create table workflow_transitions (
  action text not null,
  from_state request_state not null,
  to_state request_state not null,
  allowed_roles text[] not null,
  requires text[] not null default '{}',
  guards   text[] not null default '{}',
  effects  text[] not null default '{}',
  primary key (action, from_state)
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role app_role not null default 'citizen',
  department_code text references departments,
  phone text,
  preferred_language text not null default 'mr' check (preferred_language in ('en','hi','mr')),
  large_text boolean not null default false,
  created_at timestamptz not null default now()
);

alter table departments add constraint departments_head_fk foreign key (head_id) references profiles on delete set null;
alter table sla_policies add constraint sla_policies_created_by_fk foreign key (created_by) references profiles on delete set null;

create table officer_wards (
  officer_id uuid references profiles on delete cascade,
  ward_id smallint references wards,
  primary key (officer_id, ward_id)
);

create sequence ticket_seq start 100;

create table requests (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null,
  citizen_id uuid not null references profiles,
  channel channel not null,
  language text not null,
  description text not null,
  transcript text,
  ward_id smallint not null references wards,
  landmark_id int references landmarks,
  loc_x real, loc_z real,
  category_hint text,
  category_code text references categories,
  department_code text references departments,
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
  escalation_level smallint not null default 0,
  resolved_at timestamptz,
  closed_at timestamptz,
  duplicate_of uuid references requests,
  reopen_count smallint not null default 0,
  updated_at timestamptz not null
);
create index on requests (citizen_id);
create index on requests (department_code, state);
create index on requests (assigned_officer_id);
create index on requests (state);

create table request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests on delete cascade,
  kind text not null check (kind in ('report','proof')),
  storage_path text not null,
  uploaded_by uuid not null references profiles,
  created_at timestamptz not null
);
create index on request_photos (request_id);
create index on request_photos (storage_path);

create table request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests on delete cascade,
  author_id uuid references profiles,
  kind text not null check (kind in ('info_question','info_reply','citizen_update','staff_note')),
  visibility text not null check (visibility in ('citizen','staff')),
  body text not null,
  language text,
  ai_suggestion_id uuid,
  created_at timestamptz not null
);
create index on request_messages (request_id);

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
create index on ai_suggestions (request_id);
alter table request_messages add constraint request_messages_ai_fk foreign key (ai_suggestion_id) references ai_suggestions on delete set null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  request_id uuid references requests on delete cascade,
  kind text not null,
  title text not null, body text not null, language text not null,
  audio_path text,
  read_at timestamptz,
  created_at timestamptz not null
);
create index on notifications (user_id, created_at desc);

create table audit_events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  sim_ts timestamptz not null,
  actor_id uuid,
  actor_role text not null,
  channel channel not null,
  request_id uuid references requests on delete set null,
  action text not null,
  from_state request_state,
  to_state request_state,
  outcome audit_outcome not null,
  code text,
  reason text,
  payload jsonb not null default '{}',
  prev_hash text not null,
  hash text not null
);
create index on audit_events (request_id, id);
