import { SHOP } from './catalog.js';
import {
  FOUNTAIN,
  defaultFurniture,
  furnitureHalfSize,
  furnitureVisualYaw,
  gardenTreeSpots,
  gardenRockSpots,
  keepFountain,
  playerWalkFloors,
  pointOnFloors,
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
    blocks.push(rectFromCenter(tree.x, tree.z, 0.62, 0.62));
  }
  for (const rock of gardenRockSpots(expansionIds)) {
    const s = 0.45 * (rock.scale ?? 1);
    blocks.push(rectFromCenter(rock.x, rock.z, s, s));
  }
  return blocks;
}

export function playerObstacles(state, shop = SHOP) {
  return [...liveObstacles(state, shop), ...gardenObstacles(state?.expansions ?? [])];
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
  const steps = Math.max(2, Math.ceil(dist / 0.1));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!isWalkable(from.x + dx * t, from.z + dz * t, obstacles, radius, floors)) return false;
  }
  return true;
}

function toCell(x, z) {
  return [Math.round(x / CELL), Math.round(z / CELL)];
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

export function findPath(from, to, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  const start = nearestWalkable(from.x, from.z, obstacles, radius, floors) ?? from;
  const goal = nearestWalkable(to.x, to.z, obstacles, radius, floors);
  if (!goal) return [];
  if (hasLineOfSight(start, goal, obstacles, radius, floors)) return [goal];

  const [sx, sz] = toWalkableCell(start.x, start.z, obstacles, radius, floors);
  const [gx, gz] = toWalkableCell(goal.x, goal.z, obstacles, radius, floors);
  const startKey = `${sx},${sz}`;
  const goalKey = `${gx},${gz}`;
  const open = [{ ix: sx, iz: sz, g: 0, f: Math.hypot(gx - sx, gz - sz) }];
  const came = new Map();
  const gScore = new Map([[startKey, 0]]);
  const seen = new Set();
  let steps = 0;

  while (open.length && steps < 40000) {
    steps += 1;
    let best = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[best].f) best = i;
    }
    const cur = open.splice(best, 1)[0];
    const key = `${cur.ix},${cur.iz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === goalKey) {
      const cells = [{ ix: cur.ix, iz: cur.iz }];
      let walk = key;
      while (came.has(walk)) {
        const prev = came.get(walk);
        cells.push(prev);
        walk = `${prev.ix},${prev.iz}`;
      }
      cells.reverse();
      const points = cells.map((cell) => cellWorld(cell.ix, cell.iz));
      points[points.length - 1] = goal;
      return smoothPath(start, points, obstacles, radius, floors);
    }
    for (const [dx, dz, cost] of NEIGHBORS) {
      const nix = cur.ix + dx;
      const niz = cur.iz + dz;
      const nKey = `${nix},${niz}`;
      if (seen.has(nKey)) continue;
      if (dx !== 0 && dz !== 0) {
        if (!isWalkable((cur.ix + dx) * CELL, cur.iz * CELL, obstacles, radius, floors)) continue;
        if (!isWalkable(cur.ix * CELL, (cur.iz + dz) * CELL, obstacles, radius, floors)) continue;
      }
      const world = cellWorld(nix, niz);
      if (!isWalkable(world.x, world.z, obstacles, radius, floors)) continue;
      const g = cur.g + cost;
      if (g >= (gScore.get(nKey) ?? Infinity)) continue;
      gScore.set(nKey, g);
      came.set(nKey, { ix: cur.ix, iz: cur.iz });
      open.push({
        ix: nix,
        iz: niz,
        g,
        f: g + Math.hypot(gx - nix, gz - niz),
      });
    }
  }
  return [];
}

export function planWalk(from, to, obstacles, radius = PLAYER_RADIUS, floors = [FLOOR]) {
  return findPath(from, to, obstacles, radius, floors);
}

export function planPlayerWalk(from, to, state, radius = PLAYER_RADIUS) {
  const indoor = walkFloors(state?.expansions ?? []);
  const floors = playerWalkFloors(state?.expansions ?? []);
  const obstacles = playerObstacles(state);
  const doorIn = { x: 0, z: FLOOR.maxZ - radius - 0.08 };
  const doorOut = { x: 0, z: FLOOR.maxZ + radius + 0.35 };
  const fromInside = indoor.some((rect) => pointInRect(from.x, from.z, rect, -0.05));
  const toInside = indoor.some((rect) => pointInRect(to.x, to.z, rect, -0.05));
  if (fromInside && toInside) {
    const indoorPath = findPath(from, to, obstacles, radius, indoor);
    if (indoorPath.length) return indoorPath;
  }
  if (fromInside !== toInside) {
    const first = findPath(from, fromInside ? doorIn : doorOut, obstacles, radius, floors);
    const second = findPath(fromInside ? doorOut : doorIn, to, obstacles, radius, floors);
    const joined = [...first, ...second];
    if (joined.length) return joined;
  }
  return findPath(from, to, obstacles, radius, floors);
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
