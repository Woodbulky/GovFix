// Explore Navnagar: full-bleed 3D city with overlays at the corners, or the 2D map when WebGL is off.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { SLA_STYLE } from '@/components/SlaBadge';
import { useAuth } from '@/features/auth/store';
import { useSimNow } from '@/lib/queries';
import { CityMap2D } from './CityMap2D';
import { Fallback, hasWebGL, store, stored, useReducedMotion } from './env';
import { overviewKey } from './controls/keys';
import type { CityData } from './gen/city';
import { loadCity } from './gen/load';
import { applyFilter, breachByWard, type Cluster, clusterByWard, type Marker } from './markers/data';
import { NoticeBoard, PinLayer, useMarkerText } from './markers/PinLayer';
import { useCity } from './store';
import { DAY, sunAt } from './sun';
import { Help, Legend } from './ui/Legend';
import { Minimap } from './ui/Minimap';
import { Complaints } from './ui/Complaints';
import { PinDrawer } from './ui/PinDrawer';
import { Search } from './ui/Search';
import { useCityMarkers } from './useCityData';
import { Toolbar } from './ui/Toolbar';
import { Stats } from './ui/Stats';

const CityCanvas = lazy(() => import('./scene/CityCanvas'));

/** Farther than this (camera to the point it looks at) the overview shows one count bubble per ward. */
const CLUSTER_DISTANCE = 1600;

export function CityExplorer() {
  const { t } = useTranslation();
  const webgl = useMemo(hasWebGL, []);
  const [lite, setLite] = useState(() => stored('city-lite') === '1');
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<CityData | null>(null);
  const [help, setHelp] = useState(() => stored('city-help-seen') !== '1');
  const reducedMotion = useReducedMotion();
  const { mode, locked, layers, announcement, setMode, filter, selected, select, flyTo } = useCity();
  const role = useAuth((s) => s.profile?.role);
  const staff = !!role && role !== 'citizen';
  const { markers, full, ready } = useCityMarkers();
  const shown = useMemo(
    () => (layers.complaints ? applyFilter(markers, filter) : []),
    [markers, filter, layers.complaints],
  );
  const breach = useMemo(() => breachByWard(shown), [shown]);
  const zoomedOut = useCity((s) => s.mode === 'overview' && s.cam.distance > CLUSTER_DISTANCE);
  const clusters = useMemo(() => (zoomedOut ? clusterByWard(shown) : null), [zoomedOut, shown]);
  const sel = selected ? (shown.find((m) => m.key === selected) ?? markers.find((m) => m.key === selected)) : undefined;
  const text = useMarkerText();
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
  useEffect(() => () => select(null), [select]);

  // Role defaults (PRD): an officer starts on their own requests, a Dept Head with the per-ward heat.
  // A filter NIVA already set before opening the city wins.
  const defaulted = useRef(false);
  useEffect(() => {
    if (defaulted.current || !role) return;
    defaulted.current = true;
    const s = useCity.getState();
    if (role === 'officer' && !Object.keys(s.filter).length) s.setFilter({ mine: true });
    if (role === 'dept_head') s.setLayer('heat', true);
  }, [role]);

  const openMarker = useCallback(
    (m: Marker) => {
      flyTo({ x: m.x, z: m.z, distance: 160, label: t('city.showing', { place: text(m).label }) });
      select(m.key);
    },
    [flyTo, select, t, text],
  );
  const openCluster = (c: Cluster) =>
    flyTo({ x: c.x, z: c.z, distance: 650, label: t('city.showing', { place: t('city.wardN', { n: c.ward_id }) }) });

  // /explore?ticket=NMC-2026-000142 opens that request (links from detail pages and NIVA's fly_to).
  const [params, setParams] = useSearchParams();
  const ticket = params.get('ticket');
  useEffect(() => {
    if (!ticket || !ready) return;
    const m = markers.find((x) => x.ticket === ticket);
    if (m) openMarker(m);
    setParams((p) => (p.delete('ticket'), p), { replace: true });
  }, [ticket, ready, markers, openMarker, setParams]);

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
        <Complaints shown={shown} total={markers.length} signedIn={full} staff={staff} onOpen={(m) => select(m.key)} />
        <CityMap2D
          pins={shown.map((m) => ({
            x: m.x,
            z: m.z,
            label: text(m).label,
            color: (SLA_STYLE[m.sla] ?? SLA_STYLE.untriaged)[1],
            onSelect: () => select(m.key),
          }))}
          className="mx-auto h-auto w-full max-w-[880px] rounded-md border border-line"
        />
        {sel && <PinDrawer marker={sel} onClose={() => select(null)} />}
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
        className="absolute inset-0 z-0 focus-visible:outline-offset-[-4px]"
      >
        {data ? (
          <Fallback onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <CityCanvas data={data} sun={sun} reducedMotion={reducedMotion} markers={shown} breach={breach} />
            </Suspense>
          </Fallback>
        ) : (
          <p role="status" className="absolute inset-0 grid place-items-center font-heading text-xl text-canopy">
            {t('city.loading')}
          </p>
        )}
      </div>

      {data && (
        <PinLayer
          markers={shown}
          clusters={clusters}
          selected={selected}
          onSelect={openMarker}
          onCluster={openCluster}
        />
      )}
      {data && mode === 'walk' && <WalkBoards markers={shown} />}

      <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex flex-wrap items-start justify-between gap-2 [&>*]:pointer-events-auto">
        <div className="flex flex-col gap-2">
          <Search markers={shown} onMarker={openMarker} />
          <Complaints shown={shown} total={markers.length} signedIn={full} staff={staff} onOpen={openMarker} />
        </div>
        <Toolbar onLite={() => toggleLite(true)} onHelp={() => setHelp((h) => !h)} />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-30 flex flex-col items-start gap-2 sm:right-auto [&>*]:pointer-events-auto">
        {help ? <Help onClose={closeHelp} /> : <Legend />}
      </div>

      {sel ? (
        <PinDrawer marker={sel} onClose={() => select(null)} />
      ) : (
        <div
          className={`pointer-events-none absolute bottom-4 right-4 z-30 [&>*]:pointer-events-auto ${help ? 'hidden sm:block' : ''}`}
        >
          <Minimap />
        </div>
      )}

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

/** Walk mode: the nearest complaint with a photo within 25 m hangs it on a notice board at the spot. */
function WalkBoards({ markers }: { markers: Marker[] }) {
  const withPhotos = useMemo(() => markers.filter((m) => m.photos.some((p) => p.kind === 'report')), [markers]);
  const near = useCity((s) => {
    let best: string | null = null;
    let bestD = 25;
    for (const m of withPhotos) {
      const d = Math.hypot(m.x - s.cam.x, m.z - s.cam.z);
      if (d < bestD) {
        bestD = d;
        best = m.key;
      }
    }
    return best;
  });
  const m = withPhotos.find((x) => x.key === near);
  return m ? <NoticeBoard m={m} /> : null;
}
