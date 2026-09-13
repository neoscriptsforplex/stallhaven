import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { recipeList } from './catalog.js';
import { classifyModelFiles, formatUploadLabel } from './modelfiles.js';
import { UPLOADS_CLEARED, clearModels, saveModel } from './storage.js';
import { normalizeImported } from './models.js';

export { classifyModelFiles, formatUploadLabel } from './modelfiles.js';

const gltfLoader = new GLTFLoader();

const MODEL_ACCEPT = '.glb,.gltf,.obj,.mtl,.png,.jpg,.jpeg,.webp,model/gltf-binary,model/gltf+json';

function decodeText(buffer) {
  return new TextDecoder().decode(buffer);
}

function basename(path) {
  return String(path ?? '').split(/[\\/]/).pop().split('?')[0].toLowerCase();
}

function sidecarMap(sidecars = {}) {
  const urls = new Map();
  const revoke = [];
  for (const [name, data] of Object.entries(sidecars)) {
    if (!data) continue;
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    revoke.push(url);
    urls.set(name.toLowerCase(), url);
    urls.set(basename(name), url);
  }
  return { urls, revoke };
}

function hasMesh(root) {
  let found = false;
  root?.traverse?.((child) => {
    if (child.isMesh) found = true;
  });
  return found;
}

function parseObjBuffer(buffer, sidecars = {}) {
  const objText = decodeText(buffer);
  if (!objText.trim()) throw new Error('That .obj file is empty.');
  const { urls, revoke } = sidecarMap(sidecars);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => urls.get(basename(url)) || url);
  const finish = () => {
    for (const url of revoke) URL.revokeObjectURL(url);
  };
  manager.onLoad = finish;
  setTimeout(finish, 60000);

  const objLoader = new OBJLoader(manager);
  const mtlEntry = Object.entries(sidecars).find(([name]) => name.toLowerCase().endsWith('.mtl'));
  if (mtlEntry) {
    try {
      const mtlLoader = new MTLLoader(manager);
      const materials = mtlLoader.parse(decodeText(mtlEntry[1]), '');
      materials.preload();
      objLoader.setMaterials(materials);
    } catch (err) {
      console.warn('MTL parse failed; loading OBJ without materials.', err?.message || err);
    }
  }
  const group = objLoader.parse(objText);
  if (!hasMesh(group)) throw new Error('That .obj has no mesh.');
  return group;
}

function friendlyParseError(err, kind) {
  const raw = err?.message || String(err || '');
  if (kind === 'obj') return raw || 'Could not parse that .obj file.';
  return raw || 'Could not parse that model.';
}

export function parseModelFile(file) {
  return file.arrayBuffer().then((buffer) => parseModelBuffer(buffer, file.name));
}

export function parseModelBuffer(buffer, name, sidecars = {}) {
  return new Promise((resolve, reject) => {
    const ext = (name || '').toLowerCase();
    if (ext.endsWith('.obj')) {
      try {
        resolve(parseObjBuffer(buffer, sidecars));
      } catch (err) {
        reject(new Error(friendlyParseError(err, 'obj')));
      }
      return;
    }
    if (ext.endsWith('.mtl')) {
      reject(new Error('That .mtl needs its .obj. Select both files together.'));
      return;
    }
    const onError = (err) => reject(new Error(friendlyParseError(err, 'gltf')));
    if (ext.endsWith('.gltf')) {
      const text = decodeText(buffer);
      if (/"uri"\s*:\s*"[^d]/.test(text) && !text.includes('data:')) {
        reject(new Error('That .gltf needs extra files. Use a single .glb instead.'));
        return;
      }
      gltfLoader.parse(text, '', (gltf) => resolve(gltf.scene), onError);
      return;
    }
    gltfLoader.parse(buffer, '', (gltf) => resolve(gltf.scene), onError);
  });
}

export const BUNDLED_PLAYER_DIR = 'models/player';

export const BUNDLED_PROP_FOLDERS = [
  { id: 'chest', folder: 'chest' },
  { id: 'furnace', folder: 'furnace' },
  { id: 'range', folder: 'range' },
  { id: 'anvil', folder: 'anvil' },
  { id: 'cauldron', folder: 'cauldron' },
  { id: 'door', folder: 'door' },
  { id: 'ladder', folder: 'ladder' },
  { id: 'goblin', folder: 'goblin' },
  { id: 'rat', folder: 'rat' },
  { id: 'table', folder: 'table' },
  { id: 'counter', folder: 'counter' },
  { id: 'tree', folder: 'tree' },
  { id: 'flowers', folder: 'flowers' },
  { id: 'rock', folder: 'rock' },
  { id: 'fountain', folder: 'fountain' },
  { id: 'skeleton', folder: 'skeleton' },
];

export async function parseBundledPlayerBuffers(objBuffer, mtlBuffer) {
  const sidecars = {};
  if (mtlBuffer) sidecars['player.mtl'] = mtlBuffer;
  return parseModelBuffer(objBuffer, 'player.obj', sidecars);
}

function assertObjPayload(buffer, label) {
  const text = decodeText(buffer);
  const start = text.trimStart();
  if (!start || start.startsWith('<!') || /^<html/i.test(start)) {
    const err = new Error(`Missing ${label}`);
    err.code = 'MISSING_MODEL';
    throw err;
  }
  return buffer;
}

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function envBaseUrl() {
  try {
    return import.meta.env.BASE_URL || './';
  } catch {
    return './';
  }
}

export function bundledModelRoots() {
  const raw = envBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const roots = [`${envBase}models/`, `${envBase}public/models/`];
  if (envBase !== './') {
    roots.push('./models/', './public/models/');
  }
  return [...new Set(roots)];
}

export function bundledModelBases(folder) {
  return bundledModelRoots().map((root) => `${root}${folder}/`);
}

let cachedModelsRoot = null;
let resolveRootPromise = null;

export function resetBundledModelRoot() {
  cachedModelsRoot = null;
  resolveRootPromise = null;
}

export function resolveBundledModelRoot() {
  if (cachedModelsRoot) return Promise.resolve(cachedModelsRoot);
  if (!resolveRootPromise) {
    resolveRootPromise = (async () => {
      for (const root of bundledModelRoots()) {
        try {
          const res = await fetch(`${root}player/player.obj`);
          if (!res.ok) continue;
          assertObjPayload(await res.arrayBuffer(), `${root}player/player.obj`);
          cachedModelsRoot = root;
          return root;
        } catch {
          // HTML fallback or a missing tree — try the next root.
        }
      }
      cachedModelsRoot = bundledModelRoots()[0];
      return cachedModelsRoot;
    })();
  }
  return resolveRootPromise;
}

function missingModel(label) {
  const err = new Error(`Missing ${label}`);
  err.code = 'MISSING_MODEL';
  return err;
}

async function fetchObjMtl(folder, objFile, mtlFile) {
  const roots = cachedModelsRoot ? [cachedModelsRoot] : bundledModelRoots();
  let lastMissing = missingModel(`models/${folder}/${objFile}`);
  for (const root of roots) {
    const base = `${root}${folder}/`;
    try {
      const objRes = await fetch(`${base}${objFile}`);
      if (!objRes.ok) {
        lastMissing = missingModel(`models/${folder}/${objFile}`);
        continue;
      }
      const objBuffer = assertObjPayload(await objRes.arrayBuffer(), `models/${folder}/${objFile}`);
      cachedModelsRoot = root;
      const sidecars = {};
      if (mtlFile) {
        const mtlRes = await fetch(`${base}${mtlFile}`);
        if (mtlRes.ok) {
          const mtlBuffer = await mtlRes.arrayBuffer();
          try {
            assertObjPayload(mtlBuffer, `models/${folder}/${mtlFile}`);
            sidecars[mtlFile] = mtlBuffer;
          } catch {
            // Ignore an HTML fallback for a missing .mtl; the OBJ can still load.
          }
        }
      }
      return parseModelBuffer(objBuffer, objFile, sidecars);
    } catch (err) {
      if (err?.code === 'MISSING_MODEL') {
        lastMissing = err;
        continue;
      }
      throw err;
    }
  }
  throw lastMissing;
}

/** Fetch the shipped LilRunnerBoi OBJ+MTL from the static /models/player/ folder. */
export async function loadBundledPlayerScene() {
  await resolveBundledModelRoot();
  return fetchObjMtl('player', 'player.obj', 'player.mtl');
}

export async function loadBundledPropScene(folder) {
  const names = [`${folder}.obj`, 'model.obj', 'player.obj'];
  let lastErr = null;
  for (const objFile of names) {
    const mtlFile = objFile.replace(/\.obj$/i, '.mtl');
    try {
      return await fetchObjMtl(folder, objFile, mtlFile);
    } catch (err) {
      lastErr = err;
      if (err?.code === 'MISSING_MODEL') break;
    }
  }
  throw lastErr ?? new Error(`Missing bundled ${folder} model.`);
}

export async function loadBundledLooks() {
  await resolveBundledModelRoot();
  const entries = await Promise.all(BUNDLED_PROP_FOLDERS.map(async ({ id, folder }) => {
    try {
      return [id, await loadBundledPropScene(folder)];
    } catch (err) {
      if (err?.code !== 'MISSING_MODEL') {
        console.warn(`Bundled ${id} model skipped:`, err?.message || err);
      }
      return [id, null];
    }
  }));
  const looks = {};
  for (const [id, scene] of entries) {
    if (scene) looks[id] = scene;
  }
  return looks;
}

export async function parseModelFiles(files) {
  const classified = classifyModelFiles(files);
  if (classified.error) throw new Error(classified.error);
  const buffer = await classified.primary.arrayBuffer();
  const sidecars = {};
  for (const file of classified.sidecars ?? []) {
    sidecars[file.name] = await file.arrayBuffer();
  }
  const scene = await parseModelBuffer(buffer, classified.primary.name, sidecars);
  return {
    scene,
    name: classified.primary.name,
    label: formatUploadLabel(classified),
    buffer,
    sidecars,
  };
}

function syncModalClass() {
  const any = [...document.querySelectorAll('.modal')].some((el) => !el.hidden);
  document.body.classList.toggle('modal-open', any);
}

const KIND_IDS = {
  furniture: 'furniture-look',
  player: 'player-look',
  customer: 'customer-look',
};

export function bindUploadUI({ button, modal, state, world, onChange }) {
  const fileInput = modal.querySelector('input[type="file"]');
  const pickBtn = modal.querySelector('[data-upload-pick]');
  const dropHint = modal.querySelector('[data-upload-drop]');
  const title = modal.querySelector('[data-import-name]');
  const furnitureBtn = modal.querySelector('[data-tag="furniture"]');
  const wareBtn = modal.querySelector('[data-tag="ware"]');
  const playerBtn = modal.querySelector('[data-tag="player"]');
  const customerBtn = modal.querySelector('[data-tag="customer"]');
  const tagRow = modal.querySelector('[data-tags]');
  const recipeRow = modal.querySelector('[data-recipes]');
  const cancelBtn = modal.querySelector('[data-cancel]');
  const errorEl = modal.querySelector('[data-error]');
  const clearBtn = modal.querySelector('[data-clear-uploads]');
  const clearBox = modal.querySelector('[data-clear-box]');
  const clearYes = modal.querySelector('[data-clear-yes]');
  const clearNo = modal.querySelector('[data-clear-no]');
  const clearNote = modal.querySelector('[data-clear-note]');

  if (fileInput) {
    fileInput.accept = MODEL_ACCEPT;
    fileInput.multiple = true;
  }

  recipeRow.innerHTML = recipeList().map((r) => (
    `<button type="button" class="recipe-bind" data-recipe="${r.id}">${r.name}</button>`
  )).join('');

  let pending = null;

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  function showClearNote(text) {
    if (!clearNote) return;
    clearNote.textContent = text || '';
    clearNote.hidden = !text;
  }

  function hideClearConfirm() {
    if (clearBox) clearBox.hidden = true;
  }

  function showTags(on) {
    if (tagRow) tagRow.hidden = !on;
    recipeRow.hidden = true;
  }

  function close() {
    pending = null;
    modal.hidden = true;
    showTags(false);
    showError('');
    showClearNote('');
    hideClearConfirm();
    title.textContent = '';
    syncModalClass();
  }

  function openModal() {
    pending = null;
    title.textContent = '';
    showTags(false);
    showError('');
    showClearNote('');
    hideClearConfirm();
    modal.hidden = false;
    syncModalClass();
  }

  async function receiveFiles(fileList) {
    const files = [...(fileList ?? [])];
    const names = files.map((file) => file.name).join(' + ');
    try {
      const loaded = await parseModelFiles(files);
      pending = {
        id: `up-${Date.now()}`,
        name: loaded.name,
        buffer: loaded.buffer,
        sidecars: loaded.sidecars,
        scene: loaded.scene,
      };
      title.textContent = loaded.label;
      showError('');
      showTags(true);
      modal.hidden = false;
      syncModalClass();
    } catch (err) {
      title.textContent = names;
      pending = null;
      showTags(false);
      showError(err.message || 'Could not read that model. The default look is unchanged.');
      modal.hidden = false;
      syncModalClass();
    }
  }

  async function persist(record) {
    try {
      await saveModel(record);
    } catch {
      // Memory-only is fine for a session.
    }
  }

  async function applyTag(kind, recipeId) {
    if (!pending) return;
    const record = {
      id: KIND_IDS[kind] ?? pending.id,
      name: pending.name,
      kind,
      recipeId: recipeId ?? null,
      displayIndex: kind === 'furniture' ? state.selectedDisplay : null,
      buffer: pending.buffer,
      sidecars: pending.sidecars ?? {},
    };

    if (kind === 'furniture') {
      try {
        const furniture = pending.scene.clone(true);
        normalizeImported(furniture, 1.25, true);
        await persist(record);
        world.replaceFurniture(state.selectedDisplay, pending.scene);
      } catch (err) {
        showError(err.message || 'Could not replace that furniture. The table is unchanged.');
        return;
      }
    } else if (kind === 'ware') {
      try {
        const ware = pending.scene.clone(true);
        normalizeImported(ware, 0.55, true);
        await persist(record);
        world.bindWareLook(recipeId, pending.scene);
      } catch (err) {
        showError(err.message || 'Could not bind that ware. The recipe look is unchanged.');
        return;
      }
    } else if (kind === 'player') {
      const result = world.setPlayerLook(pending.scene);
      if (!result?.ok) {
        showError(result?.reason || 'Could not use that as a player model. The default character is unchanged.');
        return;
      }
      await persist(record);
    } else if (kind === 'customer') {
      const result = world.setCustomerLook(pending.scene);
      if (!result?.ok) {
        showError(result?.reason || 'Could not use that as a customer model. Default travelers are unchanged.');
        return;
      }
      await persist(record);
    }

    onChange();
    close();
  }

  button.addEventListener('click', openModal);
  pickBtn.addEventListener('click', () => fileInput.click());

  const dropTarget = dropHint ?? modal;
  dropTarget.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropHint?.classList.add('is-hot');
  });
  dropTarget.addEventListener('dragleave', () => dropHint?.classList.remove('is-hot'));
  dropTarget.addEventListener('drop', (event) => {
    event.preventDefault();
    dropHint?.classList.remove('is-hot');
    const files = event.dataTransfer?.files;
    if (files?.length) receiveFiles(files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) receiveFiles(fileInput.files);
    fileInput.value = '';
  });

  furnitureBtn.addEventListener('click', () => applyTag('furniture'));
  playerBtn?.addEventListener('click', () => applyTag('player'));
  customerBtn?.addEventListener('click', () => applyTag('customer'));
  wareBtn.addEventListener('click', () => {
    recipeRow.hidden = false;
  });
  recipeRow.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-recipe]');
    if (btn) applyTag('ware', btn.dataset.recipe);
  });
  clearBtn?.addEventListener('click', () => {
    if (clearBox) clearBox.hidden = false;
    showClearNote('');
    showError('');
  });
  clearNo?.addEventListener('click', hideClearConfirm);
  clearYes?.addEventListener('click', async () => {
    hideClearConfirm();
    try {
      world.clearUploads?.();
      await clearModels();
    } catch {
      world.clearUploads?.();
    }
    showClearNote(UPLOADS_CLEARED);
    onChange();
  });
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
}
