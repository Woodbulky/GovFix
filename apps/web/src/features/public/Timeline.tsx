import { useTranslation } from 'react-i18next';
import type { State } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';

/** Shape of _timeline() in SQL (track_request / my_request_timeline). */
export type PublicTimeline = {
  found: true;
  ticket_no: string;
  state: State;
  ward_id: number;
  channel: string;
  category: { code: string; en: string; hi: string; mr: string; icon: string } | null;
  department: { code: string; en: string; hi: string; mr: string } | null;
  officer_name: string | null;
  submitted_at: string;
  resolution_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_status: string;
  escalation_level: number;
  events: { action: string; from_state?: State; to_state?: State; at: string; note?: string }[];
};

export type TimelineMessage = { kind: string; body: string; created_at: string };

/** Public timeline: state changes and citizen-visible messages. Never internal notes or staff refusals. */
export function Timeline({ data, messages = [] }: { data: PublicTimeline; messages?: TimelineMessage[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';
  const dept = data.department?.[lang] ?? data.department?.en ?? '';
  const items = [
    ...data.events.map((e) => ({
      at: e.at,
      title: t(`event.${e.action}`, { dept, defaultValue: t(`state.${e.to_state}`) }),
      body: e.note,
      order: 0,
    })),
    ...messages.map((m) => ({ at: m.created_at, title: t(`message.${m.kind}`), body: m.body, order: 1 })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.order - b.order);

  return (
    <ol className="space-y-4 border-l-2 border-line pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span aria-hidden className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-nmc" />
          <p className="font-medium">{it.title}</p>
          {it.body && <p className="whitespace-pre-line text-ink">{it.body}</p>}
          <p className="tabular text-sm text-ink-muted">{fmtWhen(it.at, i18n.language)}</p>
        </li>
      ))}
    </ol>
  );
}
