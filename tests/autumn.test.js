import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt, lookAt, rollAt, routeLength, places } from '../src/autumn/journey.js';
import { terrainHeight, cabins, bridge, riverX, island } from '../src/autumn/layout.js';
import { forestPlacements } from '../src/autumn/planting.js';

const steps = 6000;
const flight = Array.from({ length: steps + 1 }, (_, i) => cameraAt(i / steps));

test('autumn flight is continuous, reversible and constant speed, including its seam', () => {
  const distance = routeLength / steps;
  for (let i = 1; i <= steps; i++) {
    const advance = flight[i].distanceTo(flight[i - 1]);
    assert.ok(advance > distance * .97 && advance < distance * 1.03, `Speed changes at ${i / steps}`);
    assert.ok(flight[i].toArray().every(Number.isFinite));
  }
  for (let i = steps; i >= 0; i -= 17) assert.deepEqual(cameraAt(i / steps), flight[i]);
  assert.deepEqual(cameraAt(1), cameraAt(0));
  assert.ok(routeLength > 1000, 'A kilometre-long journey through one world');
});

test('autumn flight clears the terrain, village roofs and bridge', () => {
  let beneathBridge = false;
  for (const c of flight) {
    assert.ok(c.y - Math.max(0, terrainHeight(c.x, c.z)) > 3.8, 'Camera clips ground or water');
    for (const cabin of cabins) {
      const horizontal = Math.max(0, Math.hypot(c.x - cabin.x, c.z - cabin.z) - 7.2 * cabin.scale);
      const vertical = Math.max(0, c.y - terrainHeight(cabin.x, cabin.z) - 12 * cabin.scale);
      assert.ok(Math.hypot(horizontal, vertical) > 8, 'Camera clips a lodge');
    }
    if (Math.abs(c.z - bridge.z) < 3 && Math.abs(c.x - riverX(bridge.z)) < bridge.half) {
      const x = c.x - riverX(bridge.z), deck = 5.8 + 6.2 * (1 - (x / bridge.half) ** 2);
      assert.ok(Math.abs(c.y - deck) > 4, 'Camera clips the arch');
      if (c.y < deck) beneathBridge = true;
    }
  }
  assert.ok(beneathBridge, 'Journey passes under the lantern bridge');
});

test('the entire autumn forest remains clear of the flight, including the island maple', () => {
  const trees = forestPlacements();
  assert.ok(trees.length > 900);
  assert.equal(trees.filter(t => t.species === 3).length, 1);
  for (const tree of trees) {
    assert.ok(terrainHeight(tree.x, tree.z) > 1.3, 'A tree is growing in the river');
    for (const c of flight) {
      const horizontal = Math.max(0, Math.hypot(c.x - tree.x, c.z - tree.z) - (tree.radius ?? tree.height * .42));
      const vertical = Math.max(0, c.y - tree.y - tree.height);
      assert.ok(Math.hypot(horizontal, vertical) > 4, `Camera clips tree ${tree.x},${tree.z}`);
    }
  }
});

test('the autumn view stays steady and looks at a subject ahead of the camera', () => {
  let previous;
  for (let i = 0; i <= steps + 1; i++) {
    const p = i / steps, gaze = lookAt(p).sub(cameraAt(p));
    assert.ok(gaze.length() > 15, `Look target crosses camera at ${p}`);
    gaze.normalize();
    if (previous) assert.ok(previous.angleTo(gaze) < .025, `View snaps at ${p}`);
    assert.ok(Math.abs(rollAt(p)) <= .045);
    previous = gaze;
  }
});

test('autumn waypoints explore the river, circle the maple and rise above the forest', () => {
  assert.equal(places.length, 8);
  assert.equal(places[0].progress, 0);
  for (let i = 1; i < places.length; i++) assert.ok(places[i].progress > places[i - 1].progress);
  const orbit = flight.filter(c => c.z < -105 && Math.hypot(c.x - island.x, c.z - island.z) < 65);
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    assert.ok(orbit.some(c => Math.sign(c.x - island.x) === x && Math.sign(c.z - island.z) === z), `Missing island quadrant ${x},${z}`);
  }
  assert.ok(flight.some(c => c.y > 95), 'The overlook should reveal the valley');
});
