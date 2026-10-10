import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Curve3 } from '@babylonjs/core/Maths/math.path.js';

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

// One unbroken flight that wanders through the whole city and returns to where
// it began, so it can be flown round and round, forwards or backwards, without
// end. Each stop is where the camera is; `see` names a subject to hold in
// frame, and stops without one simply look along the way ahead. `name` marks
// the places the interface lists.
const sphere = [6, 27, -158];
export const stops = [
  // Arrival over the open lagoon, then down into the canal.
  { at: [-10, 9, 172], see: [0, 20, 70], name: 'Lagoon' },
  { at: [-1.5, 6.2, 128] },
  { at: [.5, 4.4, 92] },
  { at: [0, 4.4, 56] },
  { at: [0, 5.6, 30] },
  { at: [-.5, 7.2, 10], name: 'Gateway' },
  { at: [-4.5, 6.2, -12] },
  { at: [-7, 5, -30] },
  { at: [-3, 5.2, -44] },
  { at: [2, 6.5, -60] },
  { at: [13, 11, -78] },
  { at: [12, 17, -102], see: [16, 21, -142] },
  // A slow rising orbit of the great garden sphere.
  { at: [34, 21, -128], see: sphere, name: 'Garden sphere' },
  { at: [41, 27, -158], see: sphere },
  { at: [30, 33, -186], see: sphere },
  { at: [4, 37, -195], see: sphere },
  { at: [-22, 40, -182], see: sphere },
  { at: [-31, 43, -156], see: [-8, 26, -120] },
  // Out over the western lagoon and its park island.
  { at: [-40, 46, -124], see: [-66, 36, -90] },
  { at: [-73, 44, -99] },
  { at: [-87, 35, -62], name: 'West island' },
  { at: [-85, 25, -24] },
  { at: [-62, 19, -5] },
  { at: [-44, 16, 1] },
  { at: [-22, 17, 10] },
  // Back down to the water, this time heading south into the light.
  { at: [-3, 12, 27] },
  { at: [4, 6.5, 48], name: 'Canal' },
  { at: [5, 5.6, 74] },
  { at: [5, 6, 100] },
  { at: [14, 8, 127] },
  // Around the eastern towers and over the second island.
  { at: [40, 14, 133] },
  { at: [66, 22, 129] },
  { at: [88, 30, 112], name: 'East towers' },
  { at: [88, 37, 84] },
  { at: [97, 42, 56] },
  { at: [86, 46, 36] },
  { at: [66, 50, 31] },
  { at: [48, 58, 50], see: [10, 40, 40] },
  { at: [18, 66, 70], see: [-10, 38, 30] },
  // Climbing away to see the whole city at once.
  { at: [-20, 76, 100], see: [-6, 34, 10] },
  { at: [-42, 92, 150], see: [0, 34, -20] },
  { at: [-55, 108, 206], see: [0, 40, -40], name: 'Overlook' },
  // A long turn out over the lagoon, sinking back to where the flight began,
  // with the city held in view the whole way round.
  { at: [-50, 113, 240], see: [0, 38, -30] },
  { at: [-30, 105, 268], see: [0, 34, -10] },
  { at: [0, 87, 264], see: [0, 30, 10], name: 'Descent' },
  { at: [-2, 57, 238], see: [0, 26, 30] },
  { at: [-9, 29, 206], see: [0, 22, 55] },
];

const SPAN = 40;
// The spline library begins a closed curve at the second point it is given, so
// the stops are handed over starting from the last: sample i * SPAN is stop i.
const loop = list => Curve3.CreateCatmullRomSpline([list.at(-1), ...list.slice(0, -1)], SPAN, true).getPoints();
const points = loop(stops.map(s => new Vector3(...s.at)));
const lengths = [0];
for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].subtract(points[i - 1]).length());
export const routeLength = lengths.at(-1);
// Where around the loop each stop falls, from 0 to 1.
export const stopProgress = stops.map((_, i) => lengths[i * SPAN] / routeLength);
export const places = stops.map((stop, i) => ({ name: stop.name, progress: stopProgress[i] })).filter(p => p.name);

function locate(distance) {
  let low = 0, high = lengths.length - 1;
  while (low + 1 < high) { const mid = (low + high) >> 1; if (lengths[mid] <= distance) low = mid; else high = mid; }
  return { low, high, mix: (distance - lengths[low]) / (lengths[high] - lengths[low]) };
}
// Distances and progress wrap: lap 3.25 is the same place as lap 0.25.
const lap = progress => progress - Math.floor(progress);
function along(distance) {
  const { low, high, mix } = locate(lap(distance / routeLength) * routeLength);
  return Vector3.Lerp(points[low], points[high], mix);
}
export function cameraAt(progress) { return along(lap(progress) * routeLength); }

// Subjects are joined by their own spline and sampled in step with the camera,
// so the gaze swings smoothly from one to the next.
const LEAD = 34;
const subjects = loop(stops.map((stop, i) => {
  if (stop.see) return new Vector3(...stop.see);
  const ahead = along(lengths[i * SPAN] + LEAD);
  ahead.y = ahead.y * .8 + 1.4;
  return ahead;
}));
export function lookAt(progress) {
  const { low, high, mix } = locate(lap(progress) * routeLength);
  return Vector3.Lerp(subjects[low], subjects[high], mix);
}

// A slight lean into each turn, as a gliding camera would have.
export function rollAt(progress) {
  const d = lap(progress) * routeLength, a = along(d - 9), b = along(d), c = along(d + 9);
  const turn = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
  return clamp(-turn * .0028, -.13, .13);
}
