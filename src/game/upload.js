import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { recipeList } from './catalog.js';
import { saveModel } from './storage.js';
import { normalizeImported } from './models.js';

const loader = new GLTFLoader();

export function parseModelFile(file) {
  return file.arrayBuffer().then((buffer) => parseModelBuffer(buffer, file.name));
}

export function parseModelBuffer(buffer, name) {
  return new Promise((resolve, reject) => {
    const ext = name.toLowerCase();
    if (ext.endsWith('.gltf')) {
      const text = new TextDecoder().decode(buffer);
      if (/"uri"\s*:\s*"[^d]/.test(text) && !text.includes('data:')) {
        reject(new Error('That .gltf needs extra files. Use a single .glb instead.'));
        return;
      }
      loader.parse(text, '', (gltf) => resolve(gltf.scene), reject);
      return;
    }
    loader.parse(buffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

export function bindUploadUI({ zone, modal, state, world, onChange }) {
  const fileInput = zone.querySelector('input[type="file"]');
  const title = modal.querySelector('[data-import-name]');
  const furnitureBtn = modal.querySelector('[data-tag="furniture"]');
  const wareBtn = modal.querySelector('[data-tag="ware"]');
  const recipeRow = modal.querySelector('[data-recipes]');
  const cancelBtn = modal.querySelector('[data-cancel]');
  const errorEl = modal.querySelector('[data-error]');

  recipeRow.innerHTML = recipeList().map((r) => (
    `<button type="button" class="recipe-bind" data-recipe="${r.id}">${r.name}</button>`
  )).join('');

  let pending = null;

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  function close() {
    pending = null;
    modal.hidden = true;
    recipeRow.hidden = true;
    showError('');
  }

  async function receiveFile(file) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
      showError('Drop a .glb or .gltf file.');
      modal.hidden = false;
      title.textContent = file.name;
      pending = null;
      return;
    }
    try {
      const scene = await parseModelFile(file);
      normalizeImported(scene, 1, true);
      const buffer = await file.arrayBuffer();
      pending = {
        id: `up-${Date.now()}`,
        name: file.name,
        buffer,
        scene,
      };
      title.textContent = file.name;
      recipeRow.hidden = true;
      showError('');
      modal.hidden = false;
    } catch (err) {
      title.textContent = file.name;
      pending = null;
      showError(err.message || 'Could not read that model.');
      modal.hidden = false;
    }
  }

  async function applyTag(kind, recipeId) {
    if (!pending) return;
    const record = {
      id: pending.id,
      name: pending.name,
      kind,
      recipeId: recipeId ?? null,
      displayIndex: kind === 'furniture' ? state.selectedDisplay : null,
      buffer: pending.buffer,
    };
    try {
      await saveModel(record);
    } catch {
      // Memory-only is fine for a session.
    }
    if (kind === 'furniture') {
      world.replaceFurniture(state.selectedDisplay, pending.scene);
    } else {
      world.bindWareLook(recipeId, pending.scene);
    }
    onChange();
    close();
  }

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-hot');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-hot'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-hot');
    const file = event.dataTransfer?.files?.[0];
    if (file) receiveFile(file);
  });
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) receiveFile(file);
    fileInput.value = '';
  });

  furnitureBtn.addEventListener('click', () => applyTag('furniture'));
  wareBtn.addEventListener('click', () => {
    recipeRow.hidden = false;
  });
  recipeRow.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-recipe]');
    if (btn) applyTag('ware', btn.dataset.recipe);
  });
  cancelBtn.addEventListener('click', close);
}
