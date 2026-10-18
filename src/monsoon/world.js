import * as THREE from 'three';
import { cameraAt, lookAt, rollAt } from './journey.js';
import { buildLandscape, createCloudbreakSky } from './landscape.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { loadMaterials } from './materials.js';
import { createLake } from './water.js';
import { createWeather } from './weather.js';
import { renderingProfile } from '../quality.js';
import { createCinema } from '../cinema.js';
import { compileWorld } from '../gpu.js';
import { waitFor } from '../startup.js';

export async function createWorld(canvas, { signal, onStage }) {
  await onStage('Listening to the rain');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const query = new URLSearchParams(location.search);
  const profile = renderingProfile({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
    coarsePointer: matchMedia('(pointer: coarse)').matches, deviceMemory: navigator.deviceMemory,
    compact: query.get('quality') === 'mobile', low: query.get('quality') === 'low', maxTextureSize: renderer.capabilities.maxTextureSize,
    floatTargets: renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'),
  });
  profile.atmosphere = false;
  Object.assign(canvas.dataset, { profile: profile.low ? 'low' : profile.mobile ? 'mobile' : 'desktop', world: 'rainmere' });
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  if (debug) canvas.dataset.gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  renderer.setPixelRatio(profile.canvasRatio); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#b5d2df', .00029);
  const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, .15, 4400); camera.layers.enable(1);
  const resources = new Set(); let cinema, environment;
  signal.addEventListener('abort', () => {
    scene.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) resources.add(object.geometry);
      for (const material of [].concat(object.material || [])) { resources.add(material); for (const value of Object.values(material)) if (value?.isTexture) resources.add(value); }
    });
    cinema?.dispose(); environment?.dispose(); for (const resource of resources) resource.dispose(); renderer.dispose();
  }, { once: true });
  const loader = new THREE.TextureLoader();
  const load = (url, source = loader) => source.loadAsync(url).then(texture => {
    if (signal.aborted) { texture.dispose(); throw signal.reason; }
    resources.add(texture); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
  });
  await onStage('Rain on stone');
  const [maps, hdr] = await waitFor(Promise.all([loadMaterials(load), profile.floatTargets ? load('/assets/environment/kloofendal_48d_partly_cloudy_puresky_2k.hdr', new HDRLoader()) : null]), { signal, timeoutMs: 30000, label: 'Loading mountain materials' });
  const sunDirection = new THREE.Vector3(-.65, .7, .28).normalize();
  const sky = createCloudbreakSky(scene, maps.sky, sunDirection);
  if (hdr) {
    const pmrem = new THREE.PMREMGenerator(renderer); environment = pmrem.fromEquirectangular(hdr);
    scene.environment = environment.texture; scene.environmentIntensity = .65;
    scene.environmentRotation.y = .597 - Math.atan2(sunDirection.z, sunDirection.x); pmrem.dispose(); hdr.dispose();
  }
  scene.add(new THREE.HemisphereLight('#d7e9f4', '#707e58', 1.15));
  const light = new THREE.DirectionalLight('#fff5de', 3.1); light.target.position.set(0, 180, -650);
  light.position.copy(light.target.position).addScaledVector(sunDirection, 1400);
  light.castShadow = true; light.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
  Object.assign(light.shadow.camera, { left: -850, right: 850, top: 950, bottom: -850, near: 50, far: 2800 });
  light.shadow.camera.updateProjectionMatrix(); light.shadow.normalBias = 1.5; light.shadow.bias = -.00012;
  scene.add(light, light.target); signal.addEventListener('abort', () => light.shadow.dispose(), { once: true });
  await onStage('Carving a place for the water');
  const landscape = buildLandscape(scene, maps, profile);
  const lake = createLake(scene, maps, profile, signal), weather = createWeather(scene, profile);
  cinema = createCinema(renderer, scene, camera, { scale: profile.initialRatio / profile.canvasRatio, occlusion: profile.occlusion, bloom: profile.bloom, floatTargets: profile.floatTargets });
  cinema.grade.exposure.value = 1.04; cinema.grade.saturation.value = 1.04; cinema.grade.contrast.value = .12; cinema.quality.glow = .022;
  let pixelRatio = profile.initialRatio;
  function aim(progress, pointer) {
    camera.position.copy(cameraAt(progress)); camera.up.set(0, 1, 0); camera.lookAt(lookAt(progress)); camera.rotateZ(rollAt(progress)); camera.rotateY(-pointer.x * .018); camera.rotateX(pointer.y * .01);
  }
  aim(0, { x: 0, y: 0 }); weather.update(0, camera);
  await onStage('Watching the clouds gather');
  await compileWorld(renderer, scene, camera, { signal, timeoutMs: 20000 }); renderer.shadowMap.needsUpdate = true; cinema.render();
  if (gl.isContextLost()) throw new Error('The graphics connection was interrupted.');
  await onStage('A world held in rain');
  let time = 0, frames = 0, sampled = performance.now(), slow = 0;
  function resize() {
    if (signal.aborted) return;
    camera.aspect = innerWidth / Math.max(innerHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); cinema.setScale(pixelRatio / profile.canvasRatio); cinema.resize();
  }
  return { profile, renderer, scene, camera, cinema, resize,
    render(progress, pointer, dt, reducedMotion) {
      if (signal.aborted) return;
      if (!reducedMotion) time += dt;
      aim(progress, pointer); sky.update(time); lake.update(time); weather.update(time, camera);
      renderer.info.reset(); cinema.render(); frames++; const now = performance.now();
      if (now - sampled > 1000) {
        Object.assign(canvas.dataset, { fps: String(Math.round(frames * 1000 / (now - sampled))), triangles: String(renderer.info.render.triangles), calls: String(renderer.info.render.calls), stones: String(landscape.stoneCount), rain: String(weather.count), camera: camera.position.toArray().map(v => v.toFixed(1)).join(','), pixelRatio: pixelRatio.toFixed(2) });
        frames = 0; sampled = now;
      }
      slow = dt > .04 ? slow + 1 : Math.max(0, slow - 2);
      if (slow > 70 && pixelRatio > .75) { pixelRatio = Math.max(.75, pixelRatio * .9); resize(); slow = 0; }
    },
  };
}
