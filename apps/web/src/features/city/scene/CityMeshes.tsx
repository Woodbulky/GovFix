// Static merged meshes and instanced buildings, roofs, tanks, awnings, trees and streetlights.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CityData } from '../gen/city';
import { fromBuilt, geometries } from './geometries';
import { materials } from './materials';

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/** Fill an InstancedMesh from the worker layout: x, y, z, rotY, sx, sy, sz[, r, g, b]. */
function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  data: Float32Array,
  stride: number,
  opts: { colors?: boolean; scale?: boolean; shadows?: boolean } = {},
) {
  const count = Math.floor(data.length / stride);
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  for (let i = 0; i < count; i++) {
    const o = i * stride;
    dummy.position.set(data[o], data[o + 1], data[o + 2]);
    dummy.rotation.set(0, data[o + 3], 0);
    if (opts.scale !== false) dummy.scale.set(data[o + 4], data[o + 5], data[o + 6]);
    else dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (opts.colors !== false) mesh.setColorAt(i, color.setRGB(data[o + 7], data[o + 8], data[o + 9]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = opts.shadows ?? true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function useCityObjects(data: CityData) {
  return useMemo(() => {
    const m = materials();
    const g = geometries();
    const i = data.instances;
    const mesh = (built: CityData['meshes'][keyof CityData['meshes']], mat: THREE.Material, shadows = false) => {
      const x = new THREE.Mesh(fromBuilt(built), mat);
      x.receiveShadow = true;
      x.castShadow = shadows;
      x.matrixAutoUpdate = false;
      return x;
    };
    const wards = mesh(data.meshes.wards, m.wards);
    wards.receiveShadow = false;
    wards.renderOrder = 2;
    return {
      statics: [
        mesh(data.meshes.ground, m.ground),
        mesh(data.meshes.far, m.ground),
        mesh(data.meshes.asphalt, m.road),
        mesh(data.meshes.detail, m.roadDetail),
        mesh(data.meshes.water, m.water),
        mesh(data.meshes.structures, m.structure, true),
      ],
      wards,
      instances: [
        instanced(g.building, [m.walls, m.roofTop], i.body, 10),
        instanced(g.building, [m.frameWalls, m.roofTop], i.frame, 10),
        instanced(g.hipRoof, m.plain, i.hipRoof, 10),
        instanced(g.gableRoof, m.plain, i.gableRoof, 10),
        instanced(g.tank, m.plain, i.tank, 10, { shadows: false }),
        instanced(g.box, m.plain, i.awning, 10, { shadows: false }),
        instanced(g.trunk, m.trunk, i.trees, 10, { colors: false, shadows: false }),
        instanced(g.canopy, m.canopy, i.trees, 10),
        instanced(g.pole, m.pole, i.lights, 4, { colors: false, scale: false, shadows: false }),
        instanced(g.lamp, m.lamp, i.lights, 4, { colors: false, scale: false, shadows: false }),
      ],
    };
  }, [data]);
}

export function CityMeshes({ data, showWards }: { data: CityData; showWards: boolean }) {
  const objects = useCityObjects(data);
  useEffect(
    () => () => {
      // Geometries made from worker data belong to this mount; shared unit geometries and materials stay cached.
      objects.statics.forEach((o) => o.geometry.dispose());
      objects.wards.geometry.dispose();
      objects.instances.forEach((o) => o.dispose());
    },
    [objects],
  );
  return (
    <group>
      {objects.statics.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
      {objects.instances.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
      <primitive object={objects.wards} visible={showWards} />
    </group>
  );
}
