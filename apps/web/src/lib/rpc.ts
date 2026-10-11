import type { Database, Json } from './database.types';
import { supabase } from './supabase';

type Fns = Database['public']['Functions'];
export type State = Database['public']['Enums']['request_state'];

// Engine internals are not executable by clients; keep them out of autocomplete.
export type RpcName = Exclude<
  keyof Fns,
  `_${string}` | 'append_audit' | 'audit_hash' | 'notify' | 'notify_role' | 'set_ai_writer_password'
>;

/** Refusals are audited too, so `audit_id` links the toast to its audit row. */
export type Refusal = { ok: false; code: string; message: string; audit_id?: number };
export type RpcResult<T = Record<string, unknown>> = ({ ok: true } & T) | Refusal;

/**
 * The only way the web app writes. Transport and permission errors throw;
 * business refusals come back as `{ ok: false, code, message }` (golden rule 2).
 */
export async function rpc<F extends RpcName>(fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw new Error(error.message);
  return data as Fns[F]['Returns'];
}

export const transition = (
  requestId: string,
  action: string,
  expectedState: State,
  payload: Json = {},
  aiSuggestionId?: string,
) =>
  rpc('transition_request', {
    p_request_id: requestId,
    p_action: action,
    p_expected_state: expectedState,
    p_payload: payload,
    p_ai_suggestion_id: aiSuggestionId,
  }) as Promise<
    RpcResult<{ request: Record<string, unknown> & { state: State; sla_status: string }; audit_id: number }>
  >;
