// npm run demo:reset: uploads the seed photos, clears requests and audit, resets the sim clock, loads the demo
// scenario, then removes photos no request points to any more.
import { readdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = { report: 'complaint-photos', proof: 'proof-photos' } as const;

// Placeholders from scripts/gen-placeholder-photos.py; drop real photos in with the same names to replace them.
const dir = new URL('../supabase/seed/photos/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
  const bucket = BUCKET[file.split('-')[0] as keyof typeof BUCKET];
  const { error } = await db.storage
    .from(bucket)
    .upload(`seed/${file}`, readFileSync(new URL(file, dir)), { contentType: 'image/png', upsert: true });
  if (error) {
    console.error(`upload ${file} failed:`, error.message);
    process.exit(1);
  }
}

const { data, error } = await db.rpc('reset_demo');
if (error || !data?.ok) {
  console.error('reset_demo failed:', error ?? data);
  process.exit(1);
}
console.log(data);

// Orphans: uploads from complaints that reset_demo deleted. Objects live under {uid}/ folders (seed/ is kept).
const { data: rows } = await db.from('request_photos').select('storage_path');
const keep = new Set((rows ?? []).map((r) => r.storage_path));
let removed = 0;
for (const bucket of Object.values(BUCKET)) {
  const { data: folders } = await db.storage.from(bucket).list('', { limit: 1000 });
  for (const f of folders ?? []) {
    if (f.name === 'seed') continue;
    const { data: files } = await db.storage.from(bucket).list(f.name, { limit: 1000 });
    const gone = (files ?? []).map((x) => `${f.name}/${x.name}`).filter((p) => !keep.has(p));
    if (gone.length) {
      await db.storage.from(bucket).remove(gone);
      removed += gone.length;
    }
  }
}
console.log(`removed ${removed} orphan photos`);
