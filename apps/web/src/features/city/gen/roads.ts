// Road network: arterial and main roads from the layout, plus seeded lanes inside each ward.
import { bbox, centroid, inPolygon, polyDist, polyLength, type Pt } from './geom';
import { city, ROAD_WIDTH, type RoadType, type Zone } from './layout';
import { noise1, rng } from './prng';
import { keepOut } from './zones';

export type Road = { name?: string; type: RoadType; width: number; points: Pt[] };

/** Lane grid per ward character: spacing (m), wobble (m), grid rotation (deg), share of runs dropped, width (m). */
const LANES: Record<Zone, { spacing: number; wobble: number; rot: number; drop: number; width: number }> = {
  old_city: { spacing: 72, wobble: 11, rot: 9, drop: 0.25, width: 7 },
  riverfront: { spacing: 105, wobble: 6, rot: 4, drop: 0.3, width: 7 },
  commercial: { spacing: 95, wobble: 2, rot: 0, drop: 0.2, width: 8 },
  campus: { spacing: 190, wobble: 0, rot: 0, drop: 0.45, width: 8 },
  societies: { spacing: 165, wobble: 0, rot: 0, drop: 0.15, width: 9 },
  industrial: { spacing: 190, wobble: 0, rot: 0, drop: 0.2, width: 12 },
  centre: { spacing: 92, wobble: 2, rot: 0, drop: 0.15, width: 8 },
  foothills: { spacing: 120, wobble: 18, rot: 12, drop: 0.35, width: 6 },
  residential: { spacing: 78, wobble: 0, rot: 0, drop: 0.1, width: 7 },
  new_extension: { spacing: 130, wobble: 0, rot: 0, drop: 0.3, width: 12 },
};

const STEP = 12;

function majors(): Road[] {
  return city.roads.map((r) => ({ name: r.name, type: r.type, width: ROAD_WIDTH[r.type], points: r.points }));
}

/** A lane sample is unusable inside keep-out areas, or when it would run alongside a bigger road. */
function laneBlocked(x: number, z: number, dir: Pt, big: Road[]): boolean {
  if (keepOut(x, z, 2)) return true;
  for (const r of big) {
    const n = polyDist(x, z, r.points);
    const parallel = Math.abs(n.dir[0] * dir[0] + n.dir[1] * dir[1]) > 0.8;
    if (parallel && n.d < r.width / 2 + 26) return true;
  }
  return false;
}

function wardLanes(ward: (typeof city.wards)[number], big: Road[]): Road[] {
  const p = LANES[ward.zone];
  const r = rng(city.seed, `lanes-${ward.id}`);
  const [cx, cz] = centroid(ward.polygon);
  const b = bbox(ward.polygon);
  const extent = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 20;
  const out: Road[] = [];

  for (const axis of [0, 1]) {
    const ang = (r.range(-p.rot, p.rot) * Math.PI) / 180 + (axis ? Math.PI / 2 : 0);
    const u: Pt = [Math.cos(ang), Math.sin(ang)]; // along the lane
    const v: Pt = [-u[1], u[0]]; // across
    const phase = r.range(0, p.spacing);
    for (let off = -extent + phase; off < extent; off += p.spacing * r.range(0.85, 1.15)) {
      const seed = r.int(1, 1e9);
      let run: Pt[] = [];
      const flush = () => {
        if (run.length > 1 && polyLength(run) >= 48 && !r.chance(p.drop)) {
          out.push({ type: 'lane', width: p.width, points: run });
        }
        run = [];
      };
      for (let s = -extent; s <= extent; s += STEP) {
        const w = p.wobble * noise1(seed, s / 85);
        const x = cx + u[0] * s + v[0] * (off + w);
        const z = cz + u[1] * s + v[1] * (off + w);
        const ok = inPolygon(x, z, ward.polygon) && !laneBlocked(x, z, u, big);
        if (ok) run.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
        else flush();
        // Old-city lanes jog and stop: break runs now and then.
        if (ok && p.wobble > 8 && r.chance(0.025)) flush();
      }
      flush();
    }
  }
  return out;
}

let cache: Road[] | null = null;

/** Deterministic: the same layout always gives the same network. */
export function buildRoadNetwork(): Road[] {
  if (cache) return cache;
  const big = majors();
  cache = [...big, ...city.wards.flatMap((w) => wardLanes(w, big))];
  return cache;
}
