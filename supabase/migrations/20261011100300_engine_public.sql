-- P2: public markers, ticket tracking, citizen timeline, landmark resolution, point location.

-- City markers for everyone (anon included). No ids, text, photos or exact spots. ---------------------

create or replace function public_markers()
returns table (category_code text, state request_state, ward_id smallint, x real, z real,
               sla_status text, escalation_level smallint, age_hours int)
language sql stable security definer set search_path = public as $$
  select coalesce(r.category_code, r.category_hint), r.state, r.ward_id,
    (round(coalesce(r.loc_x, l.x, w.center_x) / 25) * 25)::real,
    (round(coalesce(r.loc_z, l.z, w.center_z) / 25) * 25)::real,
    sla_status_of(r), r.escalation_level,
    (extract(epoch from now_sim() - r.submitted_at) / 3600)::int
  from requests r
  join wards w on w.id = r.ward_id
  left join landmarks l on l.id = r.landmark_id
  where r.state not in ('CLOSED', 'REJECTED')
     or (r.state = 'CLOSED' and r.closed_at >= now_sim() - interval '7 days')
$$;
grant execute on function public_markers() to anon, authenticated;

-- Timelines -----------------------------------------------------------------------------------------
-- Public: states, dates, department, officer name, deadline. The owner also gets the notes on each step.

create or replace function _timeline(r requests, p_private boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'found', true, 'ticket_no', r.ticket_no, 'state', r.state, 'ward_id', r.ward_id, 'channel', r.channel,
    'category', (select jsonb_build_object('code', c.code, 'en', c.name_en, 'hi', c.name_hi, 'mr', c.name_mr, 'icon', c.icon)
                 from categories c where c.code = coalesce(r.category_code, r.category_hint)),
    'department', (select jsonb_build_object('code', d.code, 'en', d.name_en, 'hi', d.name_hi, 'mr', d.name_mr)
                   from departments d where d.code = r.department_code),
    'officer_name', (select full_name from profiles where id = r.assigned_officer_id),
    'submitted_at', r.submitted_at, 'resolution_due_at', r.resolution_due_at, 'resolved_at', r.resolved_at,
    'closed_at', r.closed_at, 'sla_status', sla_status_of(r), 'escalation_level', r.escalation_level,
    'events', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'action', e.action, 'from_state', e.from_state, 'to_state', e.to_state, 'at', e.sim_ts,
        'note', case when p_private then coalesce(e.payload ->> 'resolution_note', e.reason) end)) order by e.id)
      from audit_events e
      where e.request_id = r.id and e.outcome = 'accepted' and e.to_state is not null
        and e.action not in ('escalate', 'attach_photo', 'citizen_update', 'staff_note', 'ai_suggestion_decided')), '[]'))
$$;

-- Anyone with the ticket number and the last 4 digits of the phone on file. A mismatch says nothing more.
-- ponytail: no rate limit on guesses; add one (per-IP counter table) if this goes beyond the demo.
create or replace function track_request(p_ticket_no text, p_phone_last4 text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select _timeline(r, false) from requests r join profiles p on p.id = r.citizen_id
    where r.ticket_no = upper(btrim(p_ticket_no)) and p_phone_last4 ~ '^\d{4}$'
      and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 4) = p_phone_last4),
    jsonb_build_object('found', false))
$$;
grant execute on function track_request(text, text) to anon, authenticated;

create or replace function my_request_timeline(p_request_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select _timeline(r, true) from requests r where r.id = p_request_id and r.citizen_id = auth.uid()),
                  jsonb_build_object('found', false))
$$;
grant execute on function my_request_timeline(uuid) to authenticated;

-- Landmarks: case- and script-insensitive match on names and aliases. Never guesses. ------------------
-- Tier 3: exact name/alias. Tier 2: an alias appears inside the query ("ghantaghar chowk jawal").
-- Tier 1: the query appears inside a name/alias (4+ chars). Ties across landmarks → not found + suggestions.

create or replace function resolve_landmark(p_query text, p_ward_hint smallint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q text := lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g')); v_best int; v_ids int[];
begin
  if length(v_q) < 2 then return jsonb_build_object('found', false, 'suggestions', '[]'::jsonb); end if;

  with names as (
    select l.id, l.ward_id, lower(n) as n
    from landmarks l, unnest(l.aliases || array[l.name_en, l.name_hi, l.name_mr]) n
  ), scored as (
    select id, ward_id, max(case when n = v_q then 3
                                 when length(n) >= 3 and position(n in v_q) > 0 then 2
                                 when length(v_q) >= 4 and position(v_q in n) > 0 then 1 else 0 end) as score
    from names group by id, ward_id
  ), top as (
    select * from scored where score > 0 and score = (select max(score) from scored)
  )
  select (select max(score) from top),
         coalesce((select array_agg(id order by id) from top
                   where p_ward_hint is null or ward_id = p_ward_hint
                      or not exists (select 1 from top t2 where t2.ward_id = p_ward_hint)), '{}')
  into v_best, v_ids;

  if cardinality(v_ids) = 1 then
    return (select jsonb_build_object('found', true, 'landmark_id', l.id, 'name', l.name_en, 'name_hi', l.name_hi,
              'name_mr', l.name_mr, 'ward_id', l.ward_id, 'ward_name', w.name_en, 'x', l.x, 'z', l.z)
            from landmarks l join wards w on w.id = l.ward_id where l.id = v_ids[1]);
  end if;
  return jsonb_build_object('found', false, 'suggestions', coalesce((
    select jsonb_agg(l.name_en order by l.id) from landmarks l
    where l.id = any(v_ids) or (cardinality(v_ids) = 0 and l.ward_id = p_ward_hint)), '[]'::jsonb));
end $$;
grant execute on function resolve_landmark(text, smallint) to authenticated;

-- Point → ward (point-in-polygon on the same layout as the 3D city) + nearest landmark within 300 m. ---

create or replace function _point_in_polygon(px float8, pz float8, poly jsonb) returns boolean
language plpgsql immutable as $$
declare n int := jsonb_array_length(poly); i int; j int := n - 1; inside boolean := false;
  xi float8; zi float8; xj float8; zj float8;
begin
  for i in 0 .. n - 1 loop
    xi := (poly -> i ->> 0)::float8; zi := (poly -> i ->> 1)::float8;
    xj := (poly -> j ->> 0)::float8; zj := (poly -> j ->> 1)::float8;
    if (zi > pz) <> (zj > pz) and px < (xj - xi) * (pz - zi) / (zj - zi) + xi then inside := not inside; end if;
    j := i;
  end loop;
  return inside;
end $$;

-- ponytail: the river isn't in the database yet, so a point in the river resolves to its ward;
-- the picker refuses river clicks client-side until Lane D adds the river polygon.
create or replace function locate_point(p_x real, p_z real) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('found', true, 'ward_id', w.id, 'ward_name', w.name_en, 'ward_name_hi', w.name_hi,
      'ward_name_mr', w.name_mr, 'x', p_x, 'z', p_z,
      'landmark', (select jsonb_build_object('id', l.id, 'name', l.name_en, 'name_hi', l.name_hi, 'name_mr', l.name_mr,
                     'distance_m', round(sqrt(power(l.x - p_x, 2) + power(l.z - p_z, 2))))
                   from landmarks l where sqrt(power(l.x - p_x, 2) + power(l.z - p_z, 2)) <= 300
                   order by power(l.x - p_x, 2) + power(l.z - p_z, 2) limit 1))
    from wards w where _point_in_polygon(p_x, p_z, w.polygon) order by w.id limit 1),
    jsonb_build_object('found', false, 'message', 'This spot is outside Navnagar. Pick a point inside the city.'))
$$;
grant execute on function locate_point(real, real) to authenticated;
