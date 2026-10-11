import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import type { Json } from '@/lib/database.types';
import { must } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { type Refusal, rpc, type State, transition } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';

const SELECT =
  '*, sla_status_of, sla_ratio, officer:profiles!requests_assigned_officer_id_fkey(full_name), photos:request_photos(storage_path, kind, created_at)';

/**
 * Every request the caller may see (RLS scopes it per role); screens filter in memory.
 * ponytail: one unpaginated query, fine for a demo city; page it server-side past a few thousand rows.
 */
export function useStaffRequests() {
  const uid = useAuth((s) => s.profile?.id);
  const key = ['staff_requests', uid];
  useRealtime('requests', key);
  return useQuery({
    queryKey: key,
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('requests').select(SELECT).order('submitted_at')),
  });
}
export type StaffRequest = NonNullable<ReturnType<typeof useStaffRequests>['data']>[number];

export function useRequest(id: string) {
  const key = ['request', id];
  useRealtime('requests', key);
  useRealtime('audit_events', key);
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const [req, messages, audit, suggestions] = await Promise.all([
        supabase.from('requests').select(SELECT).eq('id', id).maybeSingle(),
        supabase.from('request_messages').select('*').eq('request_id', id).order('created_at'),
        supabase.from('audit_events').select('*').eq('request_id', id).order('id'),
        supabase.from('ai_suggestions').select('*').eq('request_id', id).order('created_at', { ascending: false }),
      ]);
      if (req.error) throw new Error(req.error.message);
      return { request: req.data, messages: must(messages), audit: must(audit), suggestions: must(suggestions) };
    },
  });
}
export type RequestBundle = NonNullable<ReturnType<typeof useRequest>['data']>;
export type Suggestion = RequestBundle['suggestions'][number];

/** Officers with their ward coverage, for the picker, workload table and audit names. */
export function useStaffDirectory() {
  return useQuery({
    queryKey: ['ref', 'staff'],
    staleTime: Infinity,
    queryFn: async () => {
      const [people, wards] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, department_code').neq('role', 'citizen'),
        supabase.from('officer_wards').select('officer_id, ward_id'),
      ]);
      const cover = new Map<string, number[]>();
      for (const w of must(wards)) cover.set(w.officer_id!, [...(cover.get(w.officer_id!) ?? []), w.ward_id!]);
      return must(people).map((p) => ({ ...p, wards: cover.get(p.id) ?? [] }));
    },
  });
}
export type StaffMember = NonNullable<ReturnType<typeof useStaffDirectory>['data']>[number];

/** Workflow rows, so the UI offers only the actions the engine would accept for this state and role. */
export const useTransitions = () =>
  useQuery({
    queryKey: ['ref', 'workflow_transitions'],
    staleTime: Infinity,
    queryFn: async () => must(await supabase.from('workflow_transitions').select('*')),
  });
export type Transition = NonNullable<ReturnType<typeof useTransitions>['data']>[number];

type Outcome = { ok: true } | Refusal;

/** Staff see the engine's own refusal message (it names the officer, ward or guard) and the audit row it wrote. */
export const refusedToast = (r: Refusal) =>
  toast(r.audit_id ? `${r.message} (audit #${r.audit_id})` : r.message, 'refused');

/** Runs a staff write, toasts the outcome and refreshes every request view. */
export function useStaffAct() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (call: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    try {
      const res = (await call()) as Outcome;
      if (res.ok) toast(okText);
      else refusedToast(res);
      return res.ok;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'refused');
      return false;
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ['staff_requests'] });
      await qc.invalidateQueries({ queryKey: ['request'] });
    }
  };
  const act = (r: { id: string; state: State }, action: string, payload: Json, okText: string, sugg?: string) =>
    run(() => transition(r.id, action, r.state, payload, sugg), okText);
  return { run, act, busy };
}

/** Officer proof photo: upload under the officer's folder, then attach_photo (the engine checks the object exists). */
export async function uploadProof(requestId: string, uid: string, file: Blob) {
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from('proof-photos').upload(path, file, { contentType: 'image/jpeg' });
  if (up.error) throw new Error(up.error.message);
  return rpc('attach_photo', { p_request_id: requestId, p_storage_path: path, p_kind: 'proof' }) as Promise<Outcome>;
}
