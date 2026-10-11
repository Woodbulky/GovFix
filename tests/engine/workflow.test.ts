// Workflow engine tests 1-9, 11, 12 and 19 from docs/WORKFLOW.md. Refusals are recorded, not thrown.
import { afterAll, beforeAll, expect, test } from 'vitest';
import { as } from './clients';
import { admin, advance, auditRow, driveTo, getRequest, H, newRequest, resetDemo, rpc, tr } from './flow';

beforeAll(resetDemo);
afterAll(resetDemo);

test('01 a citizen calling triage is refused as ROLE_NOT_PERMITTED, with a refused audit row', async () => {
  const id = await newRequest();
  const r = await tr('sunita', id, 'triage', 'SUBMITTED', { category_code: 'water_leak' });
  expect(r).toMatchObject({ ok: false, code: 'ROLE_NOT_PERMITTED' });
  const row = await auditRow(r.audit_id!);
  expect(row).toMatchObject({ outcome: 'refused', code: 'ROLE_NOT_PERMITTED', action: 'triage', request_id: id });
  expect((await getRequest(id)).state).toBe('SUBMITTED');
});

test('02 SUBMITTED → resolve is INVALID_TRANSITION', async () => {
  const id = await newRequest();
  const r = await tr('patil', id, 'resolve', 'SUBMITTED', { resolution_note: 'x' });
  expect(r).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
  expect(r.message).toContain('Submitted → Resolved');
});

test('03 triage without category_code is MISSING_FIELD:category_code', async () => {
  const id = await newRequest();
  expect(await tr('meera', id, 'triage', 'SUBMITTED', {})).toMatchObject({ code: 'MISSING_FIELD:category_code' });
});

test('04 triage as "other" without department_code is MISSING_FIELD:department_code', async () => {
  const id = await newRequest();
  const r = await tr('meera', id, 'triage', 'SUBMITTED', { category_code: 'other' });
  expect(r).toMatchObject({ ok: false, code: 'MISSING_FIELD:department_code' });
  const ok = await tr('meera', id, 'triage', 'SUBMITTED', { category_code: 'other', department_code: 'HLT' });
  expect(ok.request).toMatchObject({ state: 'TRIAGED', department_code: 'HLT' });
});

test('05 assigning an officer from another department is GUARD_FAILED:officer_in_department', async () => {
  const id = await newRequest();
  await driveTo(id, 'TRIAGED');
  const more = await as('more');
  const r = await tr('deshmukh', id, 'assign', 'TRIAGED', { officer_id: more.uid });
  expect(r).toMatchObject({ ok: false, code: 'GUARD_FAILED:officer_in_department' });
});

test('06 assigning Kale to a Ward 7 water request is GUARD_FAILED:officer_covers_ward', async () => {
  const id = await newRequest();
  await driveTo(id, 'TRIAGED');
  const kale = await as('kale');
  const r = await tr('deshmukh', id, 'assign', 'TRIAGED', { officer_id: kale.uid });
  expect(r).toMatchObject({ ok: false, code: 'GUARD_FAILED:officer_covers_ward' });
  expect(r.message).toBe("Priya Kale doesn't cover Ward 7.");
});

test("07 Officer More starting Patil's request is GUARD_FAILED:is_assigned_officer", async () => {
  const id = await newRequest();
  await driveTo(id, 'ASSIGNED');
  expect(await tr('more', id, 'start', 'ASSIGNED')).toMatchObject({ code: 'GUARD_FAILED:is_assigned_officer' });
});

test('08 resolve without a proof photo is GUARD_FAILED:has_proof_photo', async () => {
  const id = await newRequest();
  await driveTo(id, 'IN_PROGRESS');
  const r = await tr('patil', id, 'resolve', 'IN_PROGRESS', { resolution_note: 'Fixed' });
  expect(r).toMatchObject({ ok: false, code: 'GUARD_FAILED:has_proof_photo' });
  expect(r.message).toBe('Add a photo of the completed work before marking it resolved.');
});

test("09 Ramesh confirming Sunita's request is GUARD_FAILED:is_owner", async () => {
  const id = await newRequest('sunita');
  await driveTo(id, 'RESOLVED');
  expect(await tr('ramesh', id, 'confirm', 'RESOLVED')).toMatchObject({ code: 'GUARD_FAILED:is_owner' });
  expect(await tr('sunita', id, 'confirm', 'RESOLVED')).toMatchObject({ ok: true, request: { state: 'CLOSED' } });
});

test('11 a wrong expected_state is STALE_STATE', async () => {
  const id = await newRequest();
  await driveTo(id, 'TRIAGED');
  const r = await tr('meera', id, 'triage', 'SUBMITTED', { category_code: 'pothole' });
  expect(r).toMatchObject({ ok: false, code: 'STALE_STATE' });
  expect((await getRequest(id)).category_code).toBe('water_leak');
});

test('12 NEEDS_INFO for 5h shifts resolution_due_at by exactly the paused time', async () => {
  const id = await newRequest();
  await driveTo(id, 'IN_PROGRESS');
  const before = await getRequest(id);
  expect(await tr('patil', id, 'request_info', 'IN_PROGRESS', { question: 'Which building?' })).toMatchObject({
    ok: true,
  });
  expect(await rpc('sunita', 'sla_status', { p_request_id: id })).toBe('paused');
  await advance(5 * H);
  expect(await tr('sunita', id, 'provide_info', 'NEEDS_INFO', { reply: 'Near the tailor shop' })).toMatchObject({
    ok: true,
  });
  const after = await getRequest(id);
  const shift = (Date.parse(after.resolution_due_at) - Date.parse(before.resolution_due_at)) / 1000;
  expect(shift).toBe(after.paused_seconds);
  expect(after.paused_seconds).toBeGreaterThanOrEqual(5 * H);
  expect(after.paused_seconds).toBeLessThan(5 * H + 120); // wall-clock seconds pass between calls
  const { data: msgs } = await admin.from('request_messages').select('kind').eq('request_id', id);
  expect(msgs!.map((m) => m.kind).sort()).toEqual(['info_question', 'info_reply']);
});

test('19 accepting an AI suggestion changes nothing until a triage call references it', async () => {
  const id = await newRequest();
  const { data: s, error } = await admin
    .from('ai_suggestions')
    .insert({
      request_id: id,
      type: 'category',
      payload: { category_code: 'water_leak' },
      confidence: 0.94,
      provider: 'keyword',
    })
    .select('id')
    .single();
  if (error) throw error;
  const before = await getRequest(id);

  expect(await rpc('meera', 'decide_suggestion', { p_id: s.id, p_decision: 'accepted' })).toMatchObject({ ok: true });
  const mid = await getRequest(id);
  expect(mid).toEqual(before);

  const r = await tr('meera', id, 'triage', 'SUBMITTED', { category_code: 'water_leak' }, s.id);
  expect(r.request).toMatchObject({ state: 'TRIAGED', category_code: 'water_leak', department_code: 'WTR' });
  expect((await auditRow(r.audit_id!)).payload.ai_suggestion_id).toBe(s.id);
});
