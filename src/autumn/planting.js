import { terrainHeight, plantingClear, riverX, riverWidth, smooth, rng, TAU, island } from './layout.js';
import { cameraAt } from './journey.js';

const palette = ['#f0e4c6', '#d9be94', '#d3a788', '#e7d4aa', '#bccc9d', '#cac1a1'];
// Sample the actual flight, including its height, before planting anything.
const route = Array.from({ length: 800 }, (_, i) => cameraAt(i / 800));
export function forestPlacements() {
  const random = rng(7301), placements = [];
  for (let z = -360; z < 270; z += 15) for (let x = -230; x < 230; x += 15) {
    const px = x + (random() - .5) * 9, pz = z + (random() - .5) * 9;
    if (!plantingClear(px, pz, 3)) continue;
    const inland = smooth(10, 90, Math.abs(px - riverX(pz)) - riverWidth(pz));
    const height = 12 + random() * 12 + inland * 8, y = terrainHeight(px, pz);
    if (route.some(c => c.y < y + height + 3 && Math.hypot(c.x - px, c.z - pz) < height * .42 + 4)) continue;
    placements.push({ x: px, y, z: pz, height, species: Math.floor(random() * 3), variant: Math.abs(Math.round(px+pz))%2, color: palette[Math.floor(random() * palette.length)], turn: random() * TAU });
  }
  placements.push({ x: island.x, y: terrainHeight(island.x, island.z), z: island.z, height: 44, species: 3, color: '#f2dab0', turn: .8 });
  return placements;
}
