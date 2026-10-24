import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  channelForSfx, createRetriggerGuard, loadSoundMix, normalizeSoundMix, parseSfxManifest, pickSfxVariant,
  saveSoundMix, SHORT_SFX_GAIN, DEFAULT_SOUND_MIX,
} from './sfx.js';
import { createSfxDirector, fireCrackleGain, intentSound } from './sfxHooks.js';
import { buyerShouldWait, buyerSpawnClear, freeStandSpot, BUYER_MIN_GAP } from './customerSim.js';
import { loadSfxManifest, resetSfxForTests, getSfxGroups, playSfx } from './audio.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const sfxDir = join(root, 'public/audio/sfx');
const manifest = JSON.parse(readFileSync(join(sfxDir, 'manifest.json'), 'utf8'));

describe('sfx manifest', () => {
  it('ships all 42 sounds with OGG + MP3 files', () => {
    assert.equal(manifest.length, 42);
    for (const e of manifest) {
      assert.ok(existsSync(join(sfxDir, e.file)), e.file);
      assert.ok(existsSync(join(sfxDir, 'mp3', e.file.replace('.ogg', '.mp3'))), e.file);
    }
  });
  it('groups variants', () => {
    const g = parseSfxManifest(manifest);
    assert.equal(g.get('anvil_hammer').length, 3);
    for (const id of ['coin', 'coin_sell', 'mining_pick', 'ui_click', 'loom', 'eat', 'combat_hit']) {
      assert.equal(g.get(id).length, 2, id);
    }
    assert.equal(g.get('tree_chop').length, 1);
    assert.ok(g.get('furnace_loop')[0].loop);
    assert.equal(g.get('shop_ambience_loop')[0].channel, 'ambience');
    assert.equal(g.get('levelup')[0].channel, 'world');
    assert.equal(g.get('ui_click')[0].channel, 'ui');
    assert.ok(Math.abs(g.get('ui_click')[0].gain - 0.7 * SHORT_SFX_GAIN) < 1e-9);
    assert.equal(g.get('sale')[0].gain, 0.8);
  });
  it('drops malformed rows', () => {
    assert.equal(parseSfxManifest([null, { file: 'x.wav' }, {}]).size, 0);
    assert.equal(parseSfxManifest('nope').size, 0);
    assert.equal(channelForSfx({ name: 'a', category: 'stinger', loop: false }), 'world');
  });
  it('picks variants at random without repeating the last one', () => {
    const v = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    assert.equal(pickSfxVariant(v, () => 0).name, 'a');
    assert.equal(pickSfxVariant(v, () => 0.99).name, 'c');
    assert.equal(pickSfxVariant(v, () => 0, v[0]).name, 'b');
    assert.equal(pickSfxVariant([v[0]], () => 0.5, v[0]).name, 'a');
    assert.equal(pickSfxVariant([], () => 0), null);
    const seen = new Set();
    let last = null;
    for (let i = 0; i < 50; i += 1) { last = pickSfxVariant(v, Math.random, last); seen.add(last.name); }
    assert.equal(seen.size, 3);
  });
  it('drops retriggers inside 300 ms', () => {
    const guard = createRetriggerGuard();
    assert.equal(guard('sale', 0), false);
    assert.equal(guard('sale', 200), true);
    assert.equal(guard('coin', 200), false);
    assert.equal(guard('sale', 350), false);
  });
  it('persists the sound mix with a low ambience default', () => {
    assert.equal(DEFAULT_SOUND_MIX.ambience, 0.3);
    const mem = new Map();
    const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    saveSoundMix(store, { ui: 0.2, world: 5 });
    const mix = loadSoundMix(store);
    assert.equal(mix.ui, 0.2);
    assert.equal(mix.world, 1);
    assert.deepEqual(normalizeSoundMix(null), { ...DEFAULT_SOUND_MIX });
    assert.deepEqual(loadSoundMix({ getItem: () => '{bad' }), { ...DEFAULT_SOUND_MIX });
  });
  it('loads the manifest through fetch and stays silent before the play gesture', async () => {
    resetSfxForTests();
    const groups = await loadSfxManifest(async (url) => ({ ok: url.endsWith('audio/sfx/manifest.json'), json: async () => manifest }));
    assert.equal(groups.get('anvil_hammer').length, 3);
    assert.equal(getSfxGroups(), groups);
    assert.equal(playSfx('coin'), false);
    resetSfxForTests();
  });
});

describe('sfx director', () => {
  function rig() {
    const played = [];
    const loops = new Map();
    const d = createSfxDirector({ play: (id) => played.push(id), loop: (n, on) => loops.set(n, on) });
    return { d, played, loops };
  }
  it('maps intents', () => {
    assert.equal(intentSound({ type: 'sell' }, { ok: true }), 'coin_sell');
    assert.equal(intentSound({ type: 'buyStation' }, { ok: true }), 'purchase');
    assert.equal(intentSound({ type: 'placePiece' }, { ok: true }), 'build_place');
    assert.equal(intentSound({ type: 'craft' }, { ok: false, reason: 'refused' }), 'ui_error');
    assert.equal(intentSound({ type: 'gather' }, { ok: false }), null);
  });
  it('plays coin on gold gains but not right after a sale', () => {
    const { d, played } = rig();
    d.frame({ gold: 10 }, 0);
    d.frame({ gold: 20 }, 1);
    d.onIntent({ type: 'sell' }, { ok: true }, 2);
    d.frame({ gold: 30 }, 2.05);
    assert.deepEqual(played, ['coin', 'coin_sell']);
  });
  it('runs station loops only while crafting there', () => {
    const { d, loops, played } = rig();
    d.frame({ stations: ['furnace', 'anvil'] }, 0);
    assert.equal(loops.get('furnace_loop'), true);
    assert.ok(played.includes('furnace') && played.includes('anvil_hammer'));
    d.frame({ stations: [] }, 1);
    assert.equal(loops.get('furnace_loop'), false);
  });
  it('fire crackle only near a fire, fading with distance', () => {
    const { d, loops } = rig();
    d.frame({ indoors: true, sceneMode: 'shop', fireDist: Infinity }, 0);
    assert.notEqual(loops.get('shop_ambience_loop'), true);
    d.frame({ fireDist: 1 }, 1);
    assert.equal(loops.get('shop_ambience_loop'), true);
    d.frame({ fireDist: 6 }, 2);
    assert.equal(loops.get('shop_ambience_loop'), false);
    assert.equal(fireCrackleGain(2), 1);
    assert.equal(fireCrackleGain(3.5), 0.5);
    assert.equal(fireCrackleGain(5), 0);
  });
  it('chops every swing, no footsteps, ambience near fire', () => {
    const { d, played, loops } = rig();
    for (let t = 0; t <= 3; t += 0.05) d.frame({ mining: { mode: 'chop', startedAt: 0 } }, t);
    assert.ok(played.filter((p) => p === 'tree_chop').length >= 3);
    played.length = 0;
    for (let i = 0; i < 20; i += 1) d.frame({ player: { x: i * 0.2, z: 0 }, indoors: true, sceneMode: 'shop', fireDist: 1 }, 10 + i * 0.1);
    assert.ok(!played.some((p) => p.startsWith('footstep')));
    assert.ok(!manifest.some((e) => e.name.startsWith('footstep')));
    assert.equal(loops.get('shop_ambience_loop'), true);
  });
});

describe('buyer separation', () => {
  it('waits behind a buyer in front, not one behind', () => {
    const me = { id: 2, x: 0, z: 0, gx: 0, gz: 5 };
    assert.equal(buyerShouldWait(me, [{ id: 1, x: 0, z: 0.5 }]), true);
    assert.equal(buyerShouldWait(me, [{ id: 1, x: 0, z: -0.5 }]), false);
    assert.equal(buyerShouldWait(me, [{ id: 1, x: 0, z: BUYER_MIN_GAP + 0.1 }]), false);
  });
  it('face to face: exactly one yields', () => {
    const a = { id: 1, x: 0, z: 0, gx: 0, gz: 5, moving: true };
    const b = { id: 2, x: 0, z: 0.6, gx: 0, gz: -5, moving: true };
    assert.equal(buyerShouldWait(a, [b]), false);
    assert.equal(buyerShouldWait(b, [a]), true);
  });
  it('staggers spawns and frees stand spots', () => {
    const spawn = { x: 0, z: 0 };
    assert.equal(buyerSpawnClear(10, 9, spawn, []), false);
    assert.equal(buyerSpawnClear(10, 8, spawn, [{ x: 0.3, z: 0 }]), false);
    assert.equal(buyerSpawnClear(10, 8, spawn, [{ x: 2, z: 0 }]), true);
    const spot = freeStandSpot({ x: 0, z: 0, id: 's' }, [{ x: 0, z: 0 }]);
    assert.ok(Math.hypot(spot.x, spot.z) >= BUYER_MIN_GAP - 1e-9);
    assert.equal(spot.id, 's');
  });
});
