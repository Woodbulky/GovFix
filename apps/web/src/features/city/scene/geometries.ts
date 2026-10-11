// Unit geometries for instanced meshes, plus the conversion from worker output to BufferGeometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Built } from '../gen/builder';

export function fromBuilt(b: Built): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(b.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(b.color, 3));
  g.computeBoundingSphere();
  return g;
}

/** 1 m box standing on y = 0 with two groups: walls (0) and roof (1). No bottom face. */
function buildingBox() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const idx = g.index!.array;
  const face = (f: number) => Array.from(idx.slice(f * 6, f * 6 + 6));
  // Box faces: +x, -x, +y, -y, +z, -z.
  g.setIndex([...face(0), ...face(1), ...face(4), ...face(5), ...face(2)]);
  g.clearGroups();
  g.addGroup(0, 24, 0);
  g.addGroup(24, 6, 1);
  return g;
}

/** Gable roof: ridge along local x, base 1 x 1 on y = 0, ridge at y = 1. */
function gable() {
  const p = [
    // slopes
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0,
    0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    // gable ends
    0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

/** Rooftop water tank: 5 sides and a lid, no bottom (13 triangles instead of 28). */
function tank() {
  const g = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 5, 1, true).translate(0, 0.7, 0);
  const lid = new THREE.CircleGeometry(0.8, 5).rotateX(-Math.PI / 2).translate(0, 1.4, 0);
  return mergeGeometries([g.toNonIndexed(), lid.toNonIndexed()])!;
}

function streetlight() {
  const pole = new THREE.BoxGeometry(0.18, 8, 0.18).translate(0, 4, 0);
  const arm = new THREE.BoxGeometry(2.4, 0.12, 0.12).translate(1.1, 7.9, 0);
  return mergeGeometries([pole, arm])!;
}

let cached: ReturnType<typeof build> | null = null;
function build() {
  return {
    building: buildingBox(),
    hipRoof: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
    gableRoof: gable(),
    tank: tank(),
    box: new THREE.BoxGeometry(1, 1, 1),
    trunk: new THREE.CylinderGeometry(0.035, 0.05, 0.45, 3, 1, true).translate(0, 0.22, 0),
    canopy: new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.78, 1).translate(0, 0.66, 0),
    pole: streetlight(),
    lamp: new THREE.BoxGeometry(0.7, 0.18, 0.35).translate(2.2, 7.8, 0),
  };
}
export const geometries = () => (cached ??= build());
