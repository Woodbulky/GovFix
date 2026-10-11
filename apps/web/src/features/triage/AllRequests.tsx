import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffRequests } from '@/features/request-detail/hooks';
import { RequestTable } from '@/features/request-detail/RequestTable';
import { nameOf, useDepartments } from '@/lib/reference';
import { cn } from '@/lib/utils';

const STATES = [
  'SUBMITTED',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'NEEDS_INFO',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'REJECTED',
];

/** Toggle buttons above a table (aria-pressed, never colour alone). */
export function FilterChips(p: { label: string; options: string[][]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={p.label} className="flex flex-wrap gap-1">
      {p.options.map(([k, text]) => (
        <button
          key={k}
          aria-pressed={p.value === k}
          onClick={() => p.onChange(k)}
          className={cn(
            'min-h-11 whitespace-nowrap rounded-sm border px-3 font-medium',
            p.value === k ? 'border-nmc bg-nmc text-white' : 'border-line bg-surface',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Manager and Commissioner: every request, searchable by ticket or text, filterable by state and department. */
export function AllRequests() {
  const { t, i18n } = useTranslation();
  const { data } = useStaffRequests();
  const { data: depts } = useDepartments();
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [dept, setDept] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (data ?? [])
    .filter(
      (r) =>
        (state === 'all' || r.state === state) &&
        (!dept || r.department_code === dept) &&
        (!needle || r.ticket_no.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle)),
    )
    .reverse();

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.allRequests')}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-medium">{t('staff.search')}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="NMC-2026-000142"
            className="mt-1 block min-h-11 rounded-md border border-line bg-surface px-3"
          />
        </label>
        <label className="block">
          <span className="font-medium">{t('staff.department')}</span>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="mt-1 block min-h-11 rounded-md border border-line bg-surface px-3"
          >
            <option value="">{t('staff.allDepartments')}</option>
            {depts?.map((d) => (
              <option key={d.code} value={d.code}>
                {nameOf(d, i18n.language)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FilterChips
        label={t('staff.filter')}
        options={[['all', t('staff.all')], ...STATES.map((s) => [s, t(`state.${s}`)])]}
        value={state}
        onChange={setState}
      />
      <p className="tabular text-sm text-ink-muted">{t('staff.count', { count: rows.length })}</p>
      <RequestTable rows={rows} />
    </section>
  );
}
