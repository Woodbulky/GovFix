// The WebGL scene: lazy-loaded with the explorer route so three.js never weighs on other pages.
// One canvas, three uses: the explorer, the home hero (slow orbit, no controls) and the report location picker.
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FirstPerson, CamTracker } from '../controls/FirstPerson';
import { HOME, Overview } from '../controls/Overview';
import type { CityData } from '../gen/city';
import { Grid } from '../gen/grid';
import type { Marker } from '../markers/data';
import { HeatLayer } from '../markers/HeatLayer';
import { darkLightsFor, IssueProps } from '../markers/IssueProps';
import { Projector } from './Projector';
import { useCity } from '../store';
import { statsProbe } from '../ui/Stats';
import type { Sun } from '../sun';
import { CityMeshes } from './CityMeshes';
import { Labels } from './Labels';
import { PickerPin, type PickerProps } from './PickerPin';
import { SkyAndLight } from './SkyAndLight';
import { Traffic } from './Traffic';

/** Feeds the `?stats` overlay (performance budget check, docs/CITY.md). */
function Stats() {
  const gl = useThree((s) => s.gl);
  useFrame((_, delta) => {
    statsProbe.fps = statsProbe.fps * 0.95 + (1 / Math.max(delta, 1e-3)) * 0.05;
    statsProbe.calls = gl.info.render.calls;
    statsProbe.tris = gl.info.render.triangles;
  });
  return null;
}

/** Home hero: the camera eases in from high up, then circles the centre slowly. Still under reduced motion. */
function HeroCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const at = (t: number) => {
    const ease = 1 - Math.pow(1 - Math.min(1, t / 3.5), 3);
    const r = 2300 - 1000 * ease;
    const a = 0.65 + t * 0.025;
    return [Math.sin(a) * r, 1150 - 520 * ease, Math.cos(a) * r] as const;
  };
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  // Wide screens: frame the city to the right of the headline card (pins included: they use the same projection).
  useEffect(() => {
    if (size.width >= 640) camera.setViewOffset(size.width, size.height, -size.width * 0.3, 0, size.width, size.height);
    else camera.clearViewOffset();
    return () => camera.clearViewOffset();
  }, [camera, size]);
  useMemo(() => {
    camera.position.set(...at(reducedMotion ? 3.5 : 0));
    camera.lookAt(0, 0, -60);
    // Set once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    camera.position.set(...at(clock.elapsedTime));
    camera.lookAt(0, 0, -60);
  });
  return null;
}

type Props = {
  data: CityData;
  sun: Sun;
  reducedMotion: boolean;
  variant?: 'explore' | 'hero' | 'picker';
  /** Pins and props to show (already filtered). */
  markers?: Marker[];
  /** Past-deadline counts per ward for the heat layer. */
  breach?: Record<number, number>;
  picker?: PickerProps;
};

export default function CityCanvas({
  data,
  sun,
  reducedMotion,
  variant = 'explore',
  markers = [],
  breach = {},
  picker,
}: Props) {
  const { mode: storeMode, layers, quality, setQuality } = useCity();
  const mode = variant === 'explore' ? storeMode : 'overview';
  const homed = useRef(false);
  const grid = useMemo(() => new Grid(data.grid), [data]);
  const traffic = layers.traffic && !reducedMotion && quality < 2;
  const animating = traffic || mode !== 'overview' || (variant === 'hero' && !reducedMotion);
  const showProps = layers.props && variant !== 'picker';
  const dark = useMemo(
    () => (showProps ? darkLightsFor(markers, data.instances.lights) : []),
    [showProps, markers, data],
  );

  return (
    <Canvas
      shadows
      dpr={quality >= 3 ? 1 : [1, 1.5]}
      frameloop={animating ? 'always' : 'demand'}
      camera={{ fov: 50, near: 1, far: 9000, position: [...HOME.pos] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
    >
      <PerformanceMonitor onDecline={() => setQuality(Math.min(3, useCity.getState().quality + 1))} flipflops={3} />
      <SkyAndLight sun={sun} shadows={quality === 0} />
      {variant === 'picker' && picker ? (
        <PickerPin {...picker}>
          <CityMeshes data={data} showWards={layers.wards} />
        </PickerPin>
      ) : (
        <CityMeshes data={data} showWards={layers.wards} darkLights={dark} />
      )}
      <Traffic routes={data.routes} animate={traffic} />
      {showProps && (
        <IssueProps
          markers={markers}
          grid={grid}
          lights={data.instances.lights}
          dark={dark}
          animate={animating && !reducedMotion}
        />
      )}
      {layers.heat && variant === 'explore' && <HeatLayer breach={breach} />}
      {layers.labels && variant !== 'hero' && <Labels breach={layers.heat ? breach : undefined} />}
      {variant === 'hero' ? (
        <HeroCamera reducedMotion={reducedMotion} />
      ) : mode === 'overview' ? (
        <Overview reducedMotion={reducedMotion} homed={homed} />
      ) : (
        <FirstPerson mode={mode} grid={grid} />
      )}
      {variant === 'explore' && <CamTracker />}
      <Projector />
      <Stats />
    </Canvas>
  );
}
