// Fly (free camera) and Walk (1.7 m eye height, collides with buildings, stays on the ground and bridges).
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Grid } from '../gen/grid';
import { heightAt } from '../gen/terrain';
import { useCity } from '../store';
import { lookPoint } from './Overview';
import { EYE, freeSpot, walkBlocked, walkGround } from './walk';

const MOVE: Record<string, [number, number, number]> = {
  KeyW: [0, 0, 1],
  ArrowUp: [0, 0, 1],
  KeyS: [0, 0, -1],
  ArrowDown: [0, 0, -1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0],
  KeyQ: [0, -1, 0],
  KeyE: [0, 1, 0],
};
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

export function FirstPerson({ mode, grid }: { mode: 'fly' | 'walk'; grid: Grid }) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const setLocked = useCity((s) => s.setLocked);

  useEffect(() => {
    if (mode === 'walk') {
      // Stand on a street about 35 m back from what the overview was showing, and face it.
      const t = lookPoint(camera);
      const back = new THREE.Vector2(camera.position.x - t.x, camera.position.z - t.z).normalize();
      const [x, z] = freeSpot(grid, t.x + back.x * 35, t.z + back.y * 35);
      camera.position.set(x, walkGround(grid, x, z) + EYE, z);
      camera.lookAt(t.x, camera.position.y + 4, t.z);
    }
  }, [mode, camera, grid]);

  useEffect(() => {
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (MOVE[e.code] || e.code.startsWith('Arrow') || e.code === 'ShiftLeft' || e.code === 'ShiftRight')
        e.preventDefault();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    const dt = Math.min(delta, 0.1);
    const fast = k.has('ShiftLeft') || k.has('ShiftRight');
    // Keyboard look, for people not using the mouse.
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    const tilt = (k.has('PageUp') ? 1 : 0) - (k.has('PageDown') ? 1 : 0);
    if (turn || tilt) {
      euler.setFromQuaternion(camera.quaternion);
      euler.y += turn * 1.6 * dt;
      euler.x = THREE.MathUtils.clamp(euler.x + tilt * 1.0 * dt, -1.45, 1.45);
      camera.quaternion.setFromEuler(euler);
    }
    let mx = 0;
    let my = 0;
    let mz = 0;
    k.forEach((code) => {
      const m = MOVE[code];
      if (!m) return;
      mx += m[0];
      my += m[1];
      mz += m[2];
    });
    camera.getWorldDirection(fwd);
    if (mode === 'walk') fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    const speed = mode === 'fly' ? (fast ? 220 : 70) : fast ? 9 : 4.5;
    const step = new THREE.Vector3().addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (step.lengthSq() > 0) step.normalize().multiplyScalar(speed * dt);
    const p = camera.position;

    if (mode === 'fly') {
      p.add(step);
      p.y += my * speed * dt;
      p.x = THREE.MathUtils.clamp(p.x, -3500, 3500);
      p.z = THREE.MathUtils.clamp(p.z, -3500, 3500);
      p.y = THREE.MathUtils.clamp(p.y, heightAt(p.x, p.z) + 3, 1600);
      return;
    }
    // Walk: slide along walls by trying each axis on its own.
    if (!walkBlocked(grid, p.x + step.x, p.z)) p.x += step.x;
    if (!walkBlocked(grid, p.x, p.z + step.z)) p.z += step.z;
    const target = walkGround(grid, p.x, p.z) + EYE;
    p.y += (target - p.y) * Math.min(1, dt * 12);
  });

  return (
    <PointerLockControls
      selector="#city-canvas canvas"
      onLock={() => setLocked(true)}
      onUnlock={() => setLocked(false)}
    />
  );
}

/** Publishes where the user is (the look point in overview, the camera in fly/walk) for the minimap, ~5 times a second. */
export function CamTracker() {
  const setCam = useCity((s) => s.setCam);
  const mode = useCity((s) => s.mode);
  const last = useRef(0);
  const dir = useRef(new THREE.Vector3());
  // Wall clock, not r3f's: its clock restarts at 0 whenever the frameloop switches between always and demand.
  useFrame(({ camera }) => {
    const now = performance.now();
    if (now - last.current < 200) return;
    last.current = now;
    camera.getWorldDirection(dir.current);
    const at = mode === 'overview' ? lookPoint(camera) : camera.position;
    setCam({
      x: at.x,
      z: at.z,
      heading: Math.atan2(dir.current.x, -dir.current.z),
      height: camera.position.y,
      distance: camera.position.distanceTo(at),
    });
  });
  return null;
}
