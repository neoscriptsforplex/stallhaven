import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CUSTOMERS,
  FIRST_CUSTOMER_DELAY,
  MAX_CUSTOMERS,
  PATIENT_RECHECKS,
  PATIENT_WAIT,
  SHOP,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  RECIPES,
} from './catalog.js';
import { collectSale, decideAfterWait, decidePurchase, displayedWares, pushLog, removeWare } from './economy.js';
import {
  buildAdventurer,
  buildDefaultTable,
  buildDust,
  buildStall,
  buildWare,
  normalizeImported,
  wareTopY,
} from './models.js';

const CUSTOMER_SPEED = 1.35;

export function createWorld(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9b48a);
  scene.fog = new THREE.Fog(0xc9b48a, 12, 26);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 80);
  camera.position.set(SHOP.cameraStart.x, SHOP.cameraStart.y, SHOP.cameraStart.z);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(SHOP.cameraTarget.x, SHOP.cameraTarget.y, SHOP.cameraTarget.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.4;
  controls.maxDistance = 7.5;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.18;
  controls.enablePan = false;
  controls.update();

  const hemi = new THREE.HemisphereLight(0xf0e2c4, 0x6a5340, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe1b0, 1.15);
  sun.position.set(-4.5, 8.5, 6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);

  const lantern = new THREE.PointLight(0xffb15a, 3.2, 7, 2);
  lantern.position.set(-1.35, 2.05, -2.9);
  lantern.castShadow = false;
  scene.add(lantern);
  const lantern2 = lantern.clone();
  lantern2.position.x = 1.35;
  scene.add(lantern2);

  scene.add(buildStall());
  const dust = buildDust();
  scene.add(dust);

  const displays = SHOP.displays.map((spot, index) => {
    const anchor = new THREE.Group();
    anchor.position.set(spot.x, 0, spot.z);
    scene.add(anchor);
    const furniture = buildDefaultTable();
    anchor.add(furniture);
    const wareAnchor = new THREE.Group();
    wareAnchor.position.y = furniture.userData.wareY;
    anchor.add(wareAnchor);
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.15, 1.05),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.position.y = 0.6;
    pick.userData.displayIndex = index;
    anchor.add(pick);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.9, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.1;
    anchor.add(glow);
    return { spot, anchor, furniture, wareAnchor, pick, glow, wareMesh: null };
  });

  const customers = [];
  let nextSpawnAt = FIRST_CUSTOMER_DELAY;
  let firstSpawn = true;
  let customerSerial = 1;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickables = displays.map((d) => d.pick);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    if (hits.length) {
      state.selectedDisplay = hits[0].object.userData.displayIndex;
      refreshSelection();
    }
  });

  function refreshSelection() {
    displays.forEach((d, i) => {
      d.glow.material.opacity = i === state.selectedDisplay ? 0.85 : 0.0;
    });
  }
  refreshSelection();

  function setDisplayWare(index, recipeId) {
    const slot = displays[index];
    if (slot.wareMesh) {
      slot.wareAnchor.remove(slot.wareMesh);
      slot.wareMesh = null;
    }
    if (!recipeId) return;
    const mesh = state.wareLooks[recipeId]
      ? state.wareLooks[recipeId].clone(true)
      : buildWare(recipeId);
    mesh.position.set(0, 0, 0);
    slot.wareAnchor.add(mesh);
    slot.wareMesh = mesh;
  }

  function syncDisplays() {
    state.displays.forEach((d, i) => {
      const want = d.ware?.recipeId ?? null;
      const have = displays[i].wareMesh?.userData.recipeId ?? displays[i].wareMesh?.name ?? null;
      const haveId = displays[i].wareMesh ? (displays[i].wareMesh.userData.recipeId || want) : null;
      if (want !== haveId) setDisplayWare(i, want);
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

  function takeWare(index) {
    const slot = displays[index];
    const mesh = slot.wareMesh;
    slot.wareMesh = null;
    if (mesh) slot.wareAnchor.remove(mesh);
    return mesh;
  }

  function spawnCustomer(now) {
    if (customers.length >= MAX_CUSTOMERS) return;
    const types = Object.keys(CUSTOMERS);
    const typeId = firstSpawn ? 'pilgrim' : types[Math.floor(Math.random() * types.length)];
    firstSpawn = false;
    const mesh = buildAdventurer(typeId);
    mesh.position.set(SHOP.door.x, 0, SHOP.door.z + 0.4);
    scene.add(mesh);
    const actor = {
      id: customerSerial,
      typeId,
      mesh,
      state: 'enter',
      path: [{ x: SHOP.browse.x, z: SHOP.browse.z }],
      waitUntil: 0,
      rechecks: 0,
      targetDisplay: -1,
      carried: null,
    };
    customerSerial += 1;
    customers.push(actor);
    nextSpawnAt = now + SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
    pushLog(state, `${CUSTOMERS[typeId].name} comes in from the road.`);
  }

  function walkToward(actor, goal, dt) {
    const pos = actor.mesh.position;
    const dx = goal.x - pos.x;
    const dz = goal.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) return true;
    const step = CUSTOMER_SPEED * dt;
    const t = Math.min(1, step / dist);
    pos.x += dx * t;
    pos.z += dz * t;
    actor.mesh.rotation.y = Math.atan2(dx, dz);
    actor.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.01)) * 0.03;
    return false;
  }

  function think(actor, now) {
    const wares = displayedWares(state);
    const choice = actor.rechecks === 0
      ? decidePurchase(actor.typeId, wares)
      : decideAfterWait(actor.typeId, wares);
    if (choice.action === 'buy') {
      actor.targetDisplay = choice.displayIndex;
      const spot = SHOP.displays[choice.displayIndex];
      actor.path = [{ x: spot.x, z: spot.z + 0.7 }];
      actor.state = 'toWare';
      return;
    }
    if (choice.action === 'wait' && actor.rechecks < PATIENT_RECHECKS) {
      actor.rechecks += 1;
      actor.waitUntil = now + PATIENT_WAIT / PATIENT_RECHECKS;
      actor.state = 'wait';
      actor.path = [{ x: SHOP.browse.x, z: SHOP.browse.z }];
      return;
    }
    actor.state = 'leave';
    actor.path = [{ x: SHOP.door.x, z: SHOP.door.z + 0.5 }];
    pushLog(state, `${CUSTOMERS[actor.typeId].name} leaves without a purchase.`);
  }

  function updateCustomers(dt, now) {
    if (now >= nextSpawnAt) spawnCustomer(now);
    for (let i = customers.length - 1; i >= 0; i -= 1) {
      const actor = customers[i];
      if (actor.state === 'enter') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          actor.path.shift();
          think(actor, now);
        }
      } else if (actor.state === 'wait') {
        if (actor.path.length && !walkToward(actor, actor.path[0], dt)) {
          // still walking to the browse spot
        } else {
          actor.path = [];
          actor.mesh.rotation.y += dt * 0.6;
          if (now >= actor.waitUntil) think(actor, now);
        }
      } else if (actor.state === 'toWare') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          const ware = state.displays[actor.targetDisplay]?.ware;
          if (!ware) {
            think(actor, now);
          } else {
            actor.carried = takeWare(actor.targetDisplay);
            const recipeId = removeWare(state, actor.targetDisplay);
            if (actor.carried) {
              actor.mesh.userData.hand.add(actor.carried);
              actor.carried.position.set(0, 0, 0);
              actor.carried.scale.setScalar(0.7);
            }
            actor.pendingRecipeId = recipeId;
            actor.pendingGold = RECIPES[recipeId].price;
            actor.pendingName = RECIPES[recipeId].name;
            actor.path = [{ x: SHOP.counter.x, z: SHOP.counter.z + 0.85 }];
            actor.state = 'toCounter';
            syncDisplays();
          }
        }
      } else if (actor.state === 'toCounter') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          collectSale(state, actor.pendingRecipeId);
          pushLog(state, `${CUSTOMERS[actor.typeId].name} buys ${actor.pendingName} for ${actor.pendingGold}g.`);
          if (actor.carried) {
            actor.mesh.userData.hand.remove(actor.carried);
            actor.carried = null;
          }
          actor.state = 'leave';
          actor.path = [{ x: SHOP.door.x, z: SHOP.door.z + 0.6 }];
        }
      } else if (actor.state === 'leave') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          scene.remove(actor.mesh);
          customers.splice(i, 1);
        }
      }
    }
  }

  function tick(dt, now) {
    controls.update();
    dust.rotation.y += dt * 0.03;
    const positions = dust.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) + dt * 0.07;
      if (y > 2.5) y = 0.2;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    syncDisplays();
    refreshSelection();
    updateCustomers(dt, now);
    renderer.render(scene, camera);
  }

  return {
    tick,
    syncDisplays,
    refreshSelection,
    replaceFurniture,
    bindWareLook,
    getSelectedName: () => SHOP.displays[state.selectedDisplay].name,
  };
}
