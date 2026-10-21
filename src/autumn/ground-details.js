import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, TAU } from './layout.js';
import { groundNoise } from './geology.js';
import { surfaceDetail } from './surface-detail.js';

// Fracture planes and several scales of erosion give each boulder a different
// silhouette. Welding the shared vertices prevents a low-poly lighting seam.
export function createRiverStone(seed, detail = 7) {
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
    // Uneven bedding planes break away in shallow shelves. Keep large fracture
    // planes intact rather than making the entire stone a rounded noisy blob.
    const bedding = q.y * 8 + q.x * 1.8 + groundNoise(q.x * 4 + offset, q.z * 5) * .7;
    const seam = Math.exp(-Math.pow((bedding - Math.floor(bedding)) / .12, 2));
    q.multiplyScalar(1 - seam * .045);
    q.x += .028 * Math.sin(q.y * 14 + seed);
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
  const material = new THREE.MeshStandardMaterial({ color: '#eeeeea', map: maps.rock, roughness: .94, envMapIntensity: .65 });
  material.onBeforeCompile = shader => {
    shader.uniforms.stoneNormalMap = { value: maps.rockNormal };
    shader.uniforms.stoneRoughMap = { value: maps.rockRough };
    shader.vertexShader = `varying vec3 stonePoint, stoneNormal, stoneWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nstonePoint=position;stoneNormal=normal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        stoneWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;`);
    shader.fragmentShader = `varying vec3 stonePoint,stoneNormal,stoneWorld;
      uniform sampler2D stoneNormalMap,stoneRoughMap;
      ${surfaceDetail}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 w=projectionWeights(stoneNormal);
        vec3 p=stonePoint*.82;
        vec4 sampledDiffuseColor=projectSurface(map,p,w);
        vec3 grain=projectSurface(map,p*4.1+vec3(.37,.63,.19),w).rgb;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,grain,.12);
        float luminance=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb*=mix(sampledDiffuseColor.rgb,vec3(luminance)*vec3(.91,.98,1.04),.38);
        float damp=1.-smoothstep(-.08,.5+detailNoise(stoneWorld*3.)*.2,stoneWorld.y);
        float colony=detailNoise(stonePoint*7.+vec3(2.));
        float moss=smoothstep(.28,.8,stoneNormal.y)*smoothstep(.48,.7,colony)*(1.-damp);
        float lichen=smoothstep(.62,.73,detailNoise(stonePoint*22.))*smoothstep(.4,.7,colony)*(1.-damp);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.145,.045),moss*.45);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.37,.25),lichen*.42);
        diffuseColor.rgb*=1.-damp*.38;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(projectSurface(stoneRoughMap,p,w).g*.86+.1,.55,1.);
        roughnessFactor=mix(roughnessFactor,.27,damp);`)
      .replace('#include <normal_fragment_maps>', `
        normal=projectedNormal(stoneNormalMap,p,w,normal,-vViewPosition,.85);
        normal=reliefNormal(normal,-vViewPosition,dot(grain,vec3(.333))*.009);`);
  };
  material.customProgramCacheKey = () => 'river-stone-scanned-normal-lichen-v2';
  return material;
}
