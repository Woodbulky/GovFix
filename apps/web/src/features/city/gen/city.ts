// Generates the whole city from the layout. Pure and deterministic; runs in a Web Worker (worker.ts).
import type { Built } from './builder';
import { generateBuildings } from './buildings';
import { resample } from './geom';
import { BIT, Grid } from './grid';
import { city } from './layout';
import { buildRoadNetwork } from './roads';
import { buildSpecials } from './specials';
import { buildGround, buildRoads, buildWaterAndStructures, markGrid } from './structures';
import { roadY } from './terrain';
import { generateVegetation } from './vegetation';
import { SPECIAL_ZONES } from './zones';

export type Route = { type: 'arterial' | 'main'; pts: Float32Array };

export type CityData = {
  meshes: Record<'ground' | 'far' | 'asphalt' | 'detail' | 'water' | 'structures' | 'wards', Built>;
  instances: Record<'body' | 'frame' | 'hipRoof' | 'gableRoof' | 'tank' | 'awning' | 'trees' | 'lights', Float32Array>;
  routes: Route[];
  grid: Uint8Array;
  stats: { roads: number; buildings: number; trees: number; lights: number; ms: number };
};

/** Nearest-road direction (radians, grid sense) on a 20 m lattice, for aligning backfilled buildings. */
function directionField(roads: ReturnType<typeof buildRoadNetwork>) {
  const S = 20;
  const { minX, minZ, maxX, maxZ } = city.bounds;
  const nx = Math.ceil((maxX - minX) / S);
  const nz = Math.ceil((maxZ - minZ) / S);
  const dist = new Float32Array(nx * nz).fill(Infinity);
  const ang = new Float32Array(nx * nz);
  for (const r of roads) {
    for (const { p, dir } of resample(r.points, 10)) {
      const i0 = Math.floor((p[0] - minX) / S);
      const k0 = Math.floor((p[1] - minZ) / S);
      for (let k = k0 - 4; k <= k0 + 4; k++)
        for (let i = i0 - 4; i <= i0 + 4; i++) {
          if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
          const d = Math.hypot(minX + (i + 0.5) * S - p[0], minZ + (k + 0.5) * S - p[1]);
          if (d < dist[k * nx + i]) {
            dist[k * nx + i] = d;
            ang[k * nx + i] = Math.atan2(dir[1], dir[0]);
          }
        }
    }
  }
  return (x: number, z: number) => {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / S)));
    const k = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / S)));
    return ang[k * nx + i];
  };
}

export function generateCity(): CityData {
  const t0 = performance.now();
  const roads = buildRoadNetwork();
  const grid = new Grid();
  markGrid(grid, roads);
  for (const s of city.special) {
    const z = SPECIAL_ZONES[s.type];
    if (!z) continue;
    if ('r' in z) grid.disc(s.x, s.z, z.r, BIT.reserved);
    else grid.rect(s.x + (z.dx ?? 0), s.z + (z.dz ?? 0), z.hx, z.hz, 0, BIT.reserved);
  }

  const { ground, far } = buildGround();
  const { asphalt, detail } = buildRoads(roads);
  const { water, structures, wards } = buildWaterAndStructures(roads, grid);
  buildSpecials(structures, grid);
  const b = generateBuildings(grid, roads, directionField(roads));
  const { trees, lights } = generateVegetation(grid, roads);

  const routes: Route[] = roads
    .filter((r) => r.type !== 'lane')
    .map((r) => ({
      type: r.type as Route['type'],
      pts: new Float32Array(resample(r.points, 10).flatMap(({ p }) => [p[0], roadY(p[0], p[1]) + 0.1, p[1]])),
    }));

  const f = (a: number[]) => new Float32Array(a);
  return {
    meshes: { ground, far, asphalt, detail, water, structures: structures.build(), wards },
    instances: {
      body: f(b.body),
      frame: f(b.frame),
      hipRoof: f(b.hipRoof),
      gableRoof: f(b.gableRoof),
      tank: f(b.tank),
      awning: f(b.awning),
      trees: f(trees),
      lights: f(lights),
    },
    routes,
    grid: grid.cells,
    stats: {
      roads: roads.length,
      buildings: (b.body.length + b.frame.length) / 10,
      trees: trees.length / 10,
      lights: lights.length / 4,
      ms: Math.round(performance.now() - t0),
    },
  };
}

/** Every ArrayBuffer in the result, so postMessage can transfer instead of copy. */
export function transferables(d: CityData): ArrayBuffer[] {
  const out: ArrayBuffer[] = [d.grid.buffer as ArrayBuffer];
  for (const m of Object.values(d.meshes))
    out.push(m.position.buffer as ArrayBuffer, m.normal.buffer as ArrayBuffer, m.color.buffer as ArrayBuffer);
  for (const a of Object.values(d.instances)) out.push(a.buffer as ArrayBuffer);
  for (const r of d.routes) out.push(r.pts.buffer as ArrayBuffer);
  return out;
}
