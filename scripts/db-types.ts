// Regenerates apps/web/src/lib/database.types.ts from the cloud schema.
// Writes the file only on success, so a failed run never clobbers the types.
import { writeFileSync } from 'node:fs';
import { dbUrl, supabase } from './supabase-cli';

const OUT = 'apps/web/src/lib/database.types.ts';
const r = supabase(['gen', 'types', 'typescript', '--db-url', dbUrl(), '--schema', 'public'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
  maxBuffer: 32 * 1024 * 1024,
});
const ts = String(r.stdout ?? '');
if (r.status !== 0 || !ts.includes('export type Database')) {
  console.error(`db:types failed (exit ${r.status}); ${OUT} left unchanged.`);
  process.exit(1);
}
writeFileSync(OUT, ts);
console.log(`Wrote ${OUT}`);
