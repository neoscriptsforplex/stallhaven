import { RECIPES } from './game/catalog.js';
import { completeCrafts, createState, pushLog, tickMaterials } from './game/economy.js';
import { loadModels } from './game/storage.js';
import { bindHud } from './game/hud.js';
import { bindUploadUI, parseModelBuffer, loadBundledPlayerScene, loadBundledLooks } from './game/upload.js';
import { loadBundledMusic } from './game/audio.js';
import { createWorld } from './game/world.js';
import { normalizeImported, setBundledLooks } from './game/models.js';

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

function setBootProgress(done, total, text) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (bootBar) bootBar.style.width = `${pct}%`;
  if (bootLabel) bootLabel.textContent = text ?? `Loading models… ${pct}%`;
}

function hideBootCover() {
  if (!bootCover) return;
  bootCover.hidden = true;
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
  setBootProgress(0, 1, 'Loading models…');

  let bundledPlayer = null;
  let bundledLooks = {};
  try {
    const [player, looks] = await Promise.all([
      loadBundledPlayerScene().catch((err) => {
        console.warn('Bundled player skipped:', err?.message || err);
        return null;
      }),
      loadBundledLooks((done, total) => {
        setBootProgress(done, total, `Loading models… ${done} / ${total}`);
      }),
      loadBundledMusic().catch((err) => {
        console.warn('Bundled music skipped:', err?.message || err);
        return [];
      }),
    ]);
    bundledPlayer = player;
    bundledLooks = looks ?? {};
    setBundledLooks(bundledLooks);
    setBootProgress(1, 1, 'Building shop…');
  } catch (err) {
    console.warn('Bundled models skipped; keeping procedural shop.', err?.message || err);
  }

  const world = createWorld(canvas, state, { bundledPlayer });
  window.stallhaven = {
    world,
    state,
    bundled: {
      player: Boolean(bundledPlayer),
      looks: Object.keys(bundledLooks ?? {}),
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
  hideBootCover();
  await hud.tryStartMusic?.();

  loadModels().then(async (records) => {
    for (const record of records) {
      try {
        const scene = await parseModelBuffer(record.buffer, record.name, record.sidecars ?? {});
        if (record.kind === 'player') {
          const result = world.setPlayerLook(scene);
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
  });

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
