// Bottom-right 2D minimap: wards, river, railway, main roads, and where the camera is.
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { city, wardAt } from '../gen/layout';
import { useCity } from '../store';

const { minX, maxX, minZ, maxZ } = city.bounds;
const majors = city.roads.filter((r) => r.type !== 'lane');

export function Minimap() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';
  const cam = useCity((s) => s.cam);
  const flyTo = useCity((s) => s.flyTo);
  const ward = wardAt(cam.x, cam.z);

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const w = wardAt(p.x, p.y);
    flyTo({ x: p.x, z: p.y, distance: 450, label: t('city.showing', { place: w ? w.name[lang] : t('city.outside') }) });
  };

  const deg = (cam.heading * 180) / Math.PI;
  return (
    <figure className="rounded-md bg-surface p-2 shadow-md">
      <svg
        viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`}
        onClick={click}
        role="img"
        aria-label={t('city.minimap')}
        className="block h-36 w-36 cursor-crosshair sm:h-44 sm:w-44"
      >
        {city.wards.map((w) => (
          <polygon
            key={w.id}
            points={w.polygon.join(' ')}
            fill={w.id === ward?.id ? '#e3efe8' : '#f4f7f4'}
            stroke="#9fb3a8"
            strokeWidth={10}
          />
        ))}
        <polygon points={city.lake.polygon.join(' ')} fill="var(--river)" opacity={0.7} />
        {majors.map((r) => (
          <polyline
            key={r.name}
            points={r.points.join(' ')}
            fill="none"
            stroke="#8a8a84"
            strokeWidth={r.type === 'arterial' ? 22 : 12}
          />
        ))}
        <polyline
          points={city.river.points.join(' ')}
          fill="none"
          stroke="var(--river)"
          strokeWidth={city.river.width}
        />
        <polyline
          points={city.railway.points.join(' ')}
          fill="none"
          stroke="#4a4644"
          strokeWidth={10}
          strokeDasharray="40 25"
        />
        <g transform={`translate(${cam.x} ${cam.z}) rotate(${deg})`}>
          <path d="M0 -90 L55 60 L0 30 L-55 60 Z" fill="var(--marigold)" stroke="var(--canopy)" strokeWidth={14} />
        </g>
      </svg>
      <figcaption className="mt-1 max-w-36 text-sm font-semibold sm:max-w-44" aria-live="polite">
        {ward
          ? t('city.youAreIn', { ward: `${t('city.wardN', { n: ward.id })} · ${ward.name[lang]}` })
          : t('city.outside')}
      </figcaption>
    </figure>
  );
}
