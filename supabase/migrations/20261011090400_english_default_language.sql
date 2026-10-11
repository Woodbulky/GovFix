-- English is the default language (Studio, 2026-10-11). Users still pick en / hi / mr;
-- this only changes what a new account gets when it doesn't say.
alter table profiles alter column preferred_language set default 'en';

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, preferred_language)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'preferred_language' in ('en','hi','mr')
         then new.raw_user_meta_data->>'preferred_language' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function handle_new_user() from public;
