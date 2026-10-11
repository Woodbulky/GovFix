// Applies new migrations + seed files to the cloud project. Needs SUPABASE_DB_URL in .env
// (Supabase dashboard -> Connect -> Session pooler, with the database password).
import { spawnSync } from 'node:child_process';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is missing from .env (dashboard -> Connect -> Session pooler).');
  process.exit(1);
}
const r = spawnSync(
  'npx',
  ['supabase', 'db', 'push', '--db-url', url, '--include-seed', '--yes', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);
process.exit(r.status ?? 1);
