-- Citizen profile edits (P4 Profile screen). Profiles have no direct write grants; this is the only path.
-- Only the caller's own language, large-text flag and phone. Role and department stay untouchable.
create or replace function update_my_profile(p_language text default null, p_large_text boolean default null,
                                             p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_SIGNED_IN', 'message', 'Please sign in first.');
  end if;
  if p_language is not null and p_language not in ('en', 'hi', 'mr') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_FIELD:language', 'message', 'Pick English, Hindi or Marathi.');
  end if;
  if p_phone is not null and btrim(p_phone) <> '' and btrim(p_phone) !~ '^\+?[0-9 ]{8,16}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_FIELD:phone',
                              'message', 'Use digits only, for example +91 00000 14207.');
  end if;
  update profiles set
    preferred_language = coalesce(p_language, preferred_language),
    large_text = coalesce(p_large_text, large_text),
    phone = case when p_phone is null then phone else nullif(btrim(p_phone), '') end
  where id = v_uid;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function update_my_profile(text, boolean, text) from public;
grant execute on function update_my_profile(text, boolean, text) to authenticated;
