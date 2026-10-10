import * as THREE from 'three';
import { surface, tube, rod, createBatcher } from './build.js';
import { fleet, boatKinds, courseAt } from './layout.js';

// Three kinds of boat share one way of building a hull. A boat lies along +X
// with its bow forward, Y up, and the waterline at y = 0.
const WHITE = 0xf5f7f6, PALE = 0xe9eeee, AQUA = 0x17a5c7, DARK = 0x1d2f36;
const smooth = t => t * t * (3 - 2 * t);

// The lines of a hull: for a station s from the stern (0) to the bow (1), how
// wide it is, how high the gunwale, how deep the keel, and how far the stem
// leans forward.
function lines({ length, beam, freeboard, draft, sheer = .28, stern = .8, entry = 2.1 }) {
  return s => {
    const plan = s < .34 ? stern + (1 - stern) * smooth(s / .34) : Math.pow(Math.max(0, 1 - Math.pow((s - .34) / .66, entry)), .7);
    return {
      x: (s - .5) * length + .1 * length * Math.pow(s, 5), half: Math.max(.015, beam / 2 * plan),
      gunwale: freeboard * (1 + sheer * Math.pow(s, 2.4) + .05 * Math.pow(1 - s, 3)), keel: -draft * (1 - .85 * Math.pow(s, 3.2)), lean: .1 * length * Math.pow(s, 5),
    };
  };
}
const stations = (from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => from + (to - from) * i / steps);

function hull(at, stripe = [.08, .3]) {
  const rows = [], colours = [], white = new THREE.Color(WHITE), band = new THREE.Color(AQUA), below = new THREE.Color(0x0d5870);
  for (const s of stations(0, 1, 20)) {
    const st = at(s), span = st.gunwale - st.keel, fine = .42 + .5 * s * s;
    // Extra points pin the edges of the waterline stripe at every station.
    const heights = [0, .14, .3, .7, .88, 1, ...[stripe[0] - .012, stripe[0], stripe[1], stripe[1] + .012].map(y => Math.min(.97, Math.max(.02, (y - st.keel) / span)))].sort((a, b) => a - b);
    const point = (h, side) => ({ x: st.x - st.lean * (1 - h), y: st.keel + span * h, z: side * st.half * Math.pow(h, fine) });
    const row = [...heights.slice().reverse().map(h => point(h, -1)), ...heights.slice(1).map(h => point(h, 1))];
    rows.push(row);
    for (const p of row) { const c = p.y < stripe[0] - .006 ? below : p.y <= stripe[1] + .006 ? band : white; colours.push(c.r, c.g, c.b); }
  }
  const geometry = surface(rows, { away: { x: 0, y: .2, z: 0 } });
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}

function transom(at) {
  const st = at(0), span = st.gunwale - st.keel, edge = [];
  for (const side of [-1, 1]) for (const h of side < 0 ? [1, .8, .6, .4, .2, 0] : [.2, .4, .6, .8, 1]) edge.push({ x: st.x - st.lean * (1 - h), y: st.keel + span * h, z: side * st.half * Math.pow(h, .42) });
  return surface([edge, edge.map(p => ({ ...p, z: 0 }))], { away: { x: st.x + 1, y: 0, z: 0 } });
}

// A cambered surface between the gunwales: decks, and teak laid over them.
function decking(at, { from = 0, to = .985, inset = .03, lift = -.02, crown = .05, steps = 18 } = {}) {
  return surface(stations(from, to, steps).map(s => {
    const st = at(s), half = Math.max(.01, st.half - inset);
    return [-1, -.5, 0, .5, 1].map(k => ({ x: st.x, y: st.gunwale + lift + crown * (1 - k * k) * Math.min(1, half), z: k * half }));
  }));
}

// A streamlined superstructure: arches across the deck whose height follows a
// profile along the boat. sweep and span pick out a strip of it, for frames,
// roofs and windows laid over the main shell.
function arches(at, { from, to, inset, height, profile, steps = 14, around = 12, sweep = [0, 1], span = [0, 1], grow = 1 }) {
  return stations(span[0], span[1], steps).map(u => {
    const st = at(from + (to - from) * u), half = Math.max(.02, st.half - inset) * grow, rise = height * profile(u) * grow;
    return Array.from({ length: around + 1 }, (_, j) => {
      const a = (sweep[0] + (sweep[1] - sweep[0]) * j / around) * Math.PI;
      return { x: st.x, y: st.gunwale - .02 + rise * Math.pow(Math.sin(a), .7), z: -half * Math.cos(a) };
    });
  });
}

function rails(add, at, { from = 0, to = 1, radius = .04, lift = 0, inset = 0, finish = 'trim', detail = false }) {
  for (const side of [-1, 1]) add(finish, tube(stations(from, to, 22).map(s => { const st = at(s); return [st.x, st.gunwale + lift, side * Math.max(.01, st.half - inset)]; }), radius, { sides: 5 }), { detail });
}

function seat(add, x, y, z, [long, wide], cushion = AQUA) {
  add('gelcoat', new THREE.BoxGeometry(long, .34, wide), { at: [x, y + .17, z], tint: WHITE });
  add('gelcoat', new THREE.BoxGeometry(long - .06, .09, wide - .06), { at: [x, y + .385, z], tint: cushion, detail: true });
}

// A water taxi: a long glazed cabin with a hard top, and an open teak deck aft.
function launch(add) {
  const at = lines({ length: 9.6, beam: 2.9, freeboard: 1.02, draft: .5, sheer: .22, stern: .84 });
  add('gelcoat', hull(at)); add('gelcoat', transom(at), { tint: WHITE });
  add('gelcoat', decking(at), { tint: PALE });
  add('teak', decking(at, { from: .04, to: .33, inset: .26, lift: -.006, steps: 6 }), { detail: true });
  rails(add, at, {});
  const cabin = { from: .31, to: .84, inset: .28, height: 1.34, profile: u => smooth(Math.min(1, u / .16)) * (1 - .16 * u) * (1 - Math.pow(Math.max(0, (u - .6) / .4), 2.3)) };
  add('canopy', surface(arches(at, cabin)));
  add('gelcoat', surface(arches(at, { ...cabin, sweep: [.37, .63], span: [.03, .6], grow: 1.025 })), { tint: WHITE });
  for (const sweep of [[0, .11], [.89, 1]]) add('gelcoat', surface(arches(at, { ...cabin, sweep, grow: 1.03, around: 3 })), { tint: WHITE });
  for (const u of [.02, .3, .585]) add('gelcoat', surface(arches(at, { ...cabin, span: [u, u + .03], steps: 1, grow: 1.03 })), { tint: WHITE, detail: true });
  const aft = at(.18);
  for (const side of [-1, 1]) seat(add, aft.x, aft.gunwale, side * (aft.half - .62), [2.1, .52]);
  seat(add, at(.045).x + .2, aft.gunwale, 0, [.7, 1.7], WHITE);
  // A pulpit rail around the bow, and a short mast with a riding light.
  rails(add, at, { from: .62, to: .995, radius: .022, lift: .52, inset: .1, detail: true });
  for (const s of [.62, .72, .82, .92]) for (const side of [-1, 1]) { const st = at(s), z = side * Math.max(.01, st.half - .1); add('trim', rod([st.x, st.gunwale, z], [st.x, st.gunwale + .52, z], .016, { sides: 5 }), { detail: true }); }
  const roof = at(.31 + .53 * .3), peak = roof.gunwale + 1.34 * cabin.profile(.3);
  add('trim', rod([roof.x, peak, 0], [roof.x - .12, peak + .5, 0], .025, { top: .012, sides: 5 }), { detail: true });
  add('gelcoat', new THREE.SphereGeometry(.07, 8, 6), { at: [roof.x - .12, peak + .52, 0], tint: WHITE, detail: true });
}

// A small open runabout, the kind left tied up along a quay.
function tender(add) {
  const at = lines({ length: 5.4, beam: 1.9, freeboard: .62, draft: .3, sheer: .3, stern: .88 });
  add('gelcoat', hull(at, [.06, .2])); add('gelcoat', transom(at), { tint: WHITE });
  add('gelcoat', decking(at), { tint: PALE });
  add('teak', decking(at, { from: .1, to: .6, inset: .24, lift: -.004, steps: 8 }), { detail: true });
  rails(add, at, { radius: .035 });
  rails(add, at, { from: .1, to: .6, radius: .045, inset: .24, lift: .03, finish: 'gelcoat', detail: true });
  // A raked, wrap-around windscreen.
  const screen = s => { const st = at(s); return { x: st.x, y: st.gunwale, half: st.half - .2 }; }, foot = screen(.68), head = screen(.6);
  add('canopy', surface([[foot, .03], [head, .52]].map(([edge, rise]) => Array.from({ length: 11 }, (_, j) => { const a = j / 10 * Math.PI; return { x: edge.x, y: edge.y + rise * Math.pow(Math.sin(a), .6), z: -edge.half * Math.cos(a) }; }))), { detail: true });
  const mid = at(.45), aft = at(.2);
  for (const side of [-1, 1]) seat(add, mid.x, mid.gunwale - .02, side * .42, [.55, .5]);
  seat(add, aft.x, aft.gunwale - .02, 0, [.5, 1.3]);
  add('gelcoat', new THREE.BoxGeometry(.34, .62, .36), { at: [at(0).x - .16, .5, 0], tint: DARK, detail: true });
}

// A sloop under mainsail and jib, heeling a little on her way round the lagoon.
function sloop(add) {
  const at = lines({ length: 9.4, beam: 2.9, freeboard: .95, draft: .65, sheer: .34, stern: .7, entry: 1.9 });
  add('gelcoat', hull(at)); add('gelcoat', transom(at), { tint: WHITE });
  add('gelcoat', decking(at), { tint: PALE });
  add('teak', decking(at, { from: .05, to: .34, inset: .3, lift: -.006, steps: 6 }), { detail: true });
  rails(add, at, {});
  const trunk = { from: .37, to: .75, inset: .44, height: .5, profile: u => smooth(Math.min(1, u / .2)) * (1 - Math.pow(Math.max(0, (u - .5) / .5), 2)) };
  add('gelcoat', surface(arches(at, trunk)), { tint: WHITE });
  for (const sweep of [[.1, .25], [.75, .9]]) add('canopy', surface(arches(at, { ...trunk, sweep, span: [.22, .8], grow: 1.03, around: 3, steps: 6 })), { detail: true });

  const step = at(.6), foot = step.gunwale + .42, head = foot + 11.9, boom = foot + 1.15, clew = step.x - 4.1;
  add('trim', rod([step.x, foot - .5, 0], [step.x, head, 0], .085, { top: .048, sides: 8 }));
  add('trim', rod([step.x, boom, 0], [clew - .15, boom + .1, 0], .06, { sides: 6 }));
  const bow = at(1), tack = [bow.x - .15, bow.gunwale + .08, 0], aft = at(0);
  const stay = (from, to) => add('trim', rod(from, to, .012, { sides: 4 }), { detail: true });
  stay(tack, [step.x + .05, head - .5, 0]); stay([aft.x + .1, aft.gunwale, 0], [step.x - .05, head, 0]);
  for (const side of [-1, 1]) { stay([step.x - .25, step.gunwale, side * (step.half - .06)], [step.x, foot + 6.6, side * .75]); stay([step.x, foot + 6.6, side * .75], [step.x, head - .9, 0]); }
  add('trim', rod([step.x, foot + 6.6, -.75], [step.x, foot + 6.6, .75], .022, { sides: 5 }), { detail: true });

  // Sails are full, curved surfaces bellied out to leeward, toward +Z.
  const white = new THREE.Color(0xfbfcf9), marked = new THREE.Color(0x9fdcec);
  function sailcloth(luff, leech, { belly, rows = 12, columns = 7, mark = 2 }) {
    const grid = [], colours = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows, a = luff(v), b = leech(v), chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      grid.push(Array.from({ length: columns + 1 }, (_, i) => {
        const u = i / columns, c = (v > 1 - mark / rows ? marked : white);
        colours.push(c.r, c.g, c.b);
        return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u + belly * chord * Math.sin(Math.PI * Math.pow(u, .8)) * (1 - .45 * v) + .22 * u * v };
      }));
    }
    const geometry = surface(grid, { away: { x: 0, y: 5, z: -30 } });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    return geometry;
  }
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // The mainsail's leech curves aft of the straight line from clew to head.
  add('sail', sailcloth(v => [step.x - .09, boom + .12 + (head - .35 - boom) * v, 0], v => [clew + (step.x - .2 - clew) * v - .5 * Math.sin(Math.PI * v), boom + .16 + (head - .35 - boom) * v, 0], { belly: .1 }));
  const jibHead = [step.x + .04, head - .9, 0], jibClew = [step.x + .35, step.gunwale + 1, .35];
  add('sail', sailcloth(v => lerp(tack, jibHead, v * .97 + .015), v => lerp(jibClew, jibHead, v), { belly: .12, mark: 0 }));
}

function boatFinishes() {
  const gelcoat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .2, metalness: 0, envMapIntensity: 1.05 });
  // Teak is laid in narrow planks along the boat.
  const teak = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: .66, envMapIntensity: .5 });
  teak.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vPlank;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlank = position;');
    shader.fragmentShader = `varying vec3 vPlank;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      float plank = vPlank.z / .11, seam = smoothstep(.5 - fwidth(plank) - .07, .5, abs(fract(plank) - .5)) * saturate(1. - fwidth(plank) * 2.5);
      diffuseColor.rgb *= (1. - .5 * seam) * (.88 + .24 * fract(sin(floor(plank) * 91.7) * 43758.5));`);
  };
  const canopy = new THREE.MeshStandardMaterial({ color: 0x5c9fb2, roughness: .06, metalness: 1, envMapIntensity: 1.5, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0xccd8db, roughness: .28, metalness: .9 });
  // Sailcloth glows a little where the sun is behind it.
  const sail = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .84, side: THREE.DoubleSide, envMapIntensity: .55 });
  sail.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * saturate(dot(-normal, directionalLights[0].direction)) * .14;
      #endif`);
  };
  return { gelcoat: { material: gelcoat, attributes: ['color'] }, teak: { material: teak }, canopy: { material: canopy }, trim: { material: trim }, sail: { material: sail, attributes: ['color'] } };
}

const flatVertex = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv; vec4 world = modelMatrix * INSTANCE vec4(position, 1.); vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const fogged = /* glsl */`
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1. - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));
  #endif`;

// Moving boats cannot use the baked shadow map, so each carries a soft shadow
// of its own on the water.
function shadowMaterial(strength) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { strength: { value: strength } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vWorld;\n${flatVertex.replace('INSTANCE', 'instanceMatrix *')}`,
    fragmentShader: `uniform float strength; varying vec2 vUv; varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(0., .07, .11, strength * (1. - smoothstep(.5, 1., length(vUv * 2. - 1.))));
        ${fogged}
      }`,
  });
}

// Foam is left where the boat has been: the pattern is fixed to the water, and
// the ribbon that carries it follows the boat's course behind her.
function wakeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `attribute vec4 wake; varying vec4 vWake; varying vec2 vUv; varying vec3 vWorld;\n${flatVertex.replace('INSTANCE', '').replace('vUv = uv;', 'vWake = wake; vUv = uv;')}`,
    fragmentShader: `uniform float time; varying vec4 vWake; varying vec2 vUv; varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
      void main() {
        // wake: metres off the centre line, how far astern (0 to 1), strength, half-width in metres.
        float off = abs(vWake.x), astern = vWake.y, edge = vWake.w - off;
        float foam = noise(vWorld.xz * 1.6 + time * .05) * .55 + noise(vWorld.xz * 4.7 - time * .08) * .45;
        float arms = smoothstep(0., .25, edge) * (1. - smoothstep(.25, 1.5, edge)) * pow(1. - astern, 1.2) * smoothstep(0., .05, astern);
        float churn = (1. - smoothstep(.5, 1.9, off)) * smoothstep(.26, .31, astern) * pow(1. - astern, 1.7);
        float cover = smoothstep(.2, .62, (arms * 1.05 + churn * 1.5) * (.42 + .95 * foam)) * vWake.z;
        gl_FragColor = vec4(vec3(.86, .97, .98) * 1.2, cover * .85);
        ${fogged}
      }`,
  });
}

export function createBoats({ scene, sunDirection }) {
  const finishes = boatFinishes(), root = new THREE.Group(), pose = new THREE.Object3D(), designs = { launch, tender, sloop }, fleets = [];
  root.name = 'Boats'; scene.add(root);
  for (const [kind, design] of Object.entries(designs)) {
    const members = fleet.filter(boat => boat.kind === kind);
    if (!members.length) continue;
    const batch = createBatcher(finishes); design(batch.add);
    // Each finish of a design becomes one instanced draw for the whole fleet.
    const parts = Object.values(batch.build(new THREE.Group(), kind)).map(mesh => {
      const part = new THREE.InstancedMesh(mesh.geometry, mesh.material, members.length);
      part.name = `Boats, ${mesh.name}`; part.layers.mask = mesh.layers.mask; part.frustumCulled = false;
      // Moored boats sit still enough to use the baked shadows.
      part.castShadow = !members[0].course; part.receiveShadow = true;
      root.add(part); return part;
    });
    fleets.push({ members, parts, heel: kind === 'sloop' ? .11 : 0 });
  }

  const under = fleet.filter(boat => boat.course), sailing = under.filter(boat => boat.kind === 'sloop');
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const decals = [[under, .5], [sailing, .26]].map(([boats, strength]) => {
    const mesh = new THREE.InstancedMesh(flat, shadowMaterial(strength), Math.max(1, boats.length));
    mesh.count = boats.length; mesh.frustumCulled = false; mesh.layers.set(1); mesh.renderOrder = 1; mesh.name = 'Boat shadows'; root.add(mesh); return mesh;
  });
  // Shadows fall away from the sun, by about the height of whatever casts them.
  const cast = new THREE.Vector2(-sunDirection.x, -sunDirection.z).normalize(), slope = Math.hypot(sunDirection.x, sunDirection.z) / sunDirection.y;

  const SPANS = 24, ribbon = new THREE.BufferGeometry(), across = SPANS + 1;
  const positions = new Float32Array(under.length * across * 2 * 3), wakes = new Float32Array(under.length * across * 2 * 4), index = [];
  under.forEach((_, b) => { for (let k = 0; k < SPANS; k++) { const i = (b * across + k) * 2; index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } });
  ribbon.setAttribute('position', new THREE.BufferAttribute(positions, 3)); ribbon.setAttribute('wake', new THREE.BufferAttribute(wakes, 4));
  ribbon.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(under.length * across * 4), 2)); ribbon.setIndex(index);
  const foam = new THREE.Mesh(ribbon, wakeMaterial());
  foam.frustumCulled = false; foam.layers.set(1); foam.renderOrder = 2; foam.name = 'Wakes'; root.add(foam);

  function update(time) {
    for (const { members, parts, heel } of fleets) {
      members.forEach((boat, i) => {
        const at = boat.course ? courseAt(boat.course, boat.start + time * boat.speed) : { x: boat.x, z: boat.z, tx: boat.heading[0], tz: boat.heading[1] };
        const swell = time * 1.1 + boat.phase;
        boat.at = at;
        pose.position.set(at.x, Math.sin(swell) * .035, at.z);
        pose.rotation.set(heel + Math.sin(swell * .8) * .028, Math.atan2(-at.tz, at.tx), Math.sin(swell * 1.3 + 1) * .012, 'YXZ');
        pose.scale.setScalar(1); pose.updateMatrix();
        for (const part of parts) part.setMatrixAt(i, pose.matrix);
      });
      for (const part of parts) part.instanceMatrix.needsUpdate = true;
    }
    pose.rotation.order = 'XYZ';
    under.forEach((boat, b) => {
      const kind = boatKinds[boat.kind], { at } = boat, reach = kind.top > 10 ? 1.1 : kind.top * .62 * slope;
      pose.position.set(at.x + cast.x * reach, .02, at.z + cast.y * reach);
      pose.rotation.set(0, Math.atan2(-at.tz, at.tx), 0); pose.scale.set(kind.length * 1.12, 1, kind.beam * 1.5); pose.updateMatrix();
      decals[0].setMatrixAt(b, pose.matrix);
      // A wake: narrow at the bow, spreading astern, laid along the course already sailed.
      const strength = kind.top > 10 ? .6 : 1, span = kind.length * (kind.top > 10 ? 2.2 : 3.6), where = boat.start + time * boat.speed;
      for (let k = 0; k <= SPANS; k++) {
        const u = k / SPANS, p = courseAt(boat.course, where + kind.length * .46 - u * span), half = .12 + (kind.beam * .5 + .35) * smooth(Math.min(1, u / .22)) + 4.4 * strength * Math.pow(u, .9);
        for (const side of [-1, 1]) {
          const v = (b * across + k) * 2 + (side > 0 ? 1 : 0);
          positions.set([p.x - p.tz * side * half, .035, p.z + p.tx * side * half], v * 3); wakes.set([side * half, u, strength, half], v * 4);
        }
      }
    });
    sailing.forEach((boat, b) => {
      const { at } = boat, reach = boatKinds.sloop.top * .5 * slope;
      pose.position.set(at.x + cast.x * reach, .021, at.z + cast.y * reach);
      pose.rotation.set(0, Math.atan2(-cast.y, cast.x), 0); pose.scale.set(reach * 2.1, 1, 3.4); pose.updateMatrix();
      decals[1].setMatrixAt(b, pose.matrix);
    });
    for (const decal of decals) decal.instanceMatrix.needsUpdate = true;
    ribbon.attributes.position.needsUpdate = ribbon.attributes.wake.needsUpdate = true;
    foam.material.uniforms.time.value = time;
  }
  update(0);
  return { root, update, fleet, stats: { boats: fleet.length } };
}
