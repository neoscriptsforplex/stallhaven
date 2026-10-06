import { SHOP } from './catalog.js';
import {
  FOUNTAIN,
  ROOM_D,
  ROOM_W,
  WALL_THICK,
  defaultFurniture,
  furnitureHalfSize,
  furnitureVisualYaw,
  gardenTreeSpots,
  gardenRockSpots,
  TREE_WALK_BLOCK,
  keepFountain,
  neighborsOf,
  occupiedCells,
  playerWalkFloors,
  pointOnFloors,
  roomCenter,
  rotatedFootprint,
  walkFloors,
  FLOOR_SNAP_MARGIN,
} from './layout.js';

export const FLOOR = { minX: -3.72, maxX: 3.72, minZ: -3.18, maxZ: 3.28 };
export const PLAYER_RADIUS = 0.28;
export const CELL = 0.2;
export const QUEUE_AISLE = { minX: -0.85, maxX: 0.85, minZ: -1.28, maxZ: 1.55 };

const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function rectFromCenter(x, z, w, d) {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  };
}

function blockFromPose(pose, hw, hd) {
  const span = rotatedFootprint(hw, hd, pose.rot ?? 0);
  return rectFromCenter(pose.x, pose.z, span.hw * 2, span.hd * 2);
}

function livePose(id, pose) {
  if (!pose) return pose;
  return { ...pose, rot: furnitureVisualYaw(id, pose.rot) };
}

export function shopObstacles(shop = SHOP, furniture = null) {
  const poses = furniture ?? {
    counter: { x: shop.counter.x, z: shop.counter.z, rot: 0 },
    anvil: { x: shop.anvil.x, z: shop.anvil.z, rot: 0.35 },
    chest: { x: shop.chest.x, z: shop.chest.z, rot: -0.45 },
    range: null,
    furnace: null,
    displays: shop.displays.map((spot) => ({ x: spot.x, z: spot.z, rot: spot.rot ?? 0 })),
  };
  const yaw = (id, pose) => (furniture ? livePose(id, pose) : pose);
  const blocks = [
    // Counter blocks the customer-facing mass only, leaving a walkway behind it.
    blockFromPose(yaw('counter', poses.counter), 1.09, 0.26),
    blockFromPose(yaw('anvil', poses.anvil), 0.22, 0.175),
    blockFromPose(yaw('chest', poses.chest), 0.3, 0.22),
  ];
  if (poses.range) {
    blocks.push(blockFromPose(
      yaw('range', poses.range),
      furnitureHalfSize('range').hw,
      furnitureHalfSize('range').hd,
    ));
  }
  if (poses.cauldron) blocks.push(blockFromPose(yaw('cauldron', poses.cauldron), 0.32, 0.32));
  if (poses.furnace) blocks.push(blockFromPose(yaw('furnace', poses.furnace), 0.4, 0.36));
  if (poses.wheel) {
    blocks.push(blockFromPose(
      yaw('wheel', poses.wheel),
      furnitureHalfSize('wheel').hw,
      furnitureHalfSize('wheel').hd,
    ));
  }
  for (const id of ['loom', 'fletch', 'potter']) {
    if (!poses[id]) continue;
    const { hw, hd } = furnitureHalfSize(id);
    blocks.push(blockFromPose(yaw(id, poses[id]), hw, hd));
  }
  const displayPoses = poses.displays ?? [];
  const kinds = furniture?.displayKinds;
  const removed = furniture?.displayRemoved;
  const count = Math.max(shop.displays.length, displayPoses.length);
  for (let index = 0; index < count; index += 1) {
    if (removed?.[index]) continue;
    const spot = shop.displays[index];
    const pose = displayPoses[index] ?? { x: spot?.x ?? 0, z: spot?.z ?? 0, rot: spot?.rot ?? 0 };
    if (Math.abs(pose.x) > 80 || Math.abs(pose.z) > 80) continue;
    const kind = kinds?.[index] ?? spot?.kind ?? 'table';
    const { hw, hd } = furnitureHalfSize(kind);
    blocks.push(blockFromPose(pose, hw, hd));
  }
  for (const item of shop.clutter ?? []) {
    if (item?.walkable || item?.kind === 'rug' || item?.id === 'rug') continue;
    blocks.push(rectFromCenter(item.x, item.z, item.w, item.d));
  }
  return blocks;
}

export function floorsForState(state) {
  return walkFloors(state?.expansions ?? []);
}

export function liveObstacles(state, shop = SHOP, skip = null) {
  const furniture = { ...(state?.furniture ?? defaultFurniture()) };
  furniture.displayKinds = (state?.displays ?? []).map((display, index) => (
    display?.kind ?? shop.displays[index]?.kind ?? 'table'
  ));
  furniture.displayRemoved = (state?.displays ?? []).map((display) => Boolean(display?.removed));
  if (skip?.id === 'cauldron') furniture.cauldron = null;
  if (skip?.id === 'furnace') furniture.furnace = null;
  if (skip?.id === 'range') furniture.range = null;
  if (skip?.id === 'wheel') furniture.wheel = null;
  if (skip?.id === 'loom') furniture.loom = null;
  if (skip?.id === 'fletch') furniture.fletch = null;
  if (skip?.id === 'potter') furniture.potter = null;
  if (skip?.id === 'anvil') furniture.anvil = { x: 999, z: 999, rot: 0 };
  if (skip?.id === 'chest') furniture.chest = { x: 999, z: 999, rot: 0 };
  if (skip?.id === 'counter') furniture.counter = { x: 999, z: 999, rot: 0 };
  if (skip?.id === 'display' && skip.index != null) {
    const displays = [...(furniture.displays ?? [])];
    displays[skip.index] = { x: 999, z: 999, rot: 0 };
    furniture.displays = displays;
  }
  return shopObstacles(shop, furniture);
}

export function gardenObstacles(expansionIds = []) {
  const blocks = [];
  if (keepFountain(expansionIds)) {
    const size = (FOUNTAIN.radius + 0.22) * 2;
    blocks.push(rectFromCenter(FOUNTAIN.x, FOUNTAIN.z, size, size));
  }
  for (const tree of gardenTreeSpots(expansionIds)) {
    blocks.push(rectFromCenter(tree.x, tree.z, TREE_WALK_BLOCK, TREE_WALK_BLOCK));
  }
  for (const rock of gardenRockSpots(expansionIds)) {
    const s = 0.45 * (rock.scale ?? 1);
    blocks.push(rectFromCenter(rock.x, rock.z, s, s));
  }
  return blocks;
}

/** Interior door width cut by addWallWithDoor (shopbuild.js). */
export const EXPANSION_DOOR_W = 1.28;
/** Origin storefront opening: doorHalf 0.58 on each side of the front wall. */
export const ORIGIN_DOOR_W = 1.16;

/** Dungeon shell from buildDungeon: 11×9 room, walls 0.22 thick. */
const DUNGEON_W = 11;
const DUNGEON_D = 9;
const DUNGEON_WALL_T = 0.22;

function wallPieces(axis, x, z, span, thick, doorAlong, doorW) {
  const halfT = thick / 2;
  const halfS = span / 2;
  if (axis === 'x') {
    const z0 = z - halfT;
    const z1 = z + halfT;
    const x0 = x - halfS;
    const x1 = x + halfS;
    if (doorAlong == null) return [{ minX: x0, maxX: x1, minZ: z0, maxZ: z1 }];
    const d0 = doorAlong - doorW / 2;
    const d1 = doorAlong + doorW / 2;
    const parts = [];
    if (d0 - x0 > 0.02) parts.push({ minX: x0, maxX: d0, minZ: z0, maxZ: z1 });
    if (x1 - d1 > 0.02) parts.push({ minX: d1, maxX: x1, minZ: z0, maxZ: z1 });
    return parts;
  }
  const x0 = x - halfT;
  const x1 = x + halfT;
  const z0 = z - halfS;
  const z1 = z + halfS;
  if (doorAlong == null) return [{ minX: x0, maxX: x1, minZ: z0, maxZ: z1 }];
  const d0 = doorAlong - doorW / 2;
  const d1 = doorAlong + doorW / 2;
  const parts = [];
  if (d0 - z0 > 0.02) parts.push({ minX: x0, maxX: x1, minZ: z0, maxZ: d0 });
  if (z1 - d1 > 0.02) parts.push({ minX: x0, maxX: x1, minZ: d1, maxZ: z1 });
  return parts;
}

/** Solid shop walls for the current rooms. Door gaps stay open. Matches addRoomWalls. */
export function buildShopWallRects(expansionIds = []) {
  const blocks = [];
  const thick = WALL_THICK;
  for (const cell of occupiedCells(expansionIds)) {
    const c = roomCenter(cell.gx, cell.gz);
    const neigh = neighborsOf(cell.gx, cell.gz, expansionIds);
    const isOrigin = cell.gx === 0 && cell.gz === 0;
    const leftX = c.x - ROOM_W / 2;
    const rightX = c.x + ROOM_W / 2;
    const backZ = c.z - ROOM_D / 2;
    const frontZ = c.z + ROOM_D / 2;
    if (!neigh.left) blocks.push(...wallPieces('z', leftX, c.z, ROOM_D, thick, null, 0));
    if (neigh.right) blocks.push(...wallPieces('z', rightX, c.z, ROOM_D, thick, c.z, EXPANSION_DOOR_W));
    else blocks.push(...wallPieces('z', rightX, c.z, ROOM_D, thick, null, 0));
    if (neigh.back) blocks.push(...wallPieces('x', c.x, backZ, ROOM_W, thick, c.x, EXPANSION_DOOR_W));
    else blocks.push(...wallPieces('x', c.x, backZ, ROOM_W, thick, null, 0));
    if (!neigh.front) {
      if (isOrigin) blocks.push(...wallPieces('x', c.x, frontZ, ROOM_W, thick, c.x, ORIGIN_DOOR_W));
      else blocks.push(...wallPieces('x', c.x, frontZ, ROOM_W, thick, null, 0));
    }
  }
  return blocks;
}

function rasterizeBlockedCells(walls, radius) {
  const blocked = new Set();
  for (const block of walls) {
    const ix0 = Math.floor((block.minX - radius) / CELL);
    const ix1 = Math.ceil((block.maxX + radius) / CELL);
    const iz0 = Math.floor((block.minZ - radius) / CELL);
    const iz1 = Math.ceil((block.maxZ + radius) / CELL);
    for (let ix = ix0; ix <= ix1; ix += 1) {
      for (let iz = iz0; iz <= iz1; iz += 1) {
        if (pointInRect(ix * CELL, iz * CELL, block, radius)) blocked.add(`${ix},${iz}`);
      }
    }
  }
  return blocked;
}

function expansionKey(expansionIds = []) {
  return [...expansionIds].slice().sort().join(',');
}

let wallNavCache = null;

/** Rebuild the wall grid. Called when an expansion is bought or the shop is reset. */
export function rebuildShopWalls(expansionIds = [], radius = PLAYER_RADIUS) {
  const walls = buildShopWallRects(expansionIds);
  wallNavCache = {
    key: `${radius}|${expansionKey(expansionIds)}`,
    walls,
    blocked: rasterizeBlockedCells(walls, radius),
  };
  return wallNavCache.walls;
}

function shopWallNav(expansionIds = [], radius = PLAYER_RADIUS) {
  const key = `${radius}|${expansionKey(expansionIds)}`;
  if (!wallNavCache || wallNavCache.key !== key) rebuildShopWalls(expansionIds, radius);
  return wallNavCache;
}

export function shopWallObstacles(expansionIds = [], radius = PLAYER_RADIUS) {
  return shopWallNav(expansionIds, radius).walls;
}

export function shopWallNavGrid(expansionIds = [], radius = PLAYER_RADIUS) {
  return shopWallNav(expansionIds, radius).blocked;
}

export function dungeonWallObstacles() {
  return [
    rectFromCenter(0, -DUNGEON_D / 2, DUNGEON_W, DUNGEON_WALL_T),
    rectFromCenter(0, DUNGEON_D / 2, DUNGEON_W, DUNGEON_WALL_T),
    rectFromCenter(-DUNGEON_W / 2, 0, DUNGEON_WALL_T, DUNGEON_D),
    rectFromCenter(DUNGEON_W / 2, 0, DUNGEON_WALL_T, DUNGEON_D),
  ];
}

/** Near-face radius used by gather stands. Essence is the large centre rock. */
function dungeonRockFace(spot) {
  if (Number.isFinite(spot?.face)) return spot.face;
  return spot?.materialId === 'essence' || spot?.essence ? 1.04 : 0.52;
}

/**
 * Square blockers inside each rock. Sized so a mining stand around the face
 * stays walkable after the player-radius pad, including the diagonal.
 */
export function dungeonBoulderObstacles(spots = []) {
  return spots.map((spot) => {
    const span = dungeonRockFace(spot) * 1.55;
    return rectFromCenter(spot.x ?? 0, spot.z ?? 0, span, span);
  });
}

export function dungeonMoveObstacles(spots = []) {
  return [...dungeonWallObstacles(), ...dungeonBoulderObstacles(spots)];
}

export function playerObstacles(state, shop = SHOP) {
  return [
    ...liveObstacles(state, shop),
    ...gardenObstacles(state?.expansions ?? []),
    ...shopWallObstacles(state?.expansions ?? []),
  ];
}

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.maxX + pad < b.minX
    || a.minX - pad > b.maxX
    || a.maxZ + pad < b.minZ
    || a.minZ - pad > b.maxZ
  );
}

export function placementBlocked(pose, kind, obstacles, floors, { checkAisle = true } = {}) {
  if (!pose) return 'That spot is off the shop floor.';
  const { hw, hd } = furnitureHalfSize(kind);
  const span = rotatedFootprint(hw, hd, furnitureVisualYaw(kind, pose?.rot));
  if (kind === 'shelf') {
    if (!pointOnFloors(pose.x, pose.z, floors, -0.35)) {
      return 'That spot is off the shop wall.';
    }
  } else if (!pointOnFloors(pose.x, pose.z, floors, FLOOR_SNAP_MARGIN)) {
    return 'That spot is off the shop floor.';
  }
  if (checkAisle && kind !== 'counter' && kind !== 'rug' && rectHitsAisle(pose.x, pose.z, span.hw, span.hd)) {
    return 'That spot blocks the customer queue.';
  }
  const rect = rectFromCenter(pose.x, pose.z, span.hw * 2, span.hd * 2);
  for (const block of obstacles) {
    if (rectsOverlap(rect, block, 0.02)) return 'That spot overlaps other furniture.';
  }
  return null;
}

export function pointInRect(x, z, rect, pad = 0) {
  return x >= rect.minX - pad
    && x <= rect.maxX + pad
    && z >= rect.minZ - pad
    && z <= rect.maxZ + pad;
}

export function isWalkable(x, z, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  const onFloor = floors.some((rect) => (
    x >= rect.minX + radius
    && x <= rect.maxX - radius
    && z >= rect.minZ + radius
    && z <= rect.maxZ - radius
  ));
  if (!onFloor) return false;
  return !obstacles.some((block) => pointInRect(x, z, block, radius));
}

export function nearestWalkable(x, z, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  if (isWalkable(x, z, obstacles, radius, floors)) return { x, z };
  const maxR = 2.4;
  const step = 0.12;
  for (let ring = step; ring <= maxR; ring += step) {
    const samples = Math.max(8, Math.round((Math.PI * 2 * ring) / step));
    for (let i = 0; i < samples; i += 1) {
      const angle = (i / samples) * Math.PI * 2;
      const nx = x + Math.cos(angle) * ring;
      const nz = z + Math.sin(angle) * ring;
      if (isWalkable(nx, nz, obstacles, radius, floors)) return { x: nx, z: nz };
    }
  }
  return null;
}

export function hasLineOfSight(from, to, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return true;
  // Sample tighter than the obstacle pad so a shortcut cannot graze a tree or wall.
  const steps = Math.max(2, Math.ceil(dist / 0.05));
  const pad = radius + 0.04;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!isWalkable(from.x + dx * t, from.z + dz * t, obstacles, pad, floors)) return false;
  }
  return true;
}

function toCell(x, z) {
  return [Math.round(x / CELL), Math.round(z / CELL)];
}

function heapPush(heap, node) {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= heap[i].f) break;
    const tmp = heap[parent];
    heap[parent] = heap[i];
    heap[i] = tmp;
    i = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (!heap.length) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let smallest = i;
    if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left;
    if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right;
    if (smallest === i) break;
    const tmp = heap[smallest];
    heap[smallest] = heap[i];
    heap[i] = tmp;
    i = smallest;
  }
  return top;
}

function cellWorld(ix, iz) {
  return { x: ix * CELL, z: iz * CELL };
}

/** A* cells must be walkable; a walkable world point can still round onto a blocked cell. */
function toWalkableCell(x, z, obstacles, radius, floors) {
  const [ix0, iz0] = toCell(x, z);
  if (isWalkable(ix0 * CELL, iz0 * CELL, obstacles, radius, floors)) return [ix0, iz0];
  let best = null;
  let bestD = Infinity;
  for (let ring = 1; ring <= 4; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dz = -ring; dz <= ring; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const ix = ix0 + dx;
        const iz = iz0 + dz;
        const world = cellWorld(ix, iz);
        if (!isWalkable(world.x, world.z, obstacles, radius, floors)) continue;
        const dist = Math.hypot(world.x - x, world.z - z);
        if (dist < bestD) {
          best = [ix, iz];
          bestD = dist;
        }
      }
    }
    if (best) return best;
  }
  return [ix0, iz0];
}

function routeFrom(came, key, goal, obstacles, radius, floors, start, allowGoal) {
  const cells = [];
  let walk = key;
  const guard = new Set();
  while (walk && !guard.has(walk)) {
    guard.add(walk);
    const [ix, iz] = walk.split(',').map(Number);
    cells.push({ ix, iz });
    const prev = came.get(walk);
    walk = prev ? `${prev.ix},${prev.iz}` : null;
  }
  cells.reverse();
  const points = cells.map((cell) => cellWorld(cell.ix, cell.iz));
  const tail = points[points.length - 1];
  if (allowGoal && tail && goal && Math.hypot(tail.x - goal.x, tail.z - goal.z) > 0.001
    && hasLineOfSight(tail, goal, obstacles, radius, floors)) {
    points.push(goal);
  }
  return smoothPath(start, points, obstacles, radius, floors);
}

function smoothPath(start, points, obstacles, radius, floors) {
  if (!points.length) return [];
  const out = [];
  let from = start;
  let i = 0;
  while (i < points.length) {
    let best = i;
    for (let j = points.length - 1; j > i; j -= 1) {
      if (hasLineOfSight(from, points[j], obstacles, radius, floors)) {
        best = j;
        break;
      }
    }
    out.push(points[best]);
    from = points[best];
    i = best + 1;
  }
  return out;
}

export function findPath(from, to, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR], wallBlocked = null) {
  const start = nearestWalkable(from.x, from.z, obstacles, radius, floors) ?? from;
  const goal = nearestWalkable(to.x, to.z, obstacles, radius, floors);
  const aim = goal ?? { x: to.x, z: to.z };
  if (goal && hasLineOfSight(start, goal, obstacles, radius, floors)) return [goal];

  const [sx, sz] = toWalkableCell(start.x, start.z, obstacles, radius, floors);
  const [gx, gz] = toWalkableCell(aim.x, aim.z, obstacles, radius, floors);
  const startKey = `${sx},${sz}`;
  const goalKey = `${gx},${gz}`;
  const open = [{ ix: sx, iz: sz, g: 0, f: Math.hypot(gx - sx, gz - sz) }];
  const came = new Map();
  const gScore = new Map([[startKey, 0]]);
  const seen = new Set();
  let steps = 0;
  let bestKey = null;
  let bestDist = Infinity;

  while (open.length && steps < 40000) {
    steps += 1;
    const cur = heapPop(open);
    const key = `${cur.ix},${cur.iz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const here = cellWorld(cur.ix, cur.iz);
    const dist = Math.hypot(here.x - aim.x, here.z - aim.z);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
    if (key === goalKey) {
      return routeFrom(came, key, goal, obstacles, radius, floors, start, true);
    }
    for (const [dx, dz, cost] of NEIGHBORS) {
      const nix = cur.ix + dx;
      const niz = cur.iz + dz;
      const nKey = `${nix},${niz}`;
      if (seen.has(nKey)) continue;
      if (wallBlocked?.has(nKey)) continue;
      if (dx !== 0 && dz !== 0) {
        if (wallBlocked?.has(`${cur.ix + dx},${cur.iz}`)) continue;
        if (wallBlocked?.has(`${cur.ix},${cur.iz + dz}`)) continue;
        if (!isWalkable((cur.ix + dx) * CELL, cur.iz * CELL, obstacles, radius, floors)) continue;
        if (!isWalkable(cur.ix * CELL, (cur.iz + dz) * CELL, obstacles, radius, floors)) continue;
      }
      const world = cellWorld(nix, niz);
      if (!isWalkable(world.x, world.z, obstacles, radius, floors)) continue;
      const g = cur.g + cost;
      if (g >= (gScore.get(nKey) ?? Infinity)) continue;
      gScore.set(nKey, g);
      came.set(nKey, { ix: cur.ix, iz: cur.iz });
      heapPush(open, {
        ix: nix,
        iz: niz,
        g,
        f: g + Math.hypot(gx - nix, gz - niz),
      });
    }
  }
  if (!bestKey) return [];
  return routeFrom(came, bestKey, goal, obstacles, radius, floors, start, false);
}

export function planWalk(from, to, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  return findPath(from, to, obstacles, radius, floors);
}

export function planPlayerWalk(from, to, state, radius = PLAYER_RADIUS) {
  const ids = state?.expansions ?? [];
  const floors = playerWalkFloors(ids);
  const obstacles = playerObstacles(state);
  const wallBlocked = shopWallNavGrid(ids, radius);
  return findPath(from, to, obstacles, radius, floors, wallBlocked);
}

function slideStep(x, z, nx, nz, obstacles, radius, floors) {
  const ok = (px, pz) => isWalkable(px, pz, obstacles, radius, floors);
  const hitsBlock = (px, pz) => obstacles.some((block) => pointInRect(px, pz, block, radius));
  if (ok(nx, nz)) return { x: nx, z: nz, blocked: false };
  if (!ok(x, z)) {
    if (!hitsBlock(nx, nz)) return { x: nx, z: nz, blocked: false };
    if (!hitsBlock(nx, z)) return { x: nx, z, blocked: true };
    if (!hitsBlock(x, nz)) return { x, z: nz, blocked: true };
    return { x, z, blocked: true };
  }
  if (ok(nx, z)) return { x: nx, z, blocked: true };
  if (ok(x, nz)) return { x, z: nz, blocked: true };
  return { x, z, blocked: true };
}

/** Step toward a point without entering a wall or other blocker. Slides along a face. */
export function moveWithCollision(x, z, nx, nz, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  const dist = Math.hypot(nx - x, nz - z);
  if (dist < 1e-6) return { x, z, blocked: false };
  const steps = Math.max(1, Math.ceil(dist / (CELL * 0.45)));
  let cx = x;
  let cz = z;
  let blocked = false;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const next = slideStep(
      cx,
      cz,
      x + (nx - x) * t,
      z + (nz - z) * t,
      obstacles,
      radius,
      floors,
    );
    if (next.blocked) blocked = true;
    if (next.x === cx && next.z === cz) break;
    cx = next.x;
    cz = next.z;
  }
  return { x: cx, z: cz, blocked };
}

export function queueSlot(index, shop = SHOP, counter = null) {
  if (!counter) {
    return {
      x: shop.queue.x,
      z: shop.queue.z + index * shop.queue.gap,
    };
  }
  const rot = counter.rot ?? 0;
  const dist = (shop.queue.z - shop.counter.z) + index * shop.queue.gap;
  return {
    x: counter.x + Math.sin(rot) * dist,
    z: counter.z + Math.cos(rot) * dist,
  };
}

export function rectHitsAisle(x, z, hw, hd, aisle = QUEUE_AISLE) {
  return !(
    x + hw < aisle.minX
    || x - hw > aisle.maxX
    || z + hd < aisle.minZ
    || z - hd > aisle.maxZ
  );
}
