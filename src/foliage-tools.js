import * as THREE from 'three';

// Shared geometry and texture helpers. Keep tree generators and their embedded
// textures out of this module so independent worlds do not download them.

// Ordinary mipmaps average a spray of leaves into a solid blob. These are built
// so every level keeps the same share of open gaps as the original photograph,
// which is what keeps a crown reading as leaves rather than as green putty.
export function keepLeafGaps(texture, cutoff = .42) {
  const image = texture.image;
  if (!image?.width || texture.mipmaps.length) return;
  const chain = document.createElement('canvas'), half = document.createElement('canvas'), levels = [];
  let open = 0;
  for (let size = image.width, source = image; size >= 1; size >>= 1) {
    half.width = half.height = size;
    const ctx = half.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size), alpha = data.data, count = size * size;
    const covered = scale => { let n = 0; for (let i = 3; i < alpha.length; i += 4) if (alpha[i] * scale > cutoff * 255) n++; return n / count; };
    chain.width = chain.height = size; chain.getContext('2d').drawImage(half, 0, 0); source = chain;
    if (!levels.length) open = covered(1);
    else {
      let low = .25, high = 8;
      for (let step = 0; step < 14; step++) { const middle = (low + high) / 2; if (covered(middle) < open) low = middle; else high = middle; }
      for (let i = 3; i < alpha.length; i += 4) alpha[i] = Math.min(255, alpha[i] * high);
    }
    levels.push(data);
  }
  texture.mipmaps = levels; texture.generateMipmaps = false; texture.needsUpdate = true;
}

// A lighter crown for the water reflection and background-only vegetation.
// The camera's autumn crowns always retain their full geometry.
export function thinned(source, keep, enlargement, lift = 1) {
  const result = new THREE.BufferGeometry(), arrays = { position: [], normal: [], uv: [], color: [] }, indices = [], attributes = source.attributes;
  const vertices = source.userData.leafVertexCount || 4;
  result.userData.leafVertexCount = vertices;
  const center = new THREE.Vector3(), p = new THREE.Vector3(), sprays = attributes.position.count / vertices;
  const outer = Array.from({ length: sprays }, (_, i) => i).sort((a, b) => attributes.color.getY(b * vertices) - attributes.color.getY(a * vertices)).slice(0, Math.ceil(sprays * 2 / keep));
  let offset = 0;
  for (let n = 0; n < outer.length; n += 2) {
    const start = outer[n] * vertices;
    center.set(0, 0, 0);
    for (let v = 0; v < vertices; v++) center.add(p.fromBufferAttribute(attributes.position, start + v));
    center.multiplyScalar(1 / vertices);
    for (let v = 0; v < vertices; v++) {
      p.fromBufferAttribute(attributes.position, start + v).sub(center).multiplyScalar(enlargement).add(center);
      arrays.position.push(p.x, p.y, p.z);
      for (const name of ['normal', 'uv', 'color']) { const a = attributes[name]; for (let k = 0; k < a.itemSize; k++) arrays[name].push(a.array[(start + v) * a.itemSize + k] * (name === 'color' ? lift : 1)); }
    }
    if (vertices === 6) indices.push(offset,offset+1,offset+4,offset,offset+4,offset+3,offset+1,offset+2,offset+5,offset+1,offset+5,offset+4);
    else indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    offset += vertices;
  }
  for (const [name, data] of Object.entries(arrays)) result.setAttribute(name, new THREE.Float32BufferAttribute(data, name === 'uv' ? 2 : 3));
  result.setIndex(indices); result.computeBoundingSphere();
  return result;
}

export function limbs(source, indexCount) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(new THREE.BufferAttribute(source.index.array.subarray(0, Math.min(indexCount ?? Infinity, source.index.count)), 1));
  geometry.boundingSphere = source.boundingSphere; geometry.boundingBox = source.boundingBox;
  return geometry;
}

