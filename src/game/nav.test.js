import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from './catalog.js';
import { clearBackWallShelf, createState, removePlacedFurniture } from './economy.js';
import {
  defaultFurniture,
  gardenBedSpots,
  gardenTrapdoorSpot,
  gardenTreeSpots,
  playerWalkFloors,
  rollFlaxSpots,
  roomCenter,
  shopRugPose,
  shopRugRect,
  walkFloors,
} from './layout.js';
import { gatherStandCandidates } from './interact.js';
import {
  CELL,
  FLOOR,
  PLAYER_RADIUS,
  dungeonWallObstacles,
  isWalkable,
  liveObstacles,
  moveWithCollision,
  nearestWalkable,
  placementBlocked,
  planPlayerWalk,
  planWalk,
  playerObstacles,
  queueSlot,
  rebuildShopWalls,
  shopObstacles,
  shopWallNavGrid,
  shopWallObstacles,
} from './nav.js';

describe('shop navigation', () => {
  const obstacles = shopObstacles(SHOP, defaultFurniture());

  it('lets the shopkeeper stand behind the counter', () => {
    assert.equal(isWalkable(SHOP.keeper.x, SHOP.keeper.z, obstacles), true);
    assert.equal(isWalkable(0, SHOP.counter.z - 0.82, obstacles), true);
  });

  it('lets the player walk on the shop rug like normal floor', () => {
    const pose = shopRugPose();
    const rug = shopRugRect();
    assert.equal(isWalkable(pose.x, pose.z, obstacles), true);
    assert.equal(isWalkable(pose.x - 0.6, pose.z, obstacles), true);
    assert.equal(isWalkable(pose.x + 0.6, pose.z, obstacles), true);
    const across = planWalk(
      { x: pose.x, z: rug.minZ + 0.2 },
      { x: pose.x, z: rug.maxZ - 0.2 },
      obstacles,
    );
    assert.ok(across.length >= 1, 'should path across the rug');
    const cluttered = shopObstacles({
      ...SHOP,
      clutter: [{ id: 'rug', kind: 'rug', x: pose.x, z: pose.z, w: 2.35, d: 1.55, walkable: true }],
    }, defaultFurniture());
    assert.equal(isWalkable(pose.x, pose.z, cluttered), true);
    assert.equal(isWalkable(SHOP.counter.x, SHOP.counter.z, cluttered), false);
  });

  it('blocks the counter, walls, and the road outside', () => {
    assert.equal(isWalkable(SHOP.counter.x, SHOP.counter.z, obstacles), false);
    assert.equal(isWalkable(0, FLOOR.maxZ + 0.6, obstacles), false);
    assert.equal(isWalkable(FLOOR.minX - 0.4, 0, obstacles), false);
  });

  it('walks around the counter instead of through it', () => {
    const from = { x: 0, z: 1.2 };
    const to = { x: 0, z: SHOP.counter.z - 0.82 };
    const path = planWalk(from, to, obstacles);
    assert.ok(path.length >= 1);
    for (const point of path) {
      assert.equal(isWalkable(point.x, point.z, obstacles), true);
    }
    const through = path.some((point) => (
      Math.abs(point.z - SHOP.counter.z) < 0.18 && Math.abs(point.x) < 0.7
    ));
    assert.equal(through, false);
  });

  it('snaps a click on the counter to nearby walkable floor', () => {
    const snapped = nearestWalkable(SHOP.counter.x, SHOP.counter.z, obstacles);
    assert.ok(snapped);
    assert.equal(isWalkable(snapped.x, snapped.z, obstacles), true);
  });

  it('places queue slots on walkable floor in front of the counter', () => {
    for (let i = 0; i < 3; i += 1) {
      const slot = queueSlot(i);
      assert.equal(isWalkable(slot.x, slot.z, obstacles), true);
      assert.ok(slot.z > SHOP.counter.z);
    }
    const live = queueSlot(0, SHOP, defaultFurniture().counter);
    assert.ok(live.z > defaultFurniture().counter.z);
  });

  it('leaves the back corners behind the anvil and chest unblocked', () => {
    assert.equal((SHOP.clutter ?? []).length, 0);
    const behindAnvil = nearestWalkable(-3.4, -2.95, obstacles);
    const behindChest = nearestWalkable(3.4, -2.95, obstacles);
    assert.ok(behindAnvil);
    assert.ok(behindChest);
    assert.equal(isWalkable(behindAnvil.x, behindAnvil.z, obstacles), true);
    assert.equal(isWalkable(behindChest.x, behindChest.z, obstacles), true);
  });

  it('lets the rug sit on the customer aisle and still be walked', () => {
    const pose = defaultFurniture().rug;
    const floors = walkFloors([]);
    const blocked = placementBlocked(pose, 'rug', obstacles, floors);
    assert.equal(blocked, null);
    assert.equal(isWalkable(pose.x, pose.z, liveObstacles({ furniture: defaultFurniture(), expansions: [], displays: [] })), true);
  });

  it('refuses a placement that overlaps another obstacle', () => {
    const floors = [FLOOR];
    const blocks = [{ minX: -1, maxX: 1, minZ: -2.2, maxZ: -1.2 }];
    const overlap = placementBlocked({ x: 0, z: -1.7, rot: 0 }, 'chest', blocks, floors, { checkAisle: false });
    assert.equal(overlap, 'That spot overlaps other furniture.');
    const clear = placementBlocked({ x: -2.2, z: 0.4, rot: 0 }, 'table', [], floors, { checkAisle: false });
    assert.equal(clear, null);
    const againstWall = placementBlocked(
      { x: FLOOR.minX + 0.08, z: 0.2, rot: 0 },
      'chest',
      [],
      floors,
      { checkAisle: false },
    );
    assert.equal(againstWall, null);
  });

  it('frees a deleted shelf wall cell for a replacement', () => {
    const state = createState();
    const shelfIndex = SHOP.displays.findIndex((d) => d.kind === 'shelf');
    assert.ok(shelfIndex >= 0);
    const pose = state.furniture.displays[shelfIndex];
    const floors = walkFloors([]);
    const occupied = placementBlocked(pose, 'shelf', liveObstacles(state), floors, { checkAisle: false });
    assert.equal(occupied, 'That spot overlaps other furniture.');
    assert.equal(removePlacedFurniture(state, shelfIndex), true);
    const free = placementBlocked(pose, 'shelf', liveObstacles(state), floors, { checkAisle: false });
    assert.equal(free, null);
  });

  it('walks from behind the counter onto the outdoor path and to the trapdoor', () => {
    const state = createState();
    const path = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 0, z: 6.2 },
      state,
    );
    assert.ok(path.length >= 1, 'should path onto the front grass');
    assert.ok(path.some((point) => point.z > FLOOR.maxZ + 0.4));
    const hatch = gardenTrapdoorSpot([]);
    assert.ok(hatch);
    const hatchPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: hatch.x, z: hatch.z },
      state,
    );
    assert.ok(hatchPath.length >= 1, 'should path to the outdoor trapdoor');
    const end = hatchPath[hatchPath.length - 1];
    assert.ok(Math.hypot(end.x - hatch.x, end.z - hatch.z) < 1.2);
  });

  it('walks from the main shop onto side and rear expansion floors', () => {
    const right = createState();
    right.expansions = ['right'];
    const rightPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 8.2, z: 0.1 },
      right,
    );
    assert.ok(rightPath.length >= 1, 'should path into the right expansion');
    const endRight = rightPath[rightPath.length - 1];
    assert.ok(endRight.x > 5, 'should finish inside the side room');

    const back = createState();
    back.expansions = ['back'];
    clearBackWallShelf(back);
    const backPath = planPlayerWalk(
      { x: SHOP.keeper.x, z: SHOP.keeper.z },
      { x: 0, z: -7 },
      back,
    );
    assert.ok(backPath.length >= 1, 'should path into the rear expansion');
    const endBack = backPath[backPath.length - 1];
    assert.ok(endBack.z < -4, 'should finish inside the rear room');
  });

  function sampleClear(from, path, obstacles, floors) {
    let prev = from;
    for (const point of path) {
      const dx = point.x - prev.x;
      const dz = point.z - prev.z;
      const dist = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(dist / 0.1));
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const x = prev.x + dx * t;
        const z = prev.z + dz * t;
        assert.equal(
          isWalkable(x, z, obstacles, PLAYER_RADIUS, floors),
          true,
          `path clips a wall at ${x.toFixed(2)},${z.toFixed(2)}`,
        );
      }
      prev = point;
    }
  }

  it('keeps the storefront door open and the wall beside it shut', () => {
    const walls = shopWallObstacles([]);
    const floors = playerWalkFloors([]);
    const grid = shopWallNavGrid([]);
    assert.equal(isWalkable(0, 3.6, walls, PLAYER_RADIUS, floors), true);
    assert.equal(isWalkable(1.4, 3.6, walls, PLAYER_RADIUS, floors), false);
    assert.equal(grid.has(`${Math.round(0 / CELL)},${Math.round(3.6 / CELL)}`), false);
    assert.equal(grid.has(`${Math.round(1.4 / CELL)},${Math.round(3.6 / CELL)}`), true);
    const moved = moveWithCollision(1.6, 2.4, 1.6, 4.6, walls, PLAYER_RADIUS, floors);
    assert.ok(moved.z < 3.55, 'collision should stop beside the front wall');
    assert.ok(moved.z > 2.5, 'the player should walk up to the wall');
    const through = moveWithCollision(0, 2.9, 0, 4.4, walls, PLAYER_RADIUS, floors);
    assert.ok(through.z > 4, 'the door opening should let the player through');
    const state = createState();
    const bed = gardenBedSpots([])[0];
    const backInside = planPlayerWalk(bed, { x: SHOP.anvil.x, z: SHOP.anvil.z + 0.75 }, state);
    assert.ok(backInside.length >= 1, 'a yard click should path back through the door');
    sampleClear(bed, backInside, playerObstacles(state), floors);
    const end = backInside[backInside.length - 1];
    assert.ok(end.z < FLOOR.maxZ, 'should finish inside the shop');
  });

  it('rebuilds expansion doors into the wall grid', () => {
    rebuildShopWalls([]);
    const shut = shopWallNavGrid([]);
    const doorCell = `${Math.round(4.1 / CELL)},${Math.round(0.1 / CELL)}`;
    assert.equal(shut.has(doorCell), true, 'the right wall is solid before the expansion');
    rebuildShopWalls(['right']);
    const open = shopWallNavGrid(['right']);
    assert.equal(open.has(doorCell), false, 'buying the right room cuts a door');
    const stone = `${Math.round(4.1 / CELL)},${Math.round(2.2 / CELL)}`;
    assert.equal(open.has(stone), true, 'the rest of that wall stays solid');
    rebuildShopWalls([]);
    assert.equal(shopWallNavGrid([]).has(doorCell), true, 'resetting the shop seals the door');
  });

  it('paths through doors and around walls at every expansion level', () => {
    const levels = [
      [],
      ['left'],
      ['right'],
      ['back'],
      ['left', 'back', 'back-left'],
      ['right', 'back', 'back-right'],
      ['left', 'right', 'back', 'back-left', 'back-right'],
    ];
    const keeper = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    for (const expansions of levels) {
      const state = createState();
      state.expansions = expansions;
      if (expansions.includes('back')) clearBackWallShelf(state);
      rebuildShopWalls(expansions);
      const obstacles = playerObstacles(state);
      const floors = playerWalkFloors(expansions);
      const targets = [
        ...expansions.map((id) => {
          const pad = { left: [-1, 0], right: [1, 0], back: [0, -1], 'back-left': [-1, -1], 'back-right': [1, -1] }[id];
          return roomCenter(pad[0], pad[1]);
        }),
        ...gardenBedSpots(expansions).slice(0, 2),
        ...gardenTreeSpots(expansions).filter((spot) => spot.side === 'left' || spot.side === 'rear').slice(0, 2),
      ];
      for (const target of targets) {
        const path = planPlayerWalk(keeper, target, state);
        assert.ok(path.length >= 1, `no path to ${target.x},${target.z} with [${expansions}]`);
        sampleClear(keeper, path, obstacles, floors);
        const end = path[path.length - 1];
        assert.ok(
          Math.hypot(end.x - target.x, end.z - target.z) < 1.5,
          `stopped far from ${target.x},${target.z}`,
        );
      }
    }
  });

  it('follows a wall-aware path without clipping while moving', () => {
    const state = createState();
    state.expansions = ['right', 'back'];
    const obstacles = playerObstacles(state);
    const floors = playerWalkFloors(state.expansions);
    const goal = roomCenter(1, 0);
    const path = planPlayerWalk({ x: SHOP.keeper.x, z: SHOP.keeper.z }, goal, state);
    let x = SHOP.keeper.x;
    let z = SHOP.keeper.z;
    for (const point of path) {
      let guard = 0;
      while (Math.hypot(point.x - x, point.z - z) > 0.08 && guard < 80) {
        guard += 1;
        const dx = point.x - x;
        const dz = point.z - z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(0.18, dist);
        const moved = moveWithCollision(
          x,
          z,
          x + (dx / dist) * step,
          z + (dz / dist) * step,
          obstacles,
          PLAYER_RADIUS,
          floors,
        );
        assert.equal(moved.blocked, false, `stuck at ${x.toFixed(2)},${z.toFixed(2)}`);
        x = moved.x;
        z = moved.z;
      }
    }
    assert.ok(Math.hypot(x - goal.x, z - goal.z) < 1.2);
  });

  function crossesFrontDoor(from, path) {
    const wallZ = 3.65;
    const pts = [from, ...path];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      if ((a.z - wallZ) * (b.z - wallZ) > 0) continue;
      const dz = b.z - a.z;
      const t = dz === 0 ? 0 : (wallZ - a.z) / dz;
      if (Math.abs(a.x + (b.x - a.x) * t) <= 0.5) return true;
    }
    return false;
  }

  function flaxRng(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  it('reaches every outdoor tree, flax plant, and gather stand via the front door', () => {
    const layouts = [
      [],
      ['left'],
      ['right'],
      ['back'],
      ['back', 'back-left'],
      ['back', 'back-right'],
      ['right', 'back-right'],
      ['left', 'right', 'back', 'back-left', 'back-right'],
    ];
    const keeper = { x: SHOP.keeper.x, z: SHOP.keeper.z };
    for (const expansions of layouts) {
      const state = createState();
      state.expansions = expansions;
      if (expansions.includes('back')) clearBackWallShelf(state);
      const obstacles = playerObstacles(state);
      const floors = playerWalkFloors(expansions);
      const trees = gardenTreeSpots(expansions);
      if (expansions.length === 0) {
        for (const side of ['left', 'right', 'rear', 'edge']) {
          assert.ok(trees.some((tree) => tree.side === side), `${side} trees should ring the shop`);
        }
      }
      const flax = rollFlaxSpots(expansions, {
        rng: flaxRng(11 + expansions.length),
        furniture: state.furniture,
      });
      assert.ok(flax.length >= 8, `flax field too small for [${expansions}]`);
      const nodes = [
        ...trees.map((spot) => ({ ...spot, kind: 'tree' })),
        ...flax.map((spot) => ({ ...spot, kind: 'flax', side: 'flax' })),
      ];
      for (const node of nodes) {
        const label = `${node.kind} ${node.side} ${node.x.toFixed(2)},${node.z.toFixed(2)} [${expansions}]`;
        const path = planPlayerWalk(keeper, node, state);
        assert.ok(path.length >= 1, `no path to ${label}`);
        sampleClear(keeper, path, obstacles, floors);
        assert.equal(crossesFrontDoor(keeper, path), true, `${label} should leave through the front door`);
        const end = path[path.length - 1];
        assert.ok(Math.hypot(end.x - node.x, end.z - node.z) < 1.5, `stopped far from ${label}`);
        const around = expansions.length === 0 && (
          node.side === 'left' || node.side === 'right'
          || node.side === 'rear' || node.side === 'edge' || node.kind === 'flax'
        );
        const stands = gatherStandCandidates(node.kind, node).filter((dest) => (
          isWalkable(dest.x, dest.z, obstacles, PLAYER_RADIUS, floors)
        ));
        assert.ok(stands.length >= 1, `no gather stand for ${label}`);
        const checked = around ? stands : stands.slice(0, 1);
        for (const dest of checked) {
          const standPath = planPlayerWalk(keeper, dest, state);
          const standEnd = standPath[standPath.length - 1];
          assert.ok(standEnd, `no path to gather stand for ${label}`);
          assert.ok(
            Math.hypot(standEnd.x - dest.x, standEnd.z - dest.z) < 0.45,
            `gather stand missed for ${label}`,
          );
          sampleClear(keeper, standPath, obstacles, floors);
          assert.equal(
            crossesFrontDoor(keeper, standPath),
            true,
            `gather stand for ${label} should leave through the front door`,
          );
        }
      }
    }
  });

  it('blocks the dungeon walls without sealing the floor', () => {
    const walls = dungeonWallObstacles();
    const floor = { minX: -5.2, maxX: 5.2, minZ: -4.2, maxZ: 4.2 };
    assert.equal(isWalkable(0, 0, walls, PLAYER_RADIUS, [floor]), true);
    assert.equal(isWalkable(4.7, 0, walls, PLAYER_RADIUS, [floor]), true);
    const wide = { minX: -8, maxX: 8, minZ: -6, maxZ: 6 };
    const moved = moveWithCollision(4.6, 0, 6.4, 0, walls, PLAYER_RADIUS, [wide]);
    assert.ok(moved.x < 5.2, 'the east dungeon wall should stop the player');
    assert.ok(moved.x > 4.6, 'the player should walk up to the wall');
  });
});
