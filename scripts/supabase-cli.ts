// Runs the pinned Supabase CLI without a shell (a shell would mangle passwords inside the DB URL).
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createRequire } from 'node:module';

const cli = createRequire(import.meta.url).resolve('supabase/dist/supabase.js');

export const supabase = (args: string[], opts: SpawnSyncOptions = { stdio: 'inherit' }) =>
  spawnSync(process.execPath, [cli, ...args], opts);

export function dbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('SUPABASE_DB_URL is missing from .env (dashboard > Connect > Session pooler).');
    process.exit(1);
  }
  return url;
}
