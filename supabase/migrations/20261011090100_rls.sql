-- Grants and RLS (docs/DATABASE.md "Grants and RLS"). Golden rule 1: anon and authenticated
-- never get INSERT/UPDATE/DELETE on anything in public; writes go through SECURITY DEFINER RPCs.

-- Stop Supabase's default "grant all to anon, authenticated" for objects created later.
-- Every future RPC must `grant execute ... to authenticated` (or anon) explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Helpers -----------------------------------------------------------------------------------------

create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_department() returns text
language sql stable security definer set search_path = public as $$
  select department_code from profiles where id = auth.uid()
$$;

revoke execute on function my_role(), my_department() from public;
grant execute on function my_role(), my_department() to anon, authenticated, service_role;

-- Every new auth user gets a citizen profile. The role never comes from user metadata.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, preferred_language)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'preferred_language' in ('en','hi','mr')
         then new.raw_user_meta_data->>'preferred_language' else 'mr' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Reference tables: readable by everyone ----------------------------------------------------------

grant select on app_settings, departments, wards, landmarks, categories, sla_policies, workflow_transitions
  to anon, authenticated;

alter table app_settings         enable row level security;
alter table departments          enable row level security;
alter table wards                enable row level security;
alter table landmarks            enable row level security;
alter table categories           enable row level security;
alter table sla_policies         enable row level security;
alter table workflow_transitions enable row level security;

create policy read_all on app_settings         for select to anon, authenticated using (true);
create policy read_all on departments          for select to anon, authenticated using (true);
create policy read_all on wards                for select to anon, authenticated using (true);
create policy read_all on landmarks            for select to anon, authenticated using (true);
create policy read_all on categories           for select to anon, authenticated using (true);
create policy read_all on sla_policies         for select to anon, authenticated using (true);
create policy read_all on workflow_transitions for select to anon, authenticated using (true);

-- People ------------------------------------------------------------------------------------------

grant select on profiles, officer_wards to authenticated;
alter table profiles      enable row level security;
alter table officer_wards enable row level security;

-- Own profile; staff profiles are visible to everyone signed in (officer names on citizen cards);
-- staff see everyone.
create policy profiles_read on profiles for select to authenticated using (
  id = (select auth.uid()) or role <> 'citizen' or (select my_role()) <> 'citizen'
);
create policy officer_wards_read on officer_wards for select to authenticated using (true);

-- Requests and children ---------------------------------------------------------------------------

grant select on requests, request_photos, request_messages, ai_suggestions, notifications, audit_events
  to authenticated;
alter table requests         enable row level security;
alter table request_photos   enable row level security;
alter table request_messages enable row level security;
alter table ai_suggestions   enable row level security;
alter table notifications    enable row level security;
alter table audit_events     enable row level security;

create policy requests_read on requests for select to authenticated using (
  citizen_id = (select auth.uid())
  or (select my_role()) in ('manager','commissioner')
  or ((select my_role()) = 'dept_head' and department_code = (select my_department()))
  or ((select my_role()) = 'officer' and (
        assigned_officer_id = (select auth.uid())
        or (department_code = (select my_department())
            and exists (select 1 from officer_wards ow
                        where ow.officer_id = (select auth.uid()) and ow.ward_id = requests.ward_id))))
);

-- Children follow request visibility (the subquery runs under the caller's requests policy).
create policy request_photos_read on request_photos for select to authenticated using (
  exists (select 1 from requests r where r.id = request_id)
);
create policy request_messages_read on request_messages for select to authenticated using (
  exists (select 1 from requests r where r.id = request_id)
  and (visibility = 'citizen' or (select my_role()) <> 'citizen')
);
create policy ai_suggestions_read on ai_suggestions for select to authenticated using (
  (select my_role()) <> 'citizen' and exists (select 1 from requests r where r.id = request_id)
);
create policy notifications_read on notifications for select to authenticated using (
  user_id = (select auth.uid())
);
create policy audit_read on audit_events for select to authenticated using (
  (select my_role()) in ('manager','commissioner')
  or ((select my_role()) = 'dept_head'
      and exists (select 1 from requests r where r.id = request_id and r.department_code = (select my_department())))
  or ((select my_role()) = 'officer'
      and exists (select 1 from requests r where r.id = request_id and r.assigned_officer_id = (select auth.uid())))
);
