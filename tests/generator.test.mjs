import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN_ANGLE, generateBouquet } from '../src/flowers/SunflowerGenerator.js';
import { nearestBucket, smoothCurve } from '../src/scene/CanvasFallbackWorld.js';

test('uses the canonical golden angle for phyllotaxis', () => {
  assert.ok(Math.abs(GOLDEN_ANGLE - Math.PI * (3 - Math.sqrt(5))) < 1e-12);
});

test('builds typed BufferGeometry with bloom attributes', () => {
  const profile = { name: 'test', mobile: true, discs: 12, petalSamples: 3, leaves: 4, filler: 8, wrapping: 12, dust: 4 };
  const bouquet = generateBouquet(profile);
  assert.ok(bouquet.count > 1_000);
  for (const attribute of ['position', 'aStart', 'aColor', 'aSize', 'aBirth', 'aDuration', 'aPhase', 'aRole']) {
    assert.ok(bouquet.geometry.getAttribute(attribute), `${attribute} must exist`);
  }
  assert.equal(bouquet.geometry.getAttribute('position').count, bouquet.count);
});

test('Canvas fallback preserves easing and palette bucketing', () => {
  assert.equal(smoothCurve(-1), 0);
  assert.equal(smoothCurve(0.5), 0.5);
  assert.equal(smoothCurve(2), 1);
  assert.ok(Number.isInteger(nearestBucket(255, 197, 54)));
});
