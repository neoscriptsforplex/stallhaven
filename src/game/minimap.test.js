import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  TRAPDOOR_MARKER_FILE,
  TRAPDOOR_MARKER_RADIUS,
  clampMapZoom,
  mapToWorld,
  shopMapBounds,
  trapdoorMarkerUrls,
  worldToMap,
} from './minimap.js';
import { FOUNTAIN, PATH_HALF_W, TRAPDOOR } from './layout.js';

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

  it('mirrors left/right so a left-side click walks toward world −X', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const left = worldToMap(cx - 2, cz, bounds, size, 0);
    const right = worldToMap(cx + 2, cz, bounds, size, 0);
    assert.ok(left.x < right.x, 'world −X should sit on the left of the map');
    const clickLeft = mapToWorld(size * 0.25, size * 0.5, bounds, size, 0);
    const clickRight = mapToWorld(size * 0.75, size * 0.5, bounds, size, 0);
    assert.ok(clickLeft.x < clickRight.x, 'clicking left should walk toward world −X');
  });

  it('clamps zoom to a usable range', () => {
    assert.equal(clampMapZoom(0), MAP_ZOOM_MIN);
    assert.equal(clampMapZoom(99), MAP_ZOOM_MAX);
    assert.equal(clampMapZoom(Number.NaN), 1);
  });

  it('places a fountain-sized trapdoor marker at the outdoor hatch', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const camYaw = -0.06;
    for (const yaw of [0, camYaw]) {
      const path = worldToMap(0, TRAPDOOR.z, bounds, size, yaw);
      const hatch = worldToMap(TRAPDOOR.x, TRAPDOOR.z, bounds, size, yaw);
      const fountain = worldToMap(FOUNTAIN.x, FOUNTAIN.z, bounds, size, yaw);
      const back = mapToWorld(hatch.x, hatch.y, bounds, size, yaw);
      assert.ok(Math.abs(back.x - TRAPDOOR.x) < 1e-6, `round-trip x yaw=${yaw}`);
      assert.ok(Math.abs(back.z - TRAPDOOR.z) < 1e-6, `round-trip z yaw=${yaw}`);
      assert.ok(Math.hypot(hatch.x - fountain.x, hatch.y - fountain.y) > 8);
      assert.ok(hatch.x > path.x, `icon stays on the hatch side of the path, yaw=${yaw}`);
      assert.ok(Math.abs(hatch.y - path.y) < 4, `icon stays at hatch depth, yaw=${yaw}`);
    }
    assert.equal(TRAPDOOR_MARKER_RADIUS, 5);
    assert.ok(TRAPDOOR.x > PATH_HALF_W, 'world hatch sits on the right of the cobble path');
    assert.ok(TRAPDOOR.x > 0, 'do not mirror the entrance onto −X for the marker');
  });

  it('ships a dungeon-entrance icon and looks it up from public/minimap', () => {
    const pngPath = join(dirname(fileURLToPath(import.meta.url)), '../../public', TRAPDOOR_MARKER_FILE);
    const png = readFileSync(pngPath);
    assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(png.length > 100);
    const urls = trapdoorMarkerUrls();
    assert.ok(urls.some((url) => url.endsWith('minimap/trapdoor.png')));
    assert.ok(urls.some((url) => url.includes('public/minimap/trapdoor.png')));
  });
});
