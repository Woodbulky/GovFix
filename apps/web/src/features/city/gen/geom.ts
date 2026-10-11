// 2D helpers in city metres (x east, z south).

export type Pt = [number, number];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ray-casting point-in-polygon. */
export function inPolygon(x: number, z: number, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Area centroid (shoelace), same maths as scripts/gen-city-seed.ts. */
export function centroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cz = 0;
  poly.forEach(([x0, z0], i) => {
    const [x1, z1] = poly[(i + 1) % poly.length];
    const f = x0 * z1 - x1 * z0;
    a += f;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
  });
  return [cx / (3 * a), cz / (3 * a)];
}

export function bbox(poly: Pt[]) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of poly) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, minZ, maxX, maxZ };
}

/** Distance from (x, z) to segment a-b, plus the parameter t along it. */
export function segDist(x: number, z: number, a: Pt, b: Pt): { d: number; t: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / len2, 0, 1);
  const px = a[0] + dx * t - x;
  const pz = a[1] + dz * t - z;
  return { d: Math.hypot(px, pz), t };
}

/** Nearest point on a polyline: distance, segment index and unit direction there. */
export function polyDist(x: number, z: number, pts: Pt[]) {
  let best = { d: Infinity, i: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const r = segDist(x, z, pts[i], pts[i + 1]);
    if (r.d < best.d) best = { d: r.d, i, t: r.t };
  }
  const a = pts[best.i];
  const b = pts[best.i + 1] ?? a;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { ...best, dir: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] as Pt };
}

export function polyLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** Resample a polyline every `step` metres (keeps both ends). Each sample carries its unit direction. */
export function resample(pts: Pt[], step: number): { p: Pt; dir: Pt; s: number }[] {
  const out: { p: Pt; dir: Pt; s: number }[] = [];
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const dir: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir, s: s0 + len * t });
    }
    s0 += len;
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  out.push({ p: [last[0], last[1]], dir: prev ? prev.dir : [1, 0], s: s0 });
  return out;
}
