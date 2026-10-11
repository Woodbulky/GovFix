-- P2: escalation sweep + pg_cron, Time Machine, AI offline, audit verify/tamper, suggestions, messages,
-- SLA policy versions, notifications read state.

-- Escalation sweep (docs/WORKFLOW.md "Escalation sweep"). Idempotent: each level is logged once. -----

create or replace function _sweep() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r requests; v_ratio numeric; v_head uuid; v_esc int := 0; v_closed int := 0;
begin
  perform pg_advisory_xact_lock(4243);  -- cron, Time Machine and staff tabs may all call this at once

  for r in select * from requests where state = 'SUBMITTED' and triage_escalated_at is null
                                    and now_sim() >= triage_due_at order by submitted_at for update loop
    update requests set triage_escalated_at = now_sim(), updated_at = now_sim() where id = r.id;
    perform append_audit(null, 'system', 'system', r.id, 'escalate', r.state, r.state, 'accepted', null,
                         'Past its triage deadline', jsonb_build_object('stage', 'triage', 'level', 1));
    perform notify_role('commissioner', r.id, 'triage_escalated');
    v_esc := v_esc + 1;
  end loop;

  for r in select * from requests where state in ('TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED')
                                    and escalation_level < 2 order by submitted_at for update loop
    v_ratio := sla_ratio(r);
    v_head := (select head_id from departments where code = r.department_code);
    if v_ratio >= 1 and r.escalation_level < 1 then
      update requests set escalation_level = 1, updated_at = now_sim() where id = r.id;
      perform append_audit(null, 'system', 'system', r.id, 'escalate', r.state, r.state, 'accepted', null,
        'Past its resolution deadline', jsonb_build_object('stage', 'resolution', 'level', 1, 'ratio', round(v_ratio, 3)));
      perform notify(v_head, r.id, 'escalated_l1');
      perform notify(r.assigned_officer_id, r.id, 'escalated_l1');
      v_esc := v_esc + 1;
    end if;
    if v_ratio >= 1.5 then
      update requests set escalation_level = 2, updated_at = now_sim() where id = r.id;
      perform append_audit(null, 'system', 'system', r.id, 'escalate', r.state, r.state, 'accepted', null,
        'Past its resolution deadline by half again', jsonb_build_object('stage', 'resolution', 'level', 2, 'ratio', round(v_ratio, 3)));
      perform notify_role('commissioner', r.id, 'escalated_l2');
      perform notify(v_head, r.id, 'escalated_l2');
      v_esc := v_esc + 1;
    end if;
  end loop;

  for r in select * from requests where state = 'RESOLVED'
      and now_sim() - resolved_at >= make_interval(hours => (select auto_close_hours from app_settings where id = 1)) loop
    if (_transition(r.id, 'auto_close', 'RESOLVED', '{}', 'system', null, null, 'system') ->> 'ok')::boolean then
      v_closed := v_closed + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'escalated', v_esc, 'auto_closed', v_closed);
end $$;

create or replace function run_escalation_sweep() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce(_deny('run_escalation_sweep', array['officer', 'dept_head', 'manager', 'commissioner']), _sweep());
end $$;
grant execute on function run_escalation_sweep() to authenticated;

-- Every minute. cron.schedule with a name replaces an existing job of the same name.
select cron.schedule('govfix-escalation-sweep', '* * * * *', 'select public._sweep()');

-- Time Machine and AI offline (commissioner + demo mode) -----------------------------------------------

create or replace function time_machine_advance(p_seconds bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_denied jsonb := _deny('time_advanced', array['commissioner'], true); v_offset bigint;
begin
  if v_denied is not null then return v_denied; end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 30 * 86400 then
    return _refusal(auth.uid(), _actor_role(), _channel(), null, 'time_advanced', null, 'INVALID_FIELD:seconds',
                    'Jump forward by between 1 second and 30 days.');
  end if;
  update app_settings set sim_offset_seconds = sim_offset_seconds + p_seconds where id = 1
    returning sim_offset_seconds into v_offset;
  perform append_audit(auth.uid(), _actor_role(), _channel(), null, 'time_advanced', null, null, 'accepted', null, null,
                       jsonb_build_object('seconds', p_seconds, 'offset_seconds', v_offset));
  return jsonb_build_object('ok', true, 'now_sim', now_sim(), 'offset_seconds', v_offset, 'sweep', _sweep());
end $$;

create or replace function set_ai_offline(p_offline boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_denied jsonb := _deny('ai_offline_toggled', array['commissioner'], true);
begin
  if v_denied is not null then return v_denied; end if;
  update app_settings set ai_offline = coalesce(p_offline, false) where id = 1;
  return jsonb_build_object('ok', true, 'ai_offline', coalesce(p_offline, false), 'audit_id',
    append_audit(auth.uid(), _actor_role(), _channel(), null, 'ai_offline_toggled', null, null, 'accepted', null, null,
                 jsonb_build_object('ai_offline', coalesce(p_offline, false))));
end $$;

-- Audit chain ---------------------------------------------------------------------------------------

create or replace function verify_audit_chain() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e audit_events; v_prev text := repeat('0', 64); v_n int := 0;
begin
  if auth.uid() is not null and _actor_role() not in ('commissioner', 'manager') then
    return jsonb_build_object('ok', false, 'code', 'ROLE_NOT_PERMITTED',
                              'message', 'Only the Commissioner or the Grievance Cell Manager can verify the audit log.');
  end if;
  for e in select * from audit_events order by id loop
    v_n := v_n + 1;
    if e.prev_hash <> v_prev or e.hash <> audit_hash(e) then
      return jsonb_build_object('ok', false, 'checked', v_n, 'broken_at', e.id);
    end if;
    v_prev := e.hash;
  end loop;
  return jsonb_build_object('ok', true, 'checked', v_n, 'broken_at', null);
end $$;

-- Edits one row's reason without rehashing, to show verify_audit_chain() catching it.
create or replace function tamper_demo(p_event_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_denied jsonb := _deny('tamper_demo', array['commissioner'], true);
begin
  if v_denied is not null then return v_denied; end if;
  perform set_config('govfix.tamper_demo', 'on', true);
  update audit_events set reason = coalesce(reason, '') || ' [edited]' where id = p_event_id;
  if not found then
    perform set_config('govfix.tamper_demo', 'off', true);
    return _refusal(auth.uid(), _actor_role(), _channel(), null, 'tamper_demo', null, 'NOT_FOUND',
                    'No audit row with that id.');
  end if;
  perform set_config('govfix.tamper_demo', 'off', true);
  return jsonb_build_object('ok', true, 'tampered_id', p_event_id, 'audit_id',
    append_audit(auth.uid(), _actor_role(), _channel(), null, 'tamper_demo', null, null, 'accepted', null, null,
                 jsonb_build_object('event_id', p_event_id)));
end $$;

-- AI suggestions: a human decides; nothing on the request changes (golden rule 3) -----------------------

create or replace function decide_suggestion(p_id uuid, p_decision text, p_edited_payload jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text := _actor_role(); s ai_suggestions; r requests; v_code text; v_msg text;
begin
  select * into s from ai_suggestions where id = p_id for update;
  select * into r from requests where id = s.request_id;
  if v_role in ('citizen', 'anon') then v_code := 'ROLE_NOT_PERMITTED'; v_msg := 'Only staff can decide AI suggestions.';
  elsif s.id is null or not _can_see(r) then v_code := 'NOT_FOUND'; v_msg := 'This suggestion doesn''t exist.';
  elsif p_decision not in ('accepted', 'edited', 'dismissed') then
    v_code := 'INVALID_FIELD:decision'; v_msg := 'Decision must be accepted, edited or dismissed.';
  elsif p_decision = 'edited' and p_edited_payload is null then
    v_code := 'MISSING_FIELD:edited_payload'; v_msg := 'Provide the edited version.';
  elsif s.status <> 'pending' then v_code := 'ALREADY_DECIDED'; v_msg := 'This suggestion was already decided.';
  end if;
  if v_code is not null then
    return _refusal(v_uid, v_role, 'web', r.id, 'ai_suggestion_decided', r.state, v_code, v_msg,
                    jsonb_build_object('ai_suggestion_id', p_id, 'decision', p_decision));
  end if;

  update ai_suggestions set status = p_decision, decided_by = v_uid, decided_at = now_sim(),
    payload = case when p_decision = 'edited' then payload || jsonb_build_object('edited', p_edited_payload) else payload end
  where id = p_id;
  return jsonb_build_object('ok', true, 'audit_id',
    append_audit(v_uid, v_role, 'web', r.id, 'ai_suggestion_decided', r.state, r.state, 'accepted', null, null,
      jsonb_strip_nulls(jsonb_build_object('ai_suggestion_id', p_id, 'type', s.type, 'provider', s.provider,
                                           'decision', p_decision, 'edited', p_edited_payload))));
end $$;

-- Messages ------------------------------------------------------------------------------------------

create or replace function send_citizen_update(p_request_id uuid, p_body text, p_ai_suggestion_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text := _actor_role(); r requests; v_code text; v_msg text;
begin
  select * into r from requests where id = p_request_id;
  if not found or not coalesce(_can_see(r), false) then v_code := 'NOT_FOUND'; v_msg := 'This request doesn''t exist.';
  elsif not (r.assigned_officer_id = v_uid or _guard('is_department_head_of_request', r, '{}', v_uid)) then
    v_code := 'ROLE_NOT_PERMITTED'; v_msg := 'Only the assigned officer or the Department Head can message the citizen.';
  elsif length(btrim(coalesce(p_body, ''))) = 0 or length(p_body) > 2000 then
    v_code := 'MISSING_FIELD:body'; v_msg := 'Write a message (up to 2000 characters).';
  elsif p_ai_suggestion_id is not null and not exists (
      select 1 from ai_suggestions where id = p_ai_suggestion_id and request_id = r.id) then
    v_code := 'INVALID_FIELD:ai_suggestion_id'; v_msg := 'That suggestion doesn''t belong to this request.';
  end if;
  if v_code is not null then
    return _refusal(v_uid, v_role, 'web', r.id, 'citizen_update', r.state, v_code, v_msg,
                    jsonb_strip_nulls(jsonb_build_object('ai_suggestion_id', p_ai_suggestion_id)));
  end if;
  insert into request_messages (request_id, author_id, kind, visibility, body, language, ai_suggestion_id, created_at)
  values (r.id, v_uid, 'citizen_update', 'citizen', btrim(p_body), r.language, p_ai_suggestion_id, now_sim());
  perform notify(r.citizen_id, r.id, 'citizen_update', btrim(p_body));
  return jsonb_build_object('ok', true, 'audit_id',
    append_audit(v_uid, v_role, 'web', r.id, 'citizen_update', r.state, r.state, 'accepted', null, null,
                 jsonb_strip_nulls(jsonb_build_object('ai_suggestion_id', p_ai_suggestion_id))));
end $$;

create or replace function add_staff_note(p_request_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text := _actor_role(); r requests; v_code text; v_msg text;
begin
  select * into r from requests where id = p_request_id;
  if v_role in ('citizen', 'anon') then v_code := 'ROLE_NOT_PERMITTED'; v_msg := 'Only staff can add staff notes.';
  elsif r.id is null or not _can_see(r) then v_code := 'NOT_FOUND'; v_msg := 'This request doesn''t exist.';
  elsif length(btrim(coalesce(p_body, ''))) = 0 or length(p_body) > 2000 then
    v_code := 'MISSING_FIELD:body'; v_msg := 'Write a note (up to 2000 characters).';
  end if;
  if v_code is not null then
    return _refusal(v_uid, v_role, 'web', r.id, 'staff_note', r.state, v_code, v_msg);
  end if;
  insert into request_messages (request_id, author_id, kind, visibility, body, created_at)
  values (r.id, v_uid, 'staff_note', 'staff', btrim(p_body), now_sim());
  return jsonb_build_object('ok', true, 'audit_id',
    append_audit(v_uid, v_role, 'web', r.id, 'staff_note', r.state, r.state, 'accepted', null, null, '{}'));
end $$;

-- SLA policy versions: never update, insert a new row. Existing requests keep their policy. -----------

create or replace function update_sla_policy(p_category_code text, p_hours int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_denied jsonb := _deny('sla_policy_updated', array['commissioner']); v_prev int; v_id int;
begin
  if v_denied is not null then return v_denied; end if;
  if not exists (select 1 from categories where code = p_category_code) then
    return _refusal(auth.uid(), _actor_role(), _channel(), null, 'sla_policy_updated', null,
                    'INVALID_FIELD:category_code', 'Pick a category from the list.');
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 720 then
    return _refusal(auth.uid(), _actor_role(), _channel(), null, 'sla_policy_updated', null,
                    'INVALID_FIELD:hours', 'Resolution time must be between 1 and 720 hours.');
  end if;
  select resolution_hours into v_prev from sla_policies where category_code = p_category_code
    and effective_from <= now_sim() order by effective_from desc, id desc limit 1;
  insert into sla_policies (category_code, resolution_hours, effective_from, created_by, note)
  values (p_category_code, p_hours, now_sim(), auth.uid(), p_note) returning id into v_id;
  return jsonb_build_object('ok', true, 'policy_id', v_id, 'audit_id',
    append_audit(auth.uid(), _actor_role(), _channel(), null, 'sla_policy_updated', null, null, 'accepted', null, p_note,
      jsonb_build_object('category_code', p_category_code, 'hours', p_hours, 'previous_hours', v_prev, 'policy_id', v_id)));
end $$;

-- Notifications read state (own rows only). Null id = mark all read. -----------------------------------

create or replace function mark_read(p_notification_id uuid default null) returns int
language sql security definer set search_path = public as $$
  with u as (
    update notifications set read_at = now_sim()
    where user_id = auth.uid() and read_at is null and (p_notification_id is null or id = p_notification_id)
    returning 1)
  select count(*)::int from u
$$;

grant execute on function time_machine_advance(bigint), set_ai_offline(boolean), verify_audit_chain(),
  tamper_demo(bigint), decide_suggestion(uuid, text, jsonb), send_citizen_update(uuid, text, uuid),
  add_staff_note(uuid, text), update_sla_policy(text, int, text), mark_read(uuid) to authenticated;
grant execute on function run_escalation_sweep(), verify_audit_chain() to service_role;
