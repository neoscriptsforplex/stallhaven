import { FLAX_ARRIVE } from './catalog.js';
import { PLAYER_RADIUS, isWalkable, planPlayerWalk, playerObstacles } from './nav.js';
import { furnitureHalfSize, furnitureVisualYaw, playerWalkFloors } from './layout.js';

export const USE_STATIONS = ['anvil', 'chest', 'range', 'furnace', 'cauldron', 'wheel', 'loom', 'fletch', 'potter'];
export const USE_KINDS = new Set([...USE_STATIONS, 'trapdoor', 'ladder', 'boulder']);

function stationHit(kind, height, pickY) {
  const { hw, hd } = furnitureHalfSize(kind);
  const round = (n) => Math.round(n * 100) / 100;
  return {
    w: round(hw * 2 + 0.14),
    h: height,
    d: round(hd * 2 + 0.14),
    pickY,
    floorR: round(Math.hypot(hw, hd) + 0.12),
  };
}

/** Click boxes sit on the furniture footprint, not the old oversized volumes. */
export const STATION_HIT = {
  anvil: stationHit('anvil', 1.5, 0.75),
  chest: stationHit('chest', 1.35, 0.68),
  range: stationHit('range', 2.4, 1.2),
  furnace: stationHit('furnace', 1.4, 0.7),
  cauldron: stationHit('cauldron', 1.25, 0.62),
  wheel: stationHit('wheel', 2.0, 1.0),
  loom: stationHit('loom', 1.2, 0.6),
  fletch: stationHit('fletch', 1.05, 0.52),
  potter: stationHit('potter', 1.1, 0.55),
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

/** Roofs, gables, and walls must not swallow a floor click, even while faded. */
export function ignoredClickObject(object) {
  let node = object;
  while (node) {
    if (node.visible === false) return true;
    const data = node.userData ?? {};
    const name = node.name || '';
    if (data.isRoof || data.shopWall || data.kind === 'roof' || data.kind === 'wall') return true;
    if (name === 'roof-gable' || name === 'roofs') return true;
    node = node.parent;
  }
  const mats = Array.isArray(object?.material) ? object.material : [object?.material];
  return mats.some((mat) => {
    if (!mat) return false;
    if (mat.userData?.isRoof) return true;
    return mat.transparent === true && typeof mat.opacity === 'number' && mat.opacity < 0.2;
  });
}

/**
 * Ground point for a walk click. A raised shop floor wins over the lawn sheet
 * that runs underneath it when both lie on the same ray.
 */
export function floorClickPoint(hits) {
  const open = (hits ?? []).filter((hit) => hit?.object && !ignoredClickObject(hit.object));
  const grounds = open.filter((hit) => {
    const kind = hit.object.userData?.kind;
    return kind === 'ground' || kind === 'rug';
  });
  if (!grounds.length) return null;
  const floor = grounds.find((hit) => hit.object.userData?.shopFloor);
  const first = grounds[0];
  if (floor && first !== floor && first.point && floor.point) {
    const sameSpot = Math.hypot(first.point.x - floor.point.x, first.point.z - floor.point.z) < 1.25;
    const underBoards = first.point.y < floor.point.y - 0.015
      && sameSpot
      && floor.distance - first.distance < 1.6;
    if (underBoards) return floor.point;
  }
  return first.point ?? null;
}

export function pickUseHit(hits) {
  const list = (hits ?? []).filter((hit) => !ignoredClickObject(hit.object));
  if (!list.length) return null;
  const useHit = list.find((hit) => USE_KINDS.has(hit.object?.userData?.kind));
  const closestKind = list[0].object?.userData?.kind;
  if (useHit && (!closestKind || isWalkFloorKind(closestKind) || closestKind === 'expand-pad' || USE_KINDS.has(closestKind))) {
    return useHit;
  }
  return list.find((hit) => {
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
