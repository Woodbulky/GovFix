// The problem itself, standing in the street while the request is open: a leak with spray, a garbage pile,
// a pothole, an overflowing drain, two stray dogs, a dark streetlight. Gone once RESOLVED or CLOSED.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { freeSpot, walkGround } from '../controls/walk';
import type { Grid } from '../gen/grid';
import { rng } from '../gen/prng';
import { geometries } from '../scene/geometries';
import { type Marker, showsProp } from './data';

const PROPS = new Set(['water_leak', 'garbage_not_collected', 'pothole', 'drainage_overflow', 'stray_animals']);

/** One vertex-coloured geometry, so each prop is a single draw call. */
function paint(g: THREE.BufferGeometry, hex: string) {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  n.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      Array.from({ length: n.attributes.position.count }, () => [c.r, c.g, c.b]).flat(),
      3,
    ),
  );
  return n;
}

function blob(seed: string, r: number, hex: string, points = 10) {
  const rand = rng('props', seed);
  const shape = new THREE.Shape();
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * rand.range(0.75, 1.15);
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return paint(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), hex);
}

function dog(hex: string) {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
  return mergeGeometries([
    box(0.9, 0.32, 0.3, 0, 0.55, 0), // body
    box(0.3, 0.28, 0.26, 0.55, 0.78, 0), // head
    box(0.16, 0.1, 0.14, 0.75, 0.74, 0), // snout
    box(0.3, 0.06, 0.06, -0.55, 0.72, 0).rotateZ(0.5), // tail
    ...[-0.32, 0.32].flatMap((x) => [-0.1, 0.1].map((z) => box(0.08, 0.42, 0.08, x, 0.21, z))),
  ])!;
}

let cache: ReturnType<typeof build> | null = null;
function build() {
  const rand = rng('props', 'garbage');
  const bits = Array.from({ length: 9 }, (_, i) => {
    const r = rand.range(0.35, 0.75);
    const g = i % 3 === 2 ? new THREE.BoxGeometry(r * 1.4, r, r) : new THREE.DodecahedronGeometry(r, 0);
    return paint(
      g.rotateY(rand.range(0, 3)).translate(rand.range(-1.3, 1.3), r * 0.6, rand.range(-0.9, 0.9)),
      ['#4d5b3a', '#2f3b46', '#6b5a3e', '#8a8577', '#3b4a2c', '#b9b29f'][i % 6],
    );
  });
  return {
    material: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    }),
    wet: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.08,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    }),
    darkLamp: new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.7 }),
    garbage: mergeGeometries([blob('garbage-stain', 2.2, '#4a4130'), ...bits])!,
    puddle: blob('puddle', 2.4, '#3d6f8a', 12),
    pothole: mergeGeometries([
      blob('pothole-rim', 1.5, '#5a5752', 9),
      blob('pothole', 1.15, '#151515', 9).translate(0, 0.02, 0),
    ])!,
    drain: mergeGeometries([
      blob('drain', 3, '#2d2a1f', 12),
      paint(new THREE.BoxGeometry(1, 0.08, 0.6).translate(0, 0.04, 0), '#4b4b48'),
    ])!,
    ripple: new THREE.RingGeometry(0.6, 0.75, 24).rotateX(-Math.PI / 2),
    rippleMat: new THREE.MeshBasicMaterial({ color: '#b8c4c9', transparent: true, opacity: 0.6, depthWrite: false }),
    dogs: mergeGeometries([dog('#8b6a43'), dog('#c9b28a').rotateY(2.4).translate(1.4, 0, 0.9)])!,
    spray: new THREE.PointsMaterial({
      color: '#cfe9f5',
      size: 0.22,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  };
}
const assets = () => (cache ??= build());

type Placed = { m: Marker; x: number; y: number; z: number; rot: number };

/** Streetlights (worker layout: x, y, z, rotY per light) darkened by an open streetlight_out complaint. */
export function darkLightsFor(markers: Marker[], lights: Float32Array): number[] {
  const out: number[] = [];
  for (const m of markers) {
    if (m.category !== 'streetlight_out' || !showsProp(m)) continue;
    let best = -1;
    let bestD = 60 * 60;
    for (let i = 0; i < lights.length; i += 4) {
      const d = (lights[i] - m.x) ** 2 + (lights[i + 2] - m.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i / 4;
      }
    }
    if (best >= 0) out.push(best);
  }
  return out;
}

export function IssueProps({
  markers,
  grid,
  lights,
  dark,
  animate,
}: {
  markers: Marker[];
  grid: Grid;
  lights: Float32Array;
  dark: number[];
  animate: boolean;
}) {
  const a = assets();
  const placed = useMemo<Placed[]>(
    () =>
      markers
        .filter((m) => m.category && PROPS.has(m.category) && showsProp(m))
        .map((m) => {
          const [x, z] = freeSpot(grid, m.x, m.z);
          const r = rng('props', m.key);
          return { m, x, y: walkGround(grid, x, z), z, rot: r.range(0, Math.PI * 2) };
        }),
    [markers, grid],
  );

  return (
    <group>
      {placed.map((p) => {
        const common = {
          position: [p.x, p.y + 0.05, p.z] as [number, number, number],
          rotation: [0, p.rot, 0] as [number, number, number],
        };
        switch (p.m.category) {
          case 'water_leak':
            return (
              <group key={p.m.key} {...common}>
                <mesh geometry={a.puddle} material={a.wet} receiveShadow />
                <Spray animate={animate} />
              </group>
            );
          case 'garbage_not_collected':
            return (
              <mesh key={p.m.key} {...common} geometry={a.garbage} material={a.material} castShadow receiveShadow />
            );
          case 'pothole':
            return <mesh key={p.m.key} {...common} geometry={a.pothole} material={a.material} receiveShadow />;
          case 'drainage_overflow':
            return (
              <group key={p.m.key} {...common}>
                <mesh geometry={a.drain} material={a.wet} receiveShadow />
                <Ripple animate={animate} />
              </group>
            );
          case 'stray_animals':
            return <mesh key={p.m.key} {...common} geometry={a.dogs} material={a.material} castShadow />;
          default:
            return null;
        }
      })}
      {dark.map((i) => (
        <mesh
          key={`lamp${i}`}
          geometry={geometries().lamp}
          material={a.darkLamp}
          position={[lights[i * 4], lights[i * 4 + 1], lights[i * 4 + 2]]}
          rotation={[0, lights[i * 4 + 3], 0]}
        />
      ))}
    </group>
  );
}

const N = 28;
function Spray({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const seeds = useMemo(
    () => Array.from({ length: N }, (_, i) => [((i * 137.5) % 360) * (Math.PI / 180), (i / N) % 1]),
    [],
  );
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  const place = (time: number) => {
    const pos = geom.attributes.position as THREE.BufferAttribute;
    seeds.forEach(([ang, ph], i) => {
      const t = (time * 0.9 + ph) % 1;
      const r = t * 0.9;
      pos.setXYZ(i, Math.cos(ang) * r, 0.2 + 2.4 * t - 2.6 * t * t, Math.sin(ang) * r);
    });
    pos.needsUpdate = true;
  };
  useMemo(() => place(0.37), []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => animate && place(clock.elapsedTime));
  return <points ref={ref} geometry={geom} material={assets().spray} />;
}

function Ripple({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(() => assets().rippleMat.clone(), []);
  useFrame(({ clock }) => {
    if (!animate || !ref.current) return;
    const t = (clock.elapsedTime * 0.5) % 1;
    ref.current.scale.setScalar(0.6 + t * 2.4);
    material.opacity = 0.6 * (1 - t);
  });
  return <mesh ref={ref} geometry={assets().ripple} material={material} position={[0.3, 0.03, 0.2]} scale={1.4} />;
}
