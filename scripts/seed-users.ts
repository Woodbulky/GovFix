// Demo accounts from docs/PRD.md: auth users (password = DEMO_PASSWORD), profiles, officer_wards,
// departments.head_id. Idempotent: re-running resets passwords and roles to these values.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD in .env');
  process.exit(1);
}

type Role = 'citizen' | 'officer' | 'dept_head' | 'manager' | 'commissioner';
type Lang = 'en' | 'hi' | 'mr';
type Demo = { email: string; name: string; role: Role; dept?: string; wards?: number[]; lang?: Lang; phone: string };

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Fictional numbers: the 00000 prefix is not a valid Indian mobile range.
const DEMO_USERS: Demo[] = [
  { email: 'sunita', name: 'Sunita Jadhav', role: 'citizen', lang: 'mr', phone: '+91 00000 14207' },
  { email: 'ramesh', name: 'Ramesh Shinde', role: 'citizen', lang: 'hi', phone: '+91 00000 13308' },
  { email: 'aisha', name: 'Aisha Khan', role: 'citizen', lang: 'en', phone: '+91 00000 15509' },
  { email: 'patil', name: 'Ganesh Patil', role: 'officer', dept: 'WTR', wards: [5, 6, 7, 8], phone: '+91 00000 20001' },
  {
    email: 'kale',
    name: 'Priya Kale',
    role: 'officer',
    dept: 'WTR',
    wards: [1, 2, 3, 4, 9, 10],
    phone: '+91 00000 20002',
  },
  { email: 'more', name: 'Sachin More', role: 'officer', dept: 'ELE', wards: ALL, phone: '+91 00000 20003' },
  { email: 'shaikh', name: 'Imran Shaikh', role: 'officer', dept: 'RDS', wards: ALL, phone: '+91 00000 20004' },
  { email: 'gaikwad', name: 'Rohit Gaikwad', role: 'officer', dept: 'SWM', wards: ALL, phone: '+91 00000 20005' },
  { email: 'pawar', name: 'Neha Pawar', role: 'officer', dept: 'SAN', wards: ALL, phone: '+91 00000 20006' },
  { email: 'joshi', name: 'Anil Joshi', role: 'officer', dept: 'HLT', wards: ALL, phone: '+91 00000 20007' },
  { email: 'deshmukh', name: 'Vikram Deshmukh', role: 'dept_head', dept: 'WTR', phone: '+91 00000 30001' },
  { email: 'bhosale', name: 'Swati Bhosale', role: 'dept_head', dept: 'SWM', phone: '+91 00000 30002' },
  { email: 'wagh', name: 'Sameer Wagh', role: 'dept_head', dept: 'RDS', phone: '+91 00000 30003' },
  { email: 'rao', name: 'Kavita Rao', role: 'dept_head', dept: 'ELE', phone: '+91 00000 30004' },
  { email: 'sawant', name: 'Prakash Sawant', role: 'dept_head', dept: 'SAN', phone: '+91 00000 30005' },
  { email: 'sayyed', name: 'Dr. Farida Sayyed', role: 'dept_head', dept: 'HLT', phone: '+91 00000 30006' },
  { email: 'meera', name: 'Meera Kulkarni', role: 'manager', phone: '+91 00000 40001' },
  { email: 'commissioner', name: 'Rajesh Naik', role: 'commissioner', phone: '+91 00000 50001' },
].map((u) => ({ ...u, email: `${u.email}@navnagar.test` }) as Demo);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const must = <T>(r: { data: T; error: unknown }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.data;
};

const list = await db.auth.admin.listUsers({ perPage: 1000 });
if (list.error) throw list.error;
const byEmail = new Map(list.data.users.map((u) => [u.email, u.id]));

for (const u of DEMO_USERS) {
  const attrs = {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.name, preferred_language: u.lang ?? 'en' },
  };
  let id = byEmail.get(u.email);
  const res = id
    ? await db.auth.admin.updateUserById(id, attrs)
    : await db.auth.admin.createUser({ email: u.email, ...attrs });
  if (res.error) throw new Error(`${u.email}: ${res.error.message}`);
  id = res.data.user.id;

  must(
    await db.from('profiles').upsert({
      id,
      full_name: u.name,
      role: u.role,
      department_code: u.dept ?? null,
      phone: u.phone,
      preferred_language: u.lang ?? 'en',
    }),
    `profile ${u.email}`,
  );

  if (u.role === 'officer') {
    must(await db.from('officer_wards').delete().eq('officer_id', id), `clear wards ${u.email}`);
    must(
      await db.from('officer_wards').insert(u.wards!.map((ward_id) => ({ officer_id: id, ward_id }))),
      `wards ${u.email}`,
    );
  }
  if (u.role === 'dept_head') {
    must(await db.from('departments').update({ head_id: id }).eq('code', u.dept!), `head ${u.dept}`);
  }
  console.log(`ok  ${u.role.padEnd(12)} ${u.email}`);
}
console.log(`${DEMO_USERS.length} demo users ready (password = DEMO_PASSWORD from .env)`);
