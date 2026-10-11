import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/store';
import { ActionForm, secondary } from '@/features/request-detail/ActionForm';
import {
  type StaffRequest,
  useStaffAct,
  useStaffDirectory,
  useStaffRequests,
  useTransitions,
} from '@/features/request-detail/hooks';
import { Modal } from '@/features/request-detail/Modal';
import { MessageForm } from '@/features/request-detail/RequestDetail';
import { RequestTable } from '@/features/request-detail/RequestTable';
import { allowedActions } from '@/features/request-detail/useAllowedActions';
import { rpc } from '@/lib/rpc';

type Open = { r: StaffRequest; kind: 'assign' | 'reassign' | 'note' } | null;

/** Assign / Reassign / Add note buttons, each opening its form in a dialog. */
function useRowActions(kinds: ('assign' | 'reassign' | 'note')[]) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.profile);
  const { data: transitions } = useTransitions();
  const { run, busy } = useStaffAct();
  const [open, setOpen] = useState<Open>(null);
  const allowed = (r: StaffRequest) => (me ? allowedActions(transitions ?? [], r, me) : []);

  const cell = (r: StaffRequest) => (
    <div className="flex gap-1">
      {kinds
        .filter((k) => k === 'note' || allowed(r).some((a) => a.action === k))
        .map((k) => (
          <button key={k} onClick={() => setOpen({ r, kind: k })} className={secondary}>
            {t(`staff.action.${k}`)}
          </button>
        ))}
    </div>
  );

  const dialog = open && (
    <Modal title={`${t(`staff.action.${open.kind}`)} · ${open.r.ticket_no}`} onClose={() => setOpen(null)}>
      {open.kind === 'note' ? (
        <MessageForm
          label={t('staff.field.note')}
          button={t('staff.action.note')}
          busy={busy}
          onSend={async (body) => {
            if (await run(() => rpc('add_staff_note', { p_request_id: open.r.id, p_body: body }), t('staff.done.note')))
              setOpen(null);
          }}
        />
      ) : (
        <ActionForm
          r={open.r}
          action={open.kind}
          requires={allowed(open.r).find((a) => a.action === open.kind)?.requires ?? []}
          onDone={() => setOpen(null)}
        />
      )}
    </Modal>
  );
  return { cell, dialog };
}

/** Dept Head: triaged and reopened requests waiting for an officer, oldest deadline first. */
export function ToAssign() {
  const { t } = useTranslation();
  const { data } = useStaffRequests();
  const { cell, dialog } = useRowActions(['assign']);
  const rows = (data ?? [])
    .filter((r) => r.state === 'TRIAGED' || r.state === 'REOPENED')
    .sort((a, b) => Date.parse(a.resolution_due_at ?? '') - Date.parse(b.resolution_due_at ?? ''));
  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.toAssign')}</h1>
      <RequestTable rows={rows} extra={cell} empty={t('staff.nothingToAssign')} />
      {dialog}
    </section>
  );
}

/** Dept Head (their department, via RLS) and Commissioner (whole city): requests past their deadline. */
export function Escalations() {
  const { t } = useTranslation();
  const role = useAuth((s) => s.profile?.role);
  const { data } = useStaffRequests();
  const { cell, dialog } = useRowActions(['reassign', 'assign', 'note']);
  const rows = (data ?? [])
    .filter(
      (r) =>
        (r.escalation_level > 0 && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(r.state)) ||
        (role === 'commissioner' && r.state === 'SUBMITTED' && !!r.triage_escalated_at),
    )
    .sort((a, b) => b.escalation_level - a.escalation_level || (b.sla_ratio ?? 0) - (a.sla_ratio ?? 0));
  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.escalations')}</h1>
      <RequestTable rows={rows} extra={cell} empty={t('staff.noEscalations')} />
      {dialog}
    </section>
  );
}

const OPEN = ['ASSIGNED', 'IN_PROGRESS', 'NEEDS_INFO'];

/** Dept Head: workload per officer, computed from the department's requests. */
export function Officers() {
  const { t } = useTranslation();
  const dept = useAuth((s) => s.profile?.department_code);
  const { data: staff } = useStaffDirectory();
  const { data } = useStaffRequests();
  const officers = staff?.filter((p) => p.role === 'officer' && p.department_code === dept) ?? [];
  const stats = (id: string) => {
    const mine = data?.filter((r) => r.assigned_officer_id === id) ?? [];
    const open = mine.filter((r) => OPEN.includes(r.state));
    const done = mine.filter((r) => r.resolved_at && r.sla_clock_start);
    const avg = done.length
      ? done.reduce((s, r) => s + Date.parse(r.resolved_at!) - Date.parse(r.sla_clock_start!), 0) / done.length / 3.6e6
      : null;
    return { open: open.length, late: open.filter((r) => r.sla_status_of === 'breached').length, avg };
  };
  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.officers')}</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {['officer', 'wards', 'open', 'late', 'avg'].map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {t(`staff.officersCol.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {officers.map((o) => {
              const s = stats(o.id);
              return (
                <tr key={o.id} className="h-10 border-t border-line">
                  <td className="px-3">{o.full_name}</td>
                  <td className="tabular px-3">{o.wards.join(', ')}</td>
                  <td className="tabular px-3">{s.open}</td>
                  <td className="tabular px-3">{s.late}</td>
                  <td className="tabular px-3">{s.avg == null ? '—' : s.avg.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
