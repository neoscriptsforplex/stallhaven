import { applyState, serializeState } from './economy.js';

const SAVE_TYPE = {
  description: 'Rune Craft save',
  accept: { 'application/json': ['.json'] },
};

function toJson(state) {
  return `${JSON.stringify(serializeState(state), null, 2)}\n`;
}

async function writeWithPicker(text, name = 'runecraft-save.json') {
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: [SAVE_TYPE],
  });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function downloadFallback(text, name = 'runecraft-save.json') {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the shop to a JSON file. `name` defaults to runecraft-save.json. */
export async function saveStateToFile(state, name) {
  const text = toJson(state);
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      await writeWithPicker(text, name);
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      downloadFallback(text, name);
      return true;
    }
  }
  downloadFallback(text, name);
  return true;
}

/** Let the player pick a save file and return { name, text }, or null if cancelled. */
export async function pickSaveFile() {
  try {
    if (typeof window.showOpenFilePicker === 'function') {
      const [handle] = await window.showOpenFilePicker({ multiple: false, types: [SAVE_TYPE] });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text() };
    }
    return await readWithInputNamed();
  } catch (err) {
    if (err?.name === 'AbortError') return null;
    throw err;
  }
}

function readWithInputNamed() {
  return new Promise((resolve, reject) => {
    const input = document.querySelector('#load-file') ?? document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.value = '';
    input.onchange = () => {
      const file = input.files?.[0];
      input.onchange = null;
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    };
    input.click();
  });
}

async function readWithPicker() {
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [SAVE_TYPE],
  });
  const file = await handle.getFile();
  return file.text();
}

function readWithInput() {
  return new Promise((resolve, reject) => {
    const input = document.querySelector('#load-file') ?? document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.value = '';
    const cleanup = () => {
      input.onchange = null;
    };
    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
        return;
      }
      file.text().then(resolve, reject);
    };
    input.click();
  });
}

export async function loadStateFromFile(state) {
  let text;
  try {
    if (typeof window.showOpenFilePicker === 'function') {
      text = await readWithPicker();
    } else {
      text = await readWithInput();
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false;
    throw err;
  }
  const data = JSON.parse(text);
  if (!applyState(state, data)) {
    throw new Error('That file is not a shop save.');
  }
  return true;
}
