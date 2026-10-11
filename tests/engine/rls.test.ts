// Phase 1 acceptance: anon can't read requests, authenticated can't write directly,
// reference tables are readable, a citizen sees only their own requests.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { anon, as, PERMISSION_DENIED, service } from './clients';

const admin = service();
let requestId: string;

beforeAll(async () => {
  // Fixture written with the service role (tests only): one request owned by Sunita.
  const sunita = await as('sunita');
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('requests')
    .insert({
      ticket_no: `TEST-RLS-${Date.now()}`,
      citizen_id: sunita.uid,
      channel: 'web',
      language: 'mr',
      description: 'RLS test fixture',
      ward_id: 7,
      submitted_at: now,
      triage_due_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) throw error;
  requestId = data.id;
});

afterAll(async () => {
  if (requestId) await admin.from('requests').delete().eq('id', requestId);
});

describe('reference tables', () => {
  test.each([
    ['departments', 6],
    ['categories', 8],
    ['wards', 10],
    ['landmarks', 15],
    ['sla_policies', 8],
    ['workflow_transitions', 13],
    ['app_settings', 1],
  ])('anon reads %s', async (table, min) => {
    const { data, error } = await anon().from(table).select('*');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(min);
  });
});

describe('anon', () => {
  test.each(['requests', 'profiles', 'audit_events', 'ai_suggestions', 'notifications'])(
    'cannot read %s',
    async (table) => {
      const { error } = await anon().from(table).select('id').limit(1);
      expect(error?.code).toBe(PERMISSION_DENIED);
    },
  );

  test('cannot write reference tables', async () => {
    const { error } = await anon().from('categories').update({ icon: 'x' }).eq('code', 'other');
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('authenticated', () => {
  test('cannot insert a request directly', async () => {
    const sunita = await as('sunita');
    const now = new Date().toISOString();
    const { error } = await sunita.from('requests').insert({
      ticket_no: 'NMC-HACK',
      citizen_id: sunita.uid,
      channel: 'web',
      language: 'mr',
      description: 'direct insert',
      ward_id: 7,
      submitted_at: now,
      triage_due_at: now,
      updated_at: now,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  test.each(['sunita', 'meera', 'commissioner'])('%s cannot update or delete a request directly', async (user) => {
    const c = await as(user);
    const upd = await c.from('requests').update({ state: 'CLOSED' }).eq('id', requestId);
    expect(upd.error?.code).toBe(PERMISSION_DENIED);
    const del = await c.from('requests').delete().eq('id', requestId);
    expect(del.error?.code).toBe(PERMISSION_DENIED);
  });

  test('cannot promote themselves', async () => {
    const sunita = await as('sunita');
    const { error } = await sunita.from('profiles').update({ role: 'commissioner' }).eq('id', sunita.uid);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  test.each(['audit_events', 'ai_suggestions', 'notifications'])('cannot insert into %s', async (table) => {
    const c = await as('meera');
    const { error } = await c.from(table).insert({});
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  test('cannot set the ai_writer password', async () => {
    const c = await as('commissioner');
    const { error } = await c.rpc('set_ai_writer_password', { p_password: 'x'.repeat(20) });
    expect(error).not.toBeNull();
  });
});

describe('request visibility', () => {
  test('the owner sees it', async () => {
    const { data } = await (await as('sunita')).from('requests').select('id').eq('id', requestId);
    expect(data).toHaveLength(1);
  });

  test('another citizen does not', async () => {
    const { data, error } = await (await as('ramesh')).from('requests').select('id').eq('id', requestId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test('an untriaged request is invisible to officers and other departments, visible to the manager', async () => {
    expect((await (await as('patil')).from('requests').select('id').eq('id', requestId)).data).toHaveLength(0);
    expect((await (await as('deshmukh')).from('requests').select('id').eq('id', requestId)).data).toHaveLength(0);
    expect((await (await as('meera')).from('requests').select('id').eq('id', requestId)).data).toHaveLength(1);
  });
});
