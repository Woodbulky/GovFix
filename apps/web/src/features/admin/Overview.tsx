import { useTranslation } from 'react-i18next';
import { CityMap2D } from '@/features/city/CityMap2D';
import { useStaffRequests } from '@/features/request-detail/hooks';
import { nameOf, useCategories, useDepartments, useWards } from '@/lib/reference';

export const panel = 'card p-5';
const OPEN = ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'REOPENED'] as const;

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${panel} border-t-4 border-t-nmc-600`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="tabular mt-1 font-heading text-4xl text-nmc">{value}</p>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Horizontal bars with the number printed next to each, so nothing relies on bar length alone. */
function Bars({ title, rows, unit = '' }: { title: string; rows: [string, number][]; unit?: string }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className={panel} aria-label={title}>
      <h2 className="mb-3 text-lg">{title}</h2>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map(([label, n]) => (
            <li key={label} className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-2 text-sm">
              <span className="truncate">{label}</span>
              <span className="h-3 rounded-full bg-nmc-600" style={{ width: `${(n / max) * 100}%` }} aria-hidden />
              <span className="tabular text-right">
                {Number.isInteger(n) ? n : n.toFixed(1)}
                {unit}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{t('admin.noData')}</p>
      )}
    </section>
  );
}

/** Commissioner overview: every number is counted from rows (and SQL-computed SLA fields) the DB returned. */
export function Overview() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data = [] } = useStaffRequests();
  const { data: depts = [] } = useDepartments();
  const { data: cats = [] } = useCategories();
  const { data: wards = [] } = useWards();

  const count = (f: (r: (typeof data)[number]) => boolean) => data.filter(f).length;
  const timed = data.filter((r) => r.sla_ratio != null);
  const onTime = timed.filter((r) => Number(r.sla_ratio) < 1).length;
  const breachedNow = data.filter((r) => r.sla_status_of === 'breached');

  const byDept = depts
    .map((d) => [nameOf(d, lang), count((r) => r.department_code === d.code)] as [string, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  // Resolution time = resolved - clock start - paused, from DB timestamps (display only, not SLA logic).
  const avgByCat = cats
    .map((c) => {
      const done = data.filter((r) => r.category_code === c.code && r.resolved_at && r.sla_clock_start);
      const hours = done.map(
        (r) => (Date.parse(r.resolved_at!) - Date.parse(r.sla_clock_start!)) / 3.6e6 - r.paused_seconds / 3600,
      );
      return [nameOf(c, lang), hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : -1] as [string, number];
    })
    .filter(([, h]) => h >= 0)
    .sort((a, b) => b[1] - a[1]);

  const perWard = new Map<number, number>();
  for (const r of breachedNow) perWard.set(r.ward_id, (perWard.get(r.ward_id) ?? 0) + 1);
  const wardMax = Math.max(1, ...perWard.values());

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.overview')}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label={t('admin.overview.compliance')}
          value={timed.length ? `${Math.round((onTime / timed.length) * 100)}%` : '—'}
          hint={t('admin.overview.complianceHint', { onTime, late: timed.length - onTime })}
        />
        <Tile label={t('admin.overview.pastNow')} value={breachedNow.length} />
        <Tile
          label={t('admin.overview.l1')}
          value={count((r) => r.escalation_level === 1 || (r.state === 'SUBMITTED' && !!r.triage_escalated_at))}
        />
        <Tile label={t('admin.overview.l2')} value={count((r) => r.escalation_level === 2)} />
      </div>
      <section className={panel} aria-labelledby="open-h">
        <h2 id="open-h" className="mb-3 text-lg">
          {t('admin.overview.openByState')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {OPEN.map((s) => (
            <div key={s}>
              <dt className="text-sm text-ink-muted">{t(`state.${s}`)}</dt>
              <dd className="tabular font-heading text-3xl text-nmc">{count((r) => r.state === s)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title={t('admin.overview.byDept')} rows={byDept} />
        <Bars title={t('admin.overview.avgByCat')} rows={avgByCat} unit=" h" />
      </div>
      <section className={panel} aria-labelledby="ward-h">
        <h2 id="ward-h" className="mb-3 text-lg">
          {t('admin.overview.wardBreaches')}
        </h2>
        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <CityMap2D
            className="max-h-[420px] w-full"
            tint={Object.fromEntries([...perWard].map(([w, n]) => [w, 0.15 + 0.6 * (n / wardMax)]))}
          />
          <ul className="space-y-1 text-sm">
            {wards.map((w) => (
              <li key={w.id} className="flex justify-between gap-2">
                <span>
                  {w.id} · {nameOf(w, lang)}
                </span>
                <span className="tabular">{t('admin.overview.pastCount', { count: perWard.get(w.id) ?? 0 })}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}
