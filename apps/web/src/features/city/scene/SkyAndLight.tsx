// Sky, sun, fog and night lighting driven by sim time (golden rule 4: business time is now_sim()).
import { Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Sun } from '../sun';
import { applyNight, materials } from './materials';

const DAY_FOG = new THREE.Color('#c9d6d3');
const DUSK_FOG = new THREE.Color('#d9b48f');
const NIGHT_FOG = new THREE.Color('#0d1824');
const forward = new THREE.Vector3();

export function SkyAndLight({ sun, shadows }: { sun: Sun; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene, invalidate } = useThree();
  const dir = useMemo(() => new THREE.Vector3(...sun.dir), [sun]);
  const dusk = Math.max(0, 1 - Math.abs(sun.elevation - 4) / 14) * (1 - sun.night);

  useEffect(() => {
    const fogColor = DAY_FOG.clone()
      .lerp(DUSK_FOG, dusk * 0.6)
      .lerp(NIGHT_FOG, sun.night);
    scene.fog = new THREE.Fog(fogColor, 1200, 6500);
    scene.background = fogColor;
    applyNight(materials(), sun.night);
    invalidate();
  }, [scene, sun, dusk, invalidate]);

  // Keep the shadow camera (±300 m) centred on what the camera is looking at.
  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    camera.getWorldDirection(forward);
    const reach = Math.min(400, Math.max(60, camera.position.y * 0.8));
    const tx = camera.position.x + forward.x * reach;
    const tz = camera.position.z + forward.z * reach;
    l.target.position.set(Math.round(tx / 8) * 8, 0, Math.round(tz / 8) * 8);
    l.position.copy(l.target.position).addScaledVector(dir, 1500);
    l.target.updateMatrixWorld();
  });

  const day = 1 - sun.night;
  const sunUp = sun.elevation > 0;
  return (
    <>
      <Sky
        distance={4500}
        sunPosition={dir.clone().multiplyScalar(1000)}
        turbidity={7}
        rayleigh={1.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.82}
      />
      {sun.night > 0.4 && <Stars radius={3500} depth={60} count={2200} factor={5} fade speed={0} />}
      <hemisphereLight ref={hemi} args={['#dfe9f0', '#8a7f62', 0.35 + 0.65 * day]} />
      <ambientLight intensity={0.08 + 0.12 * sun.night} color={sun.night > 0.5 ? '#6f86b6' : '#ffffff'} />
      <directionalLight
        ref={light}
        castShadow={shadows && sunUp}
        intensity={sunUp ? 2.6 * day : 0.25}
        color={dusk > 0.3 ? '#ffd2a1' : sun.night > 0.5 ? '#9fb3dd' : '#fff6e8'}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-camera-near={100}
        shadow-camera-far={3200}
      />
    </>
  );
}
