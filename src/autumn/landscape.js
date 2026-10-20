import * as THREE from 'three';
import { terrainHeight, riverX, riverWidth, rng, smooth, TAU } from './layout.js';
import { forestFloor } from './materials.js';
import { buildAlpineRange, groundNoise } from './geology.js';
import { createRiverStone, createMeadowTuft, riverStoneMaterial } from './ground-details.js';

export function buildTerrain(scene, maps) {
  // Preserve sub-metre banks around the millrace rather than bridging the
  // entire narrow stream with one coarse ground triangle.
  const xs = [...new Set([...Array.from({ length: 341 }, (_, i) => -410 + i * 820 / 340), ...Array.from({ length: 81 }, (_, i) => -38 + i * .4)])].sort((a,b)=>a-b);
  const zs = [...new Set([...Array.from({ length: 411 }, (_, i) => -580 + i * 1000 / 410), ...Array.from({ length: 51 }, (_, i) => -15 + i * .4)])].sort((a,b)=>a-b);
  const geometry = new THREE.PlaneGeometry(820, 1000, xs.length - 1, zs.length - 1);
  const grid = geometry.attributes.position;
  for (let z = 0; z < zs.length; z++) for (let x = 0; x < xs.length; x++) grid.setXYZ(z * xs.length + x, xs[x], 0, zs[z]);
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
  const stoneMaterial = riverStoneMaterial(maps);
  const rockBatches = Array.from({ length: 14 }, (_, i) => {
    // Chips are permanently smaller meshes; nearby boulders keep their full
    // fractured shape at every camera distance, without a visible LOD swap.
    const stones = new THREE.InstancedMesh(createRiverStone(916 + i % 7 * 137, i < 7 ? 4 : 1), stoneMaterial, 700);
    stones.count = 0; stones.receiveShadow = stones.castShadow = true;
    stones.name = `Fractured river stones ${i + 1}`; scene.add(stones); return stones;
  });
  const tint = new THREE.Color();
  function placeStone(x, z, scale, variant) {
    const y = terrainHeight(x, z);
    if (y < -1.6 || (x > -34 && x < -6 && Math.abs(z + 5) < 2.2)) return;
    const stones = rockBatches[variant % 7 + (scale < .45 ? 7 : 0)];
    if (stones.count >= stones.instanceMatrix.count) return;
    pose.position.set(x, y - scale * .21, z);
    // Flat, bedded stones sit into the earth instead of balancing on a point.
    pose.rotation.set((random()-.5)*.5, random()*TAU, (random()-.5)*.35);
    pose.scale.set(scale*(.9+random()*.65), scale, scale*(.75+random()*.4)); pose.updateMatrix();
    stones.setMatrixAt(stones.count, pose.matrix);
    tint.setHSL(.105+random()*.025, .045+random()*.045, .68+random()*.19);
    stones.setColorAt(stones.count++, tint);
  }
  for (let i = 0; i < 420; i++) {
    const z = -290 + random()*540, side = random()>.5 ? 1 : -1;
    const x = riverX(z)+side*(riverWidth(z)+random()*9-1), s=.45+random()**2*1.9;
    placeStone(x,z,s,i);
    // Small fragments gather around boulders in uneven, geologically related groups.
    for (let j=0;j<3;j++) {
      const a=random()*TAU, r=s*(.7+random()*.9);
      placeStone(x+Math.cos(a)*r,z+Math.sin(a)*r,.09+random()*.3,i+j);
    }
  }
  for (let i = 0; i < 90; i++) {
    const a=random()*TAU,r=12+random()*8;
    placeStone(Math.cos(a)*r,-155+Math.sin(a)*r,.2+random()*1.3,i);
  }
  for (let i = 0; i < 100; i++) {
    const x=-31+random()*23, side=random()>.5?1:-1;
    placeStone(x,-5+side*(2.3+random()*.6),.14+random()*.37,i);
  }
  for (const stones of rockBatches) stones.computeBoundingSphere();

  const grass = new THREE.InstancedMesh(createMeadowTuft(7151), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .92, envMapIntensity: .65 }), 6800);
  let count = 0;
  function plantTuft(x,z) {
    const y=terrainHeight(x,z);
    if (y<.4 || groundNoise(x*.24,z*.24)<.27) return;
    pose.position.set(x,y-.025,z); pose.rotation.set(0,random()*TAU,0);
    pose.scale.setScalar(.7+random()*.9);pose.updateMatrix();grass.setMatrixAt(count++,pose.matrix);
  }
  for(let i=0;i<6200;i++) {
    const z=-260+random()*500,side=random()>.5?1:-1;
    plantTuft(riverX(z)+side*(riverWidth(z)+1+random()**1.5*17),z);
  }
  for(let i=0;i<600;i++) {
    const a=random()*TAU,r=5+random()*13;plantTuft(Math.cos(a)*r,-155+Math.sin(a)*r);
  }
  grass.count=count;grass.layers.set(1);grass.receiveShadow=true;grass.computeBoundingSphere();grass.name='Curved meadow grass and dry sedges';scene.add(grass);
  // Instance culling keeps the new detail affordable. The reflected half of
  // the scene is included, so visible stones never vanish from the river.
  const detailBatches = [...rockBatches, grass].map(mesh => {
    const entries = Array.from({ length: mesh.count }, (_, i) => {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
      const color = mesh.instanceColor ? new THREE.Color() : null;
      if (color) mesh.getColorAt(i, color);
      return { matrix, color, bounds: mesh.geometry.boundingSphere.clone().applyMatrix4(matrix) };
    });
    mesh.frustumCulled = false;
    return { mesh, entries, reflected: mesh !== grass };
  });
  const view = new THREE.Matrix4(), previous = new THREE.Matrix4(), frustum = new THREE.Frustum(), mirror = new THREE.Sphere();
  terrain.userData.updateDetails = camera => {
    camera.updateMatrixWorld(); view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (view.equals(previous)) return;
    previous.copy(view); frustum.setFromProjectionMatrix(view);
    for (const { mesh, entries, reflected } of detailBatches) {
      let visible = 0;
      for (const entry of entries) {
        mirror.copy(entry.bounds); mirror.center.y *= -1;
        if (!frustum.intersectsSphere(entry.bounds) && !(reflected && frustum.intersectsSphere(mirror))) continue;
        mesh.setMatrixAt(visible, entry.matrix);
        if (entry.color) mesh.setColorAt(visible, entry.color);
        visible++;
      }
      mesh.count = visible; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
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
