import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt, lookAt, rollAt, routeLength, places } from '../src/monsoon/journey.js';
import { terrainHeight, basinRadius } from '../src/monsoon/layout.js';

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
test('monsoon camera clears water, rocky shores and cirque walls throughout the route', () => {
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
test('monsoon explores submerged stones, both walls, waterfalls, snowline and the overlook', () => {
  assert.equal(places.length, 8); assert.equal(places[0].progress, 0);
  for (let i = 1; i < places.length; i++) assert.ok(places[i].progress > places[i - 1].progress);
  assert.ok(flight.some(p => p.x < -110)); assert.ok(flight.some(p => p.x > 175));
  assert.ok(flight.some(p => p.z < -235)); assert.ok(flight.some(p => p.y > 115));
  assert.ok(terrainHeight(0, -45) < -10); assert.ok(basinRadius(0, -45) < .01);
});
