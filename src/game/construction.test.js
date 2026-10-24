import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONSTRUCTION_GUIDE,
  CONSTRUCTION_PIECES,
  constructionPiece,
  pieceHangs,
  constructionXpFor,
  missingMaterials,
  moveConstruction,
  pickupConstruction,
  placeConstruction,
  sellConstruction,
  constructionBuildGold,
  constructionPlaceBlock,
  readPlacedFurniture,
} from './construction.js';
import { SAVE_VERSION, applyState, createState, serializeState } from './economy.js';
import { applyIntent } from './intents.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { xpForLevel } from './skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../public/models/furniture');

function funded() {
  const state = createState();
  for (const id of ['plank', 'oak_plank', 'willow_plank', 'maple_plank', 'yew_plank', 'magic_plank', 'logs', 'flax', 'steel_bar', 'bronze_nails', 'iron_nails', 'steel_nails', 'mithril_nails', 'adamant_nails', 'dragon_nails']) {
    state.materials[id] = 40;
  }
  state.gold = 500000;
  return state;
}

describe('construction catalogue', () => {
  it('lists every cosmetic piece at flat material prices', () => {
    assert.ok(CONSTRUCTION_PIECES.length >= 35);
    assert.equal(constructionPiece('chair').materials.plank, 1);
    assert.equal(constructionPiece('chair').gold, 200);
    assert.equal(new Set(CONSTRUCTION_PIECES.map((row) => row.id)).size, CONSTRUCTION_PIECES.length);
    const chair = funded();
    chair.materials.plank = 2;
    chair.materials.bronze_nails = 2;
    const before = chair.skills.getXp('construction');
    assert.equal(placeConstruction(chair, 'crate', { x: 1, z: 1, rot: 0 }), true);
    assert.equal(chair.materials.plank, 0);
    assert.equal(chair.materials.bronze_nails, 0);
    assert.equal(chair.gold, funded().gold - 1000);
    assert.equal(chair.furniture.placed.length, 1);
    assert.equal(chair.skills.getXp('construction') - before, constructionXpFor(constructionPiece('crate')));
    assert.equal(placeConstruction(chair, 'crate', { x: 2, z: 1, rot: 0 }), false);
  });

  it('picks materials back up and sells for half the gold', () => {
    const state = funded();
    placeConstruction(state, 'crate', { x: 0.2, z: 0.4, rot: 0 });
    const gold = state.gold;
    const planks = state.materials.plank;
    assert.equal(sellConstruction(state, 0), Math.floor(constructionPiece('crate').gold / 2));
    assert.equal(state.gold, gold + Math.floor(constructionPiece('crate').gold / 2));
    assert.equal(state.materials.plank, planks, 'sell does not return planks');
    assert.equal(state.furniture.placed.length, 0);

    placeConstruction(state, 'crate', { x: 0.2, z: 0.4, rot: 0 });
    state.materials.plank = 0;
    state.materials.bronze_nails = 0;
    assert.equal(pickupConstruction(state, 0), true);
    assert.equal(state.materials.plank, 2);
    assert.equal(state.materials.bronze_nails, 2);
    assert.equal(state.furniture.placed.length, 0);
  });

  it('moves without spending and keeps the piece in the save', () => {
    assert.equal(SAVE_VERSION, 15);
    const state = funded();
    placeConstruction(state, 'garden_bush', { x: -2, z: 9, rot: 0.2 });
    const xp = state.skills.getXp('construction');
    assert.equal(moveConstruction(state, 0, { x: -1, z: 8, rot: 1 }), true);
    assert.equal(state.skills.getXp('construction'), xp);
    assert.equal(state.materials.flax, 37);
    const next = createState();
    assert.equal(applyState(next, serializeState(state)), true);
    assert.deepEqual(next.furniture.placed[0], { id: 'garden_bush', x: -1, z: 8, rot: 1, paid: 1000 });
    const old = serializeState(createState());
    old.version = 13;
    delete old.furniture.placed;
    const migrated = createState();
    applyState(migrated, old);
    assert.deepEqual(migrated.furniture.placed, []);
  });

  it('locks wall decor behind Construction level and lets only the host place it', () => {
    const state = funded();
    assert.equal(placeConstruction(state, 'portrait', { x: 1, z: 0, rot: 0 }), false);
    state.materials.oak_plank = 0;
    assert.ok(missingMaterials(state, constructionPiece('portrait')).some((row) => row.id === 'oak_plank'));
    state.materials.oak_plank = 40;
    state.skills.addXp('construction', xpForLevel(5));
    assert.equal(placeConstruction(state, 'portrait', { x: 1, z: 0, rot: 0 }), true);
    const guest = applyIntent(createState(), {
      type: 'placePiece',
      pieceId: 'chair',
      pose: { x: 0, z: 0, rot: 0 },
    }, { coop: true, host: false });
    assert.equal(guest.ok, false);
    assert.equal(guest.reason, 'host-only');
    const host = funded();
    host.skills.addXp('construction', xpForLevel(5));
    const allowed = applyIntent(host, {
      type: 'placePiece',
      pieceId: 'portrait',
      pose: { x: 1.2, z: 0.2, rot: 0 },
    }, { coop: true, host: true });
    assert.equal(allowed.ok, true);
    assert.equal(host.furniture.placed[0].id, 'portrait');
  });

  it('replaces the coming-soon wall rows and ships a model or a box fallback', () => {
    const builds = SKILL_GUIDES.construction.tabs.find((tab) => tab.id === 'builds');
    for (const row of CONSTRUCTION_GUIDE) {
      const live = builds.rows.find((item) => item.name === row.name);
      assert.equal(live?.lv, row.lv, row.name);
      assert.equal(live?.soon, undefined, row.name);
    }
    assert.equal(builds.rows.some((row) => row.name === 'Wall Plant'), false);
    const withModel = ['chair', 'portrait', 'tapestry', 'lumbridge_fountain'];
    for (const id of withModel) {
      assert.equal(existsSync(join(root, id, `${id}.obj`)), true, id);
    }
    assert.equal(existsSync(join(root, 'cabinet', 'cabinet.obj')), true);
    assert.equal(existsSync(join(root, 'flag_pole', 'flag_pole.obj')), true);
  });
});

describe('construction trims (Luke 2026-10-24)', () => {
  it('brings the Flag Pole back now its model works (Luke’s new upload)', async () => {
    const mod = await import('./construction.js');
    assert.equal(mod.constructionPiece('flag_pole').name, 'Flag Pole');
    assert.deepEqual(mod.retiredRefund([{ id: 'flag_pole', x: 0, z: 0 }]), {});
  });
  it('shrinks the listed pieces to two thirds', async () => {
    const mod = await import('./construction.js');
    for (const id of ['standing_torch', 'crate', 'sacks', 'standing_candles', 'double_bed', 'basic_bed', 'fancy_fireplace', 'fancy_table', 'suit_of_armour', 'sink', 'chair', 'fancy_chair', 'bench', 'throne', 'fireplace']) {
      assert.equal(mod.constructionPiece(id).scale, 2 / 3, id);
    }
    assert.equal(mod.constructionPiece('pots_and_pans').scale, 1 / 3);
    assert.equal(mod.constructionPiece('pots_and_pans').mount, 'outdoor');
    const pots = mod.constructionPiece('pots_and_pans');
    assert.equal(pots.free, true);
    assert.equal(pots.level, 1);
    assert.deepEqual({ ...pots.materials }, {});
    assert.equal(mod.constructionBuildGold(pots), 0);
    const s = createState(); s.gold = 0;
    for (const k of Object.keys(s.materials)) s.materials[k] = 0;
    assert.equal(mod.constructionPlaceBlock(s, 'pots_and_pans'), '');
    assert.equal(mod.placeConstruction(s, 'pots_and_pans', { x: 1, z: 1, rot: 0 }), true);
    assert.equal(s.gold, 0);
    assert.equal(mod.constructionPiece('cabinet').scale, 2 / 3);
    assert.equal(mod.constructionPiece('barrel_of_fish').scale, undefined);
    assert.equal(mod.constructionPiece('barrel_of_sticks').scale, undefined);
  });
});

describe('wall art', () => {
  it('portrait and landscape are wall-only and hang at picture height', () => {
    for (const id of ['portrait', 'landscape']) {
      assert.equal(constructionPiece(id).mount, 'wall');
      assert.equal(pieceHangs(id), true);
    }
    assert.equal(pieceHangs('cooking_shelves'), false);
    assert.equal(pieceHangs('chair'), false);
  });
});

it('shelf and mannequin cards show only under Shop and Storage', async () => {
  const { shopFurnitureInCategory, constructionCategories } = await import('./construction.js');
  const { readFileSync } = await import('node:fs');
  const all = ['Shop', ...constructionCategories()];
  for (const kind of ['shelf', 'mannequin']) {
    assert.deepEqual(all.filter((cat) => shopFurnitureInCategory(kind, cat)), ['Shop', 'Storage']);
  }
  assert.deepEqual(all.filter((cat) => shopFurnitureInCategory('table', cat)), ['Shop']);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  for (const kind of ['table', 'shelf', 'mannequin']) {
    assert.match(html, new RegExp(`data-shop-furniture="${kind}"`));
  }
});

it('bundled wall shelf is empty and its planks carry the shelf slot anchors', async () => {
  const { readFileSync } = await import('node:fs');
  const { shelfSlotPoses } = await import('./catalog.js');
  const obj = readFileSync(new URL('../../public/models/shelf/shelf.obj', import.meta.url), 'utf8');
  const verts = obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(/\s+/).slice(1).map((n) => Number(n) * 0.01125));
  const mats = new Set(obj.split('\n').filter((l) => l.startsWith('usemtl')).map((l) => l.split(/\s+/)[1]));
  assert.deepEqual([...mats].sort(), ['back', 'bracket', 'plank', 'plank_side', 'plank_top']);
  const ys = verts.map((v) => v[1]);
  assert.ok(Math.abs(Math.min(...ys) - 0.92) < 1e-3 && Math.abs(Math.max(...ys) - 1.74) < 1e-3);
  const wareY = 1.64;
  const tops = [1.595, 1.135];
  for (const top of tops) assert.ok(ys.some((y) => Math.abs(y - top) < 1e-3), `plank top ${top}`);
  for (const pose of shelfSlotPoses()) {
    const y = wareY + pose.y;
    const below = tops.filter((t) => t <= y).sort((a, b) => b - a)[0];
    assert.ok(below != null && y - below > 0 && y - below < 0.1, `slot ${pose.x},${pose.y} rests on a plank`);
    assert.ok(Math.abs(pose.x) < 0.675 && pose.z > -0.155 && pose.z < 0.19);
  }
});

describe('garden bush (outdoor)', () => {
  it('is a buyable Outdoor piece that places on outdoor ground', async () => {
    const { constructionCategories } = await import('./construction.js');
    const { portalPlaceFloors, placeFloors } = await import('./layout.js');
    const row = constructionPiece('garden_bush');
    assert.ok(row);
    assert.equal(row.category, 'Outdoor');
    assert.equal(row.mount, 'outdoor');
    assert.equal(row.gold, 120);
    assert.ok(constructionCategories().includes('Outdoor'));
    assert.deepEqual(CONSTRUCTION_PIECES.filter((p) => p.id === 'garden_bush').map((p) => p.category), ['Outdoor']);
    // The outdoor placement start (grass by the shop) is on the outdoor floors but off the shop floor.
    const inside = (rects, x, z) => rects.some((r) => x >= r.minX + 0.15 && x <= r.maxX - 0.15 && z >= r.minZ + 0.15 && z <= r.maxZ - 0.15);
    assert.ok(inside(portalPlaceFloors([]), 4.2, 10.2));
    assert.ok(!inside(placeFloors([]), 4.2, 10.2));
  });

  it('ships an original low-poly model sitting on the floor with a centred pivot', async () => {
    const { readFileSync } = await import('node:fs');
    const obj = readFileSync(new URL('../../public/models/furniture/garden_bush/garden_bush.obj', import.meta.url), 'utf8');
    const v = obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(/\s+/).slice(1).map(Number));
    const tris = obj.split('\n').filter((l) => l.startsWith('f ')).length;
    assert.ok(tris < 300, `${tris} tris`);
    const ax = (i) => [Math.min(...v.map((p) => p[i])), Math.max(...v.map((p) => p[i]))];
    const [y0, y1] = ax(1);
    assert.equal(y0, 0);
    const h = y1 * 0.01125;
    assert.ok(h >= 0.8 && h <= 1.0, `height ${h}`);
    for (const i of [0, 2]) {
      const [a, b] = ax(i);
      assert.ok(Math.abs(a + b) < 0.5);
      assert.ok(b - a <= 128 * 1.0, 'about one tile');
    }
  });
});

describe('place anywhere', () => {
  it('every catalogue piece places inside and outside; wall pieces snap to both faces', async () => {
    const { pieceWallMounts, snapToPieceWall, ROOM_W, ROOM_D } = await import('./layout.js');
    const mounts = pieceWallMounts([]);
    assert.ok(mounts.some((m) => m.face === 'inside'));
    assert.ok(mounts.some((m) => m.face === 'outside'));
    const front = ROOM_D / 2;
    // Door, sign and windows on the origin front wall are never a mount span.
    for (const m of mounts.filter((row) => row.wall === 'front')) {
      for (const bad of [0, -1.48, 1.48]) assert.ok(bad < m.minAlong || bad > m.maxAlong, `front ${m.face} covers ${bad}`);
    }
    for (const m of mounts.filter((row) => row.wall === 'left' || row.wall === 'right')) {
      assert.ok(0 < m.minAlong || 0 > m.maxAlong, 'side window');
    }
    for (const row of CONSTRUCTION_PIECES) {
      assert.ok(['outdoor', 'wall'].includes(row.mount), `${row.id} mount ${row.mount}`);
      if (row.mount !== 'wall') continue;
      const inside = snapToPieceWall(-1, -2.9, [], 0);
      assert.ok(inside.z < 0 && inside.z > -3.3 && inside.rot === 0, `${row.id} inside back wall`);
      const outside = snapToPieceWall(-3, front + 0.5, [], Math.PI);
      assert.ok(outside.z > front, `${row.id} outside front wall`);
      assert.ok(Math.abs(outside.x) > 2.19 - 1e-6, `${row.id} outside skips door/sign/windows`);
      const side = snapToPieceWall(-ROOM_W / 2 - 0.4, 2.5, [], -Math.PI / 2);
      assert.ok(side.x < -ROOM_W / 2, `${row.id} outside left wall`);
    }
    assert.equal(constructionPiece('lit_torch').mount, 'wall');
    const shelves = constructionPiece('cooking_shelves');
    assert.equal(shelves.mount, 'outdoor');
    assert.equal(shelves.hw, 0.61);
    assert.equal(shelves.hd, 0.23);
  });
});

function builder() {
  const state = funded();
  state.skills.addXp('construction', xpForLevel(20));
  return state;
}

describe('construction build gold', () => {
  it('costs 1,000 gp per unlock level on top of materials', () => {
    assert.equal(constructionBuildGold(constructionPiece('crate')), 1000);
    assert.equal(constructionBuildGold(constructionPiece('bench')), 20000);
    assert.equal(constructionBuildGold(constructionPiece('throne')), 99000);
    assert.equal(constructionBuildGold({ ...constructionPiece('bench'), free: true }), 0);
    const state = builder();
    const gold = state.gold;
    assert.equal(placeConstruction(state, 'bench', { x: 1, z: 1, rot: 0 }), true);
    assert.equal(state.gold, gold - 20000);
    assert.equal(state.furniture.placed[0].paid, 20000);
  });

  it('blocks placing without enough gold', () => {
    const state = builder();
    state.gold = 19999;
    assert.match(constructionPlaceBlock(state, 'bench'), /need 20,000 gp/);
    assert.equal(placeConstruction(state, 'bench', { x: 1, z: 1, rot: 0 }), false);
    assert.equal(state.gold, 19999);
    assert.equal(state.furniture.placed.length, 0);
  });

  it('moving is free, delete refunds paid gold, old pieces refund none', () => {
    const state = builder();
    placeConstruction(state, 'bench', { x: 1, z: 1, rot: 0 });
    const gold = state.gold;
    assert.equal(moveConstruction(state, 0, { x: 2, z: 2, rot: 1 }), true);
    assert.equal(state.gold, gold);
    assert.equal(pickupConstruction(state, 0), true);
    assert.equal(state.gold, gold + 20000);
    state.furniture.placed.push(...readPlacedFurniture([{ id: 'bench', x: 0, z: 0, rot: 0 }]));
    const before = state.gold;
    assert.equal(pickupConstruction(state, 0), true);
    assert.equal(state.gold, before, 'old-save piece paid no build gold');
    assert.deepEqual(readPlacedFurniture([{ id: 'bench', x: 0, z: 0, paid: 20000 }])[0].paid, 20000);
  });
});

it('build catalogue tabs sort pieces by Construction level', async () => {
  const C = await import('./construction.js');
  for (const cat of C.constructionCategories()) {
    const lv = C.constructionPiecesByLevel(cat).map((p) => p.level ?? 1);
    for (let i = 1; i < lv.length; i++) assert.ok(lv[i] >= lv[i - 1], `${cat} out of order`);
  }
});

it('every construction piece has a build thumbnail', async () => {
  const { existsSync } = await import('node:fs');
  const C = await import('./construction.js');
  for (const p of C.CONSTRUCTION_PIECES) {
    assert.ok(existsSync(new URL(`../../public/thumbs/build/${p.id.replace(/_/g, '-')}.png`, import.meta.url)), p.id);
  }
});
