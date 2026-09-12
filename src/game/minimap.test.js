import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  clampMapZoom,
  mapToWorld,
  shopMapBounds,
  worldToMap,
} from './minimap.js';

describe('minimap', () => {
  it('round-trips world points through canvas pixels, including yaw and zoom', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const samples = [
      { x: 0, z: 0 },
      { x: 2.4, z: 6.2 },
      { x: -3.1, z: 8.8 },
    ];
    for (const yaw of [0, 0.7, -1.2]) {
      for (const zoom of [1, 1.4, 2]) {
        for (const sample of samples) {
          const mapped = worldToMap(sample.x, sample.z, bounds, size, yaw, zoom);
          const back = mapToWorld(mapped.x, mapped.y, bounds, size, yaw, zoom);
          assert.ok(Math.abs(back.x - sample.x) < 1e-6, `x yaw=${yaw} zoom=${zoom}`);
          assert.ok(Math.abs(back.z - sample.z) < 1e-6, `z yaw=${yaw} zoom=${zoom}`);
        }
      }
    }
  });

  it('flips the map 180 degrees so +Z draws toward the bottom at yaw 0', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const north = worldToMap(cx, cz + 2, bounds, size, 0);
    const south = worldToMap(cx, cz - 2, bounds, size, 0);
    assert.ok(north.y > south.y, 'after 180 flip, +Z should be lower on the canvas');
  });

  it('clamps zoom to a usable range', () => {
    assert.equal(clampMapZoom(0), MAP_ZOOM_MIN);
    assert.equal(clampMapZoom(99), MAP_ZOOM_MAX);
    assert.equal(clampMapZoom(Number.NaN), 1);
  });
});
