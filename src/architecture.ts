import * as THREE from 'three';
import { Batcher, makeSign, type Materials, random } from './materials';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Hipped roof with bowed slopes and lifted corners; ridges follow the same surface. */
function roof(parent: THREE.Group, batch: Batcher, m: Materials, x: number, y: number, z: number, w: number, d: number, rise: number) {
  const ridge = w * .29;
  const point = (side: number, u: number, t: number) => {
    let ex: number, ez: number, rx: number, rz: number;
    if (side < 2) { ex = (u - .5) * w; ez = (side ? -1 : 1) * d / 2; rx = (u - .5) * ridge * 2; rz = 0; }
    else { ex = (side === 2 ? -1 : 1) * w / 2; ez = (u - .5) * d; rx = (side === 2 ? -1 : 1) * ridge; rz = 0; }
    const lift = .25 + .9 * Math.pow(Math.abs(u - .5) * 2, 5);
    const yy = rise * Math.pow(t, 1.65) + lift * Math.pow(1 - t, 4);
    return v(x + THREE.MathUtils.lerp(ex, rx, t), y + yy, z + THREE.MathUtils.lerp(ez, rz, t));
  };
  for (let side = 0; side < 4; side++) {
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
    const columns = 36, rows = 12;
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
      const p = point(side, c / columns, r / rows); positions.push(p.x, p.y, p.z); uvs.push(c / columns * 4, r / rows * 3);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c, b = a + columns + 1; indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    const material = m.roof; material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    const count = Math.ceil((side < 2 ? w : d) / .53);
    for (let i = 0; i <= count; i++) {
      const pts = Array.from({ length: 10 }, (_, k) => point(side, i / count, k / 9).add(v(0, .065, 0)));
      const curve = new THREE.CatmullRomCurve3(pts);
      // A slim continuous ridge gives the roof readable tile rhythm from every shot.
      const ridgeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, .065, 4, false), i % 4 === 0 ? m.roofEdge : m.roofDark);
      parent.add(ridgeMesh);
    }
    for (let c = 0; c < 32; c++) {
      batch.beam(m.roofEdge, point(side, c / 32, 0), point(side, (c + 1) / 32, 0), .18, .23);
      batch.beam(m.gold, point(side, c / 32, 0).add(v(0, -.2, 0)), point(side, (c + 1) / 32, 0).add(v(0, -.2, 0)), .09, .12);
    }
  }
  batch.box(m.roofDark, x, y + rise, z, ridge * 2 + .6, .28, .42);
  for (const sign of [-1, 1]) {
    batch.sphere(m.gold, x + sign * (ridge + .45), y + rise + .25, z, .24, .38, .24);
  }
}

export function createArchitecture(parent: THREE.Group, m: Materials) {
  const b = new Batcher(parent), rng = random(289);
  // Mossy masonry podium and a layered, asymmetrical silhouette.
  b.box(m.stone, 0, 1.4, -24, 47, 6.6, 39);
  b.box(m.stoneLight, 0, 4.85, -24, 48, .35, 40);
  for (let row = 0; row < 5; row++) for (let i = 0; i < 25; i++) {
    const xx = -23 + i * 1.9 + (row % 2) * .7;
    b.box(row % 3 === 0 ? m.rock : m.stoneLight, xx, -1 + row * 1.2, -4.45, 1.72, 1.06, .35);
  }
  function floor(x: number, base: number, z: number, w: number, d: number, h: number, bays: number) {
    b.box(m.plaster, x, base + h / 2, z, w, h, d);
    b.box(m.red, x, base + .15, z, w + .4, .4, d + .35);
    b.box(m.red, x, base + h - .2, z, w + .5, .45, d + .4);
    for (const face of [-1, 1]) {
      const zz = z + face * (d / 2 + .06);
      for (let i = 0; i <= bays; i++) {
        const xx = x - w / 2 + w / bays * i;
        b.box(m.red, xx, base + h / 2, zz, .38, h, .42);
        // Corbel brackets below the roof.
        b.box(m.darkRed, xx, base + h - .8, zz + face * .38, .72, .28, 1.1);
        b.box(m.gold, xx, base + h - .52, zz + face * .5, .9, .18, 1.4);
      }
      for (let i = 0; i < bays; i++) {
        const xx = x - w / 2 + w / bays * (i + .5), ww = w / bays - .85;
        b.box(m.darkWood, xx, base + h * .53, zz + face * .04, ww + .25, h * .64, .16);
        b.box(m.windows, xx, base + h * .53, zz + face * .14, ww, h * .59, .08);
        for (let bar = 0; bar < 4; bar++) b.box(m.wood, xx - ww / 2 + bar * ww / 3, base + h * .53, zz + face * .2, .07, h * .6, .09);
        for (let bar = 0; bar < 3; bar++) b.box(m.wood, xx, base + h * .24 + bar * h * .295, zz + face * .21, ww, .07, .1);
      }
      b.box(m.red, x, base + .8, zz + face * .95, w + .65, .13, .2);
      b.box(m.red, x, base + 1.6, zz + face * .95, w + .65, .16, .22);
      b.box(m.darkWood, x, base + .08, zz + face * .6, w + 1.1, .16, 1.65);
      for (let i = 0; i <= bays * 3; i++) b.box(m.red, x - w / 2 + w / (bays * 3) * i, base + .85, zz + face * .95, .12, 1.6, .13);
    }
    // The side elevations also have windows, beams, and balconies.
    for (const side of [-1, 1]) {
      const xx = x + side * (w / 2 + .08);
      const count = Math.floor(d / 2.8);
      for (let i = 0; i < count; i++) {
        const zz = z - d / 2 + d / count * (i + .5);
        b.box(m.windows, xx, base + h * .53, zz, .15, h * .57, d / count - .6);
        for (let j = 0; j < 4; j++) b.box(m.wood, xx + side * .1, base + h * .53, zz - 1 + j * .65, .1, h * .6, .07);
        b.box(m.wood, xx + side * .1, base + h * .53, zz, .12, .1, d / count - .5);
        b.box(m.red, xx + side * .1, base + h / 2, z - d / 2 + d / count * i, .4, h, .35);
      }
      b.box(m.red, xx, base + .4, z, .3, .4, d);
    }
  }
  floor(0, 5, -24, 34, 24, 7.6, 10);
  roof(parent, b, m, 0, 12.9, -24, 40, 31, 4.5);
  floor(0, 14.4, -25, 28.5, 21, 7.1, 9);
  roof(parent, b, m, 0, 21.8, -25, 35, 28, 4.7);
  floor(0, 23.5, -26, 21, 16, 5.4, 7);
  roof(parent, b, m, 0, 29.2, -26, 27, 23, 4.1);
  floor(0, 31, -27, 12.5, 11, 4.7, 4);
  roof(parent, b, m, 0, 36, -27, 19, 18, 3.7);
  // Side annex with a broad, low roof and a tall working chimney.
  floor(-21, 5, -28, 10, 18, 7, 3);
  roof(parent, b, m, -21, 12.4, -28, 14, 23, 3.7);
  floor(19.3, 5, -29, 8, 20, 9, 3);
  roof(parent, b, m, 19.3, 14.4, -29, 12, 25, 3.8);
  b.cylinder(m.chimney, 17.4, 23, -36, 1.35, 37);
  for (let i = 0; i < 15; i++) b.cylinder(m.darkRed, 17.4, 5 + i * 2.45, -36, 1.39, .15);
  b.cylinder(m.darkWood, 17.4, 41.6, -36, 1.6, .65);
  // Projecting entrance pavilion, folded roof, and noren curtains.
  b.box(m.darkWood, 0, 8.1, -10.5, 7.7, 6.2, 3.4);
  b.box(m.windows, 0, 8, -8.73, 5.8, 5.7, .12);
  for (let i = 0; i < 5; i++) b.box(m.wood, -2.6 + 1.3 * i, 8, -8.6, .13, 5.7, .15);
  b.box(m.red, 0, 11.3, -8.5, 9.3, .7, 3.8);
  for (const xx of [-4, 4]) {
    b.cylinder(m.red, xx, 8, -7, .32, 6.2); b.cylinder(m.gold, xx, 5.4, -7, .42, .45);
    lantern(xx, 9.1, -5.9, .57, false);
  }
  roof(parent, b, m, 0, 11.7, -8.4, 11.5, 8, 3.4);
  for (let i = 0; i < 5; i++) b.box(m.darkRed, -2.5 + 1.25 * i, 10.1, -8.2, 1.17, 1.65, .08);
  const entranceSign = makeSign('ゆ', 1, 1, '#713a32', '#f0d3a0', 330); entranceSign.position.set(0, 10.12, -8.1); parent.add(entranceSign);
  for (let i = 0; i < 3; i++) b.box(m.stoneLight, 0, 4.8 + i * .09, -5.2 - i * .45, 9, .2, .5);
  // Large oil emblem set into the central upper facade.
  b.box(m.darkRed, 0, 26.5, -17, 5.8, 6.6, .6);
  b.box(m.gold, 0, 26.5, -16.58, 5.4, 6.2, .12);
  const emblem = makeSign('油', 5.05, 5.8, '#963e32', '#f5d59b', 340); emblem.position.set(0, 26.5, -16.48); parent.add(emblem);
  const tallSign = makeSign('油屋', 2.5, 6.8, '#a74231', '#ffe0a4', 260); tallSign.position.set(15.05, 18.1, -13.72); parent.add(tallSign);
  b.box(m.darkWood, 15.05, 18.1, -14, 2.8, 7.1, .3);
  for (let i = 0; i < 11; i++) lantern(-15 + i * 3, 11.5, -10.7, .4, i % 3 === 0);

  function lantern(x: number, y: number, z: number, size: number, red: boolean) {
    b.sphere(red ? m.lanternRed : m.lantern, x, y, z, size, size * 1.25, size);
    b.cylinder(m.darkWood, x, y + size * 1.2, z, size * .55, .13);
    b.cylinder(m.darkWood, x, y - size * 1.2, z, size * .5, .12);
    b.cylinder(m.gold, x, y + size * 1.65, z, .025, size * .8);
    for (let j = 0; j < 4; j++) {
      const ang = j * Math.PI / 2;
      b.box(m.gold, x + Math.sin(ang) * size * .95, y, z + Math.cos(ang) * size * .95, .025, size * 1.8, .025);
    }
  }
  // Cambered red bridge. Rail heights, planks, and supports share one profile.
  const bridgeY = (z: number) => 5 + 3.15 * Math.sin(Math.PI * (z + 5) / 33);
  const bridgeSlope = (z: number) => 3.15 * Math.PI / 33 * Math.cos(Math.PI * (z + 5) / 33);
  for (let i = 0; i < 88; i++) {
    const z = -5 + i * 33 / 87;
    b.box(i % 4 ? m.wood : m.darkWood, 0, bridgeY(z), z, 7, .2, .365, [Math.atan(bridgeSlope(z)), 0, 0]);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 66; i++) {
      const z = -5 + i * .5, next = z + .5;
      for (const lift of [.38, 1.15, 2.3]) b.beam(lift === 2.3 ? m.redLight : m.red, v(side * 3.65, bridgeY(z) + lift, z), v(side * 3.65, bridgeY(next) + lift, next), lift === 2.3 ? .28 : .18, .24);
      b.beam(m.darkRed, v(side * 3.3, bridgeY(z) - .5, z), v(side * 3.3, bridgeY(next) - .5, next), .7, .45);
    }
    for (let i = 0; i <= 22; i++) {
      const z = -5 + i * 1.5, y = bridgeY(z);
      b.box(m.red, side * 3.65, y + 1.2, z, .24, 2.45, .24);
      if (i % 4 === 0 || i === 22) {
        b.box(m.redLight, side * 3.65, y + 1.3, z, .43, 2.8, .43);
        b.sphere(m.black, side * 3.65, y + 2.9, z, .27, .37, .27);
        b.cylinder(m.gold, side * 3.65, y + 2.58, z, .26, .11);
      }
    }
    for (const z of [2, 20]) {
      b.box(m.darkWood, side * 2.6, 2.5, z, .9, 9, 1.1);
      b.beam(m.darkWood, v(side * 2.6, 1, z - 2.2), v(side * 2.6, 6.4, z + 2), .45);
    }
    for (const z of [-4, 27]) {
      const x = side * 4.7, y = bridgeY(z);
      b.cylinder(m.darkWood, x, y + 2.6, z, .14, 5.3);
      b.box(m.darkWood, x - side * .45, y + 5.1, z, 1.15, .15, .15);
      lantern(x - side * .75, y + 4.1, z, .6, false);
    }
  }
  // Foreground path, rocks and garden walls.
  b.box(m.grass, 0, 1.4, 46, 38, 5.9, 37);
  b.box(m.stone, 0, 4.5, 39, 8, .4, 22);
  for (let i = 0; i < 32; i++) {
    b.box(m.stoneLight, (rng() - .5) * 6.5, 4.73, 29 + rng() * 20, .7 + rng(), .05, .8 + rng());
  }
  for (let i = 0; i < 35; i++) {
    const side = i % 2 ? -1 : 1, x = side * (19 + rng() * 15), z = -44 + rng() * 43;
    b.leaf(m.rock, x, rng() * 1.5, z, 2 + rng() * 3, 2 + rng() * 3, 2 + rng() * 3, rng() * 6);
    b.leaf(m.grass, x, 2 + rng() * 1.5, z, 2 + rng() * 2, .9, 2 + rng() * 2, rng() * 6);
  }
  const instances = b.finish();
  // Merge static tile ribs by material to avoid hundreds of small draw calls.
  return { instances, bridgeY };
}
