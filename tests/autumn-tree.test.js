import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeciduousGeometry } from '../src/autumn/tree-geometry.js';

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
