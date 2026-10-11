import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { applyLargeText } from '@/app/layouts/HeaderControls';
import i18n from '@/i18n';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'role' | 'department_code' | 'preferred_language' | 'large_text'
>;
export type Role = Profile['role'];

type AuthState = { ready: boolean; session: Session | null; profile: Profile | null };
export const useAuth = create<AuthState>(() => ({ ready: false, session: null, profile: null }));

let seq = 0;
async function load(session: Session | null) {
  const mine = ++seq;
  const profile = session
    ? (
        await supabase
          .from('profiles')
          .select('id, full_name, role, department_code, preferred_language, large_text')
          .eq('id', session.user.id)
          .single()
      ).data
    : null;
  if (mine === seq) useAuth.setState({ ready: true, session, profile }); // a newer sign-in wins
  return profile;
}

// Supabase warns against awaiting its own calls inside this callback, hence setTimeout.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') return useAuth.setState({ session });
  setTimeout(() => void load(session));
});

/** Signs in and switches the UI to the user's preferred language. Returns null on bad credentials. */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return null;
  const profile = await load(data.session);
  if (profile) {
    await i18n.changeLanguage(profile.preferred_language);
    applyLargeText(profile.large_text);
  }
  return profile;
}

export async function signOut() {
  await supabase.auth.signOut();
  await load(null);
}
