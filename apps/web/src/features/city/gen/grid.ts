// A 2 m occupancy grid over the city. Placement uses it to avoid overlaps; walk mode uses it for collisions.
import type { Pt } from './geom';
import { city } from './layout';

export const CELL = 2;
export const BIT = {
  solid: 1, // buildings and solid parts of special structures: walk mode can't enter
  road: 2,
  water: 4,
  rail: 8,
  reserved: 16, // parks, plazas, special forecourts: no generic buildings
  deck: 32, // bridge deck over water: walkable
  tree: 64,
} as const;

export class Grid {
  readonly minX = city.bounds.minX;
  readonly minZ = city.bounds.minZ;
  readonly nx = Math.ceil((city.bounds.maxX - city.bounds.minX) / CELL);
  readonly nz = Math.ceil((city.bounds.maxZ - city.bounds.minZ) / CELL);
  readonly cells: Uint8Array;

  constructor(cells?: Uint8Array) {
    this.cells = cells ?? new Uint8Array(this.nx * this.nz);
  }

  index(x: number, z: number): number {
    const i = Math.floor((x - this.minX) / CELL);
    const k = Math.floor((z - this.minZ) / CELL);
    if (i < 0 || k < 0 || i >= this.nx || k >= this.nz) return -1;
    return k * this.nx + i;
  }

  get(x: number, z: number): number {
    const i = this.index(x, z);
    return i < 0 ? BIT.solid : this.cells[i];
  }

  /** Mark a disc. */
  disc(x: number, z: number, r: number, bit: number) {
    for (let zz = z - r; zz <= z + r; zz += CELL) {
      for (let xx = x - r; xx <= x + r; xx += CELL) {
        if ((xx - x) ** 2 + (zz - z) ** 2 > r * r) continue;
        const i = this.index(xx, zz);
        if (i >= 0) this.cells[i] |= bit;
      }
    }
  }

  /** Visit every cell centre inside an oriented rectangle (centre, half sizes along its own axes, rotation). */
  private eachInRect(x: number, z: number, hw: number, hd: number, rot: number, fn: (i: number) => boolean | void) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ex = Math.abs(c * hw) + Math.abs(s * hd);
    const ez = Math.abs(s * hw) + Math.abs(c * hd);
    const i0 = Math.max(0, Math.floor((x - ex - this.minX) / CELL));
    const i1 = Math.min(this.nx - 1, Math.floor((x + ex - this.minX) / CELL));
    const k0 = Math.max(0, Math.floor((z - ez - this.minZ) / CELL));
    const k1 = Math.min(this.nz - 1, Math.floor((z + ez - this.minZ) / CELL));
    for (let k = k0; k <= k1; k++) {
      for (let i = i0; i <= i1; i++) {
        const dx = this.minX + (i + 0.5) * CELL - x;
        const dz = this.minZ + (k + 0.5) * CELL - z;
        // Local axes: u = (cos, sin) is width, v = (-sin, cos) is depth.
        const lu = dx * c + dz * s;
        const lv = -dx * s + dz * c;
        if (Math.abs(lu) <= hw && Math.abs(lv) <= hd && fn(k * this.nx + i) === false) return false;
      }
    }
    return true;
  }

  rect(x: number, z: number, hw: number, hd: number, rot: number, bit: number) {
    this.eachInRect(x, z, hw, hd, rot, (i) => {
      this.cells[i] |= bit;
    });
  }

  /** True when no cell in the rectangle has any of `mask`. Out-of-bounds counts as blocked. */
  free(x: number, z: number, hw: number, hd: number, rot: number, mask: number): boolean {
    if (this.index(x, z) < 0) return false;
    return this.eachInRect(x, z, hw, hd, rot, (i) => (this.cells[i] & mask ? false : undefined)) !== false;
  }

  /** Mark a polyline corridor of the given half width. */
  stroke(points: Pt[], half: number, bit: number) {
    for (let p = 0; p < points.length - 1; p++) {
      const [ax, az] = points[p];
      const [bx, bz] = points[p + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len === 0) continue;
      this.rect((ax + bx) / 2, (az + bz) / 2, len / 2 + half * 0.5, half, Math.atan2(bz - az, bx - ax), bit);
    }
  }
}
