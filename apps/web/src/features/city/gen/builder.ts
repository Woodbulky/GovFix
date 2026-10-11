// Tiny geometry builder for merged, vertex-coloured static meshes (runs in the worker, no three.js needed).

export type RGB = [number, number, number];

/** '#rrggbb' (sRGB) -> linear RGB, which is what three.js expects for vertex and instance colours. */
export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

export const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

export type Built = { position: Float32Array; normal: Float32Array; color: Float32Array };

type V3 = [number, number, number];

export class GeoBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];

  get vertexCount() {
    return this.pos.length / 3;
  }

  tri(a: V3, b: V3, c: V3, color: RGB) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0], color[1], color[2]);
    }
  }

  /** Quad a-b-c-d, counter-clockwise when seen from the front. */
  quad(a: V3, b: V3, c: V3, d: V3, color: RGB) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Box standing on y0, rotated by `rot` (radians, about y, same sense as the 2D grid). No bottom face. */
  box(cx: number, y0: number, cz: number, w: number, h: number, d: number, rot: number, color: RGB, top?: RGB) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const at = (lu: number, lv: number, y: number): V3 => [cx + lu * c - lv * s, y, cz + lu * s + lv * c];
    const hw = w / 2;
    const hd = d / 2;
    const y1 = y0 + h;
    const p = [at(-hw, -hd, 0), at(hw, -hd, 0), at(hw, hd, 0), at(-hw, hd, 0)];
    const b = p.map(([x, , z]) => [x, y0, z] as V3);
    const t = p.map(([x, , z]) => [x, y1, z] as V3);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(b[j], b[i], t[i], t[j], color);
    }
    this.quad(t[3], t[2], t[1], t[0], top ?? color);
  }

  /** Vertical cylinder (or frustum when r1 differs), optional top cap. */
  cylinder(cx: number, y0: number, cz: number, r0: number, h: number, seg: number, color: RGB, r1 = r0, cap = true) {
    const y1 = y0 + h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, r: number, y: number): V3 => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad(p(a1, r0, y0), p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1), color);
      if (cap && r1 > 0) this.tri([cx, y1, cz], p(a1, r1, y1), p(a0, r1, y1), color);
    }
  }

  /** Pyramid / cone with `seg` sides on a circle of radius r (seg 4 + rot pi/4 gives a square hip roof). */
  cone(cx: number, y0: number, cz: number, r: number, h: number, seg: number, color: RGB, rot = 0) {
    for (let i = 0; i < seg; i++) {
      const a0 = rot + (i / seg) * Math.PI * 2;
      const a1 = rot + ((i + 1) / seg) * Math.PI * 2;
      this.tri(
        [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r],
        [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r],
        [cx, y0 + h, cz],
        color,
      );
    }
  }

  /** Flat polygon at height y (fan from the centroid: fine for the convex-ish parks and lake). */
  polygon(pts: [number, number][], y: number | ((x: number, z: number) => number), color: RGB) {
    // Fan winding must face up: flip polygons given in the other orientation.
    let area = 0;
    pts.forEach(([x0, z0], i) => {
      const [x1, z1] = pts[(i + 1) % pts.length];
      area += x0 * z1 - x1 * z0;
    });
    const points = area > 0 ? pts : [...pts].reverse();
    const n = points.length;
    const cx = points.reduce((s, p) => s + p[0], 0) / n;
    const cz = points.reduce((s, p) => s + p[1], 0) / n;
    const Y = typeof y === 'number' ? () => y : y;
    for (let i = 0; i < n; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[(i + 1) % n];
      this.tri([cx, Y(cx, cz), cz], [bx, Y(bx, bz), bz], [ax, Y(ax, az), az], color);
    }
  }

  build(): Built {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nor),
      color: new Float32Array(this.col),
    };
  }
}
