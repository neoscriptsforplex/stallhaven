import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import './canvas-mock.js';
import * as THREE from 'three';
import {
  CUSTOMER_LOOKS,
  buildAdventurer,
  buildAnvil,
  buildChest,
  buildGoblin,
  buildPickaxe,
  buildShopkeeper,
  setHeldTool,
  updateMinePose,
  updateWalkPose,
  wrapImportedCharacter,
} from './models.js';
import { pointHitsShop } from './layout.js';
import { buildFurnace, buildRat, buildShop, buildTree } from './shopbuild.js';

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
