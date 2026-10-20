import * as THREE from 'three';
import { terrainHeight, riverX, riverWidth, rng, smooth, TAU } from './layout.js';
import { forestFloor } from './materials.js';
import { buildAlpineRange } from './geology.js';

export function buildTerrain(scene, maps) {
  const rockMap = maps.rock;
  const geometry = new THREE.PlaneGeometry(820, 1000, 340, 410);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, -80);
  const positions = geometry.attributes.position, colors = [], uv = geometry.attributes.uv;
  const soil = new THREE.Color('#e3ddc5'), moss = new THREE.Color('#c2cf9d'), copper = new THREE.Color('#e9d8b2'), rock = new THREE.Color('#a7a69b'), color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = terrainHeight(x, z);
    positions.setY(i, y); uv.setXY(i, x * .34, z * .34);
    const edge = Math.abs(x - riverX(z)) - riverWidth(z);
    const patch = .5 + .5 * Math.sin(x * .062 + Math.cos(z * .03) * 3) * Math.sin(z * .09);
    color.copy(soil).lerp(copper, patch * .6).lerp(moss, smooth(8, 80, edge) * .45);
    if (y > 40) color.lerp(rock, smooth(40, 65, y) * .6);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = forestFloor(maps);
  const terrain = new THREE.Mesh(geometry, material); terrain.receiveShadow = true; terrain.name = 'Continuous river valley'; scene.add(terrain);

  buildAlpineRange(scene, maps);

  const random = rng(5521), pose = new THREE.Object3D();
  const stoneGeometry = new THREE.IcosahedronGeometry(1, 2);
  const sp = stoneGeometry.attributes.position;
  for (let i=0;i<sp.count;i++) { const x=sp.getX(i), y=sp.getY(i), z=sp.getZ(i), deform=1+.13*Math.sin(x*7.+z*4.)*Math.cos(y*5.); sp.setXYZ(i,x*deform,y*deform,z*deform); }
  stoneGeometry.computeVertexNormals();
  const stones = new THREE.InstancedMesh(stoneGeometry, new THREE.MeshStandardMaterial({ color: '#a8a79b', map: rockMap, normalMap: maps.rockNormal, normalScale: new THREE.Vector2(.75,.75), roughness: .73 }), 720);
  let count = 0;
  for (let i = 0; i < 620; i++) {
    const z = -290 + random() * 540, side = random() > .5 ? 1 : -1;
    const x = riverX(z) + side * (riverWidth(z) + random() * 10 - 1), y = terrainHeight(x, z);
    if (y < -1) continue;
    const scale = .4 + random() * 1.3;
    pose.position.set(x, y - .1, z); pose.rotation.set(random(), random() * TAU, random()); pose.scale.set(scale * 1.4, scale * .75, scale); pose.updateMatrix(); stones.setMatrixAt(count++, pose.matrix);
  }
  for (let i = 0; i < 90; i++) {
    const a = random() * TAU, r = 12 + random() * 8, x = Math.cos(a) * r, z = -155 + Math.sin(a) * r, y = terrainHeight(x, z);
    if (y < -1.5 || y > 1.8) continue;
    const s = .4 + random() * 1.2;
    pose.position.set(x, y - .18, z); pose.rotation.set(random(), a, random()); pose.scale.set(s * 1.3, s * .65, s); pose.updateMatrix(); stones.setMatrixAt(count++, pose.matrix);
  }
  stones.count = count; stones.receiveShadow = true; stones.castShadow = true; stones.computeBoundingSphere(); stones.name = 'River stones'; scene.add(stones);
  // Modeled clumps of dry grass soften the seam where the water meets the soil.
  const blades = [], shades = [], grassRandom = rng(7151);
  for (let b = 0; b < 9; b++) {
    const a = b * 2.4, h = .45 + grassRandom() * .6, bend = .18 + grassRandom() * .3;
    const dx = Math.cos(a), dz = Math.sin(a), w = .025;
    const base = [-dz * w, 0, dx * w], edge = [dz * w, 0, -dx * w];
    const mid = [dx * bend * .4, h * .65, dz * bend * .4], tip = [dx * bend, h, dz * bend];
    blades.push(...base, ...edge, ...mid, ...base, ...mid, ...tip);
    for (let v = 0; v < 6; v++) shades.push(...new THREE.Color(v === 5 ? '#b5bc63' : '#5f7d36').toArray());
  }
  const grassGeometry = new THREE.BufferGeometry(); grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3)); grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3)); grassGeometry.computeVertexNormals();
  const grass = new THREE.InstancedMesh(grassGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 2800);
  count = 0;
  for (let i = 0; i < 2400; i++) {
    const z = -260 + random() * 500, side = random() > .5 ? 1 : -1;
    const x = riverX(z) + side * (riverWidth(z) + 1 + random() * 7), y = terrainHeight(x, z);
    if (y < -.1) continue;
    pose.position.set(x, y, z); pose.rotation.set(0, random() * TAU, 0); pose.scale.setScalar(.6 + random() * .8); pose.updateMatrix(); grass.setMatrixAt(count++, pose.matrix);
  }
  for (let i = 0; i < 400; i++) {
    const a = random() * TAU, r = 5 + random() * 13, x = Math.cos(a) * r, z = -155 + Math.sin(a) * r, y = terrainHeight(x, z);
    if (y < .15) continue;
    pose.position.set(x, y, z); pose.rotation.set(0, a, 0); pose.scale.setScalar(.5 + random() * .8); pose.updateMatrix(); grass.setMatrixAt(count++, pose.matrix);
  }
  grass.count = count; grass.layers.set(1); grass.receiveShadow = true; grass.computeBoundingSphere(); grass.name = 'Autumn sedges'; scene.add(grass);
  return terrain;
}

export function createAutumnSky(scene, sunDirection, photograph) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { sun: { value: sunDirection }, photograph: { value: photograph }, turn: { value: .597 - Math.atan2(sunDirection.z, sunDirection.x) } },
    vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 direction; uniform vec3 sun; uniform sampler2D photograph; uniform float turn;
      void main(){vec3 d=normalize(direction); float h=max(0.,d.y), alignment=max(0.,dot(d,sun));
      vec2 uv=vec2(fract((atan(d.z,d.x)+turn)/6.2831853+.5),asin(clamp(d.y,-1.,1.))/3.14159265+.5);
      vec3 c=texture2D(photograph,uv).rgb;
      // Keep photographic cloud detail, cool blue overhead and honey at the horizon.
      float brightness=dot(c,vec3(.2126,.7152,.0722));
      c=mix(c,c*vec3(1.26,1.02,.72),smoothstep(.06,.7,brightness)*.65);
      c=mix(vec3(.78,.66,.50),c,smoothstep(-.015,.24,h));
      c+=vec3(.3,.15,.045)*pow(alignment,18.);
      gl_FragColor=vec4(c,1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 20), material); sky.name = 'October sky'; sky.frustumCulled = false; sky.renderOrder = -1000;
  sky.onBeforeRender = (_, __, camera) => sky.matrixWorld.setPosition(camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]);
  scene.add(sky); return sky;
}
