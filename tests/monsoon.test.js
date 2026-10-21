import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt, lookAt, rollAt, routeLength, places } from '../src/monsoon/journey.js';
import { terrainHeight, basinRadius, mountainHeight, lake, terrainBounds } from '../src/monsoon/layout.js';
import { createTerrainGeometry } from '../src/monsoon/landscape.js';
import { buildShore, createConifer, createShrub } from '../src/monsoon/vegetation.js';
import { alpineElevations, terrainColumns, terrainRows } from '../src/monsoon/alpine-elevation.js';
import * as THREE from 'three';

const steps = 6000;
const flight = Array.from({ length: steps + 1 }, (_, i) => cameraAt(i / steps));
test('monsoon is a continuous, reversible flight through one basin at constant speed', () => {
  const advance = routeLength / steps;
  for (let i = 1; i <= steps; i++) {
    assert.ok(flight[i].toArray().every(Number.isFinite));
    assert.ok(Math.abs(flight[i].distanceTo(flight[i - 1]) / advance - 1) < .03);
  }
  for (let i = steps; i >= 0; i -= 19) assert.deepEqual(cameraAt(i / steps), flight[i]);
  assert.deepEqual(cameraAt(1), cameraAt(0));
  assert.ok(routeLength > 1100);
});
test('monsoon camera clears water, rocky shores and low hills throughout the route', () => {
  for (let i = 0; i <= steps; i++) {
    const p = flight[i], clearance = p.y - Math.max(0, terrainHeight(p.x, p.z));
    assert.ok(clearance > 2.5, `Terrain collision at ${i / steps}: ${clearance.toFixed(2)} metres`);
  }
});
test('monsoon view remains steady through every destination and the loop seam', () => {
  let previous;
  for (let i = 0; i <= steps + 1; i++) {
    const p = i / steps, gaze = lookAt(p).sub(cameraAt(p));
    assert.ok(gaze.length() > 20, `Subject crosses the camera at ${p}`); gaze.normalize();
    if (previous) assert.ok(previous.angleTo(gaze) < .025, `View snaps at ${p}`);
    assert.ok(Math.abs(rollAt(p)) <= .025); previous = gaze;
  }
});
test('monsoon explores a broad lake while keeping the mountain ahead throughout the loop', () => {
  assert.equal(places.length, 8); assert.equal(places[0].progress, 0);
  for (let i = 1; i < places.length; i++) assert.ok(places[i].progress > places[i - 1].progress);
  assert.ok(flight.some(p => p.x < -190)); assert.ok(flight.some(p => p.x > 290));
  assert.ok(flight.some(p => p.z < -420)); assert.ok(flight.some(p => p.y > 80));
  assert.ok(terrainHeight(lake.x, lake.z) < -20); assert.equal(basinRadius(lake.x, lake.z), 0);
  for (let i = 0; i <= steps; i += 10) assert.ok(lookAt(i / steps).z < flight[i].z - 100);
});
test('the high mountain is confined to the far shore, with only small hills beside the lake', () => {
  assert.ok(mountainHeight(-24, -890) > 600, 'The summit must dominate the lake');
  for (let x = -1000; x <= 1000; x += 25) for (let z = -440; z <= 600; z += 25) {
    assert.equal(mountainHeight(x, z), 0, 'No mountain wall may enclose either side of the lake');
    assert.ok(terrainHeight(x, z) < 50, `Side hill is too tall at ${x}, ${z}`);
  }
  assert.ok(terrainHeight(-180, -80) < 0 && terrainHeight(180, -80) < 0);
  assert.ok(terrainHeight(0, -340) < 0 && terrainHeight(0, 200) < 0);
  for (const p of flight) {
    assert.ok(Math.abs(p.x) < terrainBounds.width / 2);
    assert.ok(Math.abs(p.z - terrainBounds.centerZ) < terrainBounds.depth / 2);
  }
});

test('detailed mountain meshes retain valid surfaces, lake depth and flight clearance at every quality', () => {
  let previousVertices = Infinity;
  for (const profile of [{}, { mobile: true }, { mobile: true, low: true }]) {
    const { ground, surfaceHeight } = createTerrainGeometry(profile);
    try {
      const { position, normal, mountainHabitat, color } = ground.attributes;
      assert.ok(position.count < previousVertices && position.count < 650000, 'Quality must bound the mesh allocation');
      previousVertices = position.count;
      for (let i = 0; i < position.count; i += 37) {
        assert.ok(Number.isFinite(position.getY(i)));
        assert.ok(normal.getY(i) > 0, 'Triangles must face above the ground');
        assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < .00001);
        assert.ok(mountainHabitat.getX(i) >= 0 && mountainHabitat.getX(i) <= 1);
        assert.ok(Math.abs(mountainHabitat.getY(i)) <= 1);
        assert.ok(color.getY(i) >= .8 && color.getY(i) <= 1);
      }
      assert.ok(surfaceHeight(0, -80) < -20, 'Fine geometry must preserve the clear lake basin');
      for (let i = 0; i < steps; i += 7) {
        const p = flight[i];
        assert.ok(p.y - Math.max(0, surfaceHeight(p.x, p.z)) > 2.5, 'The actual triangles must clear the flight');
      }
      // Sample a real indexed triangle: shoreline placement must interpolate
      // exactly the surface that the GPU draws on the nonuniform grid.
      for (let i = 0; i < ground.index.count; i += 1221) {
        const a = ground.index.getX(i), b = ground.index.getX(i + 1), c = ground.index.getX(i + 2);
        const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
        const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
        const expected = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
        assert.ok(Math.abs(surfaceHeight(x, z) - expected) < .001, 'Stones must follow rendered triangles');
      }
    } finally { ground.dispose(); }
  }
});

test('the alpine landform retains the real elevation range and asymmetric drainage', () => {
  assert.equal(alpineElevations.length, terrainColumns * terrainRows);
  let minimum=Infinity,maximum=-Infinity;
  for(const value of alpineElevations){assert.ok(Number.isFinite(value));minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
  assert.ok(minimum>1800 && minimum<2400 && maximum>4300 && maximum<4600);
  let difference=0,samples=0;
  for(let x=50;x<550;x+=25)for(let z=-1250;z<-550;z+=25){difference+=Math.abs(mountainHeight(-24-x,z)-mountainHeight(-24+x,z));samples++;}
  assert.ok(difference/samples>35,'Real relief must retain its asymmetric walls and valleys');
});

test('shore deposits and alpine vegetation stay grounded, bounded and clear of the flight', () => {
  const scene=new THREE.Scene(),texture=new THREE.Texture();
  const {ground,surfaceHeight}=createTerrainGeometry({mobile:true});
  const shore=buildShore(scene,{rock:texture,rockNormal:texture,rockRough:texture},{mobile:true},surfaceHeight);
  try {
    assert.ok(shore.stoneCount>1000 && shore.stoneCount<5000);
    assert.ok(shore.vegetation.length>300 && shore.vegetation.length<=750);
    assert.equal(scene.children.filter(m=>m.name.startsWith('Glacial deposit')).length,10);
    for(const tree of shore.vegetation) {
      assert.ok(Math.abs(surfaceHeight(tree.x,tree.z)-tree.y)<.001);
      for(let i=0;i<steps;i+=20) {
        const p=flight[i];
        if(p.y>tree.y+tree.height+2)continue;
        assert.ok(Math.hypot(p.x-tree.x,p.z-tree.z)>tree.radius+3,'The camera must clear every planted crown');
      }
    }
    for(const mesh of scene.children) {
      assert.ok(mesh.count<=mesh.instanceMatrix.count);
      assert.ok(Number.isFinite(mesh.boundingSphere.radius));
    }
  } finally {
    ground.dispose();const materials=new Set();
    for(const mesh of scene.children){mesh.geometry.dispose();mesh.dispose();materials.add(mesh.material);}
    for(const material of materials)material.dispose();texture.dispose();
  }
});

test('spruce branches and willow leaves are finite three-dimensional meshes', () => {
  for(const geometry of [createConifer(72),createShrub(7301)]) {
    try {
      for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      assert.equal(geometry.attributes.color.count,geometry.attributes.position.count);
      assert.ok(geometry.boundingSphere.radius>0 && geometry.boundingSphere.radius<2);
      assert.ok(geometry.index.count<8000,'Each instanced plant must have a bounded geometry cost');
    }finally{geometry.dispose();}
  }
});
