import * as THREE from 'three';
import { lathe, arc, sweep, surface, tube, rod } from './build.js';
import { facadeGlass, clearGlass } from './glass.js';
import {
  TAU, DECK, CANAL_HALF, PROMENADE, bankStations, bankInner, bankOuter, deckOuter, lawnHeight,
  towers, towerRadius, skyline, pods, spheres, basin, links, linkPoint, footbridge, gate, rng,
} from './layout.js';

const UP = new THREE.Vector3(0, 1, 0);
const TINTS = [0xffffff, 0xc8e6ff, 0xb8f5e2, 0xdfe3ff, 0xa6dcea];

// Pale stone paving with fine joints, drawn from the deck's own coordinates.
function pavingMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: 0xb9c3c6, roughness: .6, metalness: .02, envMapIntensity: .8 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vPaving;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaving = uv;');
    shader.fragmentShader = `varying vec2 vPaving;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 slab = vPaving / vec2(2.4, 1.2); slab.x += step(1., mod(floor(slab.y), 2.)) * .5;
      vec2 gap = abs(fract(slab) - .5), width = fwidth(slab) + vec2(.006, .012);
      float joint = max(smoothstep(.5 - width.x, .5, gap.x), smoothstep(.5 - width.y, .5, gap.y)) * saturate(1. - max(width.x, width.y) * 3.);
      float tone = fract(sin(dot(floor(slab), vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= (1. - .24 * joint) * (.94 + .1 * tone);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(.42, .7, fract(sin(dot(floor(vPaving / vec2(2.4, 1.2)), vec2(4.1, 9.7))) * 913.7));`);
  };
  return material;
}

export function cityFinishes({ facade, sky, sun }) {
  // White architecture is assembled from glazed panels: fine joints, a breath of
  // tone from one panel to the next, and a faint tide mark where it meets the sea.
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xd9e0e3, roughness: .27, metalness: 0, envMapIntensity: 1 });
  porcelain.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vPanel; varying vec3 vPanelNormal;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanel = (modelMatrix * vec4(transformed, 1.)).xyz; vPanelNormal = mat3(modelMatrix) * objectNormal;');
    shader.fragmentShader = `varying vec3 vPanel; varying vec3 vPanelNormal;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 panelFacing = abs(normalize(vPanelNormal)), panel = vPanel / vec3(3.2, 1.45, 3.2);
      vec3 panelWidth = fwidth(panel), joint = smoothstep(.5 - panelWidth * 1.3 - .004, vec3(.5), abs(fract(panel) - .5));
      // A joint only shows where its plane actually cuts across the surface.
      joint *= 1. - smoothstep(vec3(.55), vec3(.9), panelFacing);
      float seam = max(joint.x, max(joint.y, joint.z)) * saturate(1. - max(panelWidth.x, max(panelWidth.y, panelWidth.z)) * 6.);
      vec3 slab = floor(panel + .5);
      float tone = fract(sin(dot(slab, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      diffuseColor.rgb *= (1. - .2 * seam) * (.955 + .06 * tone);
      diffuseColor.rgb *= mix(vec3(.74, .83, .8), vec3(1.), smoothstep(.02, .9, vPanel.y + .25 * tone));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor + .1 * tone, .6, seam);`);
  };
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9d8dc, roughness: .24, metalness: .92, envMapIntensity: 1.1 });
  return {
    white: { material: porcelain },
    silver: { material: silver },
    paving: { material: pavingMaterial() },
    glass: { material: facadeGlass({ facade, sky }), attributes: ['color', 'facade'] },
    clear: { material: clearGlass({ sky, sun, grid: 1, body: .13, base: .17, glint: .7 }), shadow: false, receive: false },
    rail: { material: clearGlass({ sky, sun, body: .1, glint: .25, side: THREE.DoubleSide }), shadow: false, receive: false },
    bubble: { material: clearGlass({ sky, sun, body: .035, base: .07, film: 1, glint: 1.6, tint: 0xd6fbff }), shadow: false, receive: false },
    soil: { material: new THREE.MeshStandardMaterial({ color: 0x3b3323, roughness: 1 }) },
    glow: { material: new THREE.MeshStandardMaterial({ color: 0xf2f7f8, emissive: 0xdff8ff, emissiveIntensity: .55, roughness: .22 }), shadow: false },
    amber: { material: new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff8a1e, emissiveIntensity: 1.5, roughness: .35 }), shadow: false },
    azure: { material: new THREE.MeshStandardMaterial({ color: 0x1c6fd6, emissive: 0x1f86ff, emissiveIntensity: 1.3, roughness: .3 }), shadow: false },
  };
}

export function buildCity({ add, plantings }) {
  const random = rng(4417);
  const ring = (x, z, y, radius, { out = .5, tall = .5, finish = 'white', segments = 40, detail = false } = {}) =>
    add(finish, lathe([[radius - .05, y - tall / 2], [radius + out * .75, y - tall * .42], [radius + out, y], [radius + out * .75, y + tall * .42], [radius - .05, y + tall / 2]], { segments }), { at: [x, 0, z], detail });
  const spire = (x, z, y, length, radius = .16) => {
    add('silver', rod([x, y, z], [x, y + length, z], radius, { top: .015, sides: 6 }), { detail: true });
    add('white', new THREE.SphereGeometry(radius * 2.1, 10, 8), { at: [x, y + length * .42, z], detail: true });
  };
  const bayOptions = (tower, bays, lift = 0) => ({ bays, floor: 3, lift, seed: tower.seed });
  const baysFor = radius => Math.max(8, Math.round(TAU * radius / 2.67));

  function podium(tower, lip = tower.radius) {
    const { x, z, radius: r } = tower;
    add('white', lathe([[r + 3.4, -1.8], [r + 3.4, DECK - .55], [r + 3.25, DECK - .16], [r + 2.85, DECK + .02], [lip + 1.1, DECK + .06], [lip + .9, DECK + .5], [lip + .45, DECK + .78], [lip + .02, DECK + .82]], { segments: 48 }), { at: [x, 0, z] });
    ring(x, z, DECK - .9, r + 3.4, { out: .32, tall: .7, segments: 48 });
    add('silver', lathe([[lip + .05, DECK + .82], [lip + .1, DECK + 1.25]], { segments: 40 }), { at: [x, 0, z], detail: true });
  }

  // Slender fins that follow a shell from podium to crown.
  function ribs(tower, count, radiusAt, yTop, { twist = 0, finish = 'white', size = .1, steps = 12, from = DECK + .8 } = {}) {
    for (let i = 0; i < count; i++) {
      const start = i / count * TAU + tower.seed, points = [];
      for (let j = 0; j <= steps; j++) {
        const y = from + (yTop - from) * j / steps, angle = start + twist * j / steps, radius = radiusAt(y) + size * .55;
        points.push(new THREE.Vector3(tower.x + Math.cos(angle) * radius, y, tower.z + Math.sin(angle) * radius));
      }
      add(finish, tube(points, size, { segments: steps * 2, sides: 4 }), { detail: true });
    }
  }

  function capsule(tower) {
    const { x, z, radius: r, height: h } = tower, tint = TINTS[tower.tint], top = DECK + h, crown = r * 1.5;
    const shaft = Array.from({ length: 7 }, (_, i) => [towerRadius(tower, DECK + h * i / 6), DECK + h * i / 6]);
    add('glass', lathe([...shaft, ...arc(r * .86, top, crown, 8).slice(1)], { segments: 40, facade: bayOptions(tower, baysFor(r)) }), { at: [x, 0, z], tint });
    podium(tower);
    for (const level of [.3, .58, .84]) ring(x, z, DECK + h * level, towerRadius(tower, DECK + h * level), { out: .55, tall: .62 });
    ring(x, z, top, r * .86, { out: .3, tall: .5, finish: 'silver' });
    ribs(tower, 8, y => towerRadius(tower, y), top + crown * .985, { steps: 14 });
    spire(x, z, top + crown - .2, 6 + r);
    if (Math.round(tower.seed * 10) % 3 === 0) {
      // An observation pod worn on the shoulder of the tower, with its own glazing.
      const angle = tower.seed * 2.3, y = DECK + h * .44, reach = towerRadius(tower, y) + r * .28, px = x + Math.cos(angle) * reach, pz = z + Math.sin(angle) * reach, size = r * .62;
      add('white', new THREE.SphereGeometry(1, 28, 16), { at: [px, y, pz], scale: [size, size * .62, size] });
      add('glass', lathe([[size * .97, y - size * .12], [size * 1.02, y + size * .05], [size * .95, y + size * .22]], { segments: 28, facade: bayOptions(tower, 12) }), { at: [px, 0, pz], tint: 0x9fd8ee });
    }
  }

  function spindle(tower) {
    const { x, z, radius: r, height: h } = tower, tint = TINTS[tower.tint], rows = 18;
    const shell = Array.from({ length: rows + 1 }, (_, i) => { const y = DECK + h * (1 - Math.pow(1 - i / rows, 1.35)); return [Math.max(towerRadius(tower, y), .02), y]; });
    add('glass', lathe(shell, { segments: 36, facade: bayOptions(tower, baysFor(r)) }), { at: [x, 0, z], tint });
    podium(tower, r * .8);
    ribs(tower, 6, y => towerRadius(tower, y), DECK + h * .985, { twist: 1.5, steps: 18, size: .12 });
    for (const level of [.22, .5]) ring(x, z, DECK + h * level, towerRadius(tower, DECK + h * level), { out: .5, tall: .55 });
    add('white', lathe([[towerRadius(tower, DECK + h * .93) + .05, DECK + h * .93], [.12, DECK + h + .4]], { segments: 16 }), { at: [x, 0, z] });
    spire(x, z, DECK + h, 9 + r, .12);
  }

  function ribbed(tower) {
    const { x, z, radius: r, height: h } = tower, count = Math.round(h / 3.6), step = h / count, profile = [];
    const taper = k => 1 - .26 * k;
    for (let i = 0; i < count; i++) {
      const y = DECK + .8 + i * step, wide = r * taper(i / count), narrow = wide * .8;
      profile.push([narrow, y], [wide, y + step * .2], [wide, y + step * .62], [narrow, y + step * .82]);
    }
    add('white', lathe(profile, { segments: 30 }), { at: [x, 0, z] });
    // Ribbon windows sit in the shadow between the stacked discs.
    add('glass', lathe([[r * .83, DECK + .8], [r * taper(1) * .83, DECK + h]], { segments: 30, facade: bayOptions(tower, baysFor(r)) }), { at: [x, 0, z], tint: 0xa9dcee });
    podium(tower);
    const top = DECK + h + .5, lantern = r * taper(1) * .7;
    add('glass', lathe([[lantern, top - .4], [lantern, top + 3], ...arc(lantern, top + 3, lantern * 1.2, 6).slice(1)], { segments: 24, facade: bayOptions(tower, 10) }), { at: [x, 0, z], tint: TINTS[1] });
    ring(x, z, top - .2, lantern, { out: 1.1, tall: .5 });
    spire(x, z, top + 3 + lantern * 1.1, 13 + r, .2);
    for (const up of [.3, .5]) add('white', lathe([[.05, 0], [1.1 - up, .08], [1.1 - up, .2], [.05, .28]], { segments: 14 }), { at: [x, top + 3 + lantern * 1.2 + (13 + r) * up, z], detail: true });
  }

  function terrace(tower) {
    const { x, z, radius: r, height: h } = tower, tint = TINTS[tower.tint];
    let y = DECK;
    for (let tier = 0; tier < 4; tier++) {
      const radius = r * (1 - .17 * tier), tall = h * (tier < 3 ? .3 : .1), next = r * (1 - .17 * (tier + 1));
      add('glass', lathe([[radius, y], [radius, y + tall]], { segments: 36, facade: bayOptions(tower, baysFor(radius), y - DECK) }), { at: [x, 0, z], tint });
      y += tall;
      if (tier < 3) {
        // A planted terrace: slab, upstand, and a bed of soil for the shrubs.
        add('white', lathe([[next - .1, y - .5], [radius + .7, y - .5], [radius + 1, y - .22], [radius + 1, y + .5], [radius + .72, y + .62], [radius + .5, y + .5], [radius + .5, y + .12], [next - .1, y + .12]], { segments: 36 }), { at: [x, 0, z] });
        add('soil', lathe([[radius + .5, y + .32], [next, y + .32]], { segments: 24 }), { at: [x, 0, z], detail: true });
        const beds = Math.round(radius * 2.6);
        for (let i = 0; i < beds; i++) {
          const angle = i / beds * TAU + tier, reach = (next + radius + .5) / 2;
          plantings.shrubs.push({ x: x + Math.cos(angle) * reach, y: y + .3, z: z + Math.sin(angle) * reach, scale: .34 + random() * .22, high: true });
          if (i % 3 === 0) plantings.vines.push({ x: x + Math.cos(angle) * (radius + 1.02), y: y + .45, z: z + Math.sin(angle) * (radius + 1.02), angle, drop: 2.5 + random() * 4 });
        }
      }
    }
    const cap = r * .49;
    add('glass', lathe(arc(cap, y, r * .7, 7), { segments: 30, facade: bayOptions(tower, baysFor(cap)) }), { at: [x, 0, z], tint });
    ring(x, z, y, cap, { out: .3, tall: .45 });
    podium(tower);
    spire(x, z, y + r * .68, 7 + r * .6, .12);
  }

  function belljar(tower) {
    const { x, z, radius: r, height: h } = tower, top = DECK + h, core = r * .26;
    add('white', lathe([[core * 1.5, DECK], [core, DECK + 4], [core, top - 2], [core * .5, top + r]], { segments: 20 }), { at: [x, 0, z] });
    const floors = Math.round(h / 6.4);
    for (let i = 1; i <= floors; i++) {
      const y = DECK + i * h / (floors + .4), radius = towerRadius(tower, y) - .55;
      add('white', lathe([[core, y - .32], [radius - .2, y - .3], [radius, y - .08], [radius - .15, y + .12], [core, y + .1]], { segments: 30 }), { at: [x, 0, z] });
      if (i % 2) {
        const beds = 7;
        for (let j = 0; j < beds; j++) {
          const angle = j / beds * TAU + i, reach = radius * (.52 + .3 * random());
          (j % 3 === 0 ? plantings.trees : plantings.shrubs).push({ x: x + Math.cos(angle) * reach, y: y + .08, z: z + Math.sin(angle) * reach, scale: j % 3 === 0 ? .3 + random() * .12 : .42 + random() * .2, high: true });
        }
      } else add('glow', lathe([[radius - 1.2, y - .34], [radius - .5, y - .34]], { segments: 30 }), { at: [x, 0, z], detail: true });
    }
    // The bell jar itself: a clear glazed shell around the hanging gardens.
    const jar = Array.from({ length: 7 }, (_, i) => [towerRadius(tower, DECK + .9 + (h - .9) * i / 6), DECK + .9 + (h - .9) * i / 6]);
    const shell = lathe([...jar, ...arc(r * .86, top, r * 1.5, 9).slice(1)], { segments: 44 }), uv = shell.attributes.uv, bays = baysFor(r) * 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bays, uv.getY(i) / 3);
    add('clear', shell, { at: [x, 0, z] });
    podium(tower);
    ring(x, z, top, r * .86, { out: .35, tall: .6 });
    ring(x, z, DECK + h * .5, towerRadius(tower, DECK + h * .5), { out: .3, tall: .4, finish: 'silver' });
    spire(x, z, top + r * 1.48, 8 + r);
  }

  const builders = { capsule, spindle, ribbed, terrace, belljar };
  for (const tower of towers) builders[tower.kind](tower);

  // Distant towers are single shells: haze supplies the rest.
  for (const far of skyline) {
    const body = far.spindle
      ? Array.from({ length: 9 }, (_, i) => { const k = i / 8; return [Math.max(.05, far.radius * (.8 + .28 * Math.sin(Math.PI * Math.pow(k, .8))) * Math.sqrt(1 - Math.pow(k, 3.2))), far.height * k]; })
      : [[far.radius, -1], [far.radius * .9, far.height], ...arc(far.radius * .9, far.height, far.radius * 1.5, 4).slice(1)];
    add('glass', lathe(body, { segments: 14, facade: { bays: baysFor(far.radius), floor: 3, seed: far.x } }), { at: [far.x, 0, far.z], tint: TINTS[far.tint] });
  }

  // ---- Banks: a thick porcelain quay around each garden peninsula ----------
  const QUAY = [[.02, -1.8], [.02, .18], [.5, .42], [.72, .86], [.5, 1.3], [.1, 1.46], [.08, 1.98], [.28, 2.12], [.34, 2.42], [.2, 2.68], [-.08, 2.75], [-.4, 2.68], [-.55, 2.42]];
  const KERB = [[-.2, DECK - .1], [-.2, DECK + .2], [-.1, DECK + .31], [.1, DECK + .31], [.2, DECK + .2], [.2, DECK - .1]];
  const line = bankStations();
  for (const side of [-1, 1]) {
    const at = (f, offset, y = DECK) => ({ x: f.x + f.nx * side * offset, y, z: f.z + f.nz * side * offset });
    const loop = [...line.map(f => at(f, bankInner(side, f.t))), ...line.slice().reverse().map(f => at(f, bankOuter(side, f.t)))].map(p => ({ x: p.x, z: p.z }));
    let area = 0;
    for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; area += p.x * q.z - q.x * p.z; }
    add('white', sweep(loop, QUAY, { closed: true, outward: Math.sign(area), uvScale: .5 }));
    // A solid slab under the paving and turf, so no seam can ever show water.
    add('white', new THREE.ShapeGeometry(new THREE.Shape(loop.map(p => new THREE.Vector2(p.x, -p.z)))), { turn: [-Math.PI / 2, 0, 0], at: [0, DECK - .03, 0] });
    const deck = add('paving', surface(line.map(f => [at(f, bankInner(side, f.t) + .5, DECK + .021), at(f, deckOuter(side, f.t), DECK + .021)])));
    // Paving is laid out along the quay rather than on the world grid.
    line.forEach((f, i) => { deck.attributes.uv.setXY(i * 2, f.s, 0); deck.attributes.uv.setXY(i * 2 + 1, f.s, deckOuter(side, f.t) - bankInner(side, f.t)); });
    add('white', sweep(line.map(f => ({ ...at(f, deckOuter(side, f.t) + .15), y: 0, nx: f.nx * side, nz: f.nz * side })), KERB));
    add('lawn', surface(line.map(f => {
      const inner = deckOuter(side, f.t) + .3, outer = bankOuter(side, f.t) - .5;
      return Array.from({ length: 9 }, (_, k) => { const d = inner + (outer - inner) * k / 8, p = at(f, d); p.y = lawnHeight(p.x, p.z, d - inner, outer - d); return p; });
    })));

    // Balustrade: glass infill, silver posts, a continuous handrail.
    const railed = line.filter(f => f.t > .035 && f.t < .965), edge = f => at(f, bankInner(side, f.t) + .12);
    add('silver', tube(railed.map(f => { const p = edge(f); return [p.x, DECK + 1.36, p.z]; }), .045, { segments: railed.length, sides: 5 }), { detail: true });
    add('rail', surface(railed.map(f => { const p = edge(f); return [{ x: p.x, y: DECK + .42, z: p.z }, { x: p.x, y: DECK + 1.3, z: p.z }]; })), { detail: true });
    railed.forEach((f, i) => { if (i % 2 === 0) { const p = edge(f); add('silver', rod([p.x, DECK + .32, p.z], [p.x, DECK + 1.36, p.z], .028, { sides: 5 }), { detail: true }); } });

    // Lamps and street trees share the landward edge of the promenade.
    const busy = (x, z) => Math.hypot(x - gate.x, z - gate.z) < 13 || pods.some(p => Math.hypot(x - p.x, z - p.z) < 6) || Math.abs(z + 45) < 5;
    for (let i = 19; i < line.length - 19; i += 5) {
      const f = line[i], promenade = deckOuter(side, f.t) - bankInner(side, f.t);
      if (promenade < PROMENADE - .2) continue;
      if (i % 3 === 0) {
        const p = at(f, CANAL_HALF + PROMENADE - .85);
        add('silver', rod([p.x, DECK, p.z], [p.x, DECK + 4.3, p.z], .06, { top: .035, sides: 6 }), { detail: true });
        add('silver', new THREE.CylinderGeometry(.16, .22, .12, 10), { at: [p.x, DECK + .06, p.z], detail: true });
        add('glow', new THREE.SphereGeometry(.26, 14, 10), { at: [p.x, DECK + 4.5, p.z], detail: true });
      } else {
        const p = at(f, CANAL_HALF + 2.1);
        if (busy(p.x, p.z)) continue;
        add('white', lathe([[.85, DECK], [1.2, DECK + .16], [1.3, DECK + .5], [1.16, DECK + .62], [1.02, DECK + .56]], { segments: 22 }), { at: [p.x, 0, p.z] });
        add('lawn', new THREE.CircleGeometry(1.03, 18), { at: [p.x, DECK + .5, p.z], turn: [-Math.PI / 2, 0, 0], detail: true });
        plantings.trees.push({ x: p.x, y: DECK + .46, z: p.z, scale: .42 + random() * .2, street: true });
      }
    }
  }

  // ---- The porcelain gateway over the canal --------------------------------
  {
    const { x, y, z, radius } = gate, hoop = (inner, outer, depth) => {
      const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, TAU, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
      return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: .08, bevelThickness: .08, curveSegments: 48 });
    };
    add('white', hoop(radius, radius + .75, .9), { at: [x, y, z - .45] });
    for (const offset of [-.56, .56]) {
      add('glow', new THREE.TorusGeometry(radius + .02, .03, 6, 96), { at: [x, y, z + offset], detail: true });
      add('silver', new THREE.TorusGeometry(radius + .4, .05, 6, 96), { at: [x, y, z + offset * 1.03], detail: true });
    }
    for (const sign of [-1, 1]) {
      const fx = x + sign * (radius - .8);
      add('white', lathe([[1.5, -1.6], [1.45, .2], [1.2, .55], [.95, 1.6], [.8, 2.6]], { segments: 24 }), { at: [fx, 0, z] });
      ring(fx, z, .3, 1.45, { out: .18, tall: .3, finish: 'silver', segments: 24, detail: true });
    }
  }

  // ---- Footbridge: one long arch from lawn to lawn -------------------------
  {
    const path = new THREE.CatmullRomCurve3(footbridge.map(p => new THREE.Vector3(...p))), steps = 96;
    const stations = Array.from({ length: steps + 1 }, (_, i) => {
      const centre = path.getPointAt(i / steps), tangent = path.getTangentAt(i / steps), sideways = new THREE.Vector3().crossVectors(tangent, UP).normalize();
      return { centre, sideways, lift: new THREE.Vector3().crossVectors(sideways, tangent).normalize() };
    });
    const offset = (s, across, above) => s.centre.clone().addScaledVector(s.sideways, across).addScaledVector(s.lift, above);
    add('paving', surface(stations.map((s, i) => [-1.5, 1.5].map(w => Object.assign(offset(s, w, 0), { u: i * .9 }))), { uv: p => [p.u, p.x] }));
    add('white', surface(stations.map(s => [offset(s, 1.55, -.42), offset(s, -1.55, -.42)]), { up: false }));
    for (const sign of [-1, 1]) {
      add('white', sweep(stations.map(s => ({ x: s.centre.x + s.sideways.x * sign * 1.5, y: s.centre.y, z: s.centre.z + s.sideways.z * sign * 1.5, nx: s.sideways.x * sign, nz: s.sideways.z * sign })), [[-.12, -.43], [.08, -.44], [.22, -.14], [.08, .17], [-.12, .03]]));
      add('rail', surface(stations.map(s => [offset(s, sign * 1.5, .2), offset(s, sign * 1.5, 1.14)])), { detail: true });
      add('silver', tube(stations.map(s => offset(s, sign * 1.5, 1.2)), .045, { segments: steps, sides: 5 }), { detail: true });
      add('white', tube(stations.map(s => offset(s, sign * .85, -.5)), .16, { segments: steps, sides: 6 }));
      stations.forEach((s, i) => { if (i % 4 === 0) add('silver', rod(offset(s, sign * 1.5, .12).toArray(), offset(s, sign * 1.5, 1.2).toArray(), .026, { sides: 5 }), { detail: true }); });
    }
    for (const k of [.23, .77]) {
      const s = stations[Math.round(k * steps)], foot = s.centre.clone(); foot.y = -1.5;
      const fork = s.centre.clone().addScaledVector(UP, -2.6);
      add('white', rod(foot.toArray(), fork.toArray(), .62, { top: .34, sides: 16 }));
      for (const sign of [-1, 1]) add('white', rod(fork.toArray(), offset(s, sign * 1.05, -.45).toArray(), .3, { top: .2, sides: 10 }));
      add('white', lathe([[1.5, -1.6], [1.4, .2], [1.1, .5], [.66, .7]], { segments: 22 }), { at: [foot.x, 0, foot.z] });
    }
  }

  // ---- Glazed sky bridges --------------------------------------------------
  for (const link of links) {
    const points = Array.from({ length: 25 }, (_, i) => new THREE.Vector3(...linkPoint(link, i / 24)));
    const length = points[0].distanceTo(points[24]), shell = tube(points, 1.5, { segments: 32, sides: 12 }), uv = shell.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.round(length / 2.2), uv.getY(i) * 6);
    add('clear', shell);
    add('white', tube(points.map(p => p.clone().setY(p.y - 1.42)), .46, { segments: 24, sides: 8 }));
    add('paving', surface(points.map(p => { const across = new THREE.Vector3(link.to[2] - link.from[2], 0, link.from[0] - link.to[0]).normalize(); return [p.clone().addScaledVector(across, 1.1).setY(p.y - .95), p.clone().addScaledVector(across, -1.1).setY(p.y - .95)]; })), { detail: true });
    for (let i = 0; i <= 24; i += 4) {
      const tangent = points[Math.min(24, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
      const hoop = new THREE.TorusGeometry(1.56, .09, 5, 28); hoop.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent));
      add('white', hoop, { at: points[i].toArray(), detail: i % 8 !== 0 });
    }
  }

  // ---- Information pods on stalks -----------------------------------------
  for (const pod of pods) {
    const { x, z, height, radius: r } = pod, y = DECK + height;
    add('white', lathe([[.9, DECK], [.62, DECK + .5], [.4, DECK + height * .5], [.5, y - r * .7], [1.2, y - r * .55]], { segments: 18 }), { at: [x, 0, z] });
    add('white', new THREE.SphereGeometry(1, 36, 22), { at: [x, y, z], scale: [r, r * .8, r] });
    const face = Math.atan2(-pod.frame.nz * pod.side, -pod.frame.nx * pod.side);
    // Two softly lit display bands wrap the side that faces the water.
    const band = (finish, from, to, low, high) => {
      const rows = Array.from({ length: 13 }, (_, i) => { const a = face + from + (to - from) * i / 12; return [low, high].map(v => ({ x: x + Math.cos(a) * r * 1.03 * Math.cos(v), y: y + Math.sin(v) * r * .824, z: z + Math.sin(a) * r * 1.03 * Math.cos(v) })); });
      add(finish, surface(rows, { away: { x, y, z } }), { detail: true });
    };
    band('amber', -.95, -.2, -.16, .2); band('azure', -.1, .95, -.16, .2);
    add('glass', lathe([[r * .96, y + r * .27], [r * .86, y + r * .42]], { segments: 30, facade: { bays: 16, floor: 3, seed: x } }), { at: [x, 0, z], tint: 0x8fd0ea });
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; plantings.vines.push({ x: x + Math.cos(a) * r * .72, y: y - r * .55, z: z + Math.sin(a) * r * .72, angle: a, drop: 2 + random() * 3.5 }); }
  }

  // ---- Garden spheres ------------------------------------------------------
  for (const sphere of spheres) {
    const { x, y, z, r } = sphere, floor = y - r * .38, bowl = [];
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI / 2 - .39) * i / 10; bowl.push([Math.max(.02, Math.cos(a) * r * .975), y + Math.sin(a) * r * .975]); }
    add('white', lathe(bowl, { segments: 44 }), { at: [x, 0, z] });
    ring(x, z, floor + .05, r * .9, { out: r * .035, tall: r * .05, segments: 44 });
    const lawnRows = Array.from({ length: 6 }, (_, j) => Array.from({ length: 33 }, (_, i) => {
      const a = i / 32 * TAU, radial = r * .9 * j / 5;
      return { x: x + Math.cos(a) * radial, y: floor + r * .13 * Math.cos(j / 5 * Math.PI / 2), z: z + Math.sin(a) * radial };
    }));
    add('lawn', surface(lawnRows));
    add('bubble', new THREE.SphereGeometry(r, 56, 40), { at: [x, y, z] });
    plantings.trees.push({ x, y: floor + r * .11, z, scale: r / 10.5, hero: true, high: true });
    const extras = Math.round(r * .9);
    for (let i = 0; i < extras; i++) {
      const a = i / extras * TAU + r, reach = r * (.42 + .32 * random()), px = x + Math.cos(a) * reach, pz = z + Math.sin(a) * reach, py = floor + r * .13 * Math.cos(reach / (r * .9) * Math.PI / 2) - .05;
      (i % 2 ? plantings.shrubs : plantings.trees).push({ x: px, y: py, z: pz, scale: (i % 2 ? .5 : .32) * r / 9 + random() * .08, high: true });
    }
    for (let i = 0; i < r * 2.4; i++) { const a = random() * TAU; plantings.vines.push({ x: x + Math.cos(a) * r * .9, y: floor - .1, z: z + Math.sin(a) * r * .9, angle: a, drop: r * (.12 + random() * .2), inward: true }); }
  }

  // ---- The basin ring beneath the great sphere -----------------------------
  add('white', lathe([[23, -1.6], [23, .2], [22.7, .55], [22.2, .78], [18.4, .78], [17.9, .55], [17.6, .2], [17.6, -1.6]], { segments: 72 }), { at: [basin.x, 0, basin.z] });
  add('glow', lathe([[20.7, .8], [19.9, .8]], { segments: 72 }), { at: [basin.x, 0, basin.z], detail: true });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, px = basin.x + Math.cos(a) * 20.3, pz = basin.z + Math.sin(a) * 20.3;
    if (i % 2) plantings.shrubs.push({ x: px, y: .7, z: pz, scale: .6 });
    else add('white', lathe([[.5, .7], [.9, .9], [1, 1.3], [.86, 1.4]], { segments: 16 }), { at: [px, 0, pz], detail: true });
  }
}
