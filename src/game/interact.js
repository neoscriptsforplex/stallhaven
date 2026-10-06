import { FLAX_ARRIVE } from './catalog.js';
import { PLAYER_RADIUS, isWalkable, planPlayerWalk, playerObstacles } from './nav.js';
import { furnitureVisualYaw, playerWalkFloors } from './layout.js';

export const USE_STATIONS = ['anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel', 'loom', 'fletch', 'potter'];
export const USE_KINDS = new Set([...USE_STATIONS, 'trapdoor', 'ladder', 'boulder']);

/** Invisible click boxes and floor-steal radii for walk-then-open stations. */
export const STATION_HIT = {
  anvil: { w: 1.62, h: 1.9, d: 1.42, pickY: 0.9, floorR: 1.2 },
  chest: { w: 1.55, h: 1.7, d: 1.28, pickY: 0.82, floorR: 1.1 },
  range: { w: 2.4, h: 3.3, d: 2.2, pickY: 1.6, floorR: 1.55 },
  furnace: { w: 1.28, h: 1.7, d: 1.2, pickY: 0.8, floorR: 1.05 },
  cauldron: { w: 1.15, h: 1.55, d: 1.15, pickY: 0.74, floorR: 1.0 },
  wheel: { w: 1.85, h: 2.4, d: 1.8, pickY: 1.1, floorR: 1.35 },
  loom: { w: 1.25, h: 1.45, d: 0.95, pickY: 0.72, floorR: 0.95 },
  fletch: { w: 1.4, h: 1.25, d: 1.05, pickY: 0.64, floorR: 1.0 },
  potter: { w: 1.15, h: 1.3, d: 1.15, pickY: 0.64, floorR: 0.9 },
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
const STAND_FRONT = new Set(['counter', 'chest']);

/**
 * Cook stand in the range mesh's own XZ, in metres, so it yaws with the station.
 * Local +Z is the chimney end. The pan and the left red grill sit toward −Z
 * (about z = −0.40). Local −X is the front face the handle points out of;
 * the left section's face is near x = −0.37, and −1.17 is about one step out.
 */
export const RANGE_STAND_LOCAL = { x: -1.17, z: -0.40 };

export function rangeFaceYaw(pose) {
  const yaw = furnitureVisualYaw('range', pose?.rot ?? 0);
  return Math.atan2(Math.cos(yaw), -Math.sin(yaw));
}

export function rangeStandWorld(pose) {
  const yaw = furnitureVisualYaw('range', pose?.rot ?? 0);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const { x, z } = RANGE_STAND_LOCAL;
  return {
    x: (pose?.x ?? 0) + x * c + z * s,
    z: (pose?.z ?? 0) - x * s + z * c,
  };
}

function rangeStandCandidates(pose) {
  const yaw = furnitureVisualYaw('range', pose?.rot ?? 0);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [0, 0.22, 0.44].map((extra) => {
    const x = RANGE_STAND_LOCAL.x - extra;
    const z = RANGE_STAND_LOCAL.z;
    return {
      x: (pose?.x ?? 0) + x * c + z * s,
      z: (pose?.z ?? 0) - x * s + z * c,
    };
  });
}

/**
 * Fletching bench stand in the mesh's own XZ, in metres, so it yaws with the bench.
 * Local −X is the vice end (where a world-axis approach leaves the player).
 * The front face is local +Z; the vice sits centre-left at about x = −0.22.
 * z = 1.22 is about one step out from that face (the face is near z = 0.39).
 * Closer spots stay on the same line when the full step is blocked.
 */
export const FLETCH_STAND_LOCAL = { x: -0.22, z: 1.22 };

const FLETCH_STAND_TRIES = [
  FLETCH_STAND_LOCAL,
  { x: -0.22, z: 1.05 },
  { x: -0.22, z: 0.92 },
  { x: -0.22, z: 0.8 },
];

export function fletchFaceYaw(pose) {
  const yaw = furnitureVisualYaw('fletch', pose?.rot ?? 0);
  return Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
}

export function fletchStandWorld(pose, local = FLETCH_STAND_LOCAL) {
  const yaw = furnitureVisualYaw('fletch', pose?.rot ?? 0);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const { x, z } = local;
  return {
    x: (pose?.x ?? 0) + x * c + z * s,
    z: (pose?.z ?? 0) - x * s + z * c,
  };
}

function fletchStandCandidates(pose) {
  return FLETCH_STAND_TRIES.map((local) => fletchStandWorld(pose, local));
}

/**
 * Gathering contacts in character-local units (the rig is 1.8 tall and then
 * scaled by about 0.863). The player stands so this point lands on the node.
 * Rock is the tip on the near face; the centre is farther along the same line.
 * Tree is the trunk centre for a radius-0.12 trunk. Flax is the plant base.
 */
export const GATHER_MODEL_SCALE = 0.863;
export const GATHER_CONTACT = {
  rock: { x: -0.02, z: 0.61 },
  tree: { x: 0.21, z: 0.62 },
  flax: { x: -0.12, z: 0.31 },
};

/** Near-face radius of a dungeon boulder, in world metres. Essence is the large one. */
export function boulderFaceRadius(materialId) {
  return materialId === 'essence' ? 1.04 : 0.52;
}

function gatherCentreOffset(kind, pose, scale) {
  if (kind === 'boulder') {
    const contact = GATHER_CONTACT.rock;
    const lx = contact.x * scale;
    const lz = contact.z * scale;
    const len = Math.hypot(lx, lz) || 1;
    const grow = (len + boulderFaceRadius(pose?.materialId)) / len;
    return { x: lx * grow, z: lz * grow };
  }
  const local = kind === 'tree' ? GATHER_CONTACT.tree : GATHER_CONTACT.flax;
  return { x: local.x * scale, z: local.z * scale };
}

function growOffset(offset, extra) {
  const len = Math.hypot(offset.x, offset.z) || 1;
  const grow = (len + extra) / len;
  return { x: offset.x * grow, z: offset.z * grow };
}

/** Stand and facing yaw that put `offset` (world metres, character-local XZ) on the node. */
export function gatherStandAt(node, offset, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const wx = offset.x * c + offset.z * s;
  const wz = -offset.x * s + offset.z * c;
  return {
    x: (node?.x ?? 0) - wx,
    z: (node?.z ?? 0) - wz,
    yaw,
  };
}

/** Closest alignments first. Trees start a step back: the trunk block sits just outside the ideal. */
export function gatherStandCandidates(kind, pose, scale = GATHER_MODEL_SCALE) {
  const base = gatherCentreOffset(kind, pose, scale);
  const extras = kind === 'tree' ? [0.08, 0.14, 0.24, 0.4] : [0, 0.08, 0.18, 0.36];
  const spots = [];
  for (const extra of extras) {
    for (let i = 0; i < 8; i += 1) {
      const yaw = (i / 8) * Math.PI * 2;
      const spot = gatherStandAt(pose, growOffset(base, extra), yaw);
      spot.extra = extra;
      spots.push(spot);
    }
  }
  return spots;
}

function gatherArrive(kind) {
  return kind === 'flax' ? 0.22 : 0.32;
}

function defaultCanStand(x, z, state) {
  return isWalkable(
    x,
    z,
    playerObstacles(state),
    PLAYER_RADIUS,
    playerWalkFloors(state?.expansions ?? []),
  );
}

function resolveGatherStand(from, pose, state, planFn, kind, canStand) {
  const standable = canStand ?? ((x, z) => defaultCanStand(x, z, state));
  const spots = gatherStandCandidates(kind, pose).filter((dest) => standable(dest.x, dest.z));
  const arrive = gatherArrive(kind);
  for (const dest of spots) {
    if (isNearPoint(from, dest, arrive)) return { action: 'open', dest, face: dest.yaw };
  }
  let tried = 0;
  let empty = 0;
  for (const dest of spots) {
    if (tried >= 4 || empty >= 2) break;
    tried += 1;
    const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
    const end = path[path.length - 1];
    if (!end) {
      empty += 1;
      continue;
    }
    if (Math.hypot(end.x - dest.x, end.z - dest.z) < 0.2) {
      return { action: 'walk', path, dest, face: dest.yaw };
    }
  }
  return null;
}

/**
 * Local +Z is the shopkeeper side of the counter. The chest latch is dump
 * local −X (into the room at visual yaw 0).
 */
function facingApproachOffsets(kind, pose) {
  const yaw = furnitureVisualYaw(kind, pose?.rot ?? 0);
  const face = kind === 'chest' ? yaw - Math.PI / 2 : yaw;
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  const rx = Math.cos(face);
  const rz = -Math.sin(face);
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

function isWalkFloorKind(kind) {
  return kind === 'ground' || kind === 'rug';
}

export function pickUseHit(hits) {
  if (!hits?.length) return null;
  const useHit = hits.find((hit) => USE_KINDS.has(hit.object?.userData?.kind));
  const closestKind = hits[0].object?.userData?.kind;
  if (useHit && (!closestKind || isWalkFloorKind(closestKind) || closestKind === 'expand-pad' || USE_KINDS.has(closestKind))) {
    return useHit;
  }
  return hits.find((hit) => {
    const kind = hit.object?.userData?.kind;
    return kind && !isWalkFloorKind(kind) && kind !== 'customer' && kind !== 'expand-pad';
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

export function resolveStationUse(from, pose, state, planFn = planPlayerWalk, kind = null, canStand = null) {
  if (!pose) return { action: 'none' };
  if (STAND_FRONT.has(kind)) {
    const offsets = facingApproachOffsets(kind, pose);
    const stand = { x: pose.x + offsets[0][0], z: pose.z + offsets[0][1] };
    if (isNearPoint(from, stand, 0.5)) return { action: 'open', dest: stand };
    for (const [dx, dz] of offsets) {
      const dest = { x: pose.x + dx, z: pose.z + dz };
      const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
      if (path.length) return { action: 'walk', path, dest };
    }
    return { action: 'blocked' };
  }
  if (kind === 'range') {
    const face = rangeFaceYaw(pose);
    const spots = rangeStandCandidates(pose);
    const stand = spots[0];
    if (isNearPoint(from, stand, 0.45)) return { action: 'open', dest: stand, face };
    for (const dest of spots) {
      const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
      if (path.length) return { action: 'walk', path, dest, face };
    }
    return { action: 'blocked', dest: stand, face };
  }
  if (kind === 'fletch') {
    const face = fletchFaceYaw(pose);
    const spots = fletchStandCandidates(pose);
    for (const dest of spots) {
      if (isNearPoint(from, dest, 0.45)) return { action: 'open', dest, face };
    }
    for (const dest of spots) {
      const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
      const end = path[path.length - 1];
      if (end && Math.hypot(end.x - dest.x, end.z - dest.z) < 0.22) {
        return { action: 'walk', path, dest, face };
      }
    }
    return { action: 'blocked', dest: spots[0], face };
  }
  if (kind === 'tree' || kind === 'boulder' || kind === 'flax') {
    const aligned = resolveGatherStand(from, pose, state, planFn, kind, canStand);
    if (aligned) return aligned;
  }
  if (kind === 'flax') {
    if (isNearPoint(from, pose, FLAX_ARRIVE)) return { action: 'open' };
    const offsets = [
      [0, 0.55],
      [0.55, 0],
      [-0.55, 0],
      [0, -0.55],
      [0.4, 0.4],
      [-0.4, 0.4],
      [0.4, -0.4],
      [-0.4, -0.4],
    ];
    for (const [dx, dz] of offsets) {
      const dest = { x: pose.x + dx, z: pose.z + dz };
      const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
      if (path.length) return { action: 'walk', path, dest };
    }
    return { action: 'blocked' };
  }
  if (isNearPoint(from, pose, STATION_ARRIVE)) return { action: 'open' };
  const offsets = APPROACH_OFFSETS;
  for (const [dx, dz] of offsets) {
    const dest = { x: pose.x + dx, z: pose.z + dz };
    const path = planFn(from, dest, state, PLAYER_RADIUS) ?? [];
    if (path.length) return { action: 'walk', path, dest };
  }
  return { action: 'blocked' };
}
