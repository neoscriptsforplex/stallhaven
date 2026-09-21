import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import {
  CUSTOMER_LOOKS,
  PLAYER_WORLD_SCALE,
  buildAdventurer,
  buildAnvil,
  buildChest,
  buildCounter,
  buildDefaultTable,
  buildShopDoor,
  setDoorOpen,
  buildGoblin,
  buildPickaxe,
  buildShopkeeper,
  measureVisibleBox,
  measureVisibleMeshHeight,
  proceduralPlayerFitHeight,
  setHeldTool,
  updateMinePose,
  updateWalkPose,
  setBundledLook,
  buildWare,
  wrapBundledProp,
  wrapImportedCharacter,
  wrapShopPlayer,
  sitVisibleOnY,
  ANVIL_WORLD_SCALE,
} from './models.js';
import { BUNDLED_PROP_FOLDERS, parseBundledPlayerBuffers, parseModelBuffer } from './upload.js';
import { furnitureVisualYaw, pointHitsShop, SHOP_FURNITURE_FLOOR_Y, TRAPDOOR, TRAPDOOR_HOLE_CLEAR } from './layout.js';
import { RAT_DUMP_YAW } from './rats.js';
import { buildCauldron, buildDungeon, buildDungeonLadder, buildFountain, buildFurnace, buildRange, buildRat, buildShop, buildSpinningWheel, buildTorch, buildTree, DUNGEON_BOULDERS, DUNGEON_FLOOR_Y, DUNGEON_REMAINS, DUNGEON_ROCK_ALBEDO_LIFT, ESSENCE_OLD_XZ, PATH_COBBLE_SCALE, RANGE_PLATE_FRAC, RANGE_WORLD_SCALE, WHEEL_WORLD_SCALE, mountFountainWater } from './shopbuild.js';

function cueNames(root) {
  const names = new Set();
  root.traverse((child) => {
    if (child.name) names.add(child.name);
  });
  return names;
}

function sampleLooks(typeId) {
  const bags = [];
  for (let i = 0; i < 36; i += 1) {
    bags.push(cueNames(buildAdventurer(typeId, { seed: (i + 1) * 0.028 })));
  }
  return bags;
}

function someHave(bags, name) {
  return bags.some((bag) => bag.has(name));
}

function allHave(bags, name) {
  return bags.every((bag) => bag.has(name));
}

describe('customer class looks', () => {
  it('registers per-class dressers for later art packs', () => {
    assert.deepEqual(Object.keys(CUSTOMER_LOOKS).sort(), [
      'king', 'mage', 'mercenary', 'pilgrim', 'ranger',
    ]);
  });

  it('dresses hedge mages with robes, a staff orb, and hat or hood variants', () => {
    const bags = sampleLooks('hedgemage');
    assert.ok(allHave(bags, 'cue-robes'));
    assert.ok(allHave(bags, 'cue-orb'));
    assert.ok(someHave(bags, 'cue-hat'));
    assert.ok(someHave(bags, 'cue-hood'));
  });

  it('dresses rangers as lean hide kits with a quiver and a bow, crossbow, or blade', () => {
    const bags = sampleLooks('ranger');
    assert.ok(allHave(bags, 'cue-quiver'));
    assert.ok(allHave(bags, 'cue-hide') || allHave(bags, 'cue-chaps'));
    assert.ok(someHave(bags, 'cue-bow') || someHave(bags, 'cue-crossbow') || someHave(bags, 'cue-blade'));
    assert.ok(someHave(bags, 'cue-vambrace'));
    assert.equal(bags.some((bag) => bag.has('cue-helm')), false);
  });

  it('dresses mercenaries as plate fighters with helm, scimitar, kite, and amulet', () => {
    const bags = sampleLooks('mercenary');
    assert.ok(allHave(bags, 'cue-helm'));
    assert.ok(allHave(bags, 'cue-plate'));
    assert.ok(allHave(bags, 'cue-scimitar'));
    assert.ok(allHave(bags, 'cue-shield'));
    assert.ok(allHave(bags, 'cue-amulet'));
  });

  it('dresses pilgrims as civilian variants, not combat kits', () => {
    const bags = sampleLooks('pilgrim');
    assert.ok(someHave(bags, 'cue-tunic') || someHave(bags, 'cue-skirt') || someHave(bags, 'cue-apron'));
    assert.ok(someHave(bags, 'cue-chefhat'));
    assert.ok(someHave(bags, 'cue-cape'));
    assert.ok(someHave(bags, 'cue-skirt'));
    assert.ok(someHave(bags, 'cue-mallet') || someHave(bags, 'cue-sword') || someHave(bags, 'cue-bouquet'));
    assert.equal(bags.some((bag) => bag.has('cue-helm')), false);
    assert.equal(bags.some((bag) => bag.has('cue-orb')), false);
    const king = cueNames(buildAdventurer('kingroald', { seed: 0.2 }));
    assert.ok(king.has('cue-crown'));
    assert.ok(king.has('cue-gem'));
    assert.ok(king.has('cue-stole'));
    assert.ok(king.has('cue-cuff'));
    assert.ok(king.has('cue-diamond'));
    assert.equal(king.has('cue-scepter'), false);
    assert.ok(king.has('face-hair'));
  });
});

describe('outdoor and dungeon extras', () => {
  it('builds layered pine trees and hunched goblins with tan kit plus plate', () => {
    const tree = buildTree(1);
    assert.equal(tree.name, 'pine');
    let cones = 0;
    tree.traverse((child) => {
      if (child.geometry?.type === 'ConeGeometry') cones += 1;
    });
    assert.ok(cones >= 4);
    const goblin = cueNames(buildGoblin());
    assert.ok(goblin.has('cue-tunic'));
    assert.ok(goblin.has('cue-pauldron'));
    assert.ok(goblin.has('cue-ear'));
    assert.ok(goblin.has('cue-nose'));
    assert.ok(goblin.has('cue-topknot'));
  });

  it('builds dark grey dungeon rats with red triangle eyes and a tan tail', () => {
    const rat = buildRat();
    const names = cueNames(rat);
    assert.ok(names.has('cue-eye'));
    assert.ok(names.has('cue-tail'));
    let fur = null;
    rat.traverse((child) => {
      if (child.isMesh && child.material?.color && !fur) fur = child.material.color.getHex();
    });
    assert.ok(fur < 0x505050);
  });

  it('keeps basic white skull and loose-bone props out of the dungeon', () => {
    assert.ok(DUNGEON_REMAINS.every((spot) => spot.kind === 'slump'));
    const { root } = buildDungeon();
    let ivorySpheres = 0;
    let namedSkeleton = 0;
    root.traverse((child) => {
      if (child.name === 'skeleton') namedSkeleton += 1;
      if (child.isMesh && child.geometry?.type === 'SphereGeometry') {
        const hex = child.material?.color?.getHex?.();
        if (hex === 0xe8dcc4) ivorySpheres += 1;
      }
    });
    assert.equal(ivorySpheres, 0);
    assert.equal(namedSkeleton, 0);
  });

  it('paints outdoor grass as mottled greens with dry tan patches', () => {
    const shop = buildShop([]).root;
    let ground = null;
    shop.traverse((child) => {
      if (child.name === 'grass-ground') ground = child;
    });
    assert.ok(ground, 'garden should have a grass ground plane');
    assert.ok(ground.material?.map, 'grass ground should use a mottled texture, not a flat color');
    assert.ok((ground.material.map.repeat?.x ?? 0) > 1);
  });

  it('tiles the cobble path about 3× finer than the wall stone scale', () => {
    assert.equal(PATH_COBBLE_SCALE, 3);
  });

  it('instances many grass blades and clears them inside a left expansion', () => {
    const origin = buildShop([]).root;
    const left = buildShop(['left']).root;
    let originCount = 0;
    let leftCount = 0;
    let leftInRoom = 0;
    origin.traverse((child) => {
      if (child.isInstancedMesh && child.userData.kind === 'grass') originCount += child.count;
    });
    const scratch = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    left.traverse((child) => {
      if (!child.isInstancedMesh || child.userData.kind !== 'grass') return;
      leftCount += child.count;
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, scratch);
        pos.setFromMatrixPosition(scratch);
        if (pointHitsShop(pos.x, pos.z, ['left'], 1.15)) leftInRoom += 1;
      }
    });
    assert.ok(originCount > 800, `expected a lush lawn, got ${originCount} blades`);
    assert.ok(leftCount < originCount);
    assert.equal(leftInRoom, 0);
  });

  it('keeps round dark-green bushes off garden soil patches', () => {
    const { root } = buildShop([]);
    let bushes = 0;
    let soils = 0;
    let flowerBeds = 0;
    root.traverse((child) => {
      if (child.name === 'flowers') flowerBeds += 1;
      if (child.isMesh && child.geometry?.type === 'CylinderGeometry' && child.material?.color?.getHex?.() === 0x4a331c) {
        soils += 1;
      }
      if (child.isMesh && child.geometry?.type === 'SphereGeometry' && child.geometry.parameters?.radius === 0.28) {
        const hex = child.material?.color?.getHex?.();
        if (hex === 0x2f6a32) bushes += 1;
      }
    });
    assert.equal(bushes, 0);
    assert.ok(soils >= 1, 'dirt patches should remain');
    assert.ok(flowerBeds >= 1, 'flower beds should remain');
  });

  it('lights expansion rooms with extra wall torches', () => {
    const countTorches = (root) => {
      let n = 0;
      root.traverse((child) => {
        if (child.name === 'torch') n += 1;
      });
      return n;
    };
    const origin = countTorches(buildShop([]).root);
    const expanded = countTorches(buildShop(['left', 'right']).root);
    assert.ok(origin >= 4);
    assert.ok(expanded > origin);
  });

  it('lights every dungeon wall with wall torches', () => {
    const built = buildDungeon();
    const walls = { west: 0, east: 0, north: 0, south: 0 };
    built.root.traverse((child) => {
      if (child.name !== 'torch') return;
      const { x, z } = child.position;
      if (x < -built.size.w / 2 + 0.5) walls.west += 1;
      else if (x > built.size.w / 2 - 0.5) walls.east += 1;
      else if (z < -built.size.d / 2 + 0.5) walls.north += 1;
      else if (z > built.size.d / 2 - 0.5) walls.south += 1;
    });
    assert.ok(walls.west >= 2, `west ${walls.west}`);
    assert.ok(walls.east >= 2, `east ${walls.east}`);
    assert.ok(walls.north >= 2, `north ${walls.north}`);
    assert.ok(walls.south >= 2, `south ${walls.south}`);
  });

  it('pours water from the fountain spout', () => {
    const shop = buildShop([]).root;
    let fountain = null;
    shop.traverse((child) => {
      if (child.name === 'fountain') fountain = child;
    });
    assert.ok(fountain);
    assert.ok(fountain.userData.fountainWater);
    assert.ok(fountain.getObjectByName('fountain-stream'));
    assert.ok(fountain.getObjectByName('fountain-drops'));
  });
});

describe('uploaded player walk', () => {
  it('binds a walk rig and swings legs while moving', () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.6, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x888888 }),
    );
    mesh.position.y = 0.8;
    source.add(mesh);
    const wrapped = wrapImportedCharacter(source, { name: 'hero', label: 'You' });
    assert.ok(wrapped.userData.rig?.legL);
    assert.ok(wrapped.userData.rig?.legR);
    assert.ok(wrapped.userData.walkMode);
    const rest = wrapped.userData.rig.legL.rotation.x;
    updateWalkPose(wrapped, true, 0.2, 1);
    updateWalkPose(wrapped, true, 0.2, 1);
    assert.notEqual(wrapped.userData.rig.legL.rotation.x, rest);
    assert.ok(wrapped.userData.walkPhase > 0);
  });

  it('parents a pickaxe to the walk arm and swings it while mining', () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.6, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x888888 }),
    );
    mesh.position.y = 0.8;
    source.add(mesh);
    const wrapped = wrapImportedCharacter(source, { name: 'miner', label: 'You' });
    assert.ok(wrapped.userData.pickaxe);
    assert.ok(wrapped.userData.hand);
    assert.equal(wrapped.userData.pickaxe.parent, wrapped.userData.hand);
    setHeldTool(wrapped, 'pickaxe');
    assert.equal(wrapped.userData.pickaxe.visible, true);
    const rest = wrapped.userData.rig.armR.rotation.x;
    updateMinePose(wrapped, 0.2, 0.4);
    assert.notEqual(wrapped.userData.rig.armR.rotation.x, rest);
  });

  it('keeps imported player scale while walking', () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 40, 8),
      new THREE.MeshBasicMaterial({ color: 0x888888 }),
    );
    mesh.position.y = 20;
    source.add(mesh);
    source.scale.setScalar(0.05);
    const wrapped = wrapImportedCharacter(source, { name: 'hero', label: 'You', height: 1.7 });
    const body = wrapped.userData.walkBody;
    const restY = body.scale.y;
    assert.ok(Math.abs(body.scale.x - body.scale.y) < 1e-6);
    assert.ok(Math.abs(body.scale.y - body.scale.z) < 1e-6);
    updateWalkPose(wrapped, true, 0.2, 1);
    assert.ok(Math.abs(body.scale.y - restY) < restY * 0.08);
    assert.ok(Math.abs(body.scale.x - body.scale.z) < 1e-6);
  });
});

describe('bundled default player', () => {
  const playerDir = join(dirname(fileURLToPath(import.meta.url)), '../../public/models/player');

  async function loadBundled() {
    const obj = readFileSync(join(playerDir, 'player.obj'));
    const mtl = readFileSync(join(playerDir, 'player.mtl'));
    return parseBundledPlayerBuffers(obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength), mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength));
  }

  it('fits LilRunnerBoi to the stock humanoid height without stretch', async () => {
    const scene = await loadBundled();
    const wrapped = wrapShopPlayer(scene, { chefHat: false });
    const keeper = buildShopkeeper({ chefHat: false });
    keeper.scale.setScalar(PLAYER_WORLD_SCALE);
    if (keeper.userData.pickaxe) keeper.userData.pickaxe.visible = false;
    for (const hammer of keeper.userData.hammers ?? []) hammer.visible = false;
    if (keeper.userData.chefHat) keeper.userData.chefHat.visible = false;

    const body = wrapped.userData.walkBody;
    assert.ok(body);
    assert.ok(Math.abs(body.scale.x - body.scale.y) < 1e-6);
    assert.ok(Math.abs(body.scale.y - body.scale.z) < 1e-6);
    const got = measureVisibleMeshHeight(body);
    const want = measureVisibleMeshHeight(keeper);
    assert.ok(Math.abs(got - want) < 0.08, `height ${got} vs procedural ${want}`);
    const box = new THREE.Box3().setFromObject(body);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `feet should sit on the floor, minY=${box.min.y}`);
    assert.ok(Math.abs(proceduralPlayerFitHeight() - want / PLAYER_WORLD_SCALE) < 0.08);
  });

  it('uses the shared walk and mining poses on the bundled mesh', async () => {
    const scene = await loadBundled();
    const wrapped = wrapShopPlayer(scene, { chefHat: false });
    assert.ok(wrapped.userData.rig?.legL);
    assert.ok(wrapped.userData.walkMode);
    assert.ok(wrapped.userData.pickaxe);
    assert.equal(wrapped.userData.pickaxe.parent, wrapped.userData.hand);
    const restLeg = wrapped.userData.rig.legL.rotation.x;
    updateWalkPose(wrapped, true, 0.2, 1);
    assert.notEqual(wrapped.userData.rig.legL.rotation.x, restLeg);
    setHeldTool(wrapped, 'pickaxe');
    assert.equal(wrapped.userData.pickaxe.visible, true);
    const restArm = wrapped.userData.rig.armR.rotation.x;
    updateMinePose(wrapped, 0.2, 0.4);
    assert.notEqual(wrapped.userData.rig.armR.rotation.x, restArm);
  });
});

describe('bundled prop swaps', () => {
  const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');

  async function loadFolder(folder) {
    const base = folder.split('/').pop();
    const obj = readFileSync(join(modelsRoot, folder, `${base}.obj`));
    const mtl = readFileSync(join(modelsRoot, folder, `${base}.mtl`));
    return parseModelBuffer(
      obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
      `${base}.obj`,
      { [`${base}.mtl`]: mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
    );
  }

  function assertUniform(mesh) {
    assert.ok(Math.abs(mesh.scale.x - mesh.scale.y) < 1e-6);
    assert.ok(Math.abs(mesh.scale.y - mesh.scale.z) < 1e-6);
  }

  function assertGrounded(mesh) {
    const box = measureVisibleBox(mesh);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `feet should sit on the floor, minY=${box.min.y}`);
  }

  it('lists the shipped prop folders and skips a missing goblin dump', () => {
    const ids = BUNDLED_PROP_FOLDERS.map((item) => item.id);
    for (const id of ['chest', 'furnace', 'range', 'anvil', 'cauldron', 'door', 'ladder', 'torch', 'trapdoor', 'wheel', 'rat', 'table', 'counter', 'tree', 'flowers', 'rock', 'fountain', 'skeleton']) {
      assert.ok(ids.includes(id), id);
    }
    for (const id of ['rune-air', 'rune-water', 'rune-earth', 'rune-fire', 'ore-bronze', 'ore-iron', 'ore-steel', 'ore-mithril', 'ore-adamant', 'ore-runite', 'ore-dragon', 'ore-essence']) {
      assert.ok(ids.includes(id), id);
    }
    for (const id of ['food-bread', 'food-pizza', 'food-cake', 'food-pie', 'food-fish-pie', 'food-salmon', 'food-lobster', 'food-chocolate-cake', 'food-monkfish', 'food-curry', 'food-shark', 'food-summer-pie', 'food-anglerfish']) {
      assert.ok(ids.includes(id), id);
    }
    assert.ok(ids.includes('goblin'));
  });

  it('fits bundled trees, counters, flowers, rocks, and skeletons without stretch', async () => {
    const tree = wrapBundledProp(await loadFolder('tree'), buildTree(1), { name: 'pine', fit: 'height' });
    assert.equal(tree.name, 'pine');
    assertUniform(tree);
    assertGrounded(tree);
    const treeBox = measureVisibleBox(tree);
    const pineBox = measureVisibleBox(buildTree(1));
    assert.ok(Math.abs(treeBox.max.y - pineBox.max.y) < 0.08, `tree height ${treeBox.max.y} vs ${pineBox.max.y}`);

    const counter = wrapBundledProp(await loadFolder('counter'), buildCounter(), { name: 'counter', fit: 'xz' });
    assertUniform(counter);
    assertGrounded(counter);
    const cGot = measureVisibleBox(counter).getSize(new THREE.Vector3());
    const cWant = measureVisibleBox(buildCounter()).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(cGot.x, cGot.z) - Math.max(cWant.x, cWant.z)) < 0.12);

    const flowers = wrapBundledProp(await loadFolder('flowers'), new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.55)), { name: 'flowers', fit: 'max' });
    assertUniform(flowers);
    assertGrounded(flowers);

    const rock = wrapBundledProp(await loadFolder('rock'), new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.45)), { name: 'rock', fit: 'max' });
    assertUniform(rock);
    assertGrounded(rock);

    const slump = new THREE.Group();
    const slumpMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3));
    slumpMesh.position.y = 0.25;
    slump.add(slumpMesh);
    const skeleton = wrapBundledProp(await loadFolder('skeleton'), slump, { name: 'skeleton', fit: 'height' });
    assert.equal(skeleton.name, 'skeleton');
    assertUniform(skeleton);
    assertGrounded(skeleton);
    const skBox = measureVisibleBox(skeleton);
    assert.ok(Math.abs(skBox.max.y - 0.5) < 0.08, `skeleton height ${skBox.max.y}`);

    setBundledLook('skeleton', await loadFolder('skeleton'));
    try {
      const { root } = buildDungeon();
      let slumps = 0;
      let ivorySpheres = 0;
      root.traverse((child) => {
        if (child.name === 'skeleton') slumps += 1;
        if (child.isMesh && child.geometry?.type === 'SphereGeometry') {
          const hex = child.material?.color?.getHex?.();
          if (hex === 0xe8dcc4) ivorySpheres += 1;
        }
      });
      assert.equal(slumps, DUNGEON_REMAINS.length);
      assert.equal(ivorySpheres, 0);
    } finally {
      setBundledLook('skeleton', null);
    }
  });

  it('keeps fountain water pouring from the top of a bundled body', async () => {
    const target = buildFountain();
    if (target.userData.fountainWater) {
      for (const child of [...target.children]) {
        if (child.name?.startsWith('fountain-')) target.remove(child);
      }
      delete target.userData.fountainWater;
    }
    const body = wrapBundledProp(await loadFolder('fountain'), target, { name: 'fountain-body', fit: 'height' });
    assertUniform(body);
    assertGrounded(body);
    const group = new THREE.Group();
    group.name = 'fountain';
    group.add(body);
    mountFountainWater(group);
    assert.ok(group.userData.fountainWater);
    assert.ok(group.getObjectByName('fountain-stream'));
    assert.ok(group.getObjectByName('fountain-drops'));
    const stone = measureVisibleBox(body);
    const fx = group.userData.fountainWater;
    assert.ok(Math.abs(fx.fallStart - stone.max.y) < 0.02, `stream should start at the spout, ${fx.fallStart} vs ${stone.max.y}`);
    assert.ok(fx.fallStart > fx.fallEnd);
  });

  it('fits a bundled anvil dump to the current anvil bbox without stretch', async () => {
    let bundled;
    try {
      bundled = await loadFolder('anvil');
    } catch {
      return;
    }
    const target = buildAnvil();
    const fitted = wrapBundledProp(bundled, target, { name: 'anvil', fit: 'max', label: 'Anvil' });
    assert.equal(fitted.name, 'anvil');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
  });

  it('fits a bundled cauldron dump to the current cauldron bbox without stretch', async () => {
    let bundled;
    try {
      bundled = await loadFolder('cauldron');
    } catch {
      return;
    }
    const target = buildCauldron();
    const fitted = wrapBundledProp(bundled, target, { name: 'cauldron', fit: 'max', label: 'Cauldron' });
    assert.equal(fitted.name, 'cauldron');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
  });

  it('fits a bundled front door dump to the current leaf bbox without stretch', async () => {
    let bundled;
    try {
      bundled = await loadFolder('door');
    } catch {
      return;
    }
    const target = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.08, 0.1));
    target.position.y = 1.04;
    const fitted = wrapBundledProp(bundled, target, { name: 'door-leaf', fit: 'max' });
    assert.equal(fitted.name, 'door-leaf');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
  });

  it('mirrors the front door dump so the knob sits on the latch side', async () => {
    const bundled = await loadFolder('door');
    const target = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.08, 0.1));
    target.position.y = 1.04;
    const handleMeanX = (root) => {
      root.updateMatrixWorld(true);
      const box = measureVisibleBox(root);
      const midY = (box.min.y + box.max.y) * 0.5;
      const midZ = (box.min.z + box.max.z) * 0.5;
      const spanZ = Math.max(0.001, box.max.z - box.min.z);
      const pts = [];
      const v = new THREE.Vector3();
      root.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const pos = child.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i += 1) {
          v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
          if (Math.abs(v.y - midY) > 0.35) continue;
          pts.push(v.clone());
        }
      });
      const far = pts.filter((p) => Math.abs(p.z - midZ) > spanZ * 0.22);
      const use = far.length ? far : pts;
      return use.reduce((sum, p) => sum + p.x, 0) / use.length;
    };
    const plain = wrapBundledProp(bundled, target, { name: 'door-leaf', fit: 'max' });
    const flipped = wrapBundledProp(bundled, target, { name: 'door-leaf', fit: 'max', mirrorX: true });
    const left = handleMeanX(plain);
    const right = handleMeanX(flipped);
    assert.ok(left * right < 0, `knob should flip sides, ${left} vs ${right}`);
    assert.ok(right > 0, `mirrored knob should sit on +X / latch, meanX=${right}`);
    setBundledLook('door', bundled);
    try {
      const door = buildShopDoor();
      assert.ok(door.userData.hinge);
      assert.ok(door.userData.hinge.rotation.y > 1.5);
    } finally {
      setBundledLook('door', null);
    }
  });

  it('fits a bundled dungeon ladder dump to the current rails without stretch', async () => {
    let bundled;
    try {
      bundled = await loadFolder('ladder');
    } catch {
      return;
    }
    const target = new THREE.Mesh(new THREE.BoxGeometry(0.41, 2.6, 0.1));
    target.position.y = 1.3;
    const fitted = wrapBundledProp(bundled, target, { name: 'ladder', fit: 'max' });
    assert.equal(fitted.name, 'ladder');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
  });

  it('yaws the dungeon ladder flat against the west wall and keeps the climb pick', async () => {
    const bundled = await loadFolder('ladder');
    setBundledLook('ladder', bundled);
    try {
      const ladder = buildDungeonLadder();
      assert.equal(ladder.name, 'ladder');
      assert.ok(Math.abs(ladder.rotation.y - Math.PI / 2) < 1e-6);
      let marked = 0;
      ladder.traverse((child) => {
        if (child.userData?.kind === 'ladder') marked += 1;
      });
      assert.ok(marked >= 2);
      const built = buildDungeon();
      assert.equal(built.ladder?.name, 'ladder');
      assert.ok(Math.abs(built.ladder.rotation.y - Math.PI / 2) < 1e-6);
      assert.ok(Math.abs(built.ladder.position.z - 0.4) < 1e-6);
      built.ladder.updateMatrixWorld(true);
      const box = measureVisibleBox(built.ladder);
      assert.ok(box.min.x > -5.5 && box.min.x < -5.2, `ladder should sit inside the west wall, minX=${box.min.x}`);
    } finally {
      setBundledLook('ladder', null);
    }
  });

  it('fits a bundled wall torch dump upright with flame light', async () => {
    const bundled = await loadFolder('torch');
    const target = buildTorch();
    const fitted = wrapBundledProp(bundled, target, { name: 'torch', fit: 'max' });
    assert.equal(fitted.name, 'torch');
    assertUniform(fitted);
    assertGrounded(fitted);
    setBundledLook('torch', bundled);
    try {
      const torch = buildTorch();
      assert.ok(torch.getObjectByName('torch-glow'));
      assert.ok(torch.getObjectByName('torch-flame'));
      const shop = buildShop([]).root;
      const dungeon = buildDungeon().root;
      const mounts = [];
      shop.traverse((child) => {
        if (child.name === 'torch') mounts.push(child);
      });
      dungeon.traverse((child) => {
        if (child.name === 'torch') mounts.push(child);
      });
      assert.ok(mounts.length >= 8);
      for (const mount of mounts) {
        assert.ok(Math.abs(mount.rotation.z) < 0.05, `torch should stay upright, z=${mount.rotation.z}`);
        const glow = mount.getObjectByName('torch-glow');
        assert.ok(glow, 'torch-glow');
        mount.updateMatrixWorld(true);
        const box = measureVisibleBox(mount);
        const tip = glow.getWorldPosition(new THREE.Vector3());
        const mid = (box.min.y + box.max.y) / 2;
        const height = box.max.y - box.min.y;
        assert.ok(tip.y > mid, `glow should sit at the flame tip, y=${tip.y} mid=${mid}`);
        assert.ok(tip.y > box.min.y + height * 0.85, `glow should be in the top of the torch, y=${tip.y} box=${box.min.y}..${box.max.y}`);
        assert.ok(Math.abs(tip.y - box.max.y) < 0.08, `glow should be at the top, y=${tip.y} max=${box.max.y}`);
      }
      const origin = [];
      shop.traverse((child) => {
        if (child.name === 'torch') origin.push([child.position.x, child.position.y, child.position.z]);
      });
      assert.ok(origin.some(([x, y, z]) => (
        Math.abs(x + 3.92) < 0.08 && Math.abs(y - 1.62) < 0.05 && Math.abs(z + 1.75) < 0.08
      )));
    } finally {
      setBundledLook('torch', null);
    }
  });

  it('fits a bundled outdoor trapdoor dump flush without stretch', async () => {
    const bundled = await loadFolder('trapdoor');
    const target = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95));
    target.position.y = 0.08;
    const fitted = wrapBundledProp(bundled, target, { name: 'trapdoor', fit: 'max' });
    assert.equal(fitted.name, 'trapdoor');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
    setBundledLook('trapdoor', bundled);
    try {
      const shop = buildShop([]).root;
      let marked = 0;
      shop.traverse((child) => {
        if (child.userData?.kind === 'trapdoor') marked += 1;
      });
      assert.ok(marked >= 2, 'visual hatch and walk-to-fade pick should stay marked');
      let hatch = null;
      shop.traverse((child) => {
        if (child.name === 'trapdoor' && child.parent?.name !== 'trapdoor' && !hatch) hatch = child;
      });
      const visual = hatch?.children.find((child) => child.name === 'trapdoor');
      assert.ok(visual, 'baked entrance mesh should stay under the hatch group');
      visual.updateMatrixWorld(true);
      const box = measureVisibleBox(visual);
      assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `entrance should sit flush, minY=${box.min.y}`);
    } finally {
      setBundledLook('trapdoor', null);
    }
  });

  it('keeps lawn blades out of the dungeon entrance hole', () => {
    const shop = buildShop([]).root;
    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let blades = 0;
    let inHole = 0;
    shop.traverse((child) => {
      if (child.name !== 'grass' || !child.isInstancedMesh) return;
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, dummy);
        pos.setFromMatrixPosition(dummy);
        blades += 1;
        if (Math.hypot(pos.x - TRAPDOOR.x, pos.z - TRAPDOOR.z) < TRAPDOOR_HOLE_CLEAR) inHole += 1;
      }
    });
    assert.ok(blades > 100, `lawn should still have blades, got ${blades}`);
    assert.equal(inHole, 0, `grass should not cover the hatch opening, inHole=${inHole}`);
  });

  it('fits a bundled pottery-oven furnace dump on the shop floor', async () => {
    const bundled = await loadFolder('furnace');
    const target = buildFurnace();
    const fitted = wrapBundledProp(bundled, target, { name: 'furnace', fit: 'height', label: 'Furnace' });
    assert.equal(fitted.name, 'furnace');
    assertUniform(fitted);
    assertGrounded(fitted);
    setBundledLook('furnace', bundled);
    try {
      const furnace = buildFurnace();
      assert.equal(furnace.name, 'furnace');
      furnace.position.set(1.2, 0, -2.4);
      furnace.rotation.y = furnitureVisualYaw('furnace', 0);
      furnace.updateMatrixWorld(true);
      const box = measureVisibleBox(furnace);
      assert.ok(Math.abs(box.min.y - SHOP_FURNITURE_FLOOR_Y) < 0.03, `furnace should sit on the floor, minY=${box.min.y}`);
      assert.ok(Math.abs(furnace.scale.x - furnace.scale.y) < 1e-6);
    } finally {
      setBundledLook('furnace', null);
    }
  });

  it('hides the dumped cooking-range wooden plate under the floor', async () => {
    const bundled = await loadFolder('range');
    setBundledLook('range', bundled);
    try {
      const range = buildRange();
      const box = measureVisibleBox(range);
      const height = box.max.y - box.min.y;
      const sink = height * RANGE_PLATE_FRAC;
      assert.ok(sink > 0.08, `plate should be thick enough to hide, sink=${sink}`);
      assert.ok(Math.abs(box.min.y + sink) < 0.04, `plate bottom should sit sink below floor, minY=${box.min.y}`);
      assert.ok(box.min.y < -0.08, `brown plate should be under the boards, minY=${box.min.y}`);
      assert.ok(box.max.y > 1.6, `stove body should stay above the floor, maxY=${box.max.y}`);
    } finally {
      setBundledLook('range', null);
    }
  });

  it('sits a bundled chest on the shop floor after the world y=0 pose', async () => {
    const bundled = await loadFolder('chest');
    const procedural = buildChest();
    const procH = measureVisibleBox(procedural).getSize(new THREE.Vector3()).y;
    const uprightDump = wrapBundledProp(bundled, procedural, { name: 'chest', fit: 'height' });
    const pitchedDump = wrapBundledProp(bundled, procedural, {
      name: 'chest',
      fit: 'height',
      rotateX: -Math.PI / 2,
    });
    const uprightSize = measureVisibleBox(uprightDump).getSize(new THREE.Vector3());
    const pitchedSize = measureVisibleBox(pitchedDump).getSize(new THREE.Vector3());
    setBundledLook('chest', bundled);
    try {
      const chest = buildChest();
      assert.equal(chest.name, 'chest');
      const sized = measureVisibleBox(chest);
      const got = sized.getSize(new THREE.Vector3());
      assert.ok(Math.abs(got.y - procH) < 0.08, `chest should keep 60% height, ${got.y} vs ${procH}`);
      assert.ok(Math.abs(got.x - uprightSize.x) < 0.03, `no X pitch: width ${got.x} vs upright ${uprightSize.x}`);
      assert.ok(Math.abs(got.z - uprightSize.z) < 0.03, `no X pitch: depth ${got.z} vs upright ${uprightSize.z}`);
      assert.ok(
        Math.abs(uprightSize.x - pitchedSize.x) > 0.01 || Math.abs(uprightSize.z - pitchedSize.z) > 0.01,
        'pitched dump footprint should differ from upright',
      );
      chest.position.set(2.1, 0, -1.4);
      chest.rotation.set(0, furnitureVisualYaw('chest', 0), 0);
      chest.updateMatrixWorld(true);
      const box = measureVisibleBox(chest);
      assert.ok(Math.abs(box.min.y - SHOP_FURNITURE_FLOOR_Y) < 0.03, `chest should sit on the floor, minY=${box.min.y}`);
      assert.ok(Math.abs(chest.rotation.x) < 1e-8, 'chest stays unpitched');
      assert.ok(Math.abs(chest.rotation.z) < 1e-8, 'chest stays unrolled');
      chest.traverse((child) => {
        if (child.isSprite) return;
        assert.ok(Math.abs(child.rotation.x) < 1e-8, `${child.name || child.type} stays unpitched`);
        assert.ok(Math.abs(child.rotation.z) < 1e-8, `${child.name || child.type} stays unrolled`);
      });
    } finally {
      setBundledLook('chest', null);
    }
  });

  it('bakes the bundled rat dump so the snout faces +Z with wander heading', async () => {
    const bundled = await loadFolder('rat');
    const target = buildRat();
    const raw = wrapBundledProp(bundled, target, { name: 'rat', fit: 'max' });
    const faced = wrapBundledProp(bundled, target, { name: 'rat', fit: 'max', rotateY: RAT_DUMP_YAW });
    const rawSize = measureVisibleBox(raw).getSize(new THREE.Vector3());
    const facedSize = measureVisibleBox(faced).getSize(new THREE.Vector3());
    assert.ok(rawSize.x > rawSize.z, `dump length should start on X, got ${rawSize.x} x ${rawSize.z}`);
    assert.ok(facedSize.z > facedSize.x, `baked dump should run along Z, got ${facedSize.x} x ${facedSize.z}`);
    setBundledLook('rat', bundled);
    try {
      const live = buildRat();
      const liveSize = measureVisibleBox(live).getSize(new THREE.Vector3());
      assert.ok(liveSize.z > liveSize.x, `live rat should face +Z, got ${liveSize.x} x ${liveSize.z}`);
    } finally {
      setBundledLook('rat', null);
    }
  });

  it('fits a bundled spinning wheel dump without stretch and keeps craft spin hook', async () => {
    const bundled = await loadFolder('wheel');
    const target = buildSpinningWheel();
    const fitted = wrapBundledProp(bundled, target, { name: 'wheel', fit: 'max' });
    assert.equal(fitted.name, 'wheel');
    assertUniform(fitted);
    assertGrounded(fitted);
    const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
    const want = measureVisibleBox(target).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12);
    setBundledLook('wheel', bundled);
    try {
      const wheel = buildSpinningWheel();
      assert.equal(wheel.name, 'wheel');
      assert.ok(wheel.userData.spinWheel);
    } finally {
      setBundledLook('wheel', null);
    }
  });

  it('maps nested rune and dungeon-rock folders by directory name, not dump labels', () => {
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    assert.equal(byId['rune-air'], 'runes/air');
    assert.equal(byId['rune-water'], 'runes/water');
    assert.equal(byId['rune-earth'], 'runes/earth');
    assert.equal(byId['rune-fire'], 'runes/fire');
    assert.equal(byId['ore-bronze'], 'dungeon-rocks/bronze-rocks');
    assert.equal(byId['ore-iron'], 'dungeon-rocks/iron-rocks');
    assert.equal(byId['ore-steel'], 'dungeon-rocks/steel-rocks');
    assert.equal(byId['ore-mithril'], 'dungeon-rocks/mithril-rocks');
    assert.equal(byId['ore-adamant'], 'dungeon-rocks/adamant-rocks');
    assert.equal(byId['ore-runite'], 'dungeon-rocks/rune-rocks');
    assert.equal(byId['ore-dragon'], 'dungeon-rocks/dragon-rocks');
    assert.equal(byId['ore-essence'], 'dungeon-rocks/essence');
    assert.equal(byId['food-bread'], 'food/bread');
    assert.equal(byId['food-salmon'], 'food/salmon');
    assert.equal(byId['food-chocolate-cake'], 'food/chocolate-cake');
    assert.equal(byId['food-fish-pie'], 'food/fish-pie');
    assert.equal(byId['food-summer-pie'], 'food/summer-pie');
  });

  it('fits bundled food dumps to the current plate size by filename slug', async () => {
    const samples = [
      ['bread', 'food/bread'],
      ['chocolate_cake', 'food/chocolate-cake'],
      ['fish_pie', 'food/fish-pie'],
      ['pizza', 'food/pizza'],
      ['salmon', 'food/salmon'],
    ];
    for (const [recipeId, folder] of samples) {
      const bundled = await loadFolder(folder);
      const lookId = `food-${recipeId.replaceAll('_', '-')}`;
      const want = measureVisibleBox(buildWare(recipeId)).getSize(new THREE.Vector3());
      setBundledLook(lookId, bundled);
      try {
        const ware = buildWare(recipeId);
        assert.ok(ware.getObjectByName(lookId), recipeId);
        assertUniform(ware.getObjectByName(lookId));
        const got = measureVisibleBox(ware).getSize(new THREE.Vector3());
        assert.ok(
          Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.08,
          `${recipeId} size ${Math.max(got.x, got.y, got.z)} vs ${Math.max(want.x, want.y, want.z)}`,
        );
      } finally {
        setBundledLook(lookId, null);
      }
    }
    const salmonObj = readFileSync(join(modelsRoot, 'food/salmon/salmon.obj'), 'utf8');
    assert.match(salmonObj, /Raw salmon/i);
  });

  it('fits a Tin-labelled steel-rocks dump to the current steel boulder', async () => {
    const objText = readFileSync(join(modelsRoot, 'dungeon-rocks/steel-rocks/steel-rocks.obj'), 'utf8');
    assert.match(objText, /Tin rocks/i);
    const steel = await loadFolder('dungeon-rocks/steel-rocks');
    setBundledLook('ore-steel', steel);
    try {
      const built = buildDungeon();
      const names = [];
      let steelPick = 0;
      built.root.traverse((child) => {
        if (child.name) names.push(child.name);
        if (child.userData?.kind === 'boulder' && child.userData?.materialId === 'steel') steelPick += 1;
      });
      assert.ok(names.includes('ore-steel'));
      assert.ok(steelPick >= 1);
      const spot = DUNGEON_BOULDERS.find((item) => item.id === 'steel');
      assert.equal(spot?.name, 'Steel Ore');
      assert.equal(DUNGEON_BOULDERS.find((item) => item.id === 'runite')?.name, 'Runite');
    } finally {
      setBundledLook('ore-steel', null);
    }
  });

  it('fits a Mithril-labelled rune-rocks dump as Runite and keeps that display name', async () => {
    const objText = readFileSync(join(modelsRoot, 'dungeon-rocks/rune-rocks/rune-rocks.obj'), 'utf8');
    assert.match(objText, /Mithril rocks/i);
    const target = buildDungeon().boulders.find((item) => item.name === 'boulder-runite');
    assert.ok(target);
    const want = measureVisibleBox(target.children.find((child) => child.name === 'ore-runite')).getSize(new THREE.Vector3());
    const runite = await loadFolder('dungeon-rocks/rune-rocks');
    setBundledLook('ore-runite', runite);
    try {
      const built = buildDungeon();
      const names = [];
      let runitePick = 0;
      built.root.traverse((child) => {
        if (child.name) names.push(child.name);
        if (child.userData?.kind === 'boulder' && child.userData?.materialId === 'runite') runitePick += 1;
      });
      assert.ok(names.includes('ore-runite'));
      assert.ok(runitePick >= 1);
      const spot = DUNGEON_BOULDERS.find((item) => item.id === 'runite');
      assert.equal(spot?.name, 'Runite');
      assert.notEqual(spot?.name, 'Rune Ore');
      const visual = built.boulders.find((item) => item.name === 'boulder-runite')?.children.find((child) => child.name === 'ore-runite');
      assert.ok(visual);
      assertUniform(visual);
      const got = measureVisibleBox(visual).getSize(new THREE.Vector3());
      assert.ok(
        Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.12,
        `runite size ${Math.max(got.x, got.y, got.z)} vs ${Math.max(want.x, want.y, want.z)}`,
      );
    } finally {
      setBundledLook('ore-runite', null);
    }
  });

  it('fits nested rune dumps to the current disc size without stretch', async () => {
    const target = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.028, 20));
    target.position.y = 0.05;
    for (const mark of ['air', 'water', 'earth', 'fire']) {
      const bundled = await loadFolder(`runes/${mark}`);
      const fitted = wrapBundledProp(bundled, target, { name: `rune-${mark}`, fit: 'max' });
      assert.equal(fitted.name, `rune-${mark}`);
      assertUniform(fitted);
      const got = measureVisibleBox(fitted).getSize(new THREE.Vector3());
      const want = measureVisibleBox(target).getSize(new THREE.Vector3());
      assert.ok(Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.08, mark);
    }
  });

  it('fits dungeon ore dumps by folder tier and keeps mine picks without essence glow', async () => {
    const bronze = await loadFolder('dungeon-rocks/bronze-rocks');
    const essence = await loadFolder('dungeon-rocks/essence');
    setBundledLook('ore-bronze', bronze);
    setBundledLook('ore-essence', essence);
    try {
      const built = buildDungeon();
      const names = [];
      let bronzePick = 0;
      let essencePick = 0;
      let essenceLight = 0;
      let essenceEmissive = 0;
      built.root.traverse((child) => {
        if (child.name) names.push(child.name);
        if (child.userData?.kind === 'boulder' && child.userData?.materialId === 'bronze') bronzePick += 1;
        if (child.userData?.kind === 'boulder' && child.userData?.materialId === 'essence') essencePick += 1;
        let essenceParent = child;
        while (essenceParent && essenceParent.name !== 'boulder-essence') essenceParent = essenceParent.parent;
        if (essenceParent) {
          if (child.isLight) essenceLight += 1;
          const mats = child.isMesh
            ? (Array.isArray(child.material) ? child.material : [child.material])
            : [];
          if (mats.some((mat) => {
            const intensity = mat?.emissiveIntensity ?? 0;
            const glow = mat?.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.01;
            return intensity > 0.01 || glow;
          })) essenceEmissive += 1;
        }
      });
      assert.ok(names.includes('ore-bronze'));
      assert.ok(names.includes('ore-essence'));
      assert.ok(bronzePick >= 1);
      assert.ok(essencePick >= 1);
      assert.equal(essenceLight, 0);
      assert.equal(essenceEmissive, 0);
      assert.equal(DUNGEON_BOULDERS.some((spot) => spot.id === 'steel'), true);
      assert.equal(DUNGEON_BOULDERS.some((spot) => spot.id === 'runite'), true);
    } finally {
      setBundledLook('ore-bronze', null);
      setBundledLook('ore-essence', null);
    }
  });

  it('lifts dungeon ore dump materials and drops missing maps', async () => {
    assert.ok(DUNGEON_ROCK_ALBEDO_LIFT > 1);
    setBundledLook('ore-dragon', await loadFolder('dungeon-rocks/dragon-rocks'));
    setBundledLook('ore-bronze', await loadFolder('dungeon-rocks/bronze-rocks'));
    try {
      const built = buildDungeon();
      const dragon = built.boulders.find((item) => item.name === 'boulder-dragon');
      const bronze = built.boulders.find((item) => item.name === 'boulder-bronze');
      assert.ok(dragon && bronze);
      let dragonMaps = 0;
      let dragonStd = 0;
      let dragonMeshes = 0;
      let bronzeMax = 0;
      dragon.traverse((child) => {
        if (!child.isMesh || child.userData?.kind === 'boulder') return;
        dragonMeshes += 1;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        if (mats.some((mat) => mat?.map)) dragonMaps += 1;
        if (mats.every((mat) => mat?.isMeshStandardMaterial)) dragonStd += 1;
      });
      bronze.traverse((child) => {
        if (!child.isMesh || child.userData?.kind === 'boulder') return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          const c = mat?.color;
          if (!c) continue;
          const srgb = c.clone();
          if (typeof srgb.convertLinearToSRGB === 'function') srgb.convertLinearToSRGB();
          bronzeMax = Math.max(bronzeMax, srgb.r, srgb.g, srgb.b);
        }
      });
      assert.ok(dragonMeshes >= 1);
      assert.equal(dragonMaps, 0, 'missing .psd maps should not darken dragon rocks');
      assert.equal(dragonStd, dragonMeshes);
      assert.ok(bronzeMax > 0.12, `bronze albedo should not sit near black, max=${bronzeMax}`);
    } finally {
      setBundledLook('ore-dragon', null);
      setBundledLook('ore-bronze', null);
    }
  });

  it('sits every dungeon ore rock on the floor plane', async () => {
    const folders = {
      bronze: 'dungeon-rocks/bronze-rocks',
      iron: 'dungeon-rocks/iron-rocks',
      steel: 'dungeon-rocks/steel-rocks',
      mithril: 'dungeon-rocks/mithril-rocks',
      adamant: 'dungeon-rocks/adamant-rocks',
      runite: 'dungeon-rocks/rune-rocks',
      dragon: 'dungeon-rocks/dragon-rocks',
      essence: 'dungeon-rocks/essence',
    };
    for (const [id, folder] of Object.entries(folders)) {
      try {
        setBundledLook(`ore-${id}`, await loadFolder(folder));
      } catch {
        // Missing dump stays procedural and still has to sit on the floor.
      }
    }
    try {
      const built = buildDungeon();
      assert.equal(built.boulders.length, DUNGEON_BOULDERS.length);
      for (const boulder of built.boulders) {
        const visual = boulder.children.find((child) => child.name?.startsWith('ore-'));
        assert.ok(visual, boulder.name);
        visual.updateMatrixWorld(true);
        const box = measureVisibleBox(visual);
        assert.ok(
          Math.abs(box.min.y - DUNGEON_FLOOR_Y) < 0.02,
          `${boulder.name} should sit on the floor, minY=${box.min.y}`,
        );
      }
    } finally {
      for (const id of Object.keys(folders)) setBundledLook(`ore-${id}`, null);
    }
  });

  it('doubles essence size in the dungeon middle and seats a skeleton at the old spot', async () => {
    const essenceSpot = DUNGEON_BOULDERS.find((item) => item.id === 'essence');
    const adamant = DUNGEON_BOULDERS.find((item) => item.id === 'adamant');
    assert.equal(essenceSpot?.scale, 2);
    assert.ok(Math.abs(essenceSpot.x) < 1e-6);
    assert.ok(Math.abs(essenceSpot.z) < 1e-6);
    assert.ok(DUNGEON_REMAINS.some((spot) => (
      Math.abs(spot.x - ESSENCE_OLD_XZ.x) < 1e-6 && Math.abs(spot.z - ESSENCE_OLD_XZ.z) < 1e-6
    )));
    assert.ok(Math.hypot(essenceSpot.x - adamant.x, essenceSpot.z - adamant.z) > 2.4);
    for (const other of DUNGEON_BOULDERS.filter((item) => item.id !== 'essence')) {
      const dist = Math.hypot(essenceSpot.x - other.x, essenceSpot.z - other.z);
      assert.ok(dist > 2.4, `${other.id} too close to essence (${dist})`);
    }
    try {
      setBundledLook('ore-essence', await loadFolder('dungeon-rocks/essence'));
      setBundledLook('ore-bronze', await loadFolder('dungeon-rocks/bronze-rocks'));
      setBundledLook('skeleton', await loadFolder('skeleton'));
    } catch {
      // Procedural fallback still has to keep layout and 2× size.
    }
    try {
      const built = buildDungeon();
      const essence = built.boulders.find((item) => item.name === 'boulder-essence');
      const bronze = built.boulders.find((item) => item.name === 'boulder-bronze');
      assert.ok(essence && bronze);
      assert.ok(Math.abs(essence.position.x) < 1e-6);
      assert.ok(Math.abs(essence.position.z) < 1e-6);
      const essenceBox = measureVisibleBox(essence.children.find((child) => child.name === 'ore-essence'));
      const bronzeBox = measureVisibleBox(bronze.children.find((child) => child.name === 'ore-bronze'));
      const essenceSize = essenceBox.getSize(new THREE.Vector3());
      const bronzeSize = bronzeBox.getSize(new THREE.Vector3());
      const essenceMax = Math.max(essenceSize.x, essenceSize.y, essenceSize.z);
      const bronzeMax = Math.max(bronzeSize.x, bronzeSize.y, bronzeSize.z);
      assert.ok(essenceMax > bronzeMax * 1.6, `essence ${essenceMax} should be ~2× bronze ${bronzeMax}`);
      assert.ok(Math.abs(essenceBox.min.y - DUNGEON_FLOOR_Y) < 0.02, `essence minY=${essenceBox.min.y}`);
      let slumps = 0;
      let oldSpotSlump = 0;
      built.root.traverse((child) => {
        if (child.name !== 'skeleton') return;
        slumps += 1;
        if (Math.hypot(child.position.x - ESSENCE_OLD_XZ.x, child.position.z - ESSENCE_OLD_XZ.z) < 0.05) {
          oldSpotSlump += 1;
        }
      });
      if (slumps) {
        assert.equal(slumps, DUNGEON_REMAINS.length);
        assert.equal(oldSpotSlump, 1);
      }
      let essencePick = 0;
      built.root.traverse((child) => {
        if (child.userData?.kind === 'boulder' && child.userData?.materialId === 'essence') essencePick += 1;
      });
      assert.ok(essencePick >= 1);
    } finally {
      setBundledLook('ore-essence', null);
      setBundledLook('ore-bronze', null);
      setBundledLook('skeleton', null);
    }
  });

  it('sits a uniformly scaled dump on a world floor plane', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.scale.setScalar(0.05);
    mesh.position.set(0, 0.8, 0);
    const root = new THREE.Group();
    root.add(mesh);
    sitVisibleOnY(mesh, DUNGEON_FLOOR_Y);
    mesh.updateMatrixWorld(true);
    const box = measureVisibleBox(mesh);
    assert.ok(Math.abs(box.min.y - DUNGEON_FLOOR_Y) < 0.005, `minY=${box.min.y}`);
  });
});

describe('shop props', () => {
  it('seats the pickaxe head on the wooden haft and holds it in the right hand', () => {
    const pick = buildPickaxe();
    const haft = pick.getObjectByName('pickaxe-haft');
    const head = pick.getObjectByName('pickaxe-head');
    assert.ok(haft && head);
    const tip = new THREE.Vector3(0, 0.2, 0).applyEuler(haft.rotation).add(haft.position);
    const gap = tip.distanceTo(head.position);
    assert.ok(gap < 0.04, `head should sit on the shaft tip, gap=${gap}`);
    const keeper = buildShopkeeper();
    assert.equal(keeper.userData.pickaxe.parent, keeper.userData.hand);
  });

  it('keeps a climbable dungeon ladder pick for the walk-to-fade exit', () => {
    const ladder = buildDungeonLadder();
    assert.equal(ladder.name, 'ladder');
    assert.ok(Math.abs(ladder.rotation.y - Math.PI / 2) < 1e-6);
    let marked = 0;
    ladder.traverse((child) => {
      if (child.userData?.kind === 'ladder') marked += 1;
    });
    assert.ok(marked >= 1);
    const built = buildDungeon();
    assert.equal(built.ladder?.name, 'ladder');
    assert.ok(Math.abs(built.ladder.position.z - 0.4) < 1e-6);
    assert.ok(Math.abs(built.ladder.rotation.y - Math.PI / 2) < 1e-6);
  });

  it('keeps the shop door hinged open so the front doorway stays walkable', () => {
    const door = buildShopDoor();
    assert.equal(door.name, 'shop-door');
    assert.ok(door.userData.hinge);
    assert.ok(door.userData.hinge.rotation.y > 1.5);
    door.userData.hinge.rotation.y = 0.2;
    setDoorOpen(door, true, 1);
    assert.ok(door.userData.hinge.rotation.y > 1.4);
  });

  it('builds a clean anvil without a resting hammer', () => {
    const anvil = buildAnvil();
    let highBoxes = 0;
    anvil.traverse((child) => {
      if (child.isMesh && child.geometry?.type === 'BoxGeometry' && child.position.y >= 0.95) highBoxes += 1;
    });
    assert.equal(highBoxes, 0);
  });

  it('halves the anvil uniformly and keeps it on the floor', () => {
    assert.equal(ANVIL_WORLD_SCALE, 0.5);
    const anvil = buildAnvil();
    assert.ok(Math.abs(anvil.scale.x - anvil.scale.y) < 1e-6);
    assert.ok(Math.abs(anvil.scale.y - anvil.scale.z) < 1e-6);
    anvil.updateMatrixWorld(true);
    const box = measureVisibleBox(anvil);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `anvil should sit on the floor, minY=${box.min.y}`);
    assert.ok(size.y < 0.75, `anvil should be half height, y=${size.y}`);
    assert.ok(size.x < 0.7, `anvil should be half width, x=${size.x}`);
  });

  it('doubles the cooking range uniformly and keeps it on the floor', () => {
    assert.equal(RANGE_WORLD_SCALE, 2);
    const range = buildRange();
    assert.ok(Math.abs(range.scale.x - range.scale.y) < 1e-6);
    assert.ok(Math.abs(range.scale.y - range.scale.z) < 1e-6);
    assert.ok(Math.abs(range.scale.x - RANGE_WORLD_SCALE) < 1e-6);
    const box = measureVisibleBox(range);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `range should sit on the floor, minY=${box.min.y}`);
    assert.ok(box.max.y > 1.8, `range should be 2× tall, maxY=${box.max.y}`);
  });

  it('doubles the spinning wheel uniformly and keeps it on the floor', () => {
    assert.equal(WHEEL_WORLD_SCALE, 2);
    const wheel = buildSpinningWheel();
    assert.ok(Math.abs(wheel.scale.x - wheel.scale.y) < 1e-6);
    assert.ok(Math.abs(wheel.scale.y - wheel.scale.z) < 1e-6);
    assert.ok(Math.abs(wheel.scale.x - WHEEL_WORLD_SCALE) < 1e-6);
    const box = measureVisibleBox(wheel);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `wheel should sit on the floor, minY=${box.min.y}`);
    assert.ok(box.max.y > 1.2, `wheel should be 2× tall, maxY=${box.max.y}`);
  });

  it('keeps shop tables at the previous size on the floor', () => {
    const table = buildDefaultTable();
    const box = measureVisibleBox(table);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `table should sit on the floor, minY=${box.min.y}`);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(size.x > 1.2 && size.x < 1.6, `table should keep the pre-2× width, x=${size.x}`);
    assert.ok(size.z > 0.7 && size.z < 1.1, `table should keep the pre-2× depth, z=${size.z}`);
  });

  it('scales the chest to 60% and keeps it on the floor', () => {
    const chest = buildChest();
    assert.ok(Math.abs(chest.scale.x - 0.6) < 1e-6);
    chest.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(chest);
    assert.ok(box.min.y > -0.02 && box.min.y < 0.08);
  });

  it('gives the furnace a grey brick body like the range', () => {
    const furnace = buildFurnace();
    let brick = null;
    furnace.traverse((child) => {
      if (child.isMesh && child.material?.map && child.material?.color && !brick) {
        brick = child.material.color.getHex();
      }
    });
    assert.equal(brick, 0x8a9098);
  });
});
