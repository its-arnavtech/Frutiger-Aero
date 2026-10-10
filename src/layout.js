import * as THREE from 'three';

// The single source of truth for where everything in the city stands. Builders,
// planting, the camera route and the tests all read the same plan.
export const TAU = Math.PI * 2;
export const DECK = 2.4;          // promenade level above the lagoon
export const CANAL_HALF = 12.4;   // centreline to embankment face
export const PROMENADE = 7.2;

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function rng(seed) { return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }

const UP = new THREE.Vector3(0, 1, 0);
export const canal = new THREE.CatmullRomCurve3([
  [3, 0, 116], [0, 0, 84], [0, 0, 45], [0, 0, 10], [-4, 0, -10], [-7, 0, -32], [1, 0, -54], [14, 0, -78], [11, 0, -106],
].map(p => new THREE.Vector3(...p)));
export const canalLength = canal.getLength();

const SAMPLES = 400;
export const frames = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const t = i / SAMPLES, p = canal.getPointAt(t), tangent = canal.getTangentAt(t);
  // The normal points east while the canal runs north; side +1 is the east bank.
  const normal = new THREE.Vector3().crossVectors(tangent, UP).normalize();
  return { t, s: t * canalLength, x: p.x, z: p.z, tx: tangent.x, tz: tangent.z, nx: normal.x, nz: normal.z };
});
export function frameAt(t) { return frames[Math.round(clamp(t) * SAMPLES)]; }
export function frameExact(t) {
  const p = canal.getPointAt(clamp(t)), tangent = canal.getTangentAt(clamp(t)), normal = new THREE.Vector3().crossVectors(tangent, UP).normalize();
  return { t, s: t * canalLength, x: p.x, z: p.z, tx: tangent.x, tz: tangent.z, nx: normal.x, nz: normal.z };
}
// Samples along a bank, bunched up at both ends so the rounded pier heads stay smooth.
export function bankStations(spacing = 1.15, head = 22) {
  const stations = [], turns = 14;
  for (let i = 0; i <= turns; i++) stations.push(head * (1 - Math.cos(i / turns * Math.PI / 2)));
  for (let s = head + spacing; s < canalLength - head; s += spacing) stations.push(s);
  for (let i = turns; i >= 0; i--) stations.push(canalLength - head * (1 - Math.cos(i / turns * Math.PI / 2)));
  return stations.map(s => frameExact(s / canalLength));
}
export function bankPoint(side, t, offset) { const f = frameAt(t); return { x: f.x + f.nx * side * offset, z: f.z + f.nz * side * offset, frame: f }; }

export function nearestFrame(x, z) {
  let best = 0, distance = Infinity;
  for (let i = 0; i <= SAMPLES; i += 4) { const f = frames[i], d = (x - f.x) ** 2 + (z - f.z) ** 2; if (d < distance) { distance = d; best = i; } }
  for (let i = Math.max(0, best - 4); i <= Math.min(SAMPLES, best + 4); i++) { const f = frames[i], d = (x - f.x) ** 2 + (z - f.z) ** 2; if (d < distance) { distance = d; best = i; } }
  const frame = frames[best], dx = x - frame.x, dz = z - frame.z, along = dx * frame.tx + dz * frame.tz;
  return { frame, lateral: dx * frame.nx + dz * frame.nz, beyond: (best === 0 && along < -.4) || (best === SAMPLES && along > .4) };
}

// Each bank is one long garden peninsula with rounded pier heads.
function head(t) { const k = clamp(Math.min(t, 1 - t) * canalLength / 22); return Math.sqrt(1 - (1 - k) * (1 - k)); }
export function gardenWidth(side, t) { return 13 + 5.5 * Math.sin(t * 8.2 + side * 1.9) + 2.6 * Math.sin(t * 19 + side * .7); }
export function bankInner(side, t) { const k = clamp(Math.min(t, 1 - t) * canalLength / 3.5); return CANAL_HALF + 3.5 * (1 - Math.sqrt(1 - (1 - k) * (1 - k))); }
export function bankOuter(side, t) { return CANAL_HALF + .9 + (PROMENADE + gardenWidth(side, t)) * head(t); }
export function deckOuter(side, t) { return Math.min(CANAL_HALF + PROMENADE, bankOuter(side, t) - 1.1); }

function mound(x, z) {
  const a = .5 + .5 * Math.sin(x * .13 + 1.3) * Math.cos(z * .11 + .4), b = .5 + .5 * Math.sin(x * .047 - z * .061 + 2.1);
  return 1.9 * a * a * b + .12 * Math.sin(x * .7) * Math.cos(z * .6);
}
export function lawnHeight(x, z, fromDeck, fromEdge) {
  // Lawns roll gently, but settle flat around every podium.
  let level = smoothstep(.3, 6, fromDeck) * smoothstep(.3, 5, fromEdge);
  for (const tower of towers) { const d = Math.hypot(x - tower.x, z - tower.z); if (d < tower.radius + 11) level *= smoothstep(tower.radius + 3.6, tower.radius + 11, d); }
  return DECK + .26 + Math.max(0, mound(x, z)) * level;
}

// Park islands are raised planters ringed by a white kerb; headlands are wild.
export const islands = [
  { x: -80, z: -52, rx: 19, rz: 25, h: 4.6, seed: 16 },
  { x: 78, z: -60, rx: 21, rz: 18, h: 5.2, seed: 18 },
  { x: -74, z: 66, rx: 21, rz: 15, h: 3.6, seed: 21 },
  { x: 80, z: 50, rx: 22, rz: 18, h: 4.2, seed: 24 },
  { x: -34, z: 150, rx: 13, rz: 10, h: 2.6, seed: 5 },
  { x: -330, z: -520, rx: 190, rz: 110, h: 82, seed: 27, wild: true },
  { x: 60, z: -640, rx: 250, rz: 120, h: 105, seed: 31, wild: true },
  { x: 440, z: -470, rx: 180, rz: 120, h: 88, seed: 35, wild: true },
  { x: 640, z: -60, rx: 130, rz: 230, h: 76, seed: 41, wild: true },
  { x: -650, z: 0, rx: 140, rz: 240, h: 84, seed: 45, wild: true },
  { x: -420, z: 520, rx: 200, rz: 110, h: 66, seed: 49, wild: true },
  { x: 380, z: 560, rx: 220, rz: 120, h: 74, seed: 53, wild: true },
];
export const RIM = .93;
export function islandEdge(island, angle) { return 1 + .07 * Math.sin(angle * 5 + island.seed) + .035 * Math.sin(angle * 9); }
export function islandHeight(island, x, z) {
  const dx = (x - island.x) / island.rx, dz = (z - island.z) / island.rz;
  const r = Math.sqrt(dx * dx + dz * dz) / islandEdge(island, Math.atan2(dz, dx));
  if (r >= 1) return -1.4;
  if (island.wild) {
    const shape = Math.pow(1 - r * r, 1.25);
    const ridge = island.h * (.22 * Math.sin(x * .013 + island.seed) * Math.cos(z * .011) + .11 * Math.sin(x * .034 + z * .027) + .05 * Math.cos(x * .08 - z * .07));
    return -.8 + (island.h + ridge) * shape;
  }
  if (r >= RIM) return 1.05;
  const k = r / RIM, detail = Math.sin(x * .31 + island.seed) * Math.cos(z * .29) * .32;
  return 1.05 + (island.h + detail) * Math.pow(1 - k * k, 1.35);
}

// The canal opens into a round basin; the great garden sphere hangs above it.
export const basin = { x: 6, z: -158, r: 40 };
export const spheres = [
  { x: basin.x, y: 29, z: basin.z, r: 15, hero: true },
  { x: -48, y: 44, z: 84, r: 8 },
  { x: 9, y: 39, z: -22, r: 5.2 },
  { x: -60, y: 42, z: -60, r: 6.4 },
  { x: 38, y: 34, z: -101, r: 5 },
  { x: 52, y: 52, z: 22, r: 4.4 },
];

// Towers are grown along both banks in three staggered rows, then around the basin.
export const towers = [];
{
  const random = rng(20071), kinds = ['capsule', 'spindle', 'capsule', 'terrace', 'ribbed', 'capsule', 'belljar', 'spindle', 'terrace'];
  const clear = t => towers.every(o => Math.hypot(o.x - t.x, o.z - t.z) > o.radius + t.radius + (t.gap || 7))
    && islands.every(i => i.wild || Math.hypot((t.x - i.x) / (i.rx + t.radius + 4), (t.z - i.z) / (i.rz + t.radius + 4)) > 1)
    && Math.hypot(t.x - basin.x, t.z - basin.z) > basin.r + t.radius + 6;
  const place = t => { if (!clear(t)) return false; towers.push({ ...t, seed: towers.length * 7.31 + 1, tint: towers.length % 5 }); return true; };
  let kind = 0;
  for (const side of [-1, 1]) {
    for (let s = side > 0 ? 17 : 26; s < canalLength - 9; s += 19 + random() * 8) {
      const t = s / canalLength, radius = 5.2 + random() * 2.4, p = bankPoint(side, t, bankOuter(side, t) - radius * .25);
      place({ x: p.x, z: p.z, radius, height: 44 + random() * 30, kind: kinds[kind++ % kinds.length], row: 1 });
    }
    for (let s = side > 0 ? 6 : 15; s < canalLength + 12; s += 23 + random() * 10) {
      const t = clamp(s / canalLength), radius = 6.2 + random() * 2.4, p = bankPoint(side, t, 60 + random() * 15);
      place({ x: p.x, z: p.z + (s > canalLength ? -(s - canalLength) : 0), radius, height: 68 + random() * 38, kind: kinds[(kind++ * 2 + 1) % kinds.length], row: 2 });
    }
    for (let s = -20; s < canalLength + 30; s += 31 + random() * 16) {
      const t = clamp(s / canalLength), radius = 7 + random() * 2.2, p = bankPoint(side, t, 103 + random() * 28);
      place({ x: p.x, z: p.z + (s < 0 ? -s : s > canalLength ? -(s - canalLength) : 0), radius, height: 88 + random() * 44, kind: random() < .6 ? 'capsule' : 'spindle', row: 3 });
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = .95 + i / 9 * (TAU - 1.9), radius = 6 + random() * 2.2, distance = basin.r + 15 + radius + (i % 2) * 15;
    place({ x: basin.x + Math.sin(a) * distance, z: basin.z + Math.cos(a) * distance, radius, height: 58 + random() * 46, kind: kinds[(i * 2 + 3) % kinds.length], row: 2, gap: 5 });
  }
}

// A tower that rises from open water stands in a garden island of its own, as
// large as its neighbours, the banks and the basin leave room for.
{
  const random = rng(7717), gardens = [];
  for (const tower of towers) {
    if (ground(tower.x, tower.z).kind !== 'water') continue;
    let reach = tower.radius + 13 + random() * 4;
    for (const other of towers) if (other !== tower) reach = Math.min(reach, Math.hypot(other.x - tower.x, other.z - tower.z) * .5 - 1.4);
    reach = Math.min(reach, Math.hypot(tower.x - basin.x, tower.z - basin.z) - 27);
    const touches = r => { for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; if (ground(tower.x + Math.cos(a) * r, tower.z + Math.sin(a) * r).kind !== 'water') return true; } return false; };
    while (reach > tower.radius + 5 && (touches(reach * 1.12 + 2) || touches(reach * .7))) reach -= 1;
    if (reach < tower.radius + 5.5) continue;
    gardens.push({ x: tower.x, z: tower.z, rx: reach / 1.11 * (.88 + random() * .12), rz: reach / 1.11 * (.88 + random() * .12), h: .45 + random() * .5, seed: tower.seed, garden: true });
  }
  islands.push(...gardens);
}

// Far towers only ever appear through haze, so they carry no detail.
export const skyline = [];
{
  const random = rng(977);
  while (skyline.length < 70) {
    const a = random() * TAU, d = 190 + random() * 230, x = Math.sin(a) * d, z = -40 + Math.cos(a) * d * 1.05;
    if (islands.some(i => i.wild && Math.hypot((x - i.x) / (i.rx + 12), (z - i.z) / (i.rz + 12)) < 1)) continue;
    skyline.push({ x, z, radius: 7 + random() * 5, height: 70 + random() * 110, tint: skyline.length % 5, spindle: random() < .35 });
  }
}

export const pods = [
  { t: .14, side: 1, offset: 15.5, height: 10.5, radius: 3.6 },
  { t: .36, side: -1, offset: 16, height: 13, radius: 3.1 },
  { t: .78, side: 1, offset: 16, height: 11.5, radius: 3.3 },
].map(p => ({ ...p, ...bankPoint(p.side, p.t, p.offset) }));

// What is underfoot at a point: used for planting and for the route checks.
export function ground(x, z) {
  const { frame, lateral, beyond } = nearestFrame(x, z);
  if (!beyond) {
    const side = lateral < 0 ? -1 : 1, d = Math.abs(lateral), outer = bankOuter(side, frame.t), deck = deckOuter(side, frame.t);
    if (d < outer + .8 && d >= bankInner(side, frame.t) - .8) {
      if (d < bankInner(side, frame.t) + .6 || d > outer - .7) return { kind: 'kerb', y: DECK + .34, side, d, t: frame.t };
      if (d < deck) return { kind: 'deck', y: DECK, side, d, t: frame.t };
      if (d < deck + .4) return { kind: 'kerb', y: DECK + .3, side, d, t: frame.t };
      return { kind: 'lawn', y: lawnHeight(x, z, d - deck, outer - d), side, d, t: frame.t };
    }
  }
  for (const island of islands) { const y = islandHeight(island, x, z); if (y > -1.4) return { kind: island.wild ? 'wild' : 'island', y, island }; }
  return { kind: 'water', y: 0 };
}

// The outer radius of a tower's shell at a world height, shared by the builder,
// the sky bridges and the flight clearance tests.
export function towerRadius(tower, y) {
  const k = (y - DECK) / tower.height, r = tower.radius;
  if (k < 0) return r + 3.4;
  if (tower.kind === 'spindle') return k >= 1 ? 0 : r * (.8 + .28 * Math.sin(Math.PI * Math.pow(k, .8))) * Math.sqrt(1 - Math.pow(k, 3.2));
  if (tower.kind === 'terrace') { const tier = Math.min(3, Math.floor(k * 1.0001 / .3)); return k > 1.12 ? 0 : r * (1 - .17 * tier) + (k > 1 ? -r * .3 : 0); }
  if (k <= 1) return r * (1 + .035 * Math.sin(k * Math.PI)) * (1 - .14 * k);
  const rise = (y - DECK - tower.height) / (r * 1.5);
  return rise >= 1 ? 0 : r * .86 * Math.sqrt(1 - rise * rise);
}
export function towerTop(tower) { return DECK + tower.height + (tower.kind === 'spindle' ? 0 : tower.kind === 'terrace' ? tower.radius * .7 : tower.radius * 1.5); }

// Glazed sky bridges between named towers: [tower, tower, height].
export const links = [[2, 17, 31], [4, 19, 42], [6, 21, 27], [3, 8, 44], [18, 23, 55], [21, 25, 50]].map(([from, to, y]) => {
  const a = towers[from], b = towers[to], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
  const ra = towerRadius(a, y) - .5, rb = towerRadius(b, y) - .5;
  return { from: [a.x + ux * ra, y, a.z + uz * ra], to: [b.x - ux * rb, y, b.z - uz * rb], rise: Math.min(4.5, (length - ra - rb) * .06) };
});
export function linkPoint(link, k) {
  return [link.from[0] + (link.to[0] - link.from[0]) * k, link.from[1] + Math.sin(Math.PI * k) * link.rise, link.from[2] + (link.to[2] - link.from[2]) * k];
}

// The footbridge that arches over the canal from lawn to lawn.
export const footbridge = [[-34, 2.75, -33], [-27, 6.9, -35], [-15, 10.7, -39], [0, 12.1, -42], [14, 10.3, -48], [24, 6.7, -53], [31, 2.85, -57]];
export const gate = { x: 0, y: 7.3, z: 10, radius: 7.4 };
