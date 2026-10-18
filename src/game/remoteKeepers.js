/**
 * Other players' shopkeepers in a co-op room. Each one walks to the last
 * spot its player clicked (click destinations are synced, not positions).
 * world.js passes in its own builders and walk helpers so this file holds no
 * scene logic of its own.
 */
import * as THREE from 'three';

export const COOP_COLORS = Object.freeze({
  red: 0xd9534f,
  blue: 0x4a90d9,
  green: 0x5cb85c,
  purple: 0x9b59b6,
});

function nameSprite(text, color) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(20,12,6,0.9)';
  ctx.strokeText(String(text).slice(0, 20), 128, 32);
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillText(String(text).slice(0, 20), 128, 32);
  const map = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
  sprite.scale.set(1.1, 0.28, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 4;
  return sprite;
}

/**
 * deps: {
 *   scene, buildMesh(player) -> Object3D,
 *   planWalk(from, to) -> [{x,z}], walkToward(actor, goal, dt, speed) -> arrived,
 *   speed, labelHeight
 * }
 */
export function createRemoteKeepers(deps) {
  const keepers = new Map();
  const speed = deps.speed ?? 1.85;
  let viewerScene = 'shop';

  function add(player) {
    if (!player?.id || keepers.has(player.id)) return keepers.get(player?.id) ?? null;
    const color = COOP_COLORS[player.color] ?? COOP_COLORS.blue;
    const mesh = deps.buildMesh(player);
    mesh.name = `coop-keeper-${player.id}`;
    // Ring and name ride on the keeper itself; undo its model scale so they read the same size.
    const inv = 1 / (mesh.scale?.x || 1);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03 * inv;
    ring.scale.setScalar(inv);
    mesh.add(ring);
    const label = nameSprite(player.name ?? 'Player', color);
    if (label) {
      label.position.y = (deps.labelHeight ?? 2.05) * inv;
      label.scale.multiplyScalar(inv);
      mesh.add(label);
    }
    const holder = mesh;
    const start = player.pos ?? { x: 0, z: 1.2 };
    holder.position.set(start.x ?? 0, 0, start.z ?? 1.2);
    deps.scene.add(holder);
    const actor = {
      id: player.id,
      name: player.name,
      color: player.color,
      holder,
      mesh: holder,
      path: [],
      scene: start.scene ?? 'shop',
    };
    keepers.set(player.id, actor);
    holder.visible = actor.scene === viewerScene;
    return actor;
  }

  function remove(id) {
    const actor = keepers.get(id);
    if (!actor) return false;
    deps.scene.remove(actor.holder);
    keepers.delete(id);
    return true;
  }

  function moveTo(id, x, z, scene = 'shop') {
    const actor = keepers.get(id);
    if (!actor || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (scene !== actor.scene) {
      // Changing scene (shop <-> dungeon): appear at the goal.
      actor.scene = scene;
      actor.holder.position.set(x, 0, z);
      actor.path = [];
      return true;
    }
    const from = { x: actor.holder.position.x, z: actor.holder.position.z };
    const path = deps.planWalk ? deps.planWalk(from, { x, z }, scene) : [];
    actor.path = path?.length ? path : [{ x, z }];
    return true;
  }

  function tick(dt, now, sceneMode) {
    viewerScene = sceneMode;
    for (const actor of keepers.values()) {
      actor.holder.visible = actor.scene === viewerScene;
      if (!actor.path.length) {
        deps.idle?.(actor, dt, now);
        continue;
      }
      if (deps.walkToward(actor, actor.path[0], dt, speed)) actor.path.shift();
    }
  }

  function clear() {
    for (const id of [...keepers.keys()]) remove(id);
  }

  return {
    tick,
    api: {
      add,
      remove,
      moveTo,
      clear,
      list: () => [...keepers.values()].map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        scene: a.scene,
        x: a.holder.position.x,
        z: a.holder.position.z,
        walking: a.path.length > 0,
      })),
      has: (id) => keepers.has(id),
    },
  };
}
