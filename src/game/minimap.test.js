import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapToWorld, shopMapBounds, worldToMap } from './minimap.js';

describe('minimap', () => {
  it('round-trips world points through canvas pixels, including yaw', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const samples = [
      { x: 0, z: 0 },
      { x: 2.4, z: 6.2 },
      { x: -3.1, z: 8.8 },
    ];
    for (const yaw of [0, 0.7, -1.2]) {
      for (const sample of samples) {
        const mapped = worldToMap(sample.x, sample.z, bounds, size, yaw);
        const back = mapToWorld(mapped.x, mapped.y, bounds, size, yaw);
        assert.ok(Math.abs(back.x - sample.x) < 1e-6, `x yaw=${yaw}`);
        assert.ok(Math.abs(back.z - sample.z) < 1e-6, `z yaw=${yaw}`);
      }
    }
  });
});
