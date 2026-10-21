import * as THREE from 'three';
import { terrainHeight, terrainBounds, smooth } from './layout.js';
import { cirqueMaterial } from './materials.js';
import { buildShore } from './vegetation.js';

export function createTerrainGeometry(profile) {
  const { width, depth, centerZ } = terrainBounds;
  // Spend the existing vertex budget on the mountain rather than the flat
  // outer apron. This is one continuous mesh, including the underwater bed.
  const axis = (start, end, fineStart, fineEnd) => {
    const values = [start], fine = profile.low ? 6 : profile.mobile ? 4 : 2;
    for (let value = start; value < end;) {
      const step = value >= fineStart && value < fineEnd ? fine : 6;
      value = Math.min(end, value + step); values.push(value);
    }
    return values;
  };
  const xs = axis(-width / 2, width / 2, -640, 640);
  const zs = axis(centerZ - depth / 2, centerZ + depth / 2, -1350, -450);
  const nx = xs.length - 1, nz = zs.length - 1;
  const ground = new THREE.PlaneGeometry(width, depth, nx, nz);
  const positions = ground.attributes.position;
  for (let row = 0; row <= nz; row++) for (let column = 0; column <= nx; column++) {
    const x = xs[column], z = zs[row];
    positions.setXYZ(row * (nx + 1) + column, x, terrainHeight(x, z), z);
  }
  ground.computeVertexNormals(); ground.computeBoundingSphere();
  const cell = (axis, value) => {
    let low = 0, high = axis.length - 1;
    while (high - low > 1) { const mid = (low + high) >> 1; if (axis[mid] <= value) low = mid; else high = mid; }
    return low;
  };
  const surfaceHeight = (x, z) => {
    const ix = cell(xs, x), iz = cell(zs, z), u = (x - xs[ix]) / (xs[ix + 1] - xs[ix]), v = (z - zs[iz]) / (zs[iz + 1] - zs[iz]), a = iz * (nx + 1) + ix;
    const h00 = positions.getY(a), h10 = positions.getY(a + 1), h01 = positions.getY(a + nx + 1), h11 = positions.getY(a + nx + 2);
    return u + v < 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  };
  const habitat = new Float32Array(positions.count * 2), colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (y < 1 || Math.abs(x) > 1170 || z < -1670 || z > 870) { habitat.set([1, 0], i * 2); colors.set([1, 1, 1], i * 3); continue; }
    const h = (dx, dz) => surfaceHeight(x + dx, z + dz);
    const hollow = (h(-12, 0) + h(12, 0) + h(0, -12) + h(0, 12)) * .25 - y;
    const slope = 1 / Math.hypot((h(10, 0) - h(-10, 0)) / 20, 1, (h(0, 10) - h(0, -10)) / 20);
    habitat.set([slope, THREE.MathUtils.clamp(hollow / 7, -1, 1)], i * 2);
    const shelter = smooth(.3, 7, hollow) * .19, shade = 1 - shelter;
    colors.set([shade * (1 - shelter * .12), shade, Math.min(1, shade * (1 + shelter * .09))], i * 3);
  }
  ground.setAttribute('mountainHabitat', new THREE.BufferAttribute(habitat, 2));
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return { ground, surfaceHeight };
}

export function buildLandscape(scene, maps, profile) {
  const { ground, surfaceHeight } = createTerrainGeometry(profile);
  const terrain = new THREE.Mesh(ground, cirqueMaterial(maps)); terrain.name = 'Eroded alpine buttresses, snow gullies and a continuous lake bed'; terrain.castShadow = terrain.receiveShadow = true; scene.add(terrain);

  return { ...buildShore(scene, maps, profile, surfaceHeight), surfaceHeight };
}

export function createCloudbreakSky(scene, photograph, sunDirection) {
  const turn = { value: -.303 - Math.atan2(sunDirection.z, sunDirection.x) }, initialTurn = turn.value;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { photograph: { value: photograph }, turn },
    vertexShader: 'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 ray;uniform sampler2D photograph;uniform float turn;
      void main(){vec3 d=normalize(ray);
        vec2 uv=vec2(fract((atan(d.z,d.x)+turn)/6.2831853+.5),asin(clamp(d.y,-1.,1.))/3.14159265+.5);
        vec3 color=texture2D(photograph,uv).rgb;
        color=mix(vec3(.58,.71,.79),color,smoothstep(-.03,.10,d.y));
        gl_FragColor=vec4(color,1.);}`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -1000; sky.name = 'Blue sky and slow-moving photographic cumulus';
  sky.onBeforeRender = (_, __, camera) => sky.matrixWorld.setPosition(camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]);
  scene.add(sky); return { update(t) { turn.value = initialTurn + t * .00035; } };
}
