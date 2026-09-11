/** Dungeon rat wander — they walk the floor instead of spinning in place. */

export const RAT_BOUNDS = { minX: -4.35, maxX: 4.35, minZ: -3.35, maxZ: 3.35 };

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
  rat.rotation.y = Math.atan2(dx, dz);
  rat.position.y = 0.06 + Math.abs(Math.sin(now * 11 + wander.speed * 4)) * 0.018;
  return rat;
}
