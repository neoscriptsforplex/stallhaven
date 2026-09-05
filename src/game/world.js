import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CUSTOMERS,
  FIRST_CUSTOMER_DELAY,
  MAX_CUSTOMERS,
  RECIPES,
  REQUEST_WAIT,
  SHOP,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  decideRequest,
} from './catalog.js';
import { hasStock, pushLog } from './economy.js';
import {
  buildAdventurer,
  buildChest,
  buildDefaultTable,
  buildDust,
  buildStall,
  buildWare,
  normalizeImported,
  setChestLid,
  setSpeechText,
  wareTopY,
} from './models.js';

const CUSTOMER_SPEED = 1.35;

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

  const chest = buildChest();
  chest.position.set(SHOP.chest.x, 0, SHOP.chest.z);
  chest.rotation.y = -0.45;
  scene.add(chest);
  const chestPick = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.85, 0.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  chestPick.position.set(SHOP.chest.x, 0.4, SHOP.chest.z);
  chestPick.userData.kind = 'chest';
  scene.add(chestPick);
  const chestGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.74, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  chestGlow.rotation.x = -Math.PI / 2;
  chestGlow.position.set(SHOP.chest.x, 0.08, SHOP.chest.z);
  scene.add(chestGlow);
  let chestOpen = false;

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
    pick.userData.kind = 'display';
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
  let pickHandler = null;
  let ignorePicksUntil = 0;
  let tradingId = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerDown = { x: 0, y: 0, t: 0 };

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  function allPicks() {
    return [
      ...displays.map((d) => d.pick),
      chestPick,
      ...customers.map((c) => c.mesh.userData.pick).filter(Boolean),
    ];
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

  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    if (performance.now() < ignorePicksUntil) return;
    if (modalBlocksWorld()) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    if (moved > 8) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(allPicks(), false);
    if (!hits.length) return;
    const customerHit = hits.find((h) => h.object.userData.kind === 'customer');
    if (customerHit) {
      const actor = customers.find((c) => c.mesh.userData.pick === customerHit.object);
      if (actor && actor.state === 'request') pickHandler?.({ type: 'customer', actor });
      return;
    }
    const data = hits[0].object.userData;
    if (data.kind === 'chest') {
      pickHandler?.({ type: 'chest' });
      return;
    }
    if (data.kind === 'display') {
      state.selectedDisplay = data.displayIndex;
      refreshSelection();
      pickHandler?.({ type: 'display', index: data.displayIndex });
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
      const haveId = displays[i].wareMesh?.userData.recipeId ?? null;
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

  function takeWareMesh(recipeId) {
    const index = state.displays.findIndex((d) => d.ware?.recipeId === recipeId);
    if (index < 0) {
      const mesh = state.wareLooks[recipeId]
        ? state.wareLooks[recipeId].clone(true)
        : buildWare(recipeId);
      mesh.scale.setScalar(0.7);
      return mesh;
    }
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
    const request = decideRequest(typeId);
    const mesh = buildAdventurer(typeId);
    mesh.userData.pick.userData.customerId = customerSerial;
    mesh.position.set(SHOP.door.x, 0, SHOP.door.z + 0.4);
    setSpeechText(mesh, `${RECIPES[request.recipeId].name}?`);
    scene.add(mesh);
    const usedRight = customers.some((c) => c.browse?.x > 0);
    const browse = usedRight
      ? { x: -1.25, z: 2.35 }
      : { x: 1.25, z: 2.35 };
    const actor = {
      id: customerSerial,
      typeId,
      mesh,
      state: 'enter',
      path: [browse],
      waitUntil: 0,
      requestRecipeId: request.recipeId,
      offerGold: request.gold,
      offer: request.offer,
      carried: null,
      browse,
    };
    customerSerial += 1;
    customers.push(actor);
    nextSpawnAt = now + SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
    pushLog(state, `${CUSTOMERS[typeId].name} asks for ${RECIPES[request.recipeId].name}.`);
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

  function beginRequest(actor, now) {
    actor.state = 'request';
    actor.waitUntil = now + REQUEST_WAIT;
    actor.path = [];
    actor.mesh.rotation.y = Math.PI;
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = true;
  }

  function dismissCustomer(actor, sold) {
    if (!actor || actor.state === 'leave') return;
    if (sold && actor.pendingCarry) {
      actor.mesh.userData.hand.add(actor.pendingCarry);
      actor.pendingCarry.position.set(0, 0, 0);
      actor.pendingCarry.scale.setScalar(0.7);
      actor.carried = actor.pendingCarry;
      actor.pendingCarry = null;
    }
    setSpeechText(actor.mesh, sold ? 'Thanks!' : null);
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
    actor.state = 'leave';
    actor.path = [{ x: SHOP.door.x, z: SHOP.door.z + 0.6 }];
  }

  function updateCustomers(dt, now) {
    if (now >= nextSpawnAt) spawnCustomer(now);
    for (let i = customers.length - 1; i >= 0; i -= 1) {
      const actor = customers[i];
      if (actor.state === 'enter') {
        if (!actor.path.length || walkToward(actor, actor.path[0], dt)) {
          beginRequest(actor, now);
        }
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
    setChestLid(chest, chestOpen, dt);
    chestGlow.material.opacity = 0.28 + Math.sin(now * 2.2) * 0.08;
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
      return customers.filter((c) => c.state !== 'leave');
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
  };
}
