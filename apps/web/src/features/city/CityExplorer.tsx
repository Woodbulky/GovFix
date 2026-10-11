// Explore Navnagar: full-bleed 3D city with overlays at the corners, or the 2D map when WebGL is off.
import { Component, lazy, Suspense, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimNow } from '@/lib/queries';
import { CityMap2D } from './CityMap2D';
import { overviewKey } from './controls/keys';
import type { CityData } from './gen/city';
import { loadCity } from './gen/load';
import { useCity } from './store';
import { DAY, sunAt } from './sun';
import { Help, Legend } from './ui/Legend';
import { Minimap } from './ui/Minimap';
import { Search } from './ui/Search';
import { Toolbar } from './ui/Toolbar';
import { Stats } from './ui/Stats';

const CityCanvas = lazy(() => import('./scene/CityCanvas'));

const stored = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: not remembered */
  }
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** WebGL context loss or a shader error drops to the 2D map instead of a blank page. */
class Fallback extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function CityExplorer() {
  const { t } = useTranslation();
  const webgl = useMemo(hasWebGL, []);
  const [lite, setLite] = useState(() => stored('city-lite') === '1');
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<CityData | null>(null);
  const [help, setHelp] = useState(() => stored('city-help-seen') !== '1');
  const reducedMotion = useReducedMotion();
  const { mode, locked, layers, announcement, setMode } = useCity();
  const simNow = useSimNow();
  const minute = Math.floor(simNow.getTime() / 60_000);
  const sun = useMemo(() => (layers.followSim ? sunAt(new Date(minute * 60_000)) : DAY), [minute, layers.followSim]);
  const use3d = webgl && !lite && !failed;

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

  // Leaving the page always returns to overview, so the next visit starts on the map.
  useEffect(() => () => setMode('overview'), [setMode]);

  const toggleLite = (on: boolean) => {
    setLite(on);
    store('city-lite', on ? '1' : '0');
  };
  const closeHelp = () => {
    setHelp(false);
    store('city-help-seen', '1');
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (mode === 'overview' && e.target === e.currentTarget && overviewKey(e.key, e.shiftKey)) e.preventDefault();
  };

  if (!use3d) {
    return (
      <div className="absolute inset-0 flex flex-col gap-3 overflow-auto bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl">{t('nav.explore')}</h1>
          {webgl && (
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                toggleLite(false);
              }}
              className="inline-flex min-h-[var(--touch)] items-center rounded-md bg-nmc px-4 font-semibold text-white"
            >
              {t('city.full')}
            </button>
          )}
        </div>
        {(!webgl || failed) && <p className="text-ink-muted">{t(webgl ? 'city.loadFailed' : 'city.noWebgl')}</p>}
        <CityMap2D className="mx-auto h-auto w-full max-w-[880px] rounded-md border border-line" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#c9d6d3]">
      <h1 className="sr-only">{t('nav.explore')}</h1>
      <div
        id="city-canvas"
        role="application"
        aria-label={t('city.canvasLabel')}
        tabIndex={0}
        onKeyDown={onKey}
        className="absolute inset-0 focus-visible:outline-offset-[-4px]"
      >
        {data ? (
          <Fallback onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <CityCanvas data={data} sun={sun} reducedMotion={reducedMotion} />
            </Suspense>
          </Fallback>
        ) : (
          <p role="status" className="absolute inset-0 grid place-items-center font-heading text-xl text-canopy">
            {t('city.loading')}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex flex-wrap items-start justify-between gap-2 [&>*]:pointer-events-auto">
        <Search />
        <Toolbar onLite={() => toggleLite(true)} onHelp={() => setHelp((h) => !h)} />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-30 flex flex-col items-start gap-2 sm:right-auto [&>*]:pointer-events-auto">
        {help ? <Help onClose={closeHelp} /> : <Legend />}
      </div>

      <div
        className={`pointer-events-none absolute bottom-4 right-4 z-30 [&>*]:pointer-events-auto ${help ? 'hidden sm:block' : ''}`}
      >
        <Minimap />
      </div>

      {mode !== 'overview' && !locked && (
        <p className="pointer-events-none absolute bottom-24 left-1/2 z-30 w-[min(520px,calc(100%-2rem))] -translate-x-1/2 rounded-md bg-canopy px-4 py-2 text-center text-sm text-white sm:bottom-6">
          {t('city.lockHint')}
          <br />
          {t('city.keysHint')}
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <Stats />
    </div>
  );
}
