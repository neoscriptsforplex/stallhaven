import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAULDRON_COST,
  WHEEL_COST,
  furnaceBesideAnvil,
  CHEST_MAX_LEVEL,
  EXPANSION_PADS,
  FURNITURE_FORWARD,
  FURNITURE_ROT_STEP,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  defaultFurniture,
  expansionCost,
  furnitureBuyCost,
  gardenTreeSpots,
  gardenRockSpots,
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
  padById,
  rotatePose,
  snapToFloor,
  walkFloors,
  wallVineMounts,
  outdoorWalkFloors,
  playerWalkFloors,
  doorwayFloor,
  roomCenter,
  roomFloor,
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

  it('defaults every furniture piece to the shared door-facing rotation', () => {
    const furniture = defaultFurniture();
    assert.equal(furniture.counter.rot, FURNITURE_FORWARD);
    assert.equal(furniture.anvil.rot, FURNITURE_FORWARD);
    assert.equal(furniture.chest.rot, FURNITURE_FORWARD);
    assert.equal(furniture.range.rot, FURNITURE_FORWARD);
    for (const pose of furniture.displays) {
      assert.equal(pose.rot, FURNITURE_FORWARD);
    }
    const turned = rotatePose(furniture.range, 1);
    assert.ok(Math.abs(turned.rot - FURNITURE_ROT_STEP) < 1e-9);
    assert.equal(furniture.cauldron, null);
    assert.ok(furniture.furnace);
    assert.equal(furniture.furnace.x, SHOP.furnace.x);
    assert.equal(furniture.furnace.z, SHOP.furnace.z);
    assert.equal(furniture.furnace.rot, FURNITURE_FORWARD);
    assert.equal(furniture.wheel, null);
  });

  it('sits the starter furnace beside the anvil with a small gap', () => {
    assert.ok(SHOP.furnace.x > SHOP.anvil.x);
    assert.ok(SHOP.furnace.x - SHOP.anvil.x > 0.9);
    assert.ok(SHOP.furnace.x - SHOP.anvil.x < 1.3);
    assert.equal(SHOP.furnace.z, SHOP.anvil.z);
    const beside = furnaceBesideAnvil({ x: -2.98, z: -2.42, rot: 0 });
    assert.ok(Math.abs(beside.x - (-2.98 + SHOP.furnace.x - SHOP.anvil.x)) < 1e-9);
    assert.equal(beside.z, -2.42);
  });

  it('puts the cooking range on the floor right of the counter, between counter and chest', () => {
    const counterRight = SHOP.counter.x + 1.3;
    const chestLeft = SHOP.chest.x - 0.46;
    assert.ok(SHOP.range.x > counterRight, 'range should sit past the counter’s right edge');
    assert.ok(SHOP.range.x < chestLeft, 'range should sit left of the chest');
    assert.ok(SHOP.range.x > 0, 'range should be on the right, not the back-left corner');
    assert.ok(SHOP.range.z < SHOP.counter.z + 0.2);
    assert.ok(SHOP.range.z > -3.0);
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
    assert.ok(origin.some((spot) => spot.x < -7 && Math.abs(spot.z) < 3));
    assert.equal(left.some((spot) => spot.x < -7 && Math.abs(spot.z) < 3), false);
    assert.ok(left.length < origin.length);
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
});
