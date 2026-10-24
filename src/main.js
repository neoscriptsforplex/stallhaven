import { RECIPES } from './game/catalog.js';
import { completeCrafts, createState, pushLog, tickMaterials, SAVE_VERSION } from './game/economy.js';
import { loadModels } from './game/storage.js';
import { bindHud } from './game/hud.js';
import { bindUploadUI, parseModelBuffer, loadBundledPlayerScene, loadBundledRiggedPlayer, loadBundledFishingRod,
  loadBundledFishingNet, loadBundledFillBucket, loadBundledRiggedGoblin, loadBundledRiggedRat, loadBundledRiggedBuyers, loadBundledLooks } from './game/upload.js';
import { enableSfx, getMusicVolume, loadBundledMusic, loadSfxManifest, playSfx, setSfxLoop, unlockAudio } from './game/audio.js';
import { createSfxDirector } from './game/sfxHooks.js';
import { installUiSounds, mountSoundSettings, restoreSoundMix } from './game/soundUi.js';
import { intentBus } from './game/intents.js';
import { createWorld } from './game/world.js';
import { normalizeImported, setBundledLooks, setRiggedBuyers } from './game/models.js';
import { createAutosave, createSlotStore, openBackend, applySlotData } from './game/saveSlots.js';
import { keepSharedSettings, mountSaves, readBootSlot } from './game/saveUi.js';
import { mountCoop } from './coop/coopUi.js';
import { cloudConfig } from './cloud/config.js';
import { createSupabaseClient } from './cloud/supabaseClient.js';
import { createCloudSync } from './cloud/sync.js';
import { createAutoBackup } from './cloud/autobackup.js';
import { deviceLabel, mountCloud } from './cloud/cloudUi.js';

const canvas = document.querySelector('#view');
const hudRoot = document.querySelector('#hud');
const fallback = document.querySelector('#nowebgl');
const bootCover = document.querySelector('#boot-cover');
const bootBar = bootCover?.querySelector('[data-boot-bar]');
const bootLabel = bootCover?.querySelector('[data-boot-label]');

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function setBootProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (bootBar) {
    bootBar.style.width = `${Math.max(8, pct)}%`;
    if (total > 0) bootBar.classList.add('is-progress');
  }
  if (bootLabel) bootLabel.textContent = 'Loading';
}

function hideBootCover({ immediate = false } = {}) {
  document.documentElement.classList.remove('is-booting', 'is-scene-live');
  if (!bootCover) return;
  if (immediate) {
    bootCover.classList.remove('is-leaving');
    bootCover.hidden = true;
    return;
  }
  bootCover.classList.add('is-leaving');
  window.setTimeout(() => {
    bootCover.hidden = true;
  }, 380);
}

function playPromptLabel() {
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  return coarse ? 'Tap to play' : 'Click to play';
}

function showPlayPrompt() {
  const label = playPromptLabel();
  if (bootBar) {
    bootBar.style.width = '100%';
    bootBar.classList.add('is-progress', 'is-ready');
  }
  if (bootLabel) bootLabel.textContent = label;
  if (!bootCover) return;
  bootCover.classList.add('is-ready');
  bootCover.tabIndex = 0;
  bootCover.setAttribute('role', 'button');
  bootCover.setAttribute('aria-label', label);
}

function isPlayKey(event) {
  return event.key === 'Enter' || event.key === ' ' || event.code === 'Space';
}

function waitForPlayGesture(onGesture) {
  if (!bootCover) {
    onGesture();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let started = false;
    const begin = (event) => {
      if (event.type === 'keydown') {
        if (event.repeat || !isPlayKey(event)) return;
        event.preventDefault();
        event.stopPropagation();
      } else if (event.button != null && event.button > 0) {
        return;
      } else {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
      if (started) return;
      started = true;
      detach();
      onGesture();
      resolve();
    };
    const onKey = (event) => begin(event);
    function detach() {
      bootCover.removeEventListener('touchend', begin, true);
      bootCover.removeEventListener('click', begin, true);
      window.removeEventListener('keydown', onKey, true);
    }
    bootCover.addEventListener('touchend', begin, { capture: true, passive: false });
    bootCover.addEventListener('click', begin, true);
    window.addEventListener('keydown', onKey, true);
  });
}

async function paintLitScene(world) {
  document.documentElement.classList.add('is-scene-live');
  await Promise.race([
    world.warmScene?.() ?? Promise.resolve(),
    new Promise((resolve) => { window.setTimeout(resolve, 1500); }),
  ]);
  for (let i = 0; i < 2; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    world.tick(0, performance.now() / 1000);
  }
}

if (!hasWebGL()) {
  hideBootCover();
  fallback.hidden = false;
} else {
  bootGame();
}

async function bootGame() {
  const state = createState();
  // Save slots: open storage, migrate the old single autosave once, then either
  // reload into the slot chosen before a reload (Switch slot / import) or wait
  // for the picker after Click to play.
  let local = null;
  try {
    local = window.localStorage;
  } catch {
    local = null;
  }
  const backend = await openBackend({ local });
  const store = createSlotStore({ backend, legacy: local });
  await store.loadMeta();
  await store.migrateLegacy().catch(() => null);
  let saves = null;
  const autosave = createAutosave({
    store,
    getState: () => state,
    nowSeconds: () => performance.now() / 1000,
    getName: () => state.shopName ?? null,
    emit: (type, detail) => saves?.emit(type, detail),
    onStatus: (s) => saves?.paintStatus(s),
  });
  const bootSlot = readBootSlot();
  let resumed = false;
  if (bootSlot && !bootSlot.isNew) {
    const data = await store.read(bootSlot.slot);
    if (data && keepSharedSettings(state, () => applySlotData(state, data, performance.now() / 1000))) {
      state.shopName = store.meta.slots[String(bootSlot.slot)]?.name ?? data.shopName;
      autosave.setSlot(bootSlot.slot, data);
      resumed = true;
    }
  }
  pushLog(state, resumed
    ? 'Welcome back. Your shop was saved in this browser.'
    : 'Rune Craft is open. Craft into the chest, then trade at the counter.');
  setBootProgress(0, 1);

  let bundledPlayer = null;
  let riggedPlayer = null;
  let fishingRod = null;
  let fishingNet = null;
  let fillBucket = null;
  let riggedGoblin = null;
  let riggedRat = null;
  let riggedBuyers = {};
  let bundledLooks = {};
  try {
    const [rigged, looks, , goblin, rat, buyers, rod, net, bucket] = await Promise.all([
      loadBundledRiggedPlayer().catch((err) => {
        console.warn('Rigged player skipped:', err?.message || err);
        return null;
      }),
      loadBundledLooks((done, total) => {
        setBootProgress(done, total);
      }),
      loadBundledMusic().catch((err) => {
        console.warn('Bundled music skipped:', err?.message || err);
        return [];
      }),
      loadBundledRiggedGoblin().catch((err) => {
        console.warn('Rigged goblin skipped:', err?.message || err);
        return null;
      }),
      loadBundledRiggedRat().catch((err) => {
        console.warn('Rigged rat skipped:', err?.message || err);
        return null;
      }),
      loadBundledRiggedBuyers(),
      loadBundledFishingRod().catch((err) => {
        console.warn('Fishing rod skipped:', err?.message || err);
        return null;
      }),
      loadBundledFishingNet().catch((err) => {
        console.warn('Fishing net skipped:', err?.message || err);
        return null;
      }),
      loadBundledFillBucket().catch((err) => {
        console.warn('Fill bucket skipped:', err?.message || err);
        return null;
      }),
    ]);
    riggedPlayer = rigged;
    fishingRod = rod;
    fishingNet = net;
    fillBucket = bucket;
    riggedGoblin = goblin;
    riggedRat = rat;
    riggedBuyers = buyers ?? {};
    if (!riggedPlayer) {
      bundledPlayer = await loadBundledPlayerScene().catch((err) => {
        console.warn('Bundled player skipped:', err?.message || err);
        return null;
      });
    }
    bundledLooks = looks ?? {};
    setBundledLooks(bundledLooks);
    setRiggedBuyers(riggedBuyers);
    setBootProgress(1, 1);
  } catch (err) {
    console.warn('Bundled models skipped; keeping procedural shop.', err?.message || err);
  }

  const world = createWorld(canvas, state, { bundledPlayer, riggedPlayer, riggedGoblin, riggedRat, fishingRod, fishingNet, fillBucket });
  window.stallhaven = {
    world,
    state,
    uploadsReady: false,
    bundled: {
      player: Boolean(riggedPlayer || bundledPlayer),
      looks: Object.keys(bundledLooks ?? {}),
      buyers: Object.keys(riggedBuyers ?? {}),
    },
  };
  const hud = bindHud(hudRoot, state, world);
  window.stallhaven.hud = hud;
  window.stallhaven.autosave = autosave;
  window.stallhaven.slots = store;
  saves = mountSaves({
    state,
    hud,
    store,
    autosave,
    makeState: createState,
    nowSeconds: () => performance.now() / 1000,
    log: (msg) => {
      pushLog(state, msg);
      hud.render(performance.now() / 1000);
    },
  });
  window.stallhaven.saves = saves;
  window.stallhaven.saveEvents = saves.events;

  // Online saves (off unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set) + backup file.
  let live = false;
  const cfg = cloudConfig();
  let deviceId = null;
  try {
    deviceId = local?.getItem('rc-device-id');
    if (!deviceId) {
      deviceId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 36);
      local?.setItem('rc-device-id', deviceId);
    }
  } catch {
    deviceId = 'unknown';
  }
  const cloudClient = cfg ? createSupabaseClient({ ...cfg, storage: local }) : null;
  const cloudSync = cloudClient
    ? createCloudSync({
      client: cloudClient,
      store,
      kv: local,
      deviceId,
      deviceLabel: deviceLabel(),
      isLive: (slot) => live && autosave.slot === slot,
      emit: (type, detail) => saves.emit(type, detail),
      saveVersion: SAVE_VERSION,
    })
    : null;
  const backup = createAutoBackup({ store, kv: local, emit: (type, detail) => saves.emit(type, detail) });
  backup.loadHandle().catch(() => {});
  const cloud = mountCloud({
    saves,
    store,
    autosave,
    sync: cloudSync,
    client: cloudClient,
    backup,
    emit: (type, detail) => saves.emit(type, detail),
    isLive: (slot) => live && autosave.slot === slot,
  });
  window.stallhaven.cloud = { ui: cloud, sync: cloudSync, backup, enabled: Boolean(cfg) };
  const cloudStart = cloud.start().catch(() => null);
  window.stallhaven.coop = mountCoop({ state, world, hud, autosave });
  bindUploadUI({
    button: document.querySelector('#upload-btn'),
    modal: document.querySelector('#import-modal'),
    state,
    world,
    onChange: () => hud.render(performance.now() / 1000),
  });
  world.tick(0, performance.now() / 1000);
  hud.render(performance.now() / 1000);
  setBootProgress(1, 1);
  await paintLitScene(world);
  showPlayPrompt();

  loadModels().then(async (records) => {
    for (const record of records) {
      try {
        const scene = await parseModelBuffer(record.buffer, record.name, record.sidecars ?? {});
        if (record.kind === 'player') {
          const result = world.setPlayerLook(scene, {
            yaw180: Boolean(record.yaw180),
            name: record.name,
          });
          if (!result?.ok) continue;
        } else if (record.kind === 'customer') {
          const result = world.setCustomerLook(scene);
          if (!result?.ok) continue;
        } else {
          normalizeImported(scene, 1, true);
          if (record.kind === 'furniture' && record.displayIndex != null) {
            world.replaceFurniture(record.displayIndex, scene);
          } else if (record.kind === 'furniture') {
            world.replaceFurniture(state.selectedDisplay, scene);
          } else if (record.kind === 'ware' && record.recipeId) {
            world.bindWareLook(record.recipeId, scene);
          }
        }
      } catch {
        // Skip a broken stored model and keep the stall playable.
      }
    }
    hud.render(performance.now() / 1000);
  }).catch(() => {
    // A stored model that cannot be read leaves the current adventurer in place.
  }).finally(() => {
    window.stallhaven.uploadsReady = true;
  });

  loadSfxManifest().catch(() => {});
  restoreSoundMix({ musicVolume: getMusicVolume() });
  mountSoundSettings();
  const sfx = createSfxDirector({ play: (id, opts) => playSfx(id, opts), loop: (name, on, gain = 1) => setSfxLoop(name, on, { gain }) });
  intentBus.onResult((intent, result) => sfx.onIntent(intent, result, performance.now() / 1000));
  await waitForPlayGesture(() => {
    unlockAudio();
    enableSfx();
    installUiSounds();
    const music = hud.tryStartMusic?.();
    if (music && typeof music.catch === 'function') music.catch(() => {});
    world.tick(0, performance.now() / 1000);
  });
  // Always show "Choose a save" after Click to play, even with one filled slot,
  // unless this load is the reload that follows a choice made in the picker.
  if (bootSlot?.isNew) {
    await saves.startNew(bootSlot.slot, bootSlot.name);
  } else if (!resumed) {
    // An expired login link opens the sign-in form over the picker.
    cloudStart.then((r) => {
      if (r?.expired && saves.pickerOpen) cloud.showExpiredInPicker();
    });
    for (;;) {
      const choice = await saves.showPicker();
      if (choice.isNew) {
        await saves.startNew(choice.slot, choice.name);
        break;
      }
      if (await saves.loadSlotInto(choice.slot)) {
        hud.refreshAll?.({ layout: true });
        hud.showQuestAway?.();
        pushLog(state, 'Welcome back. Your shop was saved in this browser.');
        break;
      }
    }
  }
  await store.setLastSlot(autosave.slot);
  autosave.start();
  live = true;
  cloud.afterPick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  world.tick(0, performance.now() / 1000);
  hideBootCover({ immediate: true });

  let last = performance.now();
  function frame(nowMs) {
    const now = nowMs / 1000;
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    tickMaterials(state, dt);
    const finished = completeCrafts(state, now);
    for (const id of finished) {
      pushLog(state, `Finished ${RECIPES[id].name}. Into the chest.`);
    }
    if (finished.length) world.syncDisplays();
    world.tick(dt, now);
    if (world.sfxSnapshot) sfx.frame(world.sfxSnapshot(), now);
    hud.render(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
