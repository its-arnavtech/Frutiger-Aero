import * as THREE from 'three';
import { terrainHeight, basinRadius, rng, noise, TAU } from './layout.js';
import { cirqueMaterial } from './materials.js';

export function buildLandscape(scene, maps) {
  const ground = new THREE.PlaneGeometry(1000, 1200, 440, 520); ground.rotateX(-Math.PI / 2); ground.translate(0, 0, -45);
  const positions = ground.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  ground.computeVertexNormals(); ground.computeBoundingSphere();
  const terrain = new THREE.Mesh(ground, cirqueMaterial(maps.rock, maps.pebbles)); terrain.name = 'Stratified cirque and glacial lake bed'; scene.add(terrain);

  // Sample the actual rendered triangles so small stones sit in the ground,
  // even where the analytic cliff has more detail than the mesh spacing.
  function surfaceHeight(x, z) {
    const gx = (x + 500) / 1000 * 440, gz = (z + 645) / 1200 * 520;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, a = iz * 441 + ix;
    const h00 = positions.getY(a), h10 = positions.getY(a + 1), h01 = positions.getY(a + 441), h11 = positions.getY(a + 442);
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
    const x = (random() - .5) * 410, z = -330 + random() * 545, r = basinRadius(x, z), y = surfaceHeight(x, z);
    if (r < .72 || r > 1.15 || y > 22) continue;
    const s = r < .98 ? .32 + random() * 1.3 : .6 + random() ** 3 * 4.5;
    pose.position.set(x, y - s * .45, z); pose.rotation.set(random() * .4, random() * TAU, random() * .35); pose.scale.set(s * (1 + random() * .5), s, s); pose.updateMatrix();
    stones.setMatrixAt(count, pose.matrix); stones.setColorAt(count, new THREE.Color(colors[count % colors.length]));
    footprints.push({ x, y, z, radius: s * 1.6 }); count++;
  }
  // A dense pebble shelf fills the opening shot, with no artificial platform.
  for (let i = 0; i < 1000 && count < 3300; i++) {
    const x = (random() - .5) * 96, z = 124 + random() * 80, y = surfaceHeight(x, z);
    if (y > 3.5) continue;
    const s = .22 + random() * .72;
    pose.position.set(x, y + s * .12, z); pose.rotation.set(random() * .3, random() * TAU, 0); pose.scale.set(s * 1.5, s, s); pose.updateMatrix();
    stones.setMatrixAt(count, pose.matrix); stones.setColorAt(count++, new THREE.Color(colors[i % colors.length]));
  }
  stones.count = count; stones.computeBoundingSphere(); stones.name = 'Rain-polished shoreline stones'; scene.add(stones);
  return { stoneCount: count, footprints };
}

export function createOvercastSky(scene) {
  const time = { value: 0 };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { time },
    vertexShader: 'varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 ray;uniform float time;
      float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
      float value(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<6;i++){f+=a*value(p);p=mat2(.8,.6,-.6,.8)*p*2.03+13.7;a*=.5;}return f;}
      void main(){vec3 r=normalize(ray);vec2 uv=r.xz/(max(r.y,0.)+.38)*2.8;
        float clouds=fbm(uv+vec2(time*.008,0.));float fine=fbm(uv*3.1-time*.005);
        vec3 dark=vec3(.40,.46,.48),light=vec3(.73,.78,.79);
        vec3 c=mix(dark,light,smoothstep(.17,.8,clouds*.8+fine*.2));
        float opening=pow(max(dot(r,normalize(vec3(-.35,.8,-.4))),0.),9.);
        c+=vec3(.19,.185,.17)*opening;c=mix(vec3(.55,.62,.64),c,smoothstep(-.03,.27,r.y));
        gl_FragColor=vec4(c,1.);}`,
  }));
  sky.name = 'Moving storm ceiling'; scene.add(sky);
  return { update(t) { time.value = t; } };
}
