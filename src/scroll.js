// Turns wheel, touch and key input into the distance flown along the route, in
// metres. It has no end in either direction: the route is a loop, and this
// simply keeps counting.
//
// It is built around a free-spinning wheel, which can send a hundred notches a
// second for many seconds, coast down on its own, or be stopped dead with a
// finger:
//  - how hard the wheel is spinning sets how fast the flight goes, in proportion
//    at ordinary speeds and levelling off toward a top speed, so a hard flick
//    is a fast, legible glide rather than a blur;
//  - a wheel reports in separate notches, so each one is paid out over a little
//    longer than the usual gap between them: a steady or slowing wheel becomes
//    a steady or slowing glide, not a string of lurches, even though no hand
//    turns a wheel evenly;
//  - no input is banked beyond the notch in hand, so when the wheel stops the
//    flight stops with it, within a fraction of a second;
//  - position follows on a critically damped spring, which rounds off what is
//    left into one continuous movement with no overshoot.
export function createScroller({
  position = 0,
  response = 14,      // spring stiffness, 1/s: higher follows the wheel more tightly
  topSpeed = 70,      // m/s that the hardest spin levels off toward
  judging = .12,      // seconds over which the wheel's rate of turn is judged
  spread = .34,       // the longest a single notch is paid out over, in seconds
} = {}) {
  let goal = position, velocity = 0, rate = 0, pushedAt = -Infinity, cruising = 0, seeking = false, seekReach = Infinity;
  // Metres of the latest notches not yet added to the goal, how fast they are
  // being paid out, and the usual gap between notches at the moment.
  let owed = 0, payRate = 0, usual = spread;
  // At a steady speed v the spring trails its goal by 2v / response, so limiting
  // how far the goal may lead also limits the speed.
  const reach = 2 * topSpeed * 1.15 / response;
  const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));

  // Relative input: so many metres further on (or back), at time `now` in seconds.
  function push(metres, now) {
    if (seeking) { goal = position + clamp(goal - position, reach); seeking = false; }
    const gap = Math.max(0, now - pushedAt); pushedAt = now;
    rate *= Math.exp(-gap / judging);
    if (rate * metres < 0) { rate = owed = 0; usual = spread; }   // a change of direction answers at once
    const demand = Math.abs(rate + .5 * metres / judging) / topSpeed;
    rate += metres / judging;
    owed += metres * (demand > 1e-3 ? Math.tanh(demand) / demand : 1);
    // Paying out over 1.3 gaps keeps a little in hand, so a late notch does not
    // leave the flight waiting for it.
    usual = gap < spread ? (usual + gap) / 2 : spread;
    payRate = Math.abs(owed) / Math.max(usual * 1.3, 1e-3);
  }

  // Absolute input: go to this distance, taking about `seconds` over a long trip.
  // With no time given the flight follows as closely as the spring allows.
  function seek(to, seconds = 0) {
    goal = to; seeking = true; rate = owed = 0; usual = spread;
    seekReach = seconds > 0 ? 2 * Math.max(topSpeed * 1.15, Math.abs(to - position) / seconds) / response : Infinity;
  }

  // Be somewhere at once, with no flight in between.
  function jump(to) { position = goal = to; velocity = rate = owed = 0; seeking = false; }

  // A steady speed in metres per second, for hands-free playback; 0 stops it.
  function cruise(speed) { cruising = speed; }

  // Advance by dt seconds. Long frames are taken in short strides, so the flight
  // is the same at any frame rate and a stalled frame costs time, never position.
  function step(dt, instant = false) {
    if (instant) { goal += owed + (seeking ? 0 : cruising * dt); owed = 0; position = goal; velocity = 0; seeking = false; return position; }
    for (let left = dt; left > 1e-9; left -= STRIDE) stride(Math.min(left, STRIDE));
    return position;
  }
  const STRIDE = 1 / 240;
  function stride(dt) {
    if (owed) { const paid = clamp(owed, payRate * dt); goal += paid; owed -= paid; }
    if (cruising && !seeking) goal += cruising * dt;
    const lead = clamp(goal - position, seeking ? seekReach : reach);
    if (!seeking) goal = position + lead;
    // Exact solution of the critically damped spring over dt, so the motion is
    // the same at any frame rate.
    const target = position + lead, offset = -lead, pull = velocity + response * offset, decay = Math.exp(-response * dt);
    position = target + (offset + pull * dt) * decay;
    velocity = (velocity - response * pull * dt) * decay;
    if (seeking && Math.abs(goal - position) < .005 && Math.abs(velocity) < .05) { position = goal; velocity = 0; seeking = false; }
  }

  return {
    push, seek, jump, cruise, step,
    get position() { return position; }, get velocity() { return velocity; }, get goal() { return goal; }, get seeking() { return seeking; },
    topSpeed, reach,
  };
}

// What one wheel event asks for, in CSS pixels along its dominant axis. Mice
// report in pixels, lines or pages depending on the browser; a notch is taken
// as 100 pixels, which is what Chrome and Edge send for one.
export function wheelPixels(event, pageHeight = 800) {
  const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  return raw * (event.deltaMode === 1 ? 100 / 3 : event.deltaMode === 2 ? pageHeight : 1);
}
