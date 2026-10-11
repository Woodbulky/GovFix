// Map-like overview: drag to pan, scroll/pinch to zoom, right-drag or two fingers to rotate. Also runs fly-to.
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { city } from '../gen/layout';
import { heightAt } from '../gen/terrain';
import { useCity } from '../store';
import { overviewControls } from './keys';

const { ACTION } = CameraControlsImpl;
const { minX, maxX, minZ, maxZ } = city.bounds;

/** Where the camera is looking on the ground (or 80 m ahead when it looks up). */
export function lookPoint(camera: THREE.Camera) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const p = camera.position;
  if (dir.y < -0.05) {
    const t = Math.min(2500, (p.y - heightAt(p.x, p.z)) / -dir.y);
    return new THREE.Vector3(p.x + dir.x * t, 0, p.z + dir.z * t);
  }
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  return new THREE.Vector3(p.x + flat.x * 80, 0, p.z + flat.z * 80);
}

export const HOME = { pos: [760, 620, 980] as const, target: [0, 0, -60] as const };

export function Overview({ reducedMotion, homed }: { reducedMotion: boolean; homed: MutableRefObject<boolean> }) {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const flyTarget = useCity((s) => s.flyTarget);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    overviewControls.current = c;
    c.setBoundary(
      new THREE.Box3(new THREE.Vector3(minX - 200, -5, minZ - 200), new THREE.Vector3(maxX + 200, 400, maxZ + 200)),
    );
    c.boundaryEnclosesCamera = false;
    if (!homed.current) {
      homed.current = true;
      c.setLookAt(...HOME.pos, ...HOME.target, false);
    } else {
      // Coming back from fly or walk: keep the current view.
      const t = lookPoint(camera);
      c.setLookAt(camera.position.x, Math.max(camera.position.y, t.y + 8), camera.position.z, t.x, t.y, t.z, false);
    }
    return () => {
      overviewControls.current = null;
    };
    // Mount-only handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !flyTarget) return;
    const { x, z, distance } = flyTarget;
    const y = heightAt(x, z);
    const polar = 0.95;
    const az = c.azimuthAngle;
    void c.setLookAt(
      x + Math.sin(az) * Math.sin(polar) * distance,
      y + Math.cos(polar) * distance,
      z + Math.cos(az) * Math.sin(polar) * distance,
      x,
      y,
      z,
      !reducedMotion,
    );
  }, [flyTarget, reducedMotion]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={20}
      maxDistance={2800}
      maxPolarAngle={1.38}
      dollyToCursor
      smoothTime={reducedMotion ? 0 : 0.35}
      draggingSmoothTime={reducedMotion ? 0 : 0.12}
      mouseButtons={{ left: ACTION.TRUCK, middle: ACTION.DOLLY, right: ACTION.ROTATE, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_DOLLY_ROTATE, three: ACTION.TOUCH_ROTATE }}
    />
  );
}
