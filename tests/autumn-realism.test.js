import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { terrainHeight, millRace, cabins } from '../src/autumn/layout.js';
import { alpineHeight, createAlpineGeometry } from '../src/autumn/geology.js';
import { cameraAt } from '../src/autumn/journey.js';
import { buildCottage } from '../src/autumn/cottage.js';
import { buildWatermill } from '../src/autumn/mill.js';
import { createBatcher } from '../src/build.js';
import { buildTerrain } from '../src/autumn/landscape.js';
import { createRiverStone, createMeadowTuft } from '../src/autumn/ground-details.js';

test('the mill has a downhill supply and an uninterrupted submerged outlet into the river', () => {
  for (let i = 1; i < millRace.feed.length; i++) assert.ok(millRace.feed[i][1] < millRace.feed[i - 1][1]);
  assert.ok(millRace.lip[1] > millRace.wheel[1] + millRace.radius);
  assert.ok(terrainHeight(millRace.lip[0], millRace.lip[2]) < 0, 'The falling water must land in the pool');
  for (let i = 0; i <= 100; i++) {
    const x = millRace.wheel[0] + (millRace.outlet[0] - millRace.wheel[0]) * i / 100;
    assert.ok(terrainHeight(x, millRace.outlet[2]) < 0, `Dry interruption in the tailrace at ${x}`);
  }
  const feed = new THREE.CatmullRomCurve3(millRace.feed.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const pipe = Array.from({ length: 80 }, (_, i) => feed.getPoint(i / 79));
  for (let i = 0; i < 1200; i++) for (const p of pipe) assert.ok(cameraAt(i / 1200).distanceTo(p) > 4, 'The supply flume clips the flight');
});

test('modeled mill water reaches the paddles and flows downward all the way into the pool', () => {
  const finishes = Object.fromEntries(['wood', 'pale', 'metal', 'stone'].map(key => [key, { material: new THREE.MeshBasicMaterial() }]));
  const scene = new THREE.Scene(), mill = buildWatermill(scene, finishes);
  const trough = scene.getObjectByName('Downhill water in the supply flume');
  const fall = scene.getObjectByName('Water crossing the paddles into the pool');
  const rows = (mesh, width) => {
    const { position, uv } = mesh.geometry.attributes, samples = [];
    for (let i = 0; i < position.count; i += width) {
      const centre = new THREE.Vector3();
      for (let j = 0; j < width; j++) centre.add(new THREE.Vector3().fromBufferAttribute(position, i + j));
      samples.push({ centre: centre.divideScalar(width), distance: uv.getY(i) });
    }
    return samples;
  };
  const supply = rows(trough, 2), falling = rows(fall, 6);
  assert.ok(supply.at(-1).centre.distanceTo(falling[0].centre) < .001, 'There is a gap at the flume lip');
  for (const stream of [supply, falling]) for (let i = 1; i < stream.length; i++) {
    assert.ok(stream[i].centre.y < stream[i - 1].centre.y, 'Water travels uphill');
    assert.ok(stream[i].distance > stream[i - 1].distance, 'Texture flow reverses direction on the waterfall');
  }
  assert.ok(falling.some(({ centre: p }) => p.y > millRace.wheel[1] && Math.abs(Math.hypot(p.y - millRace.wheel[1], p.z - millRace.wheel[2]) - millRace.radius) < .2), 'Water misses the upper wheel paddles');
  const landing = falling.at(-1).centre;
  assert.ok(landing.y > 0 && landing.y < .1 && terrainHeight(landing.x, landing.z) < 0, 'Water does not meet the pool');
  assert.equal(trough.material, fall.material, 'The streams must share their animation clock');
  mill.update(12); assert.equal(fall.material.uniforms.time.value, 12);
  const front = scene.getObjectByName('Visible water spilling over the front paddle edges');
  const outflow = scene.getObjectByName('Visible current from the wheel to the river');
  assert.ok(front && outflow, 'The water must be visible from the wheel face and continue to the river');
  assert.equal(outflow.material.uniforms.time, fall.material.uniforms.time, 'Tailrace animation must continue with the falling water');
  for (const { centre } of rows(outflow, 9)) {
    assert.ok(terrainHeight(centre.x, centre.z) < centre.y - .1, 'The downstream current intersects dry ground');
  }
  // The earlier flat water sheet was edge-on from the actual village camera.
  const camera = new THREE.PerspectiveCamera(58, 1.6, .1, 4400);
  camera.position.copy(cameraAt(.165)); camera.lookAt(...millRace.wheel); camera.updateMatrixWorld();
  let visibleRows = 0;
  const vertices = front.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 5) {
    const left = new THREE.Vector3().fromBufferAttribute(vertices, i).project(camera);
    const right = new THREE.Vector3().fromBufferAttribute(vertices, i + 4).project(camera);
    if (Math.abs(left.x - right.x) * 1440 / 2 > 5) visibleRows++;
  }
  assert.ok(visibleRows > 40, 'The water edge has become too thin to see along the flight');
  const resources = new Set();
  scene.traverse(o => { o.geometry?.dispose(); if (o.material) resources.add(o.material); });
  resources.forEach(m => m.dispose());
});

test('the rendered terrain leaves the narrow millrace open, including between grid vertices', () => {
  const maps = Object.fromEntries(['leafGround','grassNormal','leafRough','grass','alpine','rock'].map(name => [name, null]));
  const scene = new THREE.Scene(), ground = buildTerrain(scene, maps);
  ground.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let x = -30; x < -8; x += .31) {
    ray.ray.origin.set(x, 30, -5);
    const hit = ray.intersectObject(ground)[0];
    assert.ok(hit && hit.point.y < -.4, `Ground triangles obstruct the stream at ${x}`);
  }
  const resources = new Set();
  scene.traverse(o => { o.geometry?.dispose(); if (o.material) resources.add(o.material); });
  resources.forEach(m => m.dispose());
});

test('shoreline stones have distinct eroded silhouettes and meadow blades are small curved ribbons', () => {
  const shapes = [];
  for (let i = 0; i < 7; i++) {
    const stone = createRiverStone(916 + i * 137);
    stone.computeBoundingBox(); shapes.push(stone.boundingBox.getSize(new THREE.Vector3()).toArray().map(n => n.toFixed(3)).join(','));
    const p = stone.attributes.position, n = stone.attributes.normal;
    assert.ok(p.count > 200 && stone.index.count > 1000);
    for (let v = 0; v < p.count; v++) {
      assert.ok(Number.isFinite(p.getX(v) + p.getY(v) + p.getZ(v)));
      assert.ok(Math.abs(Math.hypot(n.getX(v), n.getY(v), n.getZ(v)) - 1) < .001);
    }
    stone.dispose();
  }
  assert.equal(new Set(shapes).size, 7, 'All rocks have the same silhouette');
  const grass = createMeadowTuft(7151); grass.computeBoundingBox();
  assert.ok(grass.boundingBox.max.y < .51 && grass.boundingBox.max.y > .3);
  const p = grass.attributes.position;
  for (let i = 0; i < p.count; i += 8) {
    assert.ok(p.getY(i + 4) > p.getY(i + 2), 'A blade folds into the ground');
    assert.ok(Math.hypot(p.getX(i + 6) - p.getX(i), p.getZ(i + 6) - p.getZ(i)) > .05, 'A blade is a rigid straight spike');
  }
  grass.dispose();
});

test('all cottage windows, including the upper sanctuary, are real openings in the plaster', () => {
  const keys = ['wood', 'pale', 'plaster', 'stone', 'interior', 'curtain', 'glass', 'metal', 'roof', 'copper', 'shingles', 'shinglesLight', 'shinglesDark'];
  for (const cabin of [cabins[0], cabins.find(c => c.temple)]) {
    const finishes = Object.fromEntries(keys.map(key => [key, { material: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }) }]));
    const batch = createBatcher(finishes), group = new THREE.Group();
    const { windows } = buildCottage(cabin, batch, () => {}), meshes = batch.build(group, 'Test cottage');
    group.updateMatrixWorld(true);
    assert.equal(windows.length, cabin.temple ? 14 : 8);
    for (const { centre, normal } of windows) {
      const ray = new THREE.Raycaster(centre.clone().addScaledVector(normal, .5), normal.clone().negate(), 0, 1.1);
      assert.equal(ray.intersectObject(meshes.plaster).length, 0, 'Solid plaster blocks a window opening');
    }
    group.traverse(o => o.geometry?.dispose()); Object.values(finishes).forEach(f => f.material.dispose());
  }
});

test('the alpine backdrop has substantial relief and stays beyond the entire flight', () => {
  assert.ok(alpineHeight(20, -1160) > 650);
  const samples = [];
  for (let x = -600; x <= 600; x += 30) samples.push(alpineHeight(x, -1110));
  assert.ok(samples.every(Number.isFinite)); assert.ok(Math.max(...samples) - Math.min(...samples) > 400);
  for (let i = 0; i < 1200; i++) assert.ok(cameraAt(i / 1200).z > -500);
});

test('the actual mountain mesh contains relief, valid normals and baked gully shading', () => {
  const geometry = createAlpineGeometry(), { position, normal, color, alpineCavity } = geometry.attributes;
  let darkest = 1, lightest = 0, highest = 0;
  let gullies = 0, ridges = 0;
  for (let i = 0; i < position.count; i++) {
    highest = Math.max(highest, position.getY(i));
    const shade = color.getY(i); darkest = Math.min(darkest, shade); lightest = Math.max(lightest, shade);
    assert.ok(Number.isFinite(shade) && shade >= .3 && shade <= 1);
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    assert.ok(Math.abs(length - 1) < .001, 'Invalid surface lighting normal');
    const cavity=alpineCavity.getX(i);
    assert.ok(Number.isFinite(cavity) && cavity>=-1 && cavity<=1);
    if(position.getY(i)>350 && cavity>.2) gullies++;
    if(position.getY(i)>350 && cavity<-.2) ridges++;
    if (i % 137 === 0) assert.ok(Math.abs(position.getY(i) - alpineHeight(position.getX(i), position.getZ(i))) < .001, 'Mesh and terrain definition disagree');
  }
  assert.ok(highest > 650 && lightest - darkest > .35, 'The range has lost its summit or shaded gullies');
  assert.ok(gullies>100 && ridges>100, 'The alpine mesh needs exposed ridges and recessed snow-catching gullies');
  geometry.dispose();
});
