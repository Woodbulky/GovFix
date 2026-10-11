import { useAuth } from '@/features/auth/store';
import type { StaffRequest, Transition } from './hooks';
import { useTransitions } from './hooks';

type Who = { id: string; role: string; department_code: string | null };
type Req = Pick<StaffRequest, 'state' | 'assigned_officer_id' | 'department_code'>;

// Caller-side guards only; target guards (officer covers ward, ...) are left to the engine and the picker.
const CALLER_GUARDS: Record<string, (r: Req, me: Who) => boolean> = {
  is_assigned_officer: (r, me) => r.assigned_officer_id === me.id,
  is_department_head_of_request: (r, me) => me.role === 'dept_head' && r.department_code === me.department_code,
  is_department_head_of_request_or_commissioner: (r, me) =>
    me.role === 'commissioner' || (me.role === 'dept_head' && r.department_code === me.department_code),
};

/** UI hides what the engine would refuse (the database is still the authority). Pure, for tests. */
export function allowedActions(rows: Transition[], r: Req, me: Who) {
  return rows.filter(
    (t) =>
      t.from_state === r.state &&
      t.allowed_roles.includes(me.role) &&
      t.guards.every((g) => CALLER_GUARDS[g]?.(r, me) ?? true),
  );
}

export function useAllowedActions(r: Req) {
  const me = useAuth((s) => s.profile);
  const { data } = useTransitions();
  if (!me || !data) return { list: [], canUpdateCitizen: false };
  return {
    list: allowedActions(data, r, me),
    // send_citizen_update(): the assigned officer or the head of the request's department.
    canUpdateCitizen: r.assigned_officer_id === me.id || CALLER_GUARDS.is_department_head_of_request(r, me),
  };
}
