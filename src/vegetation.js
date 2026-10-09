import * as THREE from 'three';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import {
  TAU, frames, bankOuter, deckOuter, lawnHeight, islands, islandHeight, islandEdge, RIM,
  towers, pods, footbridge, rng,
} from './layout.js';

// Trees are real branching meshes with photographed, alpha-cut leaf sprays.
// Each species is drawn at three levels of detail chosen per tree, per frame.
const tmp = new THREE.Object3D(), color = new THREE.Color();
const NEAR = 24, MID = 56;

function addWind(material, time, { leaf = false } = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.vegetationTime = time;
    shader.vertexShader = `uniform float vegetationTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = vec3(0.0);
      #ifdef USE_INSTANCING
        root = instanceMatrix[3].xyz;
      #endif
      float breeze = sin(vegetationTime * 0.8 + root.x * 0.17 + root.z * 0.12);
      float flutter = sin(vegetationTime * 2.1 + position.x * 8.0 + position.z * 6.0);
      float flexibility = pow(clamp(position.y / 12.0, 0.0, 1.0), 1.5);
      transformed.x += (breeze * 0.09 + flutter * 0.025) * flexibility;
      transformed.z += cos(vegetationTime * 0.6 + root.x * 0.09 + root.z * 0.14) * 0.04 * flexibility;
    `);
    // Plants are lit by the sun, by blue sky from above and by green light
    // bounced up from the lawns. Thin leaves also glow when the sun is behind
    // them, while the vertex colour keeps the heart of each crown deep green.
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      float skyward = inverseTransformDirection(normal, viewMatrix).y * .5 + .5;
      reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(vec3(.2, .27, .13), vec3(.5, .66, .8), skyward) * .62;
      ${leaf ? `
      #if NUM_DIR_LIGHTS > 0
        vec3 sunward = directionalLights[0].direction;
        float behind = saturate(dot(-sunward, normal)) * .55 + pow(saturate(dot(geometryViewDir, -sunward)), 3.) * .8;
        reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * vec3(.8, 1., .34) * behind * .11;
      #endif` : ''}
    `);
  };
  material.customProgramCacheKey = () => `aero-foliage-${leaf}`;
}

function instanced(geometry, material, placements, parent, { shadows = true, name = '', layer = 0 } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, placements.length));
  mesh.name = name; mesh.count = placements.length;
  placements.forEach((p, i) => {
    tmp.position.set(p.x, p.y, p.z);
    tmp.rotation.set(p.rx || 0, p.rotation || 0, p.rz || 0);
    tmp.scale.set(p.sx || p.scale || 1, p.sy || p.scale || 1, p.sz || p.scale || 1);
    tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix);
    mesh.setColorAt(i, color.setHex(p.tint ?? 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.computeBoundingSphere(); mesh.layers.set(layer);
  parent.add(mesh);
  return mesh;
}

// Round the shading of the crown and darken the sprays buried inside it.
function shapeCrown(geometry, random) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const pos = geometry.attributes.position, normals = geometry.attributes.normal, colors = new Float32Array(pos.count * 3);
  const normal = new THREE.Vector3(), radial = new THREE.Vector3(), middle = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 4) {
    middle.set(0, 0, 0);
    for (let j = i; j < i + 4; j++) middle.add(radial.fromBufferAttribute(pos, j));
    middle.multiplyScalar(.25).sub(center).divide(half);
    const depth = Math.min(1, middle.length() / 1.05), lift = middle.y * .5 + .5;
    const shade = (.46 + .54 * depth * depth) * (.78 + .22 * lift), tone = .84 + random() * .16, warm = random();
    for (let j = i; j < Math.min(i + 4, pos.count); j++) {
      radial.fromBufferAttribute(pos, j).sub(center); radial.y = radial.y * .7 + half.y * .25; radial.normalize();
      normal.fromBufferAttribute(normals, j).lerp(radial, .78).normalize();
      normals.setXYZ(j, normal.x, normal.y, normal.z);
      colors[j * 3] = shade * tone * (.9 + warm * .16); colors[j * 3 + 1] = shade * tone; colors[j * 3 + 2] = shade * tone * (.86 - warm * .12);
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// A lighter crown made from every nth spray, enlarged to hold its silhouette.
function thinned(source, keep, enlargement) {
  const result = new THREE.BufferGeometry(), arrays = { position: [], normal: [], uv: [], color: [] }, indices = [], attributes = source.attributes;
  const center = new THREE.Vector3(), p = new THREE.Vector3();
  let offset = 0;
  for (let start = 0; start + 3 < attributes.position.count; start += keep * 4) {
    center.set(0, 0, 0);
    for (let v = 0; v < 4; v++) center.add(p.fromBufferAttribute(attributes.position, start + v));
    center.multiplyScalar(.25);
    for (let v = 0; v < 4; v++) {
      p.fromBufferAttribute(attributes.position, start + v).sub(center).multiplyScalar(enlargement).add(center);
      arrays.position.push(p.x, p.y, p.z);
      for (const name of ['normal', 'uv', 'color']) { const a = attributes[name]; for (let k = 0; k < a.itemSize; k++) arrays[name].push(a.array[(start + v) * a.itemSize + k]); }
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3); offset += 4;
  }
  for (const [name, data] of Object.entries(arrays)) result.setAttribute(name, new THREE.Float32BufferAttribute(data, name === 'uv' ? 2 : 3));
  result.setIndex(indices); result.computeBoundingSphere();
  return result;
}

function limbs(source, indexCount) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(new THREE.BufferAttribute(source.index.array.subarray(0, Math.min(indexCount ?? Infinity, source.index.count)), 1));
  geometry.boundingSphere = source.boundingSphere; geometry.boundingBox = source.boundingBox;
  return geometry;
}

// A hanging strand: a short chain of leaf sprays, each turned a little.
function vineStrand() {
  const positions = [], uvs = [], indices = [];
  for (let link = 0; link < 4; link++) for (const turn of [0, Math.PI / 2]) {
    const angle = link * 1.1 + turn, c = Math.cos(angle) * .42, s = Math.sin(angle) * .42, top = -link * .82, k = positions.length / 3;
    positions.push(-c, top, -s, -c, top - 1.05, -s, c, top - 1.05, s, c, top, s); uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length).fill(.82), 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

const SPECIES = [
  { preset: 'Oak Medium', seed: 37191, height: 8.6, leaves: 14, tint: [2.2, 2.25, 1.1] },
  { preset: 'Ash Medium', seed: 81923, height: 9.2, leaves: 11, tint: [1.9, 2.3, 1] },
  { preset: 'Oak Medium', seed: 56911, height: 7.6, leaves: 13, tint: [1.85, 2.15, 1.25] },
  { preset: 'Aspen Medium', seed: 22641, height: 10.4, leaves: 12, tint: [.62, 1.5, .42], size: 2 },
  { preset: 'Oak Large', seed: 23399, height: 10.9, leaves: 15, tint: [2.2, 2.25, 1.1], hero: true },
  { preset: 'Aspen Medium', seed: 60113, height: 8.2, leaves: 11, tint: [1.15, 1.02, .6], size: 2 },
  { preset: 'Bush 1', seed: 17751, height: 1.9, leaves: 10, tint: [1.9, 2.2, 1.05], bush: true },
  { preset: 'Bush 2', seed: 40903, height: 1.7, leaves: 9, tint: [1.2, 1.05, .55], bush: true, leafType: 'aspen' },
];
const HERO = 4, GOLDEN = 5, SHRUB = 6, BLOSSOM = 7;

// Decide where everything grows: lawns along both banks, the park islands, and
// the beds the city builder asked to have planted.
function plant(plantings) {
  const random = rng(580327), groups = SPECIES.map(() => []), taken = [];
  const blocked = (x, z, room) => towers.some(t => Math.hypot(x - t.x, z - t.z) < t.radius + 3.2 + room)
    || pods.some(p => Math.hypot(x - p.x, z - p.z) < 3.4 + room)
    || footbridge.some((p, i) => i && Math.hypot(x - (p[0] + footbridge[i - 1][0]) / 2, z - (p[2] + footbridge[i - 1][2]) / 2) < 5.5 + room)
    || footbridge.some(p => Math.hypot(x - p[0], z - p[2]) < 4.5 + room);
  const free = (x, z, room) => { if (taken.some(t => Math.hypot(x - t[0], z - t[1]) < room + t[2])) return false; taken.push([x, z, room]); return true; };
  const hue = () => [0xffffff, 0xf2ffe2, 0xe4f6d2, 0xfff7dc, 0xdcf2d0][Math.floor(random() * 5)];
  const wood = (x, y, z, scale) => { const roll = random(), kind = roll < .3 ? 0 : roll < .52 ? 1 : roll < .72 ? 2 : roll < .93 ? 3 : GOLDEN; groups[kind].push({ x, y: y - .06, z, scale, rotation: random() * TAU, tint: hue() }); };
  const shrub = (x, y, z, scale) => groups[random() < .16 ? BLOSSOM : SHRUB].push({ x, y: y - .08, z, scale, rotation: random() * TAU, tint: hue() });

  for (const side of [-1, 1]) for (let i = 8; i < frames.length - 8; i += 4) {
    const f = frames[i], inner = deckOuter(side, f.t) + .3, outer = bankOuter(side, f.t) - .5;
    for (let d = inner + .9; d < outer - .9; d += 1.15) {
      const jitter = (random() - .5) * 1.8, reach = d + (random() - .5) * .9;
      const x = f.x + f.nx * side * reach + f.tx * jitter, z = f.z + f.nz * side * reach + f.tz * jitter, y = lawnHeight(x, z, reach - inner, outer - reach);
      const row = d - inner, roll = random();
      if (row > 2.2 && roll > .72 && !blocked(x, z, 1.6) && free(x, z, 2.1)) wood(x, y, z, .62 + random() * .58);
      else if ((row < 1.8 ? roll > .5 : roll > .56 && roll < .7) && !blocked(x, z, .2) && free(x, z, .7)) shrub(x, y, z, .55 + random() * .7);
    }
  }
  for (const island of islands) {
    if (island.wild) continue;
    const spot = reach => { const a = random() * TAU, r = Math.sqrt(random()) * reach * islandEdge(island, a); const x = island.x + Math.cos(a) * r * island.rx, z = island.z + Math.sin(a) * r * island.rz; return [x, islandHeight(island, x, z), z]; };
    for (let i = 0; i < island.rx * island.rz * .075; i++) { const [x, y, z] = spot(RIM * .84); if (free(x, z, 2.7)) wood(x, y, z, .66 + random() * .55); }
    for (let i = 0; i < island.rx * island.rz * .09; i++) { const [x, y, z] = spot(RIM * .95); if (free(x, z, .8)) shrub(x, y, z, .55 + random() * .65); }
  }
  let street = 0;
  for (const p of plantings.trees) groups[p.hero ? HERO : p.street ? (street++ % 2 ? 1 : 3) : Math.floor(random() * 3)].push({ ...p, y: p.y - .04, rotation: random() * TAU, tint: hue() });
  for (const p of plantings.shrubs) groups[random() < .22 ? BLOSSOM : SHRUB].push({ ...p, y: p.y - .05, rotation: random() * TAU, tint: hue() });
  return groups;
}

export async function createVegetation({ scene, plantings, renderer }) {
  const time = { value: 0 };
  const vegetation = new THREE.Group(); vegetation.name = 'Living botanical landscape'; scene.add(vegetation);
  const reflected = [], batches = [], shrubs = [], resources = [], textures = new Set();
  const frustum = new THREE.Frustum(), viewProjection = new THREE.Matrix4(), mirrored = new THREE.Sphere();
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const groups = plant(plantings);
  let ashLeaves = null;

  for (let i = 0; i < SPECIES.length; i++) {
    const species = SPECIES[i], placements = groups[i], tree = new Tree();
    tree.options.copy(structuredClone(TreePreset[species.preset]));
    tree.options.seed = species.seed;
    tree.options.leaves.count = species.leaves;
    tree.options.leaves.size *= species.size || (species.bush ? 2.0 : 2.4);
    tree.options.leaves.alphaTest = .45;
    tree.options.leaves.tint = 0xffffff; tree.options.bark.tint = 0xffffff;
    if (species.leafType) tree.options.leaves.type = species.leafType;
    if (!species.hero && !species.bush) {
      Object.assign(tree.options.branch.sections, tree.options.branch.levels === 3 ? { 0: 9, 1: 5, 2: 3, 3: 2 } : { 0: 9, 1: 5, 2: 4 });
      Object.assign(tree.options.branch.segments, tree.options.branch.levels === 3 ? { 0: 8, 1: 5, 2: 3, 3: 3 } : { 0: 7, 1: 4, 2: 3 });
    }
    // Branches are generated breadth-first, so each level of the tree is one
    // contiguous run of indices that distant trees can simply stop short of.
    const levelStart = [], generateBranch = tree.generateBranch;
    tree.generateBranch = function (branch) { if (levelStart[branch.level] === undefined) levelStart[branch.level] = this.branches.indices.length; return generateBranch.call(this, branch); };
    tree.generate();
    const branches = tree.branchesMesh.geometry, leaves = tree.leavesMesh.geometry;
    const scale = species.height / new THREE.Box3().setFromObject(tree).max.y;
    branches.scale(scale, scale, scale); leaves.scale(scale, scale, scale);
    shapeCrown(leaves, rng(species.seed));
    const sourceBark = tree.branchesMesh.material, sourceLeaf = tree.leavesMesh.material;
    for (const texture of [sourceBark.map, sourceBark.normalMap, sourceBark.roughnessMap, sourceLeaf.map]) if (texture) { texture.anisotropy = maxAnisotropy; textures.add(texture); }
    if (species.preset.startsWith('Ash')) ashLeaves = sourceLeaf.map;
    const bark = new THREE.MeshLambertMaterial({ map: sourceBark.map, normalMap: sourceBark.normalMap, normalScale: new THREE.Vector2(.65, .65), color: 0xc4beb2 });
    const foliage = new THREE.MeshLambertMaterial({ map: sourceLeaf.map, vertexColors: true, alphaTest: .42, alphaToCoverage: true, side: THREE.DoubleSide });
    foliage.color.setRGB(...species.tint); foliage.shadowSide = THREE.DoubleSide;
    addWind(bark, time); addWind(foliage, time, { leaf: true });
    resources.push(branches, leaves, bark, foliage);
    sourceBark.dispose(); sourceLeaf.dispose();
    if (!placements.length) continue;

    if (species.bush) {
      const light = thinned(leaves, 5, 1.9), parent = new THREE.Group(); vegetation.add(parent);
      const trunk = instanced(limbs(branches, levelStart[1]), bark, placements, parent, { name: `${species.preset} stems`, layer: 1 });
      const crown = instanced(light, foliage, placements, parent, { name: `${species.preset} leaves`, layer: 1 });
      shrubs.push({ parent, trunk, crown, entries: placements.map((p, index) => { const matrix = new THREE.Matrix4(); crown.getMatrixAt(index, matrix); return { matrix, tint: p.tint ?? 0xffffff, center: new THREE.Vector3(p.x, p.y + 1, p.z), radius: 2.4 * p.scale }; }) });
      resources.push(light);
      continue;
    }
    const crowns = [leaves, thinned(leaves, 4, 1.7), thinned(leaves, 14, 3)];
    const trunks = [branches, limbs(branches, levelStart[3]), limbs(branches, levelStart[2])];
    const canopies = crowns.map((geometry, level) => {
      const mesh = instanced(geometry, foliage, placements, vegetation, { name: `${species.preset} leaves ${level}` });
      if (level > 0) mesh.count = 0;
      reflected.push({ mesh, far: crowns[2], current: geometry });
      return mesh;
    });
    const stems = trunks.map((geometry, level) => {
      const mesh = instanced(geometry, bark, placements, vegetation, { name: `${species.preset} branches ${level}` });
      if (level > 0) mesh.count = 0;
      reflected.push({ mesh, far: trunks[2], current: geometry });
      return mesh;
    });
    const entries = placements.map((placement, index) => {
      const matrix = new THREE.Matrix4(); stems[0].getMatrixAt(index, matrix);
      const radius = species.height * placement.scale * .8;
      return { matrix, tint: placement.tint ?? 0xffffff, bounds: new THREE.Sphere(new THREE.Vector3(placement.x, placement.y + radius * .6, placement.z), radius), reach: Math.max(1, placement.scale) };
    });
    batches.push({ stems, canopies, entries });
    resources.push(crowns[1], crowns[2]);
  }

  const lowPlants = new THREE.Group(); lowPlants.name = 'Lawn and hanging plants'; vegetation.add(lowPlants);
  if (ashLeaves && plantings.vines.length) {
    const strand = vineStrand(), vineMaterial = new THREE.MeshLambertMaterial({ map: ashLeaves, vertexColors: true, alphaTest: .42, alphaToCoverage: true, side: THREE.DoubleSide });
    vineMaterial.color.setRGB(1.5, 1.75, 1);
    addWind(vineMaterial, time, { leaf: true });
    instanced(strand, vineMaterial, plantings.vines.map(v => ({ x: v.x, y: v.y, z: v.z, scale: v.drop / 3.6, rotation: -v.angle, tint: 0xffffff })), lowPlants, { shadows: false, name: 'Hanging vines', layer: 1 });
    resources.push(strand, vineMaterial);
  }

  // Texture images are embedded by EZ-Tree. Wait for their decode before the
  // first frame so the user never sees opaque leaf-card rectangles loading in.
  await Promise.all([...textures].map(texture => {
    const image = texture.image;
    return image && typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
  }));

  const count = list => list.reduce((sum, placements) => sum + placements.length, 0);
  return {
    root: vegetation,
    update(elapsedTime, camera) {
      time.value = elapsedTime;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const batch of batches) {
        for (const mesh of batch.stems) mesh.count = 0;
        for (const mesh of batch.canopies) mesh.count = 0;
        for (const entry of batch.entries) {
          mirrored.copy(entry.bounds); mirrored.center.y *= -1;
          // Keep anything visible in either the camera or the mirrored water view.
          if (!frustum.intersectsSphere(entry.bounds) && !frustum.intersectsSphere(mirrored)) continue;
          const distance = camera.position.distanceTo(entry.bounds.center) / entry.reach, level = distance < NEAR ? 0 : distance < MID ? 1 : 2;
          const canopy = batch.canopies[level], stem = batch.stems[level];
          canopy.setColorAt(canopy.count, color.setHex(entry.tint)); canopy.setMatrixAt(canopy.count++, entry.matrix);
          stem.setMatrixAt(stem.count++, entry.matrix);
        }
        for (const mesh of [...batch.stems, ...batch.canopies]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
      }
      for (const group of shrubs) {
        group.trunk.count = group.crown.count = 0;
        for (const entry of group.entries) {
          if (camera.position.distanceToSquared(entry.center) > 150 * 150) continue;
          mirrored.set(entry.center, entry.radius); if (!frustum.intersectsSphere(mirrored)) continue;
          group.crown.setColorAt(group.crown.count, color.setHex(entry.tint)); group.crown.setMatrixAt(group.crown.count++, entry.matrix);
          group.trunk.setMatrixAt(group.trunk.count++, entry.matrix);
        }
        group.crown.instanceMatrix.needsUpdate = group.trunk.instanceMatrix.needsUpdate = group.crown.instanceColor.needsUpdate = true;
      }
    },
    // The mirror pass draws every tree at its lightest level of detail.
    reflectionBegin() { for (const item of reflected) item.mesh.geometry = item.far; },
    reflectionEnd() { for (const item of reflected) item.mesh.geometry = item.current; },
    stats: { trees: count(groups.slice(0, SHRUB)), shrubs: count(groups.slice(SHRUB)), vines: plantings.vines.length },
    dispose() { scene.remove(vegetation); for (const resource of resources) resource.dispose(); },
  };
}
