// Top-left search: tickets the viewer may see, landmarks (names and aliases in every script) and wards.
import { Search as SearchIcon } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { centroid } from '../gen/geom';
import { city, wardAt } from '../gen/layout';
import type { Marker } from '../markers/data';
import { useCity } from '../store';

type Hit = {
  id: string;
  label: string;
  sub: string;
  keys: string[];
  x: number;
  z: number;
  distance: number;
  marker?: Marker;
};

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

export function Search({ markers = [], onMarker }: { markers?: Marker[]; onMarker?: (m: Marker) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';
  const flyTo = useCity((s) => s.flyTo);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const all = useMemo<Hit[]>(() => {
    const ward = (n: number) => city.wards.find((w) => w.id === n);
    return [
      ...markers
        .filter((m) => m.ticket)
        .map((m) => ({
          id: `t${m.key}`,
          label: m.ticket!,
          sub: `${t(`state.${m.state}`)} · ${t('city.wardN', { n: m.ward_id })}`,
          // "142", "000142" and the full ticket all match.
          keys: [norm(m.ticket!), m.ticket!.slice(-6), String(Number(m.ticket!.slice(-6)))],
          x: m.x,
          z: m.z,
          distance: 160,
          marker: m,
        })),
      ...city.landmarks.map((l, i) => {
        const w = wardAt(l.x, l.z);
        return {
          id: `l${i}`,
          label: l.name[lang] ?? l.name.en,
          sub: w ? `${t('city.wardN', { n: w.id })} · ${w.name[lang]}` : '',
          keys: [l.name.en, l.name.hi, l.name.mr, ...l.aliases].map(norm),
          x: l.x,
          z: l.z,
          distance: 240,
        };
      }),
      ...city.wards.map((w) => {
        const [x, z] = centroid(ward(w.id)!.polygon);
        return {
          id: `w${w.id}`,
          label: `${t('city.wardN', { n: w.id })} · ${w.name[lang]}`,
          sub: '',
          keys: [`ward ${w.id}`, `${w.id}`, `वार्ड ${w.id}`, `प्रभाग ${w.id}`, w.name.en, w.name.hi, w.name.mr].map(
            norm,
          ),
          x,
          z,
          distance: 1100,
        };
      }),
    ];
  }, [lang, t, markers]);

  const query = norm(q);
  const hits = query
    ? all
        .filter((h) => h.keys.some((k) => k.includes(query)))
        .sort(
          (a, b) => Number(!b.keys.some((k) => k.startsWith(query))) - Number(!a.keys.some((k) => k.startsWith(query))),
        )
        .slice(0, 8)
    : [];

  const go = (h: Hit) => {
    if (h.marker && onMarker) {
      onMarker(h.marker);
      setQ(h.label);
      setOpen(false);
      return;
    }
    flyTo({ x: h.x, z: h.z, distance: h.distance, label: t('city.showing', { place: h.label }) });
    setQ(h.label);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-[min(320px,calc(100vw-2rem))]">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t('city.searchLabel')}
      </label>
      <SearchIcon
        aria-hidden
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && !!query}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${hits[active].id}` : undefined}
        value={q}
        placeholder={t('city.searchPlaceholder')}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        className="min-h-[var(--touch)] w-full rounded-md border border-line bg-surface pl-10 pr-3 shadow-md"
      />
      {open && query && (
        <ul
          id={listId}
          role="listbox"
          className="absolute mt-1 max-h-80 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {hits.length === 0 && <li className="px-3 py-2 text-ink-muted">{t('city.searchNone')}</li>}
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${h.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(h)}
              className={`flex min-h-[var(--touch)] cursor-pointer flex-col justify-center px-3 ${i === active ? 'bg-nmc text-white' : ''}`}
            >
              <span className="font-semibold">{h.label}</span>
              {h.sub && <span className={`text-sm ${i === active ? 'text-white/85' : 'text-ink-muted'}`}>{h.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
