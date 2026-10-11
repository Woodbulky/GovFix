import { Mic } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/store';
import type { State } from '@/lib/rpc';
import { cn } from '@/lib/utils';
import { ComplaintCard } from './ComplaintCard';
import { useMyRequests } from './hooks';

const OPEN: State[] = ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'];
const TABS: Record<string, (s: State) => boolean> = {
  all: () => true,
  reply: (s) => s === 'NEEDS_INFO',
  open: (s) => OPEN.includes(s),
  resolved: (s) => s === 'RESOLVED',
  closed: (s) => s === 'CLOSED' || s === 'REJECTED',
};

export function MyComplaints() {
  const { t } = useTranslation();
  const { data, isPending } = useMyRequests();
  const [tab, setTab] = useState('all');
  const list = data?.filter((r) => TABS[tab](r.state)) ?? [];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.myComplaints')}</h1>
      <div role="group" aria-label={t('mine.filter')} className="flex gap-1 overflow-x-auto">
        {Object.keys(TABS).map((k) => (
          <button
            key={k}
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'min-h-11 whitespace-nowrap rounded-sm px-3 font-medium',
              tab === k ? 'bg-nmc text-white' : 'bg-surface',
            )}
          >
            {t(`mine.tab.${k}`)} <span className="tabular">({data?.filter((r) => TABS[k](r.state)).length ?? 0})</span>
          </button>
        ))}
      </div>
      {!isPending && !list.length && <p className="text-ink-muted">{t('mine.empty')}</p>}
      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id}>
            <ComplaintCard r={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CitizenHome() {
  const { t } = useTranslation();
  const name = useAuth((s) => s.profile?.full_name.split(' ')[0]);
  const { data } = useMyRequests();
  const open = data?.filter((r) => r.state !== 'CLOSED' && r.state !== 'REJECTED') ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg bg-canopy p-6 text-white">
        <h1 className="text-3xl">{t('citizen.greeting', { name })}</h1>
        <p className="text-white/85">{t('hero.body')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/report?mode=talk"
            className="inline-flex min-h-[56px] items-center gap-2 rounded-md bg-marigold px-6 text-lg font-semibold text-canopy"
          >
            <Mic aria-hidden /> {t('actions.talk')}
          </Link>
          <Link
            to="/report"
            className="inline-flex min-h-[56px] items-center rounded-md border border-white px-6 font-semibold"
          >
            {t('actions.type')}
          </Link>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl">
          {t('citizen.open')} <span className="tabular">({open.length})</span>
        </h2>
        {data && !open.length && <p className="text-ink-muted">{t('citizen.noneOpen')}</p>}
        <ul className="space-y-3">
          {open.map((r) => (
            <li key={r.id}>
              <ComplaintCard r={r} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
