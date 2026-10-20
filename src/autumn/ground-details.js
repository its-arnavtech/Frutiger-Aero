import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, TAU } from './layout.js';
import { groundNoise } from './geology.js';

// Fracture planes and several scales of erosion give each boulder a different
// silhouette. Welding the shared vertices prevents a low-poly lighting seam.
export function createRiverStone(seed, detail = 4) {
  const random = rng(seed), raw = new THREE.IcosahedronGeometry(1, detail), p = raw.attributes.position;
  const planes = Array.from({ length: 5 }, () => ({
    normal: new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize(),
    distance: .68 + random() * .25,
  }));
  const q = new THREE.Vector3(), offset = random() * 90;
  for (let i = 0; i < p.count; i++) {
    q.fromBufferAttribute(p, i);
    for (const plane of planes) q.addScaledVector(plane.normal, -Math.max(0, q.dot(plane.normal) - plane.distance));
    const erosion = .84 + groundNoise(q.x * 3 + offset, q.z * 3 + q.y * 1.8) * .22
      + groundNoise(q.x * 11 - q.y * 7, q.z * 12 + offset) * .055;
    q.multiplyScalar(erosion);
    q.x += .065 * Math.sin(q.y * 14 + seed);
    q.y *= .66 + .12 * Math.sin(seed);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  raw.deleteAttribute('normal'); raw.deleteAttribute('uv');
  const geometry = mergeVertices(raw, .0001); raw.dispose();
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function createMeadowTuft(seed) {
  const random = rng(seed), vertices = [], colors = [], indices = [];
  const dark = new THREE.Color('#43512b'), straw = new THREE.Color('#92915b'), green = new THREE.Color('#6b7c3b');
  for (let blade = 0; blade < 22; blade++) {
    const a = random() * TAU, spread = Math.sqrt(random()) * .34;
    const x = Math.cos(a) * spread, z = Math.sin(a) * spread;
    const h = .12 + random() * .38, bend = .08 + random() * .31, turn = random() * TAU;
    const dx = Math.cos(turn), dz = Math.sin(turn), width = .008 + random() * .012;
    const tone = green.clone().lerp(straw, random() ** 2), offset = vertices.length / 3;
    for (let j = 0; j <= 3; j++) {
      const t = j / 3, reach = bend * t * t;
      const color = dark.clone().lerp(tone, Math.sqrt(t));
      for (const side of [-1, 1]) {
        vertices.push(x + dx * reach - dz * width * (1 - t) * side,
          h * Math.sin(t * 1.7), z + dz * reach + dx * width * (1 - t) * side);
        colors.push(color.r, color.g, color.b);
      }
      if (j < 3) { const n = offset + j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function riverStoneMaterial(maps) {
  const material = new THREE.MeshStandardMaterial({ color: '#deded4', map: maps.rock, roughness: .86, envMapIntensity: .85 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 stonePoint, stoneNormal, stoneWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nstonePoint=position;stoneNormal=normal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        stoneWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;`);
    shader.fragmentShader = `varying vec3 stonePoint,stoneNormal,stoneWorld;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 w=pow(abs(normalize(stoneNormal)),vec3(6.));w/=dot(w,vec3(1.));
        vec3 p=stonePoint*1.4;
        vec4 sampledDiffuseColor=texture2D(map,p.yz)*w.x+texture2D(map,p.xz)*w.y+texture2D(map,p.xy)*w.z;
        vec3 grain=texture2D(map,p.yz*3.7).rgb*w.x+texture2D(map,p.xz*3.7).rgb*w.y+texture2D(map,p.xy*3.7).rgb*w.z;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,grain,.18);
        float luminance=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb*=mix(sampledDiffuseColor.rgb,vec3(luminance)*vec3(.91,.98,1.04),.58);
        float damp=1.-smoothstep(-.1,.65,stoneWorld.y);
        float moss=smoothstep(.2,.75,stoneNormal.y)*smoothstep(.12,.3,luminance)*.35*(1.-damp);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.61,.77,.35),moss);
        diffuseColor.rgb*=1.-damp*.3;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.34,damp);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);
        float det=dot(dx,r1);
        normal=normalize(abs(det)*normal-sign(det)*.015*(dFdx(luminance)*r1+dFdy(luminance)*r2));`);
  };
  material.customProgramCacheKey = () => 'river-stone-fractures-wet-moss';
  return material;
}
