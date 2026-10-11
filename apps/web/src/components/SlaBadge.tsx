import {
  CalendarClock,
  CircleCheck,
  CirclePause,
  Clock,
  Hourglass,
  type LucideIcon,
  TriangleAlert,
} from 'lucide-react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSimNow } from '@/lib/queries';
import { fmtWhen, splitDuration } from '@/lib/time';

/** Values of the SQL `sla_status_of(requests)` computed field. */
export type SlaStatus = 'untriaged' | 'on_track' | 'at_risk' | 'breached' | 'paused' | 'done';

/** [icon, colour] per SLA status; the city pins use it too, so status colours live in one place. */
export const SLA_STYLE: Record<SlaStatus, [LucideIcon, string]> = {
  untriaged: [Clock, 'var(--st-submitted)'],
  on_track: [CalendarClock, 'var(--sla-ok)'],
  at_risk: [Hourglass, 'var(--sla-risk)'],
  breached: [TriangleAlert, 'var(--sla-breach)'],
  paused: [CirclePause, 'var(--sla-paused)'],
  done: [CircleCheck, 'var(--st-closed)'],
};

export function duration(t: TFunction, ms: number) {
  const { d, h, m } = splitDuration(ms);
  const [big, small] = d
    ? [t('dur.d', { n: d }), h && t('dur.h', { n: h })]
    : h
      ? [t('dur.h', { n: h }), m && t('dur.m', { n: m })]
      : [t('dur.m', { n: m }), 0];
  return small ? `${big} ${small}` : big;
}

type Props = {
  status: SlaStatus | string | null | undefined;
  /** requests.resolution_due_at */
  dueAt?: string | null;
  /** Who reads it: "waiting for you" vs "waiting for citizen". */
  audience?: 'citizen' | 'staff';
};

export function SlaBadge({ status, dueAt, audience = 'staff' }: Props) {
  const { t, i18n } = useTranslation();
  const now = useSimNow();
  const s = (status ?? 'untriaged') as SlaStatus;
  const [Icon, color] = SLA_STYLE[s] ?? SLA_STYLE.untriaged;
  const left = dueAt ? new Date(dueAt).getTime() - now.getTime() : null;

  const label =
    s === 'on_track' && dueAt
      ? t('sla.due', { when: fmtWhen(dueAt, i18n.language) })
      : s === 'at_risk' && left !== null
        ? t('sla.dueIn', { dur: duration(t, left) })
        : s === 'breached' && left !== null
          ? t('sla.pastBy', { dur: duration(t, left) })
          : s === 'paused'
            ? t(`sla.paused_${audience}`)
            : t(`sla.${s}`);

  return (
    <span
      className="tabular inline-flex items-center gap-1 rounded-full border bg-surface px-2.5 py-0.5 text-sm font-semibold"
      style={{ color, borderColor: color }}
    >
      <Icon aria-hidden size={16} />
      {label}
    </span>
  );
}
