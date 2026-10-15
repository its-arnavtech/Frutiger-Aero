import * as THREE from 'three';
import { createBatcher, rod, tube } from '../build.js';
import { cabins, bridge, riverX, riverWidth, terrainHeight, TAU } from './layout.js';
import { timberMaterial, weatheredPlaster } from './materials.js';

export function buildVillage(scene, maps) {
  const finishes = {
    wood: { material: timberMaterial(maps, '#a29782') },
    pale: { material: timberMaterial(maps, '#d3c6a8') },
    plaster: { material: weatheredPlaster() },
    roof: { material: new THREE.MeshStandardMaterial({ color: '#383f3e', roughness: .8, metalness: .12 }) },
    copper: { material: new THREE.MeshStandardMaterial({ color: '#884930', metalness: .35, roughness: .55 }) },
    shingles: { material: timberMaterial(maps, '#72786b') },
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

  for (const cabin of cabins) {
    const { x, z, turn, scale: s } = cabin, y = Math.max(2.6, terrainHeight(x, z));
    const local = (a, b, c) => [x + (a * Math.cos(turn) + c * Math.sin(turn)) * s, y + b * s, z + (-a * Math.sin(turn) + c * Math.cos(turn)) * s];
    const block = (key, w, h, d, a, b, c) => box(key, w * s, h * s, d * s, local(a, b, c), turn);
    block('stone', 10.8, 1.2, 9, 0, .1, 0);
    // Uneven masonry courses create real joints and contact shadows at the foot.
    for (let course = 0; course < 2; course++) for (const side of [-1, 1]) {
      for (let k = -5; k < 5.1; k += 1.05) block('stone', .97, .48, .24, k + course * .12, -.18 + course * .54, side * 4.52);
      for (let k = -4; k < 4.1; k += 1.05) block('stone', .24, .48, .97, side * 5.42, -.18 + course * .54, k + course * .12);
    }
    block('plaster', 9.2, 5.5, 7.4, 0, 3.3, 0);
    for (const a of [-4.6, 0, 4.6]) for (const c of [-3.8, 3.8]) block('wood', .3, 5.8, .3, a, 3.4, c);
    for (const b of [.8, 3.5, 5.9]) block('wood', 9.6, .23, 7.8, 0, b, 0);
    // Two broad pitched roof planes, individual standing seams and deep eaves.
    for (const side of [-1, 1]) {
      const roof = new THREE.BoxGeometry(11.8 * s, .25 * s, 5.8 * s);
      roof.rotateX(side * .46); roof.rotateY(turn);
      add('roof', roof, { at: local(0, 6.9, side * 2.45) });
      // Overlapping timber shingles break up the broad roof surface. Their
      // staggered edges and small gaps remain physical at close camera angles.
      for (let row = 0; row < 11; row++) for (let col = 0; col < 19; col++) {
        const along = .3 + row * .46, a = -5.55 + col * .60 + (row % 2) * .13;
        const shingle = new THREE.BoxGeometry(.58 * s, .055 * s, .62 * s);
        shingle.rotateX(side * .46); shingle.rotateY(turn);
        add('shingles', shingle, { at: local(a, 8.20 - along * Math.tan(.46) + (col % 3) * .008, side * along) });
      }
      for (let a = -5.3; a < 5.4; a += 1.1) add('wood', rod(local(a, 8, 0), local(a, 5.48, side * 5.15), .075 * s));
      for (let seam = -5.6; seam <= 5.6; seam += .55) add('copper', rod(local(seam, 8.2, 0), local(seam, 5.65, side * 5.1), .035 * s));
    }
    add('wood', rod(local(-6.1, 8.15, 0), local(6.1, 8.15, 0), .18 * s));
    // Close the gables and give the river-facing ends their own window bays.
    for (const side of [-1, 1]) {
      const gable = new THREE.BufferGeometry();
      const points = [local(side * 4.59, 5.9, -3.7), local(side * 4.59, 5.9, 3.7), local(side * 4.59, 8.15, 0)];
      if (side < 0) points.reverse();
      gable.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
      gable.computeVertexNormals(); add('plaster', gable);
      for (const c of [-1.8, 1.8]) {
        block('light', .08, 2.6, 2.5, side * 4.64, 3.1, c);
        for (const offset of [-1.3, -.65, 0, .65, 1.3]) block('wood', .12, 2.8, .065, side * 4.7, 3.1, c + offset);
        for (const offset of [-1.4, -.47, .47, 1.4]) block('wood', .12, .065, 2.7, side * 4.7, 3.1 + offset, c);
        block('wood', .6, .17, 3, side * 4.75, 1.62, c);
      }
      add('wood', rod(local(side * 4.68, 5.9, -3.9), local(side * 4.68, 8.25, 0), .09 * s));
      add('wood', rod(local(side * 4.68, 8.25, 0), local(side * 4.68, 5.9, 3.9), .09 * s));
      for (let c = -4.5; c < 4.6; c += .42) block('pale', 2.6, .15, .38, side * 5.8, .8, c);
      for (const c of [-4.3, 0, 4.3]) block('wood', .25, 3, .25, side * 6.8, -.6, c);
    }
    // Glowing shoji windows, with wooden mullions in front of the paper.
    for (const side of [-1, 1]) for (const a of [-2.7, 2.7]) {
      block('light', 2.25, 2.55, .06, a, 3.1, side * 3.76);
      for (const dx of [-1.2, -.6, 0, .6, 1.2]) block('wood', .055, 2.65, .1, a + dx, 3.1, side * 3.83);
      for (const dy of [-1.3, -.43, .43, 1.3]) block('wood', 2.45, .055, .1, a, 3.1 + dy, side * 3.83);
    }
    block('wood', 1.2, 2.4, .13, 0, 2, 3.8);
    // Veranda, planks, stilt posts and stairway.
    for (let k = -5; k < 5.1; k += .42) block('pale', .38, .18, 2.3, k, .8, 4.7);
    for (const a of [-5, 0, 5]) block('wood', .25, 3.4, .25, a, -.65, 5.6);
    for (let k = 0; k < 4; k++) block('wood', 2, .22, .48, 0, .6 - k * .22, 6 + k * .4);
    for (const a of [-4, 4]) lantern(...local(a, 4.3, 4.8), .45 * s);
    if (cabin.temple) {
      // A second copper roof turns the lakeside lodge into a small sanctuary.
      block('plaster', 5, 3.5, 4, 0, 8, 0);
      for (const side of [-1, 1]) { const g = new THREE.BoxGeometry(7.6 * s, .22 * s, 3.7 * s); g.rotateX(side * .48); g.rotateY(turn); add('copper', g, { at: local(0, 10.2, side * 1.5) }); }
    }
  }

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
    const x = riverX(z) + side * (riverWidth(z) + 9), y = terrainHeight(x, z) + .18;
    box('pale', 2.7, .14, .5, [x, y, z]);
  }
  for (const side of [-1, 1]) for (let z = -42; z < 70; z += 14) {
    const x = riverX(z) + side * 20, y = Math.max(2.2, terrainHeight(x, z));
    add('wood', rod([x, y, z], [x, y + 4, z], .09));
    add('wood', rod([x, y + 4, z], [x - side * 1, y + 4, z], .07));
    lantern(x - side * .8, y + 3.5, z, .37);
  }
  const root = new THREE.Group(); root.name = 'The sleeping village'; scene.add(root); batch.build(root, 'Autumn village');

  const mill = cabins.find(c => c.mill), wheel = new THREE.Group();
  const axle = new THREE.Group(); axle.position.set(mill.x + 7.7, 4, mill.z); axle.rotation.y = Math.PI / 2; axle.add(wheel); scene.add(axle);
  const wood = finishes.wood.material;
  for (const z of [-.65, .65]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.8, .17, 5, 40), wood); ring.position.z = z; wheel.add(ring);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const spoke = new THREE.Mesh(rod([0, 0, z], [Math.cos(a) * 3.8, Math.sin(a) * 3.8, z], .11), wood); wheel.add(spoke); }
  }
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, paddle = new THREE.Mesh(new THREE.BoxGeometry(.7, .13, 1.7), finishes.pale.material); paddle.position.set(Math.cos(a) * 3.7, Math.sin(a) * 3.7, 0); paddle.rotation.z = a; wheel.add(paddle); }
  wheel.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { update(time) { wheel.rotation.z = time * .07; }, lanterns, root };
}
