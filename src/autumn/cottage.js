import * as THREE from 'three';
import { rod } from '../build.js';
import { terrainHeight } from './layout.js';

export function buildCottage(cabin, batch, lantern) {
  const windows = [];
  const { x, z, turn, scale: s } = cabin, y = Math.max(2.6, terrainHeight(x, z));
  const local = (a, b, c) => [x + (a * Math.cos(turn) + c * Math.sin(turn)) * s, y + b * s, z + (-a * Math.sin(turn) + c * Math.cos(turn)) * s];
  const block = (key, w, h, d, a, b, c, twist = 0) => batch.add(key, new THREE.BoxGeometry(w * s, h * s, d * s), { at: local(a, b, c), turn: [0, turn + twist, 0] });
  const beam = (key, from, to, radius) => batch.add(key, rod(local(...from), local(...to), radius * s, { sides: 8 }));

  block('stone', 10.4, 1.2, 8.7, 0, .1, 0);
  for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
    for (let a = -4.8; a < 5; a += .84) block('stone', .78, .33, .3, a + (row % 2) * .13, -.36 + row * .37, side * 4.4);
    for (let c = -4; c < 4.1; c += .84) block('stone', .3, .33, .78, side * 5.25, -.36 + row * .37, c + (row % 2) * .13);
  }
  block('wood', 9.2, .18, 7.4, 0, .72, 0);

  function wall(axis, side, width, bottom, top, plane, openings) {
    const put = (key, w, h, d, u, v, offset = 0) => axis === 'z'
      ? block(key, w, h, d, u, v, side * (plane + offset))
      : block(key, d, h, w, side * (plane + offset), v, u);
    // Divide the wall around actual openings. No solid wall is left behind
    // glass or doors; the reveals and interior are visible from oblique views.
    const xs = [...new Set([-width / 2, width / 2, ...openings.flatMap(o => [o.u - o.w / 2, o.u + o.w / 2])])].sort((a, b) => a - b);
    const ys = [...new Set([bottom, top, ...openings.flatMap(o => [o.v - o.h / 2, o.v + o.h / 2])])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const u = (xs[i] + xs[i + 1]) / 2, v = (ys[j] + ys[j + 1]) / 2;
      if (openings.some(o => Math.abs(u - o.u) < o.w / 2 && Math.abs(v - o.v) < o.h / 2)) continue;
      put('plaster', xs[i + 1] - xs[i], ys[j + 1] - ys[j], .3, u, v, -.1);
    }
    for (const o of openings) {
      if (o.door) {
        put('interior', o.w, o.h, .08, o.u, o.v, -.25);
        put('wood', o.w - .12, o.h - .12, .14, o.u, o.v, -.08);
        for (const dy of [-.67, .64]) put('pale', o.w - .42, .84, .05, o.u, o.v + dy, .02);
        put('metal', .08, .25, .12, o.u + .43, o.v, .1);
      } else {
        const centre = axis === 'z' ? local(o.u, o.v, side * plane) : local(side * plane, o.v, o.u);
        const normal = new THREE.Vector3(axis === 'x' ? side : 0, 0, axis === 'z' ? side : 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
        windows.push({ centre: new THREE.Vector3(...centre), normal });
        put('interior', o.w, o.h, .08, o.u, o.v, -.65);
        put('pale', o.w - .1, .08, .65, o.u, o.v - o.h / 2 + .08, -.3);
        for (const edge of [-1, 1]) {
          put('curtain', .26, o.h - .18, .04, o.u + edge * (o.w / 2 - .19), o.v, -.26);
          put('wood', .12, o.h + .16, .32, o.u + edge * o.w / 2, o.v, -.03);
        }
        put('glass', o.w - .12, o.h - .12, .025, o.u, o.v, -.11);
        put('wood', .065, o.h, .12, o.u, o.v, .04);
        put('wood', o.w, .07, .12, o.u, o.v + .18, .04);
        // A shallow awning and deep sill cast real contact shadows.
        put('wood', o.w + .34, .16, .48, o.u, o.v + o.h / 2 + .1, .12);
        put('stone', o.w + .38, .14, .54, o.u, o.v - o.h / 2 - .06, .13);
      }
      for (const dy of [-1, 1]) put('wood', o.w + .14, .12, .18, o.u, o.v + dy * o.h / 2, .03);
    }
    for (const u of [-width / 2, width / 2]) put('wood', .24, top - bottom, .28, u, (top + bottom) / 2, .03);
    for (const v of [bottom + .12, top - .12]) put('wood', width + .2, .22, .28, 0, v, .03);
  }

  for (const side of [-1, 1]) {
    wall('z', side, 9.2, .8, 6, 3.7, [
      { u: -2.7, v: 3.35, w: 2.3, h: 2.65 }, { u: 2.7, v: 3.35, w: 2.3, h: 2.65 },
      { u: 0, v: 2.25, w: 1.4, h: 2.9, door: true },
    ]);
    wall('x', side, 7.4, .8, 6, 4.6, [{ u: -1.85, v: 3.35, w: 2.35, h: 2.65 }, { u: 1.85, v: 3.35, w: 2.35, h: 2.65 }]);
    // A ventilated attic with a glazed opening in the actual gable geometry.
    const shape = new THREE.Shape(); shape.moveTo(-3.7, 6); shape.lineTo(3.7, 6); shape.lineTo(0, 8.13); shape.closePath();
    const hole = new THREE.Path(); hole.absellipse(0, 6.8, .48, .48, 0, Math.PI * 2, true); shape.holes.push(hole);
    const gable = new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: false, curveSegments: 20 });
    gable.rotateY(side * Math.PI / 2); gable.scale(s, s, s); gable.rotateY(turn); batch.add('plaster', gable, { at: local(side * 4.4, 0, 0) });
    const frame = new THREE.TorusGeometry(.51 * s, .065 * s, 8, 28); frame.rotateY(Math.PI / 2 + turn); batch.add('wood', frame, { at: local(side * 4.65, 6.8, 0) });
    block('interior', .05, .9, .9, side * 4.36, 6.8, 0);
    block('glass', .025, .82, .82, side * 4.5, 6.8, 0);
    block('wood', .1, .94, .055, side * 4.66, 6.8, 0);
    block('wood', .1, .055, .94, side * 4.66, 6.8, 0);
    beam('wood', [side * 4.7, 6, -3.9], [side * 4.7, 8.25, 0], .09);
    beam('wood', [side * 4.7, 8.25, 0], [side * 4.7, 6, 3.9], .09);
  }
  for (const side of [-1, 1]) {
    const under = new THREE.BoxGeometry(11.8 * s, .19 * s, 5.8 * s); under.rotateX(side * .46); under.rotateY(turn);
    batch.add('roof', under, { at: local(0, 6.73, side * 2.45) });
    for (let row = 0; row < 12; row++) for (let col = 0; col < 20; col++) {
      const along = .12 + row * .43, a = -5.68 + col * .58 + (row % 2) * .15;
      const shingle = new THREE.BoxGeometry(.56 * s, .075 * s, .62 * s); shingle.rotateX(side * .46); shingle.rotateY(turn);
      const shade = ((col * 13 + row * 7 + Math.round(x)) % 3 + 3) % 3;
      batch.add(['shingles', 'shinglesLight', 'shinglesDark'][shade], shingle, { at: local(a, 8.22 - along * Math.tan(.46) + (col % 3) * .012, side * along) });
    }
    for (let a = -5.5; a <= 5.6; a += .68) beam('wood', [a, 8.02, 0], [a, 5.44, side * 5.1], .085);
    beam('metal', [-5.9, 5.58, side * 5.19], [5.9, 5.58, side * 5.19], .075);
    beam('metal', [5.65, 5.58, side * 5.19], [5.65, .4, side * 5.19], .055);
  }
  beam('wood', [-6.05, 8.24, 0], [6.05, 8.24, 0], .15);
  // Chimney masonry, cap and chimney pots break the repeated roof silhouette.
  if (!cabin.temple) {
    block('stone', 1.15, 2.5, .95, -2.7, 8.2, -1.3);
    for (let row = 0; row < 7; row++) block('stone', 1.2, .08, 1.02, -2.7, 7.05 + row * .34, -1.3);
    block('stone', 1.42, .18, 1.2, -2.7, 9.5, -1.3);
    for (const a of [-2.96, -2.44]) batch.add('copper', new THREE.CylinderGeometry(.16 * s, .2 * s, .55 * s, 12), { at: local(a, 9.85, -1.3) });
  }
  for (let a = -5; a <= 5; a += .4) block('pale', .37, .16, 2.5, a, .8, 4.75);
  for (const a of [-5, 0, 5]) block('wood', .25, 3.1, .25, a, -.6, 5.8);
  for (let step = 0; step < 4; step++) block('wood', 2.1, .18, .5, 0, .6 - step * .2, 6 + step * .42);
  for (const a of [-4.9, -1.4, 1.4, 4.9]) block('wood', .13, 1.05, .13, a, 1.4, 5.85);
  for (const a of [-3.15, 3.15]) block('wood', 3.65, .12, .12, a, 1.88, 5.85);
  for (const a of [-4, 4]) lantern(...local(a, 4.35, 4.8), .36 * s);
  if (cabin.temple) {
    for (const side of [-1, 1]) {
      wall('z', side, 5, 7.3, 9.8, 2, [{ u: -1.25, v: 8.65, w: 1.5, h: 1.65 }, { u: 1.25, v: 8.65, w: 1.5, h: 1.65 }]);
      wall('x', side, 4, 7.3, 9.8, 2.5, [{ u: 0, v: 8.65, w: 2.2, h: 1.65 }]);
      const upperGable = new THREE.Shape(); upperGable.moveTo(-2, 9.8); upperGable.lineTo(2, 9.8); upperGable.lineTo(0, 10.96); upperGable.closePath();
      const infill = new THREE.ExtrudeGeometry(upperGable, { depth: .18, bevelEnabled: false });
      infill.rotateY(side * Math.PI / 2); infill.scale(s, s, s); infill.rotateY(turn); batch.add('plaster', infill, { at: local(side * 2.38, 0, 0) });
      const roof = new THREE.BoxGeometry(7.6 * s, .22 * s, 3.7 * s); roof.rotateX(side * .48); roof.rotateY(turn); batch.add('copper', roof, { at: local(0, 10.2, side * 1.5) });
      for (let a = -3.5; a < 3.6; a += .4) beam('metal', [a, 11.14, 0], [a, 9.4, side * 3.32], .025);
    }
    beam('wood', [-3.85, 11.15, 0], [3.85, 11.15, 0], .11);
  }
  return { windows };
}
