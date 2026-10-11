// Keep-out areas: where generic lanes, buildings and trees must not go.
import { inPolygon, polyDist } from './geom';
import { city } from './layout';
import { RIVER_HALF, riverDist } from './terrain';

/** Footprint reserved around each special structure: centre offset and half sizes (axis aligned), or a radius. */
type Zone = { dx?: number; dz?: number; hx: number; hz: number } | { r: number };
export const SPECIAL_ZONES: Record<string, Zone> = {
  clock_tower: { r: 34 },
  municipal_hq: { hx: 40, hz: 25 },
  market_hall: { hx: 36, hz: 19 },
  vegetable_market: { hx: 36, hz: 20 },
  temple: { hx: 24, hz: 24 },
  ghat: { hx: 55, hz: 14 },
  station: { dx: 32, hx: 43, hz: 130 },
  bus_stand: { hx: 42, hz: 28 },
  college: { dz: -30, hx: 100, hz: 85 },
  college_gate: { hx: 12, hz: 6 },
  water_tank: { r: 22 },
  school: { hx: 30, hz: 15 },
  it_park: { hx: 140, hz: 125 },
  water_treatment_plant: { hx: 90, hz: 70 },
  construction: { hx: 26, hz: 26 },
};

export function inSpecial(x: number, z: number, pad = 0): boolean {
  for (const s of city.special) {
    const zone = SPECIAL_ZONES[s.type];
    if (!zone) continue;
    if ('r' in zone) {
      if (Math.hypot(x - s.x, z - s.z) < zone.r + pad) return true;
    } else {
      const cx = s.x + (zone.dx ?? 0);
      const cz = s.z + (zone.dz ?? 0);
      if (Math.abs(x - cx) < zone.hx + pad && Math.abs(z - cz) < zone.hz + pad) return true;
    }
  }
  return false;
}

export const railDist = (x: number, z: number) => polyDist(x, z, city.railway.points).d;
export const RAIL_HALF = 9;

export const inLake = (x: number, z: number) => inPolygon(x, z, city.lake.polygon);
export const parkAt = (x: number, z: number) => city.parks.find((p) => inPolygon(x, z, p.polygon));

/** True where nothing generic (lanes, buildings) may be placed. */
export function keepOut(x: number, z: number, pad = 0): boolean {
  const { minX, maxX, minZ, maxZ } = city.bounds;
  if (x < minX + 10 || x > maxX - 10 || z < minZ + 10 || z > maxZ - 10) return true;
  return (
    riverDist(x, z) < RIVER_HALF + 8 + pad ||
    railDist(x, z) < RAIL_HALF + 4 + pad ||
    inLake(x, z) ||
    !!parkAt(x, z) ||
    inSpecial(x, z, pad)
  );
}
