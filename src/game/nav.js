import { SHOP } from './catalog.js';
import { defaultFurniture, rotatedFootprint, walkFloors } from './layout.js';

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

export function shopObstacles(shop = SHOP, furniture = null) {
  const poses = furniture ?? {
    counter: { x: shop.counter.x, z: shop.counter.z, rot: 0 },
    anvil: { x: shop.anvil.x, z: shop.anvil.z, rot: 0.35 },
    chest: { x: shop.chest.x, z: shop.chest.z, rot: -0.45 },
    range: { x: shop.range.x, z: shop.range.z, rot: 0.12 },
    displays: shop.displays.map((spot) => ({ x: spot.x, z: spot.z, rot: spot.rot ?? 0 })),
  };
  const blocks = [
    // Counter blocks the customer-facing mass only, leaving a walkway behind it.
    blockFromPose(poses.counter, 1.09, 0.26),
    blockFromPose(poses.anvil, 0.44, 0.35),
    blockFromPose(poses.chest, 0.49, 0.36),
    blockFromPose(poses.range, 0.34, 0.28),
  ];
  if (poses.cauldron) blocks.push(blockFromPose(poses.cauldron, 0.32, 0.32));
  const displayPoses = poses.displays ?? [];
  for (const [index, spot] of shop.displays.entries()) {
    const pose = displayPoses[index] ?? { x: spot.x, z: spot.z, rot: spot.rot ?? 0 };
    if (spot.kind === 'shelf') blocks.push(blockFromPose(pose, 0.75, 0.25));
    else if (spot.kind === 'stand') blocks.push(blockFromPose(pose, 0.36, 0.36));
    else blocks.push(blockFromPose(pose, 0.76, 0.51));
  }
  for (const item of shop.clutter ?? []) {
    blocks.push(rectFromCenter(item.x, item.z, item.w, item.d));
  }
  return blocks;
}

export function floorsForState(state) {
  return walkFloors(state?.expansions ?? []);
}

export function liveObstacles(state, shop = SHOP) {
  return shopObstacles(shop, state?.furniture ?? defaultFurniture());
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

  const [sx, sz] = toCell(start.x, start.z);
  const [gx, gz] = toCell(goal.x, goal.z);
  const startKey = `${sx},${sz}`;
  const goalKey = `${gx},${gz}`;
  const open = [{ ix: sx, iz: sz, g: 0, f: Math.hypot(gx - sx, gz - sz) }];
  const came = new Map();
  const gScore = new Map([[startKey, 0]]);
  const seen = new Set();
  let steps = 0;

  while (open.length && steps < 4000) {
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
