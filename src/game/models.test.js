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
  buildGoblin,
  buildPickaxe,
  buildShopkeeper,
  measureVisibleBox,
  measureVisibleMeshHeight,
  proceduralPlayerFitHeight,
  setHeldTool,
  updateMinePose,
  updateWalkPose,
  wrapBundledProp,
  wrapImportedCharacter,
  wrapShopPlayer,
} from './models.js';
import { BUNDLED_PROP_FOLDERS, parseBundledPlayerBuffers, parseModelBuffer } from './upload.js';
import { pointHitsShop } from './layout.js';
import { buildFountain, buildFurnace, buildRat, buildShop, buildTree, mountFountainWater } from './shopbuild.js';

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
    const obj = readFileSync(join(modelsRoot, folder, `${folder}.obj`));
    const mtl = readFileSync(join(modelsRoot, folder, `${folder}.mtl`));
    return parseModelBuffer(
      obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
      `${folder}.obj`,
      { [`${folder}.mtl`]: mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
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
    for (const id of ['chest', 'furnace', 'range', 'rat', 'table', 'counter', 'tree', 'flowers', 'rock', 'fountain', 'skeleton']) {
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

  it('builds a clean anvil without a resting hammer', () => {
    const anvil = buildAnvil();
    let highBoxes = 0;
    anvil.traverse((child) => {
      if (child.isMesh && child.geometry?.type === 'BoxGeometry' && child.position.y >= 0.95) highBoxes += 1;
    });
    assert.equal(highBoxes, 0);
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
