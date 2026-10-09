import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Curve3 } from '@babylonjs/core/Maths/math.path.js';

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// One continuous spatial route: the world is never replaced along it.
const points = Curve3.CreateCatmullRomSpline([
  [0, 8, 69], [1, 4.8, 39], [0, 4.1, 13], [-4, 4.3, -10],
  [-7, 4.6, -32], [1, 6, -54], [14, 11, -78], [9, 18, -103],
  [-17, 23, -115], [-39, 26, -92], [-43, 25, -54], [-37, 31, -16], [-24, 38, 40],
].map(p => new Vector3(...p)), 64, false).getPoints();
const lengths = [0];
for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].subtract(points[i - 1]).length());
export const routeLength = lengths.at(-1);
export function cameraAt(progress) {
  const distance = clamp(progress) * routeLength;
  let low = 0, high = lengths.length - 1;
  while (low + 1 < high) { const mid = (low + high) >> 1; if (lengths[mid] <= distance) low = mid; else high = mid; }
  return Vector3.Lerp(points[low], points[high], (distance - lengths[low]) / (lengths[high] - lengths[low]));
}
export function lookAt(progress) {
  const p = clamp(progress), ahead = cameraAt(Math.min(1, p + .055));
  const garden = Vector3.Lerp(ahead, new Vector3(-10, 21, -84), smoothstep(.23, .4, p));
  return Vector3.Lerp(garden, new Vector3(0, 7, -30), smoothstep(.77, 1, p));
}

export const islands = [
  { x: -27, z: 23, rx: 17, rz: 19, h: 3.9, seed: 1 },
  { x: 29, z: 1, rx: 18, rz: 25, h: 3.4, seed: 3 },
  { x: -32, z: -31, rx: 18, rz: 20, h: 5.4, seed: 6 },
  { x: 28, z: -54, rx: 17, rz: 18, h: 4.4, seed: 9 },
  { x: -10, z: -84, rx: 16, rz: 15, h: 2.8, seed: 12 },
  { x: -68, z: -68, rx: 17, rz: 25, h: 6, seed: 16 },
  { x: 64, z: -91, rx: 23, rz: 20, h: 7, seed: 18 },
  { x: -58, z: 66, rx: 22, rz: 15, h: 4, seed: 21 },
  { x: 68, z: 41, rx: 25, rz: 20, h: 4, seed: 24 },
  { x: -68, z: -148, rx: 30, rz: 25, h: 18, seed: 27 },
  { x: 5, z: -159, rx: 38, rz: 25, h: 25, seed: 31 },
  { x: 86, z: -156, rx: 38, rz: 29, h: 23, seed: 35 },
];
export function islandHeight(island, x, z) {
  const dx = (x - island.x) / island.rx, dz = (z - island.z) / island.rz, angle = Math.atan2(dz, dx);
  const edge = 1 + .07 * Math.sin(angle * 5 + island.seed) + .035 * Math.sin(angle * 9);
  const r = Math.sqrt(dx * dx + dz * dz) / edge;
  if (r >= 1) return -1.4;
  const shape = Math.pow(1 - r * r, 1.4);
  return -.8 + island.h * shape + Math.sin(x * .31 + island.seed) * Math.cos(z * .29) * .38 * shape;
}
