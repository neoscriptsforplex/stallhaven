/** Dungeon rat wander — they walk the floor instead of spinning in place. */

export const RAT_BOUNDS = { minX: -4.35, maxX: 4.35, minZ: -3.35, maxZ: 3.35 };

/**
 * Dump snout faces local +X. Bake this yaw so +Z is forward, matching the
 * procedural rat and wander heading (Math.atan2(dx, dz)).
 */
export const RAT_DUMP_YAW = -Math.PI / 2;

/** Extra yaw on the wander root after the mesh faces +Z. Keep 0 unless a pack needs it. */
export const RAT_FACE_YAW = 0;

export function ratHeading(dx, dz) {
  return Math.atan2(dx, dz) + RAT_FACE_YAW;
}

export function randomRatGoal(rng = Math.random) {
  return {
    x: RAT_BOUNDS.minX + rng() * (RAT_BOUNDS.maxX - RAT_BOUNDS.minX),
    z: RAT_BOUNDS.minZ + rng() * (RAT_BOUNDS.maxZ - RAT_BOUNDS.minZ),
  };
}

export function initRatWander(rat, index = 0, rng = Math.random) {
  const goal = randomRatGoal(rng);
  rat.userData.wander = {
    tx: goal.x,
    tz: goal.z,
    wait: rng() * 0.8,
    speed: 0.52 + index * 0.09,
  };
  return rat;
}

export function stepRatWander(rat, dt, now, rng = Math.random) {
  const wander = rat.userData?.wander;
  if (!wander) return rat;
  if (wander.wait > 0) {
    wander.wait -= dt;
    rat.position.y = 0.06;
    return rat;
  }
  const dx = wander.tx - rat.position.x;
  const dz = wander.tz - rat.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.1) {
    const goal = randomRatGoal(rng);
    wander.tx = goal.x;
    wander.tz = goal.z;
    wander.wait = 0.2 + rng() * 1.15;
    rat.position.y = 0.06;
    return rat;
  }
  const step = wander.speed * dt;
  const t = Math.min(1, step / dist);
  rat.position.x += dx * t;
  rat.position.z += dz * t;
  rat.position.x = Math.min(RAT_BOUNDS.maxX, Math.max(RAT_BOUNDS.minX, rat.position.x));
  rat.position.z = Math.min(RAT_BOUNDS.maxZ, Math.max(RAT_BOUNDS.minZ, rat.position.z));
  rat.rotation.y = ratHeading(dx, dz);
  rat.position.y = 0.06 + Math.abs(Math.sin(now * 11 + wander.speed * 4)) * 0.018;
  return rat;
}
