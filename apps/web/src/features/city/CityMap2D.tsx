import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Pt } from './gen/geom';
import { city } from './gen/layout';

const { minX, maxX, minZ, maxZ } = city.bounds;
const PARK: Record<string, string> = { garden: '#cfe3c0', ground: '#e8dcc4', forest: '#b9d1a6' };

const centre = (poly: Pt[]) => poly.reduce(([ax, az], [x, z]) => [ax + x / poly.length, az + z / poly.length], [0, 0]);

export type MapPin = { x: number; z: number; label?: string; color?: string; onSelect?: () => void };

type Props = {
  /** Called with city metres (x east, z south) when the user clicks the map. */
  onPick?: (x: number, z: number) => void;
  pins?: MapPin[];
  /** Ward id -> breach fill opacity (0-1); pair it with a text list, never colour alone. */
  tint?: Record<number, number>;
  className?: string;
};

/**
 * SVG Navnagar from the same layout JSON as the 3D city and the database (+z south = SVG down).
 * The WebGL-off fallback and, until P8, the location picker.
 */
export function CityMap2D({ onPick, pins = [], tint = {}, className }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const m = svg.getScreenCTM();
    if (!onPick || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    onPick(Math.round(p.x), Math.round(p.y));
  };

  return (
    <svg
      viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`}
      onClick={click}
      role={pins.some((p) => p.onSelect) ? 'group' : 'img'}
      aria-label={t('map.label')}
      className={className}
      style={{ cursor: onPick ? 'crosshair' : undefined, background: 'var(--paper)', overflow: 'hidden' }}
    >
      {city.wards.map((w) => (
        <g key={w.id}>
          <polygon points={w.polygon.join(' ')} fill="var(--surface)" stroke="var(--line)" strokeWidth={8} />
          {tint[w.id] && <polygon points={w.polygon.join(' ')} fill="var(--sla-breach)" fillOpacity={tint[w.id]} />}
        </g>
      ))}
      {city.parks.map((p) => (
        <polygon key={p.name} points={p.polygon.join(' ')} fill={PARK[p.kind]} />
      ))}
      <polygon points={city.lake.polygon.join(' ')} fill="var(--river)" fillOpacity={0.5} />
      {city.roads.map((r) => (
        <polyline
          key={r.name}
          points={r.points.join(' ')}
          fill="none"
          stroke="#b9b4a8"
          strokeWidth={r.type === 'arterial' ? 24 : r.type === 'main' ? 14 : 8}
          strokeLinejoin="round"
        />
      ))}
      <polyline
        points={city.river.points.join(' ')}
        fill="none"
        stroke="var(--river)"
        strokeOpacity={0.5}
        strokeWidth={city.river.width}
      />
      <polyline
        points={city.railway.points.join(' ')}
        fill="none"
        stroke="#4a4644"
        strokeWidth={8}
        strokeDasharray="30 20"
      />
      {city.wards.map((w) => {
        const [x, z] = centre(w.polygon);
        return (
          <text key={w.id} x={x} y={z + 90} textAnchor="middle" fontSize={60} fill="var(--ink-muted)">
            {w.id} · {w.name[lang] ?? w.name.en}
          </text>
        );
      })}
      {city.landmarks.map((l) => (
        <g key={l.name.en}>
          <circle cx={l.x} cy={l.z} r={14} fill="var(--nmc-green-600)" />
          <text x={l.x + 18} y={l.z + 10} fontSize={40} fill="var(--ink)">
            {l.name[lang] ?? l.name.en}
          </text>
        </g>
      ))}
      {pins.map((p, i) => (
        <g
          key={i}
          transform={`translate(${p.x} ${p.z})`}
          role={p.onSelect ? 'button' : undefined}
          tabIndex={p.onSelect ? 0 : undefined}
          aria-label={p.onSelect ? p.label : undefined}
          onClick={(e) => {
            if (!p.onSelect) return;
            e.stopPropagation();
            p.onSelect();
          }}
          onKeyDown={(e) => {
            if (p.onSelect && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              p.onSelect();
            }
          }}
          style={{ cursor: p.onSelect ? 'pointer' : undefined }}
        >
          <path
            d="M0 0 L-28 -60 A32 32 0 1 1 28 -60 Z"
            fill={p.color ?? 'var(--marigold)'}
            stroke="var(--canopy)"
            strokeWidth={6}
          />
          <circle cy={-78} r={11} fill="var(--canopy)" />
          {p.label && <title>{p.label}</title>}
        </g>
      ))}
    </svg>
  );
}
