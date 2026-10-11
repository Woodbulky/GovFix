// Buildings by ward character: placed along road frontages first, then backfilled inside blocks.
import { hex, type RGB } from './builder';
import { resample, type Pt } from './geom';
import { BIT, Grid } from './grid';
import { city, wardAt, type Zone } from './layout';
import { rng, type Rng } from './prng';
import type { Road } from './roads';
import { heightAt } from './terrain';

/** Per-instance layout: x, y, z, rotY, sx, sy, sz, r, g, b. */
export const STRIDE = 10;

export type BuildingSets = {
  body: number[]; // plastered and glass blocks (window shader)
  frame: number[]; // buildings under construction
  hipRoof: number[];
  gableRoof: number[];
  tank: number[];
  awning: number[];
};

type Arch = {
  w: number;
  d: number;
  h: number;
  roof: 'flat' | 'hip' | 'gable';
  color: RGB;
  tanks: number;
  awning: boolean;
  setback: number;
  gap: number;
  frame?: boolean;
};

const P = (...h: string[]) => h.map(hex);
const PLASTER = P('#efe6d2', '#f3e3b3', '#e9c9c0', '#cfdbe3', '#e8e0d0', '#f1d9a6', '#d8e2cf', '#ead6c8', '#f4efe6');
const OLD = P('#e6cfa8', '#d9b48f', '#efe0c2', '#e8c6a0', '#d7c3a3', '#f0d6b0');
const TOWER = P('#ece8e1', '#e0dcd2', '#d6dde0', '#f0e6d6', '#e4e9e4');
const GLASS = P('#9db4c4', '#8ea7b8', '#b5c4cc', '#a3b9b1');
const SHED = P('#b9c0c3', '#a9b3b8', '#c9c4b8', '#b5b0a2');
const CAMPUS = P('#b56a4f', '#c98f6b', '#efe3cf');
const TILE = P('#a5512f', '#b35d36', '#8f4a2c', '#9c5838');
const TIN = P('#7d8b94', '#8a96a0', '#6d7a82', '#93877a');
const AWNING = P('#2f6f8f', '#2e7d4f', '#d9822b', '#b23a3a', '#e8a317', '#5b4a9e');
const TANK = P('#1d1f1f', '#1d1f1f', '#1d1f1f', '#2b4a7a');

function archetype(zone: Zone, major: boolean, r: Rng): Arch | null {
  const base = { tanks: 0, awning: false, setback: 2, gap: 1.2, roof: 'flat' as const };
  switch (zone) {
    case 'old_city': {
      const floors = r.int(2, 4);
      const hip = r.chance(0.6);
      return {
        ...base,
        w: r.range(8, 16),
        d: r.range(10, 17),
        h: floors * 3 - 0.5,
        roof: hip ? 'hip' : 'flat',
        color: r.pick(OLD),
        tanks: hip ? 0 : 1,
        awning: major && r.chance(0.55),
        setback: 0.8,
        gap: 0.6,
      };
    }
    case 'riverfront': {
      const hip = r.chance(0.5);
      return {
        ...base,
        w: r.range(7, 12),
        d: r.range(8, 12),
        h: r.range(4, 8),
        roof: hip ? 'hip' : 'flat',
        color: r.pick(PLASTER),
        tanks: hip ? 0 : 1,
        gap: 2.5,
      };
    }
    case 'commercial':
      return {
        ...base,
        w: r.range(10, 20),
        d: r.range(12, 20),
        h: r.int(3, 6) * 3,
        color: r.pick(PLASTER),
        tanks: r.chance(0.7) ? 1 : 0,
        awning: major && r.chance(0.7),
        gap: 0.8,
      };
    case 'centre':
      return {
        ...base,
        w: r.range(14, 30),
        d: r.range(14, 24),
        h: r.int(4, 8) * 3,
        color: r.pick([...PLASTER, ...TOWER]),
        tanks: r.chance(0.4) ? 1 : 0,
        awning: major && r.chance(0.4),
        gap: 1.5,
      };
    case 'campus':
      return {
        ...base,
        w: r.range(30, 50),
        d: r.range(14, 18),
        h: r.int(3, 5) * 3.2,
        color: r.pick(CAMPUS),
        setback: 10,
        gap: 14,
      };
    case 'societies':
      return {
        ...base,
        w: r.range(18, 24),
        d: r.range(16, 22),
        h: r.int(8, 14) * 3,
        color: r.pick(TOWER),
        tanks: 1,
        setback: 14,
        gap: 16,
      };
    case 'industrial':
      return {
        ...base,
        w: r.range(30, 60),
        d: r.range(20, 40),
        h: r.range(6, 9),
        roof: 'gable',
        color: r.pick(SHED),
        setback: 8,
        gap: 10,
      };
    case 'foothills': {
      if (r.chance(0.4)) return null;
      const hip = r.chance(0.6);
      return {
        ...base,
        w: r.range(7, 11),
        d: r.range(7, 10),
        h: r.range(4, 7),
        roof: hip ? 'hip' : 'flat',
        color: r.pick(PLASTER),
        tanks: hip ? 0 : 1,
        gap: 5,
      };
    }
    case 'residential':
      return r.chance(0.3)
        ? {
            ...base,
            w: r.range(16, 22),
            d: r.range(12, 16),
            h: r.int(4, 5) * 3,
            color: r.pick(PLASTER),
            tanks: 2,
            gap: 4,
          }
        : {
            ...base,
            w: r.range(6, 8),
            d: r.range(10, 13),
            h: r.int(2, 3) * 3,
            color: r.pick(PLASTER),
            tanks: 1,
            setback: 3,
            gap: 0.3,
          };
    case 'new_extension': {
      if (r.chance(0.35)) return null;
      const frame = r.chance(0.2);
      return {
        ...base,
        w: r.range(18, 30),
        d: r.range(16, 24),
        h: r.int(4, 10) * 3,
        color: frame ? hex('#a8a8a2') : r.chance(0.5) ? r.pick(GLASS) : r.pick(TOWER),
        tanks: frame ? 0 : 1,
        setback: 6,
        gap: 8,
        frame,
      };
    }
  }
}

const MASK = BIT.solid | BIT.road | BIT.water | BIT.rail | BIT.reserved;

function place(out: BuildingSets, grid: Grid, r: Rng, x: number, z: number, rot: number, a: Arch): boolean {
  if (!grid.free(x, z, a.w / 2 + a.gap / 2, a.d / 2 + a.gap / 2, rot, MASK)) return false;
  grid.rect(x, z, a.w / 2, a.d / 2, rot, BIT.solid);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // Sit on the lowest corner so nothing floats on the hill.
  let y = heightAt(x, z);
  for (const [u, v] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    y = Math.min(y, heightAt(x + (u * a.w * c - v * a.d * s) / 2, z + (u * a.w * s + v * a.d * c) / 2));
  }
  const top = heightAt(x, z) + a.h;
  const h = top - y + 0.3;
  const rotY = -rot;
  (a.frame ? out.frame : out.body).push(x, y - 0.3, z, rotY, a.w, h, a.d, ...a.color);
  if (a.roof === 'hip') out.hipRoof.push(x, top, z, rotY, a.w * 1.08, r.range(2, 3.4), a.d * 1.08, ...r.pick(TILE));
  if (a.roof === 'gable') out.gableRoof.push(x, top, z, rotY, a.w * 1.04, r.range(2.5, 4), a.d * 1.06, ...r.pick(TIN));
  for (let t = 0; t < a.tanks; t++) {
    if (r.chance(0.45)) continue;
    const u = r.range(-0.3, 0.3) * a.w;
    const v = r.range(-0.3, 0.3) * a.d;
    const sz = r.range(0.75, 1.1);
    out.tank.push(x + u * c - v * s, top, z + u * s + v * c, 0, sz, sz, sz, ...r.pick(TANK));
  }
  return true;
}

/** Frontage pass. `side` is +1 or -1 (left or right of travel). */
function frontage(out: BuildingSets, grid: Grid, r: Rng, road: Road) {
  const major = road.type !== 'lane';
  const samples = resample(road.points, 2);
  for (const side of [1, -1]) {
    let next = 0;
    for (const { p, dir, s } of samples) {
      if (s < next) continue;
      const zone = wardAt(p[0], p[1])?.zone;
      const a = zone && archetype(zone, major, r);
      if (!a) {
        next = s + 6;
        continue;
      }
      const n: Pt = [-dir[1] * side, dir[0] * side];
      const off = road.width / 2 + (major ? 2.5 : 0.5) + a.setback + a.d / 2;
      const x = p[0] + n[0] * off + dir[0] * (a.w / 2);
      const z = p[1] + n[1] * off + dir[1] * (a.w / 2);
      const rot = Math.atan2(dir[1], dir[0]);
      // The front (local -z) must look at the road; on the right-hand side that needs a half turn.
      next = place(out, grid, r, x, z, side < 0 ? rot + Math.PI : rot, a) ? s + a.w + a.gap : s + 3;
    }
  }
}

/** Backfill inside blocks, aligned to the nearest road direction. */
function backfill(out: BuildingSets, grid: Grid, r: Rng, dirAt: (x: number, z: number) => number) {
  const SPACING: Partial<Record<Zone, number>> = {
    old_city: 15,
    riverfront: 22,
    commercial: 22,
    centre: 26,
    residential: 18,
    societies: 46,
    new_extension: 40,
    industrial: 55,
    campus: 60,
    foothills: 30,
  };
  const { minX, maxX, minZ, maxZ } = city.bounds;
  for (let z = minZ + 20; z < maxZ - 20; z += 9) {
    for (let x = minX + 20; x < maxX - 20; x += 9) {
      const zone = wardAt(x, z)?.zone;
      const sp = zone && SPACING[zone];
      if (!zone || !sp || !r.chance((9 * 9) / (sp * sp))) continue;
      const a = archetype(zone, false, r);
      if (a) place(out, grid, r, x + r.range(-3, 3), z + r.range(-3, 3), dirAt(x, z), a);
    }
  }
}

export function generateBuildings(grid: Grid, roads: Road[], dirAt: (x: number, z: number) => number): BuildingSets {
  const out: BuildingSets = { body: [], frame: [], hipRoof: [], gableRoof: [], tank: [], awning: [] };
  const r = rng(city.seed, 'buildings');
  const order: Record<string, number> = { arterial: 0, main: 1, lane: 2 };
  for (const road of [...roads].sort((a, b) => order[a.type] - order[b.type])) frontage(out, grid, r, road);
  backfill(out, grid, r, dirAt);
  addAwnings(out, r);
  return out;
}

/** Shop awnings on the road-facing side of low commercial and old-city buildings. */
function addAwnings(out: BuildingSets, r: Rng) {
  const b = out.body;
  for (let i = 0; i < b.length; i += STRIDE) {
    const [x, y, z, rotY, w, h, d] = b.slice(i, i + 7);
    const zone = wardAt(x, z)?.zone;
    if (h > 22 || !(zone === 'old_city' || zone === 'commercial' || zone === 'centre') || !r.chance(0.45)) continue;
    // The front is local -z, which rotY turns into (-sin rotY, -cos rotY).
    const fx = -Math.sin(rotY);
    const fz = -Math.cos(rotY);
    const off = d / 2 + 0.9;
    out.awning.push(x + fx * off, y + 3.3, z + fz * off, rotY, w * 0.85, 0.18, 1.8, ...r.pick(AWNING));
  }
}
