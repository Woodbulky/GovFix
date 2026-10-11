import { describe, expect, it } from 'vitest';
import { city } from '../gen/layout';
import {
  applyFilter,
  breachByWard,
  clusterByWard,
  fromPublic,
  fromRequests,
  type Marker,
  mergeOwn,
  nextByDeadline,
  pickRefusal,
  type VisibleRequest,
} from './data';
import { resolveFlyTarget } from './resolve';

const req = (over: Partial<VisibleRequest>): VisibleRequest => ({
  id: 'r1',
  ticket_no: 'NMC-2026-000142',
  category_code: 'water_leak',
  state: 'IN_PROGRESS',
  ward_id: 7,
  landmark_id: null,
  loc_x: 12,
  loc_z: -88,
  sla_status_of: 'on_track',
  escalation_level: 0,
  submitted_at: '2026-10-11T08:00:00Z',
  resolution_due_at: '2026-10-12T08:00:00Z',
  assigned_officer_id: 'officer',
  citizen_id: 'sunita',
  photos: [{ storage_path: 'sunita/a.jpg', kind: 'report' }],
  ...over,
});
const opts = {
  uid: 'sunita',
  nowMs: Date.parse('2026-10-11T11:00:00Z'),
  landmark: (id: number) => city.landmarks[id - 1],
};

describe('city markers', () => {
  it('anonymous pins carry no id, ticket, text or photos', () => {
    const [m] = fromPublic([
      {
        category_code: 'pothole',
        state: 'TRIAGED',
        ward_id: 3,
        x: 400,
        z: -25,
        sla_status: 'at_risk',
        escalation_level: 1,
        age_hours: 5,
      },
    ]);
    expect(m.id).toBeNull();
    expect(m.ticket).toBeNull();
    expect(m.photos).toEqual([]);
    expect(m.key).not.toMatch(/[0-9a-f]{8}-/);
  });

  it('a visible request keeps its photos, age in sim hours and owner flag', () => {
    const [m] = fromRequests([req({})], opts);
    expect(m).toMatchObject({ id: 'r1', ticket: 'NMC-2026-000142', ageHours: 3, mine: true, x: 12, z: -88 });
    expect(m.photos).toHaveLength(1);
  });

  it('falls back to the landmark, then the ward centre, when there are no coordinates', () => {
    const [onLandmark, onWard] = fromRequests(
      [req({ id: 'a', loc_x: null, loc_z: null, landmark_id: 1 }), req({ id: 'b', loc_x: null, loc_z: null })],
      opts,
    );
    expect([onLandmark.x, onLandmark.z]).toEqual([city.landmarks[0].x, city.landmarks[0].z]);
    expect(onWard.ward_id).toBe(7);
    expect(Number.isFinite(onWard.x)).toBe(true);
  });

  it("a citizen's own complaint replaces its anonymous twin instead of showing twice", () => {
    const pub = fromPublic([
      {
        category_code: 'water_leak',
        state: 'IN_PROGRESS',
        ward_id: 7,
        x: 0,
        z: -100,
        sla_status: 'on_track',
        escalation_level: 0,
        age_hours: 3,
      },
      {
        category_code: 'pothole',
        state: 'TRIAGED',
        ward_id: 7,
        x: 0,
        z: -100,
        sla_status: 'on_track',
        escalation_level: 0,
        age_hours: 3,
      },
    ]);
    const own = fromRequests([req({})], opts);
    const merged = mergeOwn(pub, own);
    expect(merged).toHaveLength(2);
    expect(merged.filter((m) => m.category === 'water_leak')).toEqual(own);
  });

  const set: Marker[] = fromRequests(
    [
      req({ id: 'a', sla_status_of: 'breached', resolution_due_at: '2026-10-11T09:00:00Z' }),
      req({ id: 'b', category_code: 'pothole', ward_id: 3, citizen_id: 'x', assigned_officer_id: 'y' }),
      req({ id: 'c', state: 'RESOLVED', sla_status_of: 'done' }),
      req({ id: 'd', state: 'CLOSED', sla_status_of: 'done', ward_id: 3 }),
    ],
    opts,
  );

  it('filters like filter_city: category, status, ward, mine', () => {
    expect(applyFilter(set, { category: 'pothole' }).map((m) => m.id)).toEqual(['b']);
    expect(applyFilter(set, { status: 'open' }).map((m) => m.id)).toEqual(['a', 'b']);
    expect(applyFilter(set, { status: 'past_deadline' }).map((m) => m.id)).toEqual(['a']);
    expect(applyFilter(set, { status: 'resolved' }).map((m) => m.id)).toEqual(['c', 'd']);
    expect(applyFilter(set, { ward_id: 3 }).map((m) => m.id)).toEqual(['b', 'd']);
    expect(applyFilter(set, { mine: true }).map((m) => m.id)).toEqual(['a', 'c', 'd']);
  });

  it('clusters per ward with the worst status, and counts past-deadline requests', () => {
    const c = clusterByWard(set);
    expect(c.map((x) => [x.ward_id, x.count, x.worst, x.breached])).toEqual([
      [3, 2, 'on_track', 0],
      [7, 2, 'breached', 1],
    ]);
    expect(breachByWard(set)).toEqual({ 7: 1 });
    expect(nextByDeadline(set)?.id).toBe('a');
  });
});

describe('picker rule (mirrors locate_point)', () => {
  const [rx, rz] = city.river.points[3];
  it('refuses open water and points outside the city, accepts land and bridges', () => {
    expect(pickRefusal(rx, rz)).toBe('river');
    expect(pickRefusal(5000, 0)).toBe('outside');
    expect(pickRefusal(0, -100)).toBeNull();
    const b = city.river.bridges[0];
    expect(pickRefusal(b.x, b.z)).toBeNull();
  });
});

describe("NIVA's fly_to resolver", () => {
  const markers = fromRequests([req({})], opts);
  it('finds wards by number or name, landmarks by alias, tickets the viewer can see', () => {
    expect(resolveFlyTarget({ target_type: 'ward', value: 'Ward 7' }, markers, 'en')).toMatchObject({
      label: 'Ghantaghar',
    });
    expect(resolveFlyTarget({ target_type: 'ward', value: 'घंटाघर' }, markers, 'mr')).toMatchObject({ kind: 'place' });
    expect(resolveFlyTarget({ target_type: 'landmark', value: 'clock tower' }, markers, 'en')).toMatchObject({
      label: 'Ghantaghar Chowk',
    });
    expect(resolveFlyTarget({ target_type: 'ticket', value: '142' }, markers, 'en')).toMatchObject({ kind: 'ticket' });
  });
  it('never guesses', () => {
    expect(resolveFlyTarget({ target_type: 'landmark', value: 'Eiffel Tower' }, markers, 'en')).toBeNull();
    expect(resolveFlyTarget({ target_type: 'ticket', value: 'NMC-2026-000999' }, markers, 'en')).toBeNull();
    expect(resolveFlyTarget({ target_type: 'ward', value: '42' }, markers, 'en')).toBeNull();
  });
});
