import {
  Ban,
  CircleCheck,
  Inbox,
  Lock,
  type LucideIcon,
  MessageCircleQuestion,
  RotateCcw,
  Tags,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { State } from '@/lib/rpc';

// [icon, status token]
const STYLE: Record<State, [LucideIcon, string]> = {
  SUBMITTED: [Inbox, 'submitted'],
  TRIAGED: [Tags, 'triaged'],
  ASSIGNED: [UserCheck, 'assigned'],
  IN_PROGRESS: [Wrench, 'progress'],
  NEEDS_INFO: [MessageCircleQuestion, 'info'],
  RESOLVED: [CircleCheck, 'resolved'],
  REOPENED: [RotateCcw, 'reopened'],
  CLOSED: [Lock, 'closed'],
  REJECTED: [Ban, 'rejected'],
};

export function StatusChip({ state }: { state: State }) {
  const { t } = useTranslation();
  const [Icon, token] = STYLE[state];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold"
      style={{ color: `var(--st-${token})`, background: `var(--st-${token}-bg)` }}
    >
      <Icon aria-hidden size={16} />
      {t(`state.${state}`)}
    </span>
  );
}
