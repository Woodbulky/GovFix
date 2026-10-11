// Explorer state shared by the 3D scene, the overlay UI and NIVA's fly_to / filter_city tools (tools.ts).
import { create } from 'zustand';
import type { CityFilter } from './markers/data';

export type Mode = 'overview' | 'fly' | 'walk';
export type LayerKey = 'complaints' | 'props' | 'heat' | 'wards' | 'labels' | 'traffic' | 'followSim';

export type FlyTarget = {
  x: number;
  z: number;
  /** Camera distance from the target, metres. */
  distance: number;
  label: string;
};

type CityState = {
  mode: Mode;
  layers: Record<LayerKey, boolean>;
  /** 0 full, 1 no shadows, 2 no traffic, 3 lower resolution (PerformanceMonitor steps down). */
  quality: number;
  flyTarget: (FlyTarget & { nonce: number }) | null;
  /** Camera on the ground plane, for the minimap. Heading in radians, 0 = north, clockwise. Distance: camera to that point. */
  cam: { x: number; z: number; heading: number; height: number; distance: number };
  locked: boolean;
  announcement: string;
  /** Marker key of the open pin (request id when visible, positional key for anonymous pins). */
  selected: string | null;
  filter: CityFilter;
  setMode: (m: Mode) => void;
  toggleLayer: (k: LayerKey) => void;
  flyTo: (t: FlyTarget) => void;
  setCam: (c: CityState['cam']) => void;
  setQuality: (q: number) => void;
  setLocked: (l: boolean) => void;
  announce: (s: string) => void;
  select: (key: string | null) => void;
  setFilter: (f: CityFilter) => void;
  setLayer: (k: LayerKey, on: boolean) => void;
};

export const useCity = create<CityState>((set) => ({
  mode: 'overview',
  layers: { complaints: true, props: true, heat: false, wards: true, labels: true, traffic: true, followSim: true },
  quality: 0,
  flyTarget: null,
  cam: { x: 0, z: 0, heading: 0, height: 900, distance: 1400 },
  locked: false,
  announcement: '',
  selected: null,
  filter: {},
  setMode: (mode) => set({ mode, locked: false }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  flyTo: (t) => set({ flyTarget: { ...t, nonce: Date.now() }, mode: 'overview', announcement: t.label }),
  setCam: (cam) => set({ cam }),
  setQuality: (quality) => set({ quality }),
  setLocked: (locked) => set({ locked }),
  announce: (announcement) => set({ announcement }),
  select: (selected) => set({ selected }),
  setFilter: (filter) => set({ filter }),
  setLayer: (k, on) => set((s) => ({ layers: { ...s.layers, [k]: on } })),
}));
