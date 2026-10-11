// Report location picker: the 3D city with a crosshair (click to drop the pin, drag it to adjust), or the
// 2D map when WebGL is off, failed, or the citizen prefers it. Both return city metres to `onPick`.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CityMap2D } from './CityMap2D';
import { Fallback, hasWebGL, store, stored, useReducedMotion } from './env';
import type { CityData } from './gen/city';
import { loadCity } from './gen/load';
import { useCity } from './store';
import { DAY } from './sun';

const CityCanvas = lazy(() => import('./scene/CityCanvas'));

type Props = {
  pin: { x: number; z: number } | null;
  label?: string;
  onPick: (x: number, z: number) => void;
};

export function CityPicker({ pin, label, onPick }: Props) {
  const { t } = useTranslation();
  const webgl = useMemo(hasWebGL, []);
  const [flat, setFlat] = useState(() => stored('city-lite') === '1');
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<CityData | null>(null);
  const reducedMotion = useReducedMotion();
  const use3d = webgl && !flat && !failed;

  // Start on the current pin (or the whole city), not wherever the explorer last flew.
  useState(() =>
    useCity.setState({ flyTarget: pin ? { ...pin, distance: 420, label: label ?? '', nonce: Date.now() } : null }),
  );

  useEffect(() => {
    if (!use3d) return;
    let alive = true;
    loadCity().then(
      (d) => alive && setData(d),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [use3d]);

  const toggle = (on: boolean) => {
    setFlat(on);
    store('city-lite', on ? '1' : '0');
  };
  const switchBtn = 'min-h-[var(--touch)] text-sm font-semibold text-nmc underline underline-offset-2';

  if (!use3d)
    return (
      <div className="space-y-2">
        <CityMap2D
          onPick={onPick}
          pins={pin ? [{ ...pin, label }] : []}
          className="aspect-square w-full max-w-[560px] rounded-lg border border-line"
        />
        {webgl && (
          <button
            type="button"
            className={switchBtn}
            onClick={() => {
              setFailed(false);
              toggle(false);
            }}
          >
            {t('city.picker.use3d')}
          </button>
        )}
      </div>
    );

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-[4/3] w-full max-w-[720px] overflow-hidden rounded-lg border border-line bg-[#c9d6d3]"
        style={{ cursor: 'crosshair' }}
        role="application"
        aria-label={t('city.picker.label')}
      >
        {data ? (
          <Fallback onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <CityCanvas
                data={data}
                sun={DAY}
                reducedMotion={reducedMotion}
                variant="picker"
                picker={{ pin, onPick }}
              />
            </Suspense>
          </Fallback>
        ) : (
          <p role="status" className="absolute inset-0 grid place-items-center font-heading text-lg text-canopy">
            {t('city.loading')}
          </p>
        )}
        <p className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-canopy px-3 py-1.5 text-center text-sm text-white">
          {t(pin ? 'city.picker.drag' : 'city.picker.hint')}
        </p>
      </div>
      <button type="button" className={switchBtn} onClick={() => toggle(true)}>
        {t('city.picker.use2d')}
      </button>
    </div>
  );
}
