import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { STEPS, TUTORIAL_REWARD, gateMatches, placeCard, shouldAutoStart } from './tutorial.js';
import { tutorialEmit, tutorialEventLog } from './tutorialEvents.js';
import { PLACE_TINT, setPlaceTint } from './pieceGhost.js';
import { applyState, createState, serializeState } from './economy.js';
import { RECIPES } from './catalog.js';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, f), 'utf8');

describe('new-player tutorial', () => {
  it('has 14 steps with the spec ids, ending in the +250 reward', () => {
    assert.equal(STEPS.length, 14);
    assert.deepEqual(STEPS.map((s) => s.id), ['welcome', 'move', 'to-dungeon', 'mine', 'bag', 'to-shop', 'buy', 'place', 'smelt', 'smith', 'sell', 'skills', 'tour', 'done']);
    assert.equal(STEPS.at(-1).reward, 250);
    assert.equal(TUTORIAL_REWARD, 250);
  });

  it('gates on real recipe ids and the game events', () => {
    const gates = STEPS.flatMap((s) => (s.stages ? s.stages.map((x) => x.gate) : [s.gate])).filter(Boolean);
    for (const g of ['walked', 'enteredDungeon', 'mined:bronze', 'arrivedShop', 'placed:furnace', 'crafted:smelt_bronze', 'crafted:bronze_med_helm', 'sold']) {
      assert.ok(gates.includes(g), g);
    }
    assert.ok(RECIPES.smelt_bronze);
    assert.ok(RECIPES.bronze_med_helm);
  });

  it('world rings use live anchors, not only fixed coordinates', () => {
    const anchors = STEPS.flatMap((s) => [s.target, ...(s.stages ?? []).map((x) => x.target)])
      .flatMap((t) => (t?.any ? t.any : [t])).filter((t) => t?.anchor).map((t) => t.anchor);
    for (const a of ['trapdoor', 'bronzeRock', 'ladder', 'furnace']) assert.ok(anchors.includes(a), a);
    const world = src('world.js');
    assert.match(world, /tutorialAnchor\(name\)/);
    assert.match(world, /centre\(dungeon\.ladder\)/);
    assert.match(world, /frameTutorialTarget\(point\)/);
  });

  it('step 8 teaches rotate while placing, then confirm', () => {
    const place = STEPS.find((s) => s.id === 'place');
    assert.equal(place.stages.length, 3);
    assert.match(JSON.stringify(place.stages[1].target), /data-place-rotate/);
    assert.equal(place.stages[2].gate, 'placed:furnace');
    assert.match(place.stages[0].lines.join(' '), /Green/);
  });

  it('matches gates', () => {
    assert.ok(gateMatches('mined:bronze', 'mined:bronze'));
    assert.ok(!gateMatches('mined:bronze', 'mined:iron'));
    assert.ok(gateMatches('sold', 'sold'));
    assert.ok(!gateMatches('click:#build-btn', 'click:#build-btn'));
    assert.ok(!gateMatches(undefined, 'walked'));
  });

  it('new saves start it, old saves are grandfathered as done', () => {
    const fresh = createState();
    assert.equal(fresh.tutorialDone, false);
    assert.ok(shouldAutoStart(fresh));
    const data = serializeState(fresh);
    assert.equal(data.tutorialDone, false);
    const again = createState();
    applyState(again, data);
    assert.equal(again.tutorialDone, false);
    const old = { ...data };
    delete old.tutorialDone;
    const loaded = createState();
    applyState(loaded, old);
    assert.equal(loaded.tutorialDone, true);
    assert.ok(!shouldAutoStart(loaded));
  });

  it('a new save has an empty shelf and stand for the selling step', () => {
    const s = createState();
    const kinds = s.displays.map((d, i) => ({ kind: d.kind ?? null, empty: !d.ware, i }));
    assert.ok(s.displays.length > 0);
    assert.ok(kinds.every((k) => k.empty));
  });

  it('keeps the desktop card inside the HUD band', () => {
    const band = { W: 1280, H: 800, top: 60, bottom: 720 };
    const p = placeCard({ x: 1200, y: 20, w: 40, h: 40 }, 340, 200, band);
    assert.ok(p.y >= band.top && p.y + 200 <= band.bottom);
    assert.ok(p.x >= 10 && p.x + 340 <= 1270);
    const c = placeCard(null, 340, 200, band);
    assert.equal(c.x, 470);
  });

  it('forwards game events to window.Tutorial', () => {
    const got = [];
    globalThis.Tutorial = { emit: (t) => got.push(t) };
    tutorialEmit('walked');
    tutorialEmit('mined:bronze');
    delete globalThis.Tutorial;
    tutorialEmit('sold');
    assert.deepEqual(got, ['walked', 'mined:bronze']);
    assert.deepEqual(tutorialEventLog().slice(-3), ['walked', 'mined:bronze', 'sold']);
  });

  it('emits every event from the game code', () => {
    const world = src('world.js');
    const main = readFileSync(join(root, '../main.js'), 'utf8');
    assert.match(world, /tutorialEmit\('walked'\)/);
    assert.match(world, /tutorialEmit\('enteredDungeon'\)/);
    assert.match(world, /tutorialEmit\(`mined:\$\{mining\.materialId\}`\)/);
    assert.match(world, /tutorialEmit\('arrivedShop'\)/);
    assert.match(main, /tutorialEmit\(`placed:\$\{intent\.stationId\}`\)/);
    assert.match(main, /tutorialEmit\(`crafted:\$\{id\}`\)/);
    assert.match(main, /tutorialEmit\('sold'\)/);
    assert.match(main, /shouldAutoStart\(state\)/);
  });
});

describe('placement rotate + tint', () => {
  it('shows Rotate for station placement and rotates in 90° steps', () => {
    const hud = src('hud.js');
    assert.match(hud, /rotateBtn\.hidden = !piecePlace && pendingPlace\.type === 'farming_patch'/);
    assert.match(hud, /world\.rotatePlacing\?\.\(1\)/);
    assert.match(src('world.js'), /\(Math\.PI \/ 2\)/);
  });

  it('tints green/red with cloned materials and restores the originals', () => {
    const shared = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    root.add(mesh);
    setPlaceTint(root, 'valid');
    assert.notEqual(mesh.material, shared);
    assert.equal(mesh.material.emissive.getHex(), new THREE.Color(PLACE_TINT.valid).multiplyScalar(0.55).getHex());
    assert.equal(shared.emissive.getHex(), 0);
    setPlaceTint(root, 'blocked');
    assert.equal(mesh.material.emissive.getHex(), new THREE.Color(PLACE_TINT.blocked).multiplyScalar(0.55).getHex());
    setPlaceTint(root, null);
    assert.equal(mesh.material, shared);
    const arr = [shared, new THREE.MeshBasicMaterial({ color: 0xffffff })];
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(), arr);
    root.add(m2);
    setPlaceTint(root, 'blocked');
    assert.ok(Array.isArray(m2.material) && m2.material[0] !== shared);
    setPlaceTint(root, null);
    assert.equal(m2.material, arr);
  });

  it('keeps the blocked reason text and clears the tint when placement ends', () => {
    const world = src('world.js');
    assert.match(world, /setPlaceTint\(root, blockedPlaceReason\(pose\) \? 'blocked' : 'valid'\)/);
    assert.match(world, /function clearMoveMode\(\) \{\n    clearPlaceTint\(\);/);
    assert.match(readFileSync(join(root, '../../index.html'), 'utf8'), /data-place-note/);
  });
});
