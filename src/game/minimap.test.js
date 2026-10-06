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
  drawMinimap,
  dungeonEntranceMarkerWorld,
  dungeonFloorRect,
  dungeonMapBounds,
  dungeonMapFocus,
  dungeonShellRect,
  mapToWorld,
  minimapFrame,
  shopMapBounds,
  trapdoorMarkerUrls,
  worldToMap,
} from './minimap.js';
import { SHOP } from './catalog.js';
import { FOUNTAIN, PATH_HALF_W, TRAPDOOR } from './layout.js';
import { DUNGEON_BOULDERS } from './shopbuild.js';
import { PLAYER_RADIUS, dungeonMoveObstacles, isWalkable, planWalk } from './nav.js';

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

  it('spins left/right the other way when the camera yaws, and clicks still match', () => {
    const bounds = shopMapBounds([]);
    const size = 196;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const yaw = 0.6;
    const ahead = worldToMap(cx, cz + 2, bounds, size, yaw);
    const center = worldToMap(cx, cz, bounds, size, yaw);
    assert.ok(ahead.x < center.x, 'positive yaw should swing +Z toward the left');
    const back = mapToWorld(ahead.x, ahead.y, bounds, size, yaw);
    assert.ok(Math.abs(back.x - cx) < 1e-6);
    assert.ok(Math.abs(back.z - (cz + 2)) < 1e-6);
    const clickLeft = mapToWorld(size * 0.25, size * 0.5, bounds, size, yaw);
    const clickRight = mapToWorld(size * 0.75, size * 0.5, bounds, size, yaw);
    assert.ok(clickLeft.x < clickRight.x, 'a left click still walks to the lesser world X');
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
    const focus = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    const mark = dungeonEntranceMarkerWorld(TRAPDOOR);
    const leftoverLeft = dungeonEntranceMarkerWorld({ x: -TRAPDOOR.x, z: TRAPDOOR.z });
    assert.equal(mark.x, TRAPDOOR.x);
    assert.equal(mark.z, TRAPDOOR.z);
    assert.equal(leftoverLeft.x, TRAPDOOR.x, 'a mirrored −X hatch still maps to path-right');
    assert.equal(TRAPDOOR_MARKER_RADIUS, 5);
    assert.ok(TRAPDOOR.x > PATH_HALF_W, 'world hatch sits on the right of the cobble path');
    assert.ok(mark.x > PATH_HALF_W, 'marker uses the circled right-side of the path');
    for (const yaw of [0, camYaw]) {
      for (const origin of [null, focus]) {
        const path = worldToMap(0, TRAPDOOR.z, bounds, size, yaw, 1, origin);
        const hatch = worldToMap(mark.x, mark.z, bounds, size, yaw, 1, origin);
        const oldLeft = worldToMap(-TRAPDOOR.x, TRAPDOOR.z, bounds, size, yaw, 1, origin);
        const fountain = worldToMap(FOUNTAIN.x, FOUNTAIN.z, bounds, size, yaw, 1, origin);
        const back = mapToWorld(hatch.x, hatch.y, bounds, size, yaw, 1, origin);
        assert.ok(Math.abs(back.x - mark.x) < 1e-6, `round-trip x yaw=${yaw}`);
        assert.ok(Math.abs(back.z - mark.z) < 1e-6, `round-trip z yaw=${yaw}`);
        assert.ok(Math.hypot(hatch.x - fountain.x, hatch.y - fountain.y) > 8);
        assert.ok(hatch.x > path.x, `icon sits on the circled right of the path, yaw=${yaw}`);
        assert.ok(oldLeft.x < path.x, `the leftover left-side icon stays opposite, yaw=${yaw}`);
        assert.ok(Math.abs(hatch.y - path.y) < 4, `icon stays at hatch depth, yaw=${yaw}`);
        assert.ok(Math.abs(hatch.y - fountain.y) < 8, `icon stays near fountain height, yaw=${yaw}`);
      }
    }
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

  it('frames the dungeon on the room centre so the whole layout fits at any yaw', () => {
    const bounds = dungeonMapBounds();
    const focus = dungeonMapFocus();
    const shell = dungeonShellRect();
    const floor = dungeonFloorRect();
    const size = 196;
    assert.equal(focus.x, 0);
    assert.equal(focus.z, 0);
    assert.ok(floor.minX > shell.minX && floor.maxX < shell.maxX);
    assert.ok(floor.minZ > shell.minZ && floor.maxZ < shell.maxZ);
    const frame = minimapFrame({
      sceneMode: 'dungeon',
      player: { x: -4.15, z: 0.4 },
    });
    assert.deepEqual(frame.focus, focus);
    assert.deepEqual(frame.bounds, bounds);
    const shop = minimapFrame({
      sceneMode: 'shop',
      player: { x: 1.2, z: 3.4 },
      expansions: [],
    });
    assert.deepEqual(shop.focus, { x: 1.2, z: 3.4 });
    assert.deepEqual(shop.bounds, shopMapBounds([]));

    const marks = [
      { x: shell.minX, z: shell.minZ },
      { x: shell.maxX, z: shell.minZ },
      { x: shell.minX, z: shell.maxZ },
      { x: shell.maxX, z: shell.maxZ },
      { x: -5.15, z: 0.4 },
      ...DUNGEON_BOULDERS.map((spot) => ({ x: spot.x, z: spot.z })),
      { x: -2.8, z: 1.8 },
      { x: -2.6, z: -1.9 },
      { x: 2.7, z: 1.6 },
      { x: 2.8, z: -1.8 },
    ];
    for (const yaw of [0, 0.8, -1.4, 2.2]) {
      for (const mark of marks) {
        const pt = worldToMap(mark.x, mark.z, bounds, size, yaw, 1, focus);
        assert.ok(pt.x > 1 && pt.x < size - 1, `x ${mark.x} yaw ${yaw} -> ${pt.x}`);
        assert.ok(pt.y > 1 && pt.y < size - 1, `y ${mark.z} yaw ${yaw} -> ${pt.y}`);
        const back = mapToWorld(pt.x, pt.y, bounds, size, yaw, 1, focus);
        assert.ok(Math.abs(back.x - mark.x) < 1e-6);
        assert.ok(Math.abs(back.z - mark.z) < 1e-6);
      }
    }
  });

  it('paints dungeon floor, walls, rocks, ladder, rats and the player, and keeps the shop map', () => {
    const { ctx, ops } = mockMapCtx();
    const rocks = DUNGEON_BOULDERS.map((spot) => ({
      id: spot.id,
      x: spot.x,
      z: spot.z,
      scale: spot.scale ?? 1,
      vein: spot.vein,
      essence: Boolean(spot.essence),
    }));
    drawMinimap(ctx, {
      sceneMode: 'dungeon',
      yaw: 0.2,
      zoom: 1,
      bounds: dungeonMapBounds(),
      focus: dungeonMapFocus(),
      player: { x: -4.15, z: 0.4, facing: Math.PI / 2 },
      rocks,
      ladder: { x: -5.15, z: 0.4 },
      rats: [
        { x: -2.8, z: 1.8 },
        { x: -2.6, z: -1.9 },
        { x: 2.7, z: 1.6 },
        { x: 2.8, z: -1.8 },
      ],
    });
    const fills = ops.filter((op) => op.fill).map((op) => op.fill);
    assert.ok(fills.includes('#4e4338'), 'walls');
    assert.ok(fills.includes('#8d7356'), 'floor');
    assert.ok(fills.includes('#f4f0e4'), 'player');
    assert.equal(fills.filter((fill) => fill === '#d7cfc4').length, 4, 'one dot per rat');
    for (const rock of rocks) {
      const hex = `#${(rock.vein >>> 0).toString(16).padStart(6, '0')}`;
      assert.ok(fills.includes(hex), hex);
    }
    assert.ok(ops.some((op) => op.stroke === '#e6d3b0'), 'ladder');
    assert.equal(fills.includes('#3a6a32'), false);
    assert.equal(fills.includes('#b8a078'), false);

    const shop = mockMapCtx();
    drawMinimap(shop.ctx, {
      sceneMode: 'shop',
      yaw: 0,
      zoom: 1,
      expansions: [],
      player: { x: 0, z: 4, facing: 0 },
      customers: [],
      furniture: [],
    });
    const shopFills = shop.ops.filter((op) => op.fill).map((op) => op.fill);
    assert.ok(shopFills.includes('#3a6a32'));
    assert.ok(shopFills.includes('#b8a078'));
    assert.equal(shopFills.includes('#8d7356'), false);
  });

  it('turns a dungeon-map click into a walk that routes around rocks', () => {
    const bounds = dungeonMapBounds();
    const focus = dungeonMapFocus();
    const size = 196;
    const yaw = -0.4;
    const floor = { minX: -5.2, maxX: 5.2, minZ: -4.2, maxZ: 4.2 };
    const blocks = dungeonMoveObstacles(DUNGEON_BOULDERS);
    const aim = { x: 2.2, z: -0.1 };
    const pixel = worldToMap(aim.x, aim.z, bounds, size, yaw, 1, focus);
    const dest = mapToWorld(pixel.x, pixel.y, bounds, size, yaw, 1, focus);
    assert.ok(Math.abs(dest.x - aim.x) < 1e-6);
    assert.ok(Math.abs(dest.z - aim.z) < 1e-6);
    const path = planWalk({ x: -4.15, z: 0.4 }, dest, blocks, PLAYER_RADIUS, [floor]);
    assert.ok(path.length >= 1);
    let prev = { x: -4.15, z: 0.4 };
    for (const point of path) {
      const steps = Math.max(1, Math.ceil(Math.hypot(point.x - prev.x, point.z - prev.z) / 0.05));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const x = prev.x + (point.x - prev.x) * t;
        const z = prev.z + (point.z - prev.z) * t;
        assert.equal(isWalkable(x, z, blocks, PLAYER_RADIUS, [floor]), true);
      }
      prev = point;
    }
    const end = path[path.length - 1];
    assert.ok(Math.hypot(end.x - aim.x, end.z - aim.z) < 0.45);
    assert.ok(Math.hypot(end.x, end.z) > 1, 'the path stays off the centre essence rock');
  });
});

function mockMapCtx(size = 196) {
  const ops = [];
  const ctx = {
    canvas: { width: size, height: size },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    clearRect() { ops.push({ op: 'clear' }); },
    fillRect() { ops.push({ op: 'fillRect', fill: this.fillStyle }); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() { ops.push({ op: 'fill', fill: this.fillStyle }); },
    stroke() { ops.push({ op: 'stroke', stroke: this.strokeStyle }); },
    strokeRect() { ops.push({ op: 'stroke', stroke: this.strokeStyle }); },
    arc() {},
    drawImage() {},
  };
  return { ctx, ops };
}
