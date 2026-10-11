// Top-left under the search: the complaint filter (same fields as NIVA's filter_city), "Next by deadline" for
// staff, and a keyboard/screen-reader list of the pins shown.
import { ChevronDown, Crosshair, ListFilter, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SLA_STYLE } from '@/components/SlaBadge';
import { nameOf, useCategories } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { type CityFilter, filterActive, type Marker, nextByDeadline, slaRank } from '../markers/data';
import { useMarkerText } from '../markers/PinLayer';
import { useCity } from '../store';

const STATUSES: NonNullable<CityFilter['status']>[] = ['all', 'open', 'past_deadline', 'resolved'];
const btn = 'inline-flex min-h-[var(--touch)] items-center gap-1.5 rounded-md px-3 font-semibold';

type Props = {
  shown: Marker[];
  total: number;
  signedIn: boolean;
  staff: boolean;
  onOpen: (m: Marker) => void;
};

export function Complaints({ shown, total, signedIn, staff, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const { filter, setFilter } = useCity();
  const { data: cats } = useCategories();
  const [open, setOpen] = useState(false);
  const id = useId();
  const text = useMarkerText();
  const next = staff ? nextByDeadline(shown) : undefined;
  const set = (f: CityFilter) => setFilter({ ...filter, ...f });
  const sorted = [...shown].sort((a, b) => slaRank(a.sla) - slaRank(b.sla) || b.ageHours - a.ageHours);

  return (
    <section aria-label={t('city.complaints')} className="flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className={cn(btn, 'bg-surface text-ink shadow-md')}
        >
          <ListFilter aria-hidden size={18} />
          {filterActive(filter)
            ? t('city.shownOf', { n: shown.length, total })
            : t('city.shownAll', { n: shown.length })}
          <ChevronDown aria-hidden size={16} className={open ? 'rotate-180' : ''} />
        </button>
        {filterActive(filter) && (
          <button type="button" onClick={() => setFilter({})} className={cn(btn, 'bg-surface text-ink shadow-md')}>
            <X aria-hidden size={16} />
            {t('city.clearFilter')}
          </button>
        )}
        {next && (
          <button type="button" onClick={() => onOpen(next)} className={cn(btn, 'bg-nmc text-white shadow-md')}>
            <Crosshair aria-hidden size={18} />
            {t('city.nextDeadline')}
          </button>
        )}
      </div>

      {open && (
        <div id={id} className="max-h-[50vh] space-y-3 overflow-auto rounded-md bg-surface p-3 shadow-md">
          <fieldset>
            <legend className="text-sm font-semibold">{t('city.filter.status')}</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={(filter.status ?? 'all') === s}
                  onClick={() => set({ status: s })}
                  className={cn(
                    'min-h-[var(--touch)] rounded-full border px-3 text-sm',
                    (filter.status ?? 'all') === s ? 'border-nmc bg-nmc text-white' : 'border-line',
                  )}
                >
                  {t(`city.filter.${s}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            {t('city.filter.category')}
            <select
              value={filter.category ?? ''}
              onChange={(e) => set({ category: e.target.value || undefined })}
              className="mt-1 block min-h-[var(--touch)] w-full rounded-md border border-line bg-surface px-2 font-normal"
            >
              <option value="">{t('city.filter.anyCategory')}</option>
              {cats?.map((c) => (
                <option key={c.code} value={c.code}>
                  {nameOf(c, i18n.language)}
                </option>
              ))}
            </select>
          </label>
          {filter.ward_id && (
            <p className="text-sm">
              {t('city.filter.ward', { n: filter.ward_id })}{' '}
              <button type="button" className="underline" onClick={() => set({ ward_id: undefined })}>
                {t('city.filter.anyWard')}
              </button>
            </p>
          )}
          {signedIn && (
            <label className="flex min-h-[var(--touch)] items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={!!filter.mine}
                onChange={(e) => set({ mine: e.target.checked || undefined })}
                className="h-5 w-5 accent-[var(--nmc-green)]"
              />
              {t(staff ? 'city.filter.mineStaff' : 'city.filter.mine')}
            </label>
          )}
          <ul className="divide-y divide-line border-t border-line">
            {sorted.slice(0, 60).map((m) => {
              const s = text(m);
              const [Icon, color] = SLA_STYLE[m.sla] ?? SLA_STYLE.untriaged;
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(m)}
                    className="flex min-h-[var(--touch)] w-full items-center gap-2 py-1 text-left text-sm"
                  >
                    <CategoryIcon name={s.icon} size={18} className="shrink-0 text-nmc" />
                    <span className="min-w-0 flex-1 truncate">
                      {m.ticket ? `${m.ticket} · ` : ''}
                      {s.name} · {t('city.wardN', { n: m.ward_id })}
                    </span>
                    <Icon aria-hidden size={16} style={{ color }} className="shrink-0" />
                    <span className="sr-only">{s.label}</span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="py-2 text-sm text-ink-muted">{t('city.noneShown')}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
