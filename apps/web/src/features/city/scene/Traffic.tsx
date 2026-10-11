// Auto-rickshaws, cars and ST buses on looped routes (left-hand traffic), birds over the river, water ripples.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Route } from '../gen/city';
import { city } from '../gen/layout';
import { rng } from '../gen/prng';
import { materials } from './materials';

type Kind = 'auto' | 'car' | 'bus';
const SIZE: Record<Kind, [number, number, number]> = { auto: [2.7, 1.5, 1.4], car: [4.2, 1.4, 1.8], bus: [11, 3, 2.5] };
const SPEED: Record<Kind, [number, number]> = { auto: [7, 10], car: [9, 13], bus: [7, 9] };
const COLORS: Record<Kind, string[]> = {
  auto: ['#2e7d32', '#3a8f3a', '#e0b100'],
  car: ['#f4f4f2', '#c0c4c8', '#2b3a55', '#8c1d1d', '#d9d4c7', '#3d3f42'],
  bus: ['#b23a3a', '#c4462f'],
};

type Vehicle = { kind: Kind; route: number; s: number; v: number; dir: 1 | -1 };

/** Cumulative lengths for a route polyline (x, y, z triples). */
function lengths(pts: Float32Array) {
  const out = new Float32Array(pts.length / 3);
  for (let i = 1; i < out.length; i++) {
    out[i] = out[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 2] - pts[i * 3 - 1]);
  }
  return out;
}

const dummy = new THREE.Object3D();

export function Traffic({ routes, animate }: { routes: Route[]; animate: boolean }) {
  const sim = useMemo(() => {
    const r = rng(city.seed, 'traffic');
    const lens = routes.map((x) => lengths(x.pts));
    const vehicles: Vehicle[] = [];
    routes.forEach((route, i) => {
      const total = lens[i][lens[i].length - 1];
      const n = Math.floor(total / (route.type === 'arterial' ? 95 : 160));
      for (let k = 0; k < n; k++) {
        const kind: Kind = route.type === 'arterial' && r.chance(0.12) ? 'bus' : r.chance(0.55) ? 'auto' : 'car';
        vehicles.push({
          kind,
          route: i,
          s: r.range(0, total),
          v: r.range(...SPEED[kind]),
          dir: r.chance(0.5) ? 1 : -1,
        });
      }
    });
    const meshes = {} as Record<Kind, THREE.InstancedMesh>;
    for (const kind of ['auto', 'car', 'bus'] as Kind[]) {
      const list = vehicles.filter((v) => v.kind === kind);
      const [l, h, w] = SIZE[kind];
      const geo = new THREE.BoxGeometry(l, h, w).translate(0, h / 2 + 0.3, 0);
      const mesh = new THREE.InstancedMesh(geo, materials().plain, Math.max(1, list.length));
      mesh.count = list.length;
      const c = new THREE.Color();
      list.forEach((_, j) => mesh.setColorAt(j, c.set(r.pick(COLORS[kind]))));
      mesh.frustumCulled = false;
      mesh.castShadow = kind === 'bus';
      meshes[kind] = mesh;
    }
    return { vehicles, lens, meshes };
  }, [routes]);

  const birds = useMemo(() => {
    const n = 36;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#2b2b2b', size: 1.6, sizeAttenuation: true }));
    pts.frustumCulled = false;
    return { pts, phase: Array.from({ length: n }, (_, i) => [i * 0.37, 0.8 + ((i * 7) % 5) * 0.08, (i % 6) * 3]) };
  }, []);

  useEffect(
    () => () => {
      Object.values(sim.meshes).forEach((m) => {
        m.geometry.dispose();
        m.dispose();
      });
      birds.pts.geometry.dispose();
    },
    [sim, birds],
  );

  useFrame((state, delta) => {
    if (!animate) return;
    const dt = Math.min(delta, 0.1);
    const idx: Record<Kind, number> = { auto: 0, car: 0, bus: 0 };
    for (const v of sim.vehicles) {
      const pts = routes[v.route].pts;
      const len = sim.lens[v.route];
      const total = len[len.length - 1];
      v.s += v.v * dt * v.dir;
      if (v.s > total || v.s < 0) {
        v.s = Math.min(total, Math.max(0, v.s));
        v.dir = v.s > 0 ? -1 : 1;
      }
      let i = 0;
      // Routes are short (≤ 250 samples): a linear scan is fine for ~150 vehicles.
      while (i < len.length - 2 && len[i + 1] < v.s) i++;
      const t = (v.s - len[i]) / Math.max(0.001, len[i + 1] - len[i]);
      const ax = pts[i * 3],
        ay = pts[i * 3 + 1],
        az = pts[i * 3 + 2];
      const bx = pts[i * 3 + 3],
        by = pts[i * 3 + 4],
        bz = pts[i * 3 + 5];
      const dl = Math.hypot(bx - ax, bz - az) || 1;
      const dx = ((bx - ax) / dl) * v.dir;
      const dz = ((bz - az) / dl) * v.dir;
      // Keep left: the left of travel is (dz, -dx).
      const lane = routes[v.route].type === 'arterial' ? 4.5 : 2.6;
      dummy.position.set(ax + (bx - ax) * t + dz * lane, ay + (by - ay) * t, az + (bz - az) * t - dx * lane);
      dummy.rotation.set(0, Math.atan2(-dz, dx), 0);
      dummy.updateMatrix();
      sim.meshes[v.kind].setMatrixAt(idx[v.kind]++, dummy.matrix);
    }
    Object.values(sim.meshes).forEach((m) => (m.instanceMatrix.needsUpdate = true));

    const time = state.clock.elapsedTime;
    const pos = birds.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    birds.phase.forEach(([p, r, h], i) => {
      const a = time * 0.12 * r + p;
      pos.setXYZ(
        i,
        -420 + Math.cos(a) * 140 * r + Math.sin(time * 0.7 + p) * 6,
        32 + h + Math.sin(time + p * 3) * 2,
        470 + Math.sin(a) * 60 * r,
      );
    });
    pos.needsUpdate = true;
    const n = materials().water.normalMap;
    if (n) n.offset.set((time * 0.004) % 1, (time * 0.0025) % 1);
  });

  return (
    <group visible={animate}>
      {Object.values(sim.meshes).map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      <primitive object={birds.pts} />
    </group>
  );
}
