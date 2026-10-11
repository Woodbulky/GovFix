// npm run demo:reset: clears requests and audit, resets the sim clock, loads the demo scenario.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await db.rpc('reset_demo');
if (error || !data?.ok) {
  console.error('reset_demo failed:', error ?? data);
  process.exit(1);
}
console.log(data);
