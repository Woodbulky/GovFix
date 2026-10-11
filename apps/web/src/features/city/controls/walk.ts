// Walk-mode physics on the occupancy grid: pure, so tests can check collisions without WebGL.
import { BIT, Grid } from '../gen/grid';
import { heightAt, roadY } from '../gen/terrain';

export const EYE = 1.7;
const RADIUS = 0.45;

export function walkGround(grid: Grid, x: number, z: number) {
  return grid.get(x, z) & BIT.deck ? roadY(x, z) + 0.1 : heightAt(x, z);
}

/** Walls, structures, open water (bridges excepted) and the city edge stop a walker. */
export function walkBlocked(grid: Grid, x: number, z: number) {
  for (const [dx, dz] of [
    [RADIUS, 0],
    [-RADIUS, 0],
    [0, RADIUS],
    [0, -RADIUS],
    [0, 0],
  ]) {
    const c = grid.get(x + dx, z + dz);
    if (c & BIT.solid || (c & BIT.water && !(c & BIT.deck))) return true;
  }
  return false;
}

/** Nearest walkable spot to (x, z), preferring a street, searched in growing rings. */
export function freeSpot(grid: Grid, x: number, z: number): [number, number] {
  for (const street of [true, false]) {
    for (let r = 0; r < 200; r += 2) {
      const steps = r === 0 ? 1 : 24;
      for (let a = 0; a < steps; a++) {
        const px = x + Math.cos((a / steps) * Math.PI * 2) * r;
        const pz = z + Math.sin((a / steps) * Math.PI * 2) * r;
        if ((!street || grid.get(px, pz) & BIT.road) && !walkBlocked(grid, px, pz)) return [px, pz];
      }
    }
  }
  return [x, z];
}
