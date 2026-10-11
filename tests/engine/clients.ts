import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} missing from .env`);
  return v;
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const URL_ = env('SUPABASE_URL');
export const anon = () => createClient(URL_, env('VITE_SUPABASE_ANON_KEY'), opts);
export const service = () => createClient(URL_, env('SUPABASE_SERVICE_ROLE_KEY'), opts);

type UserClient = SupabaseClient & { uid: string };
const sessions = new Map<string, Promise<UserClient>>();

/** A client signed in as a demo user, e.g. as('sunita'). One sign-in per user per run (auth rate limits). */
export function as(user: string): Promise<UserClient> {
  if (!sessions.has(user)) {
    sessions.set(
      user,
      (async () => {
        const c = anon();
        const { data, error } = await c.auth.signInWithPassword({
          email: `${user}@navnagar.test`,
          password: env('DEMO_PASSWORD'),
        });
        if (error) throw error;
        return Object.assign(c, { uid: data.user.id });
      })(),
    );
  }
  return sessions.get(user)!;
}

export const PERMISSION_DENIED = '42501';
