import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAULDRON_COST,
  WHEEL_COST,
  FURNACE_COST,
  RANGE_COST,
  FURNITURE_SHOP,
  TREE_BED_CLEAR,
  furnaceBesideAnvil,
  poseRect,
  rectsOverlap,
  CHEST_MAX_LEVEL,
  EXPANSION_PADS,
  FURNITURE_FORWARD,
  FURNITURE_ROT_STEP,
  FURNITURE_START_YAW,
  furnitureHalfSize,
  furnitureVisualYaw,
  rotatedFootprint,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  defaultFurniture,
  expansionCost,
  furnitureBuyCost,
  gardenTreeSpots,
  gardenRockSpots,
  gardenRockRadius,
  gardenTrapdoorSpot,
  gardenBedSpots,
  gardenGrassClusters,
  gardenBox,
  cobblePathSpan,
  keepFountain,
  keepGardenSpot,
  FOUNTAIN,
  occupiedCells,
  padConnects,
  pointHitsShop,
  padById,
  rotatePose,
  snapToFloor,
  snapGridSpan,
  snapToWallGrid,
  walkFloors,
  placeFloors,
  wallVineMounts,
  outdoorWalkFloors,
  playerWalkFloors,
  doorwayFloor,
  roomCenter,
  roomFloor,
  roomPlaceFloor,
  ORIGIN_FLOOR,
} from './layout.js';
import { FLOOR, isWalkable, shopObstacles } from './nav.js';
import { SHOP } from './catalog.js';

describe('layout numbers', () => {
  it('gives five pads around the origin: three behind, one either side', () => {
    assert.equal(EXPANSION_PADS.length, 5);
    assert.ok(EXPANSION_PADS.filter((p) => p.gz === -1).length === 3);
    assert.ok(EXPANSION_PADS.some((p) => p.id === 'left' && p.gx === -1 && p.gz === 0));
    assert.ok(EXPANSION_PADS.some((p) => p.id === 'right' && p.gx === 1 && p.gz === 0));
  });

  it('prices expansions 10000 then ×3, and chest 500 then ×3', () => {
    assert.equal(expansionCost(0), 10000);
    assert.equal(expansionCost(1), 30000);
    assert.equal(expansionCost(2), 90000);
    assert.equal(chestUpgradeCost(1), 500);
    assert.equal(chestUpgradeCost(2), 1500);
    assert.equal(furnitureBuyCost(0), 500);
    assert.equal(furnitureBuyCost(1), 1500);
    assert.equal(furnitureBuyCost(2), 4500);
    assert.equal(chestSlots(1), 100);
    assert.equal(chestSlots(CHEST_MAX_LEVEL), 1000);
    assert.equal(SWAP_PRICE_RATIO, 0.65);
  });

  it('connects side and back pads to origin, and corners only after a neighbor exists', () => {
    assert.equal(padConnects(padById('left'), []), true);
    assert.equal(padConnects(padById('back'), []), true);
    assert.equal(padConnects(padById('back-left'), []), false);
    assert.equal(padConnects(padById('back-left'), ['left']), true);
    assert.equal(padConnects(padById('back-left'), ['back']), true);
  });

  it('keeps the origin floor and adds a doorway into a left room', () => {
    const origin = walkFloors([]);
    assert.equal(origin[0].minX, FLOOR.minX);
    assert.equal(origin[0].maxZ, FLOOR.maxZ);
    const expanded = walkFloors(['left']);
    assert.ok(expanded.length >= 3);
    const obstacles = shopObstacles(SHOP);
    assert.equal(isWalkable(SHOP.keeper.x, SHOP.keeper.z, obstacles, 0.28, expanded), true);
    assert.equal(occupiedCells(['left', 'back']).length, 3);
  });

  it('yaws the chest 180° toward the front-door wall, and range/furnace −90° at start only', () => {
    // Gameplay yaw still faces the door. The bundled chest dump is pitched −90°
    // around X (clockwise) in wrapBundledProp so the lid stands correctly.
    assert.ok(Math.abs(FURNITURE_START_YAW.chest - Math.PI) < 1e-9);
    assert.ok(Math.abs(FURNITURE_START_YAW.range - (-Math.PI / 2)) < 1e-9);
    assert.ok(Math.abs(FURNITURE_START_YAW.furnace - (-Math.PI / 2)) < 1e-9);
    assert.ok(Math.abs(FURNITURE_START_YAW.counter - Math.PI) < 1e-9);
    assert.equal(FURNITURE_START_YAW.anvil, undefined);
    assert.ok(Math.abs(furnitureVisualYaw('chest', 0) - Math.PI) < 1e-9);
    assert.ok(Math.abs(furnitureVisualYaw('range', FURNITURE_ROT_STEP) - (-Math.PI / 2 + FURNITURE_ROT_STEP)) < 1e-9);
    assert.ok(Math.abs(furnitureVisualYaw('furnace', 0) - (-Math.PI / 2)) < 1e-9);
    assert.ok(Math.abs(furnitureVisualYaw('counter', 0) - Math.PI) < 1e-9);
    assert.equal(furnitureVisualYaw('anvil', 0), FURNITURE_FORWARD);
  });

  it('defaults every furniture piece to the shared door-facing rotation', () => {
    const furniture = defaultFurniture();
    assert.equal(furniture.counter.rot, FURNITURE_FORWARD);
    assert.equal(furniture.anvil.rot, FURNITURE_FORWARD);
    assert.equal(furniture.chest.rot, FURNITURE_FORWARD);
    assert.equal(furniture.range, null);
    for (const pose of furniture.displays) {
      assert.equal(pose.rot, FURNITURE_FORWARD);
    }
    assert.equal(furniture.cauldron, null);
    assert.equal(furniture.furnace, null);
    assert.equal(furniture.wheel, null);
  });

  it('sits the starter anvil on the old furnace back-wall pad', () => {
    assert.ok(SHOP.anvil.z < SHOP.counter.z - 0.2, 'anvil should sit on the back wall');
    assert.ok(SHOP.anvil.x < 0);
    const beside = furnaceBesideAnvil({ x: -2.98, z: -2.42, rot: 0 });
    assert.equal(beside.x, SHOP.furnace.x);
    assert.equal(beside.z, SHOP.furnace.z);
  });

  it('puts the chest on the old range pad, facing the front-door wall', () => {
    assert.ok(SHOP.chest.x > 0, 'chest should sit on the right half of the back wall');
    assert.ok(SHOP.chest.z < SHOP.counter.z - 0.2, 'chest should sit behind the counter');
    assert.ok(Math.abs(SHOP.chest.x - 2.55) < 1e-9);
    assert.ok(Math.abs(SHOP.chest.z - 2.22) < 1e-9 || Math.abs(SHOP.chest.z + 2.22) < 1e-9);
    assert.ok(SHOP.anvil.x < -1.8, 'anvil should sit on the left half of the back wall');
  });

  it('keeps starter stations from overlapping each other or remaining tables', () => {
    const stations = [
      ['anvil', SHOP.anvil],
      ['chest', SHOP.chest],
      ['counter', SHOP.counter],
    ];
    const rects = stations.map(([kind, pose]) => poseRect(kind, pose));
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        assert.equal(rectsOverlap(rects[i], rects[j], 0.04), false, `${stations[i][0]} overlaps ${stations[j][0]}`);
      }
    }
    for (const spot of SHOP.displays) {
      const display = poseRect(spot.kind, spot);
      for (let i = 0; i < rects.length; i += 1) {
        assert.equal(rectsOverlap(display, rects[i], 0.02), false, `${spot.id} overlaps ${stations[i][0]}`);
      }
    }
  });

  it('keeps wall vines off the food and potion display shelves', () => {
    const vines = wallVineMounts();
    const shelves = SHOP.displays.filter((spot) => spot.kind === 'shelf');
    assert.ok(vines.length >= 4);
    for (const vine of vines) {
      for (const shelf of shelves) {
        const onShelf = Math.abs(vine.x - shelf.x) < 0.85 && Math.abs(vine.z - shelf.z) < 0.55;
        assert.equal(onShelf, false, `vine at ${vine.x},${vine.z} covers ${shelf.id}`);
      }
    }
  });

  it('clears side trees when a left or right expansion is placed', () => {
    const origin = gardenTreeSpots([]);
    assert.ok(origin.some((spot) => spot.side === 'left'));
    assert.ok(origin.some((spot) => spot.side === 'right'));
    const left = gardenTreeSpots(['left']);
    assert.equal(left.some((spot) => spot.side === 'left' || spot.side === 'front-left'), false);
    assert.ok(left.some((spot) => spot.side === 'right'));
    assert.ok(left.some((spot) => spot.side === 'rear'));
    const right = gardenTreeSpots(['right']);
    assert.equal(right.some((spot) => spot.side === 'right' || spot.side === 'front-right'), false);
    assert.ok(right.some((spot) => spot.side === 'left'));
    assert.equal(WHEEL_COST, 500);
    assert.equal(CAULDRON_COST, 10000);
  });

  it('keeps the cobble path on the grass tile and puts the fountain mid-path', () => {
    const grass = gardenBox([]);
    const path = cobblePathSpan([]);
    assert.ok(path.minZ > 4, 'path should start away from the door');
    assert.ok(path.maxZ <= grass.maxZ);
    assert.ok(path.minX >= grass.minX);
    assert.ok(path.maxX <= grass.maxX);
    assert.ok(FOUNTAIN.z > path.minZ + 1.5);
    assert.ok(FOUNTAIN.z < path.maxZ - 1.5);
    assert.equal(keepFountain([]), true);
    assert.ok(Math.abs(FOUNTAIN.x) < 0.05);
    const apron = FOUNTAIN.apron ?? 1.42;
    assert.ok(FOUNTAIN.x - apron >= grass.minX);
    assert.ok(FOUNTAIN.x + apron <= grass.maxX);
    assert.ok(FOUNTAIN.z - apron >= path.minZ);
    assert.ok(FOUNTAIN.z + apron <= path.maxZ);
    assert.ok(FOUNTAIN.z + apron <= grass.maxZ);
  });

  it('clears grass and garden beds in a side-expansion footprint like trees', () => {
    const origin = gardenGrassClusters([]);
    const left = gardenGrassClusters(['left']);
    assert.ok(origin.length > 180, 'lawn should be clusters, not a thin edge strip');
    assert.ok(origin.some((spot) => pointHitsShop(spot.x, spot.z, ['left'], 1.15)));
    assert.equal(left.some((spot) => pointHitsShop(spot.x, spot.z, ['left'], 1.15)), false);
    assert.ok(left.some((spot) => spot.x > 4));
    const scales = origin.map((spot) => spot.scale);
    assert.ok(Math.max(...scales) - Math.min(...scales) > 0.4);
    assert.equal(keepGardenSpot({ x: -8.2, z: 0, side: 'left' }, ['left']), false);
    assert.equal(keepGardenSpot({ x: -8.2, z: 0, side: 'left' }, []), true);
    const originBeds = gardenBedSpots([]);
    assert.ok(originBeds.length >= 3);
    const leftBeds = gardenBedSpots(['left']);
    assert.equal(leftBeds.every((spot) => keepGardenSpot(spot, ['left'])), true);
  });

  it('clears path-side rocks, trapdoor, and extra trees when they hit a room', () => {
    const originTrees = gardenTreeSpots([]);
    assert.ok(originTrees.some((spot) => spot.side === 'path' || spot.side === 'edge'));
    assert.ok(gardenRockSpots([]).length >= 2);
    assert.ok(gardenTrapdoorSpot([]));
    const left = gardenTreeSpots(['left']);
    assert.equal(left.some((spot) => spot.side === 'left' || spot.side === 'front-left'), false);
    const leftRocks = gardenRockSpots(['left']);
    assert.equal(leftRocks.some((spot) => spot.side === 'left'), false);
  });

  it('snaps furniture on both floor axes, not only sideways', () => {
    const floors = walkFloors([]);
    const side = snapToFloor(1.37, 0.11, floors);
    const along = snapToFloor(0.11, 1.37, floors);
    assert.ok(Math.abs(side.x - 1.4) < 1e-9);
    assert.ok(Math.abs(along.z - 1.4) < 1e-9);
    assert.notEqual(along.z, side.z);
  });

  it('snaps floor furniture onto cells that reach the interior walls', () => {
    const floors = placeFloors([]);
    const shop = roomPlaceFloor(0, 0);
    assert.ok(shop.minX < ORIGIN_FLOOR.minX);
    assert.ok(shop.maxX > ORIGIN_FLOOR.maxX);
    assert.ok(shop.minZ < ORIGIN_FLOOR.minZ);
    assert.ok(shop.maxZ > ORIGIN_FLOOR.maxZ);
    const { start: minX, end: maxX } = snapGridSpan(shop.minX, shop.maxX);
    const { start: minZ, end: maxZ } = snapGridSpan(shop.minZ, shop.maxZ);
    assert.ok(minX <= shop.minX + 1e-9);
    assert.ok(maxX >= shop.maxX - 1e-9);
    assert.ok(minZ <= shop.minZ + 1e-9);
    assert.ok(maxZ >= shop.maxZ - 1e-9);
    const left = snapToFloor(shop.minX, 0, floors);
    const back = snapToFloor(0, shop.minZ, floors);
    assert.ok(Math.abs(left.x - shop.minX) <= 0.2 + 1e-6, `left snap ${left.x} vs wall ${shop.minX}`);
    assert.ok(Math.abs(back.z - shop.minZ) <= 0.2 + 1e-6, `back snap ${back.z} vs wall ${shop.minZ}`);
    assert.ok(left.x < ORIGIN_FLOOR.minX, 'edge cells must sit past the old inset floor');
    assert.ok(back.z < ORIGIN_FLOOR.minZ, 'edge cells must sit past the old inset floor');
  });

  it('keeps side and rear expansion floors walkable through doorways', () => {
    const right = walkFloors(['right']);
    const back = walkFloors(['back']);
    const rightCenter = roomCenter(1, 0);
    const backCenter = roomCenter(0, -1);
    assert.equal(isWalkable(rightCenter.x, rightCenter.z, [], 0.28, right), true);
    assert.equal(isWalkable(backCenter.x, backCenter.z, [], 0.28, back), true);
    const sideDoor = doorwayFloor({ gx: 0, gz: 0 }, { gx: 1, gz: 0 });
    const rearDoor = doorwayFloor({ gx: 0, gz: 0 }, { gx: 0, gz: -1 });
    assert.ok(sideDoor);
    assert.ok(rearDoor);
    const shop = roomFloor(0, 0);
    const east = roomFloor(1, 0);
    const midX = (shop.maxX + east.minX) / 2;
    assert.equal(isWalkable(midX, 0.1, [], 0.28, right), true, 'side doorway should fit the player');
    const rear = roomFloor(0, -1);
    const midZ = (shop.minZ + rear.maxZ) / 2;
    assert.equal(isWalkable(0, midZ, [], 0.28, back), true, 'rear doorway should fit the player');
  });

  it('lets the player walk the grass and path outside the shop', () => {
    const outdoor = outdoorWalkFloors([]);
    const player = playerWalkFloors([]);
    assert.ok(outdoor.length >= 4);
    assert.ok(player.length > walkFloors([]).length);
    assert.equal(isWalkable(0, 6.2, [], 0.28, player), true);
    assert.equal(isWalkable(0, 6.2, [], 0.28, [FLOOR]), false);
    assert.equal(isWalkable(SHOP.keeper.x, SHOP.keeper.z, shopObstacles(SHOP), 0.28, player), true);
    assert.equal(isWalkable(0, SHOP.door.z, [], 0.28, player), true);
    assert.equal(isWalkable(0, 4.6, [], 0.28, player), true);
  });

  it('keeps garden trees and large rocks off flower beds', () => {
    const beds = gardenBedSpots([]);
    assert.ok(beds.length >= 3);
    for (const tree of gardenTreeSpots([])) {
      for (const bed of beds) {
        const dist = Math.hypot(tree.x - bed.x, tree.z - bed.z);
        assert.ok(dist >= TREE_BED_CLEAR, `tree at ${tree.x},${tree.z} overlaps bed at ${bed.x},${bed.z}`);
      }
    }
    for (const rock of gardenRockSpots([])) {
      for (const bed of beds) {
        const dist = Math.hypot(rock.x - bed.x, rock.z - bed.z);
        assert.ok(dist >= TREE_BED_CLEAR, `rock at ${rock.x},${rock.z} overlaps bed at ${bed.x},${bed.z}`);
      }
    }
  });

  it('places a few large outdoor rocks at 2–3× the usual garden scale', () => {
    const rocks = gardenRockSpots([]);
    const large = rocks.filter((spot) => spot.scale >= 2 && spot.scale <= 3);
    assert.ok(large.length >= 3, `expected decorative boulders, got ${large.map((s) => s.scale)}`);
    assert.ok(rocks.some((spot) => spot.scale < 1.2), 'small path rocks should remain');
  });

  it('keeps outdoor rocks on the grass, not the blue void', () => {
    const grass = gardenBox([]);
    const rocks = gardenRockSpots([]);
    assert.ok(rocks.length >= 2);
    for (const rock of rocks) {
      const pad = gardenRockRadius(rock.scale ?? 1);
      assert.ok(rock.x >= grass.minX + pad - 1e-9, `rock x=${rock.x} off grass`);
      assert.ok(rock.x <= grass.maxX - pad + 1e-9, `rock x=${rock.x} off grass`);
      assert.ok(rock.z >= grass.minZ + pad - 1e-9, `rock z=${rock.z} off grass`);
      assert.ok(rock.z <= grass.maxZ - pad + 1e-9, `rock z=${rock.z} off grass`);
    }
    assert.equal(rocks.some((spot) => spot.z > 12.8), false);
    const voidSide = [
      { x: 6.15, z: 13.45 },
      { x: -5.85, z: 13.15 },
    ];
    for (const miss of voidSide) {
      assert.equal(
        rocks.some((spot) => Math.hypot(spot.x - miss.x, spot.z - miss.z) < 0.5),
        false,
        `void rock at ${miss.x},${miss.z} should not spawn`,
      );
    }
  });

  it('snaps extra shelves to a wall grid instead of the floor', () => {
    const back = snapToWallGrid(0.13, -2.9, []);
    assert.ok(Math.abs(back.z + 3.18 + 0.04) < 1e-6 || Math.abs(back.z + 3.22) < 0.08);
    assert.ok(Math.abs(back.rot) < 1e-6);
    const side = snapToWallGrid(-3.5, 0.11, []);
    assert.ok(Math.abs(side.x + 3.72 + 0.04) < 0.08 || Math.abs(side.x + 3.76) < 0.12);
    assert.ok(Math.abs(Math.abs(side.rot) - Math.PI / 2) < 1e-6);
  });

  it('lists furnace and range as free upgrade stations and shelves in the furniture shop', () => {
    assert.equal(FURNACE_COST, 0);
    assert.equal(RANGE_COST, 0);
    assert.equal(furnitureBuyCost(0), 500);
    assert.equal(furnitureBuyCost(1), 1500);
    assert.ok(FURNITURE_SHOP.some((item) => item.type === 'shelf' && item.kind === 'shelf'));
    const table = furnitureHalfSize('table');
    assert.equal(table.hw, 0.76);
    assert.equal(table.hd, 0.51);
  });
});
