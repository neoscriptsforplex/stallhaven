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
  MATERIALS,
  MINE_DURATION,
  MINE_YIELD,
  emptySlots,
  emptyShelfSlots,
  mostExpensiveChestId,
  scheduleKingRoald,
  shelfSlotPoses,
  SHELF_SLOT_COUNT,
} from './catalog.js';
import { grantMinedMaterial, hasStock, pushLog } from './economy.js';
import {
  FURNITURE_FORWARD,
  FURNITURE_ROT_STEP,
  FURNITURE_SNAP,
  cloneFurniture,
  gardenBox,
  gardenTrapdoorSpot,
  playerWalkFloors,
  pointHitsShop,
  pointOnFloors,
  snapToFloor,
  walkFloors,
} from './layout.js';
import {
  PLAYER_RADIUS,
  floorsForState,
  liveObstacles,
  placementBlocked,
  planPlayerWalk,
  planWalk,
  queueSlot,
} from './nav.js';
import { playClick } from './audio.js';
import {
  STATION_ARRIVE,
  STATION_HIT,
  pickUseHit,
  resolveStationUse,
  stationAtFloor,
} from './interact.js';
import {
  buildAdventurer,
  buildAnvil,
  buildChest,
  buildCounter,
  buildDust,
  buildFurniture,
  buildGoblin,
  buildShopDoor,
  buildShopkeeper,
  buildWare,
  normalizeImported,
  setChefHatVisible,
  setChestLid,
  setDoorOpen,
  setSpeechText,
  slotPose,
  setHeldTool,
  updateMinePose,
  updateWalkPose,
  wareTopY,
  wrapImportedCharacter,
} from './models.js';
import { buildCauldron, buildDungeon, buildFurnace, buildRange, buildShop, buildSpinningWheel, DUNGEON_BOULDERS } from './shopbuild.js';
import { stepRatWander } from './rats.js';

const CUSTOMER_SPEED = 1.35;
const PLAYER_SPEED = 1.85;
const CAM_YAW_SPEED = 2.175;
const CAM_PITCH_SPEED = 1.425;
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

export function createWorld(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  applySkyColor(scene, state.skybox ?? DEFAULT_SKYBOX);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 180);
  const cam = {
    yaw: -0.06,
    pitch: 0.62,
    distance: 6.85,
  };
  const camLook = new THREE.Vector3(SHOP.keeper.x, 0.95, SHOP.keeper.z);
  const camHeld = { left: false, right: false, up: false, down: false };
  camera.position.set(SHOP.cameraStart.x, SHOP.cameraStart.y, SHOP.cameraStart.z);
  camera.lookAt(camLook);

  const hemi = new THREE.HemisphereLight(0xf0e2c4, 0x6a5340, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe1b0, 1.15);
  sun.position.set(-4.5, 12, 6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun);

  const doorLight = new THREE.PointLight(0xffe1b0, 2.4, 6, 2);
  doorLight.position.set(0, 2.15, 3.9);
  scene.add(doorLight);

  if (!state.furniture) state.furniture = cloneFurniture();
  let architecture = null;
  let roofGroup = null;
  let groundGroup = null;
  let padGroup = null;
  let floors = walkFloors(state.expansions ?? []);
  let playerFloors = playerWalkFloors(state.expansions ?? []);
  const obstacles = liveObstacles(state);
  let expandMode = false;
  let selectedPad = null;
  let moveTarget = null;
  let moveOrigin = null;
  let placeNeedsConfirm = false;
  let placeDraft = null;
  let snapGrid = null;

  function disposeGroup(group) {
    if (!group) return;
    scene.remove(group);
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }

  function rebuildArchitecture() {
    disposeGroup(architecture);
    disposeGroup(roofGroup);
    disposeGroup(groundGroup);
    disposeGroup(padGroup);
    const built = buildShop(state.expansions ?? []);
    architecture = built.root;
    roofGroup = built.roofs;
    groundGroup = built.grounds;
    padGroup = built.pads;
    padGroup.visible = expandMode;
    scene.add(architecture);
    scene.add(roofGroup);
    scene.add(groundGroup);
    scene.add(padGroup);
    floors = floorsForState(state);
    playerFloors = playerWalkFloors(state.expansions ?? []);
    rebuildNav();
    rebuildSnapGrid();
  }

  function rebuildNav() {
    const next = liveObstacles(state);
    obstacles.length = 0;
    obstacles.push(...next);
  }

  rebuildArchitecture();
  const shopDoor = buildShopDoor();
  scene.add(shopDoor);
  const dust = buildDust();
  scene.add(dust);

  let shopkeeper = buildShopkeeper({
    chefHat: Boolean(state.chefHat),
    appearance: state.appearance,
  });
  shopkeeper.position.set(SHOP.keeper.x, 0, SHOP.keeper.z);
  shopkeeper.rotation.y = 0.35;
  shopkeeper.scale.setScalar(1.16);
  scene.add(shopkeeper);
  let customPlayerSource = null;
  let customCustomerSource = null;
  const clouds = buildClouds();
  scene.add(clouds);
  let sceneMode = 'shop';
  let dungeon = null;
  let pendingUse = null;
  let mining = null;
  let lastPlaceClickAt = 0;
  const DUNGEON_FLOOR = { minX: -5.2, maxX: 5.2, minZ: -4.2, maxZ: 4.2 };
  const shopReturnPos = { x: SHOP.keeper.x, z: SHOP.keeper.z };
  const playerPath = [];
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
  const counterPick = makePick(2.7, 1.2, 0.95, 'counter');
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

  const UNLOCK_STATIONS = ['cauldron', 'furnace', 'wheel'];

  const fixtureMeshes = {
    counter: { mesh: counterMesh, pick: counterPick, glow: counterGlow, pickY: 0.55 },
    anvil: { mesh: anvil, pick: anvilPick, glow: null, pickY: STATION_HIT.anvil.pickY },
    chest: { mesh: chest, pick: chestPick, glow: null, pickY: STATION_HIT.chest.pickY },
    range: { mesh: rangeMesh, pick: rangePick, glow: null, pickY: STATION_HIT.range.pickY },
    cauldron: { mesh: cauldronMesh, pick: cauldronPick, glow: null, pickY: STATION_HIT.cauldron.pickY },
    furnace: { mesh: furnaceMesh, pick: furnacePick, glow: null, pickY: STATION_HIT.furnace.pickY },
    wheel: { mesh: wheelMesh, pick: wheelPick, glow: null, pickY: STATION_HIT.wheel.pickY },
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
    slot.mesh.position.set(pose.x, 0, pose.z);
    slot.mesh.rotation.y = pose.rot ?? FURNITURE_FORWARD;
    slot.pick.position.set(pose.x, slot.pickY, pose.z);
    slot.pick.rotation.y = pose.rot ?? FURNITURE_FORWARD;
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
    const pickSize = spot.kind === 'stand'
      ? [1.15, 2.05, 1.05]
      : spot.kind === 'shelf'
        ? [1.42, 1.15, 0.46]
        : [1.45, 1.15, 1.0];
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
      if (target.id !== 'display' || target.index === placeDraft.index) return placeDraft;
    }
    return target.id === 'display'
      ? state.furniture.displays[target.index]
      : state.furniture[target.id];
  }

  function applyMovePose(target) {
    if (!target) return;
    if (target.id === 'display') applyDisplayPose(target.index);
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
    for (const rect of floors) {
      const minX = Math.ceil((rect.minX + 0.02) / FURNITURE_SNAP) * FURNITURE_SNAP;
      const maxX = Math.floor((rect.maxX - 0.02) / FURNITURE_SNAP) * FURNITURE_SNAP;
      const minZ = Math.ceil((rect.minZ + 0.02) / FURNITURE_SNAP) * FURNITURE_SNAP;
      const maxZ = Math.floor((rect.maxZ - 0.02) / FURNITURE_SNAP) * FURNITURE_SNAP;
      for (let x = minX; x <= maxX + 1e-6; x += FURNITURE_SNAP) {
        positions.push(x, y, minZ, x, y, maxZ);
      }
      for (let z = minZ; z <= maxZ + 1e-6; z += FURNITURE_SNAP) {
        positions.push(minX, y, z, maxX, y, z);
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
    const snapped = snapToFloor(x, z, floors);
    const pose = poseOf(moveTarget);
    if (!pose) return snapped;
    pose.x = snapped.x;
    pose.z = snapped.z;
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

  function clearMoveMode() {
    moveTarget = null;
    moveOrigin = null;
    placeNeedsConfirm = false;
    placeDraft = null;
    setSnapGridVisible(false);
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
    if (id && id !== 'display') applyFixturePose(id);
  }

  function floorPointFromEvent(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(groundMeshes(), false);
    return hits[0]?.point ?? null;
  }

  function applyAllPoses() {
    for (const id of Object.keys(fixtureMeshes)) applyFixturePose(id);
    displays.forEach((_, index) => applyDisplayPose(index));
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
  let nextSpawnAt = FIRST_CUSTOMER_DELAY;
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

  function spawnGoblins() {
    for (const gob of goblins) scene.remove(gob.mesh);
    goblins.length = 0;
    for (let i = 0; i < GOBLIN_COUNT; i += 1) {
      const start = grassWanderPoint();
      const mesh = buildGoblin();
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
      if (pointHitsShop(nx, nz, state.expansions ?? [], 0.95) || pointOnFloors(nx, nz, floors, 0.4)) {
        gob.goal = grassWanderPoint({ x: pos.x, z: pos.z });
        gob.waitUntil = now + 0.35;
        continue;
      }
      pos.x = nx;
      pos.z = nz;
      gob.mesh.rotation.y = Math.atan2(dx, dz);
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

  function shopUsePicks() {
    const found = [];
    architecture?.traverse((child) => {
      if (child.userData?.kind === 'trapdoor') found.push(child);
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

  function allPicks() {
    if (sceneMode === 'dungeon') return dungeonUsePicks();
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
    const list = [];
    const add = (obj) => {
      if (obj?.isMesh && obj.userData?.kind === 'ground') list.push(obj);
    };
    groundGroup?.children.forEach(add);
    architecture?.traverse((child) => add(child));
    return list;
  }

  function counterPose() {
    return state.furniture.counter;
  }

  function clampCam() {
    cam.pitch = Math.min(CAM_MAX_PITCH, Math.max(CAM_MIN_PITCH, cam.pitch));
    cam.distance = Math.min(CAM_MAX_DISTANCE, Math.max(CAM_MIN_DISTANCE, cam.distance));
  }

  function stopMining() {
    if (!mining) return;
    mining = null;
    setHeldTool(shopkeeper, 'hammer');
  }

  function startMining(materialId, pose) {
    const mat = MATERIALS[materialId];
    if (!mat) return;
    mining = {
      materialId,
      name: mat.name,
      startedAt: performance.now() / 1000,
      duration: MINE_DURATION,
      x: pose?.x ?? shopkeeper.position.x,
      z: pose?.z ?? shopkeeper.position.z,
    };
    setHeldTool(shopkeeper, 'pickaxe');
    if (pose) {
      shopkeeper.rotation.y = Math.atan2(pose.x - shopkeeper.position.x, pose.z - shopkeeper.position.z);
    }
  }

  function tickMining(now) {
    if (!mining) return;
    if (now - mining.startedAt < mining.duration) return;
    const got = grantMinedMaterial(state, mining.materialId, MINE_YIELD);
    if (got > 0) {
      pushLog(state, `Mined ${got} ${mining.name}.`);
      pickHandler?.({ type: 'mined', materialId: mining.materialId, amount: got });
    }
    mining.startedAt = now;
  }

  function applyWalkPath(path) {
    if (!path?.length) return false;
    stopMining();
    playerPath.length = 0;
    playerPath.push(...path);
    const goal = path[path.length - 1];
    moveMarker.position.set(goal.x, 0.1, goal.z);
    moveMarker.visible = true;
    return true;
  }

  function setMoveTarget(x, z) {
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const path = sceneMode === 'dungeon'
      ? planWalk(from, { x, z }, [], PLAYER_RADIUS, [DUNGEON_FLOOR])
      : planPlayerWalk(from, { x, z }, state, PLAYER_RADIUS);
    if (!path.length) {
      playerPath.length = 0;
      moveMarker.visible = false;
      return false;
    }
    return applyWalkPath(path);
  }

  function walkToward(actor, goal, dt, speed = CUSTOMER_SPEED) {
    const pos = actor.mesh.position;
    const dx = goal.x - pos.x;
    const dz = goal.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      updateWalkPose(actor.mesh, false, dt, performance.now() / 1000);
      return true;
    }
    const step = speed * dt;
    const t = Math.min(1, step / dist);
    pos.x += dx * t;
    pos.z += dz * t;
    actor.mesh.rotation.y = Math.atan2(dx, dz);
    updateWalkPose(actor.mesh, true, dt, performance.now() / 1000);
    return false;
  }

  function approachPoint(pose) {
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const near = { x: pose.x, z: pose.z + 0.85 };
    const snapped = sceneMode === 'dungeon'
      ? planWalk(from, near, [], PLAYER_RADIUS, [DUNGEON_FLOOR])
      : planPlayerWalk(from, near, state, PLAYER_RADIUS);
    if (snapped.length) return snapped[snapped.length - 1];
    return near;
  }

  function isNearPose(pose, dist = 1.15) {
    return Math.hypot(shopkeeper.position.x - pose.x, shopkeeper.position.z - pose.z) <= dist;
  }

  function queueUse(type, pose) {
    if (!pose) return;
    const from = { x: shopkeeper.position.x, z: shopkeeper.position.z };
    const arrive = type === 'trapdoor' || type === 'ladder' ? 1.35 : STATION_ARRIVE;
    const plan = sceneMode === 'dungeon' || type === 'trapdoor' || type === 'ladder'
      ? resolveStationUse(from, pose, state, (start, dest) => (
        planWalk(start, dest, [], PLAYER_RADIUS, sceneMode === 'dungeon' ? [DUNGEON_FLOOR] : playerFloors)
      ))
      : resolveStationUse(from, pose, state);
    if (plan.action === 'open' || isNearPose(pose, arrive)) {
      pendingUse = null;
      playerPath.length = 0;
      moveMarker.visible = false;
      if (type === 'boulder') {
        startMining(pose.materialId, pose);
        playClick('ui');
        return;
      }
      stopMining();
      pickHandler?.({ type });
      playClick('ui');
      return;
    }
    if (plan.action === 'walk' && applyWalkPath(plan.path)) {
      pendingUse = { type, x: pose.x, z: pose.z, arrive, openOnArrive: true, materialId: pose.materialId };
      playClick('move');
      return;
    }
    const fallback = sceneMode === 'dungeon'
      ? planWalk(from, { x: pose.x, z: pose.z }, [], PLAYER_RADIUS, [DUNGEON_FLOOR])
      : planPlayerWalk(from, { x: pose.x, z: pose.z }, state, PLAYER_RADIUS);
    if (applyWalkPath(fallback)) {
      pendingUse = { type, x: pose.x, z: pose.z, arrive, openOnArrive: true, materialId: pose.materialId };
      playClick('move');
      return;
    }
    pendingUse = { type, x: pose.x, z: pose.z, arrive, openOnArrive: false, materialId: pose.materialId };
    playClick('ui');
  }

  function finishPendingUse() {
    if (!pendingUse) return;
    const { type, materialId, x, z } = pendingUse;
    pendingUse = null;
    if (type === 'boulder') startMining(materialId, { x, z, materialId });
    else pickHandler?.({ type });
  }

  function updatePlayer(dt, now) {
    if (playerPath.length) {
      if (walkToward({ mesh: shopkeeper }, playerPath[0], dt, PLAYER_SPEED)) {
        playerPath.shift();
        if (!playerPath.length) {
          moveMarker.visible = false;
          if (pendingUse && (pendingUse.openOnArrive || isNearPose(pendingUse, pendingUse.arrive ?? STATION_ARRIVE))) {
            finishPendingUse();
          }
        }
      }
      return;
    }
    if (mining) {
      shopkeeper.rotation.y = Math.atan2(mining.x - shopkeeper.position.x, mining.z - shopkeeper.position.z);
      updateMinePose(shopkeeper, dt, now);
      tickMining(now);
      return;
    }
    updateWalkPose(shopkeeper, false, dt, now);
    if (pendingUse && isNearPose(pendingUse, pendingUse.arrive ?? 1.35)) {
      finishPendingUse();
      return;
    }
    const front = customers.find((actor) => actor.state === 'request');
    if (front && sceneMode === 'shop') {
      const dx = front.mesh.position.x - shopkeeper.position.x;
      const dz = front.mesh.position.z - shopkeeper.position.z;
      if (Math.hypot(dx, dz) > 0.05) shopkeeper.rotation.y = Math.atan2(dx, dz);
    }
  }

  function updateFollowCamera(dt) {
    if (camHeld.left) cam.yaw += CAM_YAW_SPEED * dt;
    if (camHeld.right) cam.yaw -= CAM_YAW_SPEED * dt;
    if (camHeld.up) cam.pitch += CAM_PITCH_SPEED * dt;
    if (camHeld.down) cam.pitch -= CAM_PITCH_SPEED * dt;
    clampCam();
    const look = new THREE.Vector3(shopkeeper.position.x, 0.95, shopkeeper.position.z);
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
    if (sceneMode === 'dungeon') {
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

  renderer.domElement.addEventListener('pointerdown', (event) => {
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

  function blockedPlaceReason(pose, target = moveTarget) {
    if (!pose || !target) return 'That spot is off the shop floor.';
    const kind = placeKindOf(target);
    const skip = target.id === 'display' ? { id: 'display', index: target.index } : { id: target.id };
    const blocks = liveObstacles(state, SHOP, skip);
    return placementBlocked(pose, kind, blocks, floors, { checkAisle: kind !== 'counter' });
  }

  function visualPlacePose() {
    if (!moveTarget) return null;
    if (moveTarget.id === 'display') {
      const slot = displays[moveTarget.index];
      if (!slot) return null;
      return { x: slot.anchor.position.x, z: slot.anchor.position.z, rot: slot.anchor.rotation.y };
    }
    const slot = fixtureMeshes[moveTarget.id];
    if (!slot) return poseOf(moveTarget);
    return { x: slot.mesh.position.x, z: slot.mesh.position.z, rot: slot.mesh.rotation.y };
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
    clearMoveMode();
    return true;
  }

  function rotateFurniturePose(target) {
    const pose = poseOf(target);
    if (!pose) return false;
    pose.rot = (pose.rot ?? FURNITURE_FORWARD) + FURNITURE_ROT_STEP;
    if (target.id === 'display') applyDisplayPose(target.index);
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

  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    if (performance.now() < ignorePicksUntil) return;
    if (modalBlocksWorld() && !moveTarget && !expandMode) return;
    const held = performance.now() - pointerDown.t;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    if (moveTarget) {
      const point = floorPointFromEvent(event);
      if (point) {
        placeMovingFurniture(point.x, point.z);
        playClick('ui');
        const nowClick = performance.now();
        if (placeNeedsConfirm && nowClick - lastPlaceClickAt < 420) {
          lastPlaceClickAt = 0;
          pickHandler?.({ type: 'furniture-place-confirm' });
          return;
        }
        lastPlaceClickAt = nowClick;
        pickHandler?.({ type: placeNeedsConfirm ? 'furniture-place-preview' : 'furniture-moved' });
      }
      return;
    }
    if (moved > 8) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...allPicks(), ...groundMeshes()], false);
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
    if (picked) {
      const data = picked.object.userData;
      if (data.kind === 'trapdoor') {
        const hatch = gardenTrapdoorSpot(state.expansions ?? []);
        queueUse('trapdoor', hatch ?? { x: shopkeeper.position.x, z: shopkeeper.position.z });
        return;
      }
      if (data.kind === 'ladder') {
        queueUse('ladder', { x: -4.2, z: 0.4 });
        return;
      }
      if (data.kind === 'boulder') {
        queueUse('boulder', { x: data.x, z: data.z, materialId: data.materialId });
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
    const groundHit = hits.find((h) => h.object.userData.kind === 'ground');
    if (groundHit) {
      const point = groundHit.point;
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
      if (sceneMode === 'dungeon') {
        const spot = DUNGEON_BOULDERS.find((item) => (
          Math.hypot(point.x - item.x, point.z - item.z) <= (STATION_HIT.boulder.floorR ?? 1.15)
        ));
        if (spot) {
          queueUse('boulder', { x: spot.x, z: spot.z, materialId: spot.materialId });
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
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!moveTarget) return;
    const point = floorPointFromEvent(event);
    if (point) previewFurnitureAt(point.x, point.z);
  });

  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (modalBlocksWorld() && !moveTarget) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...allPicks(), ...groundMeshes()], false);
    if (moveTarget) {
      cancelPlaceOrMove();
      pickHandler?.({ type: 'furniture-cancel' });
      return;
    }
    const picked = hitFurniture(hits);
    if (!picked) return;
    const data = picked.object.userData;
    const furn = furnitureIdFromKind(data.kind, data.displayIndex);
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
  });

  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
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
    const mesh = makeWareMesh(recipeId);
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
      if (have !== (want[name] ?? null)) dirty = true;
    }
    if (!dirty && !(slot.wareMesh && !hasSet)) return;
    clearSlotMeshes(slot);
    for (const name of ARMOUR_SLOTS) {
      const recipeId = want[name];
      if (!recipeId) continue;
      const mesh = makeWareMesh(recipeId);
      const pose = slotPose(name);
      mesh.position.set(pose.x, pose.y, pose.z);
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
    const first = BROWSE_SPOTS[Math.floor(Math.random() * BROWSE_SPOTS.length)];
    const rest = BROWSE_SPOTS.filter((spot) => spot !== first);
    const second = rest[Math.floor(Math.random() * rest.length)];
    const count = Math.random() < 0.45 ? 1 : 2;
    return count === 1 ? [first] : [first, second];
  }

  function spawnCustomer(now) {
    if (sceneMode !== 'shop') return;
    const inShop = customers.filter((actor) => actor.state !== 'leave').length;
    if (inShop >= MAX_CUSTOMERS) return;
    if (!state.kingRoaldAt) state.kingRoaldAt = scheduleKingRoald(state.playTime ?? 0);
    const kingHere = customers.some((actor) => actor.typeId === 'kingroald' && actor.state !== 'leave');
    const wantKing = !kingHere && (state.playTime ?? 0) >= (state.kingRoaldAt ?? Infinity);
    const recipeId = wantKing ? mostExpensiveChestId(state) : null;
    if (wantKing && recipeId) {
      spawnActor('kingroald', now, {
        recipeId,
        gold: RECIPES[recipeId].price,
        offer: null,
        royal: true,
      });
      return;
    }
    if (wantKing && !recipeId) {
      state.kingRoaldAt = (state.playTime ?? 0) + 90;
    }
    const types = Object.keys(CUSTOMERS).filter((id) => id !== 'kingroald');
    const typeId = firstSpawn ? 'pilgrim' : types[Math.floor(Math.random() * types.length)];
    firstSpawn = false;
    const request = decideRequest(typeId, Math.random, state);
    if (!request) return;
    spawnActor(typeId, now, request);
  }

  function makeCustomerMesh(typeId, seed) {
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
    return buildAdventurer(typeId, { seed });
  }

  function spawnActor(typeId, now, request) {
    const mesh = makeCustomerMesh(typeId, customerSerial + Math.random());
    mesh.userData.pick.userData.customerId = customerSerial;
    mesh.position.set(SHOP.outside.x, 0, SHOP.outside.z + 0.15);
    setSpeechText(mesh, `${RECIPES[request.recipeId].name}?`);
    scene.add(mesh);
    const actor = {
      id: customerSerial,
      typeId,
      mesh,
      state: 'enter',
      path: [
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
    customers.push(actor);
    nextSpawnAt = now + SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
    if (typeId === 'kingroald') {
      pushLog(state, `King Roald arrives, seeking ${RECIPES[request.recipeId].name}.`);
    } else {
      pushLog(state, `${CUSTOMERS[typeId].name} looks around for ${RECIPES[request.recipeId].name}.`);
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
      actor.waitUntil = now + 1.1 + Math.random() * 1.6;
      actor.mesh.rotation.y = Math.random() * Math.PI * 2;
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
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
    if (actor.typeId === 'kingroald') {
      state.kingRoaldAt = scheduleKingRoald(state.playTime ?? 0);
    }
    actor.state = 'leave';
    actor.path = [
      { x: SHOP.door.x, z: SHOP.door.z - 0.4 },
      { x: SHOP.door.x, z: SHOP.door.z + 0.45 },
      { x: SHOP.outside.x, z: SHOP.outside.z },
    ];
    advanceQueue(lastNow || performance.now() / 1000);
  }

  function updateCustomers(dt, now) {
    if (now >= nextSpawnAt) spawnCustomer(now);
    for (let i = customers.length - 1; i >= 0; i -= 1) {
      const actor = customers[i];
      if (actor.state === 'enter') {
        if (!actor.path.length) {
          settleInLine(actor, now);
        } else if (walkToward(actor, actor.path[0], dt)) {
          actor.path.shift();
          if (!actor.path.length) settleInLine(actor, now);
        }
      } else if (actor.state === 'browse') {
        actor.mesh.rotation.y += dt * 0.35;
        actor.mesh.position.y = Math.abs(Math.sin(now * 1.4 + actor.id)) * 0.012;
        if (now >= actor.waitUntil) joinQueue(actor, now);
      } else if (actor.state === 'queue') {
        actor.mesh.rotation.y = Math.PI + Math.sin(now * 1.1 + actor.id) * 0.06;
        actor.mesh.position.y = Math.abs(Math.sin(now * 1.6 + actor.id)) * 0.012;
      } else if (actor.state === 'request') {
        actor.mesh.rotation.y = Math.PI + Math.sin(now * 1.4 + actor.id) * 0.12;
        const have = hasStock(state, actor.requestRecipeId);
        actor.mesh.userData.ring.material.opacity = actor.id === tradingId ? 0.95 : have ? 0.8 : 0.4;
        actor.mesh.userData.ring.material.color.setHex(
          actor.id === tradingId ? 0xf0d27a : have ? 0x8ecf4a : 0xe8b45a,
        );
        if (now >= actor.waitUntil) {
          pushLog(state, `${CUSTOMERS[actor.typeId].name} grows tired and leaves.`);
          dismissCustomer(actor, false);
        }
      } else if (actor.state === 'leave') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
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
    }
  }

  function tick(dt, now) {
    lastNow = now;
    state.playTime = (state.playTime ?? 0) + dt;
    updatePlayer(dt, now);
    updateFollowCamera(dt);
    dust.rotation.y += dt * 0.03;
    const positions = dust.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) + dt * 0.07;
      if (y > 2.5) y = 0.2;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    setChestLid(chest, chestOpen, dt);
    counterGlow.material.opacity = moveTarget?.id === 'counter' ? 0.7 : 0.0;
    setDoorOpen(shopDoor, true, dt);
    for (const puff of clouds.children) {
      puff.position.x += (puff.userData.drift ?? 0.15) * dt;
      if (puff.position.x > 28) puff.position.x = -28;
    }
    syncDisplays();
    refreshSelection();
    const selected = displays[state.selectedDisplay];
    if (selected?.outline) {
      outlineHaloMat.opacity = 0.48 + Math.sin(now * 3.1) * 0.16;
      outlineEdgeMat.opacity = 0.82 + Math.sin(now * 3.1) * 0.16;
      outlineBoxMat.opacity = 0.72 + Math.sin(now * 2.4) * 0.18;
    }
    if (sceneMode === 'shop') {
      updateCustomers(dt, now);
      updateGoblins(dt, now);
    } else if (dungeon?.rats) {
      dungeon.rats.forEach((rat) => stepRatWander(rat, dt, now));
    }
    const wheel = fixtureMeshes.wheel?.mesh?.userData.spinWheel;
    if (wheel) {
      const spinning = Object.keys(state.crafts ?? {}).some((id) => RECIPES[id]?.category === 'spin');
      if (spinning) wheel.rotation.z += dt * 9.5;
    }
    renderer.render(scene, camera);
  }

  function replaceShopkeeperMesh(next) {
    next.position.copy(shopkeeper.position);
    next.rotation.copy(shopkeeper.rotation);
    next.scale.copy(shopkeeper.scale);
    scene.add(next);
    scene.remove(shopkeeper);
    shopkeeper = next;
  }

  function rebuildCustomerMeshes() {
    for (const actor of customers) {
      const pos = actor.mesh.position.clone();
      const rotY = actor.mesh.rotation.y;
      const ringOn = Boolean(actor.mesh.userData.ring?.visible);
      const carried = actor.carried;
      if (carried && actor.mesh.userData.hand) actor.mesh.userData.hand.remove(carried);
      scene.remove(actor.mesh);
      actor.mesh = makeCustomerMesh(actor.typeId, actor.id);
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
      actor.mesh.visible = sceneMode === 'shop';
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
      actor.mesh.visible = on;
    });
    goblins.forEach((gob) => {
      gob.mesh.visible = on;
    });
  }

  function ensureDungeon() {
    if (dungeon) return dungeon;
    dungeon = buildDungeon();
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
    stopMining();
    moveMarker.visible = false;
    setShopLayerVisible(false);
    dungeon.root.visible = true;
    dungeon.grounds.visible = true;
    applySkyColor(scene, skyIdForScene('dungeon', state.skybox));
    shopkeeper.position.set(-4.15, 0, 0.4);
    shopkeeper.rotation.y = Math.PI / 2;
  }

  function exitDungeonNow() {
    if (sceneMode !== 'dungeon') return;
    sceneMode = 'shop';
    playerPath.length = 0;
    pendingUse = null;
    stopMining();
    if (dungeon) {
      dungeon.root.visible = false;
      dungeon.grounds.visible = false;
    }
    setShopLayerVisible(true);
    applySkyColor(scene, skyIdForScene('shop', state.skybox));
    shopkeeper.position.set(shopReturnPos.x, 0, shopReturnPos.z);
    shopkeeper.rotation.y = Math.PI;
  }

  return {
    tick,
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
      syncDisplaySlots();
      applyAllPoses();
      rebuildArchitecture();
      applyAllPoses();
      spawnGoblins();
      if (!customPlayerSource) {
        const next = buildShopkeeper({
          chefHat: Boolean(state.chefHat),
          appearance: state.appearance,
        });
        next.scale.setScalar(1.16);
        replaceShopkeeperMesh(next);
      } else {
        setChefHatVisible(shopkeeper, Boolean(state.chefHat));
      }
      applySkyColor(scene, state.skybox ?? DEFAULT_SKYBOX);
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
    getCustomer(id) {
      return customers.find((c) => c.id === id) ?? null;
    },
    listCustomers() {
      return waitingLine();
    },
    getFrontCustomer() {
      return customers.find((actor) => actor.state === 'request') ?? null;
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
      const home = SHOP[id] ?? SHOP.cauldron;
      const start = snapToFloor(home.x, home.z, floors);
      placeDraft = { id, x: start.x, z: start.z, rot: FURNITURE_FORWARD };
      moveTarget = { id };
      placeNeedsConfirm = true;
      expandMode = false;
      if (padGroup) padGroup.visible = false;
      moveOrigin = null;
      applyFixturePose(id);
      setSnapGridVisible(true);
      highlightSnapCell(start.x, start.z);
      pickHandler?.({ type: 'furniture-place-start', furniture: { id } });
    },
    beginPlaceFurniture(kind) {
      const start = snapToFloor(SHOP.cauldron.x, SHOP.cauldron.z, floors);
      const index = displays.length;
      const spot = {
        id: `new-${kind}-${index}`,
        name: kind === 'stand' ? 'Mannequin' : 'Table',
        x: start.x,
        z: start.z,
        kind,
      };
      displays.push(makeDisplaySlot(spot, index, start));
      placeDraft = { id: 'display', index, x: start.x, z: start.z, rot: FURNITURE_FORWARD };
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
      if (!check.ok) {
        pickHandler?.({ type: 'furniture-place-blocked', reason: check.reason });
        return null;
      }
      const pose = { x: check.pose.x, z: check.pose.z, rot: check.pose.rot };
      const target = { id: moveTarget.id, index: moveTarget.index };
      rebuildNav();
      clearMoveMode();
      if (target.id === 'display') applyDisplayPose(target.index);
      else applyFixturePose(target.id);
      return pose;
    },
    tryConfirmPlace,
    getPlacePose() {
      return moveTarget && placeNeedsConfirm ? visualPlacePose() : null;
    },
    isPlacingUnlock() {
      return Boolean(placeNeedsConfirm);
    },
    rotateFurniture(target) {
      return rotateFurniturePose(target);
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
    setChefHat(on) {
      state.chefHat = Boolean(on);
      setChefHatVisible(shopkeeper, state.chefHat);
    },
    setAppearance(look) {
      state.appearance = look;
      if (customPlayerSource) return false;
      const next = buildShopkeeper({
        chefHat: Boolean(state.chefHat),
        appearance: state.appearance,
      });
      next.scale.setScalar(1.16);
      replaceShopkeeperMesh(next);
      return true;
    },
    hasCustomPlayer() {
      return Boolean(customPlayerSource);
    },
    setPlayerLook(model) {
      try {
        if (!model) {
          customPlayerSource = null;
          const next = buildShopkeeper({
            chefHat: Boolean(state.chefHat),
            appearance: state.appearance,
          });
          next.scale.setScalar(1.16);
          replaceShopkeeperMesh(next);
          return { ok: true };
        }
        const wrapped = wrapImportedCharacter(model, {
          name: 'shopkeeper',
          label: 'You',
          height: 1.72,
          chefHat: true,
          chefHatOn: Boolean(state.chefHat),
        });
        wrapped.scale.setScalar(1.16);
        customPlayerSource = model;
        replaceShopkeeperMesh(wrapped);
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message || 'Could not use that as a player model.' };
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
    isInDungeon() {
      return sceneMode === 'dungeon';
    },
    getMining(now = performance.now() / 1000) {
      if (!mining) return null;
      const t = Math.min(1, Math.max(0, (now - mining.startedAt) / mining.duration));
      return {
        materialId: mining.materialId,
        name: mining.name,
        t,
        yield: MINE_YIELD,
      };
    },
  };
}
