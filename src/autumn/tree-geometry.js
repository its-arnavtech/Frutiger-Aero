import * as THREE from 'three';
import { rng, TAU } from './layout.js';

// A spreading deciduous crown: every spray grows from a modeled twig, every
// twig joins a fork, and the major limbs emerge low on a flared trunk.
export function createDeciduousGeometry(seed, { hero = false, kind = 0 } = {}) {
  const random = rng(seed), wood = { position: [], uv: [], index: [] }, leaf = { position: [], normal: [], uv: [], color: [], index: [] };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  let reflectionIndexCount = 0;
  function limb(points, r0, r1, sections, sides, flare = false) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal'), offset = wood.position.length / 3, length = curve.getLength();
    const axis = curve.getTangent(.5), reference = Math.abs(axis.y) < .9 ? v(0, 1, 0) : v(1, 0, 0);
    for (let i = 0; i <= sections; i++) {
      const t = i / sections, p = curve.getPoint(t), tangent = curve.getTangent(t);
      const across = new THREE.Vector3().crossVectors(tangent, reference).normalize(), up = new THREE.Vector3().crossVectors(across, tangent).normalize();
      const radius = r1 + (r0 - r1) * (1 - t) ** .85;
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * TAU, swell = 1 + (flare ? .25 * Math.cos(a * 5 + .4) * Math.exp(-t * 8) : .045 * Math.sin(a * 3 + t * 8));
        const q = p.clone().addScaledVector(across, Math.cos(a) * radius * swell).addScaledVector(up, Math.sin(a) * radius * swell);
        wood.position.push(q.x, q.y, q.z); wood.uv.push(j / sides, t * length * 22);
        if (i < sections && j < sides) { const n = offset + i * (sides + 1) + j; wood.index.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2); }
      }
    }
    return curve;
  }
  function spray(origin, size, turn) {
    // Each quad carries one photographed leaf and has a small physical twist.
    // Leaves retain their own normals rather than shading a whole spray flat.
    const normal = v((random() - .5) * 1.8, .12 + random() * .88, (random() - .5) * 1.8).normalize();
    const right = new THREE.Vector3().crossVectors(v(Math.cos(turn), .15, Math.sin(turn)), normal).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    // A tree changes colour by species and exposure. Uniform random colours on
    // every twig made all crowns read as the same orange/green confetti.
    const pick = random(), preferred = kind === 1 ? 1 : kind === 2 ? 0 : 2;
    const atlas = pick < .78 ? preferred : pick < .92 ? 3 : Math.floor(random() * 4);
    const offset = leaf.position.length / 3;
    const shelter = THREE.MathUtils.clamp(origin.y * .7 + Math.hypot(origin.x, origin.z) * .55, .3, 1);
    const tone = (.77 + random() * .21) * (.67 + shelter * .33);
    for (const [x, y, u, w] of [[-.5, -.5, 0, 0], [.5, -.5, 1, 0], [.5, .5, 1, 1], [-.5, .5, 0, 1]]) {
      const p = origin.clone().addScaledVector(right, x * size).addScaledVector(up, y * size).addScaledVector(normal, x * y * size * .4);
      leaf.position.push(p.x, p.y, p.z); leaf.normal.push(normal.x, normal.y, normal.z);
      leaf.uv.push((atlas % 2 + .018 + u * .964) * .5, (Math.floor(atlas / 2) + .018 + w * .964) * .5);
      leaf.color.push(tone, tone, tone);
    }
    leaf.index.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  const lean = (random() - .5) * .13;
  const trunk = limb([v(0, -.012, 0), v(lean * .2, .14, -.008), v(lean, .33, .018), v(lean + .028, .57, -.025)], hero ? .048 : .024, .005, hero ? 18 : 12, hero ? 14 : 10, true);
  for (let i = 0; i < (hero ? 8 : 5); i++) {
    const a = i * TAU / (hero ? 8 : 5) + random() * .4, reach = .065 + random() * .065;
    limb([v(Math.cos(a) * .015, .06, Math.sin(a) * .015), v(Math.cos(a) * reach * .6, .01, Math.sin(a) * reach * .6), v(Math.cos(a) * reach, -.016, Math.sin(a) * reach)], .018, .001, 4, 5);
  }
  const major = [], majorCount = 7;
  for (let i = 0; i < majorCount; i++) {
    const level = i / (majorCount - 1), a = i * 2.39996 + random() * 1.15, start = trunk.getPoint(.17 + level * .76);
    const reach = (.57 - level * .31) * (.7 + random() * .6), top = .4 + level * .43 + random() * .13 + (kind === 2 ? .08 : 0);
    const end = v(Math.cos(a) * reach, top, Math.sin(a) * reach);
    const c = limb([start, start.clone().add(v(Math.cos(a + .25) * .11, .09, Math.sin(a + .25) * .11)), v(end.x * .65, top - .09, end.z * .65), end], (hero ? .025 : .016) * (1 - level * .65), .0018, hero ? 12 : 8, hero ? 10 : 7);
    major.push({ c, a });
  }
  // Keep the complete trunk and major boughs in the water reflection.
  reflectionIndexCount = wood.index.length;
  for (const { c: main, a } of major) for (let j = 0; j < (hero ? 4 : 3); j++) {
    const start = main.getPoint(.4 + j / (hero ? 4 : 3) * .57), side = a + (j % 2 ? -1 : 1) * (.45 + random() * .8);
    const end = start.clone().add(v(Math.cos(side) * (.13 + random() * .13), .12 + random() * .19, Math.sin(side) * (.13 + random() * .13)));
    const fork = limb([start, start.clone().lerp(end, .45).add(v(0, .035, 0)), end], .009, .0028, hero ? 6 : 4, hero ? 7 : 5);
    for (let k = 0; k < (hero ? 4 : 3); k++) {
      const base = fork.getPoint(.35 + k / (hero ? 4 : 3) * .63), angle = side + (k % 2 ? -1 : 1) * (random() * 1.2 + .3);
      const tip = base.clone().add(v(Math.cos(angle) * (.055 + random() * .095), .025 + random() * .1, Math.sin(angle) * (.055 + random() * .095)));
      const twig = limb([base, base.clone().lerp(tip, .5).add(v(0, .012, 0)), tip], .0033, .0007, hero ? 4 : 2, hero ? 5 : 4);
      for (let t = 0; t < 2; t++) {
        const origin = twig.getPoint(.5 + t * .45), twigAngle = angle + (t ? -.8 : .8);
        const terminal = origin.clone().add(v(Math.cos(twigAngle) * .055, .035 + random() * .025, Math.sin(twigAngle) * .055));
        const shoot = limb([origin, terminal], .001, .00015, hero ? 2 : 1, 3);
        for (let n = 0; n < (hero ? 72 : 38); n++) {
          const where = shoot.getPoint(.12 + random() * .88);
          where.add(v((random() - .5) * .17, (random() - .5) * .11, (random() - .5) * .17));
          const size = (hero ? .016 : .027) + random() * (hero ? .012 : .018);
          spray(where, size, random() * TAU);
          spray(where.clone().add(v(.012 * Math.cos(n), .015, .012 * Math.sin(n))), size * .85, random() * TAU);
        }
      }
    }
  }
  const branches = new THREE.BufferGeometry(); branches.setAttribute('position', new THREE.Float32BufferAttribute(wood.position, 3)); branches.setAttribute('uv', new THREE.Float32BufferAttribute(wood.uv, 2)); branches.setIndex(wood.index); branches.computeVertexNormals();
  const leaves = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) leaves.setAttribute(name, new THREE.Float32BufferAttribute(leaf[name], name === 'uv' ? 2 : 3));
  leaves.setIndex(leaf.index); leaves.computeVertexNormals(); leaves.computeBoundingBox(); branches.computeBoundingBox();
  const height = Math.max(leaves.boundingBox.max.y, branches.boundingBox.max.y);
  let radius = 0;
  for (const geometry of [leaves, branches]) for (let i = 0; i < geometry.attributes.position.count; i++) radius = Math.max(radius, Math.hypot(geometry.attributes.position.getX(i), geometry.attributes.position.getZ(i)));
  const crownRatio = hero ? 20 / 26 : .42, horizontal = crownRatio / radius;
  for (const geometry of [leaves, branches]) { geometry.scale(horizontal, 1 / height, horizontal); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return { leaves, branches, reflectionIndexCount };
}
