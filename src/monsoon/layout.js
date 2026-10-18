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
export function basinRadius(x, z) {
  const angle = Math.atan2((z + 45) / 240, x / 175);
  return Math.hypot(x / 175, (z + 45) / 240) / (1 + .055 * Math.sin(angle * 5 + .4) + .025 * Math.sin(angle * 11));
}
// One continuous height field drives the mesh, water depth and flight checks.
export function terrainHeight(x, z) {
  const r = basinRadius(x, z), a = Math.atan2(z + 45, x);
  const bed = .8 - 13 * (1 - smooth(.38, 1.02, r));
  const height = 145 + 52 * Math.sin(a * 3 + 1) ** 2 + 36 * noise(x * .014, z * .014);
  const mouth = 1 - .75 * smooth(.65, .98, Math.sin(a));
  const ribs = Math.sin(a * 19 + .3) * .019 + Math.sin(a * 37) * .009;
  const wall = smooth(1.055, 1.48, r + ribs * smooth(1.04, 1.2, r)) * height * mouth;
  const ledges = wall + 6 * (smooth(25, 37, wall) - smooth(48, 73, wall)) + 8 * (smooth(93, 108, wall) - smooth(120, 150, wall));
  const shelves = Math.sin(r * 43 + noise(x * .008, z * .008)) * 3.5 * smooth(1.05, 1.2, r);
  const buttress = (noise(x * .045, z * .045) - .5) * 26 + (noise(x * .13, z * .13) - .5) * 7;
  const detail = (noise(x * .5, z * .5) - .5) * 1.3;
  return bed + ledges + shelves + buttress * smooth(1.04, 1.3, r) + detail * smooth(.8, 1.05, r);
}
export const waterfalls = [
  { x: -104, z: -276, height: 95, width: 2.8, bend: 9 },
  { x: 132, z: -230, height: 72, width: 1.3, bend: -5 },
  { x: -176, z: -139, height: 48, width: 1, bend: 3 },
];
