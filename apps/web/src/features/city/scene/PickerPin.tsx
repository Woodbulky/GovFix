// Report location picker in 3D: click the city to drop the pin, drag the pin to adjust.
// Clicks that were really a pan (pointer moved) are ignored.
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { overviewControls } from '../controls/keys';
import { roadY } from '../gen/terrain';

export type PickerProps = {
  pin: { x: number; z: number } | null;
  onPick: (x: number, z: number) => void;
};

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

export function PickerPin({ pin, onPick, children }: PickerProps & { children: ReactNode }) {
  const [drag, setDrag] = useState<{ x: number; z: number } | null>(null);
  const dragging = useRef(false);
  const marker = useRef<THREE.Group>(null);
  const at = drag ?? pin;

  // Keep the pin a readable size on screen from any distance (about 60 px tall).
  useFrame(({ camera, size }) => {
    const g = marker.current;
    if (!g) return;
    const d = camera.position.distanceTo(g.position);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    const metresPerPx = (2 * d * Math.tan(((fov / 2) * Math.PI) / 180)) / size.height;
    g.scale.setScalar(Math.max(1, (60 * metresPerPx) / 21));
  });

  useEffect(
    () => () => {
      if (overviewControls.current) overviewControls.current.enabled = true;
    },
    [],
  );

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5 || dragging.current) return;
    e.stopPropagation();
    onPick(Math.round(e.point.x), Math.round(e.point.z));
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    if (overviewControls.current) overviewControls.current.enabled = false;
    setDrag(pin);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !at) return;
    plane.constant = -roadY(at.x, at.z);
    if (e.ray.intersectPlane(plane, hit)) setDrag({ x: hit.x, z: hit.z });
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    if (overviewControls.current) overviewControls.current.enabled = true;
    if (drag) onPick(Math.round(drag.x), Math.round(drag.z));
    setDrag(null);
    // Let the click that ends this drag pass without dropping the pin again.
    setTimeout(() => (dragging.current = false));
  };

  return (
    <>
      <group onClick={click}>{children}</group>
      {at && (
        <group
          ref={marker}
          position={[at.x, roadY(at.x, at.z), at.z]}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
        >
          <mesh position={[0, 9, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[3.2, 12, 16]} />
            <meshStandardMaterial color="#e8a317" emissive="#e8a317" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 16, 0]}>
            <sphereGeometry args={[4.6, 20, 14]} />
            <meshStandardMaterial color="#e8a317" emissive="#e8a317" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 16, 0]}>
            <sphereGeometry args={[1.8, 12, 8]} />
            <meshStandardMaterial color="#0a2e24" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
            <ringGeometry args={[4, 5.5, 32]} />
            <meshBasicMaterial color="#0a2e24" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        </group>
      )}
    </>
  );
}
