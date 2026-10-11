// Helpers for the workflow engine tests: RPC calls as demo users and driving a request through states.
import { expect } from 'vitest';
import { as, service } from './clients';

export const H = 3600;
export type Res = {
  ok: boolean;
  code?: string;
  message?: string;
  audit_id?: number;
  request?: { id: string } & Record<string, unknown>;
};

const admin = service();
const uploaded: string[] = [];

export async function rpc<T = Res>(user: string, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (await as(user)).rpc(fn, args);
  if (error) throw new Error(`${fn} as ${user}: ${error.message}`);
  return data as T;
}

export const tr = (user: string, id: string, action: string, expected: string, payload = {}, sugg?: string) =>
  rpc(user, 'transition_request', {
    p_request_id: id,
    p_action: action,
    p_expected_state: expected,
    p_payload: payload,
    p_ai_suggestion_id: sugg ?? null,
  });

/** A new Ward 7 complaint near Ghantaghar Chowk, filed by `user`. */
export async function newRequest(user = 'sunita'): Promise<string> {
  const r = await rpc(user, 'create_request', {
    p: {
      description: 'Engine test: water leaking in the lane',
      ward_id: 7,
      landmark_id: 1,
      category_hint: 'water_leak',
    },
  });
  expect(r.ok, r.message).toBe(true);
  return r.request!.id;
}

export async function addProof(id: string, officer = 'patil'): Promise<Res> {
  const c = await as(officer);
  const path = `${c.uid}/engine-test-${crypto.randomUUID()}.jpg`;
  const up = await c.storage
    .from('proof-photos')
    .upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  uploaded.push(path);
  return rpc(officer, 'attach_photo', { p_request_id: id, p_storage_path: path, p_kind: 'proof' });
}

const PATH = ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as const;

/** Drive a fresh SUBMITTED water-leak request (Ward 7) to `target` the happy way: Meera, Deshmukh, Patil. */
export async function driveTo(id: string, target: (typeof PATH)[number]) {
  const patil = await as('patil');
  const steps: [string, string, string, object][] = [
    ['meera', 'triage', 'SUBMITTED', { category_code: 'water_leak' }],
    ['deshmukh', 'assign', 'TRIAGED', { officer_id: patil.uid }],
    ['patil', 'start', 'ASSIGNED', {}],
    ['patil', 'resolve', 'IN_PROGRESS', { resolution_note: 'Pipe joint replaced' }],
  ];
  for (const [user, action, from, payload] of steps.slice(0, PATH.indexOf(target))) {
    if (action === 'resolve') expect((await addProof(id)).ok).toBe(true);
    const r = await tr(user, id, action, from, payload);
    expect(r.ok, `${action}: ${r.message}`).toBe(true);
  }
}

export const advance = (seconds: number) => rpc('commissioner', 'time_machine_advance', { p_seconds: seconds });

export async function getRequest(id: string) {
  const { data, error } = await admin.from('requests').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function auditRow(id: number) {
  const { data, error } = await admin.from('audit_events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function escalations(requestId: string, stage: 'triage' | 'resolution') {
  const { data, error } = await admin
    .from('audit_events')
    .select('payload')
    .eq('request_id', requestId)
    .eq('action', 'escalate')
    .eq('payload->>stage', stage);
  if (error) throw error;
  return data.map((e) => e.payload.level as number);
}

/** Every suite starts and ends on the demo scenario with the clock at zero. */
export async function resetDemo() {
  const r = await rpc('commissioner', 'reset_demo');
  expect(r.ok, r.message).toBe(true);
  if (uploaded.length) await admin.storage.from('proof-photos').remove(uploaded.splice(0));
}

export { admin };
