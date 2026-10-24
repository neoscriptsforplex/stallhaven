import { it } from 'node:test';
import assert from 'node:assert/strict';
import * as nav from './nav.js';
import { FOUNTAIN, playerWalkFloors } from './layout.js';
for (const STEP of [0.05, 0.15, 0.25]) it(`player walks past the fountain without sticking (step ${STEP})`, () => {
  const st = { expansions: [] };
  const obs = nav.playerObstacles(st); const fl = playerWalkFloors([]);
  const pts = [];
  for (let a = 0; a < 24; a++) for (const r of [1.6, 2.4, 3.5, 5]) pts.push({ x: FOUNTAIN.x + Math.sin(a*Math.PI/12)*r, z: FOUNTAIN.z + Math.cos(a*Math.PI/12)*r });
  const ok = pts.filter(p => nav.isWalkable(p.x, p.z, obs, nav.PLAYER_RADIUS, fl));
  let bad = 0, n = 0;
  for (const a of ok) for (const b of ok) {
    if (Math.hypot(a.x-b.x,a.z-b.z) < 2) continue;
    const path = nav.planPlayerWalk(a, b, st); if (!path.length) continue; n++;
    let x=a.x,z=a.z;
    for (const g of path) { let it=0; while (Math.hypot(g.x-x,g.z-z)>=0.08 && it++<400) {
      const d=Math.hypot(g.x-x,g.z-z), s=Math.min(STEP,d); const m=nav.moveWithCollision(x,z,x+(g.x-x)*s/d,z+(g.z-z)*s/d,obs,nav.WALK_COLLIDE_RADIUS,fl);
      if (m.blocked && Math.hypot(m.x-x,m.z-z)<1e-4) { it=999; break; } x=m.x; z=m.z; }
      if (it>=400) { bad++; break; } }
  }
  assert.ok(n > 500); assert.equal(bad, 0); });
