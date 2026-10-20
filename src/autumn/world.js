import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { cameraAt, lookAt, rollAt } from './journey.js';
import { riverX, rng, TAU } from './layout.js';
import { createAutumnSky, buildTerrain } from './landscape.js';
import { AUTUMN_SUN } from './geology.js';
import { createForest, createLeaves } from './forest.js';
import { buildVillage } from './village.js';
import { loadAutumnMaterials } from './materials.js';
import { createRiver } from './water.js';
import { createCinema } from '../cinema.js';
import { renderingProfile } from '../quality.js';
import { compileWorld } from '../gpu.js';
import { waitFor } from '../startup.js';

export async function createWorld(canvas, { signal, onStage }) {
  await onStage('Following the autumn river');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const query = new URLSearchParams(location.search);
  const profile = renderingProfile({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
    coarsePointer: matchMedia('(pointer: coarse)').matches, deviceMemory: navigator.deviceMemory,
    compact: query.get('quality') === 'mobile', low: query.get('quality') === 'low',
    maxTextureSize: renderer.capabilities.maxTextureSize,
    floatTargets: renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'),
  });
  profile.atmosphere = false; // The falling leaves belong to the 3D world.
  canvas.dataset.profile = profile.low ? 'low' : profile.mobile ? 'mobile' : 'desktop';
  canvas.dataset.world = 'amberfall';
  renderer.setPixelRatio(profile.canvasRatio); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#c2ced0', .00024);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .2, 4400); camera.layers.enable(1);
  let cinema, environment;
  const resources = new Set();
  signal.addEventListener('abort', () => {
    scene.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) resources.add(object.geometry);
      for (const material of [].concat(object.material || [])) { resources.add(material); for (const value of Object.values(material)) if (value?.isTexture) resources.add(value); }
    });
    cinema?.dispose(); environment?.dispose(); for (const resource of resources) resource.dispose(); renderer.dispose();
  }, { once: true });
  const loader = new THREE.TextureLoader();
  const load = (url, source=loader) => source.loadAsync(url).then(texture => {
    if (signal.aborted) { texture.dispose(); throw signal.reason; }
    resources.add(texture); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
  });
  await onStage('Gathering the colours of October');
  const [maps, waterNormals, leafMap, photograph, hdr, branchMap] = await waitFor(Promise.all([
    loadAutumnMaterials(load),
    load('/assets/materials/waternormals.jpg'),
    load('/assets/autumn/maple-leaf.png'),
    load('/assets/environment/kloofendal_48d_partly_cloudy_puresky_4k.jpg'),
    profile.floatTargets ? load('/assets/environment/kloofendal_48d_partly_cloudy_puresky_2k.hdr',new HDRLoader()) : null,
    load('/assets/autumn/maple-leaf-atlas.png'),
  ]), { signal, timeoutMs: 30000, label: 'Loading autumn textures' });
  for (const texture of [leafMap, photograph,branchMap]) texture.colorSpace = THREE.SRGBColorSpace;
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const sunDirection = new THREE.Vector3(...AUTUMN_SUN).normalize();
  createAutumnSky(scene, sunDirection, photograph);
  if (hdr) {
    const pmrem = new THREE.PMREMGenerator(renderer); environment = pmrem.fromEquirectangular(hdr);
    scene.environment = environment.texture; scene.environmentIntensity = .65;
    scene.environmentRotation.y = .597-Math.atan2(sunDirection.z,sunDirection.x); pmrem.dispose();hdr.dispose();
  }
  scene.add(new THREE.HemisphereLight('#dce8ee', '#8c9b56', 1.1));
  const bounce = new THREE.DirectionalLight('#ffe8c7', .85);
  bounce.position.set(100, 90, 200); scene.add(bounce);
  const sun = new THREE.DirectionalLight('#fff0cf', 3.4); sun.target.position.set(0, 0, -55); sun.position.copy(sun.target.position).addScaledVector(sunDirection, 350);
  sun.castShadow = true; sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 230, bottom: -210, near: 20, far: 850 });
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .15; sun.shadow.bias = -.0002; scene.add(sun, sun.target);
  signal.addEventListener('abort', () => sun.shadow.dispose(), { once: true });

  await onStage('Carving the river valley');
  const terrain = buildTerrain(scene, maps);
  const village = buildVillage(scene, maps);
  await onStage('Turning the forest to gold');
  const forest = await createForest(scene, renderer, signal, branchMap, maps);
  const leaves = createLeaves(scene, leafMap);
  await onStage('Lighting the lanterns');
  const water = createRiver(scene,{waterNormals,sunDirection,profile,forest,signal});
  // Reflection skips the falling leaf layer; water moves with the same clock.
  const random = rng(4812), pose = new THREE.Object3D();
  const paper = new THREE.MeshStandardMaterial({ color: '#e6cfaa', emissive: '#ffbe70', emissiveIntensity: .4, roughness: .8 });
  const floats = new THREE.InstancedMesh(new THREE.BoxGeometry(.38, .54, .38), paper, 42);
  const floatBases = new THREE.InstancedMesh(new THREE.BoxGeometry(.66, .08, .66), new THREE.MeshStandardMaterial({ color: '#7b462b', roughness: .8 }), 42);
  const floatSeeds = Array.from({ length: 42 }, () => ({ z: 95 - random() * 195, dx: (random() - .5) * 14, phase: random() * TAU }));
  floats.frustumCulled = floatBases.frustumCulled = false; scene.add(floats, floatBases);

  // Small swallows wheel high above the lake, their wings actually moving.
  const birdGeometry = new THREE.BufferGeometry(); birdGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, -1.3,.2,.25, -.5,0,.45, 0,0,0, .5,0,.45, 1.3,.2,.25], 3)); birdGeometry.computeVertexNormals();
  const birds = new THREE.InstancedMesh(birdGeometry, new THREE.MeshBasicMaterial({ color: '#514a40', side: THREE.DoubleSide }), 14); birds.frustumCulled = false; scene.add(birds);
  cinema = createCinema(renderer, scene, camera, { scale: profile.initialRatio / profile.canvasRatio, samples: profile.mobile ? 0 : 2, occlusion: profile.occlusion, bloom: profile.bloom, floatTargets: profile.floatTargets });
  cinema.grade.exposure.value = 1.02; cinema.grade.saturation.value = .97; cinema.grade.contrast.value = .12; cinema.quality.glow = .024;
  cinema.quality.sharpness = .45;
  let pixelRatio = profile.initialRatio;
  const target = new THREE.Vector3();
  function aim(progress, pointer) {
    camera.position.copy(cameraAt(progress)); target.copy(lookAt(progress)); camera.up.set(0, 1, 0); camera.lookAt(target);
    camera.rotateZ(rollAt(progress)); camera.rotateY(-pointer.x * .02); camera.rotateX(pointer.y * .012);
  }
  aim(0, { x: 0, y: 0 });
  await onStage('Letting the last light in');
  await compileWorld(renderer, scene, camera, { signal, timeoutMs: 20000 });
  renderer.shadowMap.needsUpdate = true;
  cinema.render();
  if (renderer.getContext().isContextLost()) throw new Error('The graphics connection was interrupted.');
  await onStage('Welcome to Amberfall');
  let elapsed = 0, frames = 0, sampled = performance.now(), slow = 0;
  function resize() {
    if (signal.aborted) return;
    camera.aspect = innerWidth / Math.max(innerHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    cinema.setScale(pixelRatio / profile.canvasRatio); cinema.resize();
  }
  return {
    profile, renderer, scene, camera, cinema, resize,
    render(progress, pointer, dt, reducedMotion) {
      if (signal.aborted) return;
      if (!reducedMotion) elapsed += dt;
      const time = elapsed * .45 + progress * 75;
      aim(progress, pointer); forest.update(time, camera); terrain.userData.updateDetails(camera); leaves.update(time); village.update(time);
      water.material.uniforms.time.value = time * .2;
      floatSeeds.forEach((p, i) => {
        const z = p.z + Math.sin(time * .04 + p.phase) * 2, x = riverX(z) + p.dx;
        pose.position.set(x, .34 + Math.sin(time + p.phase) * .045, z); pose.rotation.set(0, p.phase + time * .025, Math.sin(time + p.phase) * .04); pose.scale.setScalar(1); pose.updateMatrix(); floats.setMatrixAt(i, pose.matrix);
        pose.position.y -= .27; pose.updateMatrix(); floatBases.setMatrixAt(i, pose.matrix);
      }); floats.instanceMatrix.needsUpdate = floatBases.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 14; i++) { const angle = time * .025 + i * .43; pose.position.set(Math.cos(angle) * (43 + i), 52 + Math.sin(time * .2 + i) * 3 + i * .7, -150 + Math.sin(angle) * 60); pose.rotation.set(Math.sin(time * 3 + i) * .18, -angle, .1); pose.scale.setScalar(.6); pose.updateMatrix(); birds.setMatrixAt(i, pose.matrix); } birds.instanceMatrix.needsUpdate = true;
      renderer.info.reset();cinema.render();
      frames++; const now = performance.now();
      if (now - sampled > 1000) { Object.assign(canvas.dataset, { fps: String(Math.round(frames * 1000 / (now - sampled))), triangles:String(renderer.info.render.triangles),calls:String(renderer.info.render.calls),trees: String(forest.count), camera: camera.position.toArray().map(v => v.toFixed(1)).join(','), pixelRatio: pixelRatio.toFixed(2) }); frames = 0; sampled = now; }
      slow = dt > .04 ? slow + 1 : Math.max(0, slow - 2);
      if (slow > 70 && pixelRatio > .75) { pixelRatio = Math.max(.75, pixelRatio * .9); resize(); slow = 0; }
    },
  };
}
