-- ai_writer role, storage buckets, realtime, audit no-update guard.

-- ai_writer (golden rule 3, enforced physically) --------------------------------------------------
-- Created nologin; scripts/set-ai-writer-password.ts enables login with a password from .env.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'ai_writer') then
    create role ai_writer nologin;
  end if;
end $$;

grant usage on schema public to ai_writer;
grant select on requests, request_photos, categories, landmarks, wards, app_settings, ai_suggestions to ai_writer;
grant insert on ai_suggestions to ai_writer;
-- select on notifications too: the voice-note worker finds rows where audio_path is null.
grant select, update (audio_path) on notifications to ai_writer;

create policy ai_writer_read on requests       for select to ai_writer using (true);
create policy ai_writer_read on request_photos for select to ai_writer using (true);
create policy ai_writer_read on categories     for select to ai_writer using (true);
create policy ai_writer_read on landmarks      for select to ai_writer using (true);
create policy ai_writer_read on wards          for select to ai_writer using (true);
create policy ai_writer_read on app_settings   for select to ai_writer using (true);
create policy ai_writer_read on ai_suggestions for select to ai_writer using (true);
create policy ai_writer_insert on ai_suggestions for insert to ai_writer with check (true);
create policy ai_writer_read on notifications   for select to ai_writer using (true);
create policy ai_writer_audio on notifications  for update to ai_writer using (true) with check (true);

-- Only the service role may set the password (the value comes from .env, never from git).
create or replace function set_ai_writer_password(p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_password, '')) < 16 then
    raise exception 'ai_writer password must be at least 16 characters';
  end if;
  execute format('alter role ai_writer login password %L', p_password);
end $$;
revoke execute on function set_ai_writer_password(text) from public, anon, authenticated;
grant execute on function set_ai_writer_password(text) to service_role;

-- Storage (all private; signed URLs only) -----------------------------------------------------------
-- request_photos.storage_path is the object name inside the bucket: kind 'report' lives in
-- complaint-photos, kind 'proof' in proof-photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('complaint-photos', 'complaint-photos', false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('proof-photos',     'proof-photos',     false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('voice-notes',      'voice-notes',      false, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;

create policy complaint_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'complaint-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.my_role()) = 'citizen'
);
create policy complaint_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'complaint-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.request_photos rp where rp.kind = 'report' and rp.storage_path = name))
);
create policy proof_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.my_role()) = 'officer'
);
create policy proof_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'proof-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.request_photos rp where rp.kind = 'proof' and rp.storage_path = name))
);
-- Voice notes are uploaded with the owner's own JWT (the web or the AI service acting for them).
create policy voice_notes_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy voice_notes_read on storage.objects for select to authenticated using (
  bucket_id = 'voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Realtime (RLS still filters what each client receives) -------------------------------------------
alter publication supabase_realtime add table requests, notifications, audit_events;

-- Audit rows are append-only, except inside tamper_demo() --------------------------------------------
create or replace function audit_events_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('govfix.tamper_demo', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'audit_events is append-only';
end $$;

create trigger audit_events_no_update before update or delete on audit_events
  for each row execute function audit_events_guard();
