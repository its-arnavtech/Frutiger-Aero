import * as THREE from 'three';
import { createDeciduousGeometry } from './tree-geometry.js';
import { keepLeafGaps, shapeCrown, thinned, limbs } from '../vegetation.js';
import { waitFor, yieldToBrowser } from '../startup.js';
import { terrainHeight, riverX, riverWidth, rng, TAU, island } from './layout.js';
import { forestPlacements } from './planting.js';

const pose = new THREE.Object3D();

export async function createForest(scene, renderer, signal, branchMap, maps) {
  const root = new THREE.Group(); root.name = 'The copper forest'; scene.add(root);
  const time = { value: 0 }, textures = new Set(), foliageTextures = new Set(), batches = [];
  const placements = forestPlacements();
  for (let variant = 0; variant < 7; variant++) {
    const kind = variant === 6 ? 3 : variant % 3;
    await yieldToBrowser(signal);
    const { leaves, branches, reflectionIndexCount } = createDeciduousGeometry(7193 + variant * 817, { hero: kind === 3, kind });
    shapeCrown(leaves, rng(1330 + kind));
    // The scan already contains shading between leaves. Avoid multiplying
    // that by the original summer crown's very deep baked occlusion.
    const shades = leaves.attributes.color;
    for (let i = 0; i < shades.array.length; i++) shades.array[i] = .60 + .40 * shades.array[i];
    const leafMap = branchMap, barkMap = maps.bark, barkNormal = maps.barkNormal;
    for (const texture of [leafMap, barkMap, barkNormal].filter(Boolean)) { texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.add(texture); }
    foliageTextures.add(leafMap);
    const foliage = new THREE.MeshStandardMaterial({ map: leafMap, vertexColors: true, alphaTest: .38, roughness: .68, envMapIntensity: .65, side: THREE.DoubleSide });
    foliage.onBeforeCompile = shader => {
      shader.uniforms.autumnTime = time;
      shader.vertexShader = `uniform float autumnTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 root = instanceMatrix[3].xyz;
        float wind=sin(autumnTime*.7+root.x*.12+root.z*.09);
        transformed.x += (wind*.005+sin(autumnTime*2.+position.z*25.)*.002)*pow(max(position.y,0.),2.);`);
      // Preserve the photographed leaf colour, spots and veins. Per-tree tint
      // supplies small natural variations instead of painting the whole leaf orange.
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float relief = dot(sampledDiffuseColor.rgb, vec3(.25,.6,.15));
        vec2 rise=vec2(dFdx(relief),dFdy(relief))*.025;
        vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition), r1=cross(sy,normal), r2=cross(normal,sx);
        float det=dot(sx,r1);
        normal=normalize(abs(det)*normal-sign(det)*(rise.x*r1+rise.y*r2));`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        float skyward=inverseTransformDirection(normal,viewMatrix).y*.5+.5;
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*mix(vec3(.22,.19,.08),vec3(.38,.45,.48),skyward)*.55;
        #if NUM_DIR_LIGHTS > 0
        float through=pow(saturate(dot(geometryViewDir,-directionalLights[0].direction)),4.);
        float thinLeaf=.65+.35*dot(sampledDiffuseColor.rgb,vec3(.2,.7,.1));
        reflectedLight.directDiffuse+=diffuseColor.rgb*directionalLights[0].color*through*thinLeaf*.28;
        #endif`);
    };
    foliage.customProgramCacheKey = () => 'golden-maple-translucency';
    const bark = new THREE.MeshStandardMaterial({ map: barkMap, normalMap:barkNormal, normalScale:new THREE.Vector2(.8,.8), roughness:.91, color: '#f4eee2', envMapIntensity:1.1 });
    const selected = placements.filter(p => p.species === kind && (kind === 3 || p.variant === Math.floor(variant / 3)));
    // The full geometry remains unchanged through the flight. Compact only
    // instances outside the camera; there is no visible distance-based swap.
    const crown = new THREE.InstancedMesh(leaves, foliage, selected.length);
    const stem = new THREE.InstancedMesh(branches, bark, selected.length);
    const entries = selected.map(p => {
      pose.position.set(p.x, p.y, p.z); pose.rotation.set(0, p.turn, 0); pose.scale.setScalar(p.height); pose.updateMatrix();
      return { matrix: pose.matrix.clone(), color: new THREE.Color(p.color), bounds: new THREE.Sphere(new THREE.Vector3(p.x, p.y + p.height * .5, p.z), Math.hypot(p.radius ?? p.height * .42, p.height * .5) + 2) };
    });
    entries.forEach((p, i) => { crown.setMatrixAt(i, p.matrix); stem.setMatrixAt(i, p.matrix); crown.setColorAt(i, p.color); });
    for (const mesh of [crown, stem]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; root.add(mesh); }
    const reflectedLeaves = thinned(leaves, kind === 3 ? 12 : 14, 2.8, 1.1);
    const reflectedBranches = limbs(branches, reflectionIndexCount);
    signal.addEventListener('abort', () => { reflectedLeaves.dispose(); reflectedBranches.dispose(); }, { once: true });
    batches.push({ crown, stem, entries, leaves, branches, reflectedLeaves, reflectedBranches });
  }
  await waitFor(Promise.all([...textures].map(t => t.image?.decode?.())), { signal, timeoutMs: 15000, label: 'Unfolding autumn leaves' });
  for (const texture of foliageTextures) keepLeafGaps(texture, .38);
  const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), mirrored = new THREE.Sphere();
  return {
    count: placements.length,
    update(clock, camera) {
      time.value = clock; camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const { crown, stem, entries } of batches) {
        let count = 0;
        for (const entry of entries) {
          const sphere = entry.bounds;
          mirrored.copy(sphere); mirrored.center.y *= -1;
          if (!frustum.intersectsSphere(sphere) && !frustum.intersectsSphere(mirrored)) continue;
          crown.setMatrixAt(count, entry.matrix); stem.setMatrixAt(count, entry.matrix); crown.setColorAt(count, entry.color); count++;
        }
        crown.count = stem.count = count; crown.instanceMatrix.needsUpdate = stem.instanceMatrix.needsUpdate = crown.instanceColor.needsUpdate = true;
      }
    },
    // Only the small rippled mirror uses these meshes. The camera always gets
    // complete crowns and branches, with no change of detail as it approaches.
    reflectionBegin() { for (const b of batches) { b.crown.geometry = b.reflectedLeaves; b.stem.geometry = b.reflectedBranches; } },
    reflectionEnd() { for (const b of batches) { b.crown.geometry = b.leaves; b.stem.geometry = b.branches; } },
  };
}

export function createLeaves(scene, leafMap) {
  const material = new THREE.MeshLambertMaterial({ map: leafMap, transparent: false, alphaTest: .35, side: THREE.DoubleSide, color: '#ffce8c' });
  const random = rng(6815), count = 230;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, count);
  leaves.frustumCulled = false; leaves.layers.set(1); leaves.name = 'Leaves in the breeze'; scene.add(leaves);
  const seeds = Array.from({ length: count }, () => ({ x: (random() - .5) * 120, z: -210 + random() * 420, y: 3 + random() * 22, phase: random() * TAU, size: .13 + random() * .25 }));
  // A permanent leaf carpet, independently placed on both banks.
  const carpet = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, 5200);
  let used = 0;
  for (let i = 0; i < 3500; i++) {
    const z = -260 + random() * 490, side = random() > .5 ? 1 : -1, x = riverX(z) + side * (riverWidth(z) + 7 + random() * 28), y = terrainHeight(x, z);
    if (y < 0) continue;
    pose.position.set(x, y + .05, z); pose.rotation.set(-Math.PI / 2, 0, random() * TAU); pose.scale.setScalar(.22 + random() * .4); pose.updateMatrix(); carpet.setMatrixAt(used++, pose.matrix);
  }
  const groundNormal = new THREE.Vector3(), leafUp = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 1700; i++) {
    const angle = random() * TAU, radius = Math.sqrt(random()) * 16, x = island.x + Math.cos(angle) * radius, z = island.z + Math.sin(angle) * radius, y = terrainHeight(x, z);
    if (y < .35) continue;
    groundNormal.set(-(terrainHeight(x + .2, z) - terrainHeight(x - .2, z)) / .4, 1, -(terrainHeight(x, z + .2) - terrainHeight(x, z - .2)) / .4).normalize();
    pose.position.set(x, y + .04, z); pose.quaternion.setFromUnitVectors(leafUp, groundNormal); pose.rotateZ(random() * TAU); pose.scale.setScalar(.18 + random() * .3); pose.updateMatrix(); carpet.setMatrixAt(used++, pose.matrix);
  }
  carpet.count = used; carpet.layers.set(1); carpet.computeBoundingSphere(); scene.add(carpet);
  return { update(time) { seeds.forEach((p, i) => {
    pose.position.set(p.x + Math.sin(time * .24 + p.phase) * 3, p.y - (time * .45 + p.phase) % 20 + 12, p.z + Math.cos(time * .15 + p.phase) * 3);
    pose.rotation.set(time * .5 + p.phase, p.phase, Math.sin(time + p.phase)); pose.scale.setScalar(p.size); pose.updateMatrix(); leaves.setMatrixAt(i, pose.matrix);
  }); leaves.instanceMatrix.needsUpdate = true; } };
}
