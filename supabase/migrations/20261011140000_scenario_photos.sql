-- P10: every scenario request gets a report photo, resolved/closed ones a proof photo too.
-- Files are the illustrated placeholders in supabase/seed/photos/, uploaded to seed/ by `npm run demo:reset`
-- (storage objects survive reset_demo, so later resets from the Time Machine keep working).
alter function _load_scenario() rename to _load_scenario_requests;

create function _load_scenario() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := _load_scenario_requests();
begin
  insert into request_photos (request_id, kind, storage_path, uploaded_by, created_at)
  select id, 'report', 'seed/report-' || coalesce(category_code, category_hint, 'other') || '.png', citizen_id,
         submitted_at
  from requests;
  insert into request_photos (request_id, kind, storage_path, uploaded_by, created_at)
  select id, 'proof', 'seed/proof-' || category_code || '.png', assigned_officer_id, resolved_at
  from requests where state in ('RESOLVED', 'CLOSED') and assigned_officer_id is not null;
  return v_n;
end $$;
revoke all on function _load_scenario(), _load_scenario_requests() from public, anon, authenticated;
