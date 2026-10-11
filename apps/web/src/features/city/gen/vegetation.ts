// Trees (neem- and gulmohar-like) and streetlights.
import { hex } from './builder';
import { bbox, inPolygon, resample } from './geom';
import { BIT, Grid } from './grid';
import { city, wardAt } from './layout';
import { rng, type Rng } from './prng';
import type { Road } from './roads';
import { heightAt, RIVER_HALF, roadY } from './terrain';

/** Trees: x, y, z, rotY, sx, sy, sz, r, g, b (canopy colour). Lights: x, y, z, rotY. */
export const TREE_STRIDE = 10;
export const LIGHT_STRIDE = 4;
const MAX_TREES = 2000;

const NEEM = ['#3f6b2f', '#4b7a35', '#355e2a', '#58823b', '#456f30'].map(hex);
const GULMOHAR = ['#c8502b', '#d4652d'].map(hex);
const BLOCK = BIT.solid | BIT.road | BIT.water | BIT.rail | BIT.tree;

function tree(out: number[], grid: Grid, r: Rng, x: number, z: number, scale = 1, flowering = 0.08) {
  if (out.length / TREE_STRIDE >= MAX_TREES || grid.get(x, z) & BLOCK) return;
  grid.disc(x, z, 2, BIT.tree);
  const h = r.range(6, 11) * scale;
  const wide = r.range(0.9, 1.3);
  const color = r.chance(flowering) ? r.pick(GULMOHAR) : r.pick(NEEM);
  out.push(x, heightAt(x, z), z, r.range(0, Math.PI * 2), h * wide, h, h * wide * r.range(0.85, 1.15), ...color);
}

export function generateVegetation(grid: Grid, roads: Road[]) {
  const trees: number[] = [];
  const lights: number[] = [];
  const r = rng(city.seed, 'trees');

  // Streetlights first (they own their spot), then avenue trees between them.
  for (const road of roads) {
    if (road.type === 'lane') continue;
    const half = road.width / 2;
    const avenue = road.type === 'arterial' || road.name === 'College Road' || road.name === 'Vidya Marg';
    let flip = 1;
    for (const { p, dir, s } of resample(road.points, 4)) {
      const n = [-dir[1], dir[0]];
      if (s % 40 < 4) {
        flip = -flip;
        const lx = p[0] + n[0] * flip * (half + 0.8);
        const lz = p[1] + n[1] * flip * (half + 0.8);
        if (!(grid.get(lx, lz) & (BIT.solid | BIT.water | BIT.rail | BIT.reserved))) {
          // The arm points back across the road.
          lights.push(lx, roadY(lx, lz), lz, -Math.atan2(-n[1] * flip, -n[0] * flip));
        }
      }
      const every = avenue ? 14 : 22;
      if (s % every < 4 && r.chance(0.8)) {
        for (const side of [1, -1]) {
          const tx = p[0] + n[0] * side * (half + 3.2);
          const tz = p[1] + n[1] * side * (half + 3.2);
          const ward = wardAt(tx, tz)?.zone;
          if (ward === 'old_city' || ward === 'commercial') continue;
          tree(trees, grid, r, tx, tz, 1, ward === 'campus' ? 0.15 : 0.08);
        }
      }
    }
  }

  // Riverbanks.
  for (const side of [1, -1]) {
    for (const { p, dir } of resample(city.river.points, 11)) {
      if (!r.chance(0.55)) continue;
      const off = RIVER_HALF + r.range(7, 16);
      tree(trees, grid, r, p[0] - dir[1] * side * off, p[1] + dir[0] * side * off, 1.1);
    }
  }

  // Parks and the hill forest.
  for (const park of city.parks) {
    const b = bbox(park.polygon);
    const step = park.kind === 'forest' ? 13 : park.kind === 'garden' ? 18 : 30;
    for (let z = b.minZ + 4; z < b.maxZ; z += step) {
      for (let x = b.minX + 4; x < b.maxX; x += step) {
        const tx = x + r.range(-step / 2, step / 2);
        const tz = z + r.range(-step / 2, step / 2);
        if (!inPolygon(tx, tz, park.polygon)) continue;
        // Playgrounds keep their middle open.
        if (park.kind === 'ground' && !nearEdge(tx, tz, b, 10)) continue;
        tree(trees, grid, r, tx, tz, park.kind === 'forest' ? 0.9 : 1.1, park.kind === 'garden' ? 0.2 : 0.03);
      }
    }
  }

  // Backyards in the quieter wards.
  const yard = rng(city.seed, 'yards');
  const { minX, maxX, minZ, maxZ } = city.bounds;
  for (let i = 0; i < 9000; i++) {
    const x = yard.range(minX + 20, maxX - 20);
    const z = yard.range(minZ + 20, maxZ - 20);
    const zone = wardAt(x, z)?.zone;
    const p = { residential: 0.5, foothills: 0.8, campus: 0.6, societies: 0.5, riverfront: 0.35, new_extension: 0.2 }[
      zone as string
    ];
    if (p && yard.chance(p) && !(grid.get(x, z) & BIT.reserved)) tree(trees, grid, yard, x, z);
  }

  return { trees, lights };
}

const nearEdge = (x: number, z: number, b: ReturnType<typeof bbox>, m: number) =>
  x - b.minX < m || b.maxX - x < m || z - b.minZ < m || b.maxZ - z < m;
