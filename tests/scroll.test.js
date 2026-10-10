import test from 'node:test';
import assert from 'node:assert/strict';
import { createScroller, wheelPixels } from '../src/scroll.js';

const NOTCH = 4.5;   // metres per wheel notch, as the page maps it

// Plays a stream of wheel notches into a scroller while stepping it at a given
// frame rate, and records every frame. `notchesPerSecond` may vary with time.
function fly({ notchesPerSecond, seconds, hz = 60, direction = 1, scroller = createScroller(), from = 0 }) {
  const frames = [], dt = 1 / hz;
  let due = from, t = from;
  for (let frame = 0; frame < Math.round(seconds * hz); frame++) {
    const end = t + dt;
    while (due < end) {
      const speed = notchesPerSecond(due - from);
      if (speed <= 0) { due = end; break; }
      scroller.push(direction * NOTCH, due); due += 1 / speed;
    }
    t = end; scroller.step(dt);
    frames.push({ t: t - from, position: scroller.position, velocity: scroller.velocity });
  }
  return { frames, scroller, end: t };
}

test('gentle scrolling moves in proportion to the wheel', () => {
  for (const rate of [1, 2, 4]) {
    const { scroller } = fly({ notchesPerSecond: () => rate, seconds: 6 });
    const asked = rate * NOTCH * 6;
    assert.ok(scroller.position > asked * .9 && scroller.position <= asked, `${rate} notches a second flew ${scroller.position.toFixed(1)} of ${asked} m`);
  }
});

// How unsteady the speed is over the last `seconds` of a run: 0 is perfectly even.
function ripple(frames, hz, seconds) {
  const speeds = frames.slice(-Math.round(seconds * hz)).map(f => f.velocity), mean = speeds.reduce((a, b) => a + b) / speeds.length;
  return (Math.max(...speeds) - Math.min(...speeds)) / mean;
}

test('steady notches become a steady glide, not a string of lurches', () => {
  for (const rate of [3, 5, 8, 15]) {
    const { frames } = fly({ notchesPerSecond: () => rate, seconds: 6, hz: 120 });
    assert.ok(ripple(frames, 120, 2) < .12, `${rate} notches a second surged by ${(ripple(frames, 120, 2) * 100).toFixed(0)}%`);
  }
});

test('uneven notches are still smoothed', () => {
  // A hand never turns a wheel evenly: gaps here vary by a quarter either way.
  let seed = 7; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const scroller = createScroller(), frames = [];
  let due = 0;
  for (let i = 0; i < 6 * 120; i++) {
    const end = (i + 1) / 120;
    while (due < end) { scroller.push(NOTCH, due); due += (.75 + .5 * random()) / 5; }
    scroller.step(1 / 120); frames.push({ velocity: scroller.velocity });
  }
  assert.ok(ripple(frames, 120, 3) < .45, `surged by ${(ripple(frames, 120, 3) * 100).toFixed(0)}%`);
});

test('one notch is one smooth move with no overshoot', () => {
  const scroller = createScroller(), frames = [];
  scroller.push(NOTCH, 0);
  for (let i = 1; i <= 180; i++) { scroller.step(1 / 120); frames.push({ t: i / 120, position: scroller.position, velocity: scroller.velocity }); }
  assert.ok(frames.find(f => f.position > NOTCH * .9).t < .65, 'done in about half a second');
  assert.ok(frames[5].velocity > 1, 'and under way at once');
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i].position >= frames[i - 1].position - 1e-9, 'never moves backwards');
  assert.ok(frames.at(-1).position > NOTCH * .97 && frames.at(-1).position <= NOTCH + 1e-9);
  // Speed rises and falls once: the notch is not felt as a jolt.
  const speeds = frames.map(f => f.velocity), peak = speeds.indexOf(Math.max(...speeds));
  for (let i = 1; i < speeds.length; i++) assert.ok(i <= peak ? speeds[i] >= speeds[i - 1] - 1e-9 : speeds[i] <= speeds[i - 1] + 1e-9, 'a single swell of speed');
});

test('a free-spinning wheel levels off at a top speed and never runs away', () => {
  for (const rate of [40, 100, 400]) {
    const scroller = createScroller(), { frames } = fly({ scroller, notchesPerSecond: () => rate, seconds: 5 });
    const fastest = Math.max(...frames.map(f => f.velocity));
    assert.ok(fastest < scroller.topSpeed * 1.16, `${rate} notches a second reached ${fastest.toFixed(0)} m/s`);
    const glide = frames.at(-1).velocity;
    assert.ok(glide > scroller.topSpeed * .8 && glide < scroller.topSpeed * 1.02, `${rate} notches a second settled at ${glide.toFixed(0)} m/s`);
    assert.ok(ripple(frames, 60, 2) < .07, 'and holds it evenly');
  }
  // Spinning harder is always at least as fast.
  const cruise = rate => fly({ notchesPerSecond: () => rate, seconds: 4 }).frames.at(-1).velocity;
  for (const [slower, faster] of [[2, 5], [5, 12], [12, 30], [30, 90]]) assert.ok(cruise(faster) > cruise(slower));
});

test('stopping the wheel stops the flight, with nothing banked', () => {
  const scroller = createScroller(), spin = fly({ scroller, notchesPerSecond: () => 300, seconds: 4 });
  const at = scroller.position, coast = fly({ scroller, notchesPerSecond: () => 0, seconds: 1.2, from: spin.end });
  const settled = coast.frames.find(f => Math.abs(f.velocity) < 1);
  assert.ok(settled && settled.t < .65, `still moving after ${settled?.t.toFixed(2)} s`);
  assert.ok(scroller.position - at < scroller.reach * 1.25, `coasted ${(scroller.position - at).toFixed(1)} m after the wheel stopped`);
  for (let i = 1; i < coast.frames.length; i++) assert.ok(coast.frames[i].velocity <= coast.frames[i - 1].velocity + 1e-9 && coast.frames[i].velocity > -1e-6, 'slows steadily to rest');
});

test('a wheel spinning down is followed all the way to rest', () => {
  // A flick that decays over eight seconds, as a free wheel does on its own.
  const { frames } = fly({ notchesPerSecond: t => 120 * Math.exp(-t / 1.6) - .5, seconds: 12, hz: 120 });
  const speeds = frames.map(f => f.velocity);
  // While it is still turning at any pace, speed only ever eases down.
  for (let i = 120; frames[i].t < 5.2; i++) assert.ok(speeds[i] <= speeds[i - 60] + 3, `sped up at ${frames[i].t.toFixed(2)} s`);
  // Speed never steps from one frame to the next, and the last few notches,
  // though spaced out, arrive gently.
  for (let i = 1; i < speeds.length; i++) assert.ok(Math.abs(speeds[i] - speeds[i - 1]) < (frames[i].t > 5 ? 2 : 30), `a jolt at ${frames[i].t.toFixed(2)} s`);
  assert.ok(Math.abs(speeds.at(-1)) < .2);
});

test('reversing answers at once', () => {
  const scroller = createScroller(), forward = fly({ scroller, notchesPerSecond: () => 20, seconds: 2 });
  const back = fly({ scroller, notchesPerSecond: () => 20, seconds: 1, direction: -1, from: forward.end });
  assert.ok(back.frames.find(f => f.velocity < 0).t < .25, 'turns round within a quarter of a second');
  assert.ok(back.frames.at(-1).velocity < -40);
});

test('the flight is the same at any frame rate', () => {
  const run = hz => fly({ notchesPerSecond: t => t < 2.5 ? 30 : 0, seconds: 4, hz }).scroller.position;
  const reference = run(60);
  for (const hz of [24, 30, 75, 120, 144, 240]) assert.ok(Math.abs(run(hz) - reference) < reference * .012, `${hz} Hz ended ${(run(hz) - reference).toFixed(2)} m from 60 Hz`);
  // A stalled frame costs time, never position: the next frame catches up exactly.
  const smooth = createScroller(), stalled = createScroller();
  for (const s of [smooth, stalled]) s.push(NOTCH * 4, 0);
  for (let i = 0; i < 30; i++) smooth.step(1 / 60);
  stalled.step(.25); stalled.step(.25);
  assert.ok(Math.abs(smooth.position - stalled.position) < 1e-6 && Math.abs(smooth.velocity - stalled.velocity) < 1e-6);
});

test('it has no end in either direction', () => {
  const forward = fly({ notchesPerSecond: () => 200, seconds: 120 }).scroller.position;
  const backward = fly({ notchesPerSecond: () => 200, seconds: 120, direction: -1 }).scroller.position;
  assert.ok(forward > 7000 && Math.abs(forward + backward) < 1e-6, 'many laps each way, and symmetrical');
});

test('seeking arrives exactly, in good time, and gives way to the wheel', () => {
  const scroller = createScroller();
  scroller.seek(700, 1.8);
  let t = 0, fastest = 0;
  while (scroller.seeking && t < 6) { scroller.step(1 / 60); t += 1 / 60; fastest = Math.max(fastest, scroller.velocity); }
  assert.equal(scroller.position, 700); assert.ok(t < 3.2, `took ${t.toFixed(2)} s`); assert.ok(fastest > scroller.topSpeed);
  scroller.seek(0, 1.8); for (let i = 0; i < 20; i++) scroller.step(1 / 60);
  scroller.push(-NOTCH, 10);
  assert.equal(scroller.seeking, false);
  for (let i = 0; i < 120; i++) scroller.step(1 / 60);
  assert.ok(scroller.position > 300, 'a touch of the wheel cancels the trip where it is');
});

test('hands-free playback holds a steady speed', () => {
  const scroller = createScroller(); scroller.cruise(7.4);
  for (let i = 0; i < 600; i++) scroller.step(1 / 60);
  const before = scroller.position; scroller.step(1 / 60);
  assert.ok(Math.abs((scroller.position - before) * 60 - 7.4) < 1e-6, 'every frame advances by exactly the same amount');
});

test('reduced motion moves without easing', () => {
  const scroller = createScroller(); scroller.push(NOTCH, 0); scroller.step(1 / 60, true);
  assert.ok(Math.abs(scroller.position - NOTCH) < .15 && scroller.velocity === 0);
});

test('every kind of wheel report means the same notch', () => {
  assert.equal(wheelPixels({ deltaX: 0, deltaY: 100, deltaMode: 0 }), 100);
  assert.equal(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }), 100);
  assert.equal(wheelPixels({ deltaX: 0, deltaY: -1, deltaMode: 2 }, 900), -900);
  assert.equal(wheelPixels({ deltaX: -120, deltaY: 0, deltaMode: 0 }), -120, 'a tilted or shifted wheel counts too');
});
