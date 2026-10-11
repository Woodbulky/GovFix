// The WebGL scene: lazy-loaded with the explorer route so three.js never weighs on other pages.
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FirstPerson, CamTracker } from '../controls/FirstPerson';
import { HOME, Overview } from '../controls/Overview';
import type { CityData } from '../gen/city';
import { Grid } from '../gen/grid';
import { useCity } from '../store';
import { statsProbe } from '../ui/Stats';
import type { Sun } from '../sun';
import { CityMeshes } from './CityMeshes';
import { Labels } from './Labels';
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

type Props = { data: CityData; sun: Sun; reducedMotion: boolean };

export default function CityCanvas({ data, sun, reducedMotion }: Props) {
  const { mode, layers, quality, setQuality } = useCity();
  const homed = useRef(false);
  const grid = useMemo(() => new Grid(data.grid), [data]);
  const traffic = layers.traffic && !reducedMotion && quality < 2;
  const animating = traffic || mode !== 'overview';

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
      <CityMeshes data={data} showWards={layers.wards} />
      <Traffic routes={data.routes} animate={traffic} />
      {layers.labels && <Labels />}
      {mode === 'overview' ? (
        <Overview reducedMotion={reducedMotion} homed={homed} />
      ) : (
        <FirstPerson mode={mode} grid={grid} />
      )}
      <CamTracker />
      <Stats />
    </Canvas>
  );
}
