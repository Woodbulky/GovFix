// Typed view of layout/navnagar.json, the one source for the 3D city, the 2D map and the database seed.
import raw from '../layout/navnagar.json';
import { inPolygon, type Pt } from './geom';

export type Names = { en: string; hi: string; mr: string };
export type Zone =
  | 'old_city'
  | 'riverfront'
  | 'commercial'
  | 'campus'
  | 'societies'
  | 'industrial'
  | 'centre'
  | 'foothills'
  | 'residential'
  | 'new_extension';
export type RoadType = 'arterial' | 'main' | 'lane';

export type Layout = {
  seed: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  river: { name: Names; width: number; points: Pt[]; bridges: { name: string; style: string; x: number; z: number }[] };
  railway: { points: Pt[]; station: { x: number; z: number } };
  roads: { name: string; type: RoadType; points: Pt[] }[];
  wards: { id: number; name: Names; zone: Zone; polygon: Pt[] }[];
  landmarks: { name: Names; x: number; z: number; aliases: string[] }[];
  parks: { name: string; kind: 'garden' | 'ground' | 'forest'; polygon: Pt[] }[];
  lake: { name: string; polygon: Pt[] };
  hills: { name: string; x: number; z: number; radius: number; height: number; backdrop?: boolean }[];
  special: { type: string; x: number; z: number }[];
};

export const city = raw as unknown as Layout;

/** Road widths in metres (docs/CITY.md). Lanes in planned zones are wider. */
export const ROAD_WIDTH: Record<RoadType, number> = { arterial: 24, main: 14, lane: 7 };

export function wardAt(x: number, z: number) {
  return city.wards.find((w) => inPolygon(x, z, w.polygon));
}
