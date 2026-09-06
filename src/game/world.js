import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ARMOUR_SLOTS,
  CUSTOMERS,
  FIRST_CUSTOMER_DELAY,
  MAX_CUSTOMERS,
  RECIPES,
  REQUEST_WAIT,
  SHOP,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  decideRequest,
  displayKind,
  emptySlots,
} from './catalog.js';
import { hasStock, pushLog } from './economy.js';
import {
  buildAdventurer,
  buildAnvil,
  buildChest,
  buildDust,
  buildFurniture,
  buildShopDoor,
  buildShopkeeper,
  buildStall,
  buildWare,
  normalizeImported,
  setChestLid,
  setDoorOpen,
  setSpeechText,
  slotPose,
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
  controls.minDistance = 2.2;
  controls.maxDistance = 9.5;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = 0.22;
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
  const doorLight = new THREE.PointLight(0xffe1b0, 2.4, 6, 2);
  doorLight.position.set(0, 2.15, 3.9);
  scene.add(doorLight);

  scene.add(buildStall());
  const shopDoor = buildShopDoor();
  scene.add(shopDoor);
  const dust = buildDust();
  scene.add(dust);

  const shopkeeper = buildShopkeeper();
  shopkeeper.position.set(SHOP.keeper.x, 0, SHOP.keeper.z);
  shopkeeper.rotation.y = 0;
  shopkeeper.scale.setScalar(1.12);
  scene.add(shopkeeper);

  const anvil = buildAnvil();
  anvil.position.set(SHOP.anvil.x, 0, SHOP.anvil.z);
  anvil.rotation.y = 0.35;
  scene.add(anvil);
  const anvilPick = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 1.35, 1.1),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  anvilPick.position.set(SHOP.anvil.x, 0.62, SHOP.anvil.z);
  anvilPick.userData.kind = 'anvil';
  scene.add(anvilPick);
  const anvilGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.68, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
  );
  anvilGlow.rotation.x = -Math.PI / 2;
  anvilGlow.position.set(SHOP.anvil.x, 0.08, SHOP.anvil.z);
  scene.add(anvilGlow);

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
    if (spot.kind === 'shelf') anchor.rotation.y = 0;
    scene.add(anchor);
    const furniture = buildFurniture(spot.kind);
    anchor.add(furniture);
    const wareAnchor = new THREE.Group();
    wareAnchor.position.y = furniture.userData.stand ? 0 : furniture.userData.wareY;
    anchor.add(wareAnchor);
    const pickSize = spot.kind === 'stand'
      ? [1.15, 2.05, 1.05]
      : spot.kind === 'shelf'
        ? [1.55, 1.2, 0.7]
        : [1.45, 1.15, 1.0];
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(...pickSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.position.y = spot.kind === 'shelf' ? 1.15 : spot.kind === 'stand' ? 0.95 : 0.6;
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
    };
  });

  const outlineEdgeMat = new THREE.LineBasicMaterial({
    color: 0xf0d27a,
    transparent: true,
    opacity: 0.95,
  });
  const outlineBoxMat = new THREE.LineBasicMaterial({
    color: 0xe3b34a,
    transparent: true,
    opacity: 0.82,
  });
  const outlineHaloMat = new THREE.MeshBasicMaterial({
    color: 0xe3b34a,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
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
      anvilPick,
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
    if (data.kind === 'anvil') {
      pickHandler?.({ type: 'anvil' });
      return;
    }
    if (data.kind === 'display') {
      state.selectedDisplay = data.displayIndex;
      refreshSelection();
      pickHandler?.({ type: 'display', index: data.displayIndex });
    }
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
    halo.scale.multiplyScalar(1.06);
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
    const selected = displays[state.selectedDisplay];
    const wareIds = selected
      ? [
        selected.furniture?.uuid ?? '',
        selected.wareMesh?.userData.recipeId ?? '',
        ...ARMOUR_SLOTS.map((name) => selected.slotMeshes[name]?.userData.recipeId ?? ''),
      ].join(':')
      : '';
    const key = `${state.selectedDisplay}:${wareIds}`;
    displays.forEach((d, i) => {
      d.glow.material.opacity = i === state.selectedDisplay ? 0.88 : 0.0;
    });
    if (!force && key === outlineKey) return;
    outlineKey = key;
    displays.forEach((d, i) => applyOutline(d, i === state.selectedDisplay));
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
    state.displays.forEach((d, i) => {
      if (displayKind(i) === 'stand') {
        setStandWares(i, d.slots ?? emptySlots(), d.ware?.recipeId ?? null);
        return;
      }
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
      d.ware?.recipeId === recipeId || ARMOUR_SLOTS.some((name) => d.slots?.[name] === recipeId)
    ));
    if (index < 0) {
      const mesh = makeWareMesh(recipeId);
      mesh.scale.setScalar(0.7);
      return mesh;
    }
    const slot = displays[index];
    const recipe = RECIPES[recipeId];
    if (displayKind(index) === 'stand' && recipe?.slot && slot.slotMeshes[recipe.slot]) {
      const mesh = slot.slotMeshes[recipe.slot];
      slot.slotMeshes[recipe.slot] = null;
      if (mesh) slot.wareAnchor.remove(mesh);
      return mesh;
    }
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
    mesh.position.set(SHOP.outside.x, 0, SHOP.outside.z + 0.15);
    setSpeechText(mesh, `${RECIPES[request.recipeId].name}?`);
    scene.add(mesh);
    const usedRight = customers.some((c) => c.browse?.x > 0);
    const browse = usedRight
      ? { x: -1.15, z: 2.28 }
      : { x: 1.15, z: 2.28 };
    const actor = {
      id: customerSerial,
      typeId,
      mesh,
      state: 'enter',
      path: [
        { x: SHOP.door.x, z: SHOP.door.z + 0.35 },
        { x: SHOP.door.x, z: SHOP.door.z - 0.45 },
        browse,
      ],
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

  function dismissCustomer(actor, sold, farewell = null) {
    if (!actor || actor.state === 'leave') return;
    if (sold && actor.pendingCarry) {
      actor.mesh.userData.hand.add(actor.pendingCarry);
      actor.pendingCarry.position.set(0, 0, 0);
      actor.pendingCarry.scale.setScalar(0.7);
      actor.carried = actor.pendingCarry;
      actor.pendingCarry = null;
    }
    setSpeechText(actor.mesh, sold ? 'Thanks!' : farewell);
    if (actor.mesh.userData.ring) actor.mesh.userData.ring.visible = false;
    actor.state = 'leave';
    actor.path = [
      { x: SHOP.door.x, z: SHOP.door.z - 0.4 },
      { x: SHOP.door.x, z: SHOP.door.z + 0.45 },
      { x: SHOP.outside.x, z: SHOP.outside.z },
    ];
  }

  function updateCustomers(dt, now) {
    if (now >= nextSpawnAt) spawnCustomer(now);
    for (let i = customers.length - 1; i >= 0; i -= 1) {
      const actor = customers[i];
      if (actor.state === 'enter') {
        if (!actor.path.length) {
          beginRequest(actor, now);
        } else if (walkToward(actor, actor.path[0], dt)) {
          actor.path.shift();
          if (!actor.path.length) beginRequest(actor, now);
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
    anvilGlow.material.opacity = 0.26 + Math.sin(now * 2.4) * 0.1;
    shopkeeper.position.y = Math.abs(Math.sin(now * 1.7)) * 0.018;
    const doorBusy = customers.some((c) => (
      Math.abs(c.mesh.position.z - SHOP.door.z) < 1.15
      && Math.abs(c.mesh.position.x - SHOP.door.x) < 0.85
    ));
    setDoorOpen(shopDoor, doorBusy, dt);
    syncDisplays();
    refreshSelection();
    const selected = displays[state.selectedDisplay];
    if (selected?.outline) {
      const pulse = 0.62 + Math.sin(now * 3.1) * 0.22;
      outlineHaloMat.opacity = pulse * 0.7;
      outlineEdgeMat.opacity = 0.78 + Math.sin(now * 3.1) * 0.18;
      outlineBoxMat.opacity = 0.68 + Math.sin(now * 2.4) * 0.2;
    }
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
    buyFromActor(actor) {
      if (!actor || actor.state === 'leave') return;
      dismissCustomer(actor, false, 'Sold.');
    },
  };
}
