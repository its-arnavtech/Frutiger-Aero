import * as THREE from 'three';
import { cameraAt, lookAt, rollAt } from './journey.js';
import { buildLandscape, createOvercastSky } from './landscape.js';
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
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#a3b8ba', .00125);
  const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, .15, 2400); camera.layers.enable(1);
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
  const load = url => loader.loadAsync(url).then(texture => {
    if (signal.aborted) { texture.dispose(); throw signal.reason; }
    resources.add(texture); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
  });
  await onStage('Rain on stone');
  const maps = await waitFor(loadMaterials(load), { signal, timeoutMs: 30000, label: 'Loading mountain materials' });
  const sky = createOvercastSky(scene);
  if (profile.floatTargets) {
    const pmrem = new THREE.PMREMGenerator(renderer); environment = pmrem.fromScene(scene, .08, .1, 2400);
    scene.environment = environment.texture; scene.environmentIntensity = .65; pmrem.dispose();
  }
  scene.add(new THREE.HemisphereLight('#e5eff1', '#7d847c', 2.65));
  const light = new THREE.DirectionalLight('#edf1ed', 1.35); light.position.set(-150, 300, 30); scene.add(light);
  await onStage('Carving a place for the water');
  const landscape = buildLandscape(scene, maps);
  const lake = createLake(scene, maps, profile, signal), weather = createWeather(scene, profile);
  cinema = createCinema(renderer, scene, camera, { scale: profile.initialRatio / profile.canvasRatio, occlusion: profile.occlusion, bloom: profile.bloom, floatTargets: profile.floatTargets });
  cinema.grade.exposure.value = 1.12; cinema.grade.saturation.value = .88; cinema.grade.contrast.value = .08; cinema.quality.glow = .018;
  let pixelRatio = profile.initialRatio;
  function aim(progress, pointer) {
    camera.position.copy(cameraAt(progress)); camera.up.set(0, 1, 0); camera.lookAt(lookAt(progress)); camera.rotateZ(rollAt(progress)); camera.rotateY(-pointer.x * .018); camera.rotateX(pointer.y * .01);
  }
  aim(0, { x: 0, y: 0 }); weather.update(0, camera);
  await onStage('Watching the clouds gather');
  await compileWorld(renderer, scene, camera, { signal, timeoutMs: 20000 }); cinema.render();
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
