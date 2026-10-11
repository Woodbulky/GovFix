// Home hero backdrop: the live city slowly circling, open complaints as anonymous pins (public_markers()).
// A plain canopy poster until the scene is ready, and for good when WebGL is off or Lite mode is on.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSimNow } from '@/lib/queries';
import { Fallback, hasWebGL, stored, useReducedMotion } from './env';
import type { CityData } from './gen/city';
import { loadCity } from './gen/load';
import { isOpen } from './markers/data';
import { PinLayer } from './markers/PinLayer';
import { sunAt } from './sun';
import { usePublicMarkers } from './useCityData';

const CityCanvas = lazy(() => import('./scene/CityCanvas'));

export function CityHero() {
  const enabled = useMemo(() => hasWebGL() && stored('city-lite') !== '1', []);
  const [data, setData] = useState<CityData | null>(null);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const { data: markers } = usePublicMarkers(enabled);
  const open = useMemo(() => (markers ?? []).filter(isOpen), [markers]);
  const minute = Math.floor(useSimNow().getTime() / 60_000);
  const sun = useMemo(() => sunAt(new Date(minute * 60_000)), [minute]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadCity().then(
      (d) => alive && setData(d),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [enabled]);

  if (!enabled || failed || !data) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Fallback onError={() => setFailed(true)}>
        <Suspense fallback={null}>
          <CityCanvas data={data} sun={sun} reducedMotion={reducedMotion} variant="hero" markers={open} />
        </Suspense>
      </Fallback>
      <PinLayer markers={open} clusters={null} selected={null} decorative />
    </div>
  );
}
