// DOM overlays anchored to world points (pins, ward bubbles, photo frames). The overlay is ordinary React DOM
// outside the Canvas (real fonts, focusable buttons, app context); scene/Projector.tsx moves each registered
// element to its point on every rendered frame. No three.js here, so the page shell stays light.

export type Anchor = {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
  /** Hide beyond this camera distance (metres). */
  maxDist?: number;
  /** Shrink with distance like a real object (photo frames in walk mode); pins keep their size. */
  worldSize?: number;
};

export const anchors = new Map<string, Anchor>();
/** Bumped when anchors change, so a `frameloop="demand"` canvas draws once and places new elements. */
export const anchorEvents = new EventTarget();

export function setAnchor(id: string, a: Anchor | null) {
  if (a) {
    a.el.style.visibility = 'hidden'; // until the first projection
    anchors.set(id, a);
  } else anchors.delete(id);
  anchorEvents.dispatchEvent(new Event('change'));
}
