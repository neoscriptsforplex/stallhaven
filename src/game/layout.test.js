import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEST_MAX_LEVEL,
  EXPANSION_PADS,
  FURNITURE_FORWARD,
  FURNITURE_ROT_STEP,
  SWAP_PRICE_RATIO,
  chestSlots,
  chestUpgradeCost,
  defaultFurniture,
  expansionCost,
  occupiedCells,
  padConnects,
  padById,
  rotatePose,
  snapToFloor,
  walkFloors,
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

  it('prices expansions 500 then ×5, and chest 500 then ×3', () => {
    assert.equal(expansionCost(0), 500);
    assert.equal(expansionCost(1), 2500);
    assert.equal(expansionCost(2), 12500);
    assert.equal(chestUpgradeCost(1), 500);
    assert.equal(chestUpgradeCost(2), 1500);
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
  });

  it('snaps furniture on both floor axes, not only sideways', () => {
    const floors = walkFloors([]);
    const side = snapToFloor(1.37, 0.11, floors);
    const along = snapToFloor(0.11, 1.37, floors);
    assert.ok(Math.abs(side.x - 1.4) < 1e-9);
    assert.ok(Math.abs(along.z - 1.4) < 1e-9);
    assert.notEqual(along.z, side.z);
  });
});
