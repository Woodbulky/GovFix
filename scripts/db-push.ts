// Applies new migrations + seed files to the cloud project (SUPABASE_DB_URL in .env).
import { dbUrl, supabase } from './supabase-cli';

const r = supabase(['db', 'push', '--db-url', dbUrl(), '--include-seed', '--yes', ...process.argv.slice(2)]);
process.exit(r.status ?? 1);
