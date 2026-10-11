// Enables login for the ai_writer role with AI_WRITER_PASSWORD from .env (never committed).
// Then put it in AI_DATABASE_URL: postgresql://ai_writer.<ref>:<password>@<session pooler host>:5432/postgres
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_WRITER_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AI_WRITER_PASSWORD) {
  console.error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and AI_WRITER_PASSWORD in .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await db.rpc('set_ai_writer_password', { p_password: AI_WRITER_PASSWORD });
if (error) {
  console.error(error);
  process.exit(1);
}
console.log('ai_writer can log in now.');
