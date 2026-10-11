import { CircleArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  /** requests.escalation_level */
  level: number;
  /** A triage breach (requests.triage_escalated_at) goes straight to the Commissioner. */
  triage?: boolean;
};

export function EscalationBadge({ level, triage = false }: Props) {
  const { t } = useTranslation();
  if (!level && !triage) return null;
  const toCommissioner = triage || level >= 2;
  const color = toCommissioner ? 'var(--sla-breach)' : 'var(--sla-risk)';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-surface px-2 py-0.5 text-sm font-medium"
      style={{ color, boxShadow: `inset 0 0 0 2px ${color}` }}
    >
      <CircleArrowUp aria-hidden size={16} />
      {t(toCommissioner ? 'esc.commissioner' : 'esc.deptHead')}
    </span>
  );
}
