// Landmark structures: clock tower, head office, temple, market, ghats, station, college, tanks, IT park...
import { GeoBuilder, hex, type RGB } from './builder';
import { BIT, Grid } from './grid';
import { city } from './layout';
import { rng } from './prng';
import { heightAt, WATER_Y } from './terrain';

const C = {
  stone: hex('#d9cdb4'),
  cream: hex('#f1e6cc'),
  white: hex('#f6f4ee'),
  red: hex('#a8432e'),
  tile: hex('#a5512f'),
  saffron: hex('#e07b1f'),
  temple: hex('#e9dcc0'),
  paving: hex('#b8ad98'),
  steel: hex('#5d6166'),
  roof: hex('#7d8b94'),
  glass: hex('#7f9fb3'),
  concrete: hex('#a8a8a2'),
  green: hex('#2e7d4f'),
  dark: hex('#2b2f33'),
  water: hex('#2f6f8f'),
  brick: hex('#b56a4f'),
  yellow: hex('#e8c35a'),
};

type Ctx = { b: GeoBuilder; grid: Grid; x: number; z: number; y: number };

/** A solid box that walk mode also collides with. */
function solid(
  c: Ctx,
  dx: number,
  dz: number,
  w: number,
  h: number,
  d: number,
  color: RGB,
  y = c.y,
  rot = 0,
  top?: RGB,
) {
  c.b.box(c.x + dx, y, c.z + dz, w, h, d, rot, color, top);
  c.grid.rect(c.x + dx, c.z + dz, w / 2, d / 2, rot, BIT.solid);
}

const BUILD: Record<string, (c: Ctx) => void> = {
  clock_tower(c) {
    c.b.cylinder(c.x, c.y + 0.12, c.z, 26, 0.18, 24, C.paving);
    solid(c, 0, 0, 9, 2, 9, C.stone);
    c.b.box(c.x, c.y + 2, c.z, 6, 24, 6, 0, C.cream);
    c.b.box(c.x, c.y + 26, c.z, 7, 6, 7, 0, C.stone);
    for (const [dx, dz, w, d] of [
      [3.55, 0, 0.1, 4],
      [-3.55, 0, 0.1, 4],
      [0, 3.55, 4, 0.1],
      [0, -3.55, 4, 0.1],
    ]) {
      c.b.box(c.x + dx, c.y + 27, c.z + dz, w, 4, d, 0, C.white); // clock faces
    }
    c.b.box(c.x, c.y + 32, c.z, 7.6, 0.6, 7.6, 0, C.stone);
    c.b.cone(c.x, c.y + 32.6, c.z, 5.2, 7, 4, C.tile, Math.PI / 4);
  },
  municipal_hq(c) {
    solid(c, 0, 0, 70, 16, 34, C.cream, c.y, 0, C.stone);
    c.b.box(c.x, c.y + 16, c.z, 72, 1, 36, 0, C.stone);
    c.b.cylinder(c.x, c.y + 17, c.z, 9, 6, 16, C.cream);
    c.b.cylinder(c.x, c.y + 23, c.z, 9, 6, 16, C.white, 2);
    for (let i = -3; i <= 3; i++) c.b.box(c.x + i * 5, c.y, c.z + 18.5, 1.2, 12, 1.2, 0, C.white); // portico columns
    c.b.box(c.x, c.y + 12, c.z + 18.5, 36, 1.4, 3, 0, C.stone);
    c.b.box(c.x, c.y + 29, c.z, 0.25, 8, 0.25, 0, C.steel);
    c.b.box(c.x + 1.3, c.y + 35, c.z, 2.4, 1.6, 0.05, 0, C.saffron);
  },
  market_hall(c) {
    solid(c, 0, 0, 64, 8, 28, C.brick);
    // Barrel roof from stacked slabs.
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      c.b.box(
        c.x,
        c.y + 8 + Math.sin((t * Math.PI) / 2) * 5,
        c.z,
        66,
        0.8,
        30 * Math.cos((t * Math.PI) / 2) + 1,
        0,
        C.roof,
      );
    }
  },
  vegetable_market(c) {
    const r = rng(city.seed, 'mandai');
    for (let i = 0; i < 3; i++) {
      for (const dx of [-28, 28])
        for (const dz of [-4, 4]) c.b.box(c.x + dx, c.y, c.z + (i - 1) * 11 + dz, 0.4, 5, 0.4, 0, C.steel);
      c.b.box(c.x, c.y + 5, c.z + (i - 1) * 11, 62, 0.4, 9, 0, C.roof);
    }
    for (let i = 0; i < 40; i++) {
      const color = r.pick([C.green, C.saffron, C.yellow, C.red, hex('#2f6f8f')]);
      c.b.box(c.x + r.range(-28, 28), c.y, c.z + r.range(-15, 15), 2.4, 0.9, 1.6, 0, hex('#8b6b4a'), color);
    }
  },
  temple(c) {
    solid(c, 0, 0, 30, 1.5, 30, C.stone);
    solid(c, 0, -4, 12, 7, 12, C.temple, c.y + 1.5);
    for (let i = 0; i < 5; i++) {
      const w = 11 - i * 2;
      c.b.box(c.x, c.y + 8.5 + i * 3.2, c.z - 4, w, 3.2, w, 0, i % 2 ? C.temple : C.cream);
    }
    c.b.cone(c.x, c.y + 24.5, c.z - 4, 2.2, 4, 8, C.saffron);
    c.b.box(c.x, c.y + 1.5, c.z + 7, 12, 5, 10, 0, C.temple);
    c.b.cone(c.x, c.y + 6.5, c.z + 7, 6, 4, 8, C.temple);
    c.b.box(c.x + 0.6, c.y + 30, c.z - 4, 0.12, 4, 0.12, 0, C.steel);
    c.b.box(c.x + 1.6, c.y + 32.5, c.z - 4, 2, 1.2, 0.05, 0, C.saffron);
  },
  ghat(c) {
    // Steps down to the water from the riverside road.
    for (let i = 0; i < 9; i++) {
      c.b.box(
        c.x,
        WATER_Y - 0.4,
        c.z - 10 + i * 2.6,
        96 - i * 2,
        0.95 - i * 0.1 + 0.4,
        2.7,
        0,
        i % 2 ? C.stone : C.paving,
      );
    }
    c.b.box(c.x - 30, 0.9, c.z - 14, 5, 5, 5, 0, C.temple);
    c.b.cone(c.x - 30, 5.9, c.z - 14, 3.4, 4, 8, C.saffron);
  },
  station(c) {
    const px = c.x + 13;
    c.b.box(px, c.y, c.z, 9, 1, 220, 0, C.paving);
    for (let dz = -90; dz <= 90; dz += 15) c.b.box(px, c.y + 1, c.z + dz, 0.4, 4.5, 0.4, 0, C.steel);
    c.b.box(px, c.y + 5.5, c.z, 10, 0.4, 190, 0, C.roof);
    solid(c, 36, 0, 16, 9, 52, C.cream, c.y, 0, C.stone);
    c.b.box(c.x + 36, c.y + 9, c.z, 17, 1.2, 53, 0, C.red);
    c.b.box(c.x + 27.8, c.y + 6, c.z, 0.3, 1.6, 18, 0, C.yellow); // name board
  },
  bus_stand(c) {
    c.b.box(c.x, c.y + 0.1, c.z, 80, 0.15, 50, 0, C.paving);
    for (let dx = -32; dx <= 32; dx += 16) c.b.box(c.x + dx, c.y, c.z - 8, 0.5, 5, 0.5, 0, C.steel);
    c.b.box(c.x, c.y + 5, c.z - 8, 74, 0.4, 12, 0, C.roof);
    solid(c, 0, -20, 30, 6, 8, C.cream);
    for (let i = 0; i < 5; i++) {
      c.b.box(c.x - 28 + i * 14, c.y, c.z + 8, 2.6, 3.2, 11, 0, C.red, C.white);
      c.grid.rect(c.x - 28 + i * 14, c.z + 8, 1.3, 5.5, 0, BIT.solid);
    }
  },
  college(c) {
    solid(c, 0, 0, 92, 15, 22, C.brick, c.y, 0, C.stone);
    c.b.box(c.x, c.y + 15, c.z, 20, 8, 12, 0, C.brick);
    c.b.cone(c.x, c.y + 23, c.z, 9, 5, 4, C.tile, Math.PI / 4);
    solid(c, -60, -40, 18, 10, 40, C.cream, c.y, 0, C.stone); // library
    c.b.box(c.x, c.y + 0.1, c.z + 26, 60, 0.12, 24, 0, C.paving);
  },
  college_gate(c) {
    solid(c, -7, 0, 2, 7, 2, C.brick);
    solid(c, 7, 0, 2, 7, 2, C.brick);
    c.b.box(c.x, c.y + 7, c.z, 16, 1.8, 2, 0, C.brick);
  },
  water_tank(c) {
    for (const [dx, dz] of [
      [-4, -4],
      [4, -4],
      [4, 4],
      [-4, 4],
    ])
      solid(c, dx, dz, 1, 18, 1, C.concrete);
    c.b.cylinder(c.x, c.y + 18, c.z, 7, 5, 16, C.concrete);
    c.b.cone(c.x, c.y + 23, c.z, 7.2, 2.5, 16, C.concrete);
  },
  school(c) {
    solid(c, 0, 0, 50, 9, 14, C.yellow, c.y, 0, C.stone);
    solid(c, -22, 9, 8, 9, 10, C.yellow, c.y, 0, C.stone);
    solid(c, 22, 9, 8, 9, 10, C.yellow, c.y, 0, C.stone);
    c.b.box(c.x, c.y, c.z - 8, 50, 0.6, 2, 0, C.green);
  },
  it_park(c) {
    c.b.box(c.x, c.y + 0.08, c.z, 270, 0.12, 240, 0, C.paving);
    for (const [dx, dz, h] of [
      [-80, -40, 54],
      [0, 40, 66],
      [80, -30, 48],
      [-60, 70, 36],
      [90, 80, 42],
    ]) {
      solid(c, dx, dz, 36, h, 26, C.glass, c.y, 0, C.concrete);
      c.b.box(c.x + dx, c.y + h, c.z + dz, 10, 3, 8, 0, C.concrete);
    }
    c.b.box(c.x + 60, c.y, c.z - 122, 2, 6, 2, 0, C.concrete);
    c.b.box(c.x + 76, c.y, c.z - 122, 2, 6, 2, 0, C.concrete);
    c.b.box(c.x + 68, c.y + 6, c.z - 122, 18, 1.4, 2, 0, C.glass);
  },
  water_treatment_plant(c) {
    for (const [dx, dz] of [
      [-50, -30],
      [-50, 30],
      [0, -30],
      [0, 30],
    ]) {
      c.b.cylinder(c.x + dx, c.y, c.z + dz, 18, 2.5, 20, C.concrete, 18, false);
      c.b.cylinder(c.x + dx, c.y + 2.2, c.z + dz, 17.5, 0.01, 20, C.water);
      c.grid.disc(c.x + dx, c.z + dz, 18, BIT.solid);
    }
    solid(c, 55, -20, 30, 9, 40, C.cream, c.y, 0, C.roof);
    c.b.cylinder(c.x + 60, c.y, c.z + 45, 6, 22, 12, C.concrete);
  },
  construction(c) {
    solid(c, 0, 0, 22, 1, 22, C.concrete);
    for (let f = 1; f <= 5; f++) c.b.box(c.x, c.y + f * 3.2, c.z, 22, 0.35, 22, 0, C.concrete);
    for (const [dx, dz] of [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
      [0, -10],
      [0, 10],
    ]) {
      c.b.box(c.x + dx, c.y, c.z + dz, 0.6, 16.5, 0.6, 0, C.concrete);
    }
    // Tower crane.
    c.b.box(c.x + 16, c.y, c.z + 16, 1.6, 34, 1.6, 0, C.yellow);
    c.b.box(c.x + 6, c.y + 34, c.z + 16, 40, 1.2, 1.2, 0, C.yellow);
    c.b.box(c.x - 12, c.y + 28, c.z + 16, 0.08, 6, 0.08, 0, C.dark);
  },
};

export function buildSpecials(b: GeoBuilder, grid: Grid) {
  for (const s of city.special) BUILD[s.type]?.({ b, grid, x: s.x, z: s.z, y: heightAt(s.x, s.z) });
}
