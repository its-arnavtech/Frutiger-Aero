import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Vector3(), mean = new THREE.Vector3();

// Make every triangle face the way its vertex normals point, so builders never
// depend on the travel direction of a path or the handedness of a profile.
function orient(geometry) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal, index = geometry.index.array;
  for (let i = 0; i < index.length; i += 3) {
    a.fromBufferAttribute(position, index[i]); b.fromBufferAttribute(position, index[i + 1]); c.fromBufferAttribute(position, index[i + 2]);
    face.crossVectors(b.sub(a), c.sub(a));
    mean.fromBufferAttribute(normal, index[i]).add(a.fromBufferAttribute(normal, index[i + 1])).add(a.fromBufferAttribute(normal, index[i + 2]));
    if (face.dot(mean) < 0) { const swap = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = swap; }
  }
  return geometry;
}

function assemble(positions, normals, uvs, indices, extra = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  for (const [name, [data, size]] of Object.entries(extra)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
  geometry.setIndex(indices);
  if (normals) { geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); orient(geometry); } else geometry.computeVertexNormals();
  return geometry;
}

// Surface of revolution about +Y. profile is [[radius, y], ...] from bottom to
// top. A facade option lays out window bays for the glass shader.
export function lathe(profile, { segments = 32, facade, squash = 1 } = {}) {
  const rows = profile.length, positions = [], normals = [], uvs = [], indices = [], bays = [];
  const lengths = [0];
  for (let j = 1; j < rows; j++) lengths.push(lengths[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  for (let j = 0; j < rows; j++) {
    const before = profile[Math.max(0, j - 1)], after = profile[Math.min(rows - 1, j + 1)];
    let nr = after[1] - before[1], ny = before[0] - after[0];
    const length = Math.hypot(nr, ny) || 1; nr /= length; ny /= length;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * TAU, cos = Math.cos(angle), sin = Math.sin(angle);
      positions.push(profile[j][0] * cos, profile[j][1], profile[j][0] * sin * squash);
      normals.push(nr * cos, ny, nr * sin);
      if (facade) {
        const u = i / segments * facade.bays, v = (lengths[j] + (facade.lift || 0)) / facade.floor;
        uvs.push((u + facade.shift[0]) / 12, (v + facade.shift[1]) / 11); bays.push(u, v, TAU / facade.bays, facade.seed);
      } else uvs.push(i / segments, lengths[j]);
    }
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < segments; i++) {
    const k = j * (segments + 1) + i, l = k + segments + 1;
    indices.push(k, l, k + 1, k + 1, l, l + 1);
  }
  return assemble(positions, normals, uvs, indices, facade ? { facade: [bays, 4] } : {});
}

// Half an ellipse, for domes and rounded shoulders. Returns profile points.
export function arc(radius, y, rise, steps = 8, from = 0, to = Math.PI / 2) {
  return Array.from({ length: steps + 1 }, (_, i) => { const t = from + (to - from) * i / steps; return [Math.max(radius * Math.cos(t), .001), y + rise * Math.sin(t)]; });
}

// Extrude a wall section along a ground line. points carry x,z (and optionally
// their own outward normal nx,nz); section is [[outward, y], ...] bottom to top.
export function sweep(points, section, { closed = false, outward = 1, uvScale = 1 } = {}) {
  const count = points.length, rows = section.length, positions = [], normals = [], uvs = [], indices = [];
  const sectionNormals = section.map((_, j) => {
    const before = section[Math.max(0, j - 1)], after = section[Math.min(rows - 1, j + 1)];
    const no = after[1] - before[1], ny = before[0] - after[0], length = Math.hypot(no, ny) || 1;
    return [no / length, ny / length];
  });
  const heights = [0];
  for (let j = 1; j < rows; j++) heights.push(heights[j - 1] + Math.hypot(section[j][0] - section[j - 1][0], section[j][1] - section[j - 1][1]));
  let travelled = 0;
  for (let i = 0; i < count; i++) {
    const p = points[i], previous = points[closed ? (i - 1 + count) % count : Math.max(0, i - 1)], next = points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)];
    let nx = p.nx, nz = p.nz;
    if (nx === undefined) { const tx = next.x - previous.x, tz = next.z - previous.z, length = Math.hypot(tx, tz) || 1; nx = tz / length * outward; nz = -tx / length * outward; }
    if (i > 0) travelled += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    for (let j = 0; j < rows; j++) {
      positions.push(p.x + nx * section[j][0], section[j][1] + (p.y || 0), p.z + nz * section[j][0]);
      normals.push(nx * sectionNormals[j][0], sectionNormals[j][1], nz * sectionNormals[j][0]);
      uvs.push(travelled * uvScale, heights[j] * uvScale);
    }
  }
  const spans = closed ? count : count - 1;
  for (let i = 0; i < spans; i++) for (let j = 0; j < rows - 1; j++) {
    const k = i * rows + j, l = ((i + 1) % count) * rows + j;
    indices.push(k, l, k + 1, k + 1, l, l + 1);
  }
  return assemble(positions, normals, uvs, indices);
}

// A surface through rows of points, such as a lawn or a paved deck. UVs are
// world metres so ground materials tile evenly everywhere.
export function surface(rows, { uv = p => [p.x, p.z], up = true, away } = {}) {
  const width = rows[0].length, positions = [], uvs = [], indices = [];
  for (const row of rows) for (const p of row) { positions.push(p.x, p.y, p.z); uvs.push(...uv(p)); }
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < width - 1; i++) {
    const k = j * width + i, l = k + width;
    indices.push(k, l, k + 1, k + 1, l, l + 1);
  }
  const geometry = assemble(positions, null, uvs, indices);
  // Ground faces the sky by default; walls face away from a given point.
  const normal = geometry.attributes.normal, probe = Math.floor(normal.count / 2), p = rows[Math.floor(rows.length / 2)][Math.floor(width / 2)];
  const facing = away ? normal.getX(probe) * (p.x - away.x) + normal.getY(probe) * (p.y - away.y) + normal.getZ(probe) * (p.z - away.z) : normal.getY(probe) * (up ? 1 : -1);
  if (facing < 0) { const index = geometry.index.array; for (let i = 0; i < index.length; i += 3) { const swap = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = swap; } geometry.computeVertexNormals(); }
  return geometry;
}

export function tube(points, radius, { segments = points.length * 2, sides = 6, closed = false } = {}) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed), segments, radius, sides, closed);
}

export function rod(from, to, radius, { top = radius, sides = 6, caps = false } = {}) {
  a.set(...from); b.set(...to); const direction = b.clone().sub(a), length = direction.length();
  const geometry = new THREE.CylinderGeometry(top, radius, length, sides, 1, !caps);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()));
  return geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

// Collects geometry by finish and merges each finish into a single mesh, so a
// whole district costs a handful of draw calls.
export function createBatcher(finishes) {
  const lists = new Map(Object.keys(finishes).map(key => [key, []])), pose = new THREE.Object3D(), colour = new THREE.Color();
  // Fine detail goes on layer 1, which the water's mirror camera never draws.
  function add(key, geometry, { at, turn, scale, tint = 0xffffff, bays = [0, 0, 0, 0], detail = false } = {}) {
    if (!finishes[key]) throw new Error(`Unknown finish "${key}"`);
    const name = detail ? `${key}~` : key;
    if (!lists.has(name)) lists.set(name, []);
    const list = lists.get(name);
    if (at || turn || scale) {
      pose.position.set(...(at || [0, 0, 0])); pose.rotation.set(...(turn || [0, 0, 0])); pose.scale.set(...(scale || [1, 1, 1]));
      pose.updateMatrix(); geometry.applyMatrix4(pose.matrix);
    }
    const count = geometry.attributes.position.count, wanted = new Set(['position', 'normal', 'uv', ...(finishes[key].attributes || [])]);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    for (const name of Object.keys(geometry.attributes)) if (!wanted.has(name)) geometry.deleteAttribute(name);
    if (wanted.has('color') && !geometry.attributes.color) {
      colour.set(tint); const data = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) data.set([colour.r, colour.g, colour.b], i * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
    }
    if (wanted.has('facade') && !geometry.attributes.facade) {
      const data = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) data.set(bays, i * 4);
      geometry.setAttribute('facade', new THREE.BufferAttribute(data, 4));
    }
    if (!geometry.index) geometry.setIndex(Array.from({ length: count }, (_, i) => i));
    geometry.morphAttributes = {}; list.push(geometry);
    return geometry;
  }
  function build(parent, name) {
    const meshes = {};
    for (const [key, geometries] of lists) {
      if (!geometries.length) continue;
      const finish = finishes[key.replace('~', '')], geometry = mergeGeometries(geometries, false);
      if (!geometry) throw new Error(`Could not merge "${key}"`);
      for (const part of geometries) part.dispose();
      geometries.length = 0;
      const mesh = new THREE.Mesh(geometry, finish.material);
      mesh.name = `${name}: ${key}`; mesh.castShadow = finish.shadow !== false; mesh.receiveShadow = finish.receive !== false;
      if (key.endsWith('~')) mesh.layers.set(1);
      if (finish.order) mesh.renderOrder = finish.order;
      parent.add(mesh); meshes[key] = mesh;
    }
    return meshes;
  }
  return { add, build };
}
