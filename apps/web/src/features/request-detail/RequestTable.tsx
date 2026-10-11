import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EscalationBadge } from '@/components/EscalationBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { useRequestTitle } from '@/features/citizen/ComplaintCard';
import { fmtWhen } from '@/lib/time';
import type { StaffRequest } from './hooks';

type Props = {
  rows: StaffRequest[];
  /** Extra cell per row, e.g. an inline action. */
  extra?: (r: StaffRequest) => ReactNode;
  empty?: string;
};

/** Dense staff list: every place a request appears shows its StatusChip, SlaBadge and EscalationBadge. */
export function RequestTable({ rows, extra, empty }: Props) {
  const { t } = useTranslation();
  if (!rows.length) return <p className="text-ink-muted">{empty ?? t('staff.empty')}</p>;
  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-paper">
          <tr>
            {['ticket', 'issue', 'place', 'status', 'deadline', 'officer', 'updated'].map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-semibold">
                {t(`staff.col.${c}`)}
              </th>
            ))}
            {extra && <th scope="col" className="px-3 py-2" aria-label={t('staff.col.actions')} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} r={r} extra={extra} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r, extra }: { r: StaffRequest; extra?: Props['extra'] }) {
  const { i18n } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  return (
    <tr className="h-10 border-t border-line align-middle">
      <td className="tabular whitespace-nowrap px-3 py-1">
        <Link to={`/requests/${r.id}`} className="font-semibold text-nmc underline-offset-2 hover:underline">
          {r.ticket_no}
        </Link>
      </td>
      <td className="max-w-[16rem] truncate px-3 py-1">{title}</td>
      <td className="min-w-[12rem] px-3 py-1">{place}</td>
      <td className="px-3 py-1">
        <StatusChip state={r.state} />
      </td>
      <td className="px-3 py-1">
        <div className="flex flex-col items-start gap-1 whitespace-nowrap">
          <SlaBadge status={r.sla_status_of} dueAt={r.resolution_due_at} />
          <EscalationBadge level={r.escalation_level} triage={!!r.triage_escalated_at && r.state === 'SUBMITTED'} />
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-1">{r.officer?.full_name ?? '—'}</td>
      <td className="tabular whitespace-nowrap px-3 py-1">{fmtWhen(r.updated_at, i18n.language)}</td>
      {extra && <td className="whitespace-nowrap px-3 py-1">{extra(r)}</td>}
    </tr>
  );
}
