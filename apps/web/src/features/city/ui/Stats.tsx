// `?stats` in the URL shows fps, draw calls and triangles, to check the performance budget on the demo laptop.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCity } from '../store';

export const statsProbe = { fps: 0, calls: 0, tris: 0 };

export function Stats() {
  const { t } = useTranslation();
  const quality = useCity((s) => s.quality);
  const on = new URLSearchParams(window.location.search).has('stats');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  return (
    <p className="tabular pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs text-white">
      {t('city.stats', {
        fps: Math.round(statsProbe.fps),
        calls: statsProbe.calls,
        tris: Math.round(statsProbe.tris / 1000),
      })}{' '}
      · q{quality}
    </p>
  );
}
