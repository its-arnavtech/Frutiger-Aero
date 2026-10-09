import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt, lookAt, routeLength, islands, islandHeight } from '../src/journey.js';

test('the camera travels a continuous, approximately constant-speed route through the world', () => {
  const steps = 10000, expectedStep = routeLength / steps;
  let previous = cameraAt(0);
  for (let i = 1; i <= steps; i++) {
    const position = cameraAt(i / steps), distance = position.subtract(previous).length();
    assert.ok([position.x, position.y, position.z].every(Number.isFinite));
    assert.ok(distance > expectedStep * .99 && distance < expectedStep * 1.01, `Speed changed at ${i / steps}`);
    previous = position;
  }
  assert.ok(routeLength > 300, 'The camera must physically traverse the archipelago');
});

test('camera clears the islands and terrarium and always has a valid look direction', () => {
  for (let i = 0; i <= 2000; i++) {
    const p = i / 2000, camera = cameraAt(p), target = lookAt(p);
    for (const island of islands) assert.ok(camera.y - islandHeight(island, camera.x, camera.z) > 2, `Terrain collision at ${p}`);
    assert.ok(Math.hypot(camera.x + 10, camera.y - 24, camera.z + 84) > 15, `Terrarium collision at ${p}`);
    assert.ok(target.subtract(camera).length() > 2, `Degenerate camera direction at ${p}`);
  }
});

test('reverse scrolling follows exactly the same spatial route', () => {
  const forward = Array.from({length:101}, (_, i) => cameraAt(i / 100).asArray());
  for(let i=100;i>=0;i--) assert.deepEqual(cameraAt(i/100).asArray(),forward[i]);
  assert.deepEqual(cameraAt(-1), cameraAt(0));
  assert.deepEqual(cameraAt(2), cameraAt(1));
});
