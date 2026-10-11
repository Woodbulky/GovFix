// Ground height, river and bridge decks. Pure functions so the worker, walk mode and tests agree.
import { polyDist, smoothstep } from './geom';
import { city } from './layout';
import { noise2 } from './prng';

const { minX, maxX, minZ, maxZ } = city.bounds;
const cityHills = city.hills.filter((h) => !h.backdrop);
const farHills = city.hills.filter((h) => h.backdrop);

export const RIVER_HALF = city.river.width / 2;
export const WATER_Y = 0.15;
export const DECK_Y = 3.2;

/** Metres outside the city bounds (0 inside). */
const outside = (x: number, z: number) => Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minZ - z, 0, z - maxZ));

const gauss = (x: number, z: number, h: { x: number; z: number; radius: number; height: number }) =>
  h.height * Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * h.radius * h.radius));

/** Natural ground height (no bridges). Far hills only rise outside the city, so streets stay flat. */
export function heightAt(x: number, z: number): number {
  let y = 0;
  for (const h of cityHills) y += gauss(x, z, h);
  const out = outside(x, z);
  if (out > 0) {
    let far = 0;
    for (const h of farHills) far += gauss(x, z, h);
    far *= 0.75 + 0.5 * noise2(x / 260, z / 260);
    y += smoothstep(0, 400, out) * (far + 14 * noise2(x / 500, z / 500));
  }
  return y;
}

export function riverDist(x: number, z: number) {
  return polyDist(x, z, city.river.points).d;
}

/** 0..1: how far a road or rail at (x, z) is lifted onto a bridge deck (ramps up over 40 m). */
export function bridgeLift(x: number, z: number): number {
  const d = riverDist(x, z);
  return 1 - smoothstep(RIVER_HALF + 6, RIVER_HALF + 46, d);
}

/** Surface height of a road or rail at (x, z), including bridge decks. */
export function roadY(x: number, z: number): number {
  return Math.max(heightAt(x, z), DECK_Y * bridgeLift(x, z));
}
