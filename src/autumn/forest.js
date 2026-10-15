import * as THREE from 'three';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { keepLeafGaps, shapeCrown, thinned, limbs } from '../vegetation.js';
import { waitFor, yieldToBrowser } from '../startup.js';
import { terrainHeight, riverX, riverWidth, rng, TAU } from './layout.js';
import { forestPlacements } from './planting.js';

const pose = new THREE.Object3D();

export async function createForest(scene, renderer, signal, branchMap) {
  const root = new THREE.Group(); root.name = 'The copper forest'; scene.add(root);
  const time = { value: 0 }, textures = new Set(), foliageTextures = new Set(), batches = [];
  const placements = forestPlacements();
  for (let variant = 0; variant < 7; variant++) {
    const kind = variant === 6 ? 3 : variant % 3;
    await yieldToBrowser(signal);
    const tree = new Tree(); tree.options.copy(structuredClone(TreePreset[kind === 1 ? 'Ash Medium' : kind === 2 ? 'Aspen Medium' : kind === 3 ? 'Oak Large' : 'Oak Medium']));
    tree.options.seed = 7193 + variant * 817;
    tree.options.leaves.count = kind === 3 ? 48 : 10;
    if (kind === 3) tree.options.leaves.size = 3.6;
    else tree.options.leaves.size *= 1.3;
    tree.options.leaves.tint = 0xffffff; tree.options.bark.tint = 0xffffff;
    Object.assign(tree.options.branch.sections, { 0: 8, 1: 5, 2: 3, 3: 2 });
    Object.assign(tree.options.branch.segments, { 0: 7, 1: 4, 2: 3, 3: 3 });
    const starts = [], generateBranch = tree.generateBranch;
    tree.generateBranch = function(branch) { if (starts[branch.level] === undefined) starts[branch.level] = this.branches.indices.length; return generateBranch.call(this, branch); };
    tree.generate();
    const height = new THREE.Box3().setFromObject(tree).max.y;
    const leaves = tree.leavesMesh.geometry, branches = tree.branchesMesh.geometry;
    leaves.scale(1 / height, 1 / height, 1 / height); branches.scale(1 / height, 1 / height, 1 / height);
    let horizontal = 0;
    for (let i = 0; i < leaves.attributes.position.count; i++) horizontal = Math.max(horizontal, Math.hypot(leaves.attributes.position.getX(i), leaves.attributes.position.getZ(i)));
    if(horizontal>.42){leaves.scale(.42/horizontal,1,.42/horizontal);branches.scale(.42/horizontal,1,.42/horizontal);}
    shapeCrown(leaves, rng(1330 + kind));
    // The scan already contains shading between leaves. Avoid multiplying
    // that by the original summer crown's very deep baked occlusion.
    const shades = leaves.attributes.color;
    for (let i = 0; i < shades.array.length; i++) shades.array[i] = .24 + .76 * shades.array[i];
    const leafMap = branchMap, barkMap = tree.branchesMesh.material.map, barkNormal=tree.branchesMesh.material.normalMap;
    for (const texture of [leafMap, barkMap, barkNormal].filter(Boolean)) { texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.add(texture); }
    foliageTextures.add(leafMap);
    const foliage = new THREE.MeshStandardMaterial({ map: leafMap, vertexColors: true, alphaTest: .42, roughness: .82, envMapIntensity: .8, side: THREE.DoubleSide });
    foliage.onBeforeCompile = shader => {
      shader.uniforms.autumnTime = time;
      shader.vertexShader = `uniform float autumnTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 root = instanceMatrix[3].xyz;
        float wind=sin(autumnTime*.7+root.x*.12+root.z*.09);
        transformed.x += (wind*.014+sin(autumnTime*2.+position.z*25.)*.003)*pow(max(position.y,0.),2.);`);
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
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*mix(vec3(.26,.24,.16),vec3(.46,.54,.63),skyward)*.85;
        #if NUM_DIR_LIGHTS > 0
        float through=pow(saturate(dot(geometryViewDir,-directionalLights[0].direction)),3.);
        reflectedLight.directDiffuse+=diffuseColor.rgb*directionalLights[0].color*through*.12;
        #endif`);
    };
    foliage.customProgramCacheKey = () => 'october-foliage';
    const bark = new THREE.MeshStandardMaterial({ map: barkMap, normalMap:barkNormal, normalScale:new THREE.Vector2(.8,.8), roughness:.92, color: '#c4c1b5', envMapIntensity:.6 });
    const selected = placements.filter(p => p.species === kind && (kind === 3 || p.variant === Math.floor(variant / 3)));
    // The full geometry remains unchanged through the flight. Compact only
    // instances outside the camera; there is no visible distance-based swap.
    const crown = new THREE.InstancedMesh(leaves, foliage, selected.length);
    const stem = new THREE.InstancedMesh(branches, bark, selected.length);
    const entries = selected.map(p => {
      pose.position.set(p.x, p.y, p.z); pose.rotation.set(0, p.turn, 0); pose.scale.setScalar(p.height); pose.updateMatrix();
      return { matrix: pose.matrix.clone(), color: new THREE.Color(p.color), bounds: new THREE.Sphere(new THREE.Vector3(p.x, p.y + p.height * .55, p.z), p.height * .7) };
    });
    entries.forEach((p, i) => { crown.setMatrixAt(i, p.matrix); stem.setMatrixAt(i, p.matrix); crown.setColorAt(i, p.color); });
    for (const mesh of [crown, stem]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; root.add(mesh); }
    const reflectedLeaves = thinned(leaves, kind === 3 ? 12 : 14, 2.8, 1.1);
    const reflectedBranches = limbs(branches, starts[1]);
    signal.addEventListener('abort', () => { reflectedLeaves.dispose(); reflectedBranches.dispose(); }, { once: true });
    batches.push({ crown, stem, entries, leaves, branches, reflectedLeaves, reflectedBranches });
    tree.leavesMesh.material.dispose(); tree.branchesMesh.material.dispose();
  }
  await waitFor(Promise.all([...textures].map(t => t.image?.decode?.())), { signal, timeoutMs: 15000, label: 'Unfolding autumn leaves' });
  for (const texture of foliageTextures) keepLeafGaps(texture);
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
  const carpet = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, 1700);
  let used = 0;
  for (let i = 0; i < 1700; i++) {
    const z = -260 + random() * 490, side = random() > .5 ? 1 : -1, x = riverX(z) + side * (riverWidth(z) + 7 + random() * 28), y = terrainHeight(x, z);
    if (y < 0) continue;
    pose.position.set(x, y + .05, z); pose.rotation.set(-Math.PI / 2, 0, random() * TAU); pose.scale.setScalar(.22 + random() * .4); pose.updateMatrix(); carpet.setMatrixAt(used++, pose.matrix);
  }
  carpet.count = used; carpet.layers.set(1); carpet.computeBoundingSphere(); scene.add(carpet);
  return { update(time) { seeds.forEach((p, i) => {
    pose.position.set(p.x + Math.sin(time * .24 + p.phase) * 3, p.y - (time * .45 + p.phase) % 20 + 12, p.z + Math.cos(time * .15 + p.phase) * 3);
    pose.rotation.set(time * .5 + p.phase, p.phase, Math.sin(time + p.phase)); pose.scale.setScalar(p.size); pose.updateMatrix(); leaves.setMatrixAt(i, pose.matrix);
  }); leaves.instanceMatrix.needsUpdate = true; } };
}
