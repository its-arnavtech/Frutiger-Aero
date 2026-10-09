import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { cameraAt, lookAt, islands, islandHeight } from './journey';
import { skyMaterial, normalTexture, cloudTexture, makeTerrain, bubbleMaterial } from './materials';

const TAU = Math.PI * 2;

export async function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x91dbe9, .002);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .2, 1500);
  const sunDirection = new THREE.Vector3(-.5, .8, .6).normalize();
  const skyMat = skyMaterial(sunDirection);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), skyMat));
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), skyMat));
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(envScene, .025).texture; pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdaffff, 0x5c8740, 1.25));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2.7); sun.position.set(-50, 95, 40); sun.target.position.set(0, 0, -40);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -115; sun.shadow.camera.right = sun.shadow.camera.top = 115; sun.shadow.camera.far = 300; sun.shadow.bias = -.0003; sun.shadow.normalBias = .08; scene.add(sun, sun.target);
  let seed = 38174; const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const matrix = new THREE.Object3D();
  const white = new THREE.MeshPhysicalMaterial({color: 0xf3fffc, metalness: .2, roughness: .18, clearcoat: 1});
  const silver = new THREE.MeshStandardMaterial({color: 0xc5f1f1, metalness: .75, roughness: .19});
  const blueGlass = new THREE.MeshPhysicalMaterial({color: 0x42b8d0, metalness: .52, roughness: .13, clearcoat: 1, envMapIntensity: 1.5});
  const ground = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .92});
  const vegetationTime = {value: 0};
  const foliageMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .86});
  foliageMaterial.onBeforeCompile = shader => {
    shader.uniforms.windTime = vegetationTime;
    shader.vertexShader = 'uniform float windTime; varying vec3 leafPoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nleafPoint=position; transformed.x += sin(windTime*.9 + position.y*3.)*.035*(position.y+1.);');
    shader.fragmentShader='varying vec3 leafPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat leafGrain=sin(leafPoint.x*93.+sin(leafPoint.z*48.))*sin(leafPoint.y*81.+leafPoint.x*29.);diffuseColor.rgb*=.85+leafGrain*.2;');
  };
  const leafGeometry = new THREE.SphereGeometry(1, 10, 6);
  const leafPositions = leafGeometry.attributes.position;
  for(let i=0;i<leafPositions.count;i++){const x=leafPositions.getX(i),y=leafPositions.getY(i),z=leafPositions.getZ(i);const bump=1+.13*Math.sin(x*17+y*21+z*13);leafPositions.setXYZ(i,x*bump,y*bump,z*bump);}
  const leaves = [], trunks = [], grass = [], flowers = [], rocks = [];
  function tree(x, y, z, scale = 1) {
    trunks.push({x, y: y + scale * 2, z, sx: scale * .2, sy: scale * 4, sz: scale * .2});
    for(let b=0;b<4;b++){const a=b/4*TAU;trunks.push({x:x+Math.cos(a)*scale*.5,y:y+scale*3.35,z:z+Math.sin(a)*scale*.5,sx:scale*.085,sy:scale*2,sz:scale*.085,rot:-a,tilt:-.6});}
    for (let i = 0; i < 65; i++) {
      const a = i * 2.399, radius = Math.sqrt(random()) * 2.05 * scale;
      const top=4.2+Math.sqrt(Math.max(0,1-radius*radius/(4.3*scale*scale)))*.9;
      leaves.push({x: x + Math.cos(a) * radius, y: y + scale * (top + (random()-.5)*1.5), z: z + Math.sin(a) * radius, sx: scale * (.46 + random() * .42), sy: scale * (.39 + random() * .4), sz: scale * (.46 + random() * .42), c: new THREE.Color().setHSL(.235 + random() * .06, .63, .21 + random() * .13)});
    }
  }
  for (const island of islands) {
    const terrain = new THREE.Mesh(makeTerrain(island), ground); terrain.receiveShadow = true; scene.add(terrain);
    const treeCount = island.seed === 3 ? 6 : 9;
    for (let i = 0; i < treeCount; i++) {
      const a = random() * TAU, r = Math.sqrt(random()) * .65;
      const x = island.x + Math.cos(a) * r * island.rx, z = island.z + Math.sin(a) * r * island.rz;
      tree(x, islandHeight(island, x, z), z, .55 + random() * .7);
    }
    for (let i = 0; i < 450; i++) {
      const a = random() * TAU, r = Math.sqrt(random()) * .92;
      const x = island.x + Math.cos(a) * r * island.rx, z = island.z + Math.sin(a) * r * island.rz;
      const y = islandHeight(island, x, z); if (y < .45) continue;
      grass.push({x, y, z, sx: .12 + random() * .18, sy: .16 + random() * .45, sz: 1, rot: random() * TAU});
      if (i % 7 === 0) flowers.push({x, y: y + .23, z, sx: .095, sy: .065, sz: .095, c: new THREE.Color(i % 3 === 0 ? 0xffef88 : 0xf9fff2)});
    }
    for (let i = 0; i < 10; i++) {
      const a = random() * TAU, r = .83 + random() * .15;
      const x = island.x + Math.cos(a) * r * island.rx, z = island.z + Math.sin(a) * r * island.rz;
      rocks.push({x, y: Math.max(-.1, islandHeight(island, x, z)), z, sx: .5 + random() * 1.1, sy: .25 + random() * .5, sz: .6 + random() * 1.1});
    }
  }
  tree(-24, islandHeight(islands[0], -24, 14), 14, 2.1);
  tree(-31, islandHeight(islands[2], -31, -24), -24, 2.15);
  function instances(geometry, material, data, shadows = false) {
    const mesh = new THREE.InstancedMesh(geometry, material, data.length);
    data.forEach((item, i) => { matrix.position.set(item.x, item.y, item.z); matrix.scale.set(item.sx, item.sy, item.sz); matrix.rotation.set(0, item.rot || 0, item.tilt || 0); matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix); if (item.c) mesh.setColorAt(i, item.c); });
    mesh.castShadow = shadows; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  const floatingIsland = {x: -10, z: -84, rx: 7.7, rz: 7.7, h: 2.8, seed: 42};
  const floatingTerrain = new THREE.Mesh(makeTerrain(floatingIsland), ground); floatingTerrain.position.y = 13; floatingTerrain.receiveShadow = true; scene.add(floatingTerrain);
  tree(-10, 15.1, -84, 2.2);
  const nearGarden = new THREE.Mesh(makeTerrain({x:-19,z:24,rx:3.2,rz:3.2,h:1.6,seed:43}),ground);nearGarden.position.y=10;scene.add(nearGarden);tree(-19,10.8,24,.86);
  const canopyMesh=instances(leafGeometry, foliageMaterial, leaves, true);
  instances(new THREE.CylinderGeometry(.65, 1, 1, 7), new THREE.MeshStandardMaterial({color: 0x705236, roughness: 1}), trunks, true);
  const blade = new THREE.BufferGeometry(); blade.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .12, 1, .15], 3)); blade.computeVertexNormals();
  const grassMesh=instances(blade, new THREE.MeshStandardMaterial({color: 0x7abc2c, side: THREE.DoubleSide, roughness: 1}), grass);
  instances(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color: 0xffffff}), flowers);
  instances(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color: 0xb9c4b2, roughness: .93}), rocks, true);
  function mesh(geometry, material, position, parent = scene) { const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object; }
  mesh(new THREE.TorusGeometry(7.7, .25, 16, 128), white, [0, 7.3, 10]);
  mesh(new THREE.TorusGeometry(7.25, .07, 12, 128), silver, [0, 7.3, 10.15]);
  mesh(new THREE.TorusGeometry(7.65, .055, 8, 128), new THREE.MeshBasicMaterial({color: 0xc9ffff}), [0, 7.3, 10.29]);
  for (const x of [-6.4, 6.4]) mesh(new THREE.CylinderGeometry(.5, .9, 3, 20), white, [x, 1, 10]);
  function tower(x, z, h, radius) {
    const y = islandHeight(islands[1], x, z), group = new THREE.Group(); group.position.set(x, y, z); scene.add(group);
    mesh(new THREE.CylinderGeometry(radius * .76, radius, h, 40), blueGlass, [0, h / 2, 0], group);
    mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2), white, [0, h, 0], group).scale.set(radius * .77, 1.5, radius * .77);
    for (let floor = 0; floor < h; floor += 2.7) mesh(new THREE.CylinderGeometry(radius + .1 - floor / h * radius * .24, radius + .1 - floor / h * radius * .24, .12, 40), white, [0, floor, 0], group);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mesh(new THREE.CylinderGeometry(.055, .065, h, 5), white, [Math.cos(a) * radius * .9, h / 2, Math.sin(a) * radius * .9], group); }
    mesh(new THREE.CylinderGeometry(.018, .08, 5, 8), silver, [0, h + 2.5, 0], group);
    const terrace = mesh(new THREE.TorusGeometry(radius * 1.32, .12, 8, 48), white, [0, h * .3, 0], group); terrace.rotation.x = Math.PI / 2;
  }
  tower(29, -2, 29, 3.1); tower(36, 6, 20, 2.7); tower(23, -11, 17, 2.5);
  const bridgePath = new THREE.CatmullRomCurve3([new THREE.Vector3(-33, 9, -28), new THREE.Vector3(-18, 11, -38), new THREE.Vector3(0, 12, -41), new THREE.Vector3(17, 9, -49), new THREE.Vector3(29, 6, -55)]);
  const bridgeGeo = new THREE.BufferGeometry(), bridgeVertices = [], bridgeIndices = [];
  const up = new THREE.Vector3(0, 1, 0), tangent = new THREE.Vector3(), side = new THREE.Vector3(), railA = [], railB = [];
  for (let i = 0; i <= 100; i++) {
    const pos = bridgePath.getPoint(i / 100); tangent.copy(bridgePath.getTangent(i / 100)); side.crossVectors(tangent, up).normalize();
    for (const sign of [-1, 1]) { const edge = pos.clone().addScaledVector(side, sign * 1.5); bridgeVertices.push(edge.x, edge.y, edge.z); (sign === -1 ? railA : railB).push(edge.clone().add(new THREE.Vector3(0, .9, 0))); }
    if (i < 100) { const k = i * 2; bridgeIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    if (i % 8 === 0) for (const sign of [-1, 1]) mesh(new THREE.CylinderGeometry(.035, .035, .9, 5), silver, [pos.x + side.x * sign * 1.5, pos.y + .45, pos.z + side.z * sign * 1.5]);
  }
  bridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(bridgeVertices, 3)); bridgeGeo.setIndex(bridgeIndices); bridgeGeo.computeVertexNormals();
  const bridgeMaterial = white.clone(); bridgeMaterial.side = THREE.DoubleSide; mesh(bridgeGeo, bridgeMaterial, [0, 0, 0]);
  for (const rail of [railA, railB]) mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 100, .07, 6, false), white, [0, 0, 0]);
  const bubbleMat = bubbleMaterial(), sphereGeo = new THREE.SphereGeometry(1, 40, 28), bubbles = [];
  const terrarium = new THREE.Mesh(sphereGeo, bubbleMat); terrarium.position.set(-10, 24, -84); terrarium.scale.setScalar(14); scene.add(terrarium);
  const nearOrb = new THREE.Mesh(sphereGeo,bubbleMat);nearOrb.position.set(-19,14,24);nearOrb.scale.setScalar(5.8);scene.add(nearOrb);
  const cliffMaterial=new THREE.MeshStandardMaterial({color:0xd1d0b6,roughness:.95});
  for(const [x,y,z,r,h] of [[-10,10,-84,7.4,5.8],[-19,8.5,24,3.1,3]]){
    const cliffGeometry=new THREE.CylinderGeometry(r,r*.32,h,32,5);const vertices=cliffGeometry.attributes.position;
    for(let i=0;i<vertices.count;i++){const vx=vertices.getX(i),vy=vertices.getY(i),vz=vertices.getZ(i);const n=1+.055*Math.sin(vx*5+vz*3+vy);vertices.setXYZ(i,vx*n,vy,vz*n);}cliffGeometry.computeVertexNormals();mesh(cliffGeometry,cliffMaterial,[x,y,z]);
  }
  for (let i = 0; i < 23; i++) { const orb = new THREE.Mesh(sphereGeo, bubbleMat); const x = (random() - .5) * 85, z = 55 - random() * 190, y = 5 + random() * 29; orb.position.set(x, y, z); orb.scale.setScalar(.4 + random() * 2.4); scene.add(orb); bubbles.push({orb, x, y, z, phase: random() * TAU}); }
  const water = new Water(new THREE.PlaneGeometry(1600, 1600), {textureWidth: 512, textureHeight: 512, waterNormals: normalTexture(), sunDirection, sunColor: 0xfff9e5, waterColor: 0x00bfbd, distortionScale: 2.4, fog: true});
  water.rotation.x = -Math.PI / 2; water.position.y = 0; water.material.uniforms.size.value = 4; scene.add(water);
  water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;', 'float rf0 = 0.12;').replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;', 'vec3 scatter = (0.38 + 0.62 * max(0.0, dot(surfaceNormal, eyeDirection))) * waterColor;').replace('vec3 outgoingLight = albedo;', 'vec3 outgoingLight = albedo * vec3(.6,1.,1.1) + vec3(0.,.025,.03);');
  // Reflected foliage is blurred by ripples: keep its world transforms but
  // use a cheaper silhouette during that pass. The camera sees full detail.
  const reflectionLeaves=new THREE.IcosahedronGeometry(1,0),reflect=water.onBeforeRender;
  water.onBeforeRender=function(...args){
    canopyMesh.geometry=reflectionLeaves;grassMesh.visible=false;
    try{reflect.apply(this,args);}finally{canopyMesh.geometry=leafGeometry;grassMesh.visible=true;}
  };
  const waterfallMaterial = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {time: {value: 0}}, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `varying vec2 vUv;uniform float time;void main(){float streak=pow(.5+.5*sin(vUv.x*89.+sin(vUv.x*24.)*3.),3.);float drops=.7+.3*sin(vUv.y*70.+time*10.+vUv.x*18.);float edge=sin(vUv.x*3.14159);gl_FragColor=vec4(.78,.97,1.,(.14+streak*.65)*drops*edge);}`});
  for (const [x, z] of [[-16, -83], [-4, -84], [-10, -77]]) {
    const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(2, 13, 8, 24), waterfallMaterial); waterfall.position.set(x, 6.6, z); waterfall.rotation.y = Math.atan2(x + 10, z + 84); scene.add(waterfall);
    const splash = new THREE.Mesh(new THREE.RingGeometry(.2, 2.2, 40), new THREE.MeshBasicMaterial({color: 0xcfffff, transparent: true, opacity: .28, side: THREE.DoubleSide})); splash.rotation.x = -Math.PI / 2; splash.position.set(x, .025, z); scene.add(splash);
  }
  const clouds = new THREE.Group(), cloudMap = cloudTexture(random);
  for (let i = 0; i < 32; i++) { const cloud = new THREE.Sprite(new THREE.SpriteMaterial({map: cloudMap, transparent: true, opacity: .9, depthWrite: false, fog: false,toneMapped:false})); const a = i / 32 * TAU, radius = 200 + random() * 130; cloud.position.set(Math.cos(a) * radius, 45 + random() * 55, Math.sin(a) * radius - 45); const s = 65 + random() * 70; cloud.scale.set(s, s * .5, 1); clouds.add(cloud); } scene.add(clouds);
  const birds = [], wingGeometry = new THREE.BufferGeometry(); wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.3, .12, -.12, .4, 0, .32], 3)); wingGeometry.computeVertexNormals();
  const birdMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, side: THREE.DoubleSide});
  for (let i = 0; i < 11; i++) { const bird = new THREE.Group(), left = new THREE.Mesh(wingGeometry, birdMaterial), right = new THREE.Mesh(wingGeometry, birdMaterial); left.scale.x = -1; bird.add(left, right); bird.scale.setScalar(.38 + random() * .22); scene.add(bird); birds.push({bird, left, right, phase: random() * TAU, radius: 16 + random() * 23}); }
  renderer.shadowMap.needsUpdate = true;
  const cameraTarget = new THREE.Vector3(); let liveTime = 0, slow = 0, pixelRatio = Math.min(devicePixelRatio, 1.5), frames=0, sampleTime=0;
  function render(progress, pointer, dt, reducedMotion = false) {
    if (!reducedMotion) liveTime += dt;
    const time = liveTime * .38 + progress * 55, pos = cameraAt(progress), target = lookAt(progress);
    camera.position.set(pos.x, pos.y, pos.z); cameraTarget.set(target.x + pointer.x * .5, target.y + pointer.y * .3, target.z); camera.lookAt(cameraTarget);
    // FOV never changes. All forward motion is actual camera translation.
    vegetationTime.value = time; water.material.uniforms.time.value = time * .27; waterfallMaterial.uniforms.time.value = time;
    for (const b of bubbles) b.orb.position.set(b.x + Math.sin(time * .12 + b.phase) * .45, b.y + Math.sin(time * .23 + b.phase) * .65, b.z);
    for (const b of birds) { const a = b.phase + time * .035; b.bird.position.set(Math.cos(a) * b.radius, 18 + Math.sin(a * 2) * 3, -38 + Math.sin(a) * b.radius); b.bird.rotation.y = -a; b.left.rotation.z = Math.sin(time * 3 + b.phase) * .4; b.right.rotation.z = -b.left.rotation.z; }
    renderer.render(scene, camera);
    frames++;sampleTime+=dt;
    if(sampleTime>1){canvas.dataset.camera=camera.position.toArray().map(v=>v.toFixed(2)).join(',');canvas.dataset.fov=String(camera.fov);canvas.dataset.fps=String(Math.round(frames/sampleTime));canvas.dataset.objects=String(scene.children.length);canvas.dataset.triangles=String(renderer.info.render.triangles);frames=0;sampleTime=0;}
    if (dt > .03) slow++; else slow = Math.max(0, slow - 2);
    if (slow > 90 && pixelRatio > 1) { pixelRatio -= .25; renderer.setPixelRatio(pixelRatio); slow = 0; }
  }
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
  return {render, resize, renderer, scene, camera};
}
