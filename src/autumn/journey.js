import * as THREE from 'three';
import { riverX, clamp } from './layout.js';
export { clamp };
const river = (z, y = 4.5, dx = 0) => [riverX(z) + dx, y, z];
export const stops = [
  { at: river(177, 7), see: [0, 12, 60], name: 'The amber river' },
  { at: river(137, 5.2) }, { at: river(105, 4) },
  { at: river(75, 4.8), name: 'Lantern bridge' },
  { at: river(49, 5.5), see: [-23, 7, 8] },
  { at: river(20, 6), see: [-30, 9, -4], name: 'The sleeping village' },
  { at: river(-9, 5), see: [-34, 7, -9] },
  { at: river(-40, 4.5), see: [-5, 10, -105] },
  { at: river(-73, 5.5) },
  { at: [-23, 7, -106], see: [0, 19, -155], name: 'Mirror lake' },
  { at: [-35, 12, -145], see: [0, 23, -155] },
  { at: [-30, 21, -190], see: [0, 23, -155] },
  { at: [9, 28, -206], see: [0, 26, -155], name: 'The ancient maple' },
  { at: [43, 33, -181], see: [0, 26, -155] },
  { at: [48, 36, -139], see: [73, 12, -142], name: 'Hillside sanctuary' },
  { at: [31, 44, -100], see: [5, 16, -120] },
  { at: [-18, 54, -75], see: [-48, 22, -45] },
  { at: [-64, 67, -32], see: [-26, 12, 20], name: 'Copper canopy' },
  { at: [-80, 76, 35], see: [0, 10, 40] },
  { at: [-67, 88, 108], see: [0, 17, -38] },
  { at: [-36, 96, 171], see: [0, 15, -60], name: 'Last light' },
  { at: [5, 89, 215], see: [0, 17, -60] },
  { at: [37, 66, 230], see: [0, 12, -25] },
  { at: [38, 38, 215], see: [0, 9, 70] },
  { at: [23, 15, 195], see: [0, 10, 80] },
];
const curve = new THREE.CatmullRomCurve3(stops.map(s => new THREE.Vector3(...s.at)), true, 'centripetal');
curve.arcLengthDivisions = 8000;
export const routeLength = curve.getLength();
const wrap = p => p - Math.floor(p);
export const cameraAt = p => curve.getPointAt(wrap(p));
// Look targets share the camera's curve parameter rather than their own speed.
const targets = new THREE.CatmullRomCurve3(stops.map((s, i) => {
  if (s.see) return new THREE.Vector3(...s.see);
  return curve.getPoint((i + 1.15) / stops.length % 1).add(new THREE.Vector3(0, 1.4, 0));
}), true, 'catmullrom', .25);
export const lookAt = p => targets.getPoint(curve.getUtoTmapping(wrap(p)));
export const rollAt = p => {
  const a = cameraAt(p - .006), b = cameraAt(p), c = cameraAt(p + .006);
  return clamp(-((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) * .001, -.045, .045);
};
const lengths = curve.getLengths();
export const places = stops.flatMap((s, i) => s.name ? [{ name: s.name, progress: lengths[Math.round(i / stops.length * curve.arcLengthDivisions)] / routeLength }] : []);
