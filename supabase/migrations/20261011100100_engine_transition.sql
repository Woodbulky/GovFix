-- P2 workflow engine: guard registry, effect registry, transition_request(), create_request(), attach_photo().
-- The engine reads workflow_transitions at runtime (docs/WORKFLOW.md). Golden rules 1 and 2.

-- Guard registry ------------------------------------------------------------------------------------
-- Unknown guards fail closed. Target ids are compared as text so a malformed uuid is a refusal, not an error.

create or replace function _guard(g text, r requests, p jsonb, p_actor uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s app_settings;
begin
  select * into s from app_settings where id = 1;
  return coalesce(case g
    when 'is_owner' then r.citizen_id = p_actor
    when 'is_assigned_officer' then r.assigned_officer_id = p_actor
    when 'is_department_head_of_request' then exists (
      select 1 from profiles where id = p_actor and role = 'dept_head' and department_code = r.department_code)
    when 'is_department_head_of_request_or_commissioner' then exists (
      select 1 from profiles where id = p_actor
        and (role = 'commissioner' or (role = 'dept_head' and department_code = r.department_code)))
    when 'officer_in_department' then exists (
      select 1 from profiles where id::text = lower(p ->> 'officer_id') and role = 'officer'
        and department_code = r.department_code)
    when 'officer_covers_ward' then exists (
      select 1 from officer_wards where officer_id::text = lower(p ->> 'officer_id') and ward_id = r.ward_id)
    when 'different_officer' then coalesce(r.assigned_officer_id::text, '') <> lower(p ->> 'officer_id')
    when 'has_proof_photo' then exists (select 1 from request_photos where request_id = r.id and kind = 'proof')
    when 'within_reopen_window' then now_sim() - r.resolved_at <= make_interval(hours => s.reopen_window_hours)
    when 'resolved_longer_than_auto_close' then now_sim() - r.resolved_at >= make_interval(hours => s.auto_close_hours)
    when 'duplicate_target_is_open' then exists (
      select 1 from requests d where d.id::text = lower(p ->> 'duplicate_of') and d.id <> r.id
        and d.state not in ('CLOSED', 'REJECTED'))
  end, false);
end $$;

create or replace function _guard_message(g text, r requests, p jsonb) returns text
language sql stable security definer set search_path = public as $$
  select case g
    when 'is_owner' then 'Only the citizen who filed this complaint can do this.'
    when 'is_assigned_officer' then 'Only the officer assigned to this request can do this.'
    when 'is_department_head_of_request' then 'Only the head of this request''s department can do this.'
    when 'is_department_head_of_request_or_commissioner'
      then 'Only the head of this request''s department or the Commissioner can do this.'
    when 'officer_in_department' then format('%s isn''t in the %s department.',
      coalesce((select full_name from profiles where id::text = lower(p ->> 'officer_id')), 'This officer'),
      coalesce((select name_en from departments where code = r.department_code), 'request''s'))
    when 'officer_covers_ward' then format('%s doesn''t cover Ward %s.',
      coalesce((select full_name from profiles where id::text = lower(p ->> 'officer_id')), 'This officer'), r.ward_id)
    when 'different_officer' then 'This officer is already assigned. Pick a different officer.'
    when 'has_proof_photo' then 'Add a photo of the completed work before marking it resolved.'
    when 'within_reopen_window' then format('This was resolved more than %s days ago. Please file a new complaint.',
      (select reopen_window_hours / 24 from app_settings where id = 1))
    when 'resolved_longer_than_auto_close' then 'The confirmation period hasn''t ended yet.'
    when 'duplicate_target_is_open' then 'The original request must exist and still be open.'
    else format('Check %s failed.', g) end
$$;

create or replace function _action_label(a text) returns text
language sql immutable as $$
  select case a
    when 'triage' then 'triage this request' when 'reject' then 'reject this request'
    when 'merge_duplicate' then 'merge this as a duplicate' when 'reroute' then 'send this back for triage'
    when 'assign' then 'assign an officer' when 'reassign' then 'reassign this request'
    when 'start' then 'start work on this' when 'request_info' then 'ask the citizen for information'
    when 'provide_info' then 'reply to this question' when 'resolve' then 'mark this resolved'
    when 'confirm' then 'confirm this is fixed' when 'reopen' then 'reopen this'
    when 'auto_close' then 'close this automatically' else replace(a, '_', ' ') end
$$;

create or replace function _role_label(r text) returns text
language sql immutable as $$
  select case r
    when 'citizen' then 'the citizen who filed it' when 'officer' then 'the assigned field officer'
    when 'dept_head' then 'the Department Head' when 'manager' then 'the Grievance Cell Manager'
    when 'commissioner' then 'the Commissioner' when 'system' then 'the system' else r end
$$;

-- The engine. Internal: the public wrapper passes the caller; the sweep passes actor 'system'. ------

create or replace function _transition(
  p_request_id uuid, p_action text, p_expected request_state, p_payload jsonb, p_channel channel,
  p_sugg uuid, p_actor uuid, p_role text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r requests; t workflow_transitions; s app_settings;
  v_from request_state; v_prev_officer uuid; v_field text; v_name text; v_hours int; v_secs int;
  v_target request_state; v_audit bigint; v_payload jsonb;
begin
  p_payload := coalesce(p_payload, '{}');
  v_payload := p_payload || case when p_sugg is null then '{}' else jsonb_build_object('ai_suggestion_id', p_sugg) end;
  select * into s from app_settings where id = 1;

  -- 1. exists
  select * into r from requests where id = p_request_id for update;
  if not found then
    return _refusal(p_actor, p_role, p_channel, null, p_action, null, 'NOT_FOUND', 'This request doesn''t exist.',
                    v_payload || jsonb_build_object('request_id', p_request_id));
  end if;
  v_from := r.state;
  v_prev_officer := r.assigned_officer_id;

  -- 2. optimistic concurrency
  if r.state <> p_expected then
    return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'STALE_STATE',
      format('This request is now %s, not %s. Refresh to see the latest.', _state_label(r.state), _state_label(p_expected)),
      v_payload);
  end if;

  -- 3. transition exists
  select * into t from workflow_transitions where action = p_action and from_state = r.state;
  if not found then
    select to_state into v_target from workflow_transitions where action = p_action limit 1;
    return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'INVALID_TRANSITION',
      case when v_target is null then format('"%s" isn''t a known action.', p_action)
      else format('%s → %s isn''t allowed.', _state_label(r.state), _state_label(v_target)) || case
        when v_target = 'CLOSED' then ' A request is closed only after the officer resolves it and the citizen confirms.'
        when v_target = 'RESOLVED' then ' Only work in progress can be marked resolved.'
        else '' end end,
      v_payload);
  end if;

  -- 4. role
  if not (coalesce(p_role, 'anon') = any(t.allowed_roles)) then
    return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'ROLE_NOT_PERMITTED',
      format('Only %s can %s.',
        (select string_agg(_role_label(x), ' or ') from unnest(t.allowed_roles) x where x <> 'system'),
        _action_label(p_action)),
      v_payload);
  end if;

  -- 5. required fields (+ field values the effects depend on)
  foreach v_field in array t.requires loop
    if coalesce(btrim(p_payload ->> v_field), '') = '' then
      return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'MISSING_FIELD:' || v_field,
        format('Please provide the %s.', replace(v_field, '_', ' ')), v_payload);
    end if;
  end loop;
  if 'set_department_from_category' = any(t.effects) then
    if not exists (select 1 from categories where code = p_payload ->> 'category_code') then
      return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'INVALID_FIELD:category_code',
        'Pick a category from the list.', v_payload);
    end if;
    if (select department_code from categories where code = p_payload ->> 'category_code') is null then
      if coalesce(btrim(p_payload ->> 'department_code'), '') = '' then
        return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'MISSING_FIELD:department_code',
          'For "Other", pick the department that should handle it.', v_payload);
      elsif not exists (select 1 from departments where code = p_payload ->> 'department_code') then
        return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'INVALID_FIELD:department_code',
          'Pick a department from the list.', v_payload);
      end if;
    end if;
  end if;
  if 'reason_code' = any(t.requires)
     and p_payload ->> 'reason_code' not in ('invalid', 'out_of_jurisdiction', 'insufficient_detail') then
    return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'INVALID_FIELD:reason_code',
      'Pick a reason from the list.', v_payload);
  end if;
  if p_sugg is not null and not exists (select 1 from ai_suggestions where id = p_sugg and request_id = r.id) then
    return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'INVALID_FIELD:ai_suggestion_id',
      'That suggestion doesn''t belong to this request.', v_payload);
  end if;

  -- 6. guards
  foreach v_name in array t.guards loop
    if not _guard(v_name, r, p_payload, p_actor) then
      return _refusal(p_actor, p_role, p_channel, r.id, p_action, v_from, 'GUARD_FAILED:' || v_name,
        _guard_message(v_name, r, p_payload), v_payload);
    end if;
  end loop;

  -- 7. apply
  r.state := t.to_state;
  -- Transitions that require an officer set it (assign, reassign).
  if 'officer_id' = any(t.requires) then r.assigned_officer_id := lower(p_payload ->> 'officer_id')::uuid; end if;

  foreach v_name in array t.effects loop
    case v_name
      when 'set_department_from_category' then
        r.category_code := p_payload ->> 'category_code';
        r.department_code := coalesce((select department_code from categories where code = r.category_code),
                                      p_payload ->> 'department_code');
      when 'start_resolution_sla' then
        select id, resolution_hours into r.sla_policy_id, v_hours from sla_policies
          where category_code = r.category_code and effective_from <= now_sim()
          order by effective_from desc, id desc limit 1;
        r.sla_clock_start := r.submitted_at;
        r.resolution_due_at := r.submitted_at + make_interval(hours => v_hours);
        r.paused_since := null; r.paused_seconds := 0; r.escalation_level := 0;
      when 'fresh_resolution_sla' then
        select resolution_hours into v_hours from sla_policies where id = r.sla_policy_id;
        r.sla_clock_start := now_sim();
        r.resolution_due_at := now_sim() + make_interval(hours => v_hours);
        r.paused_since := null; r.paused_seconds := 0; r.escalation_level := 0;
      when 'pause_sla' then
        r.paused_since := now_sim();
      when 'resume_sla' then
        v_secs := round(extract(epoch from now_sim() - r.paused_since))::int;
        r.paused_seconds := r.paused_seconds + v_secs;
        r.resolution_due_at := r.resolution_due_at + make_interval(secs => v_secs);
        r.paused_since := null;
      when 'restart_triage_sla' then
        r.triage_due_at := now_sim() + make_interval(hours => s.triage_hours);
        r.triage_escalated_at := null;
      when 'clear_department' then
        r.category_code := null; r.department_code := null;
      when 'clear_assignment' then
        r.assigned_officer_id := null;
      when 'clear_resolution_sla' then
        r.sla_policy_id := null; r.sla_clock_start := null; r.resolution_due_at := null;
        r.paused_since := null; r.paused_seconds := 0; r.escalation_level := 0;
      when 'link_duplicate' then
        r.duplicate_of := lower(p_payload ->> 'duplicate_of')::uuid;
      when 'post_citizen_message' then
        insert into request_messages (request_id, author_id, kind, visibility, body, language, ai_suggestion_id, created_at)
        values (r.id, p_actor, case when p_payload ? 'question' then 'info_question' else 'info_reply' end, 'citizen',
                coalesce(p_payload ->> 'question', p_payload ->> 'reply'), p_payload ->> 'language', p_sugg, now_sim());
      when 'set_resolved_at' then r.resolved_at := now_sim();
      when 'set_closed_at' then r.closed_at := now_sim();
      when 'increment_reopen_count' then r.reopen_count := r.reopen_count + 1;
      else raise exception 'workflow config: unknown effect %', v_name;  -- config bug, not a business refusal
    end case;
  end loop;
  r.updated_at := now_sim();

  update requests set
    state = r.state, category_code = r.category_code, department_code = r.department_code,
    assigned_officer_id = r.assigned_officer_id, triage_due_at = r.triage_due_at,
    triage_escalated_at = r.triage_escalated_at, sla_policy_id = r.sla_policy_id,
    sla_clock_start = r.sla_clock_start, resolution_due_at = r.resolution_due_at, paused_since = r.paused_since,
    paused_seconds = r.paused_seconds, escalation_level = r.escalation_level, resolved_at = r.resolved_at,
    closed_at = r.closed_at, duplicate_of = r.duplicate_of, reopen_count = r.reopen_count, updated_at = r.updated_at
  where id = r.id;

  v_audit := append_audit(p_actor, p_role, p_channel, r.id, p_action, v_from, r.state, 'accepted', null,
                          p_payload ->> 'reason', v_payload);

  -- Notifications (docs/PRD.md "Notifications")
  case p_action
    when 'triage' then
      perform notify(r.citizen_id, r.id, 'triaged');
      perform notify((select head_id from departments where code = r.department_code), r.id, 'triaged_staff');
    when 'assign', 'reassign' then
      perform notify(r.assigned_officer_id, r.id, 'assigned_officer');
      perform notify(r.citizen_id, r.id, 'assigned');
    when 'request_info' then perform notify(r.citizen_id, r.id, 'needs_info', p_payload ->> 'question');
    when 'provide_info' then perform notify(r.assigned_officer_id, r.id, 'info_provided');
    when 'resolve' then perform notify(r.citizen_id, r.id, 'resolved');
    when 'reject', 'merge_duplicate' then perform notify(r.citizen_id, r.id, 'rejected', p_payload ->> 'reason');
    when 'reopen' then
      perform notify((select head_id from departments where code = r.department_code), r.id, 'reopened', p_payload ->> 'reason');
      perform notify(v_prev_officer, r.id, 'reopened', p_payload ->> 'reason');
    when 'reroute' then perform notify_role('manager', r.id, 'rerouted', p_payload ->> 'reason');
    when 'auto_close' then perform notify(r.citizen_id, r.id, 'auto_closed');
    else null;
  end case;

  return jsonb_build_object('ok', true, 'request', to_jsonb(r) || jsonb_build_object('sla_status', sla_status_of(r)),
                            'audit_id', v_audit);
end $$;

create or replace function transition_request(
  p_request_id uuid, p_action text, p_expected_state request_state, p_payload jsonb default '{}',
  p_channel channel default 'web', p_ai_suggestion_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_channel = 'system' then  -- only the escalation sweep acts as the system
    return _refusal(auth.uid(), _actor_role(), 'api', null, p_action, null, 'INVALID_FIELD:channel',
                    'The system channel is reserved for the escalation sweep.');
  end if;
  return _transition(p_request_id, p_action, p_expected_state, p_payload, p_channel, p_ai_suggestion_id,
                     auth.uid(), _actor_role());
end $$;
grant execute on function transition_request(uuid, text, request_state, jsonb, channel, uuid) to authenticated;

-- create_request ------------------------------------------------------------------------------------
-- p: { description, ward_id, landmark_id?, loc_x?, loc_z?, category_hint?, language?, channel? ('web'|'voice'),
--      transcript?, confirmation_text?, conversation_id? }

create or replace function create_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := _actor_role(); v_ch channel; r requests; v_audit bigint;
  v_refuse text; v_msg text;
begin
  p := coalesce(p, '{}');
  v_ch := case when p ->> 'channel' = 'voice' then 'voice' else 'web' end;
  if v_role <> 'citizen' then
    v_refuse := 'ROLE_NOT_PERMITTED'; v_msg := 'Only citizens can file complaints.';
  elsif length(btrim(coalesce(p ->> 'description', ''))) < 5 then
    v_refuse := 'MISSING_FIELD:description'; v_msg := 'Please describe the problem in a few words.';
  elsif length(p ->> 'description') > 4000 then
    v_refuse := 'INVALID_FIELD:description'; v_msg := 'Please keep the description under 4000 characters.';
  elsif coalesce(p ->> 'ward_id', '') !~ '^\d{1,4}$' or not exists (select 1 from wards where id = (p ->> 'ward_id')::int) then
    v_refuse := 'MISSING_FIELD:ward_id'; v_msg := 'Please pick the ward or the spot on the map.';
  elsif p ? 'landmark_id' and p ->> 'landmark_id' is not null and not exists (
      select 1 from landmarks where id::text = p ->> 'landmark_id' and ward_id = (p ->> 'ward_id')::int) then
    v_refuse := 'INVALID_FIELD:landmark_id'; v_msg := 'That landmark isn''t in the chosen ward.';
  elsif p ->> 'category_hint' is not null and not exists (select 1 from categories where code = p ->> 'category_hint') then
    v_refuse := 'INVALID_FIELD:category_hint'; v_msg := 'Pick a category from the list, or "Not sure".';
  elsif (p ->> 'loc_x' is null) <> (p ->> 'loc_z' is null) then
    v_refuse := 'INVALID_FIELD:location'; v_msg := 'The map location is incomplete. Please pick the spot again.';
  end if;
  if v_refuse is not null then
    return _refusal(v_uid, v_role, v_ch, null, 'create_request', null, v_refuse, v_msg,
                    p - 'description' - 'transcript');
  end if;

  insert into requests (ticket_no, citizen_id, channel, language, description, transcript, ward_id, landmark_id,
                        loc_x, loc_z, category_hint, submitted_at, triage_due_at, updated_at)
  values (
    format('NMC-%s-%s', extract(year from now_sim())::int, lpad(nextval('ticket_seq')::text, 6, '0')),
    v_uid, v_ch,
    coalesce(nullif(p ->> 'language', ''), (select preferred_language from profiles where id = v_uid)),
    btrim(p ->> 'description'), p ->> 'transcript', (p ->> 'ward_id')::int, (p ->> 'landmark_id')::int,
    (p ->> 'loc_x')::real, (p ->> 'loc_z')::real, p ->> 'category_hint', now_sim(),
    now_sim() + make_interval(hours => (select triage_hours from app_settings where id = 1)), now_sim())
  returning * into r;

  v_audit := append_audit(v_uid, v_role, v_ch, r.id, 'create_request', null, 'SUBMITTED', 'accepted', null, null,
    jsonb_strip_nulls(jsonb_build_object('ticket_no', r.ticket_no, 'channel', v_ch,
      'confirmation_text', p ->> 'confirmation_text', 'conversation_id', p ->> 'conversation_id')));
  perform notify(v_uid, r.id, 'submitted');
  return jsonb_build_object('ok', true, 'request', to_jsonb(r), 'audit_id', v_audit);
end $$;
grant execute on function create_request(jsonb) to authenticated;

-- attach_photo --------------------------------------------------------------------------------------
-- report: owner citizen while SUBMITTED (max 3). proof: assigned officer while IN_PROGRESS.
-- The object must already be uploaded under the caller's own folder in the matching bucket.

create or replace function attach_photo(p_request_id uuid, p_storage_path text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := _actor_role(); r requests; v_code text; v_msg text; v_id uuid;
  v_payload jsonb := jsonb_build_object('kind', p_kind, 'storage_path', p_storage_path);
begin
  select * into r from requests where id = p_request_id;
  if not found or not _can_see(r) then
    return _refusal(v_uid, v_role, 'web', null, 'attach_photo', null, 'NOT_FOUND', 'This request doesn''t exist.',
                    v_payload || jsonb_build_object('request_id', p_request_id));
  end if;
  if p_kind = 'report' then
    if r.citizen_id is distinct from v_uid then v_code := 'GUARD_FAILED:is_owner';
      v_msg := 'Only the citizen who filed this complaint can add photos to it.';
    elsif r.state <> 'SUBMITTED' then v_code := 'INVALID_TRANSITION';
      v_msg := 'Photos can be added only before the complaint is triaged.';
    elsif (select count(*) from request_photos where request_id = r.id and kind = 'report') >= 3 then
      v_code := 'LIMIT_REACHED'; v_msg := 'A complaint can have up to 3 photos.';
    end if;
  elsif p_kind = 'proof' then
    if r.assigned_officer_id is distinct from v_uid then v_code := 'GUARD_FAILED:is_assigned_officer';
      v_msg := 'Only the officer assigned to this request can add proof photos.';
    elsif r.state <> 'IN_PROGRESS' then v_code := 'INVALID_TRANSITION';
      v_msg := 'Proof photos can be added while the work is in progress.';
    end if;
  else
    v_code := 'INVALID_FIELD:kind'; v_msg := 'Photo kind must be report or proof.';
  end if;
  if v_code is null and (coalesce(p_storage_path, '') not like v_uid::text || '/%' or not exists (
      select 1 from storage.objects where name = p_storage_path
        and bucket_id = case p_kind when 'report' then 'complaint-photos' else 'proof-photos' end)) then
    v_code := 'INVALID_FIELD:storage_path'; v_msg := 'Upload the photo first, then attach it.';
  end if;
  if v_code is not null then
    return _refusal(v_uid, v_role, 'web', r.id, 'attach_photo', r.state, v_code, v_msg, v_payload);
  end if;

  insert into request_photos (request_id, kind, storage_path, uploaded_by, created_at)
  values (r.id, p_kind, p_storage_path, v_uid, now_sim()) returning id into v_id;
  return jsonb_build_object('ok', true, 'photo_id', v_id, 'audit_id',
    append_audit(v_uid, v_role, 'web', r.id, 'attach_photo', r.state, r.state, 'accepted', null, null, v_payload));
end $$;
grant execute on function attach_photo(uuid, text, text) to authenticated;
