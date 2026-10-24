import { onLayoutChange } from './layoutQuery.js';
import { graphicsProfile, getGraphicsLevel, onGraphicsChange, initGraphicsSettings } from './graphics.js';
import * as THREE from 'three';
import {
  ARMOUR_SLOTS,
  CUSTOMERS,
  DEFAULT_SKYBOX,
  FIRST_CUSTOMER_DELAY,
  skyIdForScene,
  MAX_CUSTOMERS,
  RECIPES,
  REQUEST_WAIT,
  SHOP,
  SKYBOXES,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  decideRequest,
  displayKind,
  isHandOrFootWare,
  MATERIALS,
  CHOP_DURATION,
  chopYield,
  fishTiming,
  FLAX_ARRIVE,
  FLAX_DURATION,
  FLAX_YIELD,
  FOUNTAIN_WATER_YIELD,
  WHEAT_ARRIVE,
  WHEAT_DURATION,
  WHEAT_YIELD,
  mineYield,
  mineTiming,
  emptySlots,
  emptyShelfSlots,
  mostExpensiveChestId,
  scheduleKingRoald,
  customerName,
  shelfSlotPoses,
  SHELF_SLOT_COUNT,
  stationForRecipe,
} from './catalog.js';
import { materialsDrawerBlocksPoint } from './materialsDrawer.js';
import { pickYield, waterFillYield, createFountainFill, gatherFullMessage, grantPickedFlax, grantPickedWheat, hasStock, materialIsFull, miningBarAmount, pushLog, storageCap } from './economy.js';
import { gatherBlockText, meetsGatherLevel } from './skills.js';
import {
  FURNITURE_FORWARD,
  FURNITURE_SNAP,
  furnitureRotateDelta,
  snapGridLines,
  cloneFurniture,
  furnitureHalfSize,
  furnitureStartYaw,
  furnitureVisualYaw,
  FLAX_CLICK_RADIUS,
  FLAX_COUNT,
  FLAX_SPACING,
  FISHING_CLICK_RADIUS,
  FISHING_SPOTS,
  fishingSpotById,
  FOUNTAIN,
  keepFountain,
  gardenBox,
  gardenSpotClearOfBeds,
  patchPlaceFloors,
  pointOnPath,
  buyerCobbleRoute,
  gardenTrapdoorSpot,
  gardenTreeSpots,
  patchHitsTreeOrRock,
  rectHitsPond,
  pondBlocksSpot,
  pointInPond,
  pointOnDock,
  POND,
  FARMING_PATCH_HALF,
  FLAX_RESPAWN_SEC,
  runeFieldTreeSpots,
  runeFieldRect,
  RUNE_ALTAR_SPOTS,
  RUNE_FIELD_ARRIVE,
  RUNE_FIELD_PORTAL,
  ALTAR_CLICK,
  PORTAL_HOME,
  portalPlaceFloors,
  plantedTrunkRadius,
  treeClickRadius,
  pickFlaxNode,
  rollFlaxSpots,
  rollWheatSpots,
  sproutDueFlax,
  WHEAT_CLICK_RADIUS,
  WHEAT_COUNT,
  WHEAT_SPACING,
  characterGroundY,
  interiorFloors,
  OUTDOOR_GROUND_Y,
  playerWalkFloors,
  pointHitsShop,
  pointOnFloors,
  SHOP_RUG,
  snapToFloor,
  snapToWallGrid,
  snapToPieceWall,
  placeFloors,
  walkFloors,
  SHELF_FROM_WALL,
} from './layout.js';
import {
  PLAYER_RADIUS,
  WALK_COLLIDE_RADIUS,
  dungeonMoveObstacles,
  runeFieldMoveObstacles,
  floorsForState,
  isWalkable,
  dropRecordedPatchObstacle,
  firstOpenFurniturePose,
  liveObstacles,
  moveWithCollision,
  placementBlocked,
  planPlayerWalk,
  planWalk,
  playerObstacles,
  queueSlot,
  rebuildShopWalls,
  pushOutPoint,
  buildShopWallRects,
} from './nav.js';
import { playClick, playSfx } from './audio.js';
import {
  completeTreeChop,
  ensureTreeNode,
  isTreeStump,
  reviveDueTrees,
  setTreeFallen,
  startTreeTopple,
  tickTreeTopple,
  treeCanChop,
  treeSpotKey,
} from './trees.js';
import {
  LADDER_STAND,
  STATION_ARRIVE,
  STATION_HIT,
  clickLeavesGather,
  fletchFaceYaw,
  floorClickPoint,
  furnaceFaceYaw,
  ignoredClickObject,
  pickUseHit,
  rangeFaceYaw,
  resolveStationUse,
  pondStands,
  stationAtFloor,
  boulderAtFloor,
} from './interact.js';
import {
  buildAdventurer,
  nextBuyerLookId,
  buildAnvil,
  buildChest,
  buildCounter,
  buildDust,
  buildFurniture,
  buildGoblin,
  wrapRiggedGoblin,
  buildShopDoor,
  buildShopkeeper,
  buildWare,
  normalizeImported,
  setChefHatVisible,
  setChestLid,
  setDoorOpen,
  setSpeechText,
  fitMannequinWear,
  slotPose,
  setHeldTool,
  restartFillBucket,
  isNetCatch,
  setGatherClip,
  getBundledLook,
  riggedClipTime,
  updateMinePose,
  updateWalkPose,
  wareTopY,
  wrapImportedCharacter,
  wrapRiggedShopkeeper,
  wrapShopPlayer,
  wrapUploadedPlayer,
  defaultPlayerWorldHeight,
  PLAYER_WORLD_SCALE,
} from './models.js';
import { FIRE_PIECES } from './sfxHooks.js';
import { constructionLookId, constructionPiece, pieceModelId, pieceHangs, pieceWallFace } from './construction.js';
import { buildCauldron, buildDungeon, buildFarmingPatch, buildFlaxPlant, buildFletchingBench, buildFurnace, buildLoom, buildPortal, buildPotterWheel, buildRange, buildRug, buildRuneField, buildSawmill, buildShop, buildSpinningWheel, buildWheatPlant, DUNGEON_BOULDERS, placeFarmingPatchMesh, tickFountainWater } from './shopbuild.js';
import { tickPortalJelly } from './portalJelly.js';
import { addFireLight, animPieceVisual, disposeAnimProp, loadAnimProps, MAX_FIRE_LIGHTS, setCauldronBrewing, tickAnimProp } from './animProps.js';
import { stepRatWander } from './rats.js';
import { dungeonMapBounds, dungeonMapFocus } from './minimap.js';
import { applySceneLighting, clampBrightness, clampDungeonBrightness } from './lighting.js';
import { mountDisplayBasePose } from './craftpreview.js';
import { ghostifyPieceVisual, setPlaceTint } from './pieceGhost.js';
import { tutorialEmit } from './tutorialEvents.js';
import { BUYER_MAX_WAIT, browseWait, buyerShouldWait, buyerSpawnClear, freeStandSpot, nextSpawnTime, pickBrowseStops, planCustomerSpawn, rescheduleKing } from './customerSim.js';
import { intentBus } from './intents.js';
import { createRemoteKeepers } from './remoteKeepers.js';

const CUSTOMER_SPEED = 1.35;
const PLAYER_SPEED = 1.85;
const CAM_YAW_SPEED = 2.175;
const CAM_PITCH_SPEED = 1.425;
const CAM_ORBIT_YAW = 0.0055;
const CAM_ORBIT_PITCH = 0.0036;

/** Still-finger hold on the canvas that opens the desktop right-click menu. */
export const TOUCH_LONG_PRESS_MS = 500;
/** Movement past this cancels the hold and starts camera orbit. */
export const TOUCH_HOLD_MOVE_PX = 8;
/** Second tap inside this window opens the right-click menu. */
export const TOUCH_DOUBLE_TAP_MS = 280;
/** Second tap must land near the first. */
export const TOUCH_DOUBLE_TAP_PX = 28;

/** Second ground click while placing furniture confirms the spot. */
export const PLACE_DOUBLE_CLICK_MS = 420;

/**
 * Preview on the first click. A second click inside the window confirms,
 * the same on a phone double-tap as on a desktop double-click.
 */
export function nextPlaceClick(lastAt, now, needsConfirm) {
  const at = Number(now) || 0;
  const prev = Number(lastAt) || 0;
  if (needsConfirm && prev > 0 && at >= prev && at - prev < PLACE_DOUBLE_CLICK_MS) {
    return { confirm: true, lastAt: 0 };
  }
  return { confirm: false, lastAt: at };
}

export function isCanvasDoubleTap(prev, next, now = 0) {
  if (!prev || !next) return false;
  const dt = now - (prev.t ?? 0);
  if (dt < 0 || dt > TOUCH_DOUBLE_TAP_MS) return false;
  const dist = Math.hypot(
    (next.x ?? next.clientX ?? 0) - (prev.x ?? prev.clientX ?? 0),
    (next.y ?? next.clientY ?? 0) - (prev.y ?? prev.clientY ?? 0),
  );
  return dist <= TOUCH_DOUBLE_TAP_PX;
}

/** Fingers moving apart returns a positive delta (zoom in). */
export function pinchSpanDelta(prevDist, nextDist) {
  if (!(prevDist > 0) || !(nextDist > 0)) return 0;
  return nextDist - prevDist;
}

export function applyPinchZoom(cam, delta, scale = 0.02) {
  cam.distance -= delta * scale;
  return cam;
}

/** Middle-mouse on desktop; one-finger canvas swipe on touch after a small move. */
export function canvasPointerStartsCamOrbit(event, flags = {}) {
  if (event?.button === 1) return true;
  if (event?.pointerType !== 'touch') return false;
  if (flags.moveTarget || flags.expandMode || flags.modalOpen) return false;
  if ((flags.touchCount ?? 1) > 1) return false;
  if (event.isPrimary === false) return false;
  return flags.moved === true;
}

export function canvasPointerMovedPastHold(from, to, threshold = TOUCH_HOLD_MOVE_PX) {
  return Math.hypot((to?.x ?? to?.clientX ?? 0) - (from?.x ?? from?.clientX ?? 0), (to?.y ?? to?.clientY ?? 0) - (from?.y ?? from?.clientY ?? 0)) > threshold;
}

/** Shared mouse-drag / one-finger swipe orbit. Horizontal sign is drag-left → look left. */
export function applyCanvasOrbitDelta(cam, dx, dy) {
  cam.yaw += dx * CAM_ORBIT_YAW;
  cam.pitch -= dy * CAM_ORBIT_PITCH;
  return cam;
}
export const DEFAULT_CAM = Object.freeze({ yaw: -0.06, pitch: 0.62, distance: 6.85 });

/** Put the follow camera back on the pose used when a shop first loads. */
export function resetCamPose(cam) {
  if (!cam) return cam;
  cam.yaw = DEFAULT_CAM.yaw;
  cam.pitch = DEFAULT_CAM.pitch;
  cam.distance = DEFAULT_CAM.distance;
  return cam;
}

const CAM_ZOOM_STEP = 0.38;
const CAM_MIN_DISTANCE = 2.05;
const CAM_MAX_DISTANCE = 25.8;
const CAM_MIN_PITCH = 0.28;
const CAM_MAX_PITCH = 1.18;
const ROOF_FADE_START = 13.7;
const ROOF_FADE_FULL = 20.5;
const GOBLIN_COUNT = 3;

function skyPreset(id) {
  return SKYBOXES.find((item) => item.id === id) ?? SKYBOXES.find((item) => item.id === DEFAULT_SKYBOX);
}

function applySkyColor(scene, id) {
  const preset = skyPreset(id);
  const color = preset.color;
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.Fog(preset.fog ?? color, 14, 42);
}

function buildClouds() {
  const group = new THREE.Group();
  group.name = 'clouds';
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 12; i += 1) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.1 + rand() * 0.7, 8, 6), mat);
      s.scale.set(1.7 + rand() * 0.6, 0.42 + rand() * 0.16, 1.05 + rand() * 0.4);
      s.position.set(j * 1.35 - 1.2, rand() * 0.35, (rand() - 0.5) * 1.1);
      puff.add(s);
    }
    puff.position.set((rand() - 0.5) * 34, 8.5 + rand() * 5, 6 + (rand() - 0.4) * 30);
    puff.userData.drift = 0.12 + rand() * 0.18;
    group.add(puff);
  }
  return group;
}

export function createWorld(canvas, state, opts = {}) {
  // Injectable randomness for the customer simulation (co-op tests pass a seeded one).
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  intentBus.bind(state);
  // 'local': this browser runs travellers (solo). 'remote': a co-op room sends them.
  let customerAuthority = 'local';
  let localMoveListener = null;
  let localActivityListener = null;
  let rebuildRemoteKeepers = null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  applySkyColor(scene, state.skybox ?? DEFAULT_SKYBOX);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 180);
  const cam = resetCamPose({});
  const camLook = new THREE.Vector3(SHOP.keeper.x, 0.95, SHOP.keeper.z);
  const camHeld = { left: false, right: false, up: false, down: false };
  let camDrag = null;
  const canvasTouches = new Set();
  const touchPoints = new Map();
  let multiTouch = false;
  let touchHold = null;
  let lastCanvasTap = null;
  let pendingTapTimer = null;
  let pinchDist = 0;
  camera.position.set(SHOP.cameraStart.x, SHOP.cameraStart.y, SHOP.cameraStart.z);
  camera.lookAt(camLook);

  const hemi = new THREE.HemisphereLight(0xf0e2c4, 0x6a5340, 1.14);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xf4e6c8, 0.24);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe1b0, 1.15);
  sun.position.set(-4.5, 12, 6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  const applyGraphics = () => {
    const g = graphicsProfile(getGraphicsLevel(), window.devicePixelRatio || 1);
    renderer.setPixelRatio(g.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (renderer.shadowMap.enabled !== g.shadows) {
      renderer.shadowMap.enabled = g.shadows;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    sun.castShadow = g.shadows;
    if (sun.shadow.mapSize.x !== g.shadowMap) {
      sun.shadow.mapSize.set(g.shadowMap, g.shadowMap);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    camera.far = g.far;
    camera.updateProjectionMatrix();
  };
  applyGraphics();
  onGraphicsChange(applyGraphics);
  initGraphicsSettings();
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun);

  const doorLight = new THREE.PointLight(0xffe1b0, 2.2, 6, 2);
  doorLight.position.set(0, 2.15, 3.9);
  scene.add(doorLight);
  const shopFill = new THREE.PointLight(0xffe8c4, 0.48, 16, 2);
  shopFill.position.set(0, 2.55, -0.35);
  scene.add(shopFill);
  let dungeon = null;
  let runeField = null;

  function syncLighting(mode = sceneMode) {
    applySceneLighting({
      hemi,
      ambient,
      fill: shopFill,
      door: doorLight,
      sun,
      renderer,
    }, mode, state.brightness, state.dungeonBrightness);
    const torchMul = clampDungeonBrightness(state.dungeonBrightness);
    dungeon?.root?.traverse((child) => {
      if (!child.isLight || child.userData.baseIntensity == null) return;
      child.intensity = child.userData.baseIntensity * torchMul;
    });
  }
  syncLighting('shop');

  if (!state.furniture) state.furniture = cloneFurniture();
  let architecture = null;
  let magicSparkles = [];
  let roofGroup = null;
  let groundGroup = null;
  let padGroup = null;
  let floors = walkFloors(state.expansions ?? []);
  let placeRects = placeFloors(state.expansions ?? []);
  let playerFloors = playerWalkFloors(state.expansions ?? []);
  const obstacles = liveObstacles(state);
  let expandMode = false;
  let selectedPad = null;
  let moveTarget = null;
  let moveOrigin = null;
  let placeNeedsConfirm = false;
  let placeDraft = null;
  let patchesReady = false;
  let snapGrid = null;
  let flaxGroup = null;
  let flaxNodes = [];
  let flaxSerial = 1;
  const flaxMeshes = new Map();
  let flaxReady = false;
  let wheatGroup = null;
  let wheatNodes = [];
  let wheatSerial = 1;
  const wheatMeshes = new Map();
  let wheatReady = false;

  function disposeGroup(group) {
    if (!group) return;
    scene.remove(group);
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }

  function disposeSparkles(root) {
    root?.traverse((child) => {
      const fx = child.userData?.sparkles;
      if (!fx?.dispose) return;
      fx.dispose();
      child.userData.sparkles = null;
    });
  }

  function collectSparkles(root) {
    const found = [];
    root?.traverse((child) => {
      if (child.userData?.sparkles?.update) found.push(child.userData.sparkles);
    });
    return found;
  }

  function rebuildArchitecture() {
    disposeSparkles(architecture);
    magicSparkles = [];
    disposeGroup(architecture);
    disposeGroup(roofGroup);
    disposeGroup(groundGroup);
    disposeGroup(padGroup);
    const built = buildShop(state.expansions ?? [], state.furniture);
    architecture = built.root;
    roofGroup = built.roofs;
    groundGroup = built.grounds;
    padGroup = built.pads;
    padGroup.visible = expandMode;
    scene.add(architecture);
    scene.add(roofGroup);
    scene.add(groundGroup);
    scene.add(padGroup);
    magicSparkles = collectSparkles(architecture);
    floors = floorsForState(state);
    placeRects = placeFloors(state.expansions ?? []);
    playerFloors = playerWalkFloors(state.expansions ?? []);
    syncTreeVisuals();
    rebuildNav();
    rebuildSnapGrid();
    if (flaxReady) refillFlaxField();
    if (wheatReady) refillWheatField();
  }

  let collideObstacles = [];
  let pushReady = false;

  function rebuildNav() {
    const next = liveObstacles(state);
    obstacles.length = 0;
    obstacles.push(...next);
    rebuildShopWalls(state.expansions ?? []);
    collideObstacles = playerObstacles(state);
    pushPlayerClear();
  }

  /** Slide target when a placed piece (or an old save) leaves the player inside a blocker. */
  let pushSlide = null;
  function pushPlayerClear() {
    if (!pushReady || sceneMode !== 'shop') return false;
    const pos = shopkeeper.position;
    const spot = pushOutPoint(pos.x, pos.z, collideObstacles, playerFloors, buildShopWallRects(state.expansions ?? []));
    if (!spot) return false;
    playerPath.length = 0;
    walkGoal = null;
    pendingUse = null;
    moveMarker.visible = false;
    stopMining();
    pushSlide = { x: spot.x, z: spot.z };
    return true;
  }

  function tickPushSlide(dt) {
    if (!pushSlide) return;
    const pos = shopkeeper.position;
    const dx = pushSlide.x - pos.x; const dz = pushSlide.z - pos.z;
    const d = Math.hypot(dx, dz);
    const step = Math.max(d * Math.min(1, dt * 14), 0.02);
    if (d <= step || sceneMode !== 'shop') {
      if (sceneMode === 'shop') { pos.x = pushSlide.x; pos.z = pushSlide.z; }
      pushSlide = null;
      return;
    }
    pos.x += dx / d * step; pos.z += dz / d * step;
  }

  rebuildArchitecture();
  let shopDoor = buildShopDoor();
  scene.add(shopDoor);
  const dust = buildDust();
  scene.add(dust);

  let drawScene = true;
  let riggedPlayerGltf = opts.riggedPlayer ?? null;
  const fishingRodGltf = opts.fishingRod ?? null;
  const fishingNetGltf = opts.fishingNet ?? null;
  const fillBucketGltf = opts.fillBucket ?? null;
  let riggedGoblinGltf = opts.riggedGoblin ?? null;
  let riggedRatGltf = opts.riggedRat ?? null;
  let bundledPlayerSource = opts.bundledPlayer ?? null;
  let customPlayerSource = null;
  let customPlayerYaw = false;
  let customPlayerHint = null;
  let customPlayerName = '';
  let customCustomerSource = null;

  function clearCustomPlayer() {
    customPlayerSource = null;
    customPlayerYaw = false;
    customPlayerHint = null;
    customPlayerName = '';
  }

  function friendlyPlayerReason(err) {
    const raw = err?.message || '';
    if (/unchanged/i.test(raw)) return raw;
    if (/no visible mesh/i.test(raw)) return 'That file has no visible mesh. The current model is unchanged.';
    return 'Could not use that as a player model. The current model is unchanged.';
  }

  function applyUploadedPlayer(model, opts = {}) {
    const yaw180 = Boolean(opts.yaw180);
    const wrapped = wrapUploadedPlayer(model, {
      animations: opts.animations ?? model.animations ?? [],
      yaw180,
      height: defaultPlayerWorldHeight(),
      chefHatOn: Boolean(state.chefHat),
      fishingRod: fishingRodGltf,
      fishingNet: fishingNetGltf,
      fillBucket: fillBucketGltf,
    });
    customPlayerSource = model;
    customPlayerYaw = yaw180;
    customPlayerHint = wrapped.userData.orientationHint ?? null;
    if (opts.name) customPlayerName = opts.name;
    replaceShopkeeperMesh(wrapped);
    return { ok: true, hint: customPlayerHint, yaw180 };
  }

  function makeDefaultKeeper() {
    if (riggedPlayerGltf) {
      try {
        return wrapRiggedShopkeeper(riggedPlayerGltf, {
          chefHatOn: Boolean(state.chefHat),
          fishingRod: fishingRodGltf,
          fishingNet: fishingNetGltf,
      fillBucket: fillBucketGltf,
      fishingNet: fishingNetGltf,
      fillBucket: fillBucketGltf,
        });
      } catch (err) {
        console.warn('Rigged player skipped:', err?.message || err);
        riggedPlayerGltf = null;
      }
    }
    if (bundledPlayerSource) {
      return wrapShopPlayer(bundledPlayerSource, {
        chefHatOn: Boolean(state.chefHat),
      });
    }
    const next = buildShopkeeper({
      chefHat: Boolean(state.chefHat),
      appearance: state.appearance,
    });
    next.scale.setScalar(PLAYER_WORLD_SCALE);
    return next;
  }

  let shopkeeper = makeDefaultKeeper();
  bindGatherEvents(shopkeeper);
  const keeperGround = characterGroundY(SHOP.keeper.x, SHOP.keeper.z, state.expansions ?? []);
  shopkeeper.position.set(SHOP.keeper.x, keeperGround, SHOP.keeper.z);
  shopkeeper.userData.groundY = keeperGround;
  shopkeeper.rotation.y = 0.35;
  scene.add(shopkeeper);
  const clouds = buildClouds();
  scene.add(clouds);
  let sceneMode = 'shop';
  let pendingUse = null;
  let mining = null;
  // Face the waiting customer only after a counter click, until the next walk.
  let servingAtCounter = false;
  const COUNTER_TURN_SEC = 0.15;
  flaxGroup = new THREE.Group();
  flaxGroup.name = 'flax-field';
  scene.add(flaxGroup);
  flaxReady = true;
  refillFlaxField();
  wheatGroup = new THREE.Group();
  wheatGroup.name = 'wheat-field';
  scene.add(wheatGroup);
  wheatReady = true;
  refillWheatField();
  let lastPlaceClickAt = 0;
  const DUNGEON_FLOOR = { minX: -5.2, maxX: 5.2, minZ: -4.2, maxZ: 4.2 };
  const DUNGEON_BLOCKS = dungeonMoveObstacles(DUNGEON_BOULDERS);

  function planSceneWalk(from, to) {
    if (sceneMode === 'dungeon') {
      return planWalk(from, to, DUNGEON_BLOCKS, PLAYER_RADIUS, [DUNGEON_FLOOR], to?.releaseTree ?? null);
    }
    if (sceneMode === 'runefield') {
      return planWalk(from, to, runeFieldMoveObstacles(), PLAYER_RADIUS, [runeFieldRect()], to?.releaseTree ?? null);
    }
    return planPlayerWalk(from, to, state, PLAYER_RADIUS);
  }

  function playerCollide() {
    const release = pendingUse?.releaseTree ?? null;
    if (sceneMode === 'dungeon') {
      return { obstacles: DUNGEON_BLOCKS, floors: [DUNGEON_FLOOR], release };
    }
    if (sceneMode === 'runefield') {
      return { obstacles: runeFieldMoveObstacles(), floors: [runeFieldRect()], release };
    }
    return { obstacles: collideObstacles, floors: playerFloors, release };
  }
  const shopReturnPos = { x: SHOP.keeper.x, z: SHOP.keeper.z };
  const playerPath = [];
  queueMicrotask(() => { pushReady = true; });
  const moveMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf0c14a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  moveMarker.rotation.x = -Math.PI / 2;
  moveMarker.position.y = 0.1;
  moveMarker.visible = false;
  scene.add(moveMarker);

  function makeGlow(inner, outer) {
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.08;
    scene.add(glow);
    return glow;
  }

  function makePick(w, h, d, kind) {
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.userData.kind = kind;
    scene.add(pick);
    return pick;
  }

  const counterMesh = buildCounter();
  scene.add(counterMesh);
  const counterSpan = furnitureHalfSize('counter');
  const counterPick = makePick(counterSpan.hw * 2 + 0.16, 1.15, counterSpan.hd * 2 + 0.12, 'counter');
  counterPick.position.y = 0.55;
  const counterGlow = makeGlow(0.9, 1.12);

  const anvil = buildAnvil();
  scene.add(anvil);
  const anvilPick = makePick(STATION_HIT.anvil.w, STATION_HIT.anvil.h, STATION_HIT.anvil.d, 'anvil');

  const chest = buildChest();
  scene.add(chest);
  const chestPick = makePick(STATION_HIT.chest.w, STATION_HIT.chest.h, STATION_HIT.chest.d, 'chest');
  let chestOpen = false;

  const rangeMesh = buildRange();
  scene.add(rangeMesh);
  const rangePick = makePick(STATION_HIT.range.w, STATION_HIT.range.h, STATION_HIT.range.d, 'range');

  const cauldronMesh = buildCauldron();
  scene.add(cauldronMesh);
  const cauldronPick = makePick(STATION_HIT.cauldron.w, STATION_HIT.cauldron.h, STATION_HIT.cauldron.d, 'cauldron');

  const furnaceMesh = buildFurnace();
  scene.add(furnaceMesh);
  const furnacePick = makePick(STATION_HIT.furnace.w, STATION_HIT.furnace.h, STATION_HIT.furnace.d, 'furnace');

  const wheelMesh = buildSpinningWheel();
  scene.add(wheelMesh);
  const wheelPick = makePick(STATION_HIT.wheel.w, STATION_HIT.wheel.h, STATION_HIT.wheel.d, 'wheel');

  const rugMesh = buildRug();
  scene.add(rugMesh);
  const rugPick = makePick(SHOP_RUG.w, 0.28, SHOP_RUG.d, 'rug');

  const loomMesh = buildLoom();
  scene.add(loomMesh);
  const loomPick = makePick(STATION_HIT.loom.w, STATION_HIT.loom.h, STATION_HIT.loom.d, 'loom');

  const fletchMesh = buildFletchingBench();
  scene.add(fletchMesh);
  const fletchPick = makePick(STATION_HIT.fletch.w, STATION_HIT.fletch.h, STATION_HIT.fletch.d, 'fletch');

  const potterMesh = buildPotterWheel();
  scene.add(potterMesh);
  const potterPick = makePick(STATION_HIT.potter.w, STATION_HIT.potter.h, STATION_HIT.potter.d, 'potter');

  const sawmillMesh = buildSawmill();
  scene.add(sawmillMesh);
  const sawmillPick = makePick(STATION_HIT.sawmill.w, STATION_HIT.sawmill.h, STATION_HIT.sawmill.d, 'sawmill');

  const portalMesh = buildPortal();
  scene.add(portalMesh);
  const portalPick = makePick(STATION_HIT.portal.w, STATION_HIT.portal.h, STATION_HIT.portal.d, 'portal');

  const UNLOCK_STATIONS = ['cauldron', 'furnace', 'range', 'wheel', 'loom', 'fletch', 'potter', 'sawmill', 'portal'];

  const fixtureMeshes = {
    counter: { mesh: counterMesh, pick: counterPick, glow: counterGlow, pickY: 0.55 },
    anvil: { mesh: anvil, pick: anvilPick, glow: null, pickY: STATION_HIT.anvil.pickY },
    chest: { mesh: chest, pick: chestPick, glow: null, pickY: STATION_HIT.chest.pickY },
    range: { mesh: rangeMesh, pick: rangePick, glow: null, pickY: STATION_HIT.range.pickY },
    cauldron: { mesh: cauldronMesh, pick: cauldronPick, glow: null, pickY: STATION_HIT.cauldron.pickY },
    furnace: { mesh: furnaceMesh, pick: furnacePick, glow: null, pickY: STATION_HIT.furnace.pickY },
    wheel: { mesh: wheelMesh, pick: wheelPick, glow: null, pickY: STATION_HIT.wheel.pickY },
    loom: { mesh: loomMesh, pick: loomPick, glow: null, pickY: STATION_HIT.loom.pickY },
    fletch: { mesh: fletchMesh, pick: fletchPick, glow: null, pickY: STATION_HIT.fletch.pickY },
    potter: { mesh: potterMesh, pick: potterPick, glow: null, pickY: STATION_HIT.potter.pickY },
    sawmill: { mesh: sawmillMesh, pick: sawmillPick, glow: null, pickY: STATION_HIT.sawmill.pickY },
    portal: { mesh: portalMesh, pick: portalPick, glow: null, pickY: STATION_HIT.portal.pickY },
    rug: { mesh: rugMesh, pick: rugPick, glow: null, pickY: 0.18 },
  };

  function applyFixturePose(id) {
    const draft = placeDraft && placeDraft.id === id ? placeDraft : null;
    const pose = draft ?? state.furniture[id];
    const slot = fixtureMeshes[id];
    if (!slot) return;
    const owned = Boolean(pose);
    slot.mesh.visible = owned;
    slot.pick.visible = owned && !draft;
    if (slot.glow) slot.glow.visible = owned;
    if (!pose) return;
    const groundY = id === 'portal'
      ? characterGroundY(pose.x, pose.z, state.expansions ?? [])
      : (slot.mesh.userData.floorY ?? 0);
    slot.mesh.position.set(pose.x, groundY, pose.z);
    const yaw = furnitureVisualYaw(id, pose.rot);
    // Yaw only (same axis as furniture Rotate). Never pitch/roll stations onto a side.
    slot.mesh.rotation.set(0, yaw, 0);
    slot.pick.position.set(pose.x, slot.pickY, pose.z);
    slot.pick.rotation.set(0, yaw, 0);
    if (slot.glow) slot.glow.position.set(pose.x, 0.08, pose.z);
  }

  function makeDisplaySlot(spot, index, pose) {
    const anchor = new THREE.Group();
    anchor.position.set(pose.x, 0, pose.z);
    const furniture = buildFurniture(spot.kind);
    anchor.rotation.y = pose.rot ?? FURNITURE_FORWARD;
    scene.add(anchor);
    anchor.add(furniture);
    const wareAnchor = new THREE.Group();
    wareAnchor.position.y = furniture.userData.stand ? 0 : furniture.userData.wareY;
    anchor.add(wareAnchor);
    const span = furnitureHalfSize(spot.kind);
    const pickSize = spot.kind === 'stand'
      ? [span.hw * 2 + 0.12, 1.7, span.hd * 2 + 0.12]
      : spot.kind === 'shelf'
        ? [span.hw * 2 + 0.1, 1.05, span.hd * 2 + 0.08]
        : [span.hw * 2 + 0.16, 1.15, span.hd * 2 + 0.16];
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(...pickSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.position.y = spot.kind === 'shelf' ? 1.34 : spot.kind === 'stand' ? 0.95 : 0.6;
    pick.userData.kind = 'display';
    pick.userData.displayIndex = index;
    anchor.add(pick);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(spot.kind === 'stand' ? 0.32 : 0.72, spot.kind === 'stand' ? 0.44 : 0.86, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.1;
    anchor.add(glow);
    return {
      spot,
      anchor,
      furniture,
      wareAnchor,
      pick,
      glow,
      outline: null,
      wareMesh: null,
      slotMeshes: emptySlots(),
      shelfMeshes: emptyShelfSlots(),
    };
  }

  const displays = SHOP.displays.map((spot, index) => {
    const pose = state.furniture.displays[index] ?? { x: spot.x, z: spot.z, rot: FURNITURE_FORWARD };
    return makeDisplaySlot(spot, index, pose);
  });

  function poseForDisplay(index) {
    if (placeDraft?.id === 'display' && placeDraft.index === index) return placeDraft;
    return state.furniture.displays[index];
  }

  function applyDisplayPose(index) {
    const slot = displays[index];
    const pose = poseForDisplay(index);
    if (!slot || !pose) return;
    const removed = Boolean(state.displays[index]?.removed);
    slot.anchor.visible = !removed;
    slot.pick.visible = !removed && !(placeDraft?.id === 'display' && placeDraft.index === index);
    slot.anchor.position.set(pose.x, 0, pose.z);
    slot.anchor.rotation.y = pose.rot ?? FURNITURE_FORWARD;
  }

  function poseOf(target) {
    if (!target) return null;
    if (placeDraft && target.id === placeDraft.id) {
      const indexOk = (target.id !== 'display' && target.id !== 'farming_patch' && target.id !== 'piece')
        || target.index === placeDraft.index
        || (target.id === 'farming_patch' && placeDraft.index == null)
        || (target.id === 'piece' && (target.index == null || target.index === placeDraft.index));
      if (indexOk) return placeDraft;
    }
    if (target.id === 'piece') return state.furniture.placed?.[target.index] ?? null;
    if (target.id === 'farming_patch') return state.furniture.patches?.[target.index] ?? null;
    return target.id === 'display'
      ? state.furniture.displays[target.index]
      : state.furniture[target.id];
  }

  function applyMovePose(target) {
    if (!target) return;
    if (target.id === 'display') applyDisplayPose(target.index);
    else if (target.id === 'farming_patch') applyPatchGhost();
    else if (target.id === 'piece') applyPieceGhost();
    else applyFixturePose(target.id);
  }

  function rebuildSnapGrid() {
    disposeGroup(snapGrid);
    const group = new THREE.Group();
    group.name = 'snap-grid';
    group.visible = false;
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xe8c56a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      toneMapped: false,
    });
    const positions = [];
    const y = 0.108;
    const placeKind = moveTarget ? placeKindOf(moveTarget) : null;
    const gridRects = placeKind === 'portal'
      ? portalPlaceFloors(state.expansions ?? [])
      : placeKind === 'farming_patch' || placeKind === 'patch'
        ? patchPlaceFloors(state.expansions ?? [])
        : interiorFloors(state.expansions ?? []);
    for (const rect of gridRects) {
      const { xs, zs } = snapGridLines(rect);
      for (const gx of xs) {
        positions.push(gx, y, rect.minZ, gx, y, rect.maxZ);
      }
      for (const gz of zs) {
        positions.push(rect.minX, y, gz, rect.maxX, y, gz);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(geo, lineMat));
    const cell = new THREE.Mesh(
      new THREE.PlaneGeometry(FURNITURE_SNAP * 0.9, FURNITURE_SNAP * 0.9),
      new THREE.MeshBasicMaterial({
        color: 0xf0d27a,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    cell.rotation.x = -Math.PI / 2;
    cell.position.y = 0.12;
    cell.visible = false;
    group.add(cell);
    group.userData.cell = cell;
    snapGrid = group;
    scene.add(group);
  }

  function setSnapGridVisible(on) {
    if (!snapGrid) return;
    snapGrid.visible = Boolean(on);
    if (!on && snapGrid.userData.cell) snapGrid.userData.cell.visible = false;
  }

  function highlightSnapCell(x, z) {
    const cell = snapGrid?.userData.cell;
    if (!cell) return;
    cell.visible = true;
    cell.position.set(x, 0.12, z);
  }

  function previewFurnitureAt(x, z) {
    if (!moveTarget) return null;
    const kind = placeKindOf(moveTarget);
    const wallPiece = kind === 'piece' && constructionPiece(moveTarget.pieceId)?.mount === 'wall';
    const snapped = wallPiece
      ? snapToPieceWall(x, z, state.expansions ?? [], poseOf(moveTarget)?.rot, pieceWallFace(moveTarget.pieceId))
      : kind === 'shelf'
      ? snapToWallGrid(x, z, state.expansions ?? [], poseOf(moveTarget)?.rot)
      : kind === 'piece' && moveTarget.snap === false
        ? { x, z }
        : snapToFloor(x, z, activePlaceRects());
    const pose = poseOf(moveTarget);
    if (!pose) return snapped;
    pose.x = snapped.x;
    pose.z = snapped.z;
    if ((kind === 'shelf' || wallPiece) && snapped.rot != null) pose.rot = snapped.rot;
    applyMovePose(moveTarget);
    highlightSnapCell(snapped.x, snapped.z);
    return snapped;
  }

  function restoreMoveOrigin() {
    if (!moveTarget || !moveOrigin) return;
    const pose = poseOf(moveTarget);
    if (!pose) return;
    pose.x = moveOrigin.x;
    pose.z = moveOrigin.z;
    pose.rot = moveOrigin.rot;
    applyMovePose(moveTarget);
  }

  /** The object the player sees while placing/moving (ghost, station, shelf, patch). */
  function placeTintRoot(target = moveTarget) {
    if (!target) return null;
    if (target.id === 'piece') return pieceGhost;
    if (target.id === 'farming_patch') return patchGhost;
    if (target.id === 'display') return displays[target.index]?.anchor ?? null;
    return fixtureMeshes[target.id]?.mesh ?? null;
  }
  let tintedRoot = null;
  let tintKey = '';
  /** Green on a valid spot, red when blocked (the [data-place-note] text keeps the reason). */
  function updatePlaceTint() {
    const root = moveTarget ? placeTintRoot() : null;
    if (tintedRoot && tintedRoot !== root) setPlaceTint(tintedRoot, null);
    tintedRoot = root;
    if (!root) { tintKey = ''; return; }
    const pose = visualPlacePose();
    const key = pose ? `${pose.x.toFixed(3)},${pose.z.toFixed(3)},${(pose.rot ?? 0).toFixed(3)}` : 'none';
    if (key === tintKey && root.userData.placeTint) return;
    tintKey = key;
    setPlaceTint(root, blockedPlaceReason(pose) ? 'blocked' : 'valid');
  }
  function clearPlaceTint() {
    if (tintedRoot) setPlaceTint(tintedRoot, null);
    tintedRoot = null;
    tintKey = '';
  }

  function clearMoveMode() {
    clearPlaceTint();
    const kind = moveTarget ? placeKindOf(moveTarget) : null;
    const refreshGrid = kind === 'portal' || kind === 'farming_patch';
    if (kind === 'farming_patch') clearPatchGhost();
    if (kind === 'piece') {
      clearPieceGhost();
      syncPlacedMeshes();
    }
    moveTarget = null;
    moveOrigin = null;
    placeNeedsConfirm = false;
    placeDraft = null;
    setSnapGridVisible(false);
    if (refreshGrid) rebuildSnapGrid();
    if (kind === 'farming_patch' && patchesReady) syncPatchMeshes();
  }

  function discardPlaceDisplay() {
    if (placeDraft?.id !== 'display') return;
    const index = placeDraft.index;
    if (index == null || index < state.displays.length) return;
    const slot = displays[index];
    if (!slot) return;
    if (slot.outline) slot.anchor.remove(slot.outline);
    scene.remove(slot.anchor);
    displays.splice(index, 1);
  }

  function cancelPlaceOrMove() {
    if (!moveTarget) return;
    if (!placeNeedsConfirm) restoreMoveOrigin();
    const id = placeNeedsConfirm ? moveTarget.id : null;
    discardPlaceDisplay();
    clearMoveMode();
    if (id && id !== 'display' && id !== 'farming_patch') applyFixturePose(id);
  }

  function floorPointFromEvent(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    return floorClickPoint(clickHits());
  }

  function applyAllPoses() {
    for (const id of Object.keys(fixtureMeshes)) applyFixturePose(id);
    displays.forEach((_, index) => applyDisplayPose(index));
    if (patchesReady) syncPatchMeshes();
    rebuildNav();
  }
  applyAllPoses();

  const outlineEdgeMat = new THREE.LineBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0.98,
    toneMapped: false,
  });
  const outlineBoxMat = new THREE.LineBasicMaterial({
    color: 0xe3b34a,
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
  });
  const outlineHaloMat = new THREE.MeshBasicMaterial({
    color: 0xf0c14a,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    toneMapped: false,
  });
  const outlineScratch = {
    box: new THREE.Box3(),
    size: new THREE.Vector3(),
    center: new THREE.Vector3(),
    local: new THREE.Matrix4(),
    inverse: new THREE.Matrix4(),
  };
  let outlineKey = '';

  const customers = [];
  const remoteKeepers = createRemoteKeepers({
    scene,
    speed: PLAYER_SPEED,
    // Same model path as the local player (bundled rigged player, then the bundled
    // OBJ, then the procedural keeper), so other players look and animate the same.
    buildMesh: () => {
      const mesh = makeDefaultKeeper();
      mesh.name = 'coop-keeper';
      // Drop the built-in "You" tag; remote keepers get a name tag in their party colour.
      const tags = [];
      mesh.traverse((child) => {
        if (child.isSprite) tags.push(child);
      });
      for (const tag of tags) tag.parent?.remove(tag);
      return mesh;
    },
    planWalk: (from, to, scene) => (scene === 'shop' ? planPlayerWalk(from, to, state, PLAYER_RADIUS) : [to]),
    walkToward: (actor, goal, dt, speed) => walkToward(actor, goal, dt, speed),
    idle: (actor, dt, now) => {
      syncStance(actor.mesh);
      updateWalkPose(actor.mesh, false, dt, now);
    },
    setGather: (actor, mode) => {
      setHeldTool(actor.mesh, mode === 'mine' ? 'pickaxe' : mode === 'chop' ? 'hatchet' : null);
      setGatherClip(actor.mesh, mode || null);
    },
    gather: (actor, dt, now) => {
      syncStance(actor.mesh);
      updateMinePose(actor.mesh, dt, now);
    },
  });
  rebuildRemoteKeepers = () => remoteKeepers.api.rebuildAll();
  function emitLocalActivity(mode) {
    localActivityListener?.({ mode: mode || null, yaw: shopkeeper.rotation.y });
  }
  let nextSpawnAt = FIRST_CUSTOMER_DELAY;
  let lastBuyerSpawnAt = -Infinity;
  let firstSpawn = true;
  let customerSerial = 1;
  let pickHandler = null;
  let ignorePicksUntil = 0;
  let tradingId = null;
  let lastNow = 0;
  const goblins = [];

  function grassWanderPoint(from = null) {
    const grass = gardenBox(state.expansions ?? []);
    for (let i = 0; i < 28; i += 1) {
      const x = grass.minX + 1.4 + Math.random() * (grass.maxX - grass.minX - 2.8);
      const z = grass.minZ + 1.4 + Math.random() * (grass.maxZ - grass.minZ - 2.8);
      if (pointOnFloors(x, z, floors, 0.45)) continue;
      if (pointHitsShop(x, z, state.expansions ?? [], 1.05)) continue;
      if (pondBlocksSpot(x, z, 0.6)) continue;
      if (Math.abs(x) < 1.55 && z > 3.4) continue;
      if (from) {
        if (from.x < -2 && x > 1.2) continue;
        if (from.x > 2 && x < -1.2) continue;
        if (from.z > 4.2 && z < 1.5) continue;
        if (from.z < -2 && z > 2.2) continue;
      }
      return { x, z };
    }
    return { x: from?.x ?? -6.2, z: from?.z ?? 8.4 };
  }

  function releaseFlaxMesh(mesh) {
    flaxGroup?.remove(mesh);
    const procedural = Boolean(mesh?.userData?.flaxProcedural);
    mesh?.traverse((child) => {
      if (!child.isMesh) return;
      if (procedural || child.userData?.kind === 'flax') child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat?.dispose?.();
    });
  }

  function attachFlaxPick(mesh, node) {
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.62, 0.55),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    pick.position.y = 0.28;
    pick.userData.kind = 'flax';
    pick.userData.materialId = 'flax';
    pick.userData.name = 'Flax';
    pick.userData.plantId = node.id;
    pick.userData.x = node.x;
    pick.userData.z = node.z;
    mesh.add(pick);
  }

  function syncFlaxMeshes() {
    if (!flaxGroup) return;
    const alive = new Set();
    for (const node of flaxNodes) {
      if (!node.alive) continue;
      alive.add(node.id);
      let mesh = flaxMeshes.get(node.id);
      if (!mesh) {
        // Same as wheat: the pick sits on an unscaled holder so a scaled
        // flax model root can't shrink the right-click / long-press box.
        const holder = new THREE.Group();
        holder.name = 'flax-holder';
        const plant = buildFlaxPlant();
        holder.userData.flaxProcedural = Boolean(plant.userData?.flaxProcedural);
        plant.rotation.y = node.yaw ?? 0;
        holder.add(plant);
        attachFlaxPick(holder, node);
        flaxGroup.add(holder);
        mesh = holder;
        flaxMeshes.set(node.id, mesh);
      }
      mesh.position.set(node.x, 0, node.z);
      const pick = mesh.children.find((child) => child.userData?.kind === 'flax');
      if (pick) {
        pick.userData.x = node.x;
        pick.userData.z = node.z;
        pick.userData.plantId = node.id;
      }
    }
    for (const [id, mesh] of flaxMeshes) {
      if (alive.has(id)) continue;
      releaseFlaxMesh(mesh);
      flaxMeshes.delete(id);
    }
  }

  function livingCropSpots(nodes, spacing) {
    return nodes.filter((node) => node.alive).map((node) => ({ x: node.x, z: node.z, spacing }));
  }

  function shiftDecorOffPatch(pose) {
    if (!architecture || !pose) return;
    const hw = FARMING_PATCH_HALF;
    const hd = FARMING_PATCH_HALF;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    architecture.traverse((child) => {
      if (!child.isInstancedMesh) return;
      if (child.name !== 'flowers' && child.name !== 'grass') return;
      let moved = false;
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, matrix);
        matrix.decompose(pos, quat, scl);
        if (Math.abs(pos.x - pose.x) > hw || Math.abs(pos.z - pose.z) > hd) continue;
        const dx = pos.x - pose.x;
        const dz = pos.z - pose.z;
        if (Math.abs(dx) >= Math.abs(dz)) pos.x = pose.x + Math.sign(dx || 1) * (hw + 0.25);
        else pos.z = pose.z + Math.sign(dz || 1) * (hd + 0.25);
        matrix.compose(pos, quat, scl);
        child.setMatrixAt(i, matrix);
        moved = true;
      }
      if (moved) child.instanceMatrix.needsUpdate = true;
    });
  }

  function relocateCrop(nodes, roll, spacing) {
    let moved = false;
    for (const node of nodes) {
      if (!node.alive) continue;
      if (!spotInsidePatch(node.x, node.z)) continue;
      const occupied = nodes
        .filter((item) => item.alive && item !== node)
        .map((item) => ({ x: item.x, z: item.z, spacing }));
      const spot = roll(occupied);
      if (spot) {
        node.x = spot.x;
        node.z = spot.z;
      } else {
        node.alive = false;
        node.respawnAt = (lastNow || 0) + FLAX_RESPAWN_SEC;
      }
      moved = true;
    }
    return moved;
  }

  let shiftPatchPose = null;
  function spotInsidePatch(x, z) {
    const pose = shiftPatchPose;
    if (!pose) return false;
    return Math.abs(x - pose.x) <= FARMING_PATCH_HALF && Math.abs(z - pose.z) <= FARMING_PATCH_HALF;
  }

  function shiftPlantsOffPatch(pose) {
    shiftPatchPose = pose;
    const flaxMoved = relocateCrop(flaxNodes, (occupied) => (
      rollFlaxSpots(state.expansions ?? [], {
        count: 1,
        furniture: state.furniture,
        occupied: [...occupied, ...livingCropSpots(wheatNodes, WHEAT_SPACING)],
      })[0] ?? null
    ), FLAX_SPACING);
    const wheatMoved = relocateCrop(wheatNodes, (occupied) => (
      rollWheatSpots(state.expansions ?? [], {
        count: 1,
        furniture: state.furniture,
        occupied: [...occupied, ...livingCropSpots(flaxNodes, FLAX_SPACING)],
      })[0] ?? null
    ), WHEAT_SPACING);
    shiftPatchPose = null;
    if (flaxMoved) syncFlaxMeshes();
    if (wheatMoved) syncWheatMeshes();
    shiftDecorOffPatch(pose);
  }

  function refillFlaxField() {
    if (mining?.mode === 'pick') stopMining();
    for (const mesh of flaxMeshes.values()) releaseFlaxMesh(mesh);
    flaxMeshes.clear();
    const spots = rollFlaxSpots(state.expansions ?? [], {
      furniture: state.furniture,
      occupied: livingCropSpots(wheatNodes, WHEAT_SPACING),
    });
    flaxNodes = spots.map((spot) => ({
      id: flaxSerial++,
      x: spot.x,
      z: spot.z,
      alive: true,
      respawnAt: 0,
      yaw: Math.random() * Math.PI * 2,
    }));
    if (spots.length < FLAX_COUNT) {
      console.warn(`Flax field placed ${spots.length} of ${FLAX_COUNT} plants.`);
    }
    syncFlaxMeshes();
  }

  function tickFlax(now) {
    const changed = sproutDueFlax(flaxNodes, now, (occupied) => (
      rollFlaxSpots(state.expansions ?? [], {
        count: 1,
        furniture: state.furniture,
        occupied: [...occupied, ...livingCropSpots(wheatNodes, WHEAT_SPACING)],
      })[0] ?? null
    ));
    if (changed) syncFlaxMeshes();
  }

  function releaseWheatMesh(mesh) {
    wheatGroup?.remove(mesh);
    const procedural = Boolean(mesh?.userData?.wheatProcedural);
    mesh?.traverse((child) => {
      if (!child.isMesh) return;
      if (procedural || child.userData?.kind === 'wheat') child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat?.dispose?.();
    });
  }

  function attachWheatPick(mesh, node) {
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    pick.position.y = 0.4;
    pick.userData.kind = 'wheat';
    pick.userData.materialId = 'wheat';
    pick.userData.name = 'Wheat';
    pick.userData.plantId = node.id;
    pick.userData.x = node.x;
    pick.userData.z = node.z;
    mesh.add(pick);
  }

  function syncWheatMeshes() {
    if (!wheatGroup) return;
    const alive = new Set();
    for (const node of wheatNodes) {
      if (!node.alive) continue;
      alive.add(node.id);
      let mesh = wheatMeshes.get(node.id);
      if (!mesh) {
        // The pick sits on an unscaled holder. An OSRS wheat dump scales its
        // root, and a pick parented on that root shrinks to nothing.
        const holder = new THREE.Group();
        holder.name = 'wheat-holder';
        const plant = buildWheatPlant();
        holder.userData.wheatProcedural = Boolean(plant.userData?.wheatProcedural);
        plant.rotation.y = node.yaw ?? 0;
        holder.add(plant);
        attachWheatPick(holder, node);
        wheatGroup.add(holder);
        mesh = holder;
        wheatMeshes.set(node.id, mesh);
      }
      mesh.position.set(node.x, 0, node.z);
      const pick = mesh.children.find((child) => child.userData?.kind === 'wheat');
      if (pick) {
        pick.userData.x = node.x;
        pick.userData.z = node.z;
        pick.userData.plantId = node.id;
      }
    }
    for (const [id, mesh] of wheatMeshes) {
      if (alive.has(id)) continue;
      releaseWheatMesh(mesh);
      wheatMeshes.delete(id);
    }
  }

  function refillWheatField() {
    if (mining?.mode === 'pick' && mining.crop === 'wheat') stopMining();
    for (const mesh of wheatMeshes.values()) releaseWheatMesh(mesh);
    wheatMeshes.clear();
    const spots = rollWheatSpots(state.expansions ?? [], {
      furniture: state.furniture,
      occupied: livingCropSpots(flaxNodes, WHEAT_SPACING),
    });
    wheatNodes = spots.map((spot) => ({
      id: wheatSerial++,
      x: spot.x,
      z: spot.z,
      alive: true,
      respawnAt: 0,
      yaw: Math.random() * Math.PI * 2,
    }));
    if (spots.length < WHEAT_COUNT) {
      console.warn(`Wheat field placed ${spots.length} of ${WHEAT_COUNT} clumps.`);
    }
    syncWheatMeshes();
  }

  function tickWheat(now) {
    const changed = sproutDueFlax(wheatNodes, now, (occupied) => (
      rollWheatSpots(state.expansions ?? [], {
        count: 1,
        furniture: state.furniture,
        occupied: [...occupied, ...livingCropSpots(flaxNodes, WHEAT_SPACING)],
      })[0] ?? null
    ));
    if (changed) syncWheatMeshes();
  }

  const patchGroup = new THREE.Group();
  patchGroup.name = 'farming-patches';
  scene.add(patchGroup);
  let patchGhost = null;
  const placedGroup = new THREE.Group();
  placedGroup.name = 'construction-pieces';
  scene.add(placedGroup);
  let pieceGhost = null;

  function clearPieceGhost() {
    if (!pieceGhost) return;
    pieceGhost.removeFromParent();
    pieceGhost.traverse((child) => {
      if (!child.isMesh) return;
      // Geometry is shared with the cached bundled model; only the cloned ghost materials are ours.
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat?.dispose?.();
    });
    pieceGhost = null;
  }

  const PAINTING_CENTER_Y = 1.4; // shop walls: 2.7 m tall, centred at y 1.4 (shopbuild addRoomWalls)
  function pieceVisual(id) {
    const anim = animPieceVisual(pieceModelId(id), 0.01125 * (constructionPiece(id)?.scale ?? 1));
    if (anim) {
      const box = new THREE.Box3().setFromObject(anim, true);
      if (Number.isFinite(box.min.y) && !pieceHangs(id)) anim.position.y -= box.min.y;
      // Wall paintings: centre on the wall's vertical middle (render-time rule, so old saves follow too).
      else if (Number.isFinite(box.min.y)) anim.position.y += PAINTING_CENTER_Y - (box.min.y + box.max.y) / 2;
      anim.position.y += constructionPiece(id)?.wallY ?? 0;
      // Lit Torch GLB: pull it back so the body's back touches the wall (wall is local -Z at SHELF_FROM_WALL).
      if (pieceModelId(id) === 'lit_torch') {
        const body = anim.getObjectByName('body') ?? anim;
        anim.updateMatrixWorld(true);
        const bodyBox = new THREE.Box3().setFromObject(body, true);
        if (Number.isFinite(bodyBox.min.z)) anim.position.z += -SHELF_FROM_WALL - bodyBox.min.z;
      }
      return anim;
    }
    const look = getBundledLook(constructionLookId(id));
    if (look) {
      const mesh = look.clone(true);
      mesh.scale.setScalar(0.01125 * (constructionPiece(id)?.scale ?? 1));
      // Roll about the wall normal (Lit Torch model lies along +X; stand it flame-up).
      if (constructionPiece(id)?.roll) mesh.rotation.z = constructionPiece(id).roll;
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh, true);
      if (Number.isFinite(box.min.y) && !pieceHangs(id)) mesh.position.y -= box.min.y;
      // Wall paintings: centre on the wall's vertical middle (render-time rule, so old saves follow too).
      else if (Number.isFinite(box.min.y)) mesh.position.y += PAINTING_CENTER_Y - (box.min.y + box.max.y) / 2;
      mesh.position.y += constructionPiece(id)?.wallY ?? 0;
      return mesh;
    }
    const tint = constructionPiece(id)?.tint ?? 0xc4a06a;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 0.55),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.7 }),
    );
    const boxScale = constructionPiece(id)?.scale ?? 1;
    mesh.scale.setScalar(boxScale);
    mesh.position.y = 0.25 * boxScale;
    return mesh;
  }

  /**
   * Floor height under a placed piece: shop floor indoors, lawn outdoors. Pots and Pans
   * sit on a display/basic table top when dropped over one. Render-time, so saves/co-op need no new data.
   */
  function pieceBaseY(pieceId, x, z, skipIndex = null) {
    if (pieceHangs(pieceId)) return 0;
    if (pieceId === 'pots_and_pans') {
      const p = new THREE.Vector3();
      for (const slot of displays) {
        if (!slot?.anchor?.visible || slot.spot?.kind !== 'table' || slot.furniture?.userData?.stand) continue;
        const span = furnitureHalfSize('table');
        p.set(x, 0, z); slot.anchor.worldToLocal(p);
        if (Math.abs(p.x) <= span.hw && Math.abs(p.z) <= span.hd) {
          return slot.anchor.position.y + (slot.furniture.userData.wareY ?? 0.9);
        }
      }
      for (const anchor of placedGroup.children) {
        if (anchor.userData.pieceId !== 'basic_table' || anchor.userData.index === skipIndex) continue;
        const box = new THREE.Box3().setFromObject(anchor);
        if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) return box.max.y;
      }
    }
    return characterGroundY(x, z, state.expansions ?? []);
  }

  function applyPieceGhost() {
    const pose = placeDraft?.id === 'piece' ? placeDraft : null;
    if (!pose) return;
    if (!pieceGhost || pieceGhost.userData.pieceId !== pose.pieceId) {
      clearPieceGhost();
      pieceGhost = new THREE.Group();
      pieceGhost.name = 'construction-ghost';
      pieceGhost.userData.pieceId = pose.pieceId;
      const visual = ghostifyPieceVisual(pieceVisual(pose.pieceId), constructionPiece(pose.pieceId)?.tint);
      pieceGhost.add(visual);
      scene.add(pieceGhost);
    }
    pieceGhost.position.set(pose.x, pieceBaseY(pose.pieceId, pose.x, pose.z, pose.index), pose.z);
    pieceGhost.rotation.y = pose.rot ?? 0;
  }

  const wallFixedRows = new WeakSet();
  function syncPlacedMeshes() {
    const moving = placeDraft?.id === 'piece' ? placeDraft.index : null;
    const rows = state.furniture?.placed ?? [];
    while (placedGroup.children.length > rows.length) {
      const old = placedGroup.children[placedGroup.children.length - 1];
      old.removeFromParent();
      disposeAnimProp(old);
    }
    rows.forEach((row, index) => {
      // Blacksmiths' Tools became a wall piece: old floor-placed ones move to the nearest wall spot if one is close.
      if (row.id === 'blacksmiths_tools' && !wallFixedRows.has(row) && index !== moving) {
        const snap = snapToPieceWall(row.x, row.z, state.expansions ?? [], row.rot);
        if (snap && Number.isFinite(snap.x) && Math.hypot(snap.x - row.x, snap.z - row.z) < 2.5) {
          row.x = snap.x; row.z = snap.z; if (snap.rot != null) row.rot = snap.rot;
        }
        wallFixedRows.add(row);
      }
      let anchor = placedGroup.children[index];
      if (!anchor || anchor.userData.pieceId !== row.id) {
        anchor?.removeFromParent();
        disposeAnimProp(anchor);
        anchor = new THREE.Group();
        anchor.name = 'construction';
        anchor.userData.kind = 'construction';
        anchor.userData.pieceId = row.id;
        anchor.userData.index = index;
        const visual = pieceVisual(row.id);
        visual.traverse((child) => {
          if (!child.isMesh) return;
          child.userData.kind = 'construction';
          child.userData.index = index;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        anchor.add(visual);
        if (visual.userData.animProp?.fireLight) {
          let lights = 0;
          placedGroup.traverse((child) => { if (child.isPointLight) lights += 1; });
          if (lights < MAX_FIRE_LIGHTS) {
            anchor.updateMatrixWorld(true);
            addFireLight(anchor, visual);
          }
        }
        placedGroup.add(anchor);
      }
      anchor.userData.index = index;
      anchor.visible = moving !== index;
      anchor.position.set(row.x, 0, row.z);
      anchor.position.y = pieceBaseY(row.id, row.x, row.z, index);
      anchor.rotation.y = row.rot ?? 0;
      anchor.traverse((child) => {
        if (child.isMesh) child.userData.index = index;
      });
    });
  }

  function releasePatchObject(object) {
    if (!object) return;
    object.removeFromParent();
    object.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData?.kind === 'farming_patch') {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) mat?.dispose?.();
      } else if (child.userData?.patchGhost) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) mat?.dispose?.();
      }
    });
  }

  function ghostifyPatch(root) {
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const next = mats.map((mat) => {
        const copy = mat.clone();
        copy.transparent = true;
        copy.opacity = Math.min(copy.opacity ?? 1, 0.55);
        copy.depthWrite = false;
        return copy;
      });
      child.material = Array.isArray(child.material) ? next : next[0];
      child.userData.patchGhost = true;
    });
  }

  function syncPatchMeshes() {
    const keep = patchGhost;
    for (const child of [...patchGroup.children]) {
      if (child === keep) continue;
      releasePatchObject(child);
    }
    const poses = state.furniture?.patches ?? [];
    const movingIndex = placeDraft?.id === 'farming_patch' && placeDraft.index != null
      ? placeDraft.index
      : -1;
    poses.forEach((pose, index) => {
      const mesh = buildFarmingPatch();
      placeFarmingPatchMesh(mesh, pose, OUTDOOR_GROUND_Y);
      mesh.rotation.y = furnitureVisualYaw('farming_patch', pose.rot);
      if (index === movingIndex) mesh.visible = false;
      patchGroup.add(mesh);
      const { hw, hd } = furnitureHalfSize('patch');
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(hw * 2, 0.6, hd * 2),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      pick.position.set(pose.x, OUTDOOR_GROUND_Y + 0.3, pose.z);
      pick.userData.kind = 'farming_patch';
      pick.userData.index = index;
      pick.userData.x = pose.x;
      pick.userData.z = pose.z;
      if (index === movingIndex) pick.visible = false;
      patchGroup.add(pick);
    });
  }

  function clearPatchGhost() {
    releasePatchObject(patchGhost);
    patchGhost = null;
  }

  function applyPatchGhost() {
    if (placeDraft?.id !== 'farming_patch') return;
    if (!patchGhost) {
      patchGhost = buildFarmingPatch();
      patchGhost.name = 'farming-patch-ghost';
      ghostifyPatch(patchGhost);
      patchGroup.add(patchGhost);
    }
    patchGhost.position.set(placeDraft.x, OUTDOOR_GROUND_Y, placeDraft.z);
    patchGhost.rotation.y = furnitureVisualYaw('farming_patch', placeDraft.rot);
  }

  patchesReady = true;
  syncPatchMeshes();
  syncPlacedMeshes();

  function pickCrop(crop) {
    if (crop === 'wheat') {
      return {
        crop: 'wheat',
        nodes: wheatNodes,
        meshes: wheatMeshes,
        group: wheatGroup,
        kind: 'wheat',
        name: 'Wheat',
        materialId: 'wheat',
        yield: pickYield(state, 'wheat'),
        duration: WHEAT_DURATION,
        grant: grantPickedWheat,
        sync: syncWheatMeshes,
      };
    }
    return {
      crop: 'flax',
      nodes: flaxNodes,
      meshes: flaxMeshes,
      group: flaxGroup,
      kind: 'flax',
      name: 'Flax',
      materialId: 'flax',
      yield: pickYield(state, 'flax'),
      duration: FLAX_DURATION,
      grant: grantPickedFlax,
      sync: syncFlaxMeshes,
    };
  }

  function makeGoblinMesh() {
    if (riggedGoblinGltf) {
      try {
        return wrapRiggedGoblin(riggedGoblinGltf);
      } catch (err) {
        console.warn('Rigged goblin skipped:', err?.message || err);
        riggedGoblinGltf = null;
      }
    }
    return buildGoblin();
  }

  function spawnGoblins() {
    for (const gob of goblins) scene.remove(gob.mesh);
    goblins.length = 0;
    for (let i = 0; i < GOBLIN_COUNT; i += 1) {
      const start = grassWanderPoint();
      const mesh = makeGoblinMesh();
      mesh.position.set(start.x, 0, start.z);
      scene.add(mesh);
      goblins.push({
        mesh,
        goal: grassWanderPoint(start),
        waitUntil: 0,
      });
    }
  }
  spawnGoblins();

  function updateGoblins(dt, now) {
    for (const gob of goblins) {
      if (now < gob.waitUntil) {
        gob.mesh.rotation.y += dt * 0.4;
        if (gob.mesh.userData.clipLocomotion) gob.mesh.userData.clipLocomotion.speed = 0;
        updateWalkPose(gob.mesh, false, dt, now);
        continue;
      }
      const pos = gob.mesh.position;
      const dx = gob.goal.x - pos.x;
      const dz = gob.goal.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.18) {
        gob.waitUntil = now + 1.2 + Math.random() * 2.4;
        gob.goal = grassWanderPoint({ x: pos.x, z: pos.z });
        continue;
      }
      const step = 0.72 * dt;
      const t = Math.min(1, step / dist);
      const nx = pos.x + dx * t;
      const nz = pos.z + dz * t;
      if (pointHitsShop(nx, nz, state.expansions ?? [], 0.95) || pointOnFloors(nx, nz, floors, 0.4) || pondBlocksSpot(nx, nz, 0.3)) {
        gob.goal = grassWanderPoint({ x: pos.x, z: pos.z });
        gob.waitUntil = now + 0.35;
        continue;
      }
      pos.x = nx;
      pos.z = nz;
      gob.mesh.rotation.y = Math.atan2(dx, dz);
      if (gob.mesh.userData.clipLocomotion) {
        gob.mesh.userData.clipLocomotion.speed = dt > 0 ? (dist * t) / dt : 0;
      }
      updateWalkPose(gob.mesh, true, dt, now);
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerDown = { x: 0, y: 0, t: 0 };

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  onLayoutChange(resize);

  function shopUsePicks() {
    const found = [];
    architecture?.traverse((child) => {
      if (child.userData?.kind === 'trapdoor') found.push(child);
      if (child.userData?.kind === 'fountain') found.push(child);
      if (child.userData?.kind === 'fishing_spot') found.push(child);
      if (child.userData?.kind === 'tree' && !child.userData.depleted && !isTreeStump(child.userData.x, child.userData.z)) {
        found.push(child);
      }
    });
    flaxGroup?.traverse((child) => {
      if (child.userData?.kind === 'flax') found.push(child);
    });
    wheatGroup?.traverse((child) => {
      if (child.userData?.kind === 'wheat') found.push(child);
    });
    patchGroup?.traverse((child) => {
      if (child.userData?.kind === 'farming_patch') found.push(child);
    });
    placedGroup?.traverse((child) => {
      if (child.userData?.kind === 'construction') found.push(child);
    });
    return found;
  }

  function dungeonUsePicks() {
    const found = [];
    dungeon?.root?.traverse((child) => {
      if (child.userData?.kind === 'ladder' || child.userData?.kind === 'boulder') found.push(child);
    });
    return found;
  }

  function runeFieldUsePicks() {
    const found = [];
    runeField?.root?.traverse((child) => {
      if (child.userData?.kind === 'rune-portal' || child.userData?.kind === 'altar') found.push(child);
      if (child.userData?.kind === 'tree' && !child.userData.depleted && !isTreeStump(child.userData.x, child.userData.z)) {
        found.push(child);
      }
    });
    return found;
  }

  function allPicks() {
    if (sceneMode === 'dungeon') return dungeonUsePicks();
    if (sceneMode === 'runefield') return runeFieldUsePicks();
    const extra = expandMode && padGroup
      ? padGroup.children.filter((child) => child.userData.kind === 'expand-pad')
      : [];
    return [
      ...displays.map((d) => d.pick).filter((pick) => pick.visible),
      chestPick,
      anvilPick,
      rangePick,
      ...UNLOCK_STATIONS.filter((id) => state.furniture[id]).map((id) => fixtureMeshes[id].pick),
      counterPick,
      ...(state.furniture.rug ? [rugPick] : []),
      ...extra,
      ...shopUsePicks(),
      ...customers
        .filter((actor) => actor.state === 'request')
        .map((actor) => actor.mesh.userData.pick)
        .filter(Boolean),
    ];
  }

  function groundMeshes() {
    if (sceneMode === 'dungeon') return dungeon?.grounds?.children ?? [];
    if (sceneMode === 'runefield') return runeField?.grounds?.children ?? [];
    const list = [];
    const add = (obj) => {
      if (obj?.isMesh && (obj.userData?.kind === 'ground' || obj.userData?.kind === 'rug')) list.push(obj);
    };
    groundGroup?.children.forEach(add);
    architecture?.traverse((child) => add(child));
    fixtureMeshes.rug?.mesh?.traverse((child) => add(child));
    return list;
  }

  function shellMeshes() {
    const list = [];
    const add = (obj) => {
      if (!obj?.isMesh) return;
      const parent = obj.parent;
      if (
        obj.userData?.shopWall
        || obj.userData?.isRoof
        || obj.name === 'roof-gable'
        || parent?.userData?.isRoof
        || parent?.name === 'roofs'
      ) list.push(obj);
    };
    architecture?.traverse(add);
    roofGroup?.traverse(add);
    return list;
  }

  function clickHits() {
    const targets = [...allPicks(), ...groundMeshes(), ...shellMeshes()];
    return raycaster.intersectObjects(targets, false)
      .filter((hit) => !ignoredClickObject(hit.object));
  }

  function counterPose() {
    return state.furniture.counter;
  }

  function clampCam() {
    cam.pitch = Math.min(CAM_MAX_PITCH, Math.max(CAM_MIN_PITCH, cam.pitch));
    cam.distance = Math.min(CAM_MAX_DISTANCE, Math.max(CAM_MIN_DISTANCE, cam.distance));
  }

  function releaseHeldFlax(restoreGround) {
    const visual = mining?.heldFlax;
    if (visual) {
      visual.removeFromParent();
      mining.heldFlax = null;
    }
    if (!restoreGround || mining?.plantId == null) return;
    const field = pickCrop(mining.crop);
    const node = field.nodes.find((item) => item.id === mining.plantId && item.alive);
    const mesh = field.meshes.get(mining.plantId);
    if (node && mesh) mesh.visible = true;
  }

  function holdFlaxVisual() {
    if (!mining || mining.mode !== 'pick' || mining.heldFlax) return;
    const field = pickCrop(mining.crop);
    const node = field.nodes.find((item) => item.id === mining.plantId && item.alive);
    const mesh = field.meshes.get(mining.plantId);
    const hand = shopkeeper.getObjectByName('Hand_R') || shopkeeper.userData.hand;
    if (!node || !mesh || !hand) return;
    mesh.visible = false;
    const visual = mesh.clone(true);
    visual.visible = true;
    visual.traverse((child) => {
      if (child.userData?.kind === field.kind) child.visible = false;
    });
    field.group.add(visual);
    visual.position.copy(mesh.position);
    visual.quaternion.copy(mesh.quaternion);
    visual.scale.copy(mesh.scale);
    visual.updateMatrixWorld(true);
    hand.attach(visual);
    visual.userData.restScale = visual.scale.clone();
    mining.heldFlax = visual;
  }

  function updateHeldFlax(t) {
    const visual = mining?.heldFlax;
    const rest = visual?.userData?.restScale;
    if (!visual || !rest || t == null) return;
    if (t >= 1.4) {
      const u = Math.min(1, (t - 1.4) / 0.1);
      visual.scale.copy(rest).multiplyScalar(1 - u);
      visual.visible = u < 0.999;
      return;
    }
    visual.visible = true;
    visual.scale.copy(rest);
  }

  function onGatherEvent(name) {
    if (!mining) return;
    if (mining.mode === 'pick' && name === 'lift') holdFlaxVisual();
    if (mining.mode === 'pick' && name === 'wrap') releaseHeldFlax(true);
  }

  function faceGather(pose) {
    if (!pose) return;
    if (Number.isFinite(pose.faceYaw)) {
      shopkeeper.rotation.y = pose.faceYaw;
      return;
    }
    shopkeeper.rotation.y = Math.atan2(pose.x - shopkeeper.position.x, pose.z - shopkeeper.position.z);
  }

  function stopMining() {
    if (!mining) return;
    releaseHeldFlax(true);
    mining = null;
    setHeldTool(shopkeeper, null);
    setGatherClip(shopkeeper, null);
    emitLocalActivity(null);
  }

  function barYield(session) {
    if (session?.mode === 'chop') return chopYield(session.materialId);
    if (session?.mode === 'fish') return session.yield ?? fishTiming(session.materialId).yield;
    if (session?.mode === 'pick') return session.yield ?? FLAX_YIELD;
    if (session?.mode === 'fill') return waterFillYield(state);
    // Always read the rock table. A stored 0 must not hide bronze's +5.
    return mineYield(session?.materialId);
  }

  function refuseGather(materialId) {
    if (!materialId || meetsGatherLevel(state, materialId)) return false;
    const text = gatherBlockText(materialId);
    pushLog(state, text);
    pickHandler?.({ type: 'gather-block', text });
    return true;
  }

  function refuseFull(materialId) {
    if (!materialId || !materialIsFull(state, materialId)) return false;
    const text = gatherFullMessage(materialId);
    pushLog(state, text);
    pickHandler?.({ type: 'gather-block', text });
    return true;
  }

  function findGardenPine(x, z) {
    const key = treeSpotKey(x, z);
    let found = null;
    const visit = (root) => {
      root?.traverse((child) => {
        if (found || child.name !== 'pine') return;
        if (treeSpotKey(child.position.x, child.position.z) === key) found = child;
      });
    };
    visit(architecture);
    visit(runeField?.root);
    return found;
  }

  function startMining(materialId, pose) {
    const mat = MATERIALS[materialId];
    if (!mat || refuseGather(materialId) || refuseFull(materialId)) return;
    const timing = mineTiming(materialId);
    mining = {
      materialId,
      name: mat.name,
      mode: 'mine',
      startedAt: performance.now() / 1000,
      duration: timing.duration,
      yield: timing.yield,
      x: pose?.x ?? shopkeeper.position.x,
      z: pose?.z ?? shopkeeper.position.z,
      faceYaw: Number.isFinite(pose?.faceYaw) ? pose.faceYaw : null,
    };
    setHeldTool(shopkeeper, 'pickaxe');
    faceGather(pose);
    setGatherClip(shopkeeper, 'mine');
    emitLocalActivity('mine');
  }

  function startChopping(pose) {
    if (!pose || !treeCanChop(pose.x, pose.z)) return;
    ensureTreeNode(pose.x, pose.z);
    const materialId = MATERIALS[pose.materialId]?.log ? pose.materialId : 'logs';
    if (refuseGather(materialId) || refuseFull(materialId)) return;
    mining = {
      materialId,
      name: MATERIALS[materialId]?.name ?? 'Tree',
      mode: 'chop',
      startedAt: performance.now() / 1000,
      duration: CHOP_DURATION,
      yield: chopYield(materialId),
      x: pose.x,
      z: pose.z,
      faceYaw: Number.isFinite(pose?.faceYaw) ? pose.faceYaw : null,
    };
    setHeldTool(shopkeeper, 'hatchet');
    faceGather(pose);
    setGatherClip(shopkeeper, 'chop');
    emitLocalActivity('chop');
  }

  /** Same loop as mining: one bar per catch, fixed yield, level-gated per spot. */
  function startFishing(pose) {
    const spot = fishingSpotById(pose?.materialId);
    if (!spot || refuseGather(spot.materialId) || refuseFull(spot.materialId)) return;
    const timing = fishTiming(spot.materialId);
    mining = {
      materialId: spot.materialId,
      name: MATERIALS[spot.materialId]?.name ?? 'Fish',
      mode: 'fish',
      spotId: spot.id,
      startedAt: performance.now() / 1000,
      duration: timing.duration,
      yield: timing.yield,
      x: spot.x,
      z: spot.z,
      faceYaw: Number.isFinite(pose?.faceYaw) ? pose.faceYaw : spot.face,
    };
    // Net catches (shrimp) scoop with Rig's NetFish + net; rod catches keep Cast/Fish.
    const useNet = isNetCatch(spot.materialId) && setGatherClip(shopkeeper, 'netfish') && shopkeeper.userData?.net;
    setHeldTool(shopkeeper, useNet ? 'net' : 'rod');
    faceGather({ x: spot.x, z: spot.z, faceYaw: mining.faceYaw });
    // Rig's player clip named "fish" plays when the rig has one; otherwise the mine loop pose.
    if (!useNet) setGatherClip(shopkeeper, 'fish');
  }

  function syncTreeVisuals() {
    const visit = (root) => {
      root?.traverse((child) => {
        if (child.name !== 'pine' || child.userData?.gardenSide == null) return;
        if (child.userData?.toppling) return;
        const node = ensureTreeNode(child.position.x, child.position.z);
        setTreeFallen(child, !node.alive);
      });
    };
    visit(architecture);
    visit(runeField?.root);
  }

  function fellChoppedTree(x, z, now) {
    const result = completeTreeChop(x, z, now);
    if (!result.felled) return false;
    playSfx('tree_fall');
    const fallingTree = findGardenPine(x, z);
    if (startTreeTopple(fallingTree, now)) topplingTrees.add(fallingTree);
    syncTreeVisuals();
    rebuildNav();
    if (
      pendingUse?.type === 'tree'
      && isTreeStump(pendingUse.nodeX ?? pendingUse.x, pendingUse.nodeZ ?? pendingUse.z)
    ) {
      pendingUse = null;
      playerPath.length = 0;
      moveMarker.visible = false;
    }
    stopMining();
    pushLog(state, 'The tree falls.');
    return true;
  }

  function tickTrees(now) {
    const revived = reviveDueTrees(now);
    if (!revived.length) return;
    syncTreeVisuals();
    rebuildNav();
  }

  // Only trees mid-fall are ticked, instead of walking the whole scene every frame.
  const topplingTrees = new Set();
  function tickTopples(now) {
    if (!topplingTrees.size) return;
    for (const tree of topplingTrees) {
      if (!tree?.userData?.toppling) { topplingTrees.delete(tree); continue; }
      if (tickTreeTopple(tree, now)) topplingTrees.delete(tree);
    }
  }

  function startFountainFill(pose) {
    if (refuseFull('water')) return;
    if (mining?.mode === 'pick') releaseHeldFlax(true);
    const now = performance.now() / 1000;
    mining = {
      ...createFountainFill(now),
      x: pose?.x ?? FOUNTAIN.x,
      z: pose?.z ?? FOUNTAIN.z,
      faceYaw: Number.isFinite(pose?.faceYaw) ? pose.faceYaw : null,
    };
    setHeldTool(shopkeeper, null);
    faceGather(pose ?? { x: FOUNTAIN.x, z: FOUNTAIN.z });
    if (setGatherClip(shopkeeper, 'fillbucket')) restartFillBucket(shopkeeper);
    else setGatherClip(shopkeeper, 'pick');
    emitLocalActivity('pick');
  }

  function fillFromFountain(pose) {
    startFountainFill(pose);
  }

  /** Placed Construction fountain (any rot/scale): same four stands + FillBucket as the built-in one. */
  function isFountainPiece(index) {
    return state.furniture?.placed?.[index]?.id === 'lumbridge_fountain';
  }
  function fillAtFountainPiece(index) {
    const row = state.furniture?.placed?.[index];
    if (!row || row.id !== 'lumbridge_fountain') return false;
    queueUse('fountain', { x: row.x, z: row.z, rot: row.rot ?? 0, scale: constructionPiece(row.id)?.scale ?? 1 });
    return true;
  }
  /** Pond: walk to the nearest dry shore point the player can stand on, face the water, fill. */
  function fillAtPond(point) {
    const target = point && Number.isFinite(point.x) ? point : { x: POND.x, z: POND.z };
    const blocks = playerObstacles(state);
    const canStand = (x, z) => isWalkable(x, z, blocks, PLAYER_RADIUS, playerFloors);
    const stands = pondStands(target, (x, z) => pointInPond(x, z, 0.05) || pointOnDock(x, z, 0.05), canStand,
      pointInPond(target.x, target.z) ? target : { x: POND.x, z: POND.z });
    if (!stands.length) return false;
    queueUse('pond', { x: target.x, z: target.z, stands });
    return true;
  }

  function startPicking(pose) {
    const field = pickCrop(pose?.materialId === 'wheat' ? 'wheat' : 'flax');
    const node = field.nodes.find((item) => item.id === pose?.plantId && item.alive);
    if (!node || refuseGather(field.materialId) || refuseFull(field.materialId)) return;
    mining = {
      materialId: field.materialId,
      name: field.name,
      mode: 'pick',
      crop: field.crop,
      plantId: node.id,
      startedAt: performance.now() / 1000,
      duration: field.duration,
      yield: field.yield,
      x: node.x,
      z: node.z,
      faceYaw: Number.isFinite(pose?.faceYaw) ? pose.faceYaw : null,
    };
    setHeldTool(shopkeeper, null);
    faceGather({ x: node.x, z: node.z, faceYaw: pose?.faceYaw });
    setGatherClip(shopkeeper, 'pick');
    emitLocalActivity('pick');
  }

  function tickMining(now) {
    if (!mining) return;
    if (mining.mode === 'fill') {
      // Same bar as advanceFountainFill(); the water itself goes through the intent bus (co-op safe).
      if (now - mining.startedAt < mining.duration) return;
      const got = intentBus.run({ type: 'gather', mode: 'water' }) || 0;
      if (got <= 0) {
        pushLog(state, gatherFullMessage('water'));
        stopMining();
        return;
      }
      pushLog(state, `Filled ${got} ${got === 1 ? 'Bucket' : 'Buckets'} of water.`);
      pickHandler?.({ type: 'drew-water', amount: got });
      mining = { ...mining, startedAt: now };
      if (shopkeeper.userData?.clipLocomotion?.gather === 'fillbucket') restartFillBucket(shopkeeper);
      return;
    }
    if (now - mining.startedAt < mining.duration) return;
    if (mining.mode === 'pick') {
      releaseHeldFlax(false);
      const field = pickCrop(mining.crop);
      const got = intentBus.run({ type: 'gather', mode: 'pick', materialId: field.materialId }) || 0;
      if (got > 0) {
        pushLog(state, `Picked ${got} ${field.name}.`);
        pickHandler?.({
          type: 'picked',
          materialId: field.materialId,
          amount: got,
        });
        pickFlaxNode(field.nodes, mining.plantId, now);
        field.sync();
      } else {
        pushLog(state, gatherFullMessage(field.materialId));
      }
      stopMining();
      return;
    }
    if (mining.mode === 'chop' && isTreeStump(mining.x, mining.z)) {
      stopMining();
      return;
    }
    const got = intentBus.run({
      type: 'gather',
      mode: mining.mode === 'chop' ? 'chop' : mining.mode === 'fish' ? 'fish' : 'mine',
      materialId: mining.materialId,
    }) || 0;
    if (got <= 0) {
      const text = gatherFullMessage(mining.materialId);
      pushLog(state, text);
      pickHandler?.({ type: 'gather-block', text });
      stopMining();
      return;
    }
    if (got > 0) {
      const choppedName = MATERIALS[mining.materialId]?.name ?? 'Logs';
      pushLog(state, mining.mode === 'chop'
        ? `Chopped ${got} ${choppedName}.`
        : mining.mode === 'fish'
          ? `Caught ${got} ${mining.name}.`
          : `Mined ${got} ${mining.name}.`);
      pickHandler?.({
        type: mining.mode === 'chop' ? 'chopped' : mining.mode === 'fish' ? 'caught' : 'mined',
        materialId: mining.materialId,
        amount: got,
      });
      if (mining.mode !== 'chop' && mining.mode !== 'fish') tutorialEmit(`mined:${mining.materialId}`);
    }
    if (mining.mode === 'chop' && got > 0 && fellChoppedTree(mining.x, mining.z, now)) return;
    mining.startedAt = now;
  }

  function shortestYawDelta(current, target) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function turnYaw(current, target, dt) {
    const delta = shortestYawDelta(current, target);
    const maxStep = (Math.PI / COUNTER_TURN_SEC) * Math.max(0, dt);
    if (Math.abs(delta) <= maxStep) return target;
    return current + Math.sign(delta) * maxStep;
  }

  /** Across the counter, toward the queue and the shop door. */
  function counterFloorYaw() {
    const rot = counterPose()?.rot ?? 0;
    return Math.atan2(Math.sin(rot), Math.cos(rot));
  }

  function counterLookYaw() {
    const front = waitingLine()[0];
    if (front) {
      const dx = front.mesh.position.x - shopkeeper.position.x;
      const dz = front.mesh.position.z - shopkeeper.position.z;
      if (Math.hypot(dx, dz) > 0.05) return Math.atan2(dx, dz);
    }
    return counterFloorYaw();
  }

  function faceCounterCustomer(dt) {
    if (!servingAtCounter || sceneMode !== 'shop') return;
    shopkeeper.rotation.y = turnYaw(shopkeeper.rotation.y, counterLookYaw(), dt);
  }

  /** Final point of the current walk, so a snag mid-route can re-plan once. */
  let walkGoal = null;

  function applyWalkPath(path) {
    if (!path?.length) return false;
    servingAtCounter = false;
    stopMining();
    playerPath.length = 0;
    playerPath.push(...path);
    const goal = path[path.length - 1];
    walkGoal = { x: goal.x, z: goal.z, replanned: false };
    moveMarker.position.set(goal.x, 0.1, goal.z);
    moveMarker.visible = true;
    localMoveListener?.({ x: goal.x, z: goal.z, scene: sceneMode });
    pickHandler?.({ type: 'player-move' });
    tutorialEmit('walked');
    return true;
  }

  function setMoveTarget(x, z) {
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const path = planSceneWalk(from, { x, z });
    if (!path.length) {
      playerPath.length = 0;
      moveMarker.visible = false;
      return false;
    }
    // A walk click always ends a gather loop; otherwise the chop pose keeps the player rooted.
    if (mining) stopMining();
    return applyWalkPath(path);
  }

  function syncStance(mesh) {
    // Live expansion list: a bought room raises feet, a reset drops that floor away.
    mesh.userData.groundY = sceneMode === 'shop'
      ? characterGroundY(mesh.position.x, mesh.position.z, state.expansions ?? [])
      : OUTDOOR_GROUND_Y;
    return mesh.userData.groundY;
  }

  function walkToward(actor, goal, dt, speed = CUSTOMER_SPEED) {
    const pos = actor.mesh.position;
    const dx = goal.x - pos.x;
    const dz = goal.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      if (actor.mesh.userData.clipLocomotion) actor.mesh.userData.clipLocomotion.speed = 0;
      syncStance(actor.mesh);
      updateWalkPose(actor.mesh, false, dt, performance.now() / 1000);
      return true;
    }
    const step = Math.min(speed * dt, dist);
    const actualSpeed = dt > 0 ? step / dt : 0;
    const t = dist > 0 ? step / dist : 1;
    let nx = pos.x + dx * t;
    let nz = pos.z + dz * t;
    let blocked = false;
    if (actor.collide) {
      const moved = moveWithCollision(
        pos.x,
        pos.z,
        nx,
        nz,
        actor.collide.obstacles,
        WALK_COLLIDE_RADIUS,
        actor.collide.floors,
        actor.collide.release ?? null,
      );
      nx = moved.x;
      nz = moved.z;
      blocked = moved.blocked && Math.hypot(nx - pos.x, nz - pos.z) < 1e-4;
    }
    const stepX = nx - pos.x;
    const stepZ = nz - pos.z;
    pos.x = nx;
    pos.z = nz;
    if (Math.hypot(stepX, stepZ) > 1e-4) {
      actor.mesh.rotation.y = Math.atan2(stepX, stepZ);
    }
    if (actor.mesh.userData.clipLocomotion) {
      actor.mesh.userData.clipLocomotion.speed = blocked ? 0 : actualSpeed;
    }
    syncStance(actor.mesh);
    updateWalkPose(actor.mesh, !blocked, dt, performance.now() / 1000);
    return blocked ? 'blocked' : false;
  }

  function approachPoint(pose) {
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const near = { x: pose.x, z: pose.z + 0.85 };
    const snapped = planSceneWalk(from, near);
    if (snapped.length) return snapped[snapped.length - 1];
    return near;
  }

  function isNearPose(pose, dist = 1.15) {
    return Math.hypot(shopkeeper.position.x - pose.x, shopkeeper.position.z - pose.z) <= dist;
  }

  function queueUse(type, pose) {
    if (!pose) return;
    if (type === 'tree' && !treeCanChop(pose.x, pose.z)) return;
    const gatherId = type === 'tree'
      ? (pose.materialId ?? 'logs')
      : type === 'wheat'
        ? 'wheat'
        : type === 'flax'
          ? 'flax'
          : type === 'boulder' || type === 'fishing_spot'
            ? pose.materialId
            : null;
    if (gatherId && refuseGather(gatherId)) return;
    if (type !== 'counter') servingAtCounter = false;
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const arrive = type === 'wheat'
      ? WHEAT_ARRIVE
      : type === 'flax'
        ? FLAX_ARRIVE
        : type === 'fountain' || type === 'pond'
          ? 0.45
          : type === 'trapdoor' || type === 'ladder'
            ? 1.35
            : STATION_ARRIVE;
    const standFloors = sceneMode === 'dungeon'
      ? [DUNGEON_FLOOR]
      : sceneMode === 'runefield'
        ? [runeFieldRect()]
        : playerFloors;
    const standBlocks = sceneMode === 'dungeon'
      ? DUNGEON_BLOCKS
      : sceneMode === 'runefield'
        ? runeFieldMoveObstacles()
        : playerObstacles(state);
    const canStand = (x, z) => isWalkable(x, z, standBlocks, PLAYER_RADIUS, standFloors);
    const plan = resolveStationUse(from, pose, state, planSceneWalk, type, canStand);
    const gatherKind = type === 'tree' || type === 'boulder' || type === 'flax' || type === 'wheat' || type === 'fishing_spot';
    const standFront = type === 'counter' || type === 'chest' || type === 'range' || type === 'furnace' || type === 'fletch' || type === 'ladder' || gatherKind || type === 'fountain' || type === 'pond' || type === 'farming_patch';
    const faceYaw = plan.face != null
      ? plan.face
      : type === 'range' ? rangeFaceYaw(pose)
        : type === 'furnace' ? furnaceFaceYaw(pose)
          : type === 'fletch' ? fletchFaceYaw(pose)
            : null;
    const standArrive = type === 'fountain' || type === 'pond'
      ? 0.45
      : gatherKind
        ? (type === 'flax' || type === 'wheat' ? 0.22 : 0.32)
        : 0.55;
    const atStation = standFront
      ? plan.action === 'open'
      : (plan.action === 'open' || isNearPose(pose, arrive));
    const aimed = faceYaw == null ? pose : { ...pose, faceYaw };
    const remember = (dest, arriveDist, openOnArrive) => {
      pendingUse = {
        type,
        x: dest.x,
        z: dest.z,
        arrive: arriveDist,
        openOnArrive,
        materialId: pose.materialId,
        plantId: pose.plantId,
        element: pose.element,
        faceYaw,
        nodeX: pose.x,
        nodeZ: pose.z,
        releaseTree: dest?.releaseTree ?? null,
        patchIndex: pose.index,
      };
    };
    if (atStation) {
      pendingUse = null;
      playerPath.length = 0;
      moveMarker.visible = false;
      if (faceYaw != null) shopkeeper.rotation.y = faceYaw;
      if (type === 'counter') {
        servingAtCounter = true;
        faceCounterCustomer(COUNTER_TURN_SEC);
        playClick('ui');
        return;
      }
      if (type === 'boulder') {
        startMining(pose.materialId, aimed);
        playClick('ui');
        return;
      }
      if (type === 'tree') {
        startChopping(aimed);
        playClick('ui');
        return;
      }
      if (type === 'fishing_spot') {
        startFishing(aimed);
        playClick('ui');
        return;
      }
      if (type === 'flax' || type === 'wheat') {
        startPicking(aimed);
        playClick('ui');
        return;
      }
      if (type === 'fountain' || type === 'pond') {
        fillFromFountain(aimed);
        playClick('ui');
        return;
      }
      stopMining();
      pickHandler?.({ type, element: pose.element, patchIndex: pose.index });
      playClick('ui');
      return;
    }
    if (plan.action === 'walk' && applyWalkPath(plan.path)) {
      const dest = standFront && plan.dest ? plan.dest : pose;
      remember(dest, standFront ? standArrive : arrive, type !== 'counter');
      playClick('move');
      return;
    }
    const fallbackDest = standFront && plan.dest ? plan.dest : { x: pose.x, z: pose.z };
    const fallback = planSceneWalk(from, fallbackDest);
    if (applyWalkPath(fallback)) {
      remember(fallbackDest, standFront ? standArrive : arrive, type !== 'counter');
      playClick('move');
      return;
    }
    remember(fallbackDest, standFront ? standArrive : arrive, false);
    playClick('ui');
  }

  function finishPendingUse() {
    if (!pendingUse) return;
    const { type, materialId, x, z, plantId, faceYaw, nodeX, nodeZ, element, patchIndex } = pendingUse;
    pendingUse = null;
    if (type === 'counter') {
      servingAtCounter = true;
      return;
    }
    const pose = {
      x: nodeX ?? x,
      z: nodeZ ?? z,
      materialId,
      plantId,
      faceYaw,
    };
    if (type === 'boulder') startMining(materialId, pose);
    else if (type === 'tree') startChopping(pose);
    else if (type === 'fishing_spot') startFishing(pose);
    else if (type === 'flax' || type === 'wheat') startPicking(pose);
    else if (type === 'fountain' || type === 'pond') fillFromFountain(pose);
    else pickHandler?.({ type, element, patchIndex });
  }

  function updatePlayer(dt, now) {
    if (playerPath.length) {
      const step = walkToward(
        { mesh: shopkeeper, collide: playerCollide() },
        playerPath[0],
        dt,
        PLAYER_SPEED,
      );
      if (step === 'blocked') {
        playerPath.length = 0;
        moveMarker.visible = false;
        // Snagged on the way to a station or gather spot: re-plan once from
        // here rather than leaving the action queued but never started.
        if (pendingUse && !pendingUse.replanned) {
          pendingUse.replanned = true;
          const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
          const again = planSceneWalk(from, { x: pendingUse.x, z: pendingUse.z, releaseTree: pendingUse.releaseTree });
          if (again?.length) playerPath.push(...again);
        } else if (!pendingUse && walkGoal && !walkGoal.replanned) {
          // Plain walk (e.g. past the fountain) snagged on a corner: re-plan once.
          walkGoal.replanned = true;
          const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
          const again = planSceneWalk(from, walkGoal);
          if (again?.length) {
            playerPath.push(...again);
            moveMarker.visible = true;
          }
        }
        return;
      }
      if (step) {
        playerPath.shift();
        if (!playerPath.length) {
          moveMarker.visible = false;
          if (pendingUse?.faceYaw != null) shopkeeper.rotation.y = pendingUse.faceYaw;
          if (pendingUse && (pendingUse.openOnArrive || isNearPose(pendingUse, pendingUse.arrive ?? STATION_ARRIVE))) {
            finishPendingUse();
          }
          faceCounterCustomer(dt);
        }
      }
      return;
    }
    syncStance(shopkeeper);
    if (mining) {
      if (Number.isFinite(mining.faceYaw)) shopkeeper.rotation.y = mining.faceYaw;
      else shopkeeper.rotation.y = Math.atan2(mining.x - shopkeeper.position.x, mining.z - shopkeeper.position.z);
      updateMinePose(shopkeeper, dt, now);
      if (mining?.mode === 'pick') updateHeldFlax(riggedClipTime(shopkeeper));
      tickMining(now);
      if (mining) return;
    }
    updateWalkPose(shopkeeper, false, dt, now);
    if (pendingUse && isNearPose(pendingUse, pendingUse.arrive ?? 1.35)) {
      finishPendingUse();
    }
    faceCounterCustomer(dt);
  }

  let camFocus = null;
  function updateFollowCamera(dt) {
    if (camHeld.left) cam.yaw += CAM_YAW_SPEED * dt;
    if (camHeld.right) cam.yaw -= CAM_YAW_SPEED * dt;
    if (camHeld.up) cam.pitch += CAM_PITCH_SPEED * dt;
    if (camHeld.down) cam.pitch -= CAM_PITCH_SPEED * dt;
    clampCam();
    const look = new THREE.Vector3(
      shopkeeper.position.x,
      0.95 + (shopkeeper.userData.groundY || 0),
      shopkeeper.position.z,
    );
    // Tutorial: frame the target (narrow screens: centred on it; desktop: between it and the player). Smooth, never jumps.
    if (camFocus) {
      const k = camFocus.weight ?? 0.5;
      look.x += (camFocus.x - look.x) * k;
      look.z += (camFocus.z - look.z) * k;
    }
    const flat = Math.cos(cam.pitch) * cam.distance;
    const desired = new THREE.Vector3(
      look.x + Math.sin(cam.yaw) * flat,
      look.y + Math.sin(cam.pitch) * cam.distance,
      look.z + Math.cos(cam.yaw) * flat,
    );
    const k = 1 - Math.exp(-dt * 6.2);
    camera.position.lerp(desired, k);
    camLook.lerp(look, k);
    camera.lookAt(camLook);
    if (scene.fog) {
      scene.fog.near = 18 + cam.distance * 0.4;
      scene.fog.far = 40 + cam.distance * 1.1;
    }
    updateRoofFade();
  }

  function updateRoofFade() {
    if (!roofGroup) return;
    if (sceneMode === 'dungeon' || sceneMode === 'runefield') {
      roofGroup.visible = false;
      return;
    }
    const t = Math.min(1, Math.max(0, (cam.distance - ROOF_FADE_START) / (ROOF_FADE_FULL - ROOF_FADE_START)));
    roofGroup.visible = t > 0.02;
    roofGroup.traverse((child) => {
      const mat = child.material;
      if (!mat || mat.opacity == null) return;
      if (!mat.userData.isRoof) {
        if (mat.transparent) mat.userData.isRoof = true;
        else return;
      }
      mat.transparent = true;
      mat.opacity = t;
      mat.depthWrite = t > 0.75;
    });
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function clearTouchHold() {
    if (touchHold?.timer != null) clearTimeout(touchHold.timer);
    touchHold = null;
  }

  function armTouchHold(event) {
    clearTouchHold();
    const hold = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      fired: false,
      timer: null,
    };
    hold.timer = setTimeout(() => {
      if (touchHold !== hold || hold.fired || multiTouch) return;
      hold.fired = true;
      camDrag = null;
      try { navigator.vibrate?.(10); } catch { /* unsupported */ }
      openCanvasContextAt({ clientX: hold.x, clientY: hold.y });
      ignorePicksUntil = performance.now() + 400;
    }, TOUCH_LONG_PRESS_MS);
    touchHold = hold;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (materialsDrawerBlocksPoint(event.clientX, event.clientY)) return;
    if (event.pointerType === 'touch') {
      canvasTouches.add(event.pointerId);
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (canvasTouches.size > 1) {
        camDrag = null;
        multiTouch = true;
        clearTouchHold();
      }
    }
    if (canvasPointerStartsCamOrbit(event, {
      moveTarget: Boolean(moveTarget),
      expandMode,
      modalOpen: modalBlocksWorld(),
      touchCount: event.pointerType === 'touch' ? canvasTouches.size : 1,
    })) {
      event.preventDefault();
      camDrag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      renderer.domElement.setPointerCapture?.(event.pointerId);
      if (event.button === 1) return;
    }
    if (event.pointerType === 'touch' && event.isPrimary !== false && canvasTouches.size === 1) {
      event.preventDefault();
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      pointerDown.t = performance.now();
      renderer.domElement.setPointerCapture?.(event.pointerId);
      armTouchHold(event);
      return;
    }
    if (event.button !== 0) return;
    pointerDown.x = event.clientX;
    pointerDown.y = event.clientY;
    pointerDown.t = performance.now();
  });

  function modalBlocksWorld() {
    return Boolean(document.querySelector('.modal:not([hidden])'));
  }

  function furnitureIdFromKind(kind, displayIndex) {
    if (kind === 'display') return { id: 'display', index: displayIndex };
    if (kind === 'farming_patch') return { id: 'farming_patch', index: displayIndex };
    if (kind === 'chest' || kind === 'anvil' || kind === 'range' || kind === 'counter' || UNLOCK_STATIONS.includes(kind)) {
      return { id: kind };
    }
    return null;
  }

  function placeKindOf(target) {
    if (!target) return 'table';
    if (target.id === 'display') {
      return displayKind(target.index, state) || target.kind || 'table';
    }
    return target.id;
  }

  function activePlaceRects(target = moveTarget) {
    const kind = placeKindOf(target);
    if (kind === 'portal') return portalPlaceFloors(state.expansions ?? []);
    if (kind === 'farming_patch' || kind === 'patch') return patchPlaceFloors(state.expansions ?? []);
    if (kind === 'piece' && constructionPiece(target?.pieceId)?.mount === 'outdoor') {
      return portalPlaceFloors(state.expansions ?? []);
    }
    return placeRects;
  }

  function piecePlaceReason(pose) {
    const piece = constructionPiece(moveTarget?.pieceId);
    if (!piece || !pose) return 'That spot is off the shop floor.';
    if (rectHitsPond(pose.x, pose.z, 0.35, 0.35)) return 'That spot overlaps the pond.';
    if (piece.mount === 'wall') {
      const snapped = snapToPieceWall(pose.x, pose.z, state.expansions ?? [], pose.rot, pieceWallFace(moveTarget?.pieceId));
      if (Math.hypot((snapped.x ?? pose.x) - pose.x, (snapped.z ?? pose.z) - pose.z) > 0.45) {
        return 'Place it on an open wall.';
      }
      return null;
    }
    const floors = piece.mount === 'outdoor'
      ? portalPlaceFloors(state.expansions ?? [])
      : placeFloors(state.expansions ?? []);
    const on = floors.some((rect) => (
      pose.x >= rect.minX + 0.15 && pose.x <= rect.maxX - 0.15
      && pose.z >= rect.minZ + 0.15 && pose.z <= rect.maxZ - 0.15
    ));
    if (!on) {
      return piece.mount === 'outdoor'
        ? 'Place it on the floor or the grass.'
        : 'That spot is off the shop floor.';
    }
    return null;
  }

  function patchPlaceReason(pose) {
    const grass = 'Place the patch on open grass.';
    const expansions = state.expansions ?? [];
    const { hw, hd } = furnitureHalfSize('patch');
    const lawn = patchPlaceFloors(expansions)[0];
    if (!lawn) return grass;
    if (
      pose.x - hw < lawn.minX || pose.x + hw > lawn.maxX
      || pose.z - hd < lawn.minZ || pose.z + hd > lawn.maxZ
    ) return grass;
    const corners = [
      [pose.x - hw, pose.z - hd],
      [pose.x + hw, pose.z - hd],
      [pose.x - hw, pose.z + hd],
      [pose.x + hw, pose.z + hd],
      [pose.x, pose.z],
    ];
    if (corners.some(([x, z]) => pointHitsShop(x, z, expansions, 0.05))) return grass;
    if (corners.some(([x, z]) => pointOnPath(x, z, expansions, 0.05))) return grass;
    if (!gardenSpotClearOfBeds(pose, expansions, hw + 0.55)) return grass;
    const blocked = patchHitsTreeOrRock(pose, expansions);
    if (blocked === 'tree') return 'That spot overlaps a tree.';
    if (blocked === 'rock') return 'That spot overlaps a rock.';
    if (blocked === 'pond') return 'That spot overlaps the pond.';
    return null;
  }

  function blockedPlaceReason(pose, target = moveTarget) {
    if (!pose || !target) return 'That spot is off the shop floor.';
    const kind = placeKindOf(target);
    const skip = target.id === 'display' || target.id === 'farming_patch'
      ? { id: target.id, index: target.index }
      : { id: target.id };
    const blocks = liveObstacles(state, SHOP, skip);
    const floors = activePlaceRects(target);
    if (kind === 'piece') return piecePlaceReason(pose);
    if (kind === 'farming_patch' || kind === 'patch') {
      const grass = patchPlaceReason(pose);
      if (grass) return grass;
      const patchBlocks = dropRecordedPatchObstacle(blocks, state.furniture?.patches, pose);
      const reason = placementBlocked(pose, 'patch', patchBlocks, floors, { checkAisle: false });
      if (reason === 'That spot is off the shop floor.') return 'Place the patch on open grass.';
      return reason;
    }
    const off = kind === 'portal' ? 'That spot is off the grass.' : 'That spot is off the shop floor.';
    if (!pose) return off;
    if (kind === 'portal') {
      const { hw, hd } = furnitureHalfSize('portal');
      if (rectHitsPond(pose.x, pose.z, hw, hd)) return 'That spot overlaps the pond.';
    }
    const reason = placementBlocked(pose, kind, blocks, floors, {
      checkAisle: kind !== 'counter' && kind !== 'rug',
    });
    if (reason === 'That spot is off the shop floor.' && kind === 'portal') return off;
    return reason;
  }

  function visualPlacePose() {
    if (!moveTarget) return null;
    if (moveTarget.id === 'display') {
      const slot = displays[moveTarget.index];
      if (!slot) return null;
      return { x: slot.anchor.position.x, z: slot.anchor.position.z, rot: slot.anchor.rotation.y };
    }
    if (moveTarget.id === 'farming_patch' || moveTarget.id === 'piece') return poseOf(moveTarget);
    const slot = fixtureMeshes[moveTarget.id];
    if (!slot) return poseOf(moveTarget);
    return {
      x: slot.mesh.position.x,
      z: slot.mesh.position.z,
      rot: slot.mesh.rotation.y - furnitureStartYaw(moveTarget.id),
    };
  }

  function patchRecordedAt(pose) {
    if (!pose) return false;
    return (state.furniture?.patches ?? []).some((patch) => (
      Number.isFinite(patch?.x)
      && Number.isFinite(patch?.z)
      && Math.hypot(patch.x - pose.x, patch.z - pose.z) < 0.05
    ));
  }

  function tryConfirmPlace() {
    const pose = visualPlacePose();
    if (!pose) return { ok: false, reason: 'Nothing to place.' };
    const reason = blockedPlaceReason(pose);
    if (reason) return { ok: false, reason, pose };
    const draft = poseOf(moveTarget);
    if (draft) {
      draft.x = pose.x;
      draft.z = pose.z;
      draft.rot = pose.rot;
    }
    return { ok: true, pose };
  }

  function placeMovingFurniture(x, z) {
    if (!moveTarget) return false;
    previewFurnitureAt(x, z);
    const pose = visualPlacePose();
    const reason = blockedPlaceReason(pose);
    const cell = snapGrid?.userData.cell;
    if (cell) cell.material.color.setHex(reason ? 0xc45a32 : 0xf0d27a);
    if (placeNeedsConfirm) return true;
    if (reason) {
      pickHandler?.({ type: 'furniture-place-blocked', reason });
      return false;
    }
    rebuildNav();
    syncFixtureIntent(moveTarget);
    clearMoveMode();
    return true;
  }

  /** Tell the room (and the save) where a fixture ended up; pieces/patches confirm through their own intents. */
  function syncFixtureIntent(target) {
    if (!target || target.id === 'piece' || target.id === 'farming_patch') return;
    const pose = target.id === 'display' ? state.furniture.displays?.[target.index] : state.furniture[target.id];
    if (!pose) return;
    intentBus.apply({
      type: 'moveFurniture',
      furnitureId: target.id,
      ...(target.id === 'display' ? { index: target.index } : {}),
      pose: { x: pose.x, z: pose.z, ...(Number.isFinite(pose.rot) ? { rot: pose.rot } : {}) },
    });
  }

  function rotateFurniturePose(target, dir = 1) {
    const pose = poseOf(target);
    if (!pose) return false;
    const kind = placeKindOf(target);
    const step = furnitureRotateDelta(kind) * (dir < 0 ? -1 : 1);
    const nextRot = (pose.rot ?? FURNITURE_FORWARD) + step;
    if (kind === 'shelf' || (kind === 'piece' && constructionPiece(target.pieceId)?.mount === 'wall')) {
      const snapped = kind === 'shelf'
        ? snapToWallGrid(pose.x, pose.z, state.expansions ?? [], nextRot)
        : snapToPieceWall(pose.x, pose.z, state.expansions ?? [], nextRot, pieceWallFace(target.pieceId));
      pose.x = snapped.x;
      pose.z = snapped.z;
      pose.rot = snapped.rot;
    } else {
      pose.rot = nextRot;
    }
    if (target.id === 'display') applyDisplayPose(target.index);
    else if (target.id === 'farming_patch') applyPatchGhost();
    else if (target.id === 'piece') applyPieceGhost();
    else applyFixturePose(target.id);
    rebuildNav();
    return true;
  }

  function hitFurniture(hits) {
    const closest = pickUseHit(hits);
    const chestHit = hits.find((h) => h.object.userData.kind === 'chest');
    const preferChest = chestHit
      && closest?.object.userData.kind === 'anvil'
      && chestHit.distance - closest.distance < 0.5;
    return preferChest ? chestHit : closest;
  }

  function releaseCanvasPointer(event) {
    if (event?.pointerType === 'touch') {
      canvasTouches.delete(event.pointerId);
      touchPoints.delete(event.pointerId);
    }
    if (canvasTouches.size < 2) pinchDist = 0;
    if (canvasTouches.size === 0) multiTouch = false;
    if (event?.button === 1 || camDrag?.pointerId === event?.pointerId) camDrag = null;
    if (touchHold && (event?.pointerId == null || touchHold.pointerId === event.pointerId)) {
      clearTouchHold();
    }
  }

  function finishCanvasClick(event, held, moved) {
    if (moveTarget) {
      const point = floorPointFromEvent(event);
      if (point) {
        placeMovingFurniture(point.x, point.z);
        playClick('ui');
        const click = nextPlaceClick(lastPlaceClickAt, performance.now(), placeNeedsConfirm);
        lastPlaceClickAt = click.lastAt;
        if (click.confirm) {
          pickHandler?.({ type: 'furniture-place-confirm' });
          return;
        }
        pickHandler?.({ type: placeNeedsConfirm ? 'furniture-place-preview' : 'furniture-moved' });
      }
      return;
    }
    if (moved > 8) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = clickHits();
    if (!hits.length) return;

    if (expandMode) {
      const padHit = hits.find((h) => h.object.userData.kind === 'expand-pad');
      if (padHit?.object.userData.connects) {
        selectedPad = padHit.object.userData.padId;
        padGroup.children.forEach((child) => {
          if (child.userData.kind === 'expand-pad') {
            child.material.opacity = child.userData.padId === selectedPad ? 0.55 : 0.22;
            child.material.color.setHex(child.userData.padId === selectedPad ? 0xf0d27a : 0xe3b34a);
          }
        });
        playClick('ui');
        pickHandler?.({ type: 'expand-pad', padId: selectedPad });
      }
      return;
    }

    const customerHit = hits.find((h) => h.object.userData.kind === 'customer');
    if (customerHit) {
      const actor = customers.find((c) => c.mesh.userData.pick === customerHit.object);
      if (actor && actor.state === 'request') {
        playClick('ui');
        pickHandler?.({ type: 'customer', actor });
      }
      return;
    }

    const picked = hitFurniture(hits);
    const floorPoint = floorClickPoint(hits);
    const pickedKind = picked?.object.userData?.kind ?? null;
    if (
      sceneMode === 'shop'
      && (pickedKind === 'fishing_spot' || (!picked && floorPoint && pointInPond(floorPoint.x, floorPoint.z, 0.35)))
    ) {
      // The whole pond is one click target: open the fish picker.
      playClick('ui');
      pickHandler?.({ type: 'fish-picker', clientX: event.clientX, clientY: event.clientY, x: floorPoint?.x ?? picked?.object.userData?.x, z: floorPoint?.z ?? picked?.object.userData?.z });
      return;
    }
    if (clickLeavesGather(mining, floorPoint, picked?.object.userData?.kind ?? null)) {
      pendingUse = null;
      if (setMoveTarget(floorPoint.x, floorPoint.z)) {
        playClick('move');
      } else {
        stopMining();
      }
      if (state.selectedDisplay !== -1) {
        state.selectedDisplay = -1;
        refreshSelection(true);
      }
      return;
    }
    if (picked) {
      const data = picked.object.userData;
      if (data.kind === 'construction' && !placeNeedsConfirm && isFountainPiece(data.index)) {
        fillAtFountainPiece(data.index);
        return;
      }
      if (data.kind === 'construction' && !placeNeedsConfirm) {
        pickHandler?.({ type: 'construction-select', index: data.index });
        return;
      }
      if (data.kind === 'trapdoor') {
        const hatch = gardenTrapdoorSpot(state.expansions ?? []);
        queueUse('trapdoor', hatch ?? { x: shopkeeper.position.x, z: shopkeeper.position.z });
        return;
      }
      if (data.kind === 'ladder') {
        queueUse('ladder', LADDER_STAND);
        return;
      }
      if (data.kind === 'rune-portal') {
        queueUse('rune-portal', { x: data.x ?? RUNE_FIELD_PORTAL.x, z: data.z ?? RUNE_FIELD_PORTAL.z });
        return;
      }
      if (data.kind === 'altar') {
        queueUse('altar', { x: data.x, z: data.z, element: data.element });
        return;
      }
      if (data.kind === 'boulder') {
        queueUse('boulder', { x: data.x, z: data.z, materialId: data.materialId });
        return;
      }
      if (data.kind === 'fishing_spot') {
        queueUse('fishing_spot', { x: data.x, z: data.z, materialId: data.materialId });
        return;
      }
      if (data.kind === 'tree') {
        if (!(data.depleted || !treeCanChop(data.x, data.z))) {
          queueUse('tree', {
            x: data.x,
            z: data.z,
            materialId: data.materialId ?? 'logs',
            trunkRadius: data.trunkRadius ?? plantedTrunkRadius(data.x, data.z),
          });
          return;
        }
      }
      if (data.kind === 'flax') {
        queueUse('flax', { x: data.x, z: data.z, materialId: 'flax', plantId: data.plantId });
        return;
      }
      if (data.kind === 'wheat') {
        queueUse('wheat', { x: data.x, z: data.z, materialId: 'wheat', plantId: data.plantId });
        return;
      }
      if (data.kind === 'farming_patch') {
        const pose = state.furniture.patches?.[data.index];
        if (pose) queueUse('farming_patch', { ...pose, index: data.index });
        return;
      }
      if (data.kind === 'fountain') {
        queueUse('fountain', { x: data.x ?? FOUNTAIN.x, z: data.z ?? FOUNTAIN.z });
        return;
      }
      if (data.kind === 'chest' && held >= 500) {
        playClick('ui');
        pickHandler?.({ type: 'chest-upgrade' });
        return;
      }
      if (data.kind === 'chest') {
        queueUse('chest', state.furniture.chest);
        return;
      }
      if (data.kind === 'anvil') {
        queueUse('anvil', state.furniture.anvil);
        return;
      }
      if (data.kind === 'range') {
        queueUse('range', state.furniture.range);
        return;
      }
      if (UNLOCK_STATIONS.includes(data.kind)) {
        if (state.furniture[data.kind]) queueUse(data.kind, state.furniture[data.kind]);
        return;
      }
      if (data.kind === 'counter') {
        queueUse('counter', state.furniture.counter);
        return;
      }
      if (data.kind === 'display') {
        playClick('ui');
        state.selectedDisplay = data.displayIndex;
        refreshSelection();
        pickHandler?.({ type: 'display-select', index: data.displayIndex, furniture: { id: 'display', index: data.displayIndex } });
        return;
      }
    }
    const point = floorClickPoint(hits);
    if (point) {
      if (sceneMode === 'shop') {
        const station = stationAtFloor(point.x, point.z, state.furniture);
        if (station) {
          queueUse(station.type, station.pose);
          return;
        }
        const hatch = gardenTrapdoorSpot(state.expansions ?? []);
        if (hatch && Math.hypot(point.x - hatch.x, point.z - hatch.z) < 1.7) {
          queueUse('trapdoor', hatch);
          return;
        }
        const tree = gardenTreeSpots(state.expansions ?? []).find((spot) => (
          treeCanChop(spot.x, spot.z)
          && Math.hypot(point.x - spot.x, point.z - spot.z) <= treeClickRadius(spot)
        ));
        if (tree) {
          queueUse('tree', {
            x: tree.x,
            z: tree.z,
            materialId: tree.materialId ?? 'logs',
            trunkRadius: plantedTrunkRadius(tree.x, tree.z),
          });
          return;
        }
        const fishSpot = FISHING_SPOTS.find((spot) => (
          Math.hypot(point.x - spot.x, point.z - spot.z) <= FISHING_CLICK_RADIUS
        ));
        if (fishSpot) {
          queueUse('fishing_spot', { x: fishSpot.x, z: fishSpot.z, materialId: fishSpot.materialId });
          return;
        }
        if (keepFountain(state.expansions ?? []) && Math.hypot(point.x - FOUNTAIN.x, point.z - FOUNTAIN.z) <= 1.05) {
          queueUse('fountain', { x: FOUNTAIN.x, z: FOUNTAIN.z });
          return;
        }
        const plant = flaxNodes.find((node) => (
          node.alive && Math.hypot(point.x - node.x, point.z - node.z) <= FLAX_CLICK_RADIUS
        ));
        if (plant) {
          queueUse('flax', { x: plant.x, z: plant.z, materialId: 'flax', plantId: plant.id });
          return;
        }
        const wheat = wheatNodes.find((node) => (
          node.alive && Math.hypot(point.x - node.x, point.z - node.z) <= WHEAT_CLICK_RADIUS
        ));
        if (wheat) {
          queueUse('wheat', { x: wheat.x, z: wheat.z, materialId: 'wheat', plantId: wheat.id });
          return;
        }
        const { hw, hd } = furnitureHalfSize('patch');
        const patchIndex = (state.furniture.patches ?? []).findIndex((pose) => (
          Math.abs(point.x - pose.x) <= hw + 0.12 && Math.abs(point.z - pose.z) <= hd + 0.12
        ));
        const patch = state.furniture.patches?.[patchIndex];
        if (patch) {
          queueUse('farming_patch', { ...patch, index: patchIndex });
          return;
        }
      }
      if (sceneMode === 'dungeon') {
        const spot = boulderAtFloor(point.x, point.z, DUNGEON_BOULDERS);
        if (spot) {
          queueUse('boulder', { x: spot.x, z: spot.z, materialId: spot.materialId });
          return;
        }
      }
      if (sceneMode === 'runefield') {
        if (Math.hypot(point.x - RUNE_FIELD_PORTAL.x, point.z - RUNE_FIELD_PORTAL.z) <= (STATION_HIT.portal.floorR ?? 2.4)) {
          queueUse('rune-portal', { x: RUNE_FIELD_PORTAL.x, z: RUNE_FIELD_PORTAL.z });
          return;
        }
        const altar = RUNE_ALTAR_SPOTS.find((spot) => (
          Math.hypot(point.x - spot.x, point.z - spot.z) <= ALTAR_CLICK
        ));
        if (altar) {
          queueUse('altar', { x: altar.x, z: altar.z, element: altar.element });
          return;
        }
        const tree = runeFieldTreeSpots().find((spot) => (
          treeCanChop(spot.x, spot.z)
          && Math.hypot(point.x - spot.x, point.z - spot.z) <= treeClickRadius(spot)
        ));
        if (tree) {
          queueUse('tree', {
            x: tree.x,
            z: tree.z,
            materialId: tree.materialId ?? 'logs',
            trunkRadius: plantedTrunkRadius(tree.x, tree.z),
          });
          return;
        }
      }
      pendingUse = null;
      setMoveTarget(point.x, point.z);
      playClick('move');
      if (state.selectedDisplay !== -1) {
        state.selectedDisplay = -1;
        refreshSelection(true);
      }
    }
  }

  renderer.domElement.addEventListener('pointerup', (event) => {
    try {
    if (materialsDrawerBlocksPoint(event.clientX, event.clientY)) return;
    if (touchHold?.fired) return;
    if (event.button !== 0) return;
    if (performance.now() < ignorePicksUntil) return;
    if (multiTouch) return;
    if (modalBlocksWorld() && !moveTarget && !expandMode) return;
    const held = performance.now() - pointerDown.t;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    if (event.pointerType === 'touch' && moved <= TOUCH_HOLD_MOVE_PX && !moveTarget && !expandMode) {
      if (pendingTapTimer) {
        clearTimeout(pendingTapTimer);
        pendingTapTimer = null;
      }
      const tapPoint = { x: event.clientX, y: event.clientY, t: performance.now() };
      if (isCanvasDoubleTap(lastCanvasTap, tapPoint, tapPoint.t)) {
        lastCanvasTap = null;
        openCanvasContextAt(event);
        ignorePicksUntil = performance.now() + 450;
        return;
      }
      lastCanvasTap = tapPoint;
      const tapEvent = { clientX: event.clientX, clientY: event.clientY, button: 0, pointerType: 'mouse' };
      const heldNow = held;
      pendingTapTimer = setTimeout(() => {
        pendingTapTimer = null;
        finishCanvasClick(tapEvent, heldNow, 0);
      }, TOUCH_DOUBLE_TAP_MS);
      return;
    }
    finishCanvasClick(event, held, moved);
    } finally {
      releaseCanvasPointer(event);
    }
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPoints.size >= 2) {
        const pts = [...touchPoints.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const delta = pinchSpanDelta(pinchDist, dist);
        if (delta) {
          applyPinchZoom(cam, delta);
          clampCam();
        }
        pinchDist = dist;
        camDrag = null;
        return;
      }
    }
    if (touchHold && touchHold.pointerId === event.pointerId && !touchHold.fired) {
      if (canvasPointerMovedPastHold(touchHold, event)) {
        clearTimeout(touchHold.timer);
        touchHold = null;
        if (canvasPointerStartsCamOrbit(event, {
          moveTarget: Boolean(moveTarget),
          expandMode,
          modalOpen: modalBlocksWorld(),
          touchCount: event.pointerType === 'touch' ? canvasTouches.size : 1,
          moved: true,
        })) {
          camDrag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        }
      }
    }
    if (camDrag && (camDrag.pointerId == null || camDrag.pointerId === event.pointerId)) {
      const dx = event.clientX - camDrag.x;
      const dy = event.clientY - camDrag.y;
      camDrag = { x: event.clientX, y: event.clientY, pointerId: camDrag.pointerId };
      applyCanvasOrbitDelta(cam, dx, dy);
      clampCam();
      return;
    }
    if (!moveTarget) return;
    const point = floorPointFromEvent(event);
    if (point) previewFurnitureAt(point.x, point.z);
  });

  renderer.domElement.addEventListener('pointercancel', (event) => {
    releaseCanvasPointer(event);
  });
  renderer.domElement.addEventListener('auxclick', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (event.button === 1) event.preventDefault();
  });

  function openCanvasContextAt(event) {
    if (modalBlocksWorld() && !moveTarget) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = clickHits();
    if (moveTarget) {
      cancelPlaceOrMove();
      pickHandler?.({ type: 'furniture-cancel' });
      return;
    }
    const picked = hitFurniture(hits);
    const rugContext = hits.find((hit) => hit.object.userData.kind === 'rug');
    if (!picked && rugContext && state.furniture.rug) {
      playClick('ui');
      pickHandler?.({
        type: 'furn-menu',
        furniture: { id: 'rug' },
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    const pieceHit = picked?.object.userData.kind === 'construction'
      ? picked
      : !picked ? hits.find((hit) => hit.object.userData.kind === 'construction') : null;
    if (pieceHit && Number.isInteger(pieceHit.object.userData.index)) {
      playClick('ui');
      pickHandler?.({
        type: 'furn-menu',
        furniture: { id: 'piece', index: pieceHit.object.userData.index },
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (!picked) {
      const pondPoint = sceneMode === 'shop' ? floorClickPoint(hits) : null;
      if (pondPoint && pointInPond(pondPoint.x, pondPoint.z, 0.35)) {
        playClick('ui');
        pickHandler?.({ type: 'fish-picker', clientX: event.clientX, clientY: event.clientY, x: pondPoint.x, z: pondPoint.z });
      }
      return;
    }
    const data = picked.object.userData;
    if (data.kind === 'boulder') {
      playClick('ui');
      pickHandler?.({
        type: 'boulder-inspect',
        materialId: data.materialId,
        name: data.name,
        x: data.x,
        z: data.z,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (data.kind === 'fishing_spot') {
      playClick('ui');
      pickHandler?.({
        type: 'fishing-inspect',
        materialId: data.materialId,
        name: data.name,
        x: data.x,
        z: data.z,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (data.kind === 'tree') {
      if (data.depleted || isTreeStump(data.x, data.z)) return;
      playClick('ui');
      pickHandler?.({
        type: 'tree-inspect',
        materialId: data.materialId ?? 'logs',
        name: data.name ?? 'Tree',
        x: data.x,
        z: data.z,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (data.kind === 'flax') {
      playClick('ui');
      pickHandler?.({
        type: 'flax-inspect',
        materialId: 'flax',
        name: 'Flax',
        plantId: data.plantId,
        x: data.x,
        z: data.z,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (data.kind === 'wheat') {
      playClick('ui');
      pickHandler?.({
        type: 'wheat-inspect',
        materialId: 'wheat',
        name: 'Wheat',
        plantId: data.plantId,
        x: data.x,
        z: data.z,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    const furn = furnitureIdFromKind(
      data.kind,
      data.kind === 'farming_patch' ? data.index : data.displayIndex,
    );
    if (!furn) return;
    playClick('ui');
    if (data.kind === 'display') {
      state.selectedDisplay = data.displayIndex;
      refreshSelection();
      pickHandler?.({
        type: 'furn-menu',
        furniture: {
          ...furn,
          kind: displayKind(data.displayIndex, state),
        },
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    pickHandler?.({ type: 'furn-menu', furniture: furn, clientX: event.clientX, clientY: event.clientY });
  }

  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openCanvasContextAt(event);
  });

  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (moveTarget) {
      const dir = Math.sign(event.deltaY) || 1;
      rotateFurniturePose(moveTarget, dir);
      pickHandler?.({ type: 'furniture-rotate', furniture: moveTarget, dir });
      return;
    }
    cam.distance += Math.sign(event.deltaY) * CAM_ZOOM_STEP;
    clampCam();
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      camHeld.left = true;
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      camHeld.right = true;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      camHeld.up = true;
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      camHeld.down = true;
    } else if (event.key === 'Escape') {
      if (moveTarget) {
        cancelPlaceOrMove();
        pickHandler?.({ type: 'furniture-cancel' });
      }
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      cam.distance += CAM_ZOOM_STEP;
      clampCam();
    } else if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      cam.distance -= CAM_ZOOM_STEP;
      clampCam();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') camHeld.left = false;
    if (event.key === 'ArrowRight') camHeld.right = false;
    if (event.key === 'ArrowUp') camHeld.up = false;
    if (event.key === 'ArrowDown') camHeld.down = false;
  });

  function disposeOutline(slot) {
    if (!slot.outline) return;
    slot.anchor.remove(slot.outline);
    slot.outline.traverse((child) => {
      if (child.userData.outlineGeom && child.geometry) child.geometry.dispose();
    });
    slot.outline = null;
  }

  function addMeshOutline(slot, child, group) {
    if (!child.isMesh || !child.geometry) return;
    if (child.material?.visible === false) return;
    child.updateWorldMatrix(true, false);
    outlineScratch.inverse.copy(slot.anchor.matrixWorld).invert();
    outlineScratch.local.copy(child.matrixWorld).premultiply(outlineScratch.inverse);

    const halo = new THREE.Mesh(child.geometry, outlineHaloMat);
    halo.applyMatrix4(outlineScratch.local);
    halo.scale.multiplyScalar(1.09);
    halo.renderOrder = 8;
    group.add(halo);

    const edges = new THREE.EdgesGeometry(child.geometry, 22);
    const lines = new THREE.LineSegments(edges, outlineEdgeMat);
    lines.applyMatrix4(outlineScratch.local);
    lines.userData.outlineGeom = true;
    lines.renderOrder = 9;
    group.add(lines);
  }

  function applyOutline(slot, selected) {
    disposeOutline(slot);
    if (!selected) return;
    slot.furniture.updateWorldMatrix(true, true);
    slot.wareAnchor.updateWorldMatrix(true, true);
    const group = new THREE.Group();
    group.name = 'gold-outline';
    slot.furniture.traverse((child) => addMeshOutline(slot, child, group));
    slot.wareAnchor.traverse((child) => addMeshOutline(slot, child, group));

    outlineScratch.box.makeEmpty();
    outlineScratch.box.expandByObject(slot.furniture);
    if (slot.wareAnchor.children.length) outlineScratch.box.expandByObject(slot.wareAnchor);
    if (!outlineScratch.box.isEmpty()) {
      outlineScratch.box.getSize(outlineScratch.size);
      outlineScratch.box.getCenter(outlineScratch.center);
      slot.anchor.worldToLocal(outlineScratch.center);
      const boxGeom = new THREE.BoxGeometry(
        outlineScratch.size.x + 0.08,
        outlineScratch.size.y + 0.08,
        outlineScratch.size.z + 0.08,
      );
      const boxEdges = new THREE.EdgesGeometry(boxGeom);
      boxGeom.dispose();
      const boxLines = new THREE.LineSegments(boxEdges, outlineBoxMat);
      boxLines.position.copy(outlineScratch.center);
      boxLines.userData.outlineGeom = true;
      boxLines.renderOrder = 10;
      group.add(boxLines);
    }
    slot.anchor.add(group);
    slot.outline = group;
  }

  function refreshSelection(force = false) {
    const selectedIndex = state.selectedDisplay;
    const selected = selectedIndex >= 0 ? displays[selectedIndex] : null;
    const wareIds = selected
      ? [
        selected.furniture?.uuid ?? '',
        selected.wareMesh?.userData.recipeId ?? '',
        ...ARMOUR_SLOTS.map((name) => selected.slotMeshes[name]?.userData.recipeId ?? ''),
        ...(selected.shelfMeshes ?? []).map((mesh) => mesh?.userData.recipeId ?? ''),
      ].join(':')
      : '';
    const key = `${state.selectedDisplay}:${wareIds}`;
    displays.forEach((d, i) => {
      d.glow.material.opacity = i === selectedIndex ? 0.88 : 0.0;
    });
    if (!force && key === outlineKey) return;
    outlineKey = key;
    displays.forEach((d, i) => applyOutline(d, i === selectedIndex && selectedIndex >= 0));
  }
  refreshSelection(true);

  function makeWareMesh(recipeId) {
    const mesh = state.wareLooks[recipeId]
      ? state.wareLooks[recipeId].clone(true)
      : buildWare(recipeId);
    mesh.userData.recipeId = recipeId;
    return mesh;
  }

  function clearSlotMeshes(slot) {
    for (const name of ARMOUR_SLOTS) {
      if (slot.slotMeshes[name]) {
        slot.wareAnchor.remove(slot.slotMeshes[name]);
        slot.slotMeshes[name] = null;
      }
    }
    if (slot.wareMesh) {
      slot.wareAnchor.remove(slot.wareMesh);
      slot.wareMesh = null;
    }
    if (slot.shelfMeshes) {
      for (let i = 0; i < slot.shelfMeshes.length; i += 1) {
        if (slot.shelfMeshes[i]) {
          slot.wareAnchor.remove(slot.shelfMeshes[i]);
          slot.shelfMeshes[i] = null;
        }
      }
    }
  }

  function setDisplayWare(index, recipeId) {
    const slot = displays[index];
    clearSlotMeshes(slot);
    if (!recipeId) return;
    const mesh = mountDisplayBasePose(makeWareMesh(recipeId), recipeId);
    mesh.position.set(0, 0, 0);
    slot.wareAnchor.add(mesh);
    slot.wareMesh = mesh;
  }

  function setShelfWares(index, ids) {
    const slot = displays[index];
    if (!slot.shelfMeshes) slot.shelfMeshes = emptyShelfSlots();
    const want = Array.isArray(ids) ? ids : emptyShelfSlots();
    let dirty = slot.shelfMeshes.length !== SHELF_SLOT_COUNT;
    for (let i = 0; i < SHELF_SLOT_COUNT; i += 1) {
      const have = slot.shelfMeshes[i]?.userData.recipeId ?? null;
      if (have !== (want[i] ?? null)) dirty = true;
    }
    if (!dirty && !slot.wareMesh) return;
    clearSlotMeshes(slot);
    const poses = shelfSlotPoses();
    for (let i = 0; i < SHELF_SLOT_COUNT; i += 1) {
      const recipeId = want[i];
      if (!recipeId) continue;
      const mesh = makeWareMesh(recipeId);
      const pose = poses[i];
      mesh.position.set(pose.x, pose.y, pose.z);
      slot.wareAnchor.add(mesh);
      slot.shelfMeshes[i] = mesh;
    }
  }

  function setStandWares(index, slots, fallbackId) {
    const slot = displays[index];
    const want = { ...emptySlots(), ...slots };
    const hasSet = ARMOUR_SLOTS.some((name) => want[name]);
    if (!hasSet && fallbackId && RECIPES[fallbackId]?.noMannequin) {
      clearSlotMeshes(slot);
      return;
    }
    if (!hasSet && fallbackId && RECIPES[fallbackId]?.category !== 'armour') {
      if (slot.wareMesh?.userData.recipeId === fallbackId) return;
      clearSlotMeshes(slot);
      const mesh = makeWareMesh(fallbackId);
      const pose = slotPose('ware');
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.scale.setScalar(0.85);
      slot.wareAnchor.add(mesh);
      slot.wareMesh = mesh;
      return;
    }
    let dirty = false;
    for (const name of ARMOUR_SLOTS) {
      const have = slot.slotMeshes[name]?.userData.recipeId ?? null;
      const nextId = isHandOrFootWare(want[name]) ? null : (want[name] ?? null);
      if (have !== nextId) dirty = true;
    }
    if (!dirty && !(slot.wareMesh && !hasSet)) return;
    clearSlotMeshes(slot);
    for (const name of ARMOUR_SLOTS) {
      const recipeId = want[name];
      if (!recipeId || isHandOrFootWare(recipeId)) continue;
      const mesh = mountDisplayBasePose(makeWareMesh(recipeId), recipeId, { mannequin: true });
      if (!fitMannequinWear(mesh, recipeId)) {
        const pose = slotPose(name);
        mesh.position.set(pose.x, pose.y, pose.z);
      }
      slot.wareAnchor.add(mesh);
      slot.slotMeshes[name] = mesh;
    }
  }

  function syncDisplays() {
    syncDisplaySlots();
    state.displays.forEach((d, i) => {
      if (!displays[i]) return;
      if (displayKind(i, state) === 'stand') {
        setStandWares(i, d.slots ?? emptySlots(), d.ware?.recipeId ?? null);
        return;
      }
      if (displayKind(i, state) === 'shelf') {
        setShelfWares(i, d.shelfSlots ?? emptyShelfSlots());
        return;
      }
      const want = d.ware?.recipeId ?? null;
      const haveId = displays[i].wareMesh?.userData.recipeId ?? null;
      if (want !== haveId) setDisplayWare(i, want);
    });
  }

  function syncDisplaySlots() {
    if (placeDraft?.id === 'display') return;
    while (displays.length > state.displays.length) {
      const slot = displays.pop();
      if (slot?.outline) slot.anchor.remove(slot.outline);
      if (slot) scene.remove(slot.anchor);
    }
    for (let i = displays.length; i < state.displays.length; i += 1) {
      const d = state.displays[i];
      const pose = state.furniture.displays[i] ?? { x: 0, z: 0.8, rot: FURNITURE_FORWARD };
      const spot = SHOP.displays[i] ?? {
        id: `bought-${d.kind}-${i}`,
        name: d.name ?? (d.kind === 'stand' ? 'Mannequin' : 'Table'),
        kind: d.kind ?? 'table',
        x: pose.x,
        z: pose.z,
      };
      displays.push(makeDisplaySlot(spot, i, pose));
    }
    displays.forEach((slot, i) => {
      slot.pick.userData.displayIndex = i;
      const d = state.displays[i];
      if (d) {
        slot.spot = {
          ...slot.spot,
          kind: d.kind ?? slot.spot.kind,
          name: d.name ?? slot.spot.name,
        };
      }
    });
  }

  function replaceFurniture(index, model) {
    const slot = displays[index];
    slot.anchor.remove(slot.furniture);
    const furniture = model.clone(true);
    normalizeImported(furniture, 1.25, true);
    slot.anchor.add(furniture);
    slot.furniture = furniture;
    slot.wareAnchor.position.y = wareTopY(furniture);
    slot.anchor.add(slot.wareAnchor);
    refreshSelection(true);
  }

  function bindWareLook(recipeId, model) {
    const clone = model.clone(true);
    normalizeImported(clone, 0.55, true);
    clone.userData.recipeId = recipeId;
    state.wareLooks[recipeId] = clone;
    state.displays.forEach((d, i) => {
      if (d.ware?.recipeId === recipeId) setDisplayWare(i, recipeId);
    });
  }

  function takeWareMesh(recipeId) {
    const index = state.displays.findIndex((d) => (
      d.ware?.recipeId === recipeId
      || ARMOUR_SLOTS.some((name) => d.slots?.[name] === recipeId)
      || (d.shelfSlots ?? []).includes(recipeId)
    ));
    if (index < 0) {
      const mesh = makeWareMesh(recipeId);
      mesh.scale.setScalar(0.7);
      return mesh;
    }
    const slot = displays[index];
    const recipe = RECIPES[recipeId];
    if (displayKind(index, state) === 'stand' && recipe?.slot && slot.slotMeshes[recipe.slot]) {
      const mesh = slot.slotMeshes[recipe.slot];
      slot.slotMeshes[recipe.slot] = null;
      if (mesh) slot.wareAnchor.remove(mesh);
      return mesh;
    }
    if (displayKind(index, state) === 'shelf' && slot.shelfMeshes) {
      const slotIndex = slot.shelfMeshes.findIndex((mesh) => mesh?.userData.recipeId === recipeId);
      if (slotIndex >= 0) {
        const mesh = slot.shelfMeshes[slotIndex];
        slot.shelfMeshes[slotIndex] = null;
        if (mesh) slot.wareAnchor.remove(mesh);
        return mesh;
      }
    }
    const mesh = slot.wareMesh;
    slot.wareMesh = null;
    if (mesh) slot.wareAnchor.remove(mesh);
    return mesh;
  }

  function waitingLine() {
    return customers
      .filter((actor) => actor.state !== 'leave' && actor.queueIndex >= 0)
      .sort((a, b) => a.queueIndex - b.queueIndex);
  }

  const BROWSE_SPOTS = [
    { x: -1.55, z: 1.15 },
    { x: 1.55, z: 1.15 },
    { x: -1.35, z: 0.25 },
    { x: 1.35, z: 0.25 },
    { x: 0, z: 1.85 },
  ];

  function browseStops() {
    // Browse stops already claimed by other buyers are nudged aside so nobody stacks.
    const taken = customers.flatMap((a) => (a.browsing ? a.path.slice(-1) : []));
    return pickBrowseStops(BROWSE_SPOTS, rng).map((spot) => freeStandSpot(spot, taken));
  }

  function customersShown() {
    return sceneMode === 'shop' && !state.photoMode;
  }

  function applyCustomerVisibility() {
    const on = customersShown();
    for (const actor of customers) actor.mesh.visible = on;
  }

  function spawnCustomer(now) {
    if (!customersShown()) return;
    const inShop = customers.filter((actor) => actor.state !== 'leave').length;
    if (inShop >= MAX_CUSTOMERS) return;
    // Stagger arrivals: never two buyers on the spawn point or within 1.5 s of each other.
    const spawnAt = buyerRoute().spawn;
    if (!buyerSpawnClear(now, lastBuyerSpawnAt, spawnAt, customers.map((a) => a.mesh.position))) {
      nextSpawnAt = now + 0.5;
      return;
    }
    const kingHere = customers.some((actor) => actor.typeId === 'kingroald' && actor.state !== 'leave');
    const plan = planCustomerSpawn(state, { rng, firstSpawn, inShop, kingHere });
    if (!plan) return;
    if (plan.usedFirst) firstSpawn = false;
    if (!plan.typeId || !plan.request) return;
    spawnActor(plan.typeId, now, plan.request);
  }

  function makeCustomerMesh(typeId, seed, lookId) {
    if (customCustomerSource) {
      const type = CUSTOMERS[typeId] ?? CUSTOMERS.pilgrim;
      const wrapped = wrapImportedCharacter(customCustomerSource, {
        name: typeId,
        label: type.name,
        height: 1.65,
        tint: type.robe,
        speech: true,
        pickKind: 'customer',
        ring: true,
      });
      return wrapped;
    }
    return buildAdventurer(typeId, { seed, lookId });
  }

  function buyerRoute() {
    return buyerCobbleRoute(state.expansions ?? []);
  }

  function spawnActor(typeId, now, request, forcedId = null) {
    if (Number.isInteger(forcedId)) customerSerial = forcedId;
    const lookId = nextBuyerLookId(typeId);
    const mesh = makeCustomerMesh(typeId, customerSerial + rng(), lookId);
    mesh.userData.pick.userData.customerId = customerSerial;
    const route = buyerRoute();
    mesh.position.set(route.spawn.x, 0, route.spawn.z);
    setSpeechText(mesh, `${RECIPES[request.recipeId].name}?`);
    scene.add(mesh);
    const actor = {
      id: customerSerial,
      typeId,
      lookId,
      mesh,
      state: 'enter',
      path: [
        ...route.toDoor,
        { x: SHOP.door.x, z: SHOP.door.z + 0.35 },
        { x: SHOP.door.x, z: SHOP.door.z - 0.45 },
        ...browseStops(),
      ],
      waitUntil: 0,
      requestRecipeId: request.recipeId,
      offerGold: request.gold,
      offer: request.offer,
      carried: null,
      queueIndex: -1,
      browsing: true,
      royal: Boolean(request.royal),
    };
    customerSerial += 1;
    actor.mesh.visible = customersShown();
    customers.push(actor);
    lastBuyerSpawnAt = now;
    playSfx('customer_enter');
    nextSpawnAt = nextSpawnTime(now, rng);
    if (typeId === 'kingroald') {
      pushLog(state, `King Roald arrives, seeking ${RECIPES[request.recipeId].name}.`);
    } else {
      pushLog(state, `${customerName(typeId)} looks around for ${RECIPES[request.recipeId].name}.`);
    }
  }

  function joinQueue(actor, now) {
    actor.browsing = false;
    actor.queueIndex = waitingLine().length;
    const slot = queueSlot(actor.queueIndex, SHOP, counterPose());
    actor.state = 'enter';
    actor.path = [slot];
    actor.waitUntil = now;
  }

  function beginRequest(actor, now) {
    actor.state = 'request';
    actor.waitUntil = now + REQUEST_WAIT;
    actor.path = [];
    actor.mesh.rotation.y = Math.PI;
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = true;
  }

  function settleInLine(actor, now) {
    if (actor.browsing) {
      actor.state = 'browse';
      actor.path = [];
      actor.waitUntil = now + browseWait(rng);
      actor.mesh.rotation.y = rng() * Math.PI * 2;
      return;
    }
    actor.path = [];
    actor.mesh.rotation.y = Math.PI;
    if (actor.queueIndex === 0) {
      beginRequest(actor, now);
      return;
    }
    actor.state = 'queue';
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
  }

  function advanceQueue(now) {
    waitingLine().forEach((actor, index) => {
      actor.queueIndex = index;
      const slot = queueSlot(index, SHOP, counterPose());
      const dist = Math.hypot(slot.x - actor.mesh.position.x, slot.z - actor.mesh.position.z);
      if (dist > 0.12) {
        actor.state = 'enter';
        actor.path = [slot];
        if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
        return;
      }
      settleInLine(actor, now);
    });
  }

  function dismissCustomer(actor, sold, farewell = null) {
    if (!actor || actor.state === 'leave') return;
    if (sold && actor.pendingCarry) {
      const hand = actor.mesh.userData.hand ?? actor.mesh;
      hand.add(actor.pendingCarry);
      actor.pendingCarry.position.set(0, 0, 0);
      actor.pendingCarry.scale.setScalar(0.7);
      actor.carried = actor.pendingCarry;
      actor.pendingCarry = null;
    }
    setSpeechText(actor.mesh, sold ? 'Thanks!' : farewell);
    if (sold && typeof window !== 'undefined') window.setTimeout(() => playSfx('sale'), 320);
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
    if (actor.typeId === 'kingroald' && customerAuthority === 'local') {
      rescheduleKing(state, rng);
    }
    actor.state = 'leave';
    const route = buyerRoute();
    actor.path = [
      { x: SHOP.door.x, z: SHOP.door.z - 0.4 },
      { x: SHOP.door.x, z: SHOP.door.z + 0.45 },
      ...[...route.toDoor].reverse(),
      route.spawn,
    ];
    advanceQueue(lastNow || performance.now() / 1000);
  }

  function holdCustomer(actor, dt, now, bobHz) {
    if (actor.mesh.userData.clipLocomotion) {
      actor.mesh.userData.clipLocomotion.speed = 0;
      syncStance(actor.mesh);
      updateWalkPose(actor.mesh, false, dt, now);
      return;
    }
    actor.mesh.position.y = syncStance(actor.mesh) + Math.abs(Math.sin(now * bobHz + actor.id)) * 0.012;
  }

  /** Wait behind a buyer in front (min 0.8 m), but never longer than BUYER_MAX_WAIT. */
  function buyerHolds(actor, dt) {
    const goal = actor.path[0];
    if (!goal) return false;
    const me = { id: actor.id, x: actor.mesh.position.x, z: actor.mesh.position.z, gx: goal.x, gz: goal.z };
    const others = customers.filter((o) => o !== actor).map((o) => ({
      id: o.id,
      x: o.mesh.position.x,
      z: o.mesh.position.z,
      moving: (o.state === 'enter' || o.state === 'leave') && o.path.length > 0,
      gx: o.path[0]?.x,
      gz: o.path[0]?.z,
    }));
    if (!buyerShouldWait(me, others)) {
      actor.heldFor = 0;
      return false;
    }
    actor.heldFor = (actor.heldFor ?? 0) + dt;
    if (actor.heldFor > BUYER_MAX_WAIT) return false;
    return true;
  }

  function updateCustomers(dt, now) {
    if (customerAuthority === 'local' && now >= nextSpawnAt) spawnCustomer(now);
    for (let i = customers.length - 1; i >= 0; i -= 1) {
      const actor = customers[i];
      if (actor.state === 'enter') {
        if (!actor.path.length) {
          settleInLine(actor, now);
        } else if (buyerHolds(actor, dt)) {
          holdCustomer(actor, dt, now, 1.4);
        } else if (walkToward(actor, actor.path[0], dt)) {
          actor.path.shift();
          if (!actor.path.length) settleInLine(actor, now);
        }
      } else if (actor.state === 'browse') {
        actor.mesh.rotation.y += dt * 0.35;
        holdCustomer(actor, dt, now, 1.4);
        if (now >= actor.waitUntil) joinQueue(actor, now);
      } else if (actor.state === 'queue') {
        actor.mesh.rotation.y = Math.PI + Math.sin(now * 1.1 + actor.id) * 0.06;
        holdCustomer(actor, dt, now, 1.6);
      } else if (actor.state === 'request') {
        actor.mesh.rotation.y = Math.PI + Math.sin(now * 1.4 + actor.id) * 0.12;
        holdCustomer(actor, dt, now, 1.5);
        const have = hasStock(state, actor.requestRecipeId);
        actor.mesh.userData.ring.material.opacity = actor.id === tradingId ? 0.95 : have ? 0.8 : 0.4;
        actor.mesh.userData.ring.material.color.setHex(
          actor.id === tradingId ? 0xf0d27a : have ? 0x8ecf4a : 0xe8b45a,
        );
        if (customerAuthority === 'local' && now >= actor.waitUntil) {
          pushLog(state, `${customerName(actor.typeId)} grows tired and leaves.`);
          dismissCustomer(actor, false);
        }
      } else if (actor.state === 'leave') {
        if (actor.path.length && buyerHolds(actor, dt)) {
          holdCustomer(actor, dt, now, 1.4);
        } else if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          if (actor.path.length) actor.path.shift();
          if (!actor.path.length) {
            if (actor.carried) {
              actor.mesh.userData.hand.remove(actor.carried);
              actor.carried = null;
            }
            scene.remove(actor.mesh);
            customers.splice(i, 1);
          }
        }
      }
      actor.mesh.visible = customersShown();
    }
  }

  function cauldronBrewing() {
    return Object.keys(state.crafts ?? {}).some((id) => stationForRecipe(RECIPES[id]) === 'cauldron');
  }

  function tickAnimProps(dt) {
    if (sceneMode !== 'shop') return;
    for (const anchor of placedGroup.children) {
      const info = anchor.children.find((c) => c.userData?.animProp)?.userData.animProp;
      if (info) tickAnimProp(info, dt);
    }
    const cauldron = fixtureMeshes.cauldron?.mesh?.userData?.animProp;
    if (cauldron) {
      setCauldronBrewing(cauldron, cauldronBrewing());
      tickAnimProp(cauldron, dt);
    }
  }

  loadAnimProps().then((ok) => {
    if (!ok) return;
    try {
      const slot = fixtureMeshes.cauldron;
      if (slot) {
        const next = buildCauldron();
        if (next.userData.animProp) {
          scene.remove(slot.mesh);
          slot.mesh = next;
          scene.add(next);
          applyFixturePose('cauldron');
        }
      }
      while (placedGroup.children.length) { const old = placedGroup.children[0]; old.removeFromParent(); disposeAnimProp(old); }
      syncPlacedMeshes();
    } catch (err) {
      console.warn('Animated props skipped:', err?.message || err);
    }
  });

  let pushCheckAt = 0;
  function tick(dt, now) {
    lastNow = now;
    state.playTime = (state.playTime ?? 0) + dt;
    updatePlayer(dt, now);
    updateFollowCamera(dt);
    if (moveTarget || tintedRoot) updatePlaceTint();
    dust.rotation.y += dt * 0.03;
    const positions = dust.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) + dt * 0.07;
      if (y > 2.5) y = 0.2;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    setChestLid(fixtureMeshes.chest.mesh, chestOpen, dt);
    counterGlow.material.opacity = moveTarget?.id === 'counter' ? 0.7 : 0.0;
    setDoorOpen(shopDoor, true, dt);
    for (const puff of clouds.children) {
      puff.position.x += (puff.userData.drift ?? 0.15) * dt;
      if (puff.position.x > 28) puff.position.x = -28;
    }
    tickTrees(now);
    tickPushSlide(dt);
    if (!pushSlide && ((pushCheckAt += dt) > 0.5)) { pushCheckAt = 0; if (!playerPath.length) pushPlayerClear(); }
    tickTopples(now);
    tickAnimProps(dt);
    syncDisplays();
    refreshSelection();
    const selected = displays[state.selectedDisplay];
    if (selected?.outline) {
      outlineHaloMat.opacity = 0.48 + Math.sin(now * 3.1) * 0.16;
      outlineEdgeMat.opacity = 0.82 + Math.sin(now * 3.1) * 0.16;
      outlineBoxMat.opacity = 0.72 + Math.sin(now * 2.4) * 0.18;
    }
    remoteKeepers.tick(dt, now, sceneMode);
    tickPortalJelly(portalMesh, dt);
    if (runeField?.root?.visible) tickPortalJelly(runeField.portal, dt);
    if (sceneMode === 'shop') {
      updateCustomers(dt, now);
      updateGoblins(dt, now);
      tickFlax(now);
      tickWheat(now);
      tickFountainWater(architecture, now);
    } else if (dungeon?.rats) {
      dungeon.rats.forEach((rat) => {
        const x0 = rat.position.x;
        const z0 = rat.position.z;
        stepRatWander(rat, dt, now);
        const loco = rat.userData.clipLocomotion;
        if (!loco) return;
        const moved = Math.hypot(rat.position.x - x0, rat.position.z - z0);
        const moving = moved > 1e-5;
        loco.speed = dt > 0 && moving ? moved / dt : 0;
        updateWalkPose(rat, moving, dt, now);
      });
    }
    const craftIds = Object.keys(state.crafts ?? {});
    const spinning = craftIds.some((id) => RECIPES[id]?.category === 'spin');
    const sawing = craftIds.some((id) => RECIPES[id]?.category === 'saw');
    const wheelMesh = fixtureMeshes.wheel?.mesh;
    if (wheelMesh?.userData.spinner) {
      wheelMesh.userData.spinner.setActive(spinning);
      wheelMesh.userData.spinner.update(dt);
    } else if (wheelMesh?.userData.spinWheel && spinning) {
      wheelMesh.userData.spinWheel.rotation.z += dt * 9.5;
    }
    const sawSpinner = fixtureMeshes.sawmill?.mesh?.userData.spinner;
    if (sawSpinner) {
      sawSpinner.setActive(sawing);
      sawSpinner.update(dt);
    }
    // Station animations run only while a craft for that station is in state.crafts.
    const potterSpinner = fixtureMeshes.potter?.mesh?.userData.spinner;
    if (potterSpinner) {
      potterSpinner.setActive(craftIds.some((id) => RECIPES[id] && stationForRecipe(RECIPES[id]) === 'potter'));
      potterSpinner.update(dt);
    }
    const furnaceFx = fixtureMeshes.furnace?.mesh?.userData.furnaceFx;
    if (furnaceFx) {
      const smelt = craftIds.map((id) => RECIPES[id]).find((r) => r && stationForRecipe(r) === 'furnace');
      furnaceFx.setActive(Boolean(smelt), smelt?.tint);
      furnaceFx.update(dt);
    }
    const rangeFx = fixtureMeshes.range?.mesh?.userData.rangeFx;
    if (rangeFx) {
      rangeFx.setActive(craftIds.some((id) => RECIPES[id] && stationForRecipe(RECIPES[id]) === 'range'));
      rangeFx.update(dt);
    }
    const loomFx = fixtureMeshes.loom?.mesh?.userData.loomFx;
    if (loomFx) {
      loomFx.setActive(craftIds.some((id) => RECIPES[id] && stationForRecipe(RECIPES[id]) === 'loom'));
      loomFx.update(dt);
    }
    for (const fx of magicSparkles) fx.update(dt);
    if (drawScene) renderer.render(scene, camera);
  }

  function replaceShopkeeperMesh(next) {
    next.position.copy(shopkeeper.position);
    next.rotation.copy(shopkeeper.rotation);
    next.userData.groundY = shopkeeper.userData.groundY ?? next.position.y;
    scene.add(next);
    scene.remove(shopkeeper);
    shopkeeper = next;
    bindGatherEvents(shopkeeper);
    // Co-op: other players follow the local player's model.
    rebuildRemoteKeepers?.();
  }

  function bindGatherEvents(mesh) {
    const loco = mesh?.userData?.clipLocomotion;
    if (loco) loco.onEvent = onGatherEvent;
  }

  function rebuildCustomerMeshes() {
    for (const actor of customers) {
      const pos = actor.mesh.position.clone();
      const rotY = actor.mesh.rotation.y;
      const ringOn = Boolean(actor.mesh.userData.ring?.visible);
      const carried = actor.carried;
      if (carried && actor.mesh.userData.hand) actor.mesh.userData.hand.remove(carried);
      scene.remove(actor.mesh);
      actor.mesh = makeCustomerMesh(actor.typeId, actor.id, actor.lookId);
      actor.mesh.position.copy(pos);
      actor.mesh.rotation.y = rotY;
      if (actor.mesh.userData.pick) actor.mesh.userData.pick.userData.customerId = actor.id;
      if (actor.requestRecipeId && actor.state !== 'leave') {
        setSpeechText(actor.mesh, `${RECIPES[actor.requestRecipeId].name}?`);
      }
      if (ringOn && actor.mesh.userData.ring) actor.mesh.userData.ring.visible = true;
      if (carried) {
        const hand = actor.mesh.userData.hand ?? actor.mesh;
        hand.add(carried);
      }
      actor.mesh.visible = customersShown();
      scene.add(actor.mesh);
    }
  }

  function setShopLayerVisible(on) {
    if (architecture) architecture.visible = on;
    if (roofGroup) roofGroup.visible = on;
    if (groundGroup) groundGroup.visible = on;
    if (padGroup) padGroup.visible = on && expandMode;
    shopDoor.visible = on;
    dust.visible = on;
    clouds.visible = on;
    if (flaxGroup) flaxGroup.visible = on;
    if (wheatGroup) wheatGroup.visible = on;
    // Placed main-area objects (farming patches, construction pieces) belong to
    // the main area only; hide them in the dungeon and rune field.
    patchGroup.visible = on;
    placedGroup.visible = on;
    if (on) applyAllPoses();
    else {
      for (const id of Object.keys(fixtureMeshes)) {
        const slot = fixtureMeshes[id];
        slot.mesh.visible = false;
        slot.pick.visible = false;
        if (slot.glow) slot.glow.visible = false;
      }
      displays.forEach((slot) => {
        slot.anchor.visible = false;
        slot.pick.visible = false;
      });
    }
    customers.forEach((actor) => {
      actor.mesh.visible = on && !state.photoMode;
    });
    goblins.forEach((gob) => {
      gob.mesh.visible = on;
    });
  }

  function ensureDungeon() {
    if (dungeon) return dungeon;
    dungeon = buildDungeon({ riggedRat: riggedRatGltf });
    dungeon.root.visible = false;
    dungeon.grounds.visible = false;
    scene.add(dungeon.root);
    scene.add(dungeon.grounds);
    return dungeon;
  }

  function enterDungeonNow() {
    if (sceneMode === 'dungeon') return;
    const hatch = gardenTrapdoorSpot(state.expansions ?? []);
    shopReturnPos.x = hatch?.x ?? shopkeeper.position.x;
    shopReturnPos.z = hatch?.z ?? shopkeeper.position.z;
    ensureDungeon();
    sceneMode = 'dungeon';
    playerPath.length = 0;
    pendingUse = null;
    servingAtCounter = false;
    stopMining();
    moveMarker.visible = false;
    setShopLayerVisible(false);
    dungeon.root.visible = true;
    dungeon.grounds.visible = true;
    applySkyColor(scene, skyIdForScene('dungeon', state.skybox));
    syncLighting('dungeon');
    // Co-op: tell the room where we arrived (after the teleport below).
    queueMicrotask(() => localMoveListener?.({ x: shopkeeper.position.x, z: shopkeeper.position.z, scene: sceneMode }));
    shopkeeper.userData.groundY = OUTDOOR_GROUND_Y;
    shopkeeper.position.set(-4.15, OUTDOOR_GROUND_Y, 0.4);
    shopkeeper.rotation.y = Math.PI / 2;
    tutorialEmit('enteredDungeon');
  }

  function exitDungeonNow() {
    if (sceneMode !== 'dungeon') return;
    sceneMode = 'shop';
    playerPath.length = 0;
    pendingUse = null;
    servingAtCounter = false;
    stopMining();
    if (dungeon) {
      dungeon.root.visible = false;
      dungeon.grounds.visible = false;
    }
    setShopLayerVisible(true);
    applySkyColor(scene, skyIdForScene('shop', state.skybox));
    syncLighting('shop');
    // Co-op: tell the room where we arrived (after the teleport below).
    queueMicrotask(() => localMoveListener?.({ x: shopkeeper.position.x, z: shopkeeper.position.z, scene: sceneMode }));
    shopkeeper.userData.groundY = characterGroundY(shopReturnPos.x, shopReturnPos.z, state.expansions ?? []);
    shopkeeper.position.set(shopReturnPos.x, shopkeeper.userData.groundY, shopReturnPos.z);
    shopkeeper.rotation.y = Math.PI;
    tutorialEmit('arrivedShop');
  }

  function ensureRuneField() {
    if (runeField) return runeField;
    runeField = buildRuneField();
    runeField.root.visible = false;
    runeField.grounds.visible = false;
    scene.add(runeField.root);
    scene.add(runeField.grounds);
    return runeField;
  }

  function standBesidePortal(pose) {
    if (!pose) return { x: SHOP.keeper.x, z: SHOP.keeper.z };
    const { hw, hd } = furnitureHalfSize('portal');
    const dist = Math.max(hw, hd) + 0.95;
    const yaw = pose.rot ?? 0;
    const offsets = [
      [Math.sin(yaw) * dist, Math.cos(yaw) * dist],
      [-Math.sin(yaw) * dist, -Math.cos(yaw) * dist],
      [Math.cos(yaw) * dist, -Math.sin(yaw) * dist],
      [-Math.cos(yaw) * dist, Math.sin(yaw) * dist],
    ];
    const blocks = playerObstacles(state);
    const floors = playerWalkFloors(state.expansions ?? []);
    for (const [dx, dz] of offsets) {
      const x = pose.x + dx;
      const z = pose.z + dz;
      if (isWalkable(x, z, blocks, PLAYER_RADIUS, floors)) return { x, z };
    }
    return { x: pose.x + offsets[0][0], z: pose.z + offsets[0][1] };
  }

  function enterRuneFieldNow() {
    if (sceneMode === 'runefield') return;
    if (!state.furniture?.portal) return;
    if (sceneMode === 'dungeon') exitDungeonNow();
    const stand = standBesidePortal(state.furniture.portal);
    shopReturnPos.x = stand.x;
    shopReturnPos.z = stand.z;
    ensureRuneField();
    sceneMode = 'runefield';
    playerPath.length = 0;
    pendingUse = null;
    servingAtCounter = false;
    stopMining();
    moveMarker.visible = false;
    setShopLayerVisible(false);
    clouds.visible = true;
    runeField.root.visible = true;
    runeField.grounds.visible = true;
    applySkyColor(scene, skyIdForScene('runefield', state.skybox));
    syncLighting('runefield');
    // Co-op: tell the room where we arrived (after the teleport below).
    queueMicrotask(() => localMoveListener?.({ x: shopkeeper.position.x, z: shopkeeper.position.z, scene: sceneMode }));
    shopkeeper.userData.groundY = OUTDOOR_GROUND_Y;
    shopkeeper.position.set(RUNE_FIELD_ARRIVE.x, OUTDOOR_GROUND_Y, RUNE_FIELD_ARRIVE.z);
    shopkeeper.rotation.y = Math.PI;
  }

  function exitRuneFieldNow() {
    if (sceneMode !== 'runefield') return;
    sceneMode = 'shop';
    playerPath.length = 0;
    pendingUse = null;
    servingAtCounter = false;
    stopMining();
    moveMarker.visible = false;
    if (runeField) {
      runeField.root.visible = false;
      runeField.grounds.visible = false;
    }
    setShopLayerVisible(true);
    applySkyColor(scene, skyIdForScene('shop', state.skybox));
    syncLighting('shop');
    // Co-op: tell the room where we arrived (after the teleport below).
    queueMicrotask(() => localMoveListener?.({ x: shopkeeper.position.x, z: shopkeeper.position.z, scene: sceneMode }));
    const portal = state.furniture?.portal;
    const stand = portal ? standBesidePortal(portal) : { x: shopReturnPos.x, z: shopReturnPos.z };
    shopkeeper.userData.groundY = characterGroundY(stand.x, stand.z, state.expansions ?? []);
    shopkeeper.position.set(stand.x, shopkeeper.userData.groundY, stand.z);
    if (portal) {
      shopkeeper.rotation.y = Math.atan2(portal.x - stand.x, portal.z - stand.z);
    }
  }

  async function warmScene() {
    syncLighting(sceneMode);
    try {
      if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(scene, camera);
      else renderer.compile?.(scene, camera);
    } catch {
      // Shader warmup is best-effort. Frames under the loader still draw the lit shop.
    }
    renderer.render(scene, camera);
  }

  function counterMarkerPose() {
    const mesh = fixtureMeshes.counter?.mesh;
    const pose = state.furniture?.counter;
    if (mesh?.visible) {
      return {
        x: mesh.position.x,
        z: mesh.position.z,
        rot: mesh.rotation.y - furnitureStartYaw('counter'),
      };
    }
    return {
      x: pose?.x ?? SHOP.counter.x,
      z: pose?.z ?? SHOP.counter.z,
      rot: pose?.rot ?? 0,
    };
  }

  function beginMovePatch(index) {
    const saved = state.furniture?.patches?.[index];
    if (!saved) return false;
    const rot = saved.rot ?? FURNITURE_FORWARD;
    placeDraft = { id: 'farming_patch', index, x: saved.x, z: saved.z, rot };
    moveTarget = { id: 'farming_patch', index, moving: true };
    placeNeedsConfirm = true;
    expandMode = false;
    if (padGroup) padGroup.visible = false;
    moveOrigin = null;
    applyPatchGhost();
    rebuildSnapGrid();
    setSnapGridVisible(true);
    highlightSnapCell(saved.x, saved.z);
    if (patchesReady) syncPatchMeshes();
    return true;
  }

  function nearestFireDist(x, z) {
    let best = Infinity;
    for (const row of state.furniture?.placed ?? []) {
      if (!FIRE_PIECES.has(row?.id) || !Number.isFinite(row.x) || !Number.isFinite(row.z)) continue;
      best = Math.min(best, Math.hypot(row.x - x, row.z - z));
    }
    return best;
  }

  /** Per-frame view for the sound director (src/game/sfxHooks.js). */
  function sfxSnapshot() {
    const pos = shopkeeper.position;
    const indoors = sceneMode === 'shop' && pointOnFloors(pos.x, pos.z, interiorFloors(state.expansions ?? []), 0);
    const stations = new Set();
    for (const id of Object.keys(state.crafts ?? {})) {
      if (RECIPES[id]) stations.add(stationForRecipe(RECIPES[id]));
    }
    return {
      gold: state.gold,
      stations: [...stations],
      mining: mining ? { mode: mining.mode, startedAt: mining.startedAt, duration: mining.duration, crop: mining.crop } : null,
      player: { x: pos.x, z: pos.z },
      indoors,
      sceneMode,
      fireDist: sceneMode === 'shop' ? nearestFireDist(pos.x, pos.z) : Infinity,
      herbsReady: (state.furniture?.patches ?? []).filter((p) => p?.crop && Date.now() >= p.crop.endsAt).length,
    };
  }

  return {
    tick,
    sfxSnapshot,
    warmScene,
    syncDisplays,
    refreshSelection,
    replaceFurniture,
    bindWareLook,
    getSelectedName: () => (
      state.displays[state.selectedDisplay]?.name
      ?? SHOP.displays[state.selectedDisplay]?.name
      ?? 'Display'
    ),
    applyLayout() {
      if (sceneMode === 'dungeon') exitDungeonNow();
      if (sceneMode === 'runefield') exitRuneFieldNow();
      syncDisplaySlots();
      applyAllPoses();
      rebuildArchitecture();
      applyAllPoses();
      spawnGoblins();
      if (!customPlayerSource) {
        replaceShopkeeperMesh(makeDefaultKeeper());
      } else {
        setChefHatVisible(shopkeeper, Boolean(state.chefHat));
      }
      applySkyColor(scene, state.skybox ?? DEFAULT_SKYBOX);
      syncLighting(sceneMode);
    },
    refreshFurniture() {
      applyAllPoses();
      syncDisplays();
      syncPlacedMeshes();
    },
    /** Settings "Unstuck": stop everything and stand on a safe spot for this scene. */
    unstuck() {
      stopMining();
      pendingUse = null;
      playerPath.length = 0;
      moveMarker.visible = false;
      const spot = sceneMode === 'dungeon'
        ? { x: -4.15, z: 0.4 }
        : sceneMode === 'runefield'
          ? { x: RUNE_FIELD_ARRIVE.x, z: RUNE_FIELD_ARRIVE.z }
          : { x: SHOP.keeper.x, z: SHOP.keeper.z };
      shopkeeper.position.set(spot.x, 0, spot.z);
      syncStance(shopkeeper);
      shopkeeper.position.y = shopkeeper.userData.groundY;
      return true;
    },
    /** Walk to the chosen fish's spot and keep fishing it. */
    fishFor(materialId) {
      const spot = fishingSpotById(materialId);
      if (!spot) return false;
      queueUse('fishing_spot', { x: spot.x, z: spot.z, materialId: spot.materialId });
      return true;
    },
    beginPlacePiece(pieceId) {
      const row = constructionPiece(pieceId);
      if (!row) return;
      const home = row.mount === 'outdoor'
        ? { x: 4.2, z: 10.2 }
        : { x: 0.4, z: 0.8 };
      const floors = row.mount === 'outdoor'
        ? portalPlaceFloors(state.expansions ?? [])
        : placeRects;
      const start = row.mount === 'wall'
        ? snapToPieceWall(home.x, home.z, state.expansions ?? [], FURNITURE_FORWARD, pieceWallFace(pieceId))
        : snapToFloor(home.x, home.z, floors);
      placeDraft = {
        id: 'piece',
        pieceId,
        index: null,
        x: start.x,
        z: start.z,
        rot: start.rot ?? FURNITURE_FORWARD,
      };
      moveTarget = { id: 'piece', pieceId, snap: true };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = null;
      applyPieceGhost();
      setSnapGridVisible(row.mount !== 'outdoor');
      highlightSnapCell(start.x, start.z);
    },
    beginMovePiece(index) {
      const row = state.furniture?.placed?.[index];
      const piece = row ? constructionPiece(row.id) : null;
      if (!row || !piece) return;
      placeDraft = {
        id: 'piece',
        pieceId: row.id,
        index,
        x: row.x,
        z: row.z,
        rot: row.rot ?? FURNITURE_FORWARD,
      };
      moveTarget = { id: 'piece', pieceId: row.id, index, moving: true, snap: true };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = { x: row.x, z: row.z, rot: row.rot ?? FURNITURE_FORWARD };
      syncPlacedMeshes();
      applyPieceGhost();
      setSnapGridVisible(piece.mount !== 'outdoor');
      highlightSnapCell(row.x, row.z);
    },
    setPieceSnap(on) {
      if (moveTarget?.id === 'piece') moveTarget.snap = Boolean(on);
    },
    setChestOpen(open) {
      chestOpen = Boolean(open);
    },
    ignorePicks(ms = 250) {
      ignorePicksUntil = performance.now() + ms;
    },
    setTrading(id) {
      tradingId = id;
    },
    onPick(handler) {
      pickHandler = handler;
    },
    fillAtFountainPiece(index) { return fillAtFountainPiece(index); },
    isFountainPiece(index) { return isFountainPiece(index); },
    fillAtPond(point) { return fillAtPond(point); },
    useBoulder(pose) {
      if (!pose) return;
      if (pose.kind === 'tree') {
        if (!treeCanChop(pose.x, pose.z)) return;
        queueUse('tree', {
          x: pose.x,
          z: pose.z,
          materialId: pose.materialId ?? 'logs',
          trunkRadius: pose.trunkRadius ?? plantedTrunkRadius(pose.x, pose.z),
        });
        return;
      }
      if (pose.kind === 'flax') {
        queueUse('flax', { x: pose.x, z: pose.z, materialId: 'flax', plantId: pose.plantId });
        return;
      }
      if (pose.kind === 'wheat') {
        queueUse('wheat', { x: pose.x, z: pose.z, materialId: 'wheat', plantId: pose.plantId });
        return;
      }
      if (pose.kind === 'fishing_spot') {
        queueUse('fishing_spot', { x: pose.x, z: pose.z, materialId: pose.materialId });
        return;
      }
      if (!pose.materialId) return;
      queueUse('boulder', { x: pose.x, z: pose.z, materialId: pose.materialId });
    },
    getCustomer(id) {
      return customers.find((c) => c.id === id) ?? null;
    },
    /** Co-op: 'remote' stops local spawns and timeouts; the room sends travellers instead. */
    setCustomerAuthority(mode) {
      const next = mode === 'remote' ? 'remote' : 'local';
      if (next === customerAuthority) return;
      customerAuthority = next;
      for (const actor of customers) scene.remove(actor.mesh);
      customers.length = 0;
      tradingId = null;
      nextSpawnAt = (lastNow || 0) + FIRST_CUSTOMER_DELAY;
    },
    getCustomerAuthority() {
      return customerAuthority;
    },
    /** Co-op: draw a traveller the room spawned. */
    spawnRemoteCustomer(customer) {
      if (!customer || customers.some((c) => c.id === customer.id)) return null;
      if (!CUSTOMERS[customer.typeId] || !RECIPES[customer.request?.recipeId]) return null;
      const keep = customerSerial;
      spawnActor(customer.typeId, lastNow || 0, customer.request, customer.id);
      customerSerial = Math.max(keep, customer.id + 1);
      return customers.find((c) => c.id === customer.id) ?? null;
    },
    /** Co-op: a traveller left in the room (sold, bought, refused, timeout). */
    removeRemoteCustomer(id, reason = 'timeout') {
      const actor = customers.find((c) => c.id === id);
      if (!actor || actor.state === 'leave') return false;
      if (reason === 'sold') {
        actor.pendingCarry = takeWareMesh(actor.requestRecipeId);
        dismissCustomer(actor, true);
        syncDisplays();
      } else if (reason === 'bought') {
        dismissCustomer(actor, false, 'Sold.');
      } else {
        dismissCustomer(actor, false);
      }
      return true;
    },
    /** Co-op: called with { x, z, scene } whenever the local keeper starts a walk. */
    onLocalMove(fn) {
      localMoveListener = typeof fn === 'function' ? fn : null;
    },
    /** Co-op: called with { mode: 'mine'|'chop'|'pick'|null, yaw } when local gathering starts or stops. */
    onLocalActivity(fn) {
      localActivityListener = typeof fn === 'function' ? fn : null;
    },
    getLocalKeeperPose() {
      return { x: shopkeeper.position.x, z: shopkeeper.position.z, scene: sceneMode };
    },
    remoteKeepers: remoteKeepers.api,
    listCustomers() {
      return waitingLine();
    },
    getFrontCustomer() {
      return customers.find((actor) => actor.state === 'request') ?? null;
    },
    setDraw(on = true) {
      drawScene = Boolean(on);
    },
    inspectCustomers() {
      return customers.map((actor) => {
        const mesh = actor.mesh;
        const loco = mesh?.userData?.clipLocomotion ?? null;
        mesh?.updateMatrixWorld(true);
        const foot = (name) => {
          const bone = mesh?.getObjectByName(name);
          if (!bone) return null;
          const v = new THREE.Vector3();
          bone.getWorldPosition(v);
          return { x: v.x, y: v.y, z: v.z };
        };
        let skinned = 0;
        let culled = 0;
        mesh?.traverse((child) => {
          if (!child.isSkinnedMesh) return;
          skinned += 1;
          if (child.frustumCulled) culled += 1;
        });
        const handR = mesh?.getObjectByName('Hand_R');
        const handL = mesh?.getObjectByName('Hand_L');
        const visual = mesh?.getObjectByName('rigged-buyer');
        let height = null;
        let footY = null;
        if (visual) {
          const box = new THREE.Box3().setFromObject(visual);
          height = box.max.y - box.min.y;
          footY = box.min.y - (mesh?.position.y ?? 0);
        }
        return {
          id: actor.id,
          typeId: actor.typeId,
          lookId: actor.lookId,
          state: actor.state,
          x: mesh?.position.x ?? 0,
          y: mesh?.position.y ?? 0,
          z: mesh?.position.z ?? 0,
          rotY: mesh?.rotation.y ?? 0,
          mode: loco?.mode ?? null,
          timeScale: loco?.walk?.timeScale ?? null,
          speed: loco?.speed ?? null,
          scale: mesh?.userData?.modelScale ?? null,
          rigged: Boolean(loco && visual),
          skinned,
          frustumCulled: culled,
          handRChildren: (handR?.children ?? []).map((child) => child.name),
          handLChildren: (handL?.children ?? []).map((child) => child.name),
          height,
          footY,
          footL: foot('Foot_L'),
          footR: foot('Foot_R'),
          buyerLookId: mesh?.userData?.buyerLookId ?? null,
        };
      });
    },
    /**
     * Live world position of a tutorial target, from the real object:
     * trapdoor (the garden hatch, follows expansions), bronzeRock (the dungeon boulder mesh),
     * ladder (dungeon exit ladder mesh), furnace (the placed furnace or its placement ghost).
     */
    tutorialAnchor(name) {
      const centre = (obj, fallbackY = 0.5) => {
        if (!obj) return null;
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        if (!Number.isFinite(box.min.x)) {
          const p = obj.getWorldPosition(new THREE.Vector3());
          return { x: p.x, y: p.y + fallbackY, z: p.z };
        }
        const c = box.getCenter(new THREE.Vector3());
        return { x: c.x, y: c.y, z: c.z };
      };
      if (name === 'trapdoor') {
        if (sceneMode !== 'shop') return null;
        const hatch = gardenTrapdoorSpot(state.expansions ?? []);
        return hatch ? { x: hatch.x, y: 0.1, z: hatch.z } : null;
      }
      if (name === 'bronzeRock' || name === 'ladder') {
        if (sceneMode !== 'dungeon' || !dungeon) return null;
        if (name === 'ladder') return centre(dungeon.ladder);
        const i = DUNGEON_BOULDERS.findIndex((spot) => spot.id === 'bronze');
        return centre(dungeon.boulders?.[i]);
      }
      if (name === 'furnace') {
        if (sceneMode !== 'shop') return null;
        const slot = fixtureMeshes.furnace;
        if (!slot?.mesh?.visible) return null;
        return centre(slot.mesh);
      }
      return null;
    },
    /** Narrow screens: keep a tutorial target framed with the player (null releases it). */
    frameTutorialTarget(point) {
      camFocus = point && Number.isFinite(point.x) && Number.isFinite(point.z)
        ? { x: point.x, z: point.z, weight: Math.min(1, Math.max(0, point.weight ?? 0.5)) }
        : null;
    },
    /** Rotate whatever is being placed (station, shelf, table, piece) by a quarter turn. */
    rotatePlacing(dir = 1) {
      if (!moveTarget) return false;
      const pose = poseOf(moveTarget);
      if (!pose) return false;
      const kind = placeKindOf(moveTarget);
      const wallPiece = kind === 'piece' && constructionPiece(moveTarget.pieceId)?.mount === 'wall';
      if (kind === 'shelf' || wallPiece) return rotateFurniturePose(moveTarget, dir);
      pose.rot = (pose.rot ?? FURNITURE_FORWARD) + (dir < 0 ? -1 : 1) * (Math.PI / 2);
      applyMovePose(moveTarget);
      tintKey = '';
      return true;
    },
    projectToClient(x, y, z) {
      const point = new THREE.Vector3(x, y, z);
      point.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
      };
    },
    sellToActor(actor) {
      if (!actor || actor.state === 'leave') return;
      actor.pendingCarry = takeWareMesh(actor.requestRecipeId);
      dismissCustomer(actor, true);
      syncDisplays();
    },
    refuseActor(actor) {
      dismissCustomer(actor, false);
    },
    buyFromActor(actor) {
      if (!actor || actor.state === 'leave') return;
      dismissCustomer(actor, false, 'Sold.');
    },
    beginMoveFurniture(target) {
      if (target?.id === 'farming_patch') {
        beginMovePatch(target.index);
        return;
      }
      moveTarget = target;
      placeNeedsConfirm = false;
      placeDraft = null;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      const pose = poseOf(target);
      moveOrigin = pose ? { x: pose.x, z: pose.z, rot: pose.rot ?? FURNITURE_FORWARD } : null;
      setSnapGridVisible(true);
      if (pose) highlightSnapCell(pose.x, pose.z);
      pickHandler?.({ type: 'furniture-move-start', furniture: target });
    },
    beginPlaceUnlock(id) {
      const home = id === 'portal' ? PORTAL_HOME : (SHOP[id] ?? SHOP.cauldron);
      const rects = id === 'portal' ? portalPlaceFloors(state.expansions ?? []) : placeRects;
      const start = snapToFloor(home.x, home.z, rects);
      placeDraft = { id, x: start.x, z: start.z, rot: FURNITURE_FORWARD };
      moveTarget = { id };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = null;
      applyFixturePose(id);
      rebuildSnapGrid();
      setSnapGridVisible(true);
      highlightSnapCell(start.x, start.z);
      pickHandler?.({ type: 'furniture-place-start', furniture: { id } });
    },
    beginPlaceFurniture(kind) {
      const start = firstOpenFurniturePose(state, kind);
      const index = displays.length;
      const spot = {
        id: `new-${kind}-${index}`,
        name: kind === 'stand' ? 'Mannequin' : kind === 'shelf' ? 'Shelf' : 'Table',
        x: start.x,
        z: start.z,
        kind,
      };
      displays.push(makeDisplaySlot(spot, index, start));
      placeDraft = {
        id: 'display',
        index,
        x: start.x,
        z: start.z,
        rot: start.rot ?? FURNITURE_FORWARD,
      };
      moveTarget = { id: 'display', index, kind };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = null;
      applyDisplayPose(index);
      setSnapGridVisible(true);
      highlightSnapCell(start.x, start.z);
      pickHandler?.({ type: 'furniture-place-start', furniture: { id: 'display', index } });
    },
    confirmPlaceUnlock() {
      if (!moveTarget || !placeNeedsConfirm) return null;
      const check = tryConfirmPlace();
      const target = { id: moveTarget.id, index: moveTarget.index };
      if (!check.ok) {
        // The buy is recorded before this second check. A patch must not
        // reject its own pose and then skip the mesh.
        const recorded = target.id === 'farming_patch' && patchRecordedAt(visualPlacePose());
        if (!recorded) {
          pickHandler?.({ type: 'furniture-place-blocked', reason: check.reason });
          return null;
        }
      }
      const source = check.ok ? check.pose : visualPlacePose();
      const pose = { x: source.x, z: source.z, rot: source.rot };
      rebuildNav();
      clearMoveMode();
      if (target.id === 'display') applyDisplayPose(target.index);
      else if (target.id !== 'farming_patch') applyFixturePose(target.id);
      if (patchesReady) syncPatchMeshes();
      if (target.id === 'farming_patch') shiftPlantsOffPatch(pose);
      return pose;
    },
    beginMovePatch,
    beginPlacePatch() {
      const grass = gardenBox(state.expansions ?? []);
      const rects = patchPlaceFloors(state.expansions ?? []);
      const home = { x: (grass.minX + grass.maxX) / 2 - 4.2, z: grass.minZ + 4.4 };
      const start = snapToFloor(home.x, home.z, rects);
      placeDraft = { id: 'farming_patch', x: start.x, z: start.z, rot: FURNITURE_FORWARD };
      moveTarget = { id: 'farming_patch' };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = null;
      applyPatchGhost();
      rebuildSnapGrid();
      setSnapGridVisible(true);
      highlightSnapCell(start.x, start.z);
      pickHandler?.({ type: 'furniture-place-start', furniture: { id: 'farming_patch' } });
    },
    tryConfirmPlace,
    getPlacePose() {
      return moveTarget && placeNeedsConfirm ? visualPlacePose() : null;
    },
    isPlacingUnlock() {
      return Boolean(placeNeedsConfirm);
    },
    rotateFurniture(target, dir = 1) {
      const ok = rotateFurniturePose(target, dir);
      if (ok && !moveTarget) syncFixtureIntent(target);
      return ok;
    },
    isMovingFurniture() {
      return Boolean(moveTarget);
    },
    cancelMoveFurniture() {
      cancelPlaceOrMove();
    },
    setExpandMode(on) {
      expandMode = Boolean(on);
      selectedPad = null;
      if (padGroup) {
        padGroup.visible = expandMode;
        padGroup.children.forEach((child) => {
          if (child.userData.kind === 'expand-pad') {
            child.material.opacity = child.userData.connects ? 0.28 : 0.08;
            child.visible = true;
            if (!child.userData.connects) child.material.color.setHex(0x6a5a40);
          }
        });
      }
    },
    getSelectedPad() {
      return selectedPad;
    },
    rebuildAfterExpansion() {
      rebuildArchitecture();
      applyAllPoses();
      spawnGoblins();
    },
    setSkybox(id) {
      state.skybox = id;
      applySkyColor(scene, skyIdForScene(sceneMode, id));
    },
    resetCamera() {
      resetCamPose(cam);
    },
    setBrightness(value) {
      state.brightness = clampBrightness(value);
      syncLighting(sceneMode);
      return state.brightness;
    },
    setDungeonBrightness(value) {
      state.dungeonBrightness = clampDungeonBrightness(value);
      syncLighting(sceneMode);
      return state.dungeonBrightness;
    },
    setPhotoMode(on) {
      state.photoMode = Boolean(on);
      applyCustomerVisibility();
      return state.photoMode;
    },
    setChefHat(on) {
      state.chefHat = Boolean(on);
      setChefHatVisible(shopkeeper, state.chefHat);
    },
    hasCustomPlayer() {
      return Boolean(customPlayerSource);
    },
    playerYaw180() {
      return customPlayerYaw;
    },
    playerOrientationHint() {
      return customPlayerHint;
    },
    playerModelName() {
      return customPlayerName;
    },
    getPlayerFit() {
      const visual = shopkeeper.getObjectByName('uploaded-player')
        || shopkeeper.getObjectByName('rigged-player')
        || shopkeeper;
      shopkeeper.updateMatrixWorld(true);
      const box = new THREE.Box3();
      let any = false;
      const gearName = /pickaxe|hatchet|chef-hat|importedGrip|hammer/i;
      visual.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        let node = child;
        let gear = false;
        while (node && node !== visual) {
          if (gearName.test(node.name || '')) {
            gear = true;
            break;
          }
          node = node.parent;
        }
        if (gear) return;
        box.expandByObject(child);
        any = true;
      });
      const ground = shopkeeper.userData.groundY ?? shopkeeper.position.y;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const loco = shopkeeper.userData.clipLocomotion;
      return {
        custom: Boolean(customPlayerSource),
        yaw180: customPlayerYaw,
        name: customPlayerName,
        animated: Boolean(loco?.walk || loco?.idle),
        height: any ? size.y : 0,
        feet: any ? box.min.y - ground : 0,
        centerX: any ? center.x - shopkeeper.position.x : 0,
        centerZ: any ? center.z - shopkeeper.position.z : 0,
        x: shopkeeper.position.x,
        z: shopkeeper.position.z,
        hint: customPlayerHint,
      };
    },
    setPlayerLook(model, opts = {}) {
      try {
        if (!model) {
          clearCustomPlayer();
          replaceShopkeeperMesh(makeDefaultKeeper());
          return { ok: true };
        }
        return applyUploadedPlayer(model, opts);
      } catch (err) {
        return { ok: false, reason: friendlyPlayerReason(err) };
      }
    },
    setPlayerYaw180(on) {
      if (!customPlayerSource) {
        return { ok: false, reason: 'No uploaded player model. The current model is unchanged.' };
      }
      try {
        return applyUploadedPlayer(customPlayerSource, {
          yaw180: Boolean(on),
          name: customPlayerName,
        });
      } catch (err) {
        return { ok: false, reason: friendlyPlayerReason(err) };
      }
    },
    setCustomerLook(model) {
      try {
        if (!model) {
          customCustomerSource = null;
          rebuildCustomerMeshes();
          return { ok: true };
        }
        wrapImportedCharacter(model, {
          name: 'customer',
          label: 'Customer',
          height: 1.65,
          speech: true,
          pickKind: 'customer',
          ring: true,
        });
        customCustomerSource = model;
        rebuildCustomerMeshes();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message || 'Could not use that as a customer model.' };
      }
    },
    enterDungeon() {
      enterDungeonNow();
    },
    exitDungeon() {
      exitDungeonNow();
    },
    enterRuneField() {
      enterRuneFieldNow();
    },
    exitRuneField() {
      exitRuneFieldNow();
    },
    useFixture(id) {
      const pose = state.furniture?.[id];
      if (!pose) return;
      queueUse(id, pose);
    },
    isInDungeon() {
      return sceneMode === 'dungeon';
    },
    isInRuneField() {
      return sceneMode === 'runefield';
    },
    getMining(now = performance.now() / 1000) {
      if (!mining) return null;
      const t = Math.min(1, Math.max(0, (now - mining.startedAt) / mining.duration));
      const want = barYield(mining);
      const have = state.materials[mining.materialId] ?? 0;
      const mineMode = (mining.mode ?? 'mine') === 'mine';
      const grant = mineMode
        ? miningBarAmount(state, mining.materialId, want)
        : Math.min(want, Math.max(0, storageCap(state) - have));
      return {
        materialId: mining.materialId,
        name: mining.name,
        mode: mining.mode ?? 'mine',
        verb: mining.verb
          ?? (mining.mode === 'chop' ? 'Chopping'
            : mining.mode === 'fish' ? 'Fishing'
            : mining.mode === 'pick' ? 'Picking'
              : mining.mode === 'fill' ? 'Filling'
                : 'Mining'),
        t,
        yield: grant,
      };
    },
    getMinimapSnapshot() {
      const player = {
        x: shopkeeper.position.x,
        z: shopkeeper.position.z,
        facing: shopkeeper.rotation.y,
      };
      if (sceneMode === 'dungeon') {
        return {
          hidden: false,
          sceneMode,
          yaw: cam.yaw,
          bounds: dungeonMapBounds(),
          focus: dungeonMapFocus(),
          player,
          rocks: DUNGEON_BOULDERS.map((spot) => ({
            id: spot.id,
            materialId: spot.materialId,
            x: spot.x,
            z: spot.z,
            scale: spot.scale ?? 1,
            vein: spot.vein,
            essence: Boolean(spot.essence),
          })),
          ladder: {
            x: dungeon?.ladder?.position.x ?? -5.2,
            z: dungeon?.ladder?.position.z ?? 0.4,
          },
          rats: (dungeon?.rats ?? []).map((rat) => ({
            x: rat.position.x,
            z: rat.position.z,
          })),
        };
      }
      if (sceneMode !== 'shop') return { hidden: true, sceneMode };
      return {
        hidden: false,
        sceneMode,
        yaw: cam.yaw,
        expansions: state.expansions ?? [],
        player,
        customers: customers
          .filter((actor) => actor.mesh.visible)
          .map((actor) => ({ x: actor.mesh.position.x, z: actor.mesh.position.z })),
        furniture: displays.map((slot, i) => {
          const pose = state.furniture.displays[i] ?? slot.spot;
          return { x: pose.x, z: pose.z, kind: slot.spot.kind };
        }),
        counter: counterMarkerPose(),
      };
    },
    walkTo(x, z) {
      return setMoveTarget(x, z);
    },
    applyBundledDefaults(playerScene) {
      bundledPlayerSource = playerScene ?? null;
      try {
        rebuildArchitecture();
      } catch (err) {
        console.warn('Bundled shop architecture skipped:', err?.message || err);
      }
      const replaceFixture = (id, builder) => {
        try {
          const slot = fixtureMeshes[id];
          if (!slot) return;
          const next = builder();
          scene.remove(slot.mesh);
          slot.mesh = next;
          scene.add(next);
          applyFixturePose(id);
        } catch (err) {
          console.warn(`Bundled ${id} skipped:`, err?.message || err);
        }
      };
      replaceFixture('counter', buildCounter);
      replaceFixture('chest', buildChest);
      replaceFixture('range', buildRange);
      replaceFixture('furnace', buildFurnace);
      replaceFixture('anvil', buildAnvil);
      replaceFixture('cauldron', buildCauldron);
      replaceFixture('wheel', buildSpinningWheel);
      replaceFixture('loom', buildLoom);
      replaceFixture('fletch', buildFletchingBench);
      replaceFixture('potter', buildPotterWheel);
      replaceFixture('sawmill', buildSawmill);
      replaceFixture('rug', buildRug);
      try {
        const nextDoor = buildShopDoor();
        nextDoor.visible = shopDoor.visible;
        scene.remove(shopDoor);
        shopDoor = nextDoor;
        scene.add(shopDoor);
      } catch (err) {
        console.warn('Bundled door skipped:', err?.message || err);
      }
      if (dungeon) {
        const keepVisible = dungeon.root.visible;
        scene.remove(dungeon.root);
        scene.remove(dungeon.grounds);
        dungeon = buildDungeon({ riggedRat: riggedRatGltf });
        dungeon.root.visible = keepVisible;
        dungeon.grounds.visible = keepVisible;
        scene.add(dungeon.root);
        scene.add(dungeon.grounds);
      }
      displays.forEach((slot) => {
        try {
          slot.anchor.remove(slot.furniture);
          const furniture = buildFurniture(slot.spot.kind);
          slot.anchor.add(furniture);
          slot.furniture = furniture;
          slot.wareAnchor.position.y = furniture.userData.stand ? 0 : furniture.userData.wareY;
          slot.anchor.add(slot.wareAnchor);
        } catch (err) {
          console.warn('Bundled furniture skipped:', err?.message || err);
        }
      });
      if (!customPlayerSource) {
        try {
          replaceShopkeeperMesh(makeDefaultKeeper());
        } catch (err) {
          console.warn('Bundled player skipped:', err?.message || err);
          bundledPlayerSource = null;
          replaceShopkeeperMesh(makeDefaultKeeper());
        }
      }
      applyAllPoses();
      syncDisplays();
      spawnGoblins();
    },
    clearUploads() {
      clearCustomPlayer();
      customCustomerSource = null;
      state.wareLooks = {};
      displays.forEach((slot, i) => {
        slot.anchor.remove(slot.furniture);
        const furniture = buildFurniture(slot.spot.kind);
        slot.anchor.add(furniture);
        slot.furniture = furniture;
        slot.wareAnchor.position.y = furniture.userData.stand ? 0 : furniture.userData.wareY;
        slot.anchor.add(slot.wareAnchor);
        void i;
      });
      replaceShopkeeperMesh(makeDefaultKeeper());
      rebuildCustomerMeshes();
      syncDisplays();
      refreshSelection(true);
      pushLog(state, 'Cleared uploaded models. Default looks are back.');
    },
  };
}
