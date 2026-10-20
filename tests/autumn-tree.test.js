import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeciduousGeometry } from '../src/autumn/tree-geometry.js';
import { thinned } from '../src/foliage-tools.js';

test('complete autumn tree geometry fits the canopy bounds used for flight clearance and culling', () => {
  for (let variant = 0; variant < 7; variant++) {
    const hero = variant === 6, tree = createDeciduousGeometry(7193 + variant * 817, { hero, kind: hero ? 3 : variant % 3 });
    for (const geometry of [tree.leaves, tree.branches]) {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
        assert.ok(Number.isFinite(n.getX(i) + n.getY(i) + n.getZ(i)));
        assert.ok(p.getY(i) <= 1.00001 && p.getY(i) > -.05);
        assert.ok(Math.hypot(p.getX(i), p.getZ(i)) <= (hero ? 20 / 26 : .42) + .00001);
      }
      geometry.dispose();
    }
    assert.ok(tree.reflectionIndexCount > 0 && tree.reflectionIndexCount < tree.branches.index.count);
  }
});

test('individual leaf UVs stay inside one atlas cell, including the simplified water reflection', () => {
  const tree = createDeciduousGeometry(7193), reflected = thinned(tree.leaves, 14, 2.8, 1.1);
  for (const geometry of [tree.leaves, reflected]) {
    const uv = geometry.attributes.uv, cells = new Set();
    for (let i = 0; i < uv.count; i += 4) {
      const column = Math.floor(uv.getX(i) * 2), row = Math.floor(uv.getY(i) * 2);
      cells.add(`${column},${row}`);
      for (let j = 0; j < 4; j++) {
        const x = uv.getX(i + j) * 2, y = uv.getY(i + j) * 2;
        assert.ok(x > column && x < column + 1 && y > row && y < row + 1, 'A leaf samples its neighbouring atlas cell');
      }
    }
    assert.equal(cells.size, 4, 'Natural leaf variations are missing');
  }
  assert.ok(reflected.index.count < tree.leaves.index.count / 10);
  for (const g of [tree.leaves, tree.branches, reflected]) g.dispose();
});
