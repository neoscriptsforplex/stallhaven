import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fountainStands, pondStands, resolveStationUse, FOUNTAIN_STAND_LOCAL, USE_KINDS } from './interact.js';
import * as nav from './nav.js';
import { FOUNTAIN, POND, playerWalkFloors, pointInPond, pointOnDock } from './layout.js';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const straight = (from, to) => [to];

describe('bucket fill: every source', () => {
  it('built-in fountain keeps Rig\'s stand (1.46 m out, facing the bowl)', () => {
    for (const s of fountainStands(FOUNTAIN)) {
      const d = Math.hypot(s.x - FOUNTAIN.x, s.z - FOUNTAIN.z);
      assert.ok(d >= 1.44 && d < 1.48, `dist ${d}`);
      const toBowl = Math.atan2(FOUNTAIN.x - s.x, FOUNTAIN.z - s.z);
      const off = Math.abs(Math.atan2(Math.sin(toBowl - s.yaw), Math.cos(toBowl - s.yaw)));
      assert.ok(off < 0.11, `faces bowl (${off})`);
    }
  });

  it('placed fountain stands follow that instance\'s rot and scale', () => {
    const pose = { x: 3, z: -4, rot: 0.7, scale: 1.5 };
    const st = fountainStands(pose);
    const r = Math.hypot(FOUNTAIN_STAND_LOCAL.x, FOUNTAIN_STAND_LOCAL.z) * 1.5;
    for (const s of st) assert.ok(Math.abs(Math.hypot(s.x - 3, s.z + 4) - r) < 1e-6);
    // first stand = local offset rotated by rot
    const c = Math.cos(0.7); const sn = Math.sin(0.7);
    const L = FOUNTAIN_STAND_LOCAL;
    assert.ok(Math.abs(st[0].x - (3 + 1.5 * (L.x * c + L.z * sn))) < 1e-9);
    assert.ok(Math.abs(st[0].yaw - 0.7) < 1e-9);
    const plan = resolveStationUse({ x: 3, z: -10 }, pose, {}, straight, 'fountain', () => true);
    assert.equal(plan.action, 'walk');
  });

  it('pond stands are dry, reachable shore points facing the water', () => {
    const st = { expansions: [] };
    const obs = nav.playerObstacles(st);
    const fl = playerWalkFloors([]);
    const canStand = (x, z) => nav.isWalkable(x, z, obs, nav.PLAYER_RADIUS, fl);
    const inWater = (x, z) => pointInPond(x, z, 0.05) || pointOnDock(x, z, 0.05);
    const stands = pondStands({ x: POND.x, z: POND.z }, inWater, canStand);
    assert.ok(stands.length >= 4);
    for (const s of stands) {
      assert.ok(!pointInPond(s.x, s.z) && canStand(s.x, s.z));
      const toWater = Math.atan2(POND.x - s.x, POND.z - s.z);
      const off = Math.abs(Math.atan2(Math.sin(toWater - s.yaw), Math.cos(toWater - s.yaw)));
      assert.ok(off < 1.0, `faces water (${off})`);
    }
    for (const from of [{ x: POND.x, z: POND.z - 6 }, { x: POND.x - 6, z: POND.z }, { x: 0, z: 0 }]) {
      const plan = resolveStationUse(from, { x: POND.x, z: POND.z, stands }, st, nav.planPlayerWalk, 'pond', canStand);
      assert.ok(plan.action === 'walk' || plan.action === 'open', `${plan.action} from ${from.x},${from.z}`);
      assert.ok(Number.isFinite(plan.face));
    }
    assert.ok(USE_KINDS.has('pond'));
  });

  it('every entry point routes into the same FillBucket start', () => {
    const w = src('./world.js');
    const h = src('./hud.js');
    // one start path plays FillBucket (+bucket) for all sources; sfx keys off mode 'fill'
    assert.match(w, /function startFountainFill[\s\S]{0,600}setGatherClip\(shopkeeper, 'fillbucket'\)\) restartFillBucket/);
    assert.match(w, /if \(type === 'fountain' \|\| type === 'pond'\) \{\s*fillFromFountain\(aimed\)/);
    assert.match(w, /else if \(type === 'fountain' \|\| type === 'pond'\) fillFromFountain\(pose\)/);
    // left click / tap on a placed fountain
    assert.match(w, /isFountainPiece\(data\.index\)\) \{\s*fillAtFountainPiece\(data\.index\)/);
    // built-in fountain click
    assert.match(w, /data\.kind === 'fountain'\) \{\s*queueUse\('fountain'/);
    // right-click menus: placed fountain, pond water, fishing spot
    assert.match(h, /lumbridge_fountain'\) \{ world\.fillAtFountainPiece\?\.\(target\.index\)/);
    assert.match(h, /data-pond-fill[\s\S]{0,80}world\.fillAtPond/);
    assert.match(h, /data-inspect-fill[\s\S]{0,200}world\.fillAtPond/);
    assert.match(w, /pointInPond\(pondPoint\.x, pondPoint\.z, 0\.35\)[\s\S]{0,200}fish-picker/);
  });
});
