// Shared materials and procedural canvas textures (no downloaded assets). Created once per page.
import * as THREE from 'three';
import { rng } from '../gen/prng';

const CELL = 64; // one bay (3.5 m) by one floor (3.2 m)
const CELLS = 4;

function canvas(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = CELL * CELLS;
  draw(c.getContext('2d')!);
  return c;
}

function texture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plaster facade with windows (white, so the per-building instance colour tints it) and its night mask. */
function facadeTextures() {
  const r = rng('navnagar', 'windows');
  const lit: boolean[] = Array.from({ length: CELLS * CELLS }, () => r.chance(0.38));
  const each =
    (fn: (g: CanvasRenderingContext2D, x: number, y: number, i: number) => void) => (g: CanvasRenderingContext2D) => {
      for (let i = 0; i < CELLS * CELLS; i++) fn(g, (i % CELLS) * CELL, Math.floor(i / CELLS) * CELL, i);
    };
  const map = canvas(
    each((g, x, y) => {
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, CELL, CELL);
      g.fillStyle = '#e6e2da'; // floor band
      g.fillRect(x, y + CELL - 6, CELL, 6);
      g.fillStyle = '#d9d4ca'; // frame
      g.fillRect(x + 15, y + 13, 34, 32);
      g.fillStyle = '#4a5a66';
      g.fillRect(x + 18, y + 16, 28, 26);
      g.fillStyle = '#6d8190';
      g.fillRect(x + 31, y + 16, 2, 26);
      g.fillStyle = '#cfc9bd'; // ledge
      g.fillRect(x + 12, y + 45, 40, 4);
    }),
  );
  const glow = canvas(
    each((g, x, y, i) => {
      g.fillStyle = '#000000';
      g.fillRect(x, y, CELL, CELL);
      if (!lit[i]) return;
      g.fillStyle = i % 3 ? '#ffd27a' : '#fff1c9';
      g.fillRect(x + 18, y + 16, 28, 26);
    }),
  );
  const frame = canvas(
    each((g, x, y) => {
      g.fillStyle = '#3a3a38';
      g.fillRect(x, y, CELL, CELL);
      g.fillStyle = '#d4d2cb';
      g.fillRect(x, y + CELL - 10, CELL, 10);
      g.fillRect(x, y, 6, CELL);
    }),
  );
  return { map: texture(map, true), glow: texture(glow, true), frame: texture(frame, true) };
}

/** Facade UVs in metres from the instance scale, so windows never stretch, offset per building. */
function facadeUv(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
#ifdef USE_INSTANCING
  vec3 gfS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  float gfR = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  vec2 gfUv = vec2(uv.x * (abs(normal.x) > 0.5 ? gfS.z : gfS.x) / 14.0, uv.y * gfS.y / 12.8)
    + vec2(floor(gfR * 4.0) / 4.0, floor(fract(gfR * 7.0) * 4.0) / 4.0);
  #ifdef USE_MAP
    vMapUv = gfUv;
  #endif
  #ifdef USE_EMISSIVEMAP
    vEmissiveMapUv = gfUv;
  #endif
#endif`,
    );
  };
  material.customProgramCacheKey = () => 'govfix-facade';
}

function build() {
  const t = facadeTextures();
  const walls = new THREE.MeshStandardMaterial({
    map: t.map,
    emissiveMap: t.glow,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0,
    roughness: 0.92,
  });
  facadeUv(walls);
  const frameWalls = new THREE.MeshStandardMaterial({ map: t.frame, roughness: 1 });
  facadeUv(frameWalls);

  const ripples = canvas((g) => {
    const r = rng('navnagar', 'ripples');
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${r.int(90, 166)},${r.int(90, 166)},255,0.35)`;
      g.beginPath();
      g.ellipse(r.range(0, 256), r.range(0, 256), r.range(4, 14), r.range(1, 3), 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  const waterNormal = texture(ripples, false);
  waterNormal.repeat.set(0.02, 0.02);

  return {
    walls,
    frameWalls,
    roofTop: new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.95 }),
    plain: new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 1 }),
    canopy: new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    pole: new THREE.MeshStandardMaterial({ color: '#6b6f73', roughness: 0.6, metalness: 0.4 }),
    lamp: new THREE.MeshBasicMaterial({ color: '#cfcfcf', toneMapped: false }),
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    road: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    roadDetail: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
    structure: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    water: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.12,
      metalness: 0.15,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }),
    wards: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }),
  };
}

export type Materials = ReturnType<typeof build>;
let cached: Materials | null = null;
export const materials = () => (cached ??= build());

const DAY_LAMP = new THREE.Color('#c9c9c9');
const NIGHT_LAMP = new THREE.Color('#ffcf73');

/** Called when the sun moves: windows and streetlights glow at night. */
export function applyNight(m: Materials, night: number) {
  m.walls.emissiveIntensity = night * 0.9;
  m.lamp.color.copy(DAY_LAMP).lerp(NIGHT_LAMP, night);
}
