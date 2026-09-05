import { RECIPES } from './game/catalog.js';
import { completeCrafts, createState, pushLog } from './game/economy.js';
import { loadModels } from './game/storage.js';
import { bindHud } from './game/hud.js';
import { bindUploadUI, parseModelBuffer } from './game/upload.js';
import { createWorld } from './game/world.js';
import { normalizeImported } from './game/models.js';

const canvas = document.querySelector('#view');
const hudRoot = document.querySelector('#hud');
const fallback = document.querySelector('#nowebgl');

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  fallback.hidden = false;
} else {
  const state = createState();
  pushLog(state, 'The stall is open. Craft into the chest, then click a traveler.');
  const world = createWorld(canvas, state);
  const hud = bindHud(hudRoot, state, world);
  bindUploadUI({
    zone: document.querySelector('#drop'),
    modal: document.querySelector('#import-modal'),
    state,
    world,
    onChange: () => hud.render(performance.now() / 1000),
  });

  loadModels().then(async (records) => {
    for (const record of records) {
      try {
        const scene = await parseModelBuffer(record.buffer, record.name);
        normalizeImported(scene, 1, true);
        if (record.kind === 'furniture' && record.displayIndex != null) {
          world.replaceFurniture(record.displayIndex, scene);
        } else if (record.kind === 'furniture') {
          world.replaceFurniture(state.selectedDisplay, scene);
        } else if (record.kind === 'ware' && record.recipeId) {
          world.bindWareLook(record.recipeId, scene);
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
