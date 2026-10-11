// What NIVA's fly_to heard, resolved to a place or a visible ticket. Pure, so it is unit-tested; tools.ts acts on it.
import { centroid } from '../gen/geom';
import { city } from '../gen/layout';
import type { Marker } from './data';

export type FlyToArgs = { target_type: 'ward' | 'landmark' | 'ticket'; value: string | number };

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

export type FlyHit =
  | { kind: 'place'; x: number; z: number; distance: number; label: string }
  | { kind: 'ticket'; marker: Marker; label: string }
  | null;

/** Resolves what NIVA heard to a place. Never guesses: no match means null. */
export function resolveFlyTarget({ target_type, value }: FlyToArgs, markers: Marker[], lang: string): FlyHit {
  const v = norm(String(value));
  if (target_type === 'ward') {
    const n = Number(v.replace(/\D/g, ''));
    const w = city.wards.find((x) => x.id === n || [x.name.en, x.name.hi, x.name.mr].some((name) => norm(name) === v));
    if (!w) return null;
    const [x, z] = centroid(w.polygon);
    return { kind: 'place', x, z, distance: 1100, label: w.name[lang as 'en'] ?? w.name.en };
  }
  if (target_type === 'landmark') {
    const keys = (l: (typeof city.landmarks)[number]) => [l.name.en, l.name.hi, l.name.mr, ...l.aliases].map(norm);
    const l =
      city.landmarks.find((x) => keys(x).includes(v)) ?? city.landmarks.find((x) => keys(x).some((k) => v.includes(k)));
    if (!l) return null;
    return { kind: 'place', x: l.x, z: l.z, distance: 240, label: l.name[lang as 'en'] ?? l.name.en };
  }
  const digits = v.replace(/\D/g, '');
  const m = markers.find(
    (x) => x.ticket && (norm(x.ticket) === v || (digits && Number(x.ticket.slice(-6)) === Number(digits.slice(-6)))),
  );
  return m ? { kind: 'ticket', marker: m, label: m.ticket! } : null;
}
