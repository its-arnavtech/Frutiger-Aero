import * as THREE from 'three';
import { clamp, terrainHeight } from './layout.js';
export { clamp };
const above = (x, y, z) => [x, Math.max(y, terrainHeight(x, z) + 12), z];
export const stops = [
  { at: [0, 3.2, 177], see: [0, 44, -200], name: 'The rain basin' },
  { at: [-10, 3.6, 136], see: [-25, 28, -170] },
  { at: [-40, 4.5, 78], see: [-100, 28, -160], name: 'Stone beneath glass' },
  { at: [-83, 6, 13], see: [-145, 38, -145] },
  { at: [-117, 10, -65], see: [-137, 48, -220], name: 'The slate wall' },
  { at: [-114, 16, -142], see: [-104, 54, -276] },
  { at: [-69, 22, -211], see: [-104, 56, -276], name: 'Silver threads' },
  { at: [-8, 33, -232], see: [50, 85, -300] },
  { at: above(65, 52, -244), see: [0, 80, -330], name: 'The snowline' },
  { at: above(133, 73, -203), see: [-80, 30, -180] },
  { at: above(177, 98, -133), see: [-30, 13, -90], name: 'Above the weather' },
  { at: above(192, 120, -46), see: [-20, 18, -95] },
  { at: above(169, 108, 47), see: [-60, 35, -145], name: 'Cloudbreak' },
  { at: above(122, 78, 110), see: [-30, 38, -180] },
  { at: [67, 36, 154], see: [-15, 45, -190], name: 'Still water' },
  { at: [27, 11, 183], see: [0, 44, -200] },
];
const curve = new THREE.CatmullRomCurve3(stops.map(s => new THREE.Vector3(...s.at)), true, 'centripetal');
curve.arcLengthDivisions = 8000;
export const routeLength = curve.getLength();
const wrap = n => n - Math.floor(n);
export const cameraAt = p => curve.getPointAt(wrap(p));
const targets = new THREE.CatmullRomCurve3(stops.map(s => new THREE.Vector3(...s.see)), true, 'catmullrom', .18);
export const lookAt = p => targets.getPoint(curve.getUtoTmapping(wrap(p)));
export const rollAt = p => {
  const a = cameraAt(p - .006), b = cameraAt(p), c = cameraAt(p + .006);
  return clamp(-((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) * .0008, -.025, .025);
};
const lengths = curve.getLengths();
export const places = stops.flatMap((s, i) => s.name ? [{ name: s.name, progress: lengths[Math.round(i / stops.length * curve.arcLengthDivisions)] / routeLength }] : []);
