import * as THREE from 'three';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';

// Trees are actual branching meshes with photographed, alpha-cut leaf sprays.
// Every tree in a species batch shares geometry; no canopy proxy is visible.
const TAU = Math.PI * 2;
const tmp = new THREE.Object3D();
const color = new THREE.Color();

function rng(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function addWind(material, time, { grass = false, translucency = false } = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.vegetationTime = time;
    shader.vertexShader = `uniform float vegetationTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = vec3(0.0);
      #ifdef USE_INSTANCING
        root = instanceMatrix[3].xyz;
      #endif
      float breeze = sin(vegetationTime * 0.8 + root.x * 0.17 + root.z * 0.12);
      float flutter = sin(vegetationTime * 2.1 + position.x * 8.0 + position.z * 6.0);
      float flexibility = ${grass ? 'pow(clamp(position.y, 0.0, 1.0), 1.6)' : 'pow(clamp(position.y / 12.0, 0.0, 1.0), 1.5)'};
      transformed.x += (breeze * ${grass ? '0.12' : '0.09'} + flutter * ${grass ? '0.018' : '0.025'}) * flexibility;
      transformed.z += cos(vegetationTime * 0.6 + root.x * 0.09 + root.z * 0.14) * ${grass ? '0.075' : '0.04'} * flexibility;
    `);
    if (translucency) {
      // A restrained approximation of sunlight transmitted by thin foliage.
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float leafTransmission = 0.13 + 0.10 * pow(1.0 - abs(dot(normal, geometryViewDir)), 2.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.85, 1.0, 0.46) * leafTransmission;
      `);
    }
  };
  material.customProgramCacheKey = () => `aero-foliage-${grass}-${translucency}`;
}

function instanced(geometry, material, placements, parent, { shadows = true, name = '' } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  placements.forEach((p, i) => {
    tmp.position.set(p.x, p.y, p.z);
    tmp.rotation.set(p.rx || 0, p.rotation || 0, p.rz || 0);
    tmp.scale.set(p.sx || p.scale || 1, p.sy || p.scale || 1, p.sz || p.scale || 1);
    tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix);
    if (p.tint) mesh.setColorAt(i, color.setHex(p.tint));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function softenLeaves(geometry, random) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const pos = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const vertexColors = new Float32Array(pos.count * 3);
  const normal = new THREE.Vector3(), radial = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 4) {
    const tint = 0.76 + random() * 0.24;
    for (let j = i; j < Math.min(i + 4, pos.count); j++) {
      // Canopy-oriented normals keep individual leaf cards from looking flat.
      radial.fromBufferAttribute(pos, j).sub(center);
      radial.y *= 0.7; radial.normalize();
      normal.fromBufferAttribute(normals, j).lerp(radial, 0.72).normalize();
      normals.setXYZ(j, normal.x, normal.y, normal.z);
      const height = (pos.getY(j) - box.min.y) / Math.max(1, box.max.y - box.min.y);
      vertexColors[j * 3] = tint * (0.9 + height * 0.1);
      vertexColors[j * 3 + 1] = tint;
      vertexColors[j * 3 + 2] = tint * 0.9;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
}

function reflectionGeometry(source, stride = 16, enlargement = 1.65) {
  // Use every fourth real leaf spray, enlarged a little to preserve density.
  // The reflection never substitutes spheres for foliage.
  const result = new THREE.BufferGeometry(), arrays = {};
  for (const name of ['position', 'normal', 'uv', 'color']) arrays[name] = [];
  const indices = [], attributes = source.attributes;
  let offset = 0;
  for (let start = 0; start < attributes.position.count; start += stride) {
    const center = new THREE.Vector3();
    for (let v = 0; v < 4; v++) center.add(new THREE.Vector3().fromBufferAttribute(attributes.position, start + v));
    center.multiplyScalar(0.25);
    for (let v = 0; v < 4; v++) {
      const p = new THREE.Vector3().fromBufferAttribute(attributes.position, start + v).sub(center).multiplyScalar(enlargement).add(center);
      arrays.position.push(p.x, p.y, p.z);
      for (const name of ['normal', 'uv', 'color']) {
        const a = attributes[name];
        for (let k = 0; k < a.itemSize; k++) arrays[name].push(a.array[(start + v) * a.itemSize + k]);
      }
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3); offset += 4;
  }
  for (const [name, data] of Object.entries(arrays)) result.setAttribute(name, new THREE.Float32BufferAttribute(data, name === 'uv' ? 2 : 3));
  result.setIndex(indices); result.computeBoundingSphere();
  return result;
}

function grassTuft() {
  const random = rng(77681), positions = [], colors = [], indices = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = random() * TAU, ox = (random() - 0.5) * 0.36, oz = (random() - 0.5) * 0.36;
    const height = 0.58 + random() * 0.42, width = 0.016 + random() * 0.018, bend = 0.17 + random() * 0.3;
    const base = positions.length / 3;
    for (let segment = 0; segment < 4; segment++) {
      const t = segment / 3, half = width * (1 - t) + 0.0005;
      const cx = ox + Math.cos(angle) * bend * t * t;
      const cz = oz + Math.sin(angle) * bend * t * t;
      for (const side of [-1, 1]) {
        positions.push(cx + Math.cos(angle + Math.PI / 2) * half * side, height * t, cz + Math.sin(angle + Math.PI / 2) * half * side);
        colors.push(0.035 + t * 0.055, 0.13 + t * 0.16, 0.008 + t * 0.018);
      }
      if (segment < 3) { const k = base + segment * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function flowerGeometry() {
  // Small meadow daisies: slender stems and six curved, off-white petals.
  const positions = [], colors = [], indices = [];
  for (let p = 0; p < 6; p++) {
    const angle = p / 6 * TAU, radius = 0.085, w = 0.026, k = positions.length / 3;
    for (const [r, side, y] of [[0.011, -1, 0], [radius, -1, 0.012], [radius, 1, 0.012], [0.011, 1, 0]]) {
      positions.push(Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * w * side, 0.3 + y, Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * w * side);
      colors.push(0.98, 0.94, 0.77);
    }
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const k = positions.length / 3;
  positions.push(-0.008, 0, 0, 0.008, 0, 0, 0.004, 0.3, 0, -0.004, 0.3, 0);
  for (let v = 0; v < 4; v++) colors.push(0.2, 0.38, 0.08);
  indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export async function createVegetation({ scene, islands, islandHeight, renderer }) {
  const random = rng(580327), time = { value: 0 };
  const vegetation = new THREE.Group(); vegetation.name = 'Living botanical landscape'; scene.add(vegetation);
  const lowPlants = new THREE.Group(); lowPlants.name = 'Windblown meadows'; vegetation.add(lowPlants);
  const reflected = [], resources = [], textures = new Set();
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const variants = [
    { preset: 'Oak Medium', seed: 37191, height: 8.4, leaves: 14 },
    { preset: 'Ash Medium', seed: 81923, height: 8.8, leaves: 11 },
    { preset: 'Oak Medium', seed: 56911, height: 7.7, leaves: 13 },
    { preset: 'Ash Medium', seed: 22641, height: 9.6, leaves: 12 },
    { preset: 'Oak Large', seed: 23399, height: 10.9, leaves: 15, hero: true },
    { preset: 'Bush 1', seed: 17751, height: 1.9, leaves: 10, bush: true },
  ];
  const placementGroups = variants.map(() => []);
  const grassGroups = [], flowers = [];
  const heroLocations = [[-24, 14], [-31, -24]];
  for (let n = 0; n < islands.length; n++) {
    const island = islands[n], placements = [];
    const count = n < 5 ? 8 : 11;
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU, r = Math.sqrt(random()) * 0.75;
      const x = island.x + Math.cos(angle) * island.rx * r, z = island.z + Math.sin(angle) * island.rz * r;
      const y = islandHeight(island, x, z);
      if (y < 0.4 || heroLocations.some(p => Math.hypot(x - p[0], z - p[1]) < 5)) continue;
      // Keep the little civic waterfront visually open around the towers.
      if (n === 1 && x > 20 && x < 41 && z > -15 && z < 11) continue;
      const variant = (i + n) % 4;
      placementGroups[variant].push({ x, y: y - 0.08, z, scale: 0.58 + random() * 0.4, rotation: random() * TAU, tint: 0xffffff });
    }
    for (let i = 0; i < 19; i++) {
      const angle = random() * TAU, r = Math.sqrt(random()) * 0.87;
      const x = island.x + Math.cos(angle) * island.rx * r, z = island.z + Math.sin(angle) * island.rz * r;
      const y = islandHeight(island, x, z); if (y < 0.25) continue;
      placementGroups[5].push({ x, y: y - 0.09, z, scale: 0.5 + random() * 0.65, rotation: random() * TAU });
    }
    // Independent island batches allow Three.js to cull grass behind the camera.
    const grassCount = n < 5 ? 2200 : 1100;
    for (let i = 0; i < grassCount; i++) {
      const angle = random() * TAU, r = Math.sqrt(random()) * 0.94;
      const x = island.x + Math.cos(angle) * island.rx * r, z = island.z + Math.sin(angle) * island.rz * r;
      const y = islandHeight(island, x, z); if (y < 0.2) continue;
      if (n === 1 && x > 24 && x < 33 && z > -7 && z < 3) continue;
      const height = 0.26 + random() * 0.42;
      placements.push({ x, y: y - 0.015, z, sx: 0.7 + random() * 0.45, sy: height, sz: 0.7 + random() * 0.45, rotation: random() * TAU });
      if (i % 28 === 0) flowers.push({ x, y, z, scale: 0.65 + random() * 0.8, rotation: random() * TAU });
    }
    grassGroups.push(placements);
  }
  placementGroups[4].push(
    { x: -24, y: islandHeight(islands[0], -24, 14) - 0.04, z: 14, scale: 1, rotation: 0.4 },
    { x: -31, y: islandHeight(islands[2], -31, -24) - 0.04, z: -24, scale: 0.96, rotation: 2.7 },
    { x: -10, y: 15.1, z: -84, scale: 1.1, rotation: 0.9 },
    { x: -19, y: 10.8, z: 24, scale: 0.38, rotation: 1.8 },
  );
  // Small plants and grass continue across the two suspended gardens.
  for (const garden of [{ x: -10, z: -84, y: 13, rx: 7.7, rz: 7.7, h: 2.8, seed: 42 }, { x: -19, z: 24, y: 10, rx: 3.2, rz: 3.2, h: 1.6, seed: 43 }]) {
    const placements = [];
    for (let i = 0; i < 650; i++) {
      const angle = random() * TAU, r = Math.sqrt(random()) * 0.86;
      const x = garden.x + Math.cos(angle) * garden.rx * r, z = garden.z + Math.sin(angle) * garden.rz * r;
      const y = garden.y + islandHeight(garden, x, z);
      placements.push({ x, y, z, sx: 0.75, sy: 0.23 + random() * 0.22, sz: 0.75, rotation: random() * TAU });
      if (i % 70 === 0 && r > 0.45) placementGroups[5].push({ x, y: y - 0.08, z, scale: 0.25 + random() * 0.24, rotation: random() * TAU });
    }
    grassGroups.push(placements);
  }

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i], tree = new Tree();
    tree.options.copy(structuredClone(TreePreset[variant.preset]));
    tree.options.seed = variant.seed;
    tree.options.leaves.count = variant.leaves * (variant.bush ? 1 : 2);
    tree.options.leaves.size *= variant.bush ? 2.0 : 1.75;
    tree.options.leaves.alphaTest = 0.45;
    tree.options.leaves.tint = 0xffffff;
    tree.options.bark.tint = 0xffffff;
    if (!variant.hero) {
      tree.options.branch.sections[0] = 9;
      tree.options.branch.sections[1] = 5;
      tree.options.branch.sections[2] = 3;
      tree.options.branch.sections[3] = 2;
      tree.options.branch.segments[0] = 8;
      tree.options.branch.segments[1] = 5;
      tree.options.branch.segments[2] = 3;
      tree.options.branch.segments[3] = 3;
    }
    tree.generate();
    const branches = tree.branchesMesh.geometry, leaves = tree.leavesMesh.geometry;
    const bounds = new THREE.Box3().setFromObject(tree), height = bounds.max.y;
    const scale = variant.height / height;
    branches.scale(scale, scale, scale); leaves.scale(scale, scale, scale);
    softenLeaves(leaves, rng(variant.seed));
    const sourceBark = tree.branchesMesh.material, sourceLeaf = tree.leavesMesh.material;
    for (const texture of [sourceBark.map, sourceBark.normalMap, sourceBark.roughnessMap, sourceLeaf.map]) {
      if (texture) { texture.anisotropy = maxAnisotropy; textures.add(texture); }
    }
    const bark = new THREE.MeshStandardMaterial({ map: sourceBark.map, normalMap: sourceBark.normalMap, normalScale: new THREE.Vector2(0.65, 0.65), roughnessMap: sourceBark.roughnessMap, color: 0xbdb7aa, roughness: 0.96, envMapIntensity: 0.3 });
    const foliage = new THREE.MeshStandardMaterial({ map: sourceLeaf.map, color: 0xf1ffe0, vertexColors: true, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.38 });
    foliage.shadowSide = THREE.DoubleSide;
    addWind(foliage, time, { translucency: true });
    const reflection = reflectionGeometry(leaves);
    const middle = reflectionGeometry(leaves,8,1.2);
    const clusters = new Map();
    for (const placement of placementGroups[i]) {
      const key = `${Math.floor(placement.x/40)},${Math.floor(placement.z/40)}`;
      if (!clusters.has(key)) clusters.set(key,[]);
      clusters.get(key).push(placement);
    }
    for (const placements of clusters.values()) {
      instanced(branches, bark, placements, vegetation, { name: `${variant.preset} living branches` });
      const canopy = instanced(leaves, foliage, placements, vegetation, { name: `${variant.preset} textured leaves` });
      reflected.push({ mesh: canopy, full: leaves, middle, reflection, current: leaves });
    }
    resources.push(middle);
    resources.push(branches, leaves, reflection, bark, foliage);
    sourceBark.dispose(); sourceLeaf.dispose();
  }

  const bladeGeometry = grassTuft();
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, envMapIntensity: 0.25 });
  addWind(grassMaterial, time, { grass: true, translucency: true });
  for (const placements of grassGroups) instanced(bladeGeometry, grassMaterial, placements, lowPlants, { shadows: false, name: 'Seven-blade meadow tufts' });
  const flowerGeo = flowerGeometry(), flowerMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  addWind(flowerMaterial, time, { grass: true });
  instanced(flowerGeo, flowerMaterial, flowers, lowPlants, { shadows: false, name: 'Meadow flowers' });
  resources.push(bladeGeometry, grassMaterial, flowerGeo, flowerMaterial);

  // Texture images are embedded by EZ-Tree. Wait for their decode before the
  // first frame so the user never sees opaque leaf-card rectangles loading in.
  await Promise.all([...textures].map(texture => {
    const image = texture.image;
    return image && typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
  }));

  return {
    update(elapsedTime, camera) {
      time.value = elapsedTime;
      for (const item of reflected) {
        const distance=camera.position.distanceTo(item.mesh.boundingSphere.center);
        item.current=distance<55 ? item.full : distance<100 ? item.middle : item.reflection;
        item.mesh.geometry=item.current;
      }
    },
    reflectionBegin() {
      lowPlants.visible = false;
      for (const item of reflected) item.mesh.geometry = item.reflection;
    },
    reflectionEnd() {
      lowPlants.visible = true;
      for (const item of reflected) item.mesh.geometry = item.current;
    },
    stats: {
      trees: placementGroups.slice(0, 5).reduce((count, placements) => count + placements.length, 0),
      shrubs: placementGroups[5].length,
      grassTufts: grassGroups.reduce((count, placements) => count + placements.length, 0),
      treeVariants: variants.length,
    },
    dispose() {
      scene.remove(vegetation);
      for (const resource of resources) resource.dispose();
    },
  };
}
