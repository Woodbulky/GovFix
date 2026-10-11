-- P2 engine base: sim clock, audit hash chain, actor helpers, notifications, SLA maths.
-- See docs/WORKFLOW.md and docs/DATABASE.md. Every function here is internal unless granted below.

-- Sim clock (golden rule 4) -------------------------------------------------------------------------

create or replace function now_sim() returns timestamptz
language sql stable set search_path = public as $$
  select now() + make_interval(secs => coalesce((select sim_offset_seconds from app_settings where id = 1), 0))
$$;
grant execute on function now_sim() to anon, authenticated, service_role, ai_writer;

-- Actor helpers -------------------------------------------------------------------------------------
-- auth.uid() is null only for the service role, pg_cron and migrations: those act as 'system'.

create or replace function _actor_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from profiles where id = auth.uid()),
                  case when auth.uid() is null then 'system' else 'anon' end)
$$;

create or replace function _channel() returns channel
language sql stable as $$ select case when auth.uid() is null then 'system' else 'web' end::channel $$;

create or replace function _state_label(s request_state) returns text
language sql immutable as $$ select upper(left(s::text, 1)) || lower(replace(substr(s::text, 2), '_', ' ')) $$;

-- Audit hash chain ----------------------------------------------------------------------------------
-- One hashing function for insert and verify. timezone is pinned so sim_ts always prints the same.

create or replace function audit_hash(e audit_events) returns text
language sql stable set search_path = public, extensions set timezone = 'UTC' as $$
  select encode(digest(concat_ws('|', e.prev_hash, e.id, e.sim_ts, coalesce(e.actor_id::text, 'SYSTEM'),
    e.actor_role, e.channel, coalesce(e.request_id::text, ''), e.action, coalesce(e.from_state::text, ''),
    coalesce(e.to_state::text, ''), e.outcome, coalesce(e.code, ''), coalesce(e.reason, ''), e.payload::text),
    'sha256'), 'hex')
$$;

-- The only insert path into audit_events. The advisory lock keeps the chain from forking.
create or replace function append_audit(
  p_actor_id uuid, p_actor_role text, p_channel channel, p_request_id uuid, p_action text,
  p_from request_state, p_to request_state, p_outcome audit_outcome,
  p_code text default null, p_reason text default null, p_payload jsonb default '{}'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare e audit_events;
begin
  perform pg_advisory_xact_lock(4242);
  e.prev_hash := coalesce((select hash from audit_events order by id desc limit 1), repeat('0', 64));
  e.id := nextval(pg_get_serial_sequence('audit_events', 'id'));
  e.ts := now();
  e.sim_ts := now_sim();
  e.actor_id := p_actor_id;
  e.actor_role := p_actor_role;
  e.channel := p_channel;
  e.request_id := p_request_id;
  e.action := p_action;
  e.from_state := p_from;
  e.to_state := p_to;
  e.outcome := p_outcome;
  e.code := p_code;
  e.reason := p_reason;
  e.payload := coalesce(p_payload, '{}');
  e.hash := audit_hash(e);
  insert into audit_events select e.*;
  return e.id;
end $$;

-- Refusals are recorded, not thrown (golden rule 2).
create or replace function _refusal(
  p_actor uuid, p_role text, p_channel channel, p_request uuid, p_action text, p_state request_state,
  p_code text, p_message text, p_payload jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  v_id := append_audit(p_actor, coalesce(p_role, 'anon'), p_channel, p_request, p_action, p_state, null,
                       'refused', p_code, p_message, p_payload);
  return jsonb_build_object('ok', false, 'code', p_code, 'message', p_message, 'audit_id', v_id);
end $$;

-- Role/demo-mode check for the admin RPCs. Returns null when allowed, else the recorded refusal.
create or replace function _deny(p_action text, p_roles text[], p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_role text := _actor_role();
begin
  if auth.uid() is not null and not (v_role = any(p_roles)) then
    return _refusal(auth.uid(), v_role, _channel(), null, p_action, null, 'ROLE_NOT_PERMITTED',
      format('Only the %s can do this.', array_to_string(p_roles, ' or ')));
  end if;
  if p_demo and not (select demo_mode from app_settings where id = 1) then
    return _refusal(auth.uid(), v_role, _channel(), null, p_action, null, 'DEMO_MODE_OFF',
      'This is available only in demo mode.');
  end if;
  return null;
end $$;

-- Who can see a request: mirrors the requests_read RLS policy, for use inside SECURITY DEFINER code.
create or replace function _can_see(r requests) returns boolean
language sql stable security definer set search_path = public as $$
  select r.citizen_id = auth.uid()
    or p.role in ('manager', 'commissioner')
    or (p.role = 'dept_head' and r.department_code = p.department_code)
    or (p.role = 'officer' and (r.assigned_officer_id = auth.uid()
        or (r.department_code = p.department_code
            and exists (select 1 from officer_wards ow where ow.officer_id = auth.uid() and ow.ward_id = r.ward_id))))
  from profiles p where p.id = auth.uid()
$$;

-- Notifications -------------------------------------------------------------------------------------
-- Citizen-facing kinds ship in en/hi/mr (voice notes read the body aloud); staff kinds in English.
-- %1$s = ticket number, %2$s = extra text (question, reason, message). Neutral language (golden rule 9).

create or replace function _notification_templates() returns jsonb
language sql immutable as $$
  select '{
    "submitted": {
      "en": ["Complaint received", "We have received your complaint %1$s. The Grievance Cell will review it shortly."],
      "hi": ["शिकायत प्राप्त हुई", "आपकी शिकायत %1$s हमें मिल गई है। शिकायत कक्ष जल्द ही इसकी समीक्षा करेगा।"],
      "mr": ["तक्रार मिळाली", "आपली तक्रार %1$s आम्हाला मिळाली आहे. तक्रार कक्ष लवकरच ती तपासेल."]},
    "triaged": {
      "en": ["Complaint sent to the department", "Your complaint %1$s has been reviewed and sent to the right department."],
      "hi": ["शिकायत विभाग को भेजी गई", "आपकी शिकायत %1$s की समीक्षा हो गई है और उसे संबंधित विभाग को भेज दिया गया है।"],
      "mr": ["तक्रार विभागाकडे पाठवली", "आपली तक्रार %1$s तपासून संबंधित विभागाकडे पाठवली आहे."]},
    "assigned": {
      "en": ["Officer assigned", "A field officer has been assigned to your complaint %1$s."],
      "hi": ["अधिकारी नियुक्त", "आपकी शिकायत %1$s के लिए एक फ़ील्ड अधिकारी नियुक्त किया गया है।"],
      "mr": ["अधिकारी नेमले", "आपल्या तक्रार %1$s साठी क्षेत्र अधिकारी नेमले आहेत."]},
    "needs_info": {
      "en": ["More information needed", "About your complaint %1$s: %2$s"],
      "hi": ["अधिक जानकारी चाहिए", "आपकी शिकायत %1$s के बारे में: %2$s"],
      "mr": ["अधिक माहिती हवी आहे", "आपल्या तक्रार %1$s बद्दल: %2$s"]},
    "resolved": {
      "en": ["Work completed", "Your complaint %1$s has been marked resolved. Please confirm, or tell us if the problem continues."],
      "hi": ["काम पूरा हुआ", "आपकी शिकायत %1$s को हल किया गया है। कृपया पुष्टि करें, या बताएं अगर समस्या बनी हुई है।"],
      "mr": ["काम पूर्ण झाले", "आपली तक्रार %1$s सोडवली आहे. कृपया खात्री करा, किंवा समस्या कायम असल्यास कळवा."]},
    "rejected": {
      "en": ["Complaint closed", "Your complaint %1$s was closed by the Grievance Cell: %2$s"],
      "hi": ["शिकायत बंद की गई", "आपकी शिकायत %1$s शिकायत कक्ष द्वारा बंद की गई: %2$s"],
      "mr": ["तक्रार बंद केली", "आपली तक्रार %1$s तक्रार कक्षाने बंद केली: %2$s"]},
    "auto_closed": {
      "en": ["Complaint closed", "Your complaint %1$s was closed automatically after the confirmation period ended."],
      "hi": ["शिकायत बंद हुई", "पुष्टि की अवधि पूरी होने के बाद आपकी शिकायत %1$s अपने आप बंद हो गई।"],
      "mr": ["तक्रार बंद झाली", "खात्रीची मुदत संपल्यानंतर आपली तक्रार %1$s आपोआप बंद झाली."]},
    "citizen_update": {
      "en": ["Update on your complaint", "%1$s: %2$s"],
      "hi": ["आपकी शिकायत पर अपडेट", "%1$s: %2$s"],
      "mr": ["आपल्या तक्रारीबद्दल अपडेट", "%1$s: %2$s"]},
    "triaged_staff":    {"en": ["New request in your department", "%1$s is ready to be assigned."]},
    "assigned_officer": {"en": ["New assignment", "%1$s has been assigned to you."]},
    "info_provided":    {"en": ["Citizen replied", "The citizen replied on %1$s."]},
    "reopened":         {"en": ["Request reopened", "%1$s was reopened by the citizen: %2$s"]},
    "rerouted":         {"en": ["Request returned for triage", "%1$s was sent back for triage: %2$s"]},
    "triage_escalated": {"en": ["Past its triage deadline", "%1$s is past its triage deadline."]},
    "escalated_l1":     {"en": ["Past its deadline (level 1)", "%1$s is past its resolution deadline."]},
    "escalated_l2":     {"en": ["Past its deadline (level 2)", "%1$s is well past its resolution deadline."]}
  }'::jsonb
$$;

create or replace function notify(p_user uuid, p_request uuid, p_kind text, p_extra text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_tpl jsonb := _notification_templates() -> p_kind; v_lang text; v_ticket text;
begin
  if p_user is null then return; end if;
  if v_tpl is null then raise exception 'unknown notification kind %', p_kind; end if;
  select preferred_language into v_lang from profiles where id = p_user;
  if v_lang is null or not v_tpl ? v_lang then v_lang := 'en'; end if;
  select ticket_no into v_ticket from requests where id = p_request;
  insert into notifications (user_id, request_id, kind, title, body, language, created_at)
  values (p_user, p_request, p_kind, v_tpl -> v_lang ->> 0,
          format(v_tpl -> v_lang ->> 1, v_ticket, coalesce(p_extra, '')), v_lang, now_sim());
end $$;

create or replace function notify_role(p_role app_role, p_request uuid, p_kind text, p_extra text default null)
returns void language sql security definer set search_path = public as $$
  select notify(id, p_request, p_kind, p_extra) from profiles where role = p_role
$$;

-- SLA maths (all in SQL, golden rule 4) ---------------------------------------------------------------
-- Both take the requests row, so PostgREST exposes them as computed fields: select=*,sla_status_of,sla_ratio

create or replace function sla_ratio(r requests) returns numeric
language sql stable set search_path = public as $$
  select case when r.sla_clock_start is null or r.resolution_due_at is null then null else
    (extract(epoch from coalesce(r.paused_since,
                                 case when r.state in ('RESOLVED', 'CLOSED') then r.resolved_at end,
                                 now_sim()) - r.sla_clock_start) - r.paused_seconds)
    / nullif(extract(epoch from r.resolution_due_at - r.sla_clock_start) - r.paused_seconds, 0) end
$$;

create or replace function sla_status_of(r requests) returns text
language sql stable set search_path = public as $$
  select case
    when r.state = 'SUBMITTED' then 'untriaged'
    when r.state = 'NEEDS_INFO' then 'paused'
    when r.state in ('RESOLVED', 'CLOSED', 'REJECTED') then 'done'
    when sla_ratio(r) >= 1 then 'breached'
    when sla_ratio(r) >= (select warn_at from app_settings where id = 1) then 'at_risk'
    else 'on_track' end
$$;

-- RPC form: runs as the caller, so RLS decides whether the request is visible (null if not).
create or replace function sla_status(p_request_id uuid) returns text
language sql stable set search_path = public as $$
  select sla_status_of(r) from requests r where r.id = p_request_id
$$;

grant execute on function sla_ratio(requests), sla_status_of(requests), sla_status(uuid) to authenticated, service_role;
