// Complaint markers in the city: one shape for anonymous public_markers() rows and RLS-visible requests.
// Pure, so filtering, clustering and the picker's river rule are unit-tested without WebGL.
import type { SlaStatus } from '@/components/SlaBadge';
import { polyDist } from '../gen/geom';
import { city, ROAD_WIDTH, wardAt } from '../gen/layout';
import { RIVER_HALF } from '../gen/terrain';

export type MarkerPhoto = { storage_path: string; kind: string };

export type Marker = {
  /** Request id when the viewer may see the request; otherwise a positional key with no id in it. */
  key: string;
  id: string | null;
  ticket: string | null;
  x: number;
  z: number;
  category: string | null;
  state: string;
  ward_id: number;
  sla: SlaStatus;
  level: number;
  ageHours: number;
  dueAt: string | null;
  /** The viewer's own complaint (citizen) or assigned work (officer). */
  mine: boolean;
  /** Only present for requests the viewer is allowed to see in full (owner and staff). */
  photos: MarkerPhoto[];
};

export type PublicMarkerRow = {
  category_code: string | null;
  state: string;
  ward_id: number;
  x: number;
  z: number;
  sla_status: string;
  escalation_level: number;
  age_hours: number;
};

export type VisibleRequest = {
  id: string;
  ticket_no: string;
  category_code: string | null;
  category_hint?: string | null;
  state: string;
  ward_id: number | null;
  landmark_id: number | null;
  loc_x: number | null;
  loc_z: number | null;
  sla_status_of: string | null;
  escalation_level: number;
  submitted_at: string;
  resolution_due_at: string | null;
  assigned_officer_id: string | null;
  citizen_id: string;
  photos?: MarkerPhoto[];
};

export type CityFilter = {
  category?: string;
  status?: 'open' | 'past_deadline' | 'resolved' | 'all';
  ward_id?: number;
  mine?: boolean;
};

const DONE = new Set(['RESOLVED', 'CLOSED', 'REJECTED']);
export const isOpen = (m: Pick<Marker, 'state'>) => !DONE.has(m.state);
/** Issue props stand in the street only while the problem is still there. */
export const showsProp = isOpen;

export function fromPublic(rows: PublicMarkerRow[]): Marker[] {
  return rows.map((r, i) => ({
    key: `p${i}:${r.x}:${r.z}`,
    id: null,
    ticket: null,
    x: r.x,
    z: r.z,
    category: r.category_code,
    state: r.state,
    ward_id: r.ward_id,
    sla: (r.sla_status ?? 'untriaged') as SlaStatus,
    level: r.escalation_level ?? 0,
    ageHours: r.age_hours ?? 0,
    dueAt: null,
    mine: false,
    photos: [],
  }));
}

/** Requests without coordinates sit on their landmark, else the ward centre (same fallback as public_markers()). */
export function fromRequests(
  rows: VisibleRequest[],
  opts: { uid: string | null; nowMs: number; landmark: (id: number) => { x: number; z: number } | undefined },
): Marker[] {
  const out: Marker[] = [];
  for (const r of rows) {
    if (r.ward_id == null) continue;
    const lm = r.landmark_id != null ? opts.landmark(r.landmark_id) : undefined;
    const w = city.wards.find((x) => x.id === r.ward_id);
    const cx = w ? w.polygon.reduce((a, p) => a + p[0], 0) / w.polygon.length : 0;
    const cz = w ? w.polygon.reduce((a, p) => a + p[1], 0) / w.polygon.length : 0;
    out.push({
      key: r.id,
      id: r.id,
      ticket: r.ticket_no,
      x: r.loc_x ?? lm?.x ?? cx,
      z: r.loc_z ?? lm?.z ?? cz,
      category: r.category_code ?? r.category_hint ?? null,
      state: r.state,
      ward_id: r.ward_id,
      sla: (r.sla_status_of ?? 'untriaged') as SlaStatus,
      level: r.escalation_level ?? 0,
      ageHours: Math.max(0, Math.round((opts.nowMs - new Date(r.submitted_at).getTime()) / 3_600_000)),
      dueAt: r.resolution_due_at,
      mine: !!opts.uid && (r.citizen_id === opts.uid || r.assigned_officer_id === opts.uid),
      photos: r.photos ?? [],
    });
  }
  return out;
}

const round25 = (v: number) => Math.round(v / 25) * 25;

/**
 * A citizen sees everyone's anonymous pins plus their own in full. Drop the anonymous twin of each own
 * request (same rounded spot, category and state) so it isn't drawn twice.
 */
export function mergeOwn(publicMarkers: Marker[], own: Marker[]): Marker[] {
  const left = [...publicMarkers];
  for (const m of own) {
    const i = left.findIndex(
      (p) => p.x === round25(m.x) && p.z === round25(m.z) && p.category === m.category && p.state === m.state,
    );
    if (i >= 0) left.splice(i, 1);
  }
  return [...left, ...own];
}

export function applyFilter(markers: Marker[], f: CityFilter): Marker[] {
  const status = f.status ?? 'all';
  return markers.filter(
    (m) =>
      (!f.category || m.category === f.category) &&
      (!f.ward_id || m.ward_id === f.ward_id) &&
      (!f.mine || m.mine) &&
      (status === 'all' ||
        (status === 'open' && isOpen(m)) ||
        (status === 'past_deadline' && isOpen(m) && m.sla === 'breached') ||
        (status === 'resolved' && (m.state === 'RESOLVED' || m.state === 'CLOSED'))),
  );
}

export const filterActive = (f: CityFilter) =>
  !!(f.category || f.ward_id || f.mine || (f.status && f.status !== 'all'));

/** Worst first: a ward bubble takes the colour of its most urgent pin. */
const RANK: SlaStatus[] = ['breached', 'at_risk', 'untriaged', 'paused', 'on_track', 'done'];
export const slaRank = (s: SlaStatus) => RANK.indexOf(s);
export const worse = (a: SlaStatus, b: SlaStatus) => (slaRank(a) <= slaRank(b) ? a : b);

export type Cluster = { ward_id: number; count: number; breached: number; worst: SlaStatus; x: number; z: number };

export function clusterByWard(markers: Marker[]): Cluster[] {
  const by = new Map<number, Cluster>();
  for (const m of markers) {
    const c = by.get(m.ward_id);
    if (!c) {
      const w = city.wards.find((x) => x.id === m.ward_id);
      const [x, z] = w
        ? [
            w.polygon.reduce((a, p) => a + p[0], 0) / w.polygon.length,
            w.polygon.reduce((a, p) => a + p[1], 0) / w.polygon.length,
          ]
        : [m.x, m.z];
      by.set(m.ward_id, { ward_id: m.ward_id, count: 1, breached: Number(m.sla === 'breached'), worst: m.sla, x, z });
    } else {
      c.count++;
      c.breached += Number(m.sla === 'breached');
      c.worst = worse(c.worst, m.sla);
    }
  }
  return [...by.values()].sort((a, b) => a.ward_id - b.ward_id);
}

/** Past-deadline open requests per ward, for the heat layer and its text list. */
export function breachByWard(markers: Marker[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of markers) if (isOpen(m) && m.sla === 'breached') out[m.ward_id] = (out[m.ward_id] ?? 0) + 1;
  return out;
}

/** The open request with the soonest deadline (past-deadline ones first), for "Next by deadline". */
export function nextByDeadline(markers: Marker[]): Marker | undefined {
  return markers
    .filter((m) => isOpen(m) && m.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0];
}

/**
 * Mirrors locate_point() in SQL (outside every ward, or open water not on a bridge-carrying road), so the
 * picker answers at once. The database still decides when the complaint is filed.
 */
export function pickRefusal(x: number, z: number): 'outside' | 'river' | null {
  if (!wardAt(x, z)) return 'outside';
  if (polyDist(x, z, city.river.points).d >= RIVER_HALF) return null;
  const onDeck = city.roads.some((r) => r.type !== 'lane' && polyDist(x, z, r.points).d <= ROAD_WIDTH[r.type] / 2 + 1);
  return onDeck ? null : 'river';
}
