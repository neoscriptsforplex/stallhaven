import { RECIPES } from './game/catalog.js';
import { completeCrafts, createState, pushLog, tickMaterials } from './game/economy.js';
import { loadModels } from './game/storage.js';
import { bindHud } from './game/hud.js';
import { bindUploadUI, parseModelBuffer, loadBundledPlayerScene, loadBundledRiggedPlayer, loadBundledRiggedGoblin, loadBundledRiggedRat, loadBundledRiggedBuyers, loadBundledLooks } from './game/upload.js';
import { loadBundledMusic, unlockAudio } from './game/audio.js';
import { createWorld } from './game/world.js';
import { normalizeImported, setBundledLooks, setRiggedBuyers } from './game/models.js';

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
  pushLog(state, 'Rune Craft is open. Craft into the chest, then trade at the counter.');
  setBootProgress(0, 1);

  let bundledPlayer = null;
  let riggedPlayer = null;
  let riggedGoblin = null;
  let riggedRat = null;
  let riggedBuyers = {};
  let bundledLooks = {};
  try {
    const [rigged, looks, , goblin, rat, buyers] = await Promise.all([
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
    ]);
    riggedPlayer = rigged;
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

  const world = createWorld(canvas, state, { bundledPlayer, riggedPlayer, riggedGoblin, riggedRat });
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

  await waitForPlayGesture(() => {
    unlockAudio();
    const music = hud.tryStartMusic?.();
    if (music && typeof music.catch === 'function') music.catch(() => {});
    world.tick(0, performance.now() / 1000);
  });
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
    hud.render(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
