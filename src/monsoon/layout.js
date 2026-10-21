import { alpineElevations, terrainColumns, terrainRows } from './alpine-elevation.js';
import { rockRelief } from './rock-relief.js';

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
  return Math.hypot(x / lake.radiusX, (z - lake.z) / lake.radiusZ) / (1 + .035 * Math.sin(angle * 5 + .4) + .018 * Math.sin(angle * 11) + (noise(x * .022, z * .022) - .5) * .035);
}
// A single massif beyond the far shore. Its compact footprint cannot grow
// into enclosing walls along the sides of the lake.
export function mountainHeight(x, z) {
  // Surveyed glacial walls, saddles and drainage replace the radial cones.
  // This is a scaled crop of the locally bundled Swiss alpine DEM; its real
  // asymmetric relief is retained rather than multiplied by synthetic ribs.
  const border = (1 - smooth(630, 800, Math.abs(x)))
    * smooth(-1600, -1460, z) * (1 - smooth(-540, -445, z));
  if (!border) return 0;
  const column = clamp((x + 800) / 1600, 0, 1) * (terrainColumns - 1);
  const row = clamp((z + 1600) / 1160, 0, 1) * (terrainRows - 1);
  const left = Math.min(terrainColumns - 2, Math.floor(column)), top = Math.min(terrainRows - 2, Math.floor(row));
  const u = column - left, v = row - top, i = top * terrainColumns + left;
  const elevation = (alpineElevations[i] * (1-u) + alpineElevations[i+1] * u) * (1-v)
    + (alpineElevations[i+terrainColumns] * (1-u) + alpineElevations[i+terrainColumns+1] * u) * v;
  const mass = Math.max(0, elevation - 2600) * .4;
  const warp = noise(x*.017,z*.013)*.3;
  const fractures = (rockRelief(x*.014+warp,z*.018+warp)-.5)*10
    + (noise(x * .075, z * .065) - .5) * 4 + (noise(x * .23, z * .21) - .5) * 1.2;
  return Math.max(0, mass + fractures * smooth(70, 230, mass)) * border;
}
// The same continuous surface drives the mesh, lake depth and camera checks.
export function terrainHeight(x, z) {
  const r = basinRadius(x, z), shore = smooth(1.0, 1.38, r);
  const bed = .55 - lake.depth * (1 - smooth(.48, 1.015, r));
  const foothills = (3 + noise(x * .007, z * .007) * 19 + noise(x * .023, z * .023) * 4) * shore;
  const detail = (noise(x * .16, z * .16) - .5) * .7 * smooth(.95, 1.17, r);
  return bed + foothills + mountainHeight(x, z) + detail;
}
export const streams = [
  { from: [-95, -850], to: [-78, -465], width: 1.1 },
  { from: [130, -780], to: [112, -464], width: .65 },
];
