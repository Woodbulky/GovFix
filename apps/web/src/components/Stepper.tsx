import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { State } from '@/lib/rpc';
import { cn } from '@/lib/utils';

const MAIN: State[] = ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
// Branch states sit on the main step they hang off, and replace its label while active.
const BRANCH: Partial<Record<State, State>> = { NEEDS_INFO: 'IN_PROGRESS', REOPENED: 'TRIAGED', REJECTED: 'TRIAGED' };

export function Stepper({ state }: { state: State }) {
  const { t } = useTranslation();
  const at = MAIN.indexOf(BRANCH[state] ?? state);
  const final = state === 'CLOSED' || state === 'REJECTED';
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-3" aria-label={t('stepper.label')}>
      {MAIN.map((s, i) => {
        const current = i === at;
        const done = i < at || (current && final);
        const label = current ? state : s;
        return (
          <li
            key={s}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 text-sm',
              current ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-ink-muted',
            )}
          >
            <span
              className={cn(
                'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-nmc bg-nmc text-white' : current ? 'border-nmc text-nmc' : 'border-line',
              )}
            >
              {done ? <Check aria-hidden size={16} /> : i + 1}
            </span>
            {t(`state.${label}`)}
            {i < MAIN.length - 1 && <span aria-hidden className="mx-1 hidden h-px w-6 bg-line sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
