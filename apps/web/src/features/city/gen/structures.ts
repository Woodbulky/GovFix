// Ground, roads, river, lake, parks, railway, bridges, ward lines and society walls as merged meshes.
import { GeoBuilder, hex, shade, type RGB } from './builder';
import { bbox, inPolygon, polyDist, resample, type Pt } from './geom';
import { BIT, Grid } from './grid';
import { city, wardAt } from './layout';
import { noise2 } from './prng';
import type { Road } from './roads';
import { bridgeLift, DECK_Y, heightAt, RIVER_HALF, riverDist, roadY, WATER_Y } from './terrain';
import { RAIL_HALF } from './zones';

type V3 = [number, number, number];
const C = {
  dust: hex('#c8bd9c'),
  grass: hex('#a3a978'),
  hill: hex('#7c8a55'),
  field: hex('#9aa26c'),
  ridge: hex('#5f6b47'),
  arterial: hex('#3b3d40'),
  main: hex('#47494c'),
  lane: hex('#8c877d'),
  laneAsphalt: hex('#55575a'),
  sidewalk: hex('#bdb6a6'),
  median: hex('#d9d3c3'),
  dash: hex('#f2f2ee'),
  water: hex('#2f6f8f'),
  quay: hex('#8d877a'),
  ballast: hex('#7c7468'),
  rail: hex('#4a4644'),
  stone: hex('#9b8f7d'),
  concrete: hex('#b9b8b2'),
  steel: hex('#5d6166'),
  wall: hex('#d8d0c0'),
  ward: hex('#e8a317'),
  park: { garden: hex('#7da35a'), ground: hex('#b9a27a'), forest: hex('#5f7a40') } as Record<string, RGB>,
};

/** Left and right edge points of a ribbon along a polyline, with smoothed joints. */
function edges(points: Pt[], step: number, half: number, off = 0) {
  const s = resample(points, step);
  return s.map((cur, i) => {
    const prev = s[Math.max(0, i - 1)].dir;
    const dx = prev[0] + cur.dir[0];
    const dz = prev[1] + cur.dir[1];
    const l = Math.hypot(dx, dz) || 1;
    const n: Pt = [-dz / l, dx / l];
    const c: Pt = [cur.p[0] + n[0] * off, cur.p[1] + n[1] * off];
    return { c, l: [c[0] + n[0] * half, c[1] + n[1] * half] as Pt, r: [c[0] - n[0] * half, c[1] - n[1] * half] as Pt };
  });
}

function ribbon(
  b: GeoBuilder,
  points: Pt[],
  step: number,
  half: number,
  y: (x: number, z: number) => number,
  color: RGB,
  off = 0,
  skip?: (x: number, z: number) => boolean,
) {
  const e = edges(points, step, half, off);
  for (let i = 0; i < e.length - 1; i++) {
    if (skip && (skip(...e[i].c) || skip(...e[i + 1].c))) continue;
    const v = (p: Pt): V3 => [p[0], y(p[0], p[1]), p[1]];
    b.quad(v(e[i].l), v(e[i + 1].l), v(e[i + 1].r), v(e[i].r), color);
  }
}

export function markGrid(grid: Grid, roads: Road[]) {
  grid.stroke(city.river.points, RIVER_HALF, BIT.water);
  grid.stroke(city.railway.points, RAIL_HALF, BIT.rail);
  const fill = (poly: Pt[], bit: number) => {
    const b = bbox(poly);
    for (let z = b.minZ; z <= b.maxZ; z += 2)
      for (let x = b.minX; x <= b.maxX; x += 2) {
        if (inPolygon(x, z, poly)) grid.disc(x, z, 0, bit);
      }
  };
  fill(city.lake.polygon, BIT.water);
  for (const p of city.parks) fill(p.polygon, BIT.reserved);
  for (const l of city.landmarks) grid.disc(l.x, l.z, 10, BIT.reserved);
  for (const r of roads) {
    grid.stroke(r.points, r.width / 2 + (r.type === 'lane' ? 0.3 : 2.5), BIT.road);
    for (const { p } of resample(r.points, 4))
      if (bridgeLift(p[0], p[1]) > 0.3) grid.disc(p[0], p[1], r.width / 2, BIT.deck);
  }
}

export function buildGround() {
  const g = new GeoBuilder();
  const { minX, maxX, minZ, maxZ } = city.bounds;
  const S = 40;
  const col = (x: number, z: number, y: number): RGB => {
    const n = 0.92 + 0.14 * noise2(x / 70, z / 70);
    const near = riverDist(x, z) < RIVER_HALF + 40 ? 0.6 : 0;
    const base = y > 6 ? C.hill : near ? C.grass : C.dust;
    return shade(base, n);
  };
  for (let z = minZ - 100; z < maxZ + 100; z += S) {
    for (let x = minX - 100; x < maxX + 100; x += S) {
      const p = (px: number, pz: number): V3 => [px, heightAt(px, pz), pz];
      const c = col(x + S / 2, z + S / 2, heightAt(x + S / 2, z + S / 2));
      g.quad(p(x, z + S), p(x + S, z + S), p(x + S, z), p(x, z), c);
    }
  }
  // Countryside and the hills to the north, under the city ground inside the bounds.
  const far = new GeoBuilder();
  const F = 250;
  for (let z = -7000; z < 7000; z += F) {
    for (let x = -7000; x < 7000; x += F) {
      const inside = (px: number, pz: number) => px > minX - 60 && px < maxX + 60 && pz > minZ - 60 && pz < maxZ + 60;
      const p = (px: number, pz: number): V3 => [px, inside(px, pz) ? -0.8 : heightAt(px, pz), pz];
      const y = heightAt(x + F / 2, z + F / 2);
      const base = y > 120 ? C.ridge : y > 30 ? C.hill : C.field;
      far.quad(p(x, z + F), p(x + F, z + F), p(x + F, z), p(x, z), shade(base, 0.85 + 0.25 * noise2(x / 400, z / 400)));
    }
  }
  return { ground: g.build(), far: far.build() };
}

export function buildRoads(roads: Road[]) {
  const asphalt = new GeoBuilder();
  const detail = new GeoBuilder();
  const majors = roads.filter((r) => r.type !== 'lane');
  const lift = { arterial: 0.1, main: 0.07, lane: 0.04 };
  const nearOther = (self: Road, pad: number) => (x: number, z: number) =>
    majors.some((o) => o !== self && polyDist(x, z, o.points).d < o.width / 2 + pad);

  for (const r of roads) {
    const y = (x: number, z: number) => roadY(x, z) + lift[r.type];
    const zone = wardAt(r.points[0][0], r.points[0][1])?.zone;
    const planned = zone === 'societies' || zone === 'industrial' || zone === 'new_extension' || zone === 'campus';
    const color = r.type === 'arterial' ? C.arterial : r.type === 'main' ? C.main : planned ? C.laneAsphalt : C.lane;
    ribbon(asphalt, r.points, 12, r.width / 2, y, color);
    if (r.type === 'lane') continue;
    const at = nearOther(r, 2);
    const ys = (x: number, z: number) => roadY(x, z) + 0.17;
    ribbon(detail, r.points, 12, 1.25, ys, C.sidewalk, r.width / 2 + 1.25, at);
    ribbon(detail, r.points, 12, 1.25, ys, C.sidewalk, -(r.width / 2 + 1.25), at);
    if (r.type === 'arterial') {
      ribbon(detail, r.points, 6, 0.6, (x, z) => roadY(x, z) + 0.28, C.median, 0, at);
      for (const side of [6, -6]) {
        const dashes = edges(r.points, 4.5, 0.12, side);
        for (let i = 0; i < dashes.length - 1; i += 2) {
          const [a, b] = [dashes[i], dashes[i + 1]];
          if (at(...a.c)) continue;
          const v = (p: Pt): V3 => [p[0], roadY(p[0], p[1]) + 0.13, p[1]];
          detail.quad(v(a.l), v(b.l), v(b.r), v(a.r), C.dash);
        }
      }
    }
  }
  return { asphalt: asphalt.build(), detail: detail.build() };
}

/** Deck girders, railings and piers wherever a road or the railway lifts over the river. */
function bridge(b: GeoBuilder, points: Pt[], half: number, style: 'stone' | 'concrete' | 'steel') {
  const color = style === 'stone' ? C.stone : style === 'steel' ? C.steel : C.concrete;
  const e = edges(points, 6, half);
  let lastPier = -Infinity;
  e.forEach((cur, i) => {
    const nxt = e[i + 1];
    if (!nxt || bridgeLift(...cur.c) < 0.35) return;
    for (const side of ['l', 'r'] as const) {
      const a = cur[side];
      const c = nxt[side];
      const ya = roadY(a[0], a[1]);
      const yc = roadY(c[0], c[1]);
      // Fascia from deck to 1.4 m below it, and a railing above.
      b.quad([a[0], ya - 1.4, a[1]], [c[0], yc - 1.4, c[1]], [c[0], yc + 0.15, c[1]], [a[0], ya + 0.15, a[1]], color);
      b.quad([c[0], yc - 1.4, c[1]], [a[0], ya - 1.4, a[1]], [a[0], ya + 0.15, a[1]], [c[0], yc + 0.15, c[1]], color);
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      b.box(
        (a[0] + c[0]) / 2,
        (ya + yc) / 2 + 0.1,
        (a[1] + c[1]) / 2,
        len,
        1.0,
        0.3,
        Math.atan2(c[1] - a[1], c[0] - a[0]),
        shade(color, 0.9),
      );
    }
    const [x, z] = cur.c;
    if (riverDist(x, z) < RIVER_HALF + 2 && i - lastPier >= (style === 'stone' ? 3 : 4)) {
      lastPier = i;
      const rot = Math.atan2(nxt.c[1] - z, nxt.c[0] - x);
      b.box(x, 0, z, style === 'stone' ? 4 : 2.2, DECK_Y - 1.4, half * 2 + 1, rot, shade(color, 0.8));
    }
  });
}

export function buildWaterAndStructures(roads: Road[], grid: Grid) {
  const water = new GeoBuilder();
  const s = new GeoBuilder();

  ribbon(water, city.river.points, 12, RIVER_HALF + 2, () => WATER_Y, C.water);
  water.polygon(city.lake.polygon, WATER_Y + 0.05, C.water);
  const ghat = city.special.find((x) => x.type === 'ghat');
  const notGhat = (x: number, z: number) => !!ghat && Math.abs(x - ghat.x) < 55 && Math.abs(z - ghat.z) < 30;
  for (const side of [1, -1]) {
    ribbon(s, city.river.points, 12, 2, () => 0.55, C.quay, side * (RIVER_HALF + 1), notGhat);
  }

  for (const p of city.parks) {
    if (p.kind !== 'forest') {
      s.polygon(p.polygon, (x, z) => heightAt(x, z) + 0.06, C.park[p.kind]);
      continue;
    }
    const b = bbox(p.polygon);
    for (let z = b.minZ; z < b.maxZ; z += 10)
      for (let x = b.minX; x < b.maxX; x += 10) {
        if (!inPolygon(x + 5, z + 5, p.polygon)) continue;
        const v = (px: number, pz: number): V3 => [px, heightAt(px, pz) + 0.12, pz];
        s.quad(
          v(x, z + 10),
          v(x + 10, z + 10),
          v(x + 10, z),
          v(x, z),
          shade(C.park.forest, 0.9 + 0.2 * noise2(x / 30, z / 30)),
        );
      }
  }

  // Railway: two tracks on ballast, overhead line masts.
  const rail = city.railway.points;
  ribbon(s, rail, 8, 5, (x, z) => roadY(x, z) + 0.12, C.ballast);
  for (const track of [2.2, -2.2]) {
    for (const r of [0.75, -0.75]) ribbon(s, rail, 8, 0.09, (x, z) => roadY(x, z) + 0.32, C.rail, track + r);
  }
  for (const { p, dir, s: d } of resample(rail, 10)) {
    if (d % 60 >= 10 || bridgeLift(p[0], p[1]) > 0.2) continue;
    const x = p[0] - dir[1] * 5.5;
    const z = p[1] + dir[0] * 5.5;
    s.box(x, roadY(x, z), z, 0.35, 7.5, 0.35, 0, C.steel);
    s.box(p[0] - dir[1] * 2.8, roadY(x, z) + 7, p[1] + dir[0] * 2.8, 0.2, 0.25, 6, Math.atan2(dir[1], dir[0]), C.steel);
  }

  for (const r of roads) {
    if (!r.points.some((p) => riverDist(p[0], p[1]) < RIVER_HALF + 50) && !crosses(r.points)) continue;
    const named = city.river.bridges.find((b) => polyDist(b.x, b.z, r.points).d < 40);
    bridge(s, r.points, r.width / 2, (named?.style as 'stone' | 'concrete') ?? 'concrete');
  }
  bridge(s, rail, 5.5, 'steel');

  societyWalls(s, roads, grid);

  const wards = new GeoBuilder();
  for (const w of city.wards) {
    ribbon(wards, [...w.polygon, w.polygon[0]], 20, 2.5, (x, z) => heightAt(x, z) + 0.45, C.ward);
  }
  return { water: water.build(), structures: s, wards: wards.build() };
}

const crosses = (pts: Pt[]) => resample(pts, 10).some(({ p }) => riverDist(p[0], p[1]) < RIVER_HALF);

/** Compound walls along roads in the gated-society ward, with gates. */
function societyWalls(b: GeoBuilder, roads: Road[], grid: Grid) {
  for (const r of roads) {
    for (const side of [1, -1]) {
      const e = edges(r.points, 6, r.width / 2 + (r.type === 'lane' ? 4 : 6), 0);
      e.forEach((cur, i) => {
        const nxt = e[i + 1];
        if (!nxt || i % 12 === 0) return; // a gate every ~70 m
        const a = side > 0 ? cur.l : cur.r;
        const c = side > 0 ? nxt.l : nxt.r;
        const mx = (a[0] + c[0]) / 2;
        const mz = (a[1] + c[1]) / 2;
        if (wardAt(mx, mz)?.zone !== 'societies' || grid.get(mx, mz) & (BIT.road | BIT.water | BIT.rail | BIT.reserved))
          return;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const rot = Math.atan2(c[1] - a[1], c[0] - a[0]);
        b.box(mx, heightAt(mx, mz), mz, len + 0.1, 1.8, 0.25, rot, C.wall);
        grid.rect(mx, mz, len / 2, 0.3, rot, BIT.solid);
      });
    }
  }
}
