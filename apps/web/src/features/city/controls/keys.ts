// Overview camera handle and keyboard map. Kept free of runtime three.js imports so the page shell stays light.
import type CameraControlsImpl from 'camera-controls';

/** Set by <Overview> while it is mounted. */
export const overviewControls: { current: CameraControlsImpl | null } = { current: null };

/** Keyboard for overview: arrows pan, +/- zoom, Q/E rotate, PageUp/PageDown tilt. Returns true if handled. */
export function overviewKey(key: string, shift: boolean): boolean {
  const c = overviewControls.current;
  if (!c) return false;
  const step = Math.max(20, c.distance * 0.15) * (shift ? 3 : 1);
  const map: Record<string, () => unknown> = {
    ArrowUp: () => c.forward(step, true),
    ArrowDown: () => c.forward(-step, true),
    ArrowLeft: () => c.truck(-step, 0, true),
    ArrowRight: () => c.truck(step, 0, true),
    '+': () => c.dolly(c.distance * 0.3, true),
    '=': () => c.dolly(c.distance * 0.3, true),
    '-': () => c.dolly(-c.distance * 0.4, true),
    q: () => c.rotate(-0.25, 0, true),
    e: () => c.rotate(0.25, 0, true),
    PageUp: () => c.rotate(0, -0.15, true),
    PageDown: () => c.rotate(0, 0.15, true),
  };
  const fn = map[key] ?? map[key.toLowerCase()];
  if (!fn) return false;
  fn();
  return true;
}
