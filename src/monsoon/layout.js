export const TAU = Math.PI * 2;
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export const terrainBounds = { width: 2400, depth: 2600, centerZ: -400 };
export const lake = { x: 0, z: -80, radiusX: 285, radiusZ: 405, depth: 24 };
export function basinRadius(x, z) {
  const angle = Math.atan2((z - lake.z) / lake.radiusZ, x / lake.radiusX);
  return Math.hypot(x / lake.radiusX, (z - lake.z) / lake.radiusZ) / (1 + .035 * Math.sin(angle * 5 + .4) + .018 * Math.sin(angle * 11));
}
// A single massif beyond the far shore. Its compact footprint cannot grow
// into enclosing walls along the sides of the lake.
export function mountainHeight(x, z) {
  const peak = (cx, cz, width, depth, height) => {
    const dx = (x - cx) / width, dz = (z - cz) / depth, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
    const envelope = Math.max(0, 1 - r);
    const spur = 1 - .18 * Math.abs(Math.sin(a * 5 + noise(x * .008, z * .008) * 2)) * smooth(0, .35, r);
    return envelope ** 1.13 * height * spur;
  };
  const mass = Math.max(
    peak(-24, -890, 600, 440, 690),
    peak(-215, -854, 330, 380, 440),
    peak(-117, -938, 380, 410, 520),
    peak(164, -934, 350, 420, 495),
    peak(304, -995, 310, 410, 385),
  );
  const erosion = (noise(x * .014, z * .014) - .5) * 110 + (noise(x * .043, z * .043) - .5) * 42 + (noise(x * .12, z * .12) - .5) * 10;
  return Math.max(0, mass + erosion * smooth(0, 110, mass));
}
// The same continuous surface drives the mesh, lake depth and camera checks.
export function terrainHeight(x, z) {
  const r = basinRadius(x, z), shore = smooth(.99, 1.22, r);
  const bed = .55 - lake.depth * (1 - smooth(.48, 1.015, r));
  const foothills = (9 + noise(x * .007, z * .007) * 31 + noise(x * .023, z * .023) * 6) * shore;
  const detail = (noise(x * .16, z * .16) - .5) * 2.2 * smooth(.92, 1.17, r);
  return bed + foothills + mountainHeight(x, z) + detail;
}
export const streams = [
  { from: [-95, -700], to: [-78, -465], width: 2.7 },
  { from: [130, -780], to: [112, -464], width: 1.5 },
];
