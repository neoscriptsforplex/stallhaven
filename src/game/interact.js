import { PLAYER_RADIUS, planPlayerWalk } from './nav.js';
import { furnitureVisualYaw } from './layout.js';

export const USE_STATIONS = ['anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel'];
export const USE_KINDS = new Set([...USE_STATIONS, 'trapdoor', 'ladder', 'boulder']);

/** Invisible click boxes and floor-steal radii for walk-then-open stations. */
export const STATION_HIT = {
  anvil: { w: 1.62, h: 1.9, d: 1.42, pickY: 0.9, floorR: 1.2 },
  chest: { w: 1.55, h: 1.7, d: 1.28, pickY: 0.82, floorR: 1.1 },
  range: { w: 2.4, h: 3.3, d: 2.2, pickY: 1.6, floorR: 1.55 },
  furnace: { w: 1.28, h: 1.7, d: 1.2, pickY: 0.8, floorR: 1.05 },
  cauldron: { w: 1.15, h: 1.55, d: 1.15, pickY: 0.74, floorR: 1.0 },
  wheel: { w: 1.85, h: 2.4, d: 1.8, pickY: 1.1, floorR: 1.35 },
  boulder: { w: 1.4, h: 1.2, d: 1.4, pickY: 0.52, floorR: 1.15 },
};

export const STATION_ARRIVE = 1.45;

const APPROACH_OFFSETS = [
  [0, 0.85],
  [0, 0.7],
  [0.85, 0],
  [-0.85, 0],
  [0, -0.85],
  [0.65, 0.65],
  [-0.65, 0.65],
  [0.65, -0.65],
  [-0.65, -0.65],
  [0, 1.15],
  [0, 0],
];

const APPROACH_DIST = 0.85;

/** Local +Z is the cook-face / door on the range dump. Prefer that side first. */
function facingApproachOffsets(kind, pose) {
  const yaw = furnitureVisualYaw(kind, pose?.rot ?? 0);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return [
    [fx * APPROACH_DIST, fz * APPROACH_DIST],
    [fx * 0.7, fz * 0.7],
    [fx * 1.15, fz * 1.15],
    [rx * APPROACH_DIST, rz * APPROACH_DIST],
    [-rx * APPROACH_DIST, -rz * APPROACH_DIST],
    [-fx * APPROACH_DIST, -fz * APPROACH_DIST],
    [fx * 0.65 + rx * 0.65, fz * 0.65 + rz * 0.65],
    [fx * 0.65 - rx * 0.65, fz * 0.65 - rz * 0.65],
    [0, 0],
  ];
}

export function isNearPoint(from, to, dist) {
  return Math.hypot((from?.x ?? 0) - (to?.x ?? 0), (from?.z ?? 0) - (to?.z ?? 0)) <= dist;
}

export function pickUseHit(hits) {
  if (!hits?.length) return null;
  const useHit = hits.find((hit) => USE_KINDS.has(hit.object?.userData?.kind));
  const closestKind = hits[0].object?.userData?.kind;
  if (useHit && (!closestKind || closestKind === 'ground' || closestKind === 'expand-pad' || USE_KINDS.has(closestKind))) {
    return useHit;
  }
  return hits.find((hit) => {
    const kind = hit.object?.userData?.kind;
    return kind && kind !== 'ground' && kind !== 'customer' && kind !== 'expand-pad';
  }) ?? null;
}

export function stationAtFloor(x, z, furniture = {}) {
  let best = null;
  for (const id of USE_STATIONS) {
    const pose = furniture[id];
    if (!pose) continue;
    const radius = STATION_HIT[id]?.floorR ?? 0.9;
    const dist = Math.hypot(x - pose.x, z - pose.z);
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { type: id, pose, dist };
    }
  }
  return best;
}

export function resolveStationUse(from, pose, state, planFn = planPlayerWalk, kind = null) {
  if (!pose) return { action: 'none' };
  if (isNearPoint(from, pose, STATION_ARRIVE)) return { action: 'open' };
  const offsets = kind === 'range' ? facingApproachOffsets(kind, pose) : APPROACH_OFFSETS;
  for (const [dx, dz] of offsets) {
    const dest = { x: pose.x + dx, z: pose.z + dz };
    const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
    if (path.length) return { action: 'walk', path, dest };
  }
  return { action: 'blocked' };
}
