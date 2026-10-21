import * as THREE from 'three';
import { smooth, rng, TAU, terrainHeight } from './layout.js';
import { mountainStone } from './materials.js';
import { alpineElevations, terrainColumns, terrainRows } from './alpine-elevation.js';

export const AUTUMN_SUN = [-.58, .62, .53];
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
export function groundNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) + (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
}
export function alpineHeight(x, z) {
  // Real glacial basins and broken ridgelines replace the repeated synthetic
  // cones. The DEM is bundled locally; no map service is contacted at runtime.
  const column = THREE.MathUtils.clamp((x + 1550) / 3100, 0, 1) * (terrainColumns - 1);
  const row = THREE.MathUtils.clamp((z + 2350) / 1800, 0, 1) * (terrainRows - 1);
  const left = Math.min(terrainColumns - 2, Math.floor(column)), top = Math.min(terrainRows - 2, Math.floor(row));
  const u = column - left, v = row - top, i = top * terrainColumns + left;
  const elevation = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(alpineElevations[i], alpineElevations[i + 1], u),
    THREE.MathUtils.lerp(alpineElevations[i + terrainColumns], alpineElevations[i + terrainColumns + 1], u), v);
  const mass = Math.max(0, elevation - 1330) * .345;
  const border = smooth(0, 450, 1550 - Math.abs(x)) * smooth(0, 220, z + 2350) * smooth(0, 260, -550 - z);
  // The regional DEM captures the cirques; metre-scale rock failures are below
  // its resolution. Nested broken ribs add actual relief without altering the
  // large surveyed shape or producing a row of identical pointed summits.
  const rib = 1 - Math.abs(groundNoise(x * .032, z * .027) * 2 - 1);
  const broken = 1 - Math.abs(groundNoise(x * .081 + 17, z * .068) * 2 - 1);
  const fractures = (rib - .62) * 16 + (broken - .62) * 5 + (groundNoise(x * .21, z * .17) - .5) * 2;
  return 6 + border * (mass + fractures * smooth(130, 380, mass));
}

export function createAlpineGeometry() {
  // Fixed geometry all along the flight; the visible ridges are real relief.
  const geometry = new THREE.PlaneGeometry(3100, 1800, 775, 450);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, -1450);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alpineHeight(p.getX(i), p.getZ(i)));
  // The distant range lies beyond the village's shadow camera. Bake its
  // terrain self-shadow once, using the same sun direction as the live scene,
  // instead of enlarging the shadow map and losing sharp nearby tree shadows.
  const colors = new Float32Array(p.count * 3), relief = new Float32Array(p.count), habitat = new Float32Array(p.count * 2), columns = 776, rows = 451, spacing = 4;
  const sample = (x, z) => {
    const column = THREE.MathUtils.clamp((x + 1550) / spacing, 0, columns - 1);
    const row = THREE.MathUtils.clamp((z + 2350) / spacing, 0, rows - 1);
    const left = Math.min(columns - 2, Math.floor(column)), top = Math.min(rows - 2, Math.floor(row));
    const u = column - left, v = row - top;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(p.getY(top * columns + left), p.getY(top * columns + left + 1), u),
      THREE.MathUtils.lerp(p.getY((top + 1) * columns + left), p.getY((top + 1) * columns + left + 1), u), v);
  };
  const horizontalSun = Math.hypot(AUTUMN_SUN[0], AUTUMN_SUN[2]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let obstruction = 0, shelter = 0;
    for (const distance of [10, 20, 35, 55, 85, 125, 180, 250, 340, 450]) {
      const rise = sample(x + AUTUMN_SUN[0] / horizontalSun * distance, z + AUTUMN_SUN[2] / horizontalSun * distance) - y;
      obstruction = Math.max(obstruction, (rise - AUTUMN_SUN[1] / horizontalSun * distance) / distance);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let horizon = 0;
      for (const distance of [15, 45, 120]) horizon = Math.max(horizon, (sample(x + dx * distance, z + dz * distance) - y) / distance);
      shelter += Math.atan(Math.max(0, horizon)) / (Math.PI * 2);
    }
    const shade = (1 - smooth(0, .13, obstruction) * .48) * (1 - shelter * .32);
    colors.set([shade * (1 - shelter * .04), shade, Math.min(1, shade * (1 + shelter * .05))], i * 3);
    // Concavity identifies gullies where snow and sediment collect. Exposed
    // ridges stay dark rock even at the same altitude as a neighbouring drift.
    const neighbourhood = (sample(x-12,z)+sample(x+12,z)+sample(x,z-12)+sample(x,z+12))*.25;
    relief[i] = THREE.MathUtils.clamp((neighbourhood-y)/5, -1, 1);
    const dx = (sample(x+24,z)-sample(x-24,z))/48, dz = (sample(x,z+24)-sample(x,z-24))/48;
    const hollow = (sample(x-32,z)+sample(x+32,z)+sample(x,z-32)+sample(x,z+32))*.25-y;
    habitat.set([1 / Math.hypot(dx,1,dz), THREE.MathUtils.clamp(hollow / 20, -1, 1)], i * 2);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('alpineCavity', new THREE.BufferAttribute(relief, 1));
  geometry.setAttribute('alpineHabitat', new THREE.BufferAttribute(habitat, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function buildAlpineRange(scene, maps) {
  const range = new THREE.Mesh(createAlpineGeometry(), mountainStone(maps));
  // Leave enough air between the lake and the massif to see its entire profile.
  range.position.z = -650;
  range.name = 'Surveyed alpine ridges, scree fans and snow-filled cirques'; scene.add(range);
  buildAlpineFoothills(scene, maps);
  buildAlpineForest(scene);
  return range;
}

function buildAlpineFoothills(scene, maps) {
  // A continuous apron joins the village terrain to the more distant massif.
  // The overlap at each end prevents sky gaps during the elevated lake orbit.
  const geometry = new THREE.PlaneGeometry(3100, 680, 155, 34);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0,0,-900);
  const p=geometry.attributes.position,uv=geometry.attributes.uv,colors=[];
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),t=smooth(-1200,-560,z);
    const hill=Math.sin(t*Math.PI)*(9+groundNoise(x*.006,z*.008)*32);
    p.setY(i,6*(1-t)+terrainHeight(x,z)*t+hill);
    uv.setXY(i,x*.065,z*.065);
    const shade=.65+groundNoise(x*.015,z*.012)*.35;colors.push(shade,shade,shade);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({map:maps.grass,normalMap:maps.grassNormal,normalScale:new THREE.Vector2(.3,.3),color:'#7e8b55',vertexColors:true,roughness:.96,envMapIntensity:.3});
  const apron=new THREE.Mesh(geometry,material);apron.name='Continuous low alpine foothills';scene.add(apron);
  // The high overlook sees beyond both sides of the narrow detailed valley.
  // Extend the same landform underneath it rather than leaving sky-colored
  // openings beneath the apron and the mountain perimeter.
  const surroundGeometry=new THREE.PlaneGeometry(6500,6500,160,160);
  surroundGeometry.rotateX(-Math.PI/2);surroundGeometry.translate(0,0,-700);
  const ground=surroundGeometry.attributes.position,groundUv=surroundGeometry.attributes.uv;
  for(let i=0;i<ground.count;i++) {
    const x=ground.getX(i),z=ground.getZ(i);
    const nearValley=(1-smooth(410,600,Math.abs(x)))*smooth(-700,-550,z)*(1-smooth(420,650,z));
    const lowHills=6+groundNoise(x*.003,z*.003)*24;
    const height=THREE.MathUtils.lerp(lowHills,terrainHeight(x,z)-12,nearValley);
    ground.setY(i,height);groundUv.setXY(i,x*.065,z*.065);
  }
  surroundGeometry.computeVertexNormals();
  const surroundMaterial=material.clone();surroundMaterial.vertexColors=false;
  const surround=new THREE.Mesh(surroundGeometry,surroundMaterial);surround.name='Unbroken ground beyond the valley';scene.add(surround);
}

function buildAlpineForest(scene) {
  // Dark, scattered conifers establish the scale of the lower grassy terraces.
  // These remain the same meshes at every distance and never enter the flight.
  const geometry = new THREE.ConeGeometry(1, 1, 7, 3);
  geometry.translate(0,.5,0);
  const p = geometry.attributes.position;
  for(let i=0;i<p.count;i++) {
    const y=p.getY(i),angle=Math.atan2(p.getZ(i),p.getX(i));
    const width=(.85+.15*Math.sin(angle*3.7+y*13.))*(1.+Math.sin(y*18.)*.12);
    p.setX(i,p.getX(i)*width); p.setZ(i,p.getZ(i)*width);
  }
  geometry.computeVertexNormals();
  const forest=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:'#89985f',roughness:.95,envMapIntensity:.45}),2300);
  const random=rng(81279),pose=new THREE.Object3D(),color=new THREE.Color();
  let count=0;
  for(let i=0;i<12500 && count<2300;i++) {
    const x=(random()-.5)*2300,z=-620-random()*1150,y=alpineHeight(x,z);
    const slope=1/Math.hypot((alpineHeight(x+8,z)-alpineHeight(x-8,z))/16,1,(alpineHeight(x,z+8)-alpineHeight(x,z-8))/16);
    const line=225+groundNoise(x*.009,z*.007)*105;
    if(y<35 || y>line || slope<.79 || groundNoise(x*.015,z*.016)<.48) continue;
    const height=5+random()*7;
    pose.position.set(x,y-1,z);pose.rotation.set(0,random()*TAU,0);pose.scale.set(height*.22,height,height*.22);pose.updateMatrix();
    forest.setMatrixAt(count,pose.matrix);
    color.setHSL(.22+random()*.035,.24+random()*.18,.15+random()*.11);forest.setColorAt(count++,color);
  }
  forest.count=count;forest.position.z=-650;forest.computeBoundingSphere();forest.name='Scattered conifers on the lower alpine terraces';scene.add(forest);
}
