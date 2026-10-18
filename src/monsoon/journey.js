import * as THREE from 'three';
import { clamp, terrainHeight } from './layout.js';
export { clamp };
const above = (x, y, z) => [x, Math.max(y, terrainHeight(x, z) + 12), z];
export const stops = [
  { at: [0, 3.2, 294], see: [-24, 145, -820], name: 'The open lake' },
  { at: [-24, 3.8, 245], see: [-35, 90, -740] },
  { at: [-82, 4.8, 161], see: [-28, 95, -770], name: 'Stone beneath glass' },
  { at: [-158, 6.5, 35], see: [-35, 130, -800] },
  { at: [-196, 9, -122], see: [-24, 170, -850], name: 'The great mountain' },
  { at: [-169, 14, -272], see: [-60, 135, -720] },
  { at: [-97, 24, -382], see: [-95, 155, -700], name: 'Silver threads' },
  { at: [12, 38, -425], see: [-24, 230, -855] },
  { at: above(135, 52, -388), see: [-24, 260, -890], name: 'The summit' },
  { at: above(227, 66, -273), see: [-15, 130, -740] },
  { at: above(290, 80, -112), see: [-30, 80, -650], name: 'Green shores' },
  { at: above(302, 84, 55), see: [-20, 95, -730] },
  { at: above(234, 72, 181), see: [-24, 155, -850], name: 'Cloudbreak' },
  { at: above(147, 48, 266), see: [-24, 140, -820] },
  { at: [75, 23, 308], see: [-24, 135, -820], name: 'Still water' },
  { at: [28, 8, 319], see: [-24, 145, -820] },
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
