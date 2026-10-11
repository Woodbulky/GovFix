// Complaint pins, ward count bubbles and the selected pin's photo frame, as DOM placed by the Projector.
import { CircleArrowUp } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/CategoryIcon';
import { duration, SLA_STYLE } from '@/components/SlaBadge';
import { usePhotoUrls } from '@/features/citizen/hooks';
import { nameOf, useCategories } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { roadY } from '../gen/terrain';
import { type Cluster, type Marker } from './data';
import { setAnchor, type Anchor } from './anchors';

/** Registers a DOM element at a world point for as long as it is mounted. */
function Anchored({
  id,
  x,
  z,
  lift = 1,
  extra,
  className,
  children,
}: {
  id: string;
  x: number;
  z: number;
  lift?: number;
  extra?: Partial<Anchor>;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const maxDist = extra?.maxDist;
  const worldSize = extra?.worldSize;
  useEffect(() => {
    if (!ref.current) return;
    setAnchor(id, { el: ref.current, x, y: roadY(x, z) + lift, z, maxDist, worldSize });
    return () => setAnchor(id, null);
  }, [id, x, z, lift, maxDist, worldSize]);
  return (
    <div ref={ref} className={cn('absolute left-0 top-0 origin-top-left', className)}>
      {children}
    </div>
  );
}

export function useMarkerText() {
  const { t, i18n } = useTranslation();
  const { data: cats } = useCategories();
  return (m: Marker) => {
    const cat = cats?.find((c) => c.code === m.category);
    const name = cat ? nameOf(cat, i18n.language) : t('city.pin.unknown');
    return {
      icon: cat?.icon ?? undefined,
      name,
      label: [
        m.mine ? t('city.pin.yours') : null,
        m.ticket,
        name,
        t(`state.${m.state}`),
        t(`sla.${m.sla === 'paused' ? 'paused_staff' : m.sla}`),
        m.level ? t(m.level >= 2 ? 'esc.commissioner' : 'esc.deptHead') : null,
        t('city.wardN', { n: m.ward_id }),
        t('city.pin.age', { dur: duration(t, m.ageHours * 3_600_000) }),
      ]
        .filter(Boolean)
        .join(' · '),
    };
  };
}

type PinsProps = {
  markers: Marker[];
  clusters: Cluster[] | null;
  selected: string | null;
  onSelect?: (m: Marker) => void;
  onCluster?: (c: Cluster) => void;
  /** Home hero: decorative, not focusable, pins drop in. */
  decorative?: boolean;
};

export function PinLayer({ markers, clusters, selected, onSelect, onCluster, decorative }: PinsProps) {
  const text = useMarkerText();
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden={decorative || undefined}>
      {clusters
        ? clusters.map((c) => {
            const color = SLA_STYLE[c.worst][1];
            return (
              <Anchored key={`c${c.ward_id}`} id={`c${c.ward_id}`} x={c.x} z={c.z} lift={20}>
                <button
                  type="button"
                  tabIndex={decorative ? -1 : 0}
                  onClick={() => onCluster?.(c)}
                  className="pointer-events-auto flex min-h-[var(--touch)] min-w-[var(--touch)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 bg-surface px-2 font-semibold shadow-lg"
                  style={{ borderColor: color, color }}
                >
                  <span className="tabular text-lg leading-none">{c.count}</span>
                  <span className="sr-only">
                    {t('city.cluster', { n: c.count, ward: t('city.wardN', { n: c.ward_id }), breached: c.breached })}
                  </span>
                  {c.breached > 0 && (
                    <span aria-hidden className="tabular text-xs leading-none">
                      {t('city.clusterPast', { n: c.breached })}
                    </span>
                  )}
                </button>
              </Anchored>
            );
          })
        : markers.map((m, i) => {
            const s = text(m);
            return (
              <Anchored key={m.key} id={m.key} x={m.x} z={m.z} lift={1.5}>
                <Pin
                  m={m}
                  icon={s.icon}
                  label={s.label}
                  name={s.name}
                  selected={selected === m.key}
                  decorative={decorative}
                  delay={decorative ? 300 + i * 40 : 0}
                  onClick={() => onSelect?.(m)}
                />
              </Anchored>
            );
          })}
    </div>
  );
}

function Pin(props: {
  m: Marker;
  icon: string | undefined;
  label: string;
  name: string;
  selected: boolean;
  decorative?: boolean;
  delay: number;
  onClick: () => void;
}) {
  const { m, icon, label, name, selected, decorative, delay, onClick } = props;
  const [SlaIcon, color] = SLA_STYLE[m.sla] ?? SLA_STYLE.untriaged;
  const size = selected ? 52 : 40;
  const ring = m.level >= 2 ? 'var(--sla-breach)' : m.level === 1 ? 'var(--sla-risk)' : null;
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        transform: 'translate(-50%, -100%)',
        animation: decorative ? `city-pin-drop 600ms ${delay}ms ease-out both` : undefined,
      }}
    >
      {selected && !decorative && <PhotoFrame m={m} />}
      <button
        type="button"
        tabIndex={decorative ? -1 : 0}
        aria-label={label}
        aria-pressed={selected}
        title={label}
        onClick={onClick}
        className={cn('relative flex flex-col items-center', !decorative && 'pointer-events-auto')}
      >
        {m.sla === 'breached' && m.state !== 'CLOSED' && (
          <span
            aria-hidden
            className="absolute left-1/2 top-0 -ml-[20px] h-10 w-10 rounded-full"
            style={{ background: color, animation: 'city-pulse 1.6s ease-out infinite' }}
          />
        )}
        <span
          aria-hidden
          className="relative grid place-items-center rounded-full border-[3px] bg-surface shadow-md"
          style={{
            width: size,
            height: size,
            borderColor: color,
            color,
            boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 6px ${ring}` : undefined,
            outline: m.mine ? '3px solid var(--marigold)' : undefined,
            outlineOffset: m.mine ? (ring ? 7 : 2) : undefined,
          }}
        >
          <CategoryIcon name={icon} size={selected ? 26 : 20} />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-surface">
            <SlaIcon size={14} />
          </span>
          {ring && (
            <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-surface">
              <CircleArrowUp size={14} style={{ color: ring }} />
            </span>
          )}
        </span>
        <span aria-hidden className="h-3 w-[3px] rounded-b" style={{ background: color }} />
        {selected && (
          <span aria-hidden className="mt-1 whitespace-nowrap rounded-full bg-canopy px-2.5 py-0.5 text-sm text-white">
            {m.ticket ?? name}
          </span>
        )}
      </button>
    </div>
  );
}

/** Framed photo above the selected pin. Only requests the viewer may see in full carry photos (RLS + signed URLs). */
function PhotoFrame({ m }: { m: Marker }) {
  const { t } = useTranslation();
  const report = m.photos.filter((p) => p.kind === 'report').slice(0, 1);
  const { data } = usePhotoUrls(report.length ? report : undefined);
  const url = data?.[0]?.url;
  if (!url) return null;
  return (
    <figure className="mb-2 rounded-sm border-4 border-[#6b4a2b] bg-surface p-1 shadow-xl">
      <img src={url} alt={t('city.photoOf', { ticket: m.ticket })} className="h-24 w-32 object-cover" />
    </figure>
  );
}

/** Walk mode: within 25 m of a complaint with a photo, it hangs on a notice board at the spot. */
export function NoticeBoard({ m }: { m: Marker }) {
  const { t } = useTranslation();
  const report = m.photos.filter((p) => p.kind === 'report').slice(0, 1);
  const { data } = usePhotoUrls(report.length ? report : undefined);
  const url = data?.[0]?.url;
  if (!url) return null;
  return (
    <Anchored id={`board:${m.key}`} x={m.x} z={m.z} lift={2.6} extra={{ maxDist: 25, worldSize: 6 }}>
      <figure
        className="-translate-x-1/2 -translate-y-full rounded-sm border-[6px] border-[#6b4a2b] bg-[#f3ead8] p-2 shadow-xl"
        style={{ width: 240 }}
      >
        <img src={url} alt={t('city.photoOf', { ticket: m.ticket })} className="h-36 w-full object-cover" />
        <figcaption className="mt-1 text-center text-sm font-semibold text-ink">{m.ticket}</figcaption>
      </figure>
    </Anchored>
  );
}
