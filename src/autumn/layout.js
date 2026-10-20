// One landscape shared by the terrain, planting and flight-clearance tests.
export const TAU = Math.PI * 2;
export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function rng(seed) { return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }
export const riverX = z => 11 * Math.sin(z * .013) + 9 * Math.sin(z * .026 + .5);
export const riverWidth = z => 13 + 49 * Math.exp(-(((z + 156) / 69) ** 2)) + 18 * Math.exp(-(((z - 190) / 65) ** 2));
export const island = { x: 0, z: -155, radius: 17 };
export const millRace = { wheel: [-30.3, 4, -5], radius: 3.8, lip: [-30.3, 8.2, -5.8], feed: [[-76, 14.5, -33], [-56, 12, -31], [-44, 10.3, -20], [-30.3, 8.2, -5.8]], outlet: [-8, 0, -5] };
export function terrainHeight(x, z) {
  const distance = Math.abs(x - riverX(z)) - riverWidth(z);
  const shore = -2.8 + 5.4 * smooth(-2, 8, distance);
  const hills = smooth(12, 115, distance) * (18 + 13 * Math.sin(x * .018 + z * .007) ** 2 + 22 * Math.sin(z * .011 - x * .009) ** 2);
  const detail = smooth(3, 18, distance) * (1.1 * Math.sin(x * .18) * Math.sin(z * .14) + 2 * Math.sin(x * .051 + z * .037));
  const r = Math.hypot(x - island.x, z - island.z), angle = Math.atan2(z - island.z, x - island.x);
  const radius = island.radius * (1 + .11 * Math.sin(angle * 3 + .8) + .07 * Math.cos(angle * 5));
  const isle = r < radius ? -1 + 5.5 * Math.pow(1 - (r / radius) ** 2, 1.15) : -3;
  const base = Math.max(shore + hills + detail, isle);
  const channel = (1 - smooth(1.3, 3, Math.abs(z + 5))) * smooth(-33, -31, x) * (1 - smooth(-9, -6, x));
  const pool = 1 - smooth(.72, 1, Math.hypot((x + 30.3) / 1.9, (z + 5.8) / 4.8));
  const race = Math.max(channel, pool);
  return base + (Math.min(base, -.6) - base) * race;
}
export const cabins = [
  { x: -28, z: 36, turn: -.17, scale: 1.05 },
  { x: -31, z: 17, turn: -.08, scale: .85 },
  { x: -38, z: -5, turn: .1, scale: 1.25, mill: true },
  { x: 35, z: 42, turn: .12, scale: .9 },
  { x: 32, z: 19, turn: -.14, scale: 1.1 },
  { x: 30, z: -3, turn: -.12, scale: .8 },
  { x: 35, z: -31, turn: .2, scale: 1 },
  { x: 73, z: -142, turn: -.5, scale: 1.8, temple: true },
];
export const bridge = { z: 72, height: 12, half: 27 };
export function plantingClear(x, z, radius = 3) {
  return terrainHeight(x, z) > 1.3
    && Math.abs(z - bridge.z) > 5 + radius
    && cabins.every(c => Math.hypot(x - c.x, z - c.z) > 10 * c.scale + radius)
    && Math.hypot(x, z + 155) > 24
    && Math.hypot(x - millRace.wheel[0], z - millRace.wheel[2]) > 14 + radius
    && !(x > -82 && x < -25 && z > -40 && z < 2);
}
