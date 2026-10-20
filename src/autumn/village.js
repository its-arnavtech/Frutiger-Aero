import * as THREE from 'three';
import { createBatcher, rod, tube } from '../build.js';
import { cabins, bridge, riverX, riverWidth, terrainHeight, TAU } from './layout.js';
import { timberMaterial, weatheredPlaster } from './materials.js';
import { buildCottage } from './cottage.js';
import { buildWatermill } from './mill.js';

export function buildVillage(scene, maps) {
  const finishes = {
    wood: { material: timberMaterial(maps, '#a29782') },
    pale: { material: timberMaterial(maps, '#d3c6a8') },
    plaster: { material: weatheredPlaster() },
    roof: { material: new THREE.MeshStandardMaterial({ color: '#383f3e', roughness: .8, metalness: .12 }) },
    copper: { material: new THREE.MeshStandardMaterial({ color: '#884930', metalness: .35, roughness: .55 }) },
    shingles: { material: timberMaterial(maps, '#72786b') },
    shinglesLight: { material: timberMaterial(maps, '#889083') },
    shinglesDark: { material: timberMaterial(maps, '#555f59') },
    metal: { material: new THREE.MeshStandardMaterial({ color: '#585754', roughness: .45, metalness: .65 }) },
    glass: { material: new THREE.MeshPhysicalMaterial({ color: '#c0d6cd', roughness: .1, metalness: .1, transparent: true, opacity: .28, envMapIntensity: 1.5 }), shadow: false, order: 3 },
    interior: { material: new THREE.MeshStandardMaterial({ color: '#29251f', roughness: .9 }), shadow: false },
    curtain: { material: new THREE.MeshStandardMaterial({ color: '#d5cbb6', roughness: 1 }), shadow: false },
    stone: { material: new THREE.MeshStandardMaterial({ color: '#a8a497', map: maps.rock, normalMap: maps.rockNormal, normalScale: new THREE.Vector2(.5,.5), roughness: .86 }) },
    light: { material: new THREE.MeshStandardMaterial({ color: '#a29d84', emissive: '#ffca85', emissiveIntensity: .12, roughness: .3, metalness: .15, envMapIntensity: 1.2 }), shadow: false },
    paper: { material: new THREE.MeshStandardMaterial({ color: '#d8c5a0', emissive: '#ffbd67', emissiveIntensity: .28, roughness: .8 }) },
  };
  const batch = createBatcher(finishes), add = batch.add;
  function box(key, w, h, d, at, turn = 0) { add(key, new THREE.BoxGeometry(w, h, d), { at, turn: [0, turn, 0] }); }
  const lanterns = [];
  function lantern(x, y, z, size = .55) {
    add('paper', new THREE.SphereGeometry(size, 14, 10), { at: [x, y, z], scale: [1, 1.25, 1] });
    for (const dy of [-.64, .64]) add('wood', new THREE.CylinderGeometry(size * .48, size * .48, .1, 10), { at: [x, y + dy * size, z] });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      add('pale', tube(Array.from({ length: 9 }, (_, k) => { const t = k / 8 * Math.PI; return [x + Math.sin(t) * Math.cos(a) * size * 1.015, y + Math.cos(t) * size * 1.24, z + Math.sin(t) * Math.sin(a) * size * 1.015]; }), .012, { sides: 3, segments: 10 }));
    }
    lanterns.push([x, y, z]);
  }

  for (const cabin of cabins) buildCottage(cabin, batch, lantern);

  // A timber arch high enough for the camera to glide through underneath.
  const bx = riverX(bridge.z), deckY = x => 5.8 + 6.2 * (1 - (x / bridge.half) ** 2);
  for (let x = -bridge.half; x <= bridge.half; x += .65) {
    box('pale', .60, .25, 4.8, [bx + x, deckY(x), bridge.z]);
    if (Math.round((x + bridge.half) / .65) % 5 === 0) for (const side of [-1, 1]) {
      box('wood', .2, 1.5, .2, [bx + x, deckY(x) + .65, bridge.z + side * 2.2]);
    }
  }
  for (const side of [-1, 1]) {
    for (const y of [-.4, 1.3]) add('wood', tube(Array.from({ length: 55 }, (_, i) => { const x = -27 + i; return [bx + x, deckY(x) + y, bridge.z + side * 2.2]; }), y < 0 ? .4 : .12));
    const cable = Array.from({ length: 49 }, (_, i) => { const x = -24 + i; return [bx + x, 18 - 4 * (1 - (x / 24) ** 2), bridge.z + side * 2.5]; });
    add('wood', tube(cable, .035));
    for (let x = -24; x <= 24; x += 6) lantern(bx + x, 17 - 4 * (1 - (x / 24) ** 2), bridge.z + side * 2.5, .48);
    for (const x of [-24, 24]) add('wood', rod([bx + x, 3, bridge.z + side * 2.5], [bx + x, 18.2, bridge.z + side * 2.5], .22));
  }

  // Riverside lamps trace the walk between the lodges.
  for (const side of [-1, 1]) for (let z = -44; z < 67; z += .55) {
    const x = riverX(z) + side * (riverWidth(z) + 9), y = Math.max(terrainHeight(x, z), side < 0 && Math.abs(z + 5) < 3.5 ? 1.1 : -10) + .18;
    box('pale', 2.7, .14, .5, [x, y, z]);
  }
  for (const side of [-1, 1]) for (let z = -42; z < 70; z += 14) {
    const x = riverX(z) + side * 20, y = Math.max(2.2, terrainHeight(x, z));
    add('wood', rod([x, y, z], [x, y + 4, z], .09));
    add('wood', rod([x, y + 4, z], [x - side * 1, y + 4, z], .07));
    lantern(x - side * .8, y + 3.5, z, .37);
  }
  const root = new THREE.Group(); root.name = 'The sleeping village'; scene.add(root); batch.build(root, 'Autumn village');

  const mill = buildWatermill(scene, finishes);
  return { update(time) { mill.update(time); }, lanterns, root };
}
