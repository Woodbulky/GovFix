// Places the anchored DOM overlays (markers/anchors.ts) on screen each rendered frame, without React re-renders.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { anchorEvents, anchors } from '../markers/anchors';

const v = new THREE.Vector3();

export function Projector() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const on = () => invalidate();
    anchorEvents.addEventListener('change', on);
    return () => anchorEvents.removeEventListener('change', on);
  }, [invalidate]);

  useFrame(({ camera, size }) => {
    const p = camera.position;
    anchors.forEach((a) => {
      const d = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
      v.set(a.x, a.y, a.z).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 && (!a.maxDist || d < a.maxDist);
      a.el.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      const s = a.worldSize ? Math.min(1.6, a.worldSize / d) : 1;
      a.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      a.el.style.zIndex = String(10_000 - Math.round(d));
    });
  });
  return null;
}
