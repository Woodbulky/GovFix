-- Triage drawer preview: "Will go to Water Supply · due Fri 10:40 AM".
-- Same maths as the start_resolution_sla effect, so the preview and the real deadline always agree (golden rule 4).
-- Read-only; returns null if the caller can't see the request or the category has no policy.
create or replace function preview_deadline(p_request_id uuid, p_category_code text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select r.submitted_at + make_interval(hours => p.resolution_hours)
  from requests r
  cross join lateral (
    select resolution_hours from sla_policies
    where category_code = p_category_code and effective_from <= now_sim()
    order by effective_from desc, id desc limit 1
  ) p
  where r.id = p_request_id and _can_see(r);
$$;

revoke execute on function preview_deadline(uuid, text) from public;
grant execute on function preview_deadline(uuid, text) to authenticated;
