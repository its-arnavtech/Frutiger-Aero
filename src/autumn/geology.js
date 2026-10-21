import * as THREE from 'three';
import { smooth } from './layout.js';
import { mountainStone } from './materials.js';

export const AUTUMN_SUN = [-.58, .62, .53];
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
export function groundNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) + (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
}
export function alpineHeight(x, z) {
  const summit = (cx, cz, width, depth, height) => {
    const dx = (x - cx) / width, dz = (z - cz) / depth;
    // Unequal rock faces and wind-cut shoulders; avoid a radial sine pattern,
    // which gave every peak the same regularly spaced, star-shaped ribs.
    const warp = (groundNoise(x * .004 + 9, z * .005) - .5) * .16;
    const taper = smooth(0, .25, Math.hypot(dx, dz));
    const a = dx + warp * taper, b = dz + warp * .55 * taper;
    const r = (Math.abs(a) ** 1.65 + Math.abs(b) ** 1.65) ** (1 / 1.65);
    const shoulders = .9 + groundNoise(x * .005 - 18, z * .004 + 21) * .2;
    return Math.max(0, 1 - r) ** 1.16 * height * shoulders;
  };
  const mass = Math.max(summit(20, -1160, 690, 580, 740), summit(-370, -1250, 500, 510, 570), summit(355, -1370, 510, 580, 660), summit(-730, -1500, 450, 520, 540), summit(760, -1600, 490, 540, 590));
  const warp = groundNoise(x * .007, z * .007) * 25;
  const u = x + warp + (groundNoise(x * .003 - 11, z * .004) - .5) * 100;
  const v = z - warp;
  // Nested ridges form interlocking buttresses, with smaller gullies branching
  // through them. These are metre-scale geometry, not a painted cliff pattern.
  const ridge = (frequency, stretch) => 1 - Math.abs(groundNoise(u * frequency, v * frequency * stretch) * 2 - 1);
  const primary = ridge(.009, .74), secondary = ridge(.025, .56), broken = ridge(.069, .81);
  const buttress = (primary ** 2 - .4) * 92 + (secondary ** 2 - .4) * 30 + (broken - .6) * 9;
  const channels = (1 - secondary) ** 4 * 28 + (1 - broken) ** 4 * 7;
  const fractures = (groundNoise((u + v * .34) * .15, (v - u * .27) * .15) - .5) * 3;
  const strata = Math.sin(mass * .09 + x * .013 + groundNoise(x * .012, z * .01) * 3) * 2.8;
  const erosion = (groundNoise(x * .004, z * .006) - .5) * 90 + buttress - channels + strata + fractures;
  return 6 + mass + erosion * smooth(0, 90, mass);
}

export function createAlpineGeometry() {
  // Fixed geometry all along the flight; the visible ridges are real relief.
  const geometry = new THREE.PlaneGeometry(3100, 1800, 775, 450);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, -1450);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alpineHeight(p.getX(i), p.getZ(i)));
  // The distant range lies beyond the village's shadow camera. Bake its
  // terrain self-shadow once, using the same sun direction as the live scene,
  // instead of enlarging the shadow map and losing sharp nearby tree shadows.
  const colors = new Float32Array(p.count * 3), relief = new Float32Array(p.count), columns = 776, rows = 451, spacing = 4;
  const sample = (x, z) => {
    const column = THREE.MathUtils.clamp((x + 1550) / spacing, 0, columns - 1);
    const row = THREE.MathUtils.clamp((z + 2350) / spacing, 0, rows - 1);
    const left = Math.min(columns - 2, Math.floor(column)), top = Math.min(rows - 2, Math.floor(row));
    const u = column - left, v = row - top;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(p.getY(top * columns + left), p.getY(top * columns + left + 1), u),
      THREE.MathUtils.lerp(p.getY((top + 1) * columns + left), p.getY((top + 1) * columns + left + 1), u), v);
  };
  const horizontalSun = Math.hypot(AUTUMN_SUN[0], AUTUMN_SUN[2]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let obstruction = 0, shelter = 0;
    for (const distance of [10, 20, 35, 55, 85, 125, 180, 250, 340, 450]) {
      const rise = sample(x + AUTUMN_SUN[0] / horizontalSun * distance, z + AUTUMN_SUN[2] / horizontalSun * distance) - y;
      obstruction = Math.max(obstruction, (rise - AUTUMN_SUN[1] / horizontalSun * distance) / distance);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let horizon = 0;
      for (const distance of [15, 45, 120]) horizon = Math.max(horizon, (sample(x + dx * distance, z + dz * distance) - y) / distance);
      shelter += Math.atan(Math.max(0, horizon)) / (Math.PI * 2);
    }
    const shade = (1 - smooth(0, .13, obstruction) * .48) * (1 - shelter * .32);
    colors.set([shade * (1 - shelter * .04), shade, Math.min(1, shade * (1 + shelter * .05))], i * 3);
    // Concavity identifies gullies where snow and sediment collect. Exposed
    // ridges stay dark rock even at the same altitude as a neighbouring drift.
    const neighbourhood = (sample(x-12,z)+sample(x+12,z)+sample(x,z-12)+sample(x,z+12))*.25;
    relief[i] = THREE.MathUtils.clamp((neighbourhood-y)/9, -1, 1);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('alpineCavity', new THREE.BufferAttribute(relief, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function buildAlpineRange(scene, maps) {
  const range = new THREE.Mesh(createAlpineGeometry(), mountainStone(maps));
  range.name = 'Eroded alpine ridges with snow-filled gullies'; scene.add(range);
  return range;
}
