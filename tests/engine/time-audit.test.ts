// Workflow engine tests 10, 13-18 and 20 from docs/WORKFLOW.md: sim time, escalation, auto-close,
// physical write locks, the audit chain and demo mode.
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { as, PERMISSION_DENIED } from './clients';
import { admin, advance, driveTo, escalations, getRequest, H, newRequest, resetDemo, rpc, tr } from './flow';

beforeAll(resetDemo);
afterAll(resetDemo);

const settings = (patch: Record<string, unknown>) => admin.from('app_settings').update(patch).eq('id', 1);

test('10 reopening 8 sim days after resolve is GUARD_FAILED:within_reopen_window', async () => {
  const id = await newRequest();
  await driveTo(id, 'RESOLVED');
  // Auto-close (72h) normally closes it first; hold it off so the reopen window itself is what refuses.
  await settings({ auto_close_hours: 1000 });
  try {
    await advance(8 * 24 * H);
    const r = await tr('sunita', id, 'reopen', 'RESOLVED', { reason: 'Still leaking' });
    expect(r).toMatchObject({ ok: false, code: 'GUARD_FAILED:within_reopen_window' });
  } finally {
    await settings({ auto_close_hours: 72 });
  }
});

test('13 sweep at +25h escalates to L1 once; a second sweep adds nothing; +37h reaches L2', async () => {
  const id = await newRequest();
  await driveTo(id, 'TRIAGED'); // water_leak: 24h from submission
  await advance(25 * H);
  expect(await escalations(id, 'resolution')).toEqual([1]);
  await rpc('meera', 'run_escalation_sweep');
  expect(await escalations(id, 'resolution')).toEqual([1]);
  expect((await getRequest(id)).escalation_level).toBe(1);
  await advance(12 * H);
  expect((await escalations(id, 'resolution')).sort()).toEqual([1, 2]);
  expect((await getRequest(id)).escalation_level).toBe(2);
});

test('14 untriaged at +4h escalates triage L1 to the Commissioner', async () => {
  const id = await newRequest();
  await advance(4 * H);
  expect(await escalations(id, 'triage')).toEqual([1]);
  const commissioner = await as('commissioner');
  const { data } = await admin
    .from('notifications')
    .select('kind')
    .eq('request_id', id)
    .eq('user_id', commissioner.uid);
  expect(data!.map((n) => n.kind)).toContain('triage_escalated');
});

test('15 RESOLVED + 72h is auto-closed by the system', async () => {
  const id = await newRequest();
  await driveTo(id, 'RESOLVED');
  await advance(72 * H);
  expect((await getRequest(id)).state).toBe('CLOSED');
  const { data } = await admin.from('audit_events').select('*').eq('request_id', id).eq('action', 'auto_close');
  expect(data).toHaveLength(1);
  expect(data![0]).toMatchObject({ actor_id: null, actor_role: 'system', outcome: 'accepted', to_state: 'CLOSED' });
});

test('16 authenticated direct UPDATE on requests is permission denied', async () => {
  const id = await newRequest();
  for (const user of ['sunita', 'patil', 'commissioner']) {
    const { error } = await (await as(user)).from('requests').update({ state: 'CLOSED' }).eq('id', id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  }
});

test('17 ai_writer cannot UPDATE requests but can INSERT ai_suggestions', async () => {
  const id = await newRequest();
  const sql = postgres(process.env.AI_DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await expect(sql`update requests set state = 'CLOSED' where id = ${id}`).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    });
    const rows = await sql`insert into ai_suggestions (request_id, type, payload, confidence, provider)
      values (${id}, 'category', ${sql.json({ category_code: 'water_leak' })}, 0.9, 'llm') returning id`;
    expect(rows).toHaveLength(1);
  } finally {
    await sql.end();
  }
  expect((await getRequest(id)).state).toBe('SUBMITTED');
});

test('20 with demo_mode off, time_machine_advance and tamper_demo are refused', async () => {
  await settings({ demo_mode: false });
  try {
    expect(await rpc('commissioner', 'time_machine_advance', { p_seconds: 3600 })).toMatchObject({
      ok: false,
      code: 'DEMO_MODE_OFF',
    });
    expect(await rpc('commissioner', 'tamper_demo', { p_event_id: 1 })).toMatchObject({
      ok: false,
      code: 'DEMO_MODE_OFF',
    });
  } finally {
    await settings({ demo_mode: true });
  }
  expect(await rpc('meera', 'time_machine_advance', { p_seconds: 3600 })).toMatchObject({ code: 'ROLE_NOT_PERMITTED' });
});

// Last: it breaks the chain on purpose (afterAll's reset_demo writes a fresh genesis).
test('18 verify_audit_chain is ok; after tamper_demo(id) it breaks at exactly that id', async () => {
  expect(await rpc('commissioner', 'verify_audit_chain')).toMatchObject({ ok: true, broken_at: null });
  const { data } = await admin.from('audit_events').select('id').order('id').range(5, 5).single();
  expect(await rpc('commissioner', 'tamper_demo', { p_event_id: data!.id })).toMatchObject({ ok: true });
  expect(await rpc('meera', 'verify_audit_chain')).toMatchObject({ ok: false, broken_at: data!.id });
});
