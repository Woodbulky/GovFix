// Past-deadline heat by ward: a translucent red wash draped over each ward with open past-deadline requests.
// Colour is never alone: ward labels and bubbles carry the count as text.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bbox, inPolygon } from '../gen/geom';
import { city } from '../gen/layout';
import { heightAt } from '../gen/terrain';

const STEP = 25;

/** Quads on a 25 m lattice inside the ward, lifted onto the terrain so the wash follows the hill. */
function wardSheet(polygon: [number, number][]) {
  const { minX, maxX, minZ, maxZ } = bbox(polygon);
  const pos: number[] = [];
  const y = (x: number, z: number) => heightAt(x, z) + 1.5;
  for (let z = minZ; z < maxZ; z += STEP)
    for (let x = minX; x < maxX; x += STEP) {
      const x1 = Math.min(maxX, x + STEP);
      const z1 = Math.min(maxZ, z + STEP);
      if (!inPolygon((x + x1) / 2, (z + z1) / 2, polygon)) continue;
      const q = [
        [x, z],
        [x, z1],
        [x1, z1],
        [x1, z],
      ];
      for (const i of [0, 1, 2, 0, 2, 3]) pos.push(q[i][0], y(q[i][0], q[i][1]), q[i][1]);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

let sheets: Map<number, THREE.BufferGeometry> | null = null;
const wardSheets = () => (sheets ??= new Map(city.wards.map((w) => [w.id, wardSheet(w.polygon)])));

export function HeatLayer({ breach }: { breach: Record<number, number> }) {
  const mats = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(breach).map(([id, n]) => [
          id,
          new THREE.MeshBasicMaterial({
            color: '#b91c1c', // --sla-breach
            transparent: true,
            opacity: Math.min(0.5, 0.14 + 0.09 * n),
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -8,
          }),
        ]),
      ),
    [breach],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return (
    <group renderOrder={3}>
      {Object.keys(mats).map((id) => (
        <mesh key={id} geometry={wardSheets().get(Number(id))} material={mats[id]} renderOrder={3} />
      ))}
    </group>
  );
}
