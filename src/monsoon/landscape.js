import * as THREE from 'three';
import { terrainHeight, basinRadius, terrainBounds, rng, noise, TAU } from './layout.js';
import { cirqueMaterial } from './materials.js';

export function buildLandscape(scene, maps, profile) {
  const { width, depth, centerZ } = terrainBounds, nx = profile.mobile ? 400 : 640, nz = profile.mobile ? 440 : 700;
  const ground = new THREE.PlaneGeometry(width, depth, nx, nz); ground.rotateX(-Math.PI / 2); ground.translate(0, 0, centerZ);
  const positions = ground.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  ground.computeVertexNormals(); ground.computeBoundingSphere();
  const terrain = new THREE.Mesh(ground, cirqueMaterial(maps)); terrain.name = 'One far-shore massif, low green hills and a continuous lake bed'; terrain.castShadow = terrain.receiveShadow = true; scene.add(terrain);

  // Sample the actual rendered triangles so small stones sit in the ground,
  // even where the analytic cliff has more detail than the mesh spacing.
  function surfaceHeight(x, z) {
    const gx = (x + width / 2) / width * nx, gz = (z - centerZ + depth / 2) / depth * nz;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, a = iz * (nx + 1) + ix;
    const h00 = positions.getY(a), h10 = positions.getY(a + 1), h01 = positions.getY(a + nx + 1), h11 = positions.getY(a + nx + 2);
    return u + v < 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  const random = rng(90462), pose = new THREE.Object3D();
  const geometry = new THREE.IcosahedronGeometry(1, 1), stone = geometry.attributes.position;
  for (let i = 0; i < stone.count; i++) {
    const x = stone.getX(i), y = stone.getY(i), z = stone.getZ(i), d = .85 + noise(x * 3, z * 3) * .3;
    stone.setXYZ(i, x * d, y * d * .65, z * d);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ map: maps.rock, normalMap: maps.normal, normalScale: new THREE.Vector2(.3, .3), roughness: .51, color: '#e5e4d6' });
  const stones = new THREE.InstancedMesh(geometry, material, 3300), colors = ['#879294','#706c5b','#8d8d7c','#a9aba2','#545f60','#929582'];
  const footprints = []; let count = 0;
  // Low, irregular stones are physical geometry, including those visible under water.
  for (let i = 0; i < 5200 && count < 3300; i++) {
    const x = (random() - .5) * 660, z = -520 + random() * 890, r = basinRadius(x, z), y = surfaceHeight(x, z);
    if (r < .72 || r > 1.15 || y > 22) continue;
    const s = r < .98 ? .32 + random() * 1.3 : .6 + random() ** 3 * 4.5;
    pose.position.set(x, y - s * .45, z); pose.rotation.set(random() * .4, random() * TAU, random() * .35); pose.scale.set(s * (1 + random() * .5), s, s); pose.updateMatrix();
    stones.setMatrixAt(count, pose.matrix); stones.setColorAt(count, new THREE.Color(colors[count % colors.length]));
    footprints.push({ x, y, z, radius: s * 1.6 }); count++;
  }
  // A dense pebble shelf fills the opening shot, with no artificial platform.
  for (let i = 0; i < 1000 && count < 3300; i++) {
    const x = (random() - .5) * 140, z = 235 + random() * 100, y = surfaceHeight(x, z);
    if (y > 3.5) continue;
    const s = .22 + random() * .72;
    pose.position.set(x, y + s * .12, z); pose.rotation.set(random() * .3, random() * TAU, 0); pose.scale.set(s * 1.5, s, s); pose.updateMatrix();
    stones.setMatrixAt(count, pose.matrix); stones.setColorAt(count++, new THREE.Color(colors[i % colors.length]));
  }
  stones.count = count; stones.computeBoundingSphere(); stones.receiveShadow = true; stones.name = 'Rain-polished shoreline stones'; scene.add(stones);
  return { stoneCount: count, footprints };
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
