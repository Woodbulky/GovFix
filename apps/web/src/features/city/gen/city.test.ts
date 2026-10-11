import { describe, expect, it } from 'vitest';
import { freeSpot, walkBlocked, walkGround } from '../controls/walk';
import { DAY, sunAt } from '../sun';
import { generateCity } from './city';
import { polyDist } from './geom';
import { BIT, Grid } from './grid';
import { city, wardAt } from './layout';
import { buildRoadNetwork } from './roads';
import { DECK_Y, RIVER_HALF, riverDist } from './terrain';

const data = generateCity();
const grid = new Grid(data.grid);
const body = data.instances.body;
const centres = Array.from({ length: body.length / 10 }, (_, i) => [body[i * 10], body[i * 10 + 2]] as const);

describe('procedural Navnagar', () => {
  it('is deterministic: same seed, same city', () => {
    const again = generateCity();
    expect(again.stats.buildings).toBe(data.stats.buildings);
    expect(again.stats.trees).toBe(data.stats.trees);
    expect(Array.from(again.instances.body.slice(0, 200))).toEqual(Array.from(body.slice(0, 200)));
  });

  it('keeps buildings off the river, the railway and the arterial and main roads', () => {
    const majors = buildRoadNetwork().filter((r) => r.type !== 'lane');
    for (const [x, z] of centres) {
      expect(riverDist(x, z)).toBeGreaterThan(RIVER_HALF);
      for (const r of majors) expect(polyDist(x, z, r.points).d).toBeGreaterThan(r.width / 2);
      expect(polyDist(x, z, city.railway.points).d).toBeGreaterThan(5);
    }
  });

  it('gives every ward its own buildings', () => {
    const byWard = new Set(centres.map(([x, z]) => wardAt(x, z)?.id));
    for (const w of city.wards) expect(byWard.has(w.id)).toBe(true);
  });

  it('stays inside the performance budget (≤300k triangles even if everything is in view)', () => {
    const statics = Object.values(data.meshes).reduce((s, m) => s + m.position.length / 9, 0);
    const n = (k: keyof typeof data.instances, stride = 10) => data.instances[k].length / stride;
    const instanced =
      n('body') * 10 +
      n('frame') * 10 +
      n('hipRoof') * 6 +
      n('gableRoof') * 6 +
      n('tank') * 13 +
      n('awning') * 12 +
      n('trees') * (6 + 20) +
      n('lights', 4) * (24 + 12);
    expect(statics + instanced).toBeLessThan(300_000);
  });

  it('lets a walker reach every landmark, and walls stop them', () => {
    for (const l of city.landmarks) {
      const [x, z] = freeSpot(grid, l.x, l.z);
      expect(Math.hypot(x - l.x, z - l.z)).toBeLessThan(60);
      expect(walkBlocked(grid, x, z)).toBe(false);
    }
    const [x, z] = centres[0];
    expect(walkBlocked(grid, x, z)).toBe(true);
  });

  it('carries walkers over the river on a bridge deck, but not across open water', () => {
    const juna = city.river.bridges.find((b) => b.name === 'Juna Pool')!;
    expect(grid.get(juna.x, juna.z) & BIT.deck).toBeTruthy();
    expect(walkBlocked(grid, juna.x, juna.z)).toBe(false);
    expect(walkGround(grid, juna.x, juna.z)).toBeGreaterThan(DECK_Y - 0.5);
    expect(walkBlocked(grid, -900, 430)).toBe(true); // mid-river, no bridge
  });
});

describe('sun from sim time', () => {
  it('is high at noon IST and down at 10 pm IST', () => {
    const noon = sunAt(new Date('2026-10-11T06:30:00Z'));
    expect(noon.elevation).toBeGreaterThan(50);
    expect(noon.night).toBe(0);
    expect(noon.dir[2]).toBeGreaterThan(0); // the sun is to the south at this latitude
    const night = sunAt(new Date('2026-10-11T16:30:00Z'));
    expect(night.elevation).toBeLessThan(0);
    expect(night.night).toBe(1);
    expect(DAY.night).toBe(0);
  });
});
