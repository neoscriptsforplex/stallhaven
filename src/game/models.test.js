import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
  wrapRiggedGoblin,
  GOBLIN_MODEL_SCALE,
  GOBLIN_WALK_SPEED,
  wrapRiggedRat,
  RAT_MODEL_SCALE,
  RAT_WALK_SPEED,
  RAT_WALK_UNIT_SPEED,
  wrapRiggedBuyer,
  BUYER_MODEL_SCALE,
  RIGGED_BUYER_MODELS,
  RIGGED_CLIP_FADE,
  setRiggedBuyer,
  getRiggedBuyer,
  clearRiggedBuyers,
  buildPickaxe,
  buildHeldTool,
  buildShopkeeper,
  measureVisibleBox,
  measureVisibleMeshHeight,
  proceduralPlayerFitHeight,
  setHeldTool,
  setGatherClip,
  updateMinePose,
  updateWalkPose,
  setBundledLook,
  buildWare,
  wareDisplayYaw,
  wrapBundledProp,
  wrapImportedCharacter,
  wrapRiggedShopkeeper,
  wrapShopPlayer,
  wrapUploadedPlayer,
  findNamedClip,
  playerOrientationHint,
  defaultPlayerWorldHeight,
  wrapBuyerDump,
  sitVisibleOnY,
  nextBuyerLookId,
  resetBuyerCycle,
  BUYER_DUMP_YAW,
  BUYER_FIT_HEIGHT,
  ANVIL_WORLD_SCALE,
} from './models.js';
import { BUYER_PACKS, BUYER_PACK_FOLDERS, CRAFT_ORE_FOLDERS, RECIPES, craftOreFolder, craftOreLookId } from './catalog.js';
import { BUNDLED_PROP_FOLDERS, FOUNTAIN_DUMP_REV, isDungeonRockDump, parseBundledPlayerBuffers, parseModelBuffer, prepareDungeonRockMaterials } from './upload.js';
import { LUKE_MODEL_FOLDERS } from './gearlooks.js';
import { cobblePathSpan, characterGroundY, EXPANSION_PADS, furnitureVisualYaw, gardenTreeSpots, OUTDOOR_GROUND_Y, OUTDOOR_TREE_SCALE, plantedTrunkRadius, pointHitsShop, ROOM_D, ROOM_W, roomCenter, shopDoorOpening, shopFloorFootprint, shopFloorTopY, SHOP_FURNITURE_FLOOR_Y, TRAPDOOR, TRAPDOOR_HOLE_CLEAR, TREE_SCALE_SPREAD, TREE_TRUNK_RADIUS, TREE_WALK_BLOCK, treeWalkBlock } from './layout.js';
import { RAT_DUMP_YAW } from './rats.js';
import { buildCauldron, buildDungeon, buildDungeonLadder, buildFletchingBench, buildFlaxPlant, buildFountain, buildFurnace, buildLoom, buildPotterWheel, buildRange, buildRat, buildShop, buildSpinningWheel, buildTorch, buildTree, DUNGEON_BOULDERS, DUNGEON_FLOOR_Y, DUNGEON_REMAINS, DUNGEON_ROCK_ALBEDO_LIFT, DUNGEON_ROCK_AMBIENT, DUNGEON_ROCK_EMIT, DUNGEON_ROCK_SINK, DUNGEON_WALL_H, ESSENCE_OLD_XZ, dungeonFloorSurfaceY, dungeonRockContactMins, measureShopFloorPieces, measureShopFloorTop, PATH_COBBLE_SCALE, RANGE_PLATE_FRAC, RANGE_WORLD_SCALE, SHOP_WALL_REPEAT, shopWallTextureUrls, WHEEL_WORLD_SCALE, mountFountainWater, seatTreeOnGround } from './shopbuild.js';
import { gardenObstacles } from './nav.js';
import { GATHER_CONTACT, chopStandDistance, gatherStandCandidates, mineStandDistance, treeTrunkOffset } from './interact.js';

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

  it('cycles buyer dumps round-robin per traveler type', () => {
    resetBuyerCycle();
    assert.equal(BUYER_PACKS.hedgemage.length, 6);
    assert.equal(BUYER_PACKS.pilgrim.length, 5);
    assert.equal(BUYER_PACKS.ranger.length, 2);
    assert.equal(BUYER_PACKS.mercenary.length, 2);
    const first = nextBuyerLookId('hedgemage');
    for (let i = 1; i < BUYER_PACKS.hedgemage.length; i += 1) nextBuyerLookId('hedgemage');
    assert.equal(nextBuyerLookId('hedgemage'), first);
    assert.equal(nextBuyerLookId('kingroald'), null);
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    for (const item of BUYER_PACK_FOLDERS) {
      assert.equal(byId[item.id], item.folder);
      const slug = item.folder.split('/').pop();
      const folderPath = join(dirname(fileURLToPath(import.meta.url)), '../../public/models', item.folder);
      assert.equal(existsSync(join(folderPath, `${slug}.obj`)), true, `${item.folder}.obj`);
      assert.equal(existsSync(join(folderPath, `${slug}.mtl`)), true, `${item.folder}.mtl`);
    }
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

  it('plays Walk and Idle on the rigged yard goblin at the player scale', async () => {
    const glb = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/models/npc/goblin_rigged.glb'));
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
        '',
        resolve,
        reject,
      );
    });
    const goblin = wrapRiggedGoblin(gltf);
    assert.equal(goblin.name, 'goblin');
    assert.equal(goblin.userData.pick?.userData.kind, 'goblin');
    assert.ok(Math.abs(goblin.userData.modelScale - GOBLIN_MODEL_SCALE) < 1e-9);
    const loco = goblin.userData.clipLocomotion;
    assert.ok(Math.abs(loco.walk.getClip().duration - 0.84) < 1e-3);
    assert.ok(Math.abs(loco.idle.getClip().duration - 3) < 1e-3);
    assert.equal(loco.walkStride, GOBLIN_WALK_SPEED);
    let skinned = 0;
    goblin.traverse((child) => {
      if (!child.isSkinnedMesh) return;
      skinned += 1;
      assert.equal(child.frustumCulled, false);
    });
    assert.equal(skinned, 1);
    loco.speed = 0.72;
    updateWalkPose(goblin, true, 0.05, 1);
    assert.equal(loco.mode, 'walk');
    assert.ok(Math.abs(loco.walk.timeScale - (0.72 / GOBLIN_WALK_SPEED)) < 1e-6);
    const box = new THREE.Box3().setFromObject(goblin);
    const height = box.max.y - box.min.y;
    assert.ok(Math.abs(height - 1.319 * GOBLIN_MODEL_SCALE) < 0.02, `height ${height}`);
  });

  it('plays Walk and Idle on the rigged dungeon rat at the current rat length', async () => {
    const glb = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/models/npc/rat_rigged.glb'));
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
        '',
        resolve,
        reject,
      );
    });
    const rat = wrapRiggedRat(gltf);
    assert.equal(rat.name, 'rat');
    assert.equal(rat.userData.pick, undefined);
    assert.ok(Math.abs(rat.userData.modelScale - RAT_MODEL_SCALE) < 1e-9);
    assert.ok(Math.abs(RAT_MODEL_SCALE - 0.863) > 0.1, 'rat scale is not the goblin convention');
    const loco = rat.userData.clipLocomotion;
    assert.ok(Math.abs(loco.walk.getClip().duration - 0.4) < 1e-3);
    assert.ok(Math.abs(loco.idle.getClip().duration - 4) < 1e-3);
    assert.equal(loco.walkStride, RAT_WALK_SPEED);
    assert.ok(Math.abs(RAT_WALK_SPEED - (RAT_WALK_UNIT_SPEED * RAT_MODEL_SCALE)) < 1e-12);
    let skinned = 0;
    let bones = 0;
    rat.traverse((child) => {
      if (child.isBone) bones += 1;
      if (!child.isSkinnedMesh) return;
      skinned += 1;
      assert.equal(child.frustumCulled, false);
    });
    assert.equal(skinned, 1);
    assert.equal(bones, 24);
    loco.speed = 0.52;
    updateWalkPose(rat, true, 0.05, 1);
    assert.equal(loco.mode, 'walk');
    assert.ok(Math.abs(loco.walk.timeScale - (0.52 / RAT_WALK_SPEED)) < 1e-6);
    updateWalkPose(rat, false, 0.2, 1.2);
    assert.equal(loco.mode, 'idle');
    const box = new THREE.Box3().setFromObject(rat);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.z - 0.3764958443895918) < 0.01, `length ${size.z}`);
    assert.ok(Math.abs(size.y - 0.11584158338694467 * RAT_MODEL_SCALE) < 0.01, `height ${size.y}`);
    const built = buildDungeon({ riggedRat: gltf });
    assert.equal(built.rats.length, 4);
    for (const live of built.rats) {
      assert.equal(live.userData.clipLocomotion.walkStride, RAT_WALK_SPEED);
      assert.equal(live.userData.groundY, 0.06);
      assert.equal(live.userData.pick, undefined);
    }
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

  it('paints outdoor grass as the flat pre-mottle green', () => {
    const shop = buildShop([]).root;
    let ground = null;
    shop.traverse((child) => {
      if (child.name === 'grass-ground') ground = child;
    });
    assert.ok(ground, 'garden should have a grass ground plane');
    assert.equal(Boolean(ground.material?.map), false);
    assert.equal(ground.material?.color?.getHex?.(), 0x4f7a3a);
  });

  it('tiles only the outdoor cobble path about 3× finer than shop wall stone', () => {
    assert.equal(PATH_COBBLE_SCALE, 3);
    const shop = buildShop([]).root;
    const span = cobblePathSpan([]);
    const pathW = span.maxX - span.minX;
    const want = pathW * (4.2 / ROOM_W) * PATH_COBBLE_SCALE;
    let pathPlanes = 0;
    let pathRing = 0;
    let wallSlabs = 0;
    let shopBrick = 0;
    shop.traverse((child) => {
      const map = child.material?.map;
      if (!map?.repeat) return;
      if (child.userData?.pathCobble && child.geometry?.type === 'PlaneGeometry') {
        assert.ok(Math.abs(map.repeat.x - want) < 1e-6, `path repeat.x ${map.repeat.x} vs ${want}`);
        pathPlanes += 1;
      }
      if (child.userData?.pathCobble && child.geometry?.type === 'RingGeometry') {
        const ringWant = 1.42 * 2 * (4.2 / ROOM_W) * PATH_COBBLE_SCALE;
        assert.ok(Math.abs(map.repeat.x - ringWant) < 1e-6, `ring repeat.x ${map.repeat.x} vs ${ringWant}`);
        pathRing += 1;
      }
      if (child.userData?.shopWall) {
        assert.equal(map.userData?.kind, 'shop-wall');
        shopBrick += 1;
      } else if (!child.userData?.pathCobble && Math.abs(map.repeat.y - 2.6) < 1e-6) {
        wallSlabs += 1;
      }
    });
    assert.ok(pathPlanes >= 1, 'path should have cobble planes');
    assert.ok(pathRing >= 1, 'fountain apron ring should use the same finer cobble');
    assert.equal(wallSlabs, 0);
    assert.ok(shopBrick >= 1, 'shop walls should use the stone-brick tile');

    const dungeon = buildDungeon().root;
    let dungeonFloor = 0;
    dungeon.traverse((child) => {
      const map = child.material?.map;
      if (!map?.repeat) return;
      assert.equal(Boolean(child.userData?.pathCobble), false);
      if (Math.abs(map.repeat.x - 6.5) < 1e-6 && Math.abs(map.repeat.y - 5.2) < 1e-6) dungeonFloor += 1;
    });
    assert.ok(dungeonFloor >= 1, 'dungeon floor cobble scale should stay unchanged');
    dungeon.traverse((child) => {
      assert.notEqual(child.material?.map?.userData?.kind, 'shop-wall');
      assert.notEqual(child.userData?.shopWall, true);
    });
  });

  it('tiles shop walls and gables with the stone brick at one repeat per metre', () => {
    assert.equal(SHOP_WALL_REPEAT, 1);
    const urls = shopWallTextureUrls();
    assert.ok(urls.some((url) => url.endsWith('textures/shop_wall_512.png')));
    assert.ok(urls.some((url) => url.includes('public/textures/shop_wall_512.png')));
    const png = join(dirname(fileURLToPath(import.meta.url)), '../../public/textures/shop_wall_512.png');
    assert.equal(existsSync(png), true);

    const assertBrickFaces = (mesh) => {
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      const uv = geo.getAttribute('uv');
      const index = geo.getIndex();
      assert.ok(index, `${mesh.name || 'wall'} should stay an indexed box`);
      const map = mesh.material?.map;
      assert.equal(map?.userData?.kind, 'shop-wall');
      assert.equal(map.wrapS, THREE.RepeatWrapping);
      assert.equal(map.wrapT, THREE.RepeatWrapping);
      assert.equal(map.colorSpace, THREE.SRGBColorSpace);
      assert.equal(map.anisotropy, 4);
      assert.equal(map.generateMipmaps, true);
      assert.equal(Math.abs(map.repeat.x - 1) < 1e-6 && Math.abs(map.repeat.y - 1) < 1e-6, true);
      for (let f = 0; f < index.count; f += 6) {
        const ids = new Set();
        for (let k = 0; k < 6; k += 1) ids.add(index.getX(f + k));
        let minU = Infinity;
        let maxU = -Infinity;
        let minV = Infinity;
        let maxV = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const i of ids) {
          minU = Math.min(minU, uv.getX(i));
          maxU = Math.max(maxU, uv.getX(i));
          minV = Math.min(minV, uv.getY(i));
          maxV = Math.max(maxV, uv.getY(i));
          minX = Math.min(minX, pos.getX(i));
          maxX = Math.max(maxX, pos.getX(i));
          minY = Math.min(minY, pos.getY(i));
          maxY = Math.max(maxY, pos.getY(i));
          minZ = Math.min(minZ, pos.getZ(i));
          maxZ = Math.max(maxZ, pos.getZ(i));
        }
        const face = [maxX - minX, maxY - minY, maxZ - minZ].sort((a, b) => b - a);
        const mapped = [maxU - minU, maxV - minV].sort((a, b) => b - a);
        assert.ok(Math.abs(mapped[0] - face[0] * SHOP_WALL_REPEAT) < 1e-4, `u span ${mapped[0]} vs ${face[0]}`);
        assert.ok(Math.abs(mapped[1] - face[1] * SHOP_WALL_REPEAT) < 1e-4, `v span ${mapped[1]} vs ${face[1]}`);
      }
    };

    const originWalls = [];
    const origin = buildShop([]);
    origin.root.traverse((child) => {
      if (child.userData?.shopWall) originWalls.push(child);
    });
    assert.ok(originWalls.length >= 8, `expected cut wall slabs, got ${originWalls.length}`);
    for (const mesh of originWalls) assertBrickFaces(mesh);

    let gables = 0;
    origin.roofs.traverse((child) => {
      if (child.name !== 'roof-gable') return;
      gables += 1;
      const geo = child.geometry;
      const pos = geo.getAttribute('position');
      const uv = geo.getAttribute('uv');
      const map = child.material?.map;
      assert.equal(map?.userData?.kind, 'shop-wall');
      assert.equal(map.wrapS, THREE.RepeatWrapping);
      assert.equal(map.wrapT, THREE.RepeatWrapping);
      assert.equal(map.colorSpace, THREE.SRGBColorSpace);
      assert.equal(map.anisotropy, 4);
      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < pos.count; i += 1) {
        minU = Math.min(minU, uv.getX(i));
        maxU = Math.max(maxU, uv.getX(i));
        minV = Math.min(minV, uv.getY(i));
        maxV = Math.max(maxV, uv.getY(i));
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
        minY = Math.min(minY, pos.getY(i));
        maxY = Math.max(maxY, pos.getY(i));
      }
      assert.ok(Math.abs((maxU - minU) - (maxX - minX) * SHOP_WALL_REPEAT) < 1e-4);
      assert.ok(Math.abs((maxV - minV) - (maxY - minY) * SHOP_WALL_REPEAT) < 1e-4);
    });
    assert.ok(gables >= 2, `expected front and side gables, got ${gables}`);

    for (const ids of [['left'], ['right'], ['back'], ['left', 'back']]) {
      const built = buildShop(ids);
      let walls = 0;
      let rooms = 0;
      built.root.traverse((child) => {
        if (!child.userData?.shopWall) return;
        walls += 1;
        assertBrickFaces(child);
      });
      built.roofs.traverse((child) => {
        if (child.userData?.isRoof && child.children?.length) rooms += 1;
      });
      assert.ok(walls > originWalls.length, `${ids.join('+')} should add expansion walls, got ${walls}`);
      assert.ok(rooms >= ids.length + 1, `${ids.join('+')} roofs ${rooms}`);
    }
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

  it('builds shop boards whose top is the walkable floor', () => {
    const shop = buildShop(['left']).root;
    const top = measureShopFloorTop(shop);
    assert.ok(Number.isFinite(top), 'shop should have floorboards');
    assert.ok(Math.abs(top - shopFloorTopY()) < 1e-4, `mesh top ${top} vs config ${shopFloorTopY()}`);
    const feet = [shopFloorFootprint(0, 0), shopFloorFootprint(-1, 0)];
    let boards = 0;
    let maxZ = -Infinity;
    shop.traverse((child) => {
      if (!child.isMesh || (child.userData?.shopFloor !== 'plank' && child.userData?.shopFloor !== 'slab')) return;
      boards += 1;
      const box = new THREE.Box3().setFromObject(child);
      if (child.userData.shopFloor === 'plank') maxZ = Math.max(maxZ, box.max.z);
      const inside = feet.some((foot) => (
        box.min.x >= foot.minX - 1e-3
        && box.max.x <= foot.maxX + 1e-3
        && box.min.z >= foot.minZ - 1e-3
        && box.max.z <= foot.maxZ + 1e-3
      ));
      assert.ok(inside, `floor mesh outside the walk area z ${box.min.z}..${box.max.z}`);
    });
    assert.ok(boards > 10);
    assert.ok(Math.abs(maxZ - shopFloorFootprint(0, 0).maxZ) < 1e-3, `lip ${maxZ}`);
  });

  it('keeps the storefront lintel underside on the door opening', () => {
    const shop = buildShop([]).root;
    const opening = shopDoorOpening();
    let lintel = null;
    shop.traverse((child) => {
      if (!child.isMesh) return;
      const height = child.geometry?.parameters?.height;
      const width = child.geometry?.parameters?.width;
      if (height !== 0.38 || !(width > 1.2)) return;
      if (Math.abs(child.position.y - 2.52) > 1e-6) return;
      lintel = child;
    });
    assert.ok(lintel, 'origin shop should include the timber lintel');
    const bottom = lintel.position.y - lintel.geometry.parameters.height / 2;
    assert.ok(Math.abs(bottom - opening.topY) < 1e-6, `lintel underside ${bottom}`);
  });

  it('keeps the red awning outside the room and keeps the inside timber and fascia', () => {
    const front = roomCenter(0, 0);
    const interiorZ = front.z + ROOM_D / 2 - 0.08;
    for (const ids of [[], ['left', 'right', 'back']]) {
      const shop = buildShop(ids).root;
      shop.updateMatrixWorld(true);
      let awnings = 0;
      let join = false;
      let fascia = false;
      let cream = 0;
      shop.traverse((child) => {
        if (!child.isMesh || child.geometry?.type !== 'BoxGeometry') return;
        const { width, height } = child.geometry.parameters;
        const color = child.material?.color?.getHex?.();
        if (color === 0x8b4336 && width > 7) {
          awnings += 1;
          const box = new THREE.Box3().setFromObject(child);
          assert.ok(box.min.z >= interiorZ - 0.01, `awning enters the room at z=${box.min.z}`);
        }
        if (width > ROOM_W && height > 0.2 && Math.abs(child.position.y - 2.64) < 0.05) join = true;
        if (width > ROOM_W && height === 0.16 && Math.abs(child.position.y - 2.78) < 1e-6) fascia = true;
        if (color === 0xead3ae && width > 7) cream += 1;
      });
      assert.equal(awnings, 1, `origin awning only for ${ids.join('+') || 'origin'}`);
      assert.equal(join, true);
      assert.equal(fascia, true);
      assert.equal(cream, 2);
    }
  });

  it('builds a floor piece for every expansion room', () => {
    const ids = EXPANSION_PADS.map((pad) => pad.id);
    const pieces = measureShopFloorPieces(buildShop(ids).root);
    const rooms = [{ id: 'origin', gx: 0, gz: 0 }, ...EXPANSION_PADS];
    assert.equal(pieces.length, rooms.length);
    for (const room of rooms) {
      const piece = pieces.find((item) => item.gx === room.gx && item.gz === room.gz);
      assert.ok(piece, room.id);
      assert.ok(Math.abs(piece.top - shopFloorTopY()) < 1e-4, `${room.id} top ${piece.top}`);
      const spot = roomCenter(room.gx, room.gz);
      assert.ok(spot.x > piece.minX && spot.x < piece.maxX && spot.z > piece.minZ && spot.z < piece.maxZ);
      assert.ok(Math.abs(characterGroundY(spot.x, spot.z, ids) - piece.top) < 1e-4, room.id);
      if (room.id !== 'origin') {
        assert.equal(characterGroundY(spot.x, spot.z, []), OUTDOOR_GROUND_Y, `${room.id} after reset`);
      }
    }
    assert.ok(Math.abs(measureShopFloorTop(buildShop([]).root) - shopFloorTopY()) < 1e-4);
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
    const bones = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffff00 }),
    );
    bones.name = 'SkeletonHelper';
    source.add(bones);
    const wrapped = wrapImportedCharacter(source, { name: 'hero', label: 'You' });
    assert.ok(wrapped.userData.rig?.legL);
    assert.ok(wrapped.userData.rig?.legR);
    assert.ok(wrapped.userData.walkMode);
    const rest = wrapped.userData.rig.legL.rotation.x;
    updateWalkPose(wrapped, true, 0.2, 1);
    updateWalkPose(wrapped, true, 0.2, 1);
    assert.notEqual(wrapped.userData.rig.legL.rotation.x, rest);
    assert.ok(wrapped.userData.walkPhase > 0);
    const floor = shopFloorTopY();
    wrapped.userData.groundY = floor;
    updateWalkPose(wrapped, true, 0.05, 1);
    assert.ok(wrapped.position.y >= floor - 1e-6, `walk feet ${wrapped.position.y}`);
    for (let i = 0; i < 12; i += 1) updateWalkPose(wrapped, false, 0.2, 1);
    assert.ok(Math.abs(wrapped.position.y - floor) < 0.01, `settled feet ${wrapped.position.y}`);
    const countSticks = (root) => {
      let n = 0;
      root.traverse((child) => {
        if ((child.isLine || child.isLineSegments || child.isSkeletonHelper) && child.visible !== false) n += 1;
        if (child.material?.wireframe && child.visible !== false) n += 1;
        if (child.isMesh && String(child.name || '').startsWith('proxy') && child.visible !== false) n += 1;
        if (child.isMesh && child.geometry?.type === 'CylinderGeometry' && child.material?.opacity < 1 && child.visible !== false) {
          n += 1;
        }
      });
      return n;
    };
    assert.equal(countSticks(wrapped), 0, 'imported walk must not draw skeleton/proxy wireframe');
    const buyer = wrapImportedCharacter(source, { name: 'ranger', label: 'Ranger', speech: true, pickKind: 'customer' });
    const goblin = wrapImportedCharacter(source, { name: 'goblin', label: false, pickKind: 'goblin' });
    assert.equal(countSticks(buyer), 0, 'buyers must hide walk bone lines');
    assert.equal(countSticks(goblin), 0, 'goblins must hide walk bone lines');
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
    assert.ok(wrapped.userData.hatchet);
    setHeldTool(wrapped, 'hatchet');
    assert.equal(wrapped.userData.pickaxe.visible, false);
    assert.equal(wrapped.userData.hatchet.visible, true);
    setHeldTool(wrapped, 'pickaxe');
    assert.equal(wrapped.userData.hatchet.visible, false);
    assert.equal(wrapped.userData.pickaxe.visible, true);
    const rest = wrapped.userData.rig.armR.rotation.x;
    updateMinePose(wrapped, 0.2, 0.4);
    assert.notEqual(wrapped.userData.rig.armR.rotation.x, rest);
  });

  it('plants a rigged clip on the shop floor instead of y=0', () => {
    const action = () => ({
      enabled: true,
      timeScale: 1,
      setEffectiveWeight() {},
      reset() { return this; },
      play() {},
      crossFadeTo() {},
    });
    const mesh = new THREE.Group();
    mesh.userData.clipLocomotion = {
      mode: 'walk',
      walk: action(),
      idle: action(),
      mixer: { update() {} },
      modelScale: 1,
      speed: 1.2,
    };
    mesh.userData.groundY = shopFloorTopY();
    mesh.position.y = 0;
    updateWalkPose(mesh, true, 0.016, 1);
    assert.ok(Math.abs(mesh.position.y - shopFloorTopY()) < 1e-6);
    mesh.position.y = 0;
    updateMinePose(mesh, 0.016, 1);
    assert.ok(Math.abs(mesh.position.y - shopFloorTopY()) < 1e-6);
    mesh.userData.groundY = 0;
    updateWalkPose(mesh, false, 0.016, 1);
    assert.ok(Math.abs(mesh.position.y) < 1e-6);
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

function bodyBox(root, name = 'uploaded-player') {
  const visual = root.getObjectByName(name) ?? root;
  visual.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const gearName = /pickaxe|hatchet|chef-hat|importedGrip|hammer/i;
  visual.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    let node = child;
    while (node && node !== visual) {
      if (gearName.test(node.name || '')) return;
      node = node.parent;
    }
    box.expandByObject(child);
  });
  return box;
}

describe('uploaded player model', () => {
  it('matches Walk and Idle clips by partial name', () => {
    const clips = [
      new THREE.AnimationClip('Walking_Forward', 1, []),
      new THREE.AnimationClip('IdleBreath', 1, []),
      new THREE.AnimationClip('Mine', 1, []),
    ];
    assert.equal(findNamedClip(clips, ['walk']).name, 'Walking_Forward');
    assert.equal(findNamedClip(clips, ['idle']).name, 'IdleBreath');
    assert.equal(findNamedClip(clips, ['mine']).name, 'Mine');
    assert.equal(findNamedClip(clips, ['run']), null);
  });

  it('fits a static mesh to the default height, grounds the feet, and bobs while walking', () => {
    const source = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2, 0.3),
      new THREE.MeshBasicMaterial(),
    );
    torso.position.y = 0.2;
    torso.name = 'torso';
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial());
    nose.position.set(0.4, 1.4, 0.5);
    nose.name = 'nose';
    source.add(torso, nose);
    const height = defaultPlayerWorldHeight();
    const wrapped = wrapUploadedPlayer(source, { height, chefHatOn: false });
    wrapped.updateMatrixWorld(true);
    const box = bodyBox(wrapped);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(size.y - height) < 0.02, `height ${size.y} vs ${height}`);
    assert.ok(Math.abs(box.min.y) < 0.02, `feet ${box.min.y}`);
    assert.ok(Math.abs(center.x) < 0.02, `center x ${center.x}`);
    assert.ok(Math.abs(center.z) < 0.02, `center z ${center.z}`);
    assert.equal(wrapped.userData.clipLocomotion, undefined);
    assert.ok(wrapped.userData.hand);
    assert.ok(wrapped.userData.chefHat);
    assert.notEqual(wrapped.userData.hand.parent?.name, 'Hand_R');
    const nosePos = new THREE.Vector3();
    const torsoPos = new THREE.Vector3();
    wrapped.getObjectByName('nose').getWorldPosition(nosePos);
    wrapped.getObjectByName('torso').getWorldPosition(torsoPos);
    assert.ok(nosePos.z > torsoPos.z, 'default facing stays +Z');
    updateWalkPose(wrapped, true, 0.2, 1);
    assert.ok(wrapped.position.y > 0.01, 'a model with no clips bobs while walking');
  });

  it('turns 180 degrees only when asked, and flags a Z-up box without guessing', () => {
    const lying = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 2), new THREE.MeshBasicMaterial());
    const hint = playerOrientationHint(lying);
    assert.equal(hint.zUp, true);
    assert.equal(hint.suggestRotate, true);
    const plain = wrapUploadedPlayer(lying, { height: 1.7 });
    assert.equal(plain.userData.yaw180, false);
    assert.equal(plain.getObjectByName('uploaded-turn').rotation.y, 0);

    const source = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), new THREE.MeshBasicMaterial());
    torso.position.y = 0.8;
    torso.name = 'torso';
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial());
    nose.position.set(0, 1.4, 0.45);
    nose.name = 'nose';
    source.add(torso, nose);
    const turned = wrapUploadedPlayer(source, { yaw180: true, height: 1.7 });
    turned.updateMatrixWorld(true);
    const nosePos = new THREE.Vector3();
    const torsoPos = new THREE.Vector3();
    turned.getObjectByName('nose').getWorldPosition(nosePos);
    turned.getObjectByName('torso').getWorldPosition(torsoPos);
    assert.ok(nosePos.z < torsoPos.z, 'Rotate 180° faces the nose toward -Z');
  });

  it('plays the rigged Walk clip at the same stride scale and keeps tools on Hand_R', async () => {
    const glb = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/models/player/character_rigged.glb'));
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
        '',
        resolve,
        reject,
      );
    });
    const height = defaultPlayerWorldHeight();
    const wrapped = wrapUploadedPlayer(gltf.scene, {
      animations: gltf.animations,
      height,
      chefHatOn: true,
    });
    const rigged = wrapRiggedShopkeeper(gltf, { height, chefHatOn: false });
    wrapped.updateMatrixWorld(true);
    rigged.updateMatrixWorld(true);
    const uploadedBox = bodyBox(wrapped);
    const riggedBox = bodyBox(rigged, 'rigged-player');
    const uploadedSize = uploadedBox.getSize(new THREE.Vector3());
    const riggedSize = riggedBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(uploadedSize.y - riggedSize.y) < 0.03, `height ${uploadedSize.y} vs rig ${riggedSize.y}`);
    assert.ok(Math.abs(uploadedBox.min.y) < 0.03, `feet ${uploadedBox.min.y}`);
    const center = uploadedBox.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(center.x) < 0.04 && Math.abs(center.z) < 0.04, `center ${center.x}, ${center.z}`);
    assert.equal(playerOrientationHint(gltf.scene).suggestRotate, false);
    assert.equal(wrapped.userData.hand.parent?.name, 'Hand_R');
    assert.equal(wrapped.userData.chefHat.parent?.name, 'Head');
    assert.equal(wrapped.userData.chefHat.visible, true);
    const loco = wrapped.userData.clipLocomotion;
    assert.ok(loco.walk && loco.idle);
    assert.equal(loco.mode, 'idle');
    loco.speed = 1.85;
    updateWalkPose(wrapped, true, 0.05, 1);
    const walkScale = 1.85 / (0.834 * loco.modelScale);
    assert.equal(loco.mode, 'walk');
    assert.ok(Math.abs(loco.walk.timeScale - walkScale) < 1e-6);
    assert.ok(Math.abs(wrapped.position.y) < 1e-6, 'clip walking stays on the ground');
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
      `${folder}/${base}.obj`,
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
    for (const id of ['chest', 'furnace', 'range', 'anvil', 'cauldron', 'door', 'ladder', 'torch', 'trapdoor', 'wheel', 'rat', 'table', 'counter', 'tree', 'flowers', 'flax-plant', 'rock', 'fountain', 'skeleton']) {
      assert.ok(ids.includes(id), id);
    }
    for (const id of ['rune-air', 'rune-water', 'rune-earth', 'rune-fire', 'ore-bronze', 'ore-iron', 'ore-steel', 'ore-mithril', 'ore-adamant', 'ore-runite', 'ore-dragon', 'ore-essence', 'ore-clay']) {
      assert.ok(ids.includes(id), id);
    }
    for (const id of ['food-bread', 'food-pizza', 'food-cake', 'food-pie', 'food-fish-pie', 'food-salmon', 'food-lobster', 'food-chocolate-cake', 'food-monkfish', 'food-curry', 'food-shark', 'food-summer-pie', 'food-anglerfish']) {
      assert.ok(ids.includes(id), id);
    }
    for (const id of ['craft-ore-bronze', 'craft-ore-iron', 'craft-ore-steel', 'craft-ore-mithril', 'craft-ore-adamant', 'craft-ore-runite', 'craft-ore-dragon']) {
      assert.ok(ids.includes(id), id);
    }
    for (const item of BUYER_PACK_FOLDERS) {
      assert.ok(ids.includes(item.id), item.id);
    }
    assert.ok(ids.includes('goblin'));
  });

  it('doubles a bundled outdoor tree on every axis and keeps it grounded', async () => {
    const dump = await loadFolder('tree');
    setBundledLook('tree', dump);
    try {
      const tree = buildTree(1);
      const visual = tree.getObjectByName('pine-visual');
      assert.ok(Math.abs(visual.scale.x - visual.scale.y) < 1e-6, 'bundled pine should stay uniform');
      assert.ok(Math.abs(visual.scale.y - visual.scale.z) < 1e-6);
      const big = measureVisibleBox(tree).getSize(new THREE.Vector3());
      const half = measureVisibleBox(buildTree(0.5)).getSize(new THREE.Vector3());
      tree.position.set(-2.4, 0, 6.1);
      tree.rotation.y = 0.7;
      tree.scale.setScalar(1 + TREE_SCALE_SPREAD);
      seatTreeOnGround(tree);
      const box = measureVisibleBox(tree);
      assert.ok(box.min.y < -0.02 && box.min.y > -0.05, `bundled roots should sink into the grass, minY=${box.min.y}`);
      assert.ok(half.y > 1.4 && half.y < 3.2, `half-scale pine should stay the old size, got ${half.y}`);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(
          Math.abs(big[axis] - half[axis] * OUTDOOR_TREE_SCALE) < 0.08,
          `${axis} ${big[axis]} vs ${half[axis]}`,
        );
      }
      assert.ok(big.x > half.x * 1.8 && big.z > half.z * 1.8, `crown should widen, got ${big.x} x ${big.z}`);
    } finally {
      setBundledLook('tree', null);
    }
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

    setBundledLook('flax-plant', null);
    const fallbackFlax = buildFlaxPlant();
    assert.equal(fallbackFlax.userData.flaxProcedural, true);
    const flaxWant = measureVisibleBox(fallbackFlax).getSize(new THREE.Vector3()).y;
    assert.ok(flaxWant >= 0.45 && flaxWant <= 0.7, `procedural flax height ${flaxWant}`);
    setBundledLook('flax-plant', await loadFolder('flax'));
    const flaxPlant = buildFlaxPlant();
    assert.equal(flaxPlant.userData.flaxProcedural, false);
    assertUniform(flaxPlant);
    assertGrounded(flaxPlant);
    const flaxSize = measureVisibleBox(flaxPlant).getSize(new THREE.Vector3());
    assert.ok(Math.abs(flaxSize.y - flaxWant) < 0.08, `flax height ${flaxSize.y} vs ${flaxWant}`);
    assert.ok(Math.max(flaxSize.x, flaxSize.z) < 1.05, `flax footprint ${flaxSize.x}×${flaxSize.z}`);
    setBundledLook('flax-plant', null);

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

  it('force-replaces the outdoor fountain with the Blender dump and keeps its footprint', async () => {
    const objPath = join(modelsRoot, 'fountain', 'fountain.obj');
    const objText = readFileSync(objPath, 'utf8');
    assert.match(objText, /Blender/);
    assert.match(objText, /Object_Fountain_2026-09-12/);
    const sha = createHash('sha256').update(readFileSync(objPath)).digest('hex');
    assert.ok(sha.startsWith('4e9b2aee804dc814'), `fountain.obj sha ${sha.slice(0, 16)}`);
    assert.match(FOUNTAIN_DUMP_REV, /4e9b2aee/);
    const fountainEntry = BUNDLED_PROP_FOLDERS.find((item) => item.id === 'fountain');
    assert.equal(fountainEntry?.folder, 'fountain');
    assert.equal(fountainEntry?.rev, FOUNTAIN_DUMP_REV);
    const bundled = await loadFolder('fountain');
    setBundledLook('fountain', bundled);
    try {
      const live = buildFountain();
      const body = live.getObjectByName('fountain-body');
      assert.ok(body, 'live fountain should wrap the dumped body, not a procedural stand-in');
      let dumpedMeshes = 0;
      body.traverse((child) => {
        if (child.isMesh && (child.geometry?.getAttribute?.('position')?.count ?? 0) > 80) dumpedMeshes += 1;
      });
      assert.ok(dumpedMeshes >= 1, `dumped fountain mesh missing, count=${dumpedMeshes}`);
      const liveBox = measureVisibleBox(live);
      const liveSize = liveBox.getSize(new THREE.Vector3());
      setBundledLook('fountain', null);
      const proc = buildFountain();
      const procSize = measureVisibleBox(proc).getSize(new THREE.Vector3());
      assert.ok(Math.abs(liveSize.y - procSize.y) < 0.2, `height should match current fountain, live=${liveSize.y} proc=${procSize.y}`);
      assert.ok(liveBox.min.y > -0.08 && liveBox.min.y < 0.1, `fountain should sit on the ground, minY=${liveBox.min.y}`);
    } finally {
      setBundledLook('fountain', null);
    }
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
      const hinge = door.userData.hinge;
      const leaf = door.getObjectByName('door-leaf');
      assert.equal(hinge.position.x, -0.58);
      assert.equal(hinge.position.y, 0);
      assert.equal(hinge.position.z, 3.4);
      assert.ok(Math.abs(leaf.scale.x - leaf.scale.z) < 1e-4);
      const opening = shopDoorOpening();
      assert.ok(Math.abs(leaf.scale.y / leaf.scale.x - opening.height / 2.08) < 0.02);
      hinge.rotation.y = 0;
      door.updateMatrixWorld(true);
      const box = measureVisibleBox(leaf);
      assert.ok(Math.abs(box.min.y - opening.floorY) < 0.02, `bottom ${box.min.y}`);
      assert.ok(Math.abs(box.max.y - opening.topY) < 0.02, `top ${box.max.y}`);
      const fitted = wrapBundledProp(
        bundled,
        new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.08, 0.1)),
        { name: 'door-leaf', fit: 'max' },
      );
      const want = measureVisibleBox(fitted);
      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;
      assert.ok(Math.abs(width - (want.max.x - want.min.x)) < 0.03, `width ${width}`);
      assert.ok(Math.abs(depth - (want.max.z - want.min.z)) < 0.03, `depth ${depth}`);
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
      const fitTarget = new THREE.Mesh(new THREE.BoxGeometry(0.41, 2.6, 0.1));
      fitTarget.position.y = 1.3;
      const before = wrapBundledProp(bundled, fitTarget, { name: 'ladder-mesh', fit: 'max' });
      const beforeSize = measureVisibleBox(before).getSize(new THREE.Vector3());
      const copies = [];
      built.ladder.traverse((child) => {
        if (child.name === 'ladder-mesh') copies.push(child);
      });
      assert.equal(copies.length, 2);
      const stack = built.ladder.getObjectByName('ladder-stack');
      assert.ok(Math.abs(stack.scale.x - stack.scale.y) < 1e-6);
      assert.ok(Math.abs(stack.scale.y - stack.scale.z) < 1e-6);
      stack.updateMatrixWorld(true);
      const after = measureVisibleBox(stack);
      const afterSize = after.getSize(new THREE.Vector3());
      const span = DUNGEON_WALL_H / (beforeSize.y * 2);
      assert.ok(Math.abs(afterSize.z - beforeSize.x * span) < 0.06, `stacked width should stay proportional, z=${afterSize.z}`);
      assert.ok(Math.abs(afterSize.x - beforeSize.z * span) < 0.08, `stacked depth should stay proportional, x=${afterSize.x}`);
      assert.ok(Math.abs(after.max.y - DUNGEON_WALL_H) < 0.08, `bundled top should meet the wall, maxY=${after.max.y}`);
      assert.ok(after.min.y > -0.05 && after.min.y < 0.08, `bundled bottom should stay on the floor, minY=${after.min.y}`);
      const boxes = copies.map((copy) => {
        copy.updateMatrixWorld(true);
        return measureVisibleBox(copy);
      }).sort((a, b) => a.min.y - b.min.y);
      const wantAspect = beforeSize.y / beforeSize.x;
      for (const box of boxes) {
        const size = box.getSize(new THREE.Vector3());
        assert.ok(Math.abs(size.y / size.z - wantAspect) / wantAspect < 0.08, `copy aspect ${size.y / size.z} vs ${wantAspect}`);
      }
      assert.ok(Math.abs(boxes[0].max.y - boxes[1].min.y) < 0.04, `rails should meet, gap=${boxes[1].min.y - boxes[0].max.y}`);
      assert.ok(Math.abs(boxes[0].min.z - boxes[1].min.z) < 0.03);
      assert.ok(Math.abs(boxes[0].max.z - boxes[1].max.z) < 0.03);
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
        const dist = Math.hypot(pos.x - TRAPDOOR.x, pos.z - TRAPDOOR.z);
        if (dist < TRAPDOOR_HOLE_CLEAR || dist < 0.55) inHole += 1;
      }
    });
    assert.ok(blades > 100, `lawn should still have blades, got ${blades}`);
    assert.equal(inHole, 0, `grass should not cover the hatch opening, inHole=${inHole}`);
  });

  it('gives outdoor trees a chop pick', () => {
    const shop = buildShop([]).root;
    let trees = 0;
    shop.traverse((child) => {
      if (child.userData?.kind === 'tree' && child.userData?.materialId === 'logs') trees += 1;
    });
    assert.ok(trees > 0, `garden trees should be choppable, trees=${trees}`);
  });

  it('doubles outdoor trees on every axis, keeps them grounded, and off the roof fade', () => {
    assert.equal(OUTDOOR_TREE_SCALE, 2);
    assert.deepEqual(GATHER_CONTACT.tree, { x: 0.078, z: 0.641 });
    assert.deepEqual(GATHER_CONTACT.rock, { x: -0.017, z: 0.557 });
    const tree = buildTree(1);
    const visual = tree.getObjectByName('pine-visual');
    assert.ok(visual, 'the pine visual should live under the placement group');
    assert.ok(Math.abs(visual.scale.x - visual.scale.y) < 1e-6);
    assert.ok(Math.abs(visual.scale.y - visual.scale.z) < 1e-6);
    const big = measureVisibleBox(tree).getSize(new THREE.Vector3());
    const half = measureVisibleBox(buildTree(0.5)).getSize(new THREE.Vector3());
    tree.position.set(4.2, 0, -3.4);
    tree.rotation.y = 1.1;
    tree.scale.setScalar(1 - TREE_SCALE_SPREAD);
    seatTreeOnGround(tree);
    const box = measureVisibleBox(tree);
    assert.ok(box.min.y < -0.02 && box.min.y > -0.05, `base should sink into the grass, minY=${box.min.y}`);
    assert.ok(half.y > 1.5 && half.y < 2.4, `half scale should stay the old pine, got ${half.y}`);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(
        Math.abs(big[axis] - half[axis] * OUTDOOR_TREE_SCALE) < 0.08,
        `${axis} ${big[axis]} vs ${half[axis]}`,
      );
    }
    const chopAt = (radius) => {
      const offset = treeTrunkOffset(radius);
      const stand = gatherStandCandidates('tree', { x: 0, z: 0, trunkRadius: radius })[0];
      const standDist = Math.hypot(stand.x, stand.z);
      assert.ok(Math.abs(standDist - chopStandDistance(radius)) < 1e-6, `stand ${standDist} left the trunk-centre formula`);
      assert.ok(Math.abs(stand.x - -offset.x) < 1e-6 && Math.abs(stand.z - -offset.z) < 1e-6);
      const faceX = offset.x - 0.995 * radius;
      const faceZ = offset.z + 0.105 * radius;
      assert.ok(Math.abs(faceX - GATHER_CONTACT.tree.x) < 1e-9, `axe edge x ${faceX}`);
      assert.ok(Math.abs(faceZ - GATHER_CONTACT.tree.z) < 1e-9, `axe edge z ${faceZ}`);
      return standDist;
    };
    const doubled = chopAt(0.31);
    assert.ok(Math.abs(doubled - 0.721) < 0.002, `doubled pine stand ${doubled}`);
    chopAt(TREE_TRUNK_RADIUS);
    chopAt(TREE_TRUNK_RADIUS * 1.15);
    const slim = chopStandDistance(0.16);
    const thick = chopStandDistance(0.28);
    assert.ok(thick > slim, 'a thicker trunk steps the chop stand back');
    assert.ok(treeTrunkOffset(0.28).x > treeTrunkOffset(0.16).x + 0.1, 'the trunk centre moves with the radius');
    assert.ok(Math.abs(mineStandDistance('bronze') - Math.hypot(0.017, 0.557 + 0.52)) < 1e-9);
    assert.ok(Math.abs(mineStandDistance('essence') - Math.hypot(0.017, 0.557 + 1.04)) < 1e-9);
    let roofMarked = 0;
    let transparentMats = 0;
    tree.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (mat.userData?.isRoof) roofMarked += 1;
        if (mat.transparent) transparentMats += 1;
      }
    });
    assert.equal(roofMarked, 0, 'taller trees must not join the roof fade');
    assert.equal(transparentMats, 0, 'tree materials stay opaque so the camera roof fade cannot claim them');
  });

  it('scales garden tree click boxes and walk blocks with the wider trunks', () => {
    const shop = buildShop([]).root;
    let picks = 0;
    shop.updateMatrixWorld(true);
    shop.traverse((child) => {
      if (child.userData?.kind !== 'tree') return;
      picks += 1;
      const params = child.geometry?.parameters;
      assert.ok(params, 'chop pick should stay a box');
      assert.ok(Math.abs(params.width - 0.85 * OUTDOOR_TREE_SCALE) < 1e-6, `pick width ${params.width}`);
      assert.ok(Math.abs(params.depth - 0.85 * OUTDOOR_TREE_SCALE) < 1e-6, `pick depth ${params.depth}`);
      assert.ok(params.height > 2.8, `pick should cover the taller crown, height=${params.height}`);
      const pine = child.parent;
      const yaw = pine.rotation.y;
      pine.rotation.y = 0;
      pine.updateMatrixWorld(true);
      const box = measureVisibleBox(pine);
      pine.rotation.y = yaw;
      pine.updateMatrixWorld(true);
      assert.ok(box.min.y < -0.02 && box.min.y > -0.05, `placed roots should sink into the grass, minY=${box.min.y}`);
      assert.ok(pine.userData.uniformScale >= 1 - TREE_SCALE_SPREAD - 1e-6);
      assert.ok(pine.userData.uniformScale <= 1 + TREE_SCALE_SPREAD + 1e-6);
      assert.ok(Math.abs(pine.scale.x - pine.scale.y) < 1e-6 && Math.abs(pine.scale.y - pine.scale.z) < 1e-6);
      assert.ok(params.height + 0.05 >= box.max.y - box.min.y, 'pick should reach the crown');
      const wide = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      assert.ok(params.width + 0.15 >= wide * 0.45, `pick should cover the wider trunk, width=${params.width} crown=${wide}`);
      const ray = new THREE.Raycaster(
        new THREE.Vector3(child.userData.x, box.max.y - 0.2, child.userData.z + 4),
        new THREE.Vector3(0, 0, -1),
      );
      assert.ok(ray.intersectObject(child, false).length > 0, 'upper crown should still be clickable');
    });
    assert.ok(picks > 0, 'garden should still plant choppable trees');
    const blocks = gardenObstacles([]);
    for (const spot of gardenTreeSpots([])) {
      const block = blocks.find((item) => (
        Math.abs((item.minX + item.maxX) / 2 - spot.x) < 0.01
        && Math.abs((item.minZ + item.maxZ) / 2 - spot.z) < 0.01
      ));
      assert.ok(block, `missing walk block for tree at ${spot.x},${spot.z}`);
      const w = block.maxX - block.minX;
      const d = block.maxZ - block.minZ;
      const want = treeWalkBlock(plantedTrunkRadius(spot.x, spot.z));
      assert.ok(Math.abs(w - want) < 1e-6 && Math.abs(d - want) < 1e-6, `tree block ${w}x${d} vs ${want}`);
      assert.ok(Math.abs(want - TREE_WALK_BLOCK) / TREE_WALK_BLOCK <= TREE_SCALE_SPREAD + 0.02, `block ${want} drifted from the 2× trunk`);
    }
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
      assert.ok(range.userData.floorY < -0.08, `pose y should keep the sink, floorY=${range.userData.floorY}`);
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

  it('fits buyer dumps to humanoid height without a sideways dump yaw', async () => {
    const samples = [
      ['hedgemage', 'buyers/wizard/wizard-level-9'],
      ['pilgrim', 'buyers/adventurer/bob'],
      ['ranger', 'buyers/ranger/armour-salesman'],
      ['mercenary', 'buyers/guard/guard-level-21'],
    ];
    for (const [typeId, folder] of samples) {
      const bundled = await loadFolder(folder);
      const wrapped = wrapBuyerDump(bundled, typeId, { lookId: `test-${typeId}` });
      assert.equal(wrapped.userData.buyerLookId, `test-${typeId}`);
      const box = measureVisibleBox(wrapped);
      const height = box.max.y - Math.min(0, box.min.y);
      assert.ok(Math.abs(height - BUYER_FIT_HEIGHT) < 0.12, `${typeId} height ${height}`);
      assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `${typeId} feet minY=${box.min.y}`);
      assert.ok(Math.abs(BUYER_DUMP_YAW) < 1e-6, 'buyer dumps already face +Z');
      assert.ok(Math.abs(wrapped.children[0].rotation.y - BUYER_DUMP_YAW) < 1e-6, `${typeId} dump yaw`);
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
    assert.equal(byId['ore-clay'], 'dungeon-rocks/clay-rocks');
    assert.equal(byId['craft-ore-bronze'], 'ores/bronze-ore');
    assert.equal(byId['craft-ore-iron'], 'ores/iron-ore');
    assert.equal(byId['craft-ore-steel'], 'ores/steel-ore');
    assert.equal(byId['craft-ore-mithril'], 'ores/mithril-ore');
    assert.equal(byId['craft-ore-adamant'], 'ores/adamantite-ore');
    assert.equal(byId['craft-ore-runite'], 'ores/runite-ore');
    assert.equal(byId['craft-ore-dragon'], 'ores/dragon-ore');
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

  it('fits craft-screen ore dumps to the current lump without touching dungeon rocks', async () => {
    assert.equal(craftOreFolder('adamant'), 'ores/adamantite-ore');
    assert.equal(CRAFT_ORE_FOLDERS.length, 7);
    const dungeonById = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    assert.equal(dungeonById['ore-bronze'], 'dungeon-rocks/bronze-rocks');
    const samples = [
      ['bronze', 'ores/bronze-ore'],
      ['iron', 'ores/iron-ore'],
      ['steel', 'ores/steel-ore'],
      ['mithril', 'ores/mithril-ore'],
      ['adamant', 'ores/adamantite-ore'],
      ['runite', 'ores/runite-ore'],
      ['dragon', 'ores/dragon-ore'],
    ];
    for (const [metalId, folder] of samples) {
      const lookId = craftOreLookId(metalId);
      assert.equal(dungeonById[lookId], folder);
      const slug = folder.split('/').pop();
      assert.equal(existsSync(join(modelsRoot, folder, `${slug}.obj`)), true, `${folder}.obj`);
      assert.equal(existsSync(join(modelsRoot, folder, `${slug}.mtl`)), true, `${folder}.mtl`);
      const bundled = await loadFolder(folder);
      const want = measureVisibleBox(buildWare(metalId)).getSize(new THREE.Vector3());
      setBundledLook(lookId, bundled);
      try {
        const ware = buildWare(metalId);
        assert.ok(ware.getObjectByName(lookId), metalId);
        assertUniform(ware.getObjectByName(lookId));
        const got = measureVisibleBox(ware).getSize(new THREE.Vector3());
        assert.ok(
          Math.abs(Math.max(got.x, got.y, got.z) - Math.max(want.x, want.y, want.z)) < 0.08,
          `${metalId} size ${Math.max(got.x, got.y, got.z)} vs ${Math.max(want.x, want.y, want.z)}`,
        );
      } finally {
        setBundledLook(lookId, null);
      }
    }
    assert.equal(existsSync(join(modelsRoot, 'ores/adamant-ore/adamant-ore.obj')), true);
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

  it('fits the rune-rocks dump as Runite and keeps that display name', async () => {
    const objText = readFileSync(join(modelsRoot, 'dungeon-rocks/rune-rocks/rune-rocks.obj'), 'utf8');
    assert.match(objText, /Runite rocks/i);
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

  it('lifts every dungeon ore dump toward Blender Kd and drops missing maps', async () => {
    assert.ok(DUNGEON_ROCK_ALBEDO_LIFT >= 1.7);
    assert.ok(DUNGEON_ROCK_AMBIENT > 0);
    assert.ok(DUNGEON_ROCK_EMIT > 0);
    const folders = {
      bronze: 'dungeon-rocks/bronze-rocks',
      iron: 'dungeon-rocks/iron-rocks',
      steel: 'dungeon-rocks/steel-rocks',
      mithril: 'dungeon-rocks/mithril-rocks',
      adamant: 'dungeon-rocks/adamant-rocks',
      runite: 'dungeon-rocks/rune-rocks',
      dragon: 'dungeon-rocks/dragon-rocks',
      essence: 'dungeon-rocks/essence',
      clay: 'dungeon-rocks/clay-rocks',
    };
    for (const folder of Object.values(folders)) {
      assert.equal(isDungeonRockDump(folder), true);
    }
    assert.equal(isDungeonRockDump('rock'), false);
    assert.equal(isDungeonRockDump('rock/rock.obj'), false);

    const garden = await loadFolder('rock');
    assert.equal(garden.userData?.dungeonRockLift, undefined);
    garden.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        assert.equal(mat?.userData?.dungeonRockLift, undefined);
      }
    });

    const rawAlbedo = {};
    for (const [id, folder] of Object.entries(folders)) {
      const raw = await loadFolder(folder);
      assert.equal(raw.userData?.dungeonRockLift, true, `${id} should lift at OBJ/MTL load`);
      prepareDungeonRockMaterials(raw);
      prepareDungeonRockMaterials(raw);
      rawAlbedo[id] = { r: 0, g: 0, b: 0, max: 0 };
      raw.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        assert.ok(mats.every((mat) => mat?.isMeshStandardMaterial && mat.metalness === 0 && mat.userData?.dungeonRockLift));
        for (const mat of mats) {
          const c = mat?.color;
          if (!c) continue;
          const srgb = c.clone();
          if (typeof srgb.convertLinearToSRGB === 'function') srgb.convertLinearToSRGB();
          rawAlbedo[id].r = Math.max(rawAlbedo[id].r, srgb.r);
          rawAlbedo[id].g = Math.max(rawAlbedo[id].g, srgb.g);
          rawAlbedo[id].b = Math.max(rawAlbedo[id].b, srgb.b);
          rawAlbedo[id].max = Math.max(rawAlbedo[id].max, srgb.r, srgb.g, srgb.b);
        }
      });
      setBundledLook(`ore-${id}`, raw);
    }
    try {
      for (const [id, sample] of Object.entries(rawAlbedo)) {
        assert.ok(sample.max > 0.28, `${id} albedo should read nearer Blender, max=${sample.max}`);
      }
      assert.ok(rawAlbedo.bronze.r > rawAlbedo.bronze.b, 'bronze should stay warm');
      assert.ok(rawAlbedo.adamant.g > rawAlbedo.adamant.r, 'adamantite should stay green');
      assert.ok(rawAlbedo.mithril.b > rawAlbedo.mithril.r, 'mithril should stay blue');
      assert.ok(rawAlbedo.runite.b > rawAlbedo.runite.r, 'runite should stay cyan/blue');
      assert.ok(rawAlbedo.dragon.r > rawAlbedo.bronze.max, 'dragon should stay redder than bronze');

      const built = buildDungeon();
      const dragon = built.boulders.find((item) => item.name === 'boulder-dragon');
      const bronze = built.boulders.find((item) => item.name === 'boulder-bronze');
      assert.ok(dragon && bronze);
      let dragonMaps = 0;
      let dragonStd = 0;
      let dragonMeshes = 0;
      dragon.traverse((child) => {
        if (!child.isMesh || child.userData?.kind === 'boulder') return;
        dragonMeshes += 1;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        if (mats.some((mat) => mat?.map)) dragonMaps += 1;
        if (mats.every((mat) => mat?.isMeshStandardMaterial)) dragonStd += 1;
      });
      assert.ok(dragonMeshes >= 1);
      assert.equal(dragonMaps, 0, 'missing .psd maps should not darken dragon rocks');
      assert.equal(dragonStd, dragonMeshes);
      for (const boulder of built.boulders) {
        let lifted = 0;
        boulder.traverse((child) => {
          if (!child.isMesh || child.userData?.kind === 'boulder') return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          if (mats.every((mat) => mat?.isMeshStandardMaterial && mat.metalness === 0 && mat.userData?.dungeonRockLift)) {
            lifted += 1;
          }
        });
        assert.ok(lifted >= 1, `${boulder.name} should use the shared dungeon-rock material lift`);
      }
    } finally {
      for (const id of Object.keys(folders)) setBundledLook(`ore-${id}`, null);
    }
  });

  it('uses a clay-coloured procedural rock when the clay dump is missing', () => {
    setBundledLook('ore-clay', null);
    const clay = buildDungeon().boulders.find((item) => item.name === 'boulder-clay');
    assert.ok(clay);
    let clayColored = 0;
    clay.traverse((child) => {
      if (!child.isMesh || child.userData?.kind === 'boulder') return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      if (mats.some((mat) => mat?.color?.getHex?.() === 0x8a6230)) clayColored += 1;
    });
    assert.ok(clayColored >= 1);
  });

  it('seats every full and depleted dungeon rock on the cobble, not on y=0', async () => {
    const folders = {
      bronze: 'dungeon-rocks/bronze-rocks',
      iron: 'dungeon-rocks/iron-rocks',
      steel: 'dungeon-rocks/steel-rocks',
      mithril: 'dungeon-rocks/mithril-rocks',
      adamant: 'dungeon-rocks/adamant-rocks',
      runite: 'dungeon-rocks/rune-rocks',
      dragon: 'dungeon-rocks/dragon-rocks',
      essence: 'dungeon-rocks/essence',
      clay: 'dungeon-rocks/clay-rocks',
    };
    for (const [id, folder] of Object.entries(folders)) {
      setBundledLook(`ore-${id}`, await loadFolder(folder));
    }
    try {
      const built = buildDungeon();
      const floorY = dungeonFloorSurfaceY(built.root);
      assert.ok(floorY > 0.01, `floor surface should be the raised cobble, got ${floorY}`);
      assert.ok(Math.abs(floorY - DUNGEON_FLOOR_Y) < 1e-4);
      const target = floorY - DUNGEON_ROCK_SINK;
      for (const spot of DUNGEON_BOULDERS) {
        const boulder = built.boulders.find((item) => item.name === `boulder-${spot.id}`);
        assert.equal(boulder.position.x, spot.x);
        assert.equal(boulder.position.y, 0);
        assert.equal(boulder.position.z, spot.z);
        const visual = boulder.children.find((child) => child.name?.startsWith('ore-'));
        const contacts = dungeonRockContactMins(visual);
        assert.ok(contacts.length >= 2, `${spot.id} should seat full and depleted rocks separately, got ${contacts.length}`);
        for (const minY of contacts) {
          assert.ok(Math.abs(minY - target) < 0.004, `${spot.id} base ${minY} vs ${target}`);
        }
        const box = measureVisibleBox(visual);
        assert.ok(box.max.y - box.min.y > 0.35, `${spot.id} should stay a rock, height ${box.max.y - box.min.y}`);
        const pick = boulder.children.find((child) => child.userData?.kind === 'boulder');
        assert.equal(pick.userData.x, spot.x);
        assert.equal(pick.userData.z, spot.z);
        assert.equal(pick.position.x, 0);
        assert.equal(pick.position.z, 0);
      }
    } finally {
      for (const id of Object.keys(folders)) setBundledLook(`ore-${id}`, null);
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
      clay: 'dungeon-rocks/clay-rocks',
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
          box.min.y <= DUNGEON_FLOOR_Y + 0.005,
          `${boulder.name} should meet the cobble, minY=${box.min.y}`,
        );
        assert.ok(
          box.max.y > DUNGEON_FLOOR_Y + 0.2,
          `${boulder.name} should still stand above the floor, maxY=${box.max.y}`,
        );
      }
      const spanOf = (name) => {
        const visual = built.boulders.find((item) => item.name === name)
          ?.children.find((child) => child.name?.startsWith('ore-'));
        const size = measureVisibleBox(visual).getSize(new THREE.Vector3());
        return Math.max(size.x, size.y, size.z);
      };
      const claySpan = spanOf('boulder-clay');
      const bronzeSpan = spanOf('boulder-bronze');
      assert.ok(
        Math.abs(claySpan - bronzeSpan) < 0.12,
        `clay rock should match bronze size, ${claySpan} vs ${bronzeSpan}`,
      );
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
      assert.ok(essenceBox.min.y <= DUNGEON_FLOOR_Y + 0.005, `essence minY=${essenceBox.min.y}`);
      assert.ok(essenceBox.max.y > DUNGEON_FLOOR_Y + 0.4, `essence maxY=${essenceBox.max.y}`);
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

  it('fits bundled weapon, armour, ammo, and tool dumps to the current mesh size', async () => {
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    assert.equal(LUKE_MODEL_FOLDERS.length, 194);
    for (const item of LUKE_MODEL_FOLDERS) {
      assert.equal(byId[item.id], item.folder, item.id);
      const slug = item.folder.split('/').pop();
      const folderPath = join(modelsRoot, item.folder);
      assert.equal(existsSync(join(folderPath, `${slug}.obj`)), true, `${item.folder}.obj`);
      assert.equal(existsSync(join(folderPath, `${slug}.mtl`)), true, `${item.folder}.mtl`);
    }
    const samples = [
      'bronze_scimitar',
      'runite_sword',
      'dragon_2h_sword',
      'shortbow',
      'magic_longbow',
      'bronze_crossbow',
      'staff',
      'magic_staff_air',
      'fire_battlestaff',
      'mystic_water_staff',
      'ancient_staff',
      'bronze_full_helm',
      'bronze_platebody',
      'bronze_kiteshield',
      'dragon_med_helm',
      'blue_dhide_body',
      'green_dragon_mask',
      'wizard_hat',
      'wizard_robe',
      'mystic_robe_top',
      'splitbark_hat',
      'splitbark_gauntlets',
      'bronze_arrows',
      'dragon_arrows',
      'bronze_hatchet',
      'dragon_pickaxe',
      'runite_hatchet',
      'weave_cloth',
      'flax',
      'orb',
      'fire_clay',
      'dragon_kiteshield',
    ];
    for (const recipeId of samples) {
      const bundled = await loadFolder(byId[recipeId]);
      const want = new THREE.Box3().setFromObject(buildWare(recipeId)).getSize(new THREE.Vector3());
      setBundledLook(recipeId, bundled);
      try {
        const ware = buildWare(recipeId);
        const dump = ware.getObjectByName('dump');
        assert.ok(dump, recipeId);
        assertUniform(dump);
        const got = new THREE.Box3().setFromObject(ware).getSize(new THREE.Vector3());
        const wantMax = Math.max(want.x, want.y, want.z);
        const gotMax = Math.max(got.x, got.y, got.z);
        assert.ok(Math.abs(gotMax - wantMax) < 0.08, `${recipeId} size ${gotMax} vs ${wantMax}`);
      } finally {
        setBundledLook(recipeId, null);
      }
    }
    assert.equal(byId.bronze_thrownaxe, undefined);
    assert.equal(buildWare('bronze_thrownaxe').getObjectByName('dump'), undefined);

    async function thinAxis(recipeId) {
      const bundled = await loadFolder(byId[recipeId]);
      setBundledLook(recipeId, bundled);
      try {
        const size = new THREE.Box3().setFromObject(buildWare(recipeId)).getSize(new THREE.Vector3());
        return [['x', size.x], ['y', size.y], ['z', size.z]].sort((a, b) => a[1] - b[1])[0][0];
      } finally {
        setBundledLook(recipeId, null);
      }
    }
    assert.equal(wareDisplayYaw('bronze_platebody'), 0);
    assert.equal(wareDisplayYaw('runite_platebody'), 0);
    assert.equal(await thinAxis('bronze_platebody'), 'x');
    assert.equal(await thinAxis('wizard_robe'), 'z');
    assert.equal(await thinAxis('mystic_robe_top'), 'z');
    assert.equal(await thinAxis('splitbark_robe_top'), 'z');
    assert.equal(await thinAxis('green_dragon_mask'), 'z');
    assert.equal(await thinAxis('red_dragon_mask'), 'z');
    for (const missingId of ['dragon_platebody', 'blue_dhide_boots', 'battlemage_hat', 'cannonballs']) {
      assert.equal(byId[missingId], undefined, missingId);
      assert.equal(buildWare(missingId).getObjectByName('dump'), undefined, missingId);
    }
  });

  it('shows the fire battlestaff with the mystic fire staff mesh', async () => {
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    assert.equal(byId.fire_battlestaff, 'gear/mystic-fire-staff');
    assert.equal(byId.mystic_fire_staff, 'gear/mystic-fire-staff');
    const fireObj = readFileSync(join(modelsRoot, 'gear/fire-battlestaff/fire-battlestaff.obj'), 'utf8');
    const fireMtl = readFileSync(join(modelsRoot, 'gear/fire-battlestaff/fire-battlestaff.mtl'), 'utf8');
    assert.match(fireObj, /^mtllib fire-battlestaff\.mtl/m);
    assert.match(fireObj, /Object Fire battlestaff 2026-09-24_19-52-47/);
    assert.match(fireMtl, /newmtl c0\r?\nKd 0\.1451 0\.2275 0\.0706/);
    for (const id of ['air_battlestaff', 'water_battlestaff', 'earth_battlestaff']) {
      const obj = readFileSync(join(modelsRoot, byId[id], `${id.replaceAll('_', '-')}.obj`), 'utf8');
      assert.match(obj, new RegExp(`Item ${id.split('_')[0][0].toUpperCase()}${id.split('_')[0].slice(1)} battlestaff`, 'i'));
      assert.doesNotMatch(obj, /fire-battlestaff/);
      assert.notEqual(byId[id], 'gear/mystic-fire-staff');
    }

    function shaftAxis(mesh) {
      mesh.updateMatrixWorld(true);
      const pts = [];
      mesh.traverse((child) => {
        if (!child.isMesh) return;
        const pos = child.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i += 1) {
          pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld));
        }
      });
      const center = new THREE.Vector3();
      for (const p of pts) center.add(p);
      center.multiplyScalar(1 / pts.length);
      let xx = 0; let yy = 0; let zz = 0; let xy = 0; let xz = 0; let yz = 0;
      for (const p of pts) {
        const x = p.x - center.x; const y = p.y - center.y; const z = p.z - center.z;
        xx += x * x; yy += y * y; zz += z * z; xy += x * y; xz += x * z; yz += y * z;
      }
      const axis = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 40; k += 1) {
        axis.set(xx * axis.x + xy * axis.y + xz * axis.z, xy * axis.x + yy * axis.y + yz * axis.z, xz * axis.x + yz * axis.y + zz * axis.z).normalize();
      }
      if (axis.y < 0) axis.negate();
      return axis;
    }

    async function fitted(id) {
      const bundled = await loadFolder(byId[id]);
      setBundledLook(id, bundled);
      try {
        const ware = buildWare(id);
        const box = measureVisibleBox(ware);
        const size = box.getSize(new THREE.Vector3());
        return {
          minY: box.min.y,
          max: Math.max(size.x, size.y, size.z),
          axis: shaftAxis(ware.getObjectByName('dump')),
        };
      } finally {
        setBundledLook(id, null);
      }
    }

    const mystic = await fitted('mystic_fire_staff');
    const fire = await fitted('fire_battlestaff');
    assert.ok(Math.abs(fire.minY) < 0.02, `fire minY=${fire.minY}`);
    assert.ok(Math.abs(fire.minY - mystic.minY) < 0.001, `fire minY=${fire.minY} mystic=${mystic.minY}`);
    assert.ok(Math.abs(fire.max - mystic.max) < 0.001, `fire size ${fire.max} vs mystic ${mystic.max}`);
    assert.ok(fire.axis.dot(mystic.axis) > 0.999, `fire axis ${fire.axis.toArray()} vs mystic ${mystic.axis.toArray()}`);
  });

  it('fits bundled loom, fletching bench, and potter wheel dumps to the current stations', async () => {
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    const cases = [
      ['loom', buildLoom],
      ['fletch', buildFletchingBench],
      ['potter', buildPotterWheel],
    ];
    for (const [id, build] of cases) {
      const bundled = await loadFolder(byId[id]);
      const want = new THREE.Box3().setFromObject(build()).getSize(new THREE.Vector3());
      setBundledLook(id, bundled);
      try {
        const live = build();
        assert.equal(live.name, id);
        assertUniform(live);
        assertGrounded(live);
        const got = new THREE.Box3().setFromObject(live).getSize(new THREE.Vector3());
        const scale = id === 'fletch' ? 1.5 : 1;
        const wantMax = Math.max(want.x, want.y, want.z) * scale;
        const gotMax = Math.max(got.x, got.y, got.z);
        assert.ok(Math.abs(gotMax - wantMax) < 0.18, `${id} size ${gotMax} vs ${wantMax}`);
      } finally {
        setBundledLook(id, null);
      }
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
  it('holds a rune pickaxe and hatchet on the same grip as the procedural tools', async () => {
    const runeTint = (hex) => new THREE.MeshStandardMaterial({ color: hex }).color.getHexString();
    const wantPick = runeTint(RECIPES.runite_pickaxe.tint);
    const wantHatchet = runeTint(RECIPES.runite_hatchet.tint);
    const bronze = runeTint(0x8a5a32);
    const ironGrey = runeTint(0x6a7078);

    const plainPick = buildHeldTool('pickaxe');
    const plainHat = buildHeldTool('hatchet');
    assert.equal(plainPick.getObjectByName('dump'), undefined);
    assert.equal(plainPick.getObjectByName('pickaxe-head').material.color.getHexString(), wantPick);
    assert.notEqual(wantPick, ironGrey);
    let hatchetMetal = 0;
    plainHat.traverse((child) => {
      if (child.isMesh && child.material?.color?.getHexString() === wantHatchet) hatchetMetal += 1;
    });
    assert.ok(hatchetMetal >= 3);
    assert.notEqual(wantHatchet, bronze);

    function pointsOf(root) {
      root.updateMatrixWorld(true);
      const pts = [];
      root.traverse((child) => {
        if (!child.isMesh) return;
        const pos = child.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i += 1) {
          pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld));
        }
      });
      return pts;
    }

    function gripFrame(root) {
      const pts = pointsOf(root);
      const center = new THREE.Vector3();
      for (const p of pts) center.add(p);
      center.multiplyScalar(1 / pts.length);
      let xx = 0; let yy = 0; let zz = 0; let xy = 0; let xz = 0; let yz = 0;
      for (const p of pts) {
        const x = p.x - center.x; const y = p.y - center.y; const z = p.z - center.z;
        xx += x * x; yy += y * y; zz += z * z; xy += x * y; xz += x * z; yz += y * z;
      }
      const axis = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 40; k += 1) {
        axis.set(xx * axis.x + xy * axis.y + xz * axis.z, xy * axis.x + yy * axis.y + yz * axis.z, xz * axis.x + yz * axis.y + zz * axis.z).normalize();
      }
      let minT = Infinity; let maxT = -Infinity;
      for (const p of pts) {
        const t = p.clone().sub(center).dot(axis);
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const endMin = center.clone().addScaledVector(axis, minT);
      const endMax = center.clone().addScaledVector(axis, maxT);
      const butt = endMin.lengthSq() <= endMax.lengthSq() ? endMin : endMax;
      if (butt === endMax) axis.negate();
      const perps = pts.map((p) => {
        const rel = p.clone().sub(center);
        return rel.addScaledVector(axis, -rel.dot(axis));
      }).filter((perp) => perp.lengthSq() > 1e-8);
      perps.sort((a, b) => b.lengthSq() - a.lengthSq());
      const seed = perps[0].clone().normalize();
      const side = new THREE.Vector3();
      const cutoff = perps[0].length() * 0.55;
      for (const perp of perps) {
        if (perp.length() < cutoff) break;
        if (perp.clone().normalize().dot(seed) <= 0) continue;
        side.add(perp);
      }
      return { butt, axis, length: maxT - minT, side: side.normalize() };
    }

    const modelsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public/models');
    async function loadGear(folder) {
      const base = folder.split('/').pop();
      const obj = readFileSync(join(modelsRoot, folder, `${base}.obj`));
      const mtl = readFileSync(join(modelsRoot, folder, `${base}.mtl`));
      return parseModelBuffer(
        obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
        `${folder}/${base}.obj`,
        { [`${base}.mtl`]: mtl.buffer.slice(mtl.byteOffset, mtl.byteOffset + mtl.byteLength) },
      );
    }
    const byId = Object.fromEntries(BUNDLED_PROP_FOLDERS.map((item) => [item.id, item.folder]));
    setBundledLook('runite_pickaxe', await loadGear(byId.runite_pickaxe));
    setBundledLook('runite_hatchet', await loadGear(byId.runite_hatchet));
    try {
      for (const [kind, stock] of [['pickaxe', plainPick], ['hatchet', plainHat]]) {
        const held = buildHeldTool(kind);
        const dump = held.getObjectByName('dump');
        assert.ok(dump, kind);
        assert.ok(Math.abs(dump.scale.x - dump.scale.y) < 1e-6, kind);
        assert.ok(Math.abs(dump.scale.y - dump.scale.z) < 1e-6, kind);
        const got = gripFrame(held);
        const want = gripFrame(stock);
        assert.ok(got.butt.distanceTo(want.butt) < 0.02, `${kind} butt ${got.butt.toArray()} vs ${want.butt.toArray()}`);
        assert.ok(Math.abs(got.axis.dot(want.axis)) > 0.98, `${kind} axis ${got.axis.toArray()}`);
        assert.ok(got.side.dot(want.side) > 0.85, `${kind} side ${got.side.toArray()} vs ${want.side.toArray()}`);
        assert.ok(Math.abs(got.length - want.length) / want.length < 0.08, `${kind} length ${got.length} vs ${want.length}`);
        let cyan = 0;
        dump.traverse((child) => {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) {
            const color = mat?.color;
            if (color && color.b > color.r && color.g > color.r) cyan += 1;
          }
        });
        assert.ok(cyan >= 1, `${kind} should keep the baked rune colour`);
      }

      const keeper = buildShopkeeper();
      assert.equal(keeper.userData.pickaxe.parent, keeper.userData.hand);
      assert.equal(keeper.userData.hatchet.parent, keeper.userData.hand);
      assert.ok(keeper.userData.pickaxe.getObjectByName('dump'));
      assert.ok(keeper.userData.hatchet.getObjectByName('dump'));
      assert.ok(Math.abs(keeper.userData.pickaxe.position.x - 0.012) < 1e-6);
      assert.ok(Math.abs(keeper.userData.pickaxe.rotation.x - -0.62) < 1e-6);
      setHeldTool(keeper, 'pickaxe');
      assert.equal(keeper.userData.pickaxe.visible, true);
      assert.equal(keeper.userData.hatchet.visible, false);
      setHeldTool(keeper, 'hatchet');
      assert.equal(keeper.userData.pickaxe.visible, false);
      assert.equal(keeper.userData.hatchet.visible, true);

      const glb = readFileSync(join(modelsRoot, 'player/character_rigged.glb'));
      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().parse(
          glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
          '',
          resolve,
          reject,
        );
      });
      const rigged = wrapRiggedShopkeeper(gltf, { height: 1.7 });
      assert.equal(rigged.userData.hand.parent?.name, 'Hand_R');
      assert.ok(rigged.userData.pickaxe.getObjectByName('dump'));
      assert.ok(rigged.userData.hatchet.getObjectByName('dump'));
      assert.equal(rigged.userData.pickaxe.parent, rigged.userData.hand);
      assert.ok(Math.abs(rigged.userData.hand.position.x - -0.0089) < 1e-4);
      assert.ok(Math.abs(rigged.userData.hand.position.y - -0.0579) < 1e-4);
      assert.ok(Math.abs(rigged.userData.hand.position.z - 0.0045) < 1e-4);
      for (const [kind, headZ] of [['pickaxe', 0.51], ['hatchet', 0.395]]) {
        const tool = rigged.userData[kind];
        const parent = tool.parent;
        const parked = new THREE.Group();
        parked.add(tool);
        const frame = gripFrame(tool);
        parent.add(tool);
        assert.ok(frame.axis.z > 0.95, `${kind} handle should run along grip +Z`);
        assert.ok(frame.side.y < -0.7, `${kind} striking side should face grip −Y, side=${frame.side.toArray()}`);
        const head = frame.butt.clone().addScaledVector(frame.axis, frame.length);
        assert.ok(Math.abs(head.z - headZ) < 0.08, `${kind} head z ${head.z} vs ${headZ}`);
        assert.ok(frame.butt.z < -0.1, `${kind} butt should sit behind the fist, z=${frame.butt.z}`);
      }
      const loco = rigged.userData.clipLocomotion;
      assert.ok(Math.abs(loco.actions.mine.getClip().duration - 1.6) < 1e-3);
      assert.ok(Math.abs(loco.actions.chop.getClip().duration - 1.5) < 1e-3);
      assert.ok(Math.abs(loco.actions.pick.getClip().duration - 1.5) < 1e-3);
      let hits = 0;
      loco.onEvent = (name) => { if (name === 'hit') hits += 1; };
      setGatherClip(rigged, 'mine');
      for (let i = 0; i < 12; i += 1) updateMinePose(rigged, 0.1, i);
      assert.equal(loco.mode, 'mine');
      assert.equal(loco.actions.mine.timeScale, 1);
      assert.equal(hits, 1);
      setGatherClip(rigged, null);
      loco.speed = 1.85;
      updateWalkPose(rigged, true, 0.05, 1);
      const walkScale = 1.85 / (0.834 * loco.modelScale);
      assert.ok(Math.abs(loco.walk.timeScale - walkScale) < 1e-6);
    } finally {
      setBundledLook('runite_pickaxe', null);
      setBundledLook('runite_hatchet', null);
    }
  });

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

  it('stacks two proportional ladder copies to the wall top', () => {
    const ladder = buildDungeonLadder();
    const copies = [];
    ladder.traverse((child) => {
      if (child.name === 'ladder-mesh') copies.push(child);
    });
    assert.equal(copies.length, 2);
    const stack = ladder.getObjectByName('ladder-stack');
    assert.ok(stack);
    assert.ok(Math.abs(stack.scale.x - stack.scale.y) < 1e-6);
    assert.ok(Math.abs(stack.scale.y - stack.scale.z) < 1e-6);
    stack.updateMatrixWorld(true);
    const box = measureVisibleBox(stack);
    const size = box.getSize(new THREE.Vector3());
    const width = 0.41 * (DUNGEON_WALL_H / 5.2);
    assert.ok(Math.abs(size.z - width) < 0.02, `along-wall width should keep the half-size proportions, z=${size.z}`);
    assert.ok(Math.abs(size.y - DUNGEON_WALL_H) < 0.04, `height should meet the wall, y=${size.y}`);
    assert.ok(Math.abs(box.min.y) < 0.04, `bottom stays on the floor, minY=${box.min.y}`);
    assert.ok(Math.abs(box.max.y - DUNGEON_WALL_H) < 0.04, `top meets the wall, maxY=${box.max.y}`);
    const boxes = copies.map((copy) => {
      copy.updateMatrixWorld(true);
      return measureVisibleBox(copy);
    }).sort((a, b) => a.min.y - b.min.y);
    for (const copyBox of boxes) {
      const copySize = copyBox.getSize(new THREE.Vector3());
      assert.ok(Math.abs(copySize.y / copySize.z - 2.6 / 0.41) < 0.15, `copy should keep the rail aspect, y/z=${copySize.y / copySize.z}`);
      assert.ok(Math.abs(copySize.y - DUNGEON_WALL_H / 2) < 0.04, `each copy is half the wall, y=${copySize.y}`);
    }
    assert.ok(Math.abs(boxes[0].max.y - boxes[1].min.y) < 0.03, `rails should meet, gap=${boxes[1].min.y - boxes[0].max.y}`);
    assert.ok(Math.abs(boxes[0].min.z - boxes[1].min.z) < 0.02);
    assert.ok(Math.abs(boxes[0].max.z - boxes[1].max.z) < 0.02);

    const pick = ladder.getObjectByName('ladder-pick');
    assert.ok(pick);
    assert.equal(ladder.children.filter((child) => child.name === 'ladder-pick').length, 1);
    pick.updateMatrixWorld(true);
    const pickSize = measureVisibleBox(pick).getSize(new THREE.Vector3());
    assert.ok(Math.abs(pickSize.z - size.z) < 0.03, `click box width matches the ladder, z=${pickSize.z}`);
    assert.ok(Math.abs(pickSize.y - DUNGEON_WALL_H) < 0.04, `click box reaches the wall top, y=${pickSize.y}`);
    assert.ok(pickSize.x > 0.6, `click depth stays easy to hit, x=${pickSize.x}`);

    const built = buildDungeon();
    const placed = built.ladder.getObjectByName('ladder-stack');
    placed.updateMatrixWorld(true);
    const placedBox = measureVisibleBox(placed);
    let wallTop = null;
    built.root.traverse((child) => {
      if (!child.isMesh || child.position.x > -5) return;
      const height = child.geometry?.parameters?.height;
      if (height !== DUNGEON_WALL_H) return;
      wallTop = child.position.y + height / 2;
    });
    assert.ok(wallTop != null);
    assert.ok(Math.abs(placedBox.max.y - wallTop) < 0.05, `placed top ${placedBox.max.y} vs wall ${wallTop}`);
    assert.ok(placedBox.min.y > -0.04 && placedBox.min.y < 0.06, `placed bottom, minY=${placedBox.min.y}`);
    assert.ok(Math.abs(built.ladder.position.z - 0.4) < 1e-6);
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

  it('seats the front door on the floorboards and up to the lintel', () => {
    const door = buildShopDoor();
    const hinge = door.userData.hinge;
    const leaf = door.getObjectByName('door-leaf');
    assert.equal(hinge.position.x, -0.58);
    assert.equal(hinge.position.y, 0);
    assert.equal(hinge.position.z, 3.4);
    assert.ok(Math.abs(hinge.scale.x - 1) < 1e-6);
    assert.ok(Math.abs(leaf.scale.x - 1) < 1e-6);
    assert.ok(Math.abs(leaf.scale.z - 1) < 1e-6);
    assert.ok(leaf.scale.y > 1);
    hinge.rotation.y = 0;
    door.updateMatrixWorld(true);
    const box = measureVisibleBox(leaf);
    const opening = shopDoorOpening();
    assert.ok(Math.abs(box.min.y - opening.floorY) < 0.01, `bottom ${box.min.y} vs ${opening.floorY}`);
    assert.ok(Math.abs(box.max.y - opening.topY) < 0.01, `top ${box.max.y} vs ${opening.topY}`);
    const width = box.max.x - box.min.x;
    assert.ok(Math.abs(width - 1.12) < 0.02, `width ${width}`);
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

  it('scales the spinning wheel to half the previous 4× live size and keeps it on the floor', () => {
    assert.equal(WHEEL_WORLD_SCALE, 2);
    const wheel = buildSpinningWheel();
    assert.ok(Math.abs(wheel.scale.x - wheel.scale.y) < 1e-6);
    assert.ok(Math.abs(wheel.scale.y - wheel.scale.z) < 1e-6);
    assert.ok(Math.abs(wheel.scale.x - WHEEL_WORLD_SCALE) < 1e-6);
    const box = measureVisibleBox(wheel);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.08, `wheel should sit on the floor, minY=${box.min.y}`);
    assert.ok(box.max.y > 1.2 && box.max.y < 2.4, `wheel should be half the prior 4× height, maxY=${box.max.y}`);
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

describe('rigged adventurer buyers', () => {
  async function loadBuyer(file) {
    const glb = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/models', file));
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
        '',
        resolve,
        reject,
      );
    });
  }

  it('plays Walk and Idle on each rigged adventurer at the player scale', async () => {
    assert.equal(BUYER_MODEL_SCALE, 0.863);
    assert.equal(RIGGED_CLIP_FADE, 0.2);
    assert.equal(RIGGED_BUYER_MODELS.length, 5);
    try {
      for (const spec of RIGGED_BUYER_MODELS) {
        const gltf = await loadBuyer(spec.file);
        const buyer = wrapRiggedBuyer(gltf, 'pilgrim', { lookId: spec.lookId });
        assert.equal(buyer.name, 'pilgrim');
        assert.equal(buyer.userData.buyerLookId, spec.lookId);
        assert.equal(buyer.userData.pick?.userData.kind, 'customer');
        assert.ok(buyer.userData.speech);
        assert.ok(buyer.userData.ring);
        assert.ok(buyer.userData.hand);
        assert.equal(buyer.userData.pickaxe, undefined);
        assert.equal(buyer.userData.hatchet, undefined);
        assert.ok(Math.abs(buyer.userData.modelScale - BUYER_MODEL_SCALE) < 1e-9);
        const visual = buyer.getObjectByName('rigged-buyer');
        assert.ok(visual);
        assert.ok(Math.abs(visual.scale.x - BUYER_MODEL_SCALE) < 1e-9);
        assert.ok(Math.abs(visual.rotation.y) < 1e-9, 'buyer meshes face +Z like the dumps');
        const loco = buyer.userData.clipLocomotion;
        assert.ok(Math.abs(loco.walk.getClip().duration - 1) < 1e-3);
        assert.ok(Math.abs(loco.idle.getClip().duration - 3) < 1e-3);
        assert.ok(Math.abs(loco.walkStride - spec.speed * BUYER_MODEL_SCALE) < 1e-9);
        let skinned = 0;
        let bones = 0;
        buyer.traverse((child) => {
          if (child.isBone) bones += 1;
          if (!child.isSkinnedMesh) return;
          skinned += 1;
          assert.equal(child.frustumCulled, false);
        });
        assert.equal(skinned, 1, spec.lookId);
        assert.equal(bones, 18, spec.lookId);
        const handR = buyer.getObjectByName('Hand_R');
        assert.ok(handR);
        if (spec.carryHand === 'Hand_L') {
          assert.equal(handR.children.length, 0, 'Donie staff stays on Hand_R with no attached tool');
          assert.equal(buyer.userData.hand.parent?.name, 'Hand_L');
        } else {
          assert.equal(buyer.userData.hand.parent?.name, 'Hand_R');
          assert.equal(handR.children.some((child) => child.isMesh), false);
        }
        const moveSpeed = 1.35;
        loco.speed = moveSpeed;
        updateWalkPose(buyer, true, 0.05, 1);
        assert.equal(loco.mode, 'walk');
        assert.ok(Math.abs(loco.walk.timeScale - (moveSpeed / (spec.speed * BUYER_MODEL_SCALE))) < 1e-6);
        updateWalkPose(buyer, false, 0.25, 1.3);
        assert.equal(loco.mode, 'idle');
        visual.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(visual);
        const height = box.max.y - box.min.y;
        const expected = spec.height * BUYER_MODEL_SCALE;
        assert.ok(Math.abs(box.min.y) < 0.03, `${spec.lookId} feet ${box.min.y}`);
        assert.ok(Math.abs(height - expected) < 0.08, `${spec.lookId} height ${height} expected ${expected}`);
        setRiggedBuyer(spec.lookId, gltf);
        const built = buildAdventurer('pilgrim', { lookId: spec.lookId, seed: 0.2 });
        assert.equal(built.userData.buyerLookId, spec.lookId);
        assert.equal(built.userData.clipLocomotion.walkStride, loco.walkStride);
      }
    } finally {
      clearRiggedBuyers();
    }
  });

  it('keeps the old adventurer dump when a rigged buyer fails to wrap', () => {
    setRiggedBuyer('buyer-adventurer-bob', { scene: new THREE.Group(), animations: [] });
    try {
      const fallback = buildAdventurer('pilgrim', { lookId: 'buyer-adventurer-bob', seed: 0.2 });
      assert.equal(fallback.userData.clipLocomotion, undefined);
      assert.equal(fallback.userData.pick?.userData.kind, 'customer');
      assert.equal(getRiggedBuyer('buyer-adventurer-bob'), null);
    } finally {
      clearRiggedBuyers();
    }
  });
});
