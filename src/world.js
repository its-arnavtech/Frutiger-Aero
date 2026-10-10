import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { cameraAt, lookAt, rollAt } from './journey.js';
import { createBatcher } from './build.js';
import { createSky } from './glass.js';
import { cityFinishes, buildCity } from './city.js';
import { loadSurfaces, landFinishes, buildLandscape } from './landscape.js';
import { createVegetation } from './vegetation.js';
import { createWater } from './water.js';
import { createCinema } from './cinema.js';
import { spheres, rng } from './layout.js';

const TAU = Math.PI * 2;

// The stock shadow filter reads the shadow map seventeen times for every lit
// pixel. The sun here is high and the map is dense, so one bilinear 2x2 lookup
// gives the same crisp daylight edge for a quarter of the work.
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace(
  /#if defined( SHADOWMAP_TYPE_PCF )[sS]*?#elif defined( SHADOWMAP_TYPE_PCF_SOFT )/,
  `#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 corner = shadowCoord.xy * shadowMapSize - 0.5, blend = fract( corner );
			corner = ( floor( corner ) + 0.5 ) * texelSize;
			shadow = mix(
				mix( texture2DCompare( shadowMap, corner, shadowCoord.z ), texture2DCompare( shadowMap, corner + vec2( texelSize.x, 0.0 ), shadowCoord.z ), blend.x ),
				mix( texture2DCompare( shadowMap, corner + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, corner + texelSize, shadowCoord.z ), blend.x ),
				blend.y );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )`);
// The sun in the sky photograph sits at this bearing; the sky is turned so it
// lines up with the light that casts the shadows.
const PHOTO_SUN_BEARING = .597;

// Aerial haze: the lowest band of sky dissolves into the same pale blue that
// distance gives the water, so the horizon is a soft glow rather than a seam.
function createHaze(scene, colour) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, blending: THREE.CustomBlending, uniforms: { hazeColour: { value: colour } },
    vertexShader: 'varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 hazeColour; varying vec3 vDirection; void main() { float rise = normalize(vDirection).y; gl_FragColor = vec4(hazeColour, .82 * pow(1. - smoothstep(-.02, .17, rise), 2.)); }',
  });
  const haze = new THREE.Mesh(new THREE.SphereGeometry(1700, 40, 20), material);
  haze.name = 'Horizon haze'; haze.frustumCulled = false; haze.renderOrder = -1000;
  // Always centred on whichever camera is drawing, including the mirror camera.
  haze.onBeforeRender = (renderer, _, camera) => haze.matrixWorld.setPosition(camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]);
  scene.add(haze);
}

// The thread of water that spills from the great sphere into the basin.
function createCascade(scene) {
  const sphere = spheres[0], top = sphere.y - sphere.r * .985, material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; uniform float time;
      void main() { vUv = uv; vec3 p = position; float sway = sin(uv.y * 9. + time * 1.7) * .1 * (1. - uv.y); p.x += sway; p.z += sway * .6;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
      void main() {
        float streaks = noise(vec2(vUv.x * 46., vUv.y * 5. + time * 2.2)), fine = noise(vec2(vUv.x * 120., vUv.y * 22. + time * 7.));
        float alpha = (.16 + .5 * streaks + .2 * fine) * smoothstep(1., .9, vUv.y) * (.55 + .45 * smoothstep(0., .25, vUv.y));
        gl_FragColor = vec4(mix(vec3(.62, .9, .95), vec3(1.), fine) * 1.25, alpha);
      }`,
  });
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(.55, 1.5, top, 28, 24, true), material);
  fall.position.set(sphere.x, top / 2, sphere.z); fall.layers.set(1); scene.add(fall);
  const mist = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 1.6, 28, 4, true), material);
  mist.position.set(sphere.x, .8, sphere.z); mist.layers.set(1); scene.add(mist);
  return material;
}

export async function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xb3d2ee, .0017);
  const camera = new THREE.PerspectiveCamera(55, Math.max(1, innerWidth) / Math.max(1, innerHeight), .3, 2200);
  camera.layers.enable(1);

  const loader = new THREE.TextureLoader();
  const [hdr, photograph, waterNormals, maps, facade] = await Promise.all([
    new HDRLoader().loadAsync('/assets/environment/kloofendal_48d_partly_cloudy_puresky_2k.hdr'),
    loader.loadAsync('/assets/environment/kloofendal_48d_partly_cloudy_puresky_4k.jpg'),
    loader.loadAsync('/assets/materials/waternormals.jpg'), loadSurfaces(renderer),
    loader.loadAsync('/assets/materials/aero-glass-interiors.png'),
  ]);
  const sunDirection = new THREE.Vector3(-.5, .8, .6).normalize();
  const skyTurn = PHOTO_SUN_BEARING - Math.atan2(sunDirection.z, sunDirection.x);
  photograph.colorSpace = THREE.SRGBColorSpace;
  const sky = createSky(renderer, photograph, skyTurn);
  scene.background = sky.cube; scene.backgroundRotation.copy(sky.rotation); scene.backgroundIntensity = 1.3;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentRotation.copy(sky.rotation); scene.environmentIntensity = .72;
  pmrem.dispose(); hdr.dispose();
  facade.colorSpace = THREE.SRGBColorSpace; facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
  facade.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x8fb7a8, .3));
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.3);
  sun.target.position.set(4, 0, -44); sun.position.copy(sun.target.position).addScaledVector(sunDirection, 330);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -195, right: 175, top: 225, bottom: -140, near: 150, far: 480 });
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -.00025; sun.shadow.normalBias = .09; scene.add(sun, sun.target);

  const finishes = { ...cityFinishes({ facade, sky, sun: sunDirection }), ...landFinishes(maps) };
  const batch = createBatcher(finishes), plantings = { trees: [], shrubs: [], vines: [] };
  buildCity({ add: batch.add, plantings }); buildLandscape({ add: batch.add });
  const city = new THREE.Group(); city.name = 'Aero city'; scene.add(city);
  const meshes = batch.build(city, 'City');
  const vegetation = await createVegetation({ scene, plantings, renderer });
  const water = createWater({ renderer, scene, normals: waterNormals, sky, sunDirection, sunColor: 0xfff6e2 });
  const cascade = createCascade(scene);
  createHaze(scene, scene.fog.color);

  // Loose bubbles drift on the breeze between the towers.
  const random = rng(38174), drifting = Array.from({ length: 34 }, () => ({ x: (random() - .5) * 150, y: 6 + random() * 52, z: 120 - random() * 300, r: .25 + random() * random() * 1.9, phase: random() * TAU }));
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), finishes.bubble.material, drifting.length), pose = new THREE.Object3D();
  bubbles.frustumCulled = false; bubbles.layers.set(1); scene.add(bubbles);

  const cinema = createCinema(renderer, scene, camera);
  const resizeTargets = () => { const size = renderer.getDrawingBufferSize(new THREE.Vector2()); cinema.resize(); water.resize(size.x, size.y); };
  resizeTargets();

  // Development switches: ?view=x,y,z,tx,ty,tz pins the camera, ?off=a,b disables stages.
  const query = new URLSearchParams(location.search), off = new Set((query.get('off') || '').split(','));
  const target = new THREE.Vector3(); let fixed = query.get('view')?.split(',').map(Number);
  if (query.has('samples')) cinema.setSamples(Number(query.get('samples')));
  if (off.has('ao')) cinema.quality.occlusion = false;
  if (off.has('bloom')) cinema.quality.bloom = false;
  if (off.has('veg')) vegetation.root.visible = false;
  if (off.has('city')) city.visible = false;
  if (off.has('water')) water.mesh.visible = false;
  if (off.has('fog')) scene.fog = null;
  function aim(progress, pointer) {
    if (fixed?.length === 6) { camera.position.set(fixed[0], fixed[1], fixed[2]); camera.up.set(0, 1, 0); camera.lookAt(fixed[3], fixed[4], fixed[5]); return; }
    const position = cameraAt(progress), gaze = lookAt(progress);
    camera.position.set(position.x, position.y, position.z); target.set(gaze.x, gaze.y, gaze.z);
    camera.up.set(0, 1, 0); camera.lookAt(target);
    camera.rotateZ(rollAt(progress)); camera.rotateY(-pointer.x * .035); camera.rotateX(pointer.y * .022);
  }
  aim(0, { x: 0, y: 0 });
  // Compile every shader and build the cached shadow map with all plants
  // present, before per-frame visibility starts trimming them.
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  // One cube-map photograph of the finished city gives every pane of glass
  // real surroundings to reflect.
  water.material.uniforms.mirrorAmount.value = 0;
  sky.capture(scene, new THREE.Vector3(1, 30, -26));
  water.material.uniforms.mirrorAmount.value = 1;
  cinema.render();

  let liveTime = 0, slow = 0, frames = 0, sampleTime = performance.now(), step = 0, shown = 0;
  // Each step trades a little fidelity for speed on machines that need it.
  const economies = [
    () => { if (cinema.quality.samples) cinema.setSamples(0); else pixelRatio *= .88; }, () => { pixelRatio *= .88; }, () => { pixelRatio *= .88; },
    () => { pixelRatio *= .88; }, () => { cinema.quality.bloom = false; }, () => { cinema.quality.occlusion = false; pixelRatio *= .88; },
  ];
  const applyPixelRatio = () => { pixelRatio = Math.max(.7, pixelRatio); renderer.setPixelRatio(pixelRatio); resizeTargets(); };
  function render(progress, pointer, dt, reducedMotion = false) {
    shown = progress;
    if (!reducedMotion) liveTime += dt;
    const time = liveTime * .38 + progress * 60;
    aim(progress, pointer);
    vegetation.update(time, camera);
    water.material.uniforms.time.value = time; cascade.uniforms.time.value = time;
    drifting.forEach((b, i) => {
      pose.position.set(b.x + Math.sin(time * .12 + b.phase) * 1.4, b.y + Math.sin(time * .23 + b.phase) * .9, b.z + Math.cos(time * .1 + b.phase) * 1.2);
      pose.scale.setScalar(b.r); pose.updateMatrix(); bubbles.setMatrixAt(i, pose.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
    renderer.info.reset();
    if (!off.has('mirror')) { vegetation.reflectionBegin(); water.update(camera); vegetation.reflectionEnd(); }
    cinema.render();
    frames++; const elapsed = performance.now() - sampleTime;
    if (elapsed > 1000) {
      Object.assign(canvas.dataset, {
        camera: camera.position.toArray().map(v => v.toFixed(2)).join(','), fov: String(camera.fov), fps: String(Math.round(frames * 1000 / elapsed)),
        triangles: String(renderer.info.render.triangles), calls: String(renderer.info.render.calls), trees: String(vegetation.stats.trees),
        pixelRatio: String(pixelRatio), economy: String(step),
      });
      frames = 0; sampleTime = performance.now();
    }
    if (dt > .034) slow++; else slow = Math.max(0, slow - 2);
    if (slow > 50 && step < economies.length && !off.has('economy')) { economies[step++](); applyPixelRatio(); slow = 0; }
  }
  // Before the curtain lifts, time a few real frames and fit the picture to this
  // GPU, so the flight starts smooth instead of stepping down while you watch.
  // A page opened in a hidden pane has no size yet, so it is fitted on first resize.
  let fitted = off.has('economy');
  function fit() {
    if (fitted || innerWidth < 64 || innerHeight < 64) return;
    fitted = true;
    const gl = renderer.getContext(), pixel = new Uint8Array(4), still = { x: 0, y: 0 }, BUDGET = 24;
    const batch = () => { const start = performance.now(); for (let i = 0; i < 2; i++) render(shown, still, 0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return (performance.now() - start) / 2; };
    // The quickest of several short batches: a busy machine only ever adds time.
    const cost = () => { batch(); return Math.min(batch(), batch(), batch(), batch()); };
    let ms = cost();
    // Nearly all of the cost is per pixel, so resolution is the lever. A GPU
    // with room to spare is given true multisampling instead of FXAA.
    if (ms > BUDGET) { pixelRatio *= Math.max(.62, Math.sqrt(BUDGET / ms)); applyPixelRatio(); }
    else if (ms < BUDGET * .45) { cinema.setSamples(4); if (cost() > BUDGET) cinema.setSamples(0); }
    canvas.dataset.calibration = `${ms.toFixed(1)}ms`;
  }
  fit();
  function resize() { camera.aspect = Math.max(1, innerWidth) / Math.max(1, innerHeight); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); resizeTargets(); fit(); }
  return { render, resize, renderer, scene, camera, cinema, meshes, switches: off, pin(view) { fixed = view; } };
}
