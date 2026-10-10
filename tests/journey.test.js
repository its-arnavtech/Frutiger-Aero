import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt, lookAt, rollAt, routeLength, places } from '../src/journey.js';
import { DECK, ground, towers, towerRadius, towerTop, links, linkPoint, spheres, pods, footbridge, gate, basin, islands } from '../src/layout.js';

const STEPS = 6000;
const route = Array.from({ length: STEPS + 1 }, (_, i) => { const c = cameraAt(i / STEPS); return { p: i / STEPS, x: c.x, y: c.y, z: c.z }; });
const segmentDistance = (c, a, b) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.max(0, Math.min(1, ((c.x - a[0]) * ab[0] + (c.y - a[1]) * ab[1] + (c.z - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(c.x - a[0] - ab[0] * t, c.y - a[1] - ab[1] * t, c.z - a[2] - ab[2] * t);
};

test('the camera travels one continuous route at a constant speed', () => {
  const expected = routeLength / STEPS;
  for (let i = 1; i <= STEPS; i++) {
    const a = route[i - 1], b = route[i], distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    assert.ok([b.x, b.y, b.z].every(Number.isFinite));
    assert.ok(distance > expected * .97 && distance < expected * 1.03, `Speed changed at ${b.p}`);
  }
  assert.ok(routeLength > 1000, 'The flight should cover the whole city');
});

test('the route visits every district of the city', () => {
  const near = (x, z, reach) => route.some(c => Math.hypot(c.x - x, c.z - z) < reach);
  assert.ok(near(gate.x, gate.z, 3), 'passes through the gateway');
  assert.ok(near(basin.x + 30, basin.z, 12) && near(basin.x - 30, basin.z, 12), 'circles the basin');
  for (const island of islands.filter(i => !i.wild && !i.garden && i.rx > 15)) assert.ok(near(island.x, island.z, 95), `comes within sight of the island at ${island.x},${island.z}`);
  for (const quadrant of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(route.some(c => Math.sign(c.x) === quadrant[0] && Math.sign(c.z + 20) === quadrant[1] && Math.abs(c.x) > 40), `reaches quadrant ${quadrant}`);
});

test('the flight stays above the water, the quays and the gardens', () => {
  for (const c of route) {
    assert.ok(c.y > 3.6, `Too close to the water at ${c.p}`);
    const under = ground(c.x, c.z);
    if (under.kind === 'deck' || under.kind === 'kerb') assert.ok(c.y > DECK + 7, `Skims the promenade trees at ${c.p}`);
    if (under.kind === 'lawn' || under.kind === 'island') assert.ok(c.y > under.y + 13, `Clips the tree tops at ${c.p}`);
  }
});

test('the flight clears every tower, bridge, sphere and pod', () => {
  for (const c of route) {
    for (const tower of towers) {
      if (c.y > towerTop(tower) + 16) continue;
      const shell = Math.max(towerRadius(tower, c.y - 2), towerRadius(tower, c.y), towerRadius(tower, c.y + 2));
      assert.ok(Math.hypot(c.x - tower.x, c.z - tower.z) > shell + 4, `Tower ${tower.kind} at ${tower.x.toFixed(0)},${tower.z.toFixed(0)} is too close at ${c.p}`);
    }
    for (const link of links) for (let k = 0; k < 1; k += .05) assert.ok(segmentDistance(c, linkPoint(link, k), linkPoint(link, k + .05)) > 5, `Sky bridge too close at ${c.p}`);
    for (const s of spheres) assert.ok(Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z) > s.r + 4, `Sphere too close at ${c.p}`);
    for (const pod of pods) {
      assert.ok(Math.hypot(c.x - pod.x, c.y - DECK - pod.height, c.z - pod.z) > pod.radius + 3, `Pod too close at ${c.p}`);
      if (c.y < DECK + pod.height) assert.ok(Math.hypot(c.x - pod.x, c.z - pod.z) > 3, `Pod stalk too close at ${c.p}`);
    }
    for (let i = 1; i < footbridge.length; i++) assert.ok(segmentDistance(c, footbridge[i - 1], footbridge[i]) > 4.5, `Footbridge too close at ${c.p}`);
    // The gateway is a hoop: pass cleanly through its middle or well outside it.
    if (Math.abs(c.z - gate.z) < 1.2) { const d = Math.hypot(c.x - gate.x, c.y - gate.y); assert.ok(d < gate.radius - 3 || d > gate.radius + 4, `Gateway rim too close at ${c.p}`); }
  }
});

test('the camera always has a steady subject and a gentle bank', () => {
  let previous = null;
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS, c = route[i], target = lookAt(p), gaze = [target.x - c.x, target.y - c.y, target.z - c.z], length = Math.hypot(...gaze);
    assert.ok(length > 8, `Subject too close to the camera at ${p}`);
    assert.ok(Math.abs(rollAt(p)) <= .13);
    const direction = gaze.map(v => v / length);
    if (previous) assert.ok(Math.acos(Math.min(1, direction[0] * previous[0] + direction[1] * previous[1] + direction[2] * previous[2])) < .02, `View snaps at ${p}`);
    previous = direction;
  }
});

test('reverse scrolling follows exactly the same spatial route', () => {
  const forward = Array.from({ length: 101 }, (_, i) => cameraAt(i / 100).asArray());
  for (let i = 100; i >= 0; i--) assert.deepEqual(cameraAt(i / 100).asArray(), forward[i]);
  assert.deepEqual(cameraAt(-1), cameraAt(0));
  assert.deepEqual(cameraAt(2), cameraAt(1));
});

test('named places are in order along the journey', () => {
  assert.ok(places.length >= 5);
  for (let i = 1; i < places.length; i++) assert.ok(places[i].progress > places[i - 1].progress);
  assert.equal(places[0].progress, 0); assert.equal(places.at(-1).progress, 1);
});
