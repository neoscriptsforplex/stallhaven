/**
 * Save system UI (Youi's approved SPEC): #slot-picker, #autosave-status,
 * #saves-btn / #saves-dock, Settings → Save files, #import-dialog, co-op notes.
 * Storage and timing live in saveSlots.js; this file only touches the DOM.
 *
 * Events are dispatched on document as CustomEvent('rc-save', { detail: { type, ...data } })
 * and kept in window.stallhaven.saveEvents for debugging.
 */
import {
  SLOT_COUNT,
  applySlotData,
  cleanSlotName,
  defaultImportSlot,
  defaultSlotName,
  exportFileName,
  formatAgo,
  formatCoins,
  formatPlaytime,
  validateImport,
} from './saveSlots.js';
import { pickSaveFile, saveStateToFile } from './savefile.js';

export const BOOT_SLOT_KEY = 'rc-boot-slot';

/** Settings are shared across slots (Luke): keep them when a slot is loaded. */
export function keepSharedSettings(state, apply) {
  const shared = {
    brightness: state.brightness,
    dungeonBrightness: state.dungeonBrightness,
    photoMode: state.photoMode,
    skybox: state.skybox,
    fullscreen: state.fullscreen,
    volume: state.music?.volume,
    loop: state.music?.loop,
  };
  const ok = apply();
  if (ok) {
    state.brightness = shared.brightness;
    state.dungeonBrightness = shared.dungeonBrightness;
    state.photoMode = shared.photoMode;
    state.skybox = shared.skybox;
    state.fullscreen = shared.fullscreen;
    if (state.music) {
      if (shared.volume != null) state.music.volume = shared.volume;
      if (shared.loop != null) state.music.loop = shared.loop;
    }
  }
  return ok;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function session() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readBootSlot() {
  const s = session();
  try {
    const raw = s?.getItem(BOOT_SLOT_KEY);
    s?.removeItem(BOOT_SLOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function reloadInto(choice) {
  try {
    session()?.setItem(BOOT_SLOT_KEY, JSON.stringify(choice));
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export function mountSaves({ state, hud, store, autosave, makeState, nowSeconds, log = () => {} }) {
  const events = [];
  function emit(type, detail = {}) {
    events.push({ type, ...detail, at: Date.now() });
    if (events.length > 200) events.shift();
    document.dispatchEvent(new CustomEvent('rc-save', { detail: { type, ...detail } }));
    if (type === 'save_ok' || type === 'slot_deleted') paintDock();
  }

  const meta = () => store.meta;
  const activeName = () => meta().slots[String(autosave.slot)]?.name ?? state.shopName ?? null;
  let guest = false;

  /* ---------------- autosave status (#autosave-status) ---------------- */
  const statusEl = document.querySelector('#autosave-status');
  function paintStatus(s) {
    if (!statusEl) return;
    if (s === 'idle') {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
      statusEl.removeAttribute('data-autosave-state');
      return;
    }
    statusEl.hidden = false;
    statusEl.dataset.autosaveState = s;
    statusEl.innerHTML = s === 'error'
      ? '<div class="sv-err" data-autosave-state="error" role="alert"><span>⚠ Couldn\'t save, browser storage full</span><button type="button" class="sv-ghost" data-autosave-export>Export</button></div>'
      : s === 'ok'
        ? '<span class="sv-pill is-ok" data-autosave-state="ok">Saved ✓</span>'
        : '<span class="sv-pill" data-autosave-state="saving"><i class="sv-spin"></i>Saving…</span>';
    if (s === 'ok') {
      const pill = statusEl.firstElementChild;
      requestAnimationFrame(() => setTimeout(() => pill?.classList.add('is-fading'), 900));
    }
  }
  statusEl?.addEventListener('click', (e) => {
    if (e.target.closest('[data-autosave-export]')) exportCurrent();
  });

  /* ---------------- picker (#slot-picker) ---------------- */
  const picker = document.createElement('div');
  picker.id = 'slot-picker';
  picker.className = 'sv-overlay';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Choose a save');
  picker.hidden = true;
  document.body.appendChild(picker);
  let pickerState = { deleting: null, naming: null };
  let resolvePick = null;

  function card(n) {
    const s = meta().slots[String(n)];
    if (!s) {
      if (pickerState.naming === n) {
        const def = defaultSlotName(meta(), n);
        return `<article class="sv-card is-empty is-naming" data-slot="${n}">
          <form class="sv-newform" data-slot-new-form="${n}">
            <h2>Slot ${n} · New game</h2>
            <label class="sv-namefield">Shop name<input type="text" data-slot-name-input="${n}" maxlength="32" value="${esc(def)}" autocomplete="off" spellcheck="false" /></label>
            <div class="sv-row"><button type="button" class="sv-ghost" data-slot-new-cancel="${n}" style="flex:1">Cancel</button><button type="submit" class="sv-primary" data-slot-start="${n}">Start</button></div>
          </form></article>`;
      }
      return `<article class="sv-card is-empty" data-slot="${n}"><span class="sv-plus">+</span><div><h2>Slot ${n}</h2><button type="button" class="sv-primary" data-slot-new="${n}">New game</button></div></article>`;
    }
    const current = meta().lastSlot === n;
    return `<article class="sv-card${current ? ' is-current' : ''}" data-slot="${n}">
      <h2>Slot ${n}${current ? ' · last played' : ''}</h2><p class="sv-name">${esc(s.name)}</p>
      <dl><dt>Shop Level</dt><dd>${s.shopLevel}</dd><dt>Coins</dt><dd>${formatCoins(s.gold)}</dd><dt>Playtime</dt><dd>${formatPlaytime(s.playTime)}</dd></dl>
      <p class="sv-when">${formatAgo(s.savedAt)}</p>
      <div class="sv-row"><button type="button" class="sv-primary" data-slot-continue="${n}">Continue</button><button type="button" class="sv-ghost sv-danger" data-slot-delete="${n}" aria-label="Delete slot ${n}">Delete</button></div>
      ${pickerState.deleting === n ? `<div class="sv-confirm" role="alertdialog"><p><b>Delete Slot ${n}?</b></p><p>This can't be undone.</p><div class="sv-row"><button type="button" class="sv-ghost" data-slot-delete-cancel="${n}" style="flex:1">Cancel</button><button type="button" class="sv-ghost sv-danger sv-solid" style="flex:1" data-slot-delete-confirm="${n}">Delete</button></div></div>` : ''}
    </article>`;
  }

  function paintPicker() {
    const cards = [];
    for (let n = 1; n <= SLOT_COUNT; n += 1) cards.push(card(n));
    picker.innerHTML = `<div class="sv-picker"><h1>Choose a save</h1><div class="sv-slots">${cards.join('')}</div></div>`;
    const focus = pickerState.naming
      ? picker.querySelector(`[data-slot-name-input="${pickerState.naming}"]`)
      : pickerState.deleting
        ? picker.querySelector(`[data-slot-delete-confirm="${pickerState.deleting}"]`)
        : picker.querySelector('.sv-card.is-current [data-slot-continue]') ?? picker.querySelector('[data-slot-continue],[data-slot-new]');
    focus?.focus();
    if (focus?.select) focus.select();
  }

  function finishPick(choice) {
    picker.hidden = true;
    emit('slot_selected', { slot: choice.slot, isNew: choice.isNew });
    const r = resolvePick;
    resolvePick = null;
    r?.(choice);
  }

  picker.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.slotContinue) finishPick({ slot: Number(d.slotContinue), isNew: false });
    else if (d.slotNew) {
      pickerState = { deleting: null, naming: Number(d.slotNew) };
      paintPicker();
    } else if (d.slotNewCancel) {
      pickerState = { deleting: null, naming: null };
      paintPicker();
    } else if (d.slotDelete) {
      pickerState = { deleting: Number(d.slotDelete), naming: null };
      emit('slot_delete_requested', { slot: Number(d.slotDelete) });
      paintPicker();
    } else if (d.slotDeleteCancel) {
      pickerState = { deleting: null, naming: null };
      paintPicker();
    } else if (d.slotDeleteConfirm) {
      const n = Number(d.slotDeleteConfirm);
      if (autosave.slot === n) autosave.setSlot(null);
      await store.remove(n);
      pickerState = { deleting: null, naming: null };
      emit('slot_deleted', { slot: n });
      paintPicker();
    }
  });
  picker.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target.closest('[data-slot-new-form]');
    if (!form) return;
    const n = Number(form.dataset.slotNewForm);
    const input = form.querySelector('input');
    const name = cleanSlotName(input.value) || defaultSlotName(meta(), n);
    pickerState = { deleting: null, naming: null };
    finishPick({ slot: n, isNew: true, name });
  });
  picker.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (pickerState.deleting || pickerState.naming)) {
      pickerState = { deleting: null, naming: null };
      paintPicker();
    }
  });

  /** Always shown after Click to play (Luke), even with one filled slot. */
  function showPicker() {
    pickerState = { deleting: null, naming: null };
    picker.hidden = false;
    paintPicker();
    return new Promise((resolve) => {
      resolvePick = resolve;
    });
  }

  /* ---------------- applying a choice ---------------- */
  async function loadSlotInto(slot) {
    const data = await store.read(slot);
    if (!data) return false;
    const ok = keepSharedSettings(state, () => applySlotData(state, data, nowSeconds()));
    if (ok) {
      state.shopName = meta().slots[String(slot)]?.name ?? data.shopName ?? state.shopName;
      autosave.setSlot(slot, data);
    }
    return ok;
  }

  async function startNew(slot, name) {
    state.shopName = name;
    autosave.setSlot(slot);
    await autosave.save('manual');
    await store.rename(slot, name);
  }

  /* ---------------- top bar + #saves-dock ---------------- */
  const btn = document.querySelector('#saves-btn');
  const dock = document.querySelector('#saves-dock');
  const nameInput = dock?.querySelector('[data-saves-name]');

  function paintDock() {
    if (!dock) return;
    const n = autosave.slot;
    const s = meta().slots[String(n)];
    dock.querySelector('[data-saves-title]').textContent = n ? `Slot ${n} · ${s?.name ?? activeName() ?? ''}` : 'No slot';
    dock.querySelector('[data-saves-stats]').textContent = `Shop Level ${s?.shopLevel ?? 1} · ${formatPlaytime(s?.playTime ?? state.playTime)} played`;
    dock.querySelector('[data-saves-last]').textContent = formatAgo(s?.savedAt);
    if (nameInput && document.activeElement !== nameInput) nameInput.value = s?.name ?? '';
    const note = document.querySelector('[data-save-files-note]');
    if (note) note.textContent = `Back up or move a shop between browsers. Export saves the current slot${n ? ` (Slot ${n})` : ''}.`;
  }

  function openDock() {
    if (!dock || guest) return;
    for (const el of document.querySelectorAll('.expand-dock:not(#saves-dock)')) el.hidden = true;
    paintDock();
    dock.hidden = false;
    btn?.classList.add('is-active');
    btn?.setAttribute('aria-expanded', 'true');
    emit('saves_opened');
  }
  function closeDock() {
    if (!dock) return;
    dock.hidden = true;
    btn?.classList.remove('is-active');
    btn?.setAttribute('aria-expanded', 'false');
  }
  btn?.addEventListener('click', () => (dock?.hidden === false ? closeDock() : openDock()));
  dock?.querySelector('[data-saves-close]')?.addEventListener('click', closeDock);
  dock?.querySelector('[data-saves-now]')?.addEventListener('click', () => {
    emit('save_now');
    autosave.save('manual');
  });
  nameInput?.addEventListener('change', async () => {
    const n = autosave.slot;
    const name = cleanSlotName(nameInput.value);
    if (!n || !name) {
      paintDock();
      return;
    }
    state.shopName = name;
    await store.rename(n, name);
    emit('slot_renamed', { slot: n, name });
    paintDock();
  });
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  dock?.querySelector('[data-saves-switch]')?.addEventListener('click', async () => {
    const from = autosave.slot;
    emit('slot_switch', { from });
    await autosave.save('switch');
    closeDock();
    autosave.stop();
    const choice = await showPicker();
    if (!choice.isNew && choice.slot === autosave.slot) {
      autosave.start();
      return;
    }
    reloadInto(choice);
  });

  /* ---------------- Settings → Save files ---------------- */
  const settings = document.querySelector('[data-settings-saves]');
  async function exportCurrent() {
    const n = autosave.slot ?? 1;
    const lv = meta().slots[String(n)]?.shopLevel ?? state.shopLevel ?? 1;
    try {
      if (await saveStateToFile(state, exportFileName(n, lv))) {
        emit('export', { slot: n });
        log('Save exported to a file.');
      }
    } catch {
      log('Could not export that save.');
    }
  }
  settings?.querySelector('[data-save-export]')?.addEventListener('click', () => {
    if (!guest) exportCurrent();
  });
  settings?.querySelector('[data-save-import]')?.addEventListener('click', async () => {
    if (guest) return;
    emit('import_started');
    let file;
    try {
      file = await pickSaveFile();
    } catch {
      file = null;
      emit('import_error', { reason: 'invalid' });
      log('That file is not a shop save.');
      return;
    }
    if (!file) {
      emit('import_error', { reason: 'cancelled' });
      return;
    }
    openImport(file.name, file.text);
  });

  /* ---------------- #import-dialog ---------------- */
  const scrim = document.createElement('div');
  scrim.className = 'sv-scrim';
  scrim.hidden = true;
  const modal = document.createElement('div');
  modal.className = 'sv-modal';
  modal.hidden = true;
  document.body.append(scrim, modal);
  let pending = null;

  function closeImport(cancelled) {
    if (cancelled && pending) emit('import_error', { reason: 'cancelled' });
    pending = null;
    modal.hidden = true;
    scrim.hidden = true;
    modal.removeAttribute('id');
  }

  /** Exposed for tests: open the import dialog for given file text. */
  function openImport(fileName, text) {
    const v = validateImport(text, makeState);
    if (!v.ok) {
      emit('import_error', { reason: 'invalid' });
      log('That file is not a shop save.');
      return false;
    }
    pending = { fileName, ...v, slot: defaultImportSlot(meta(), autosave.slot) };
    paintImportPick();
    return true;
  }

  function paintImportPick() {
    modal.id = 'import-dialog';
    modal.setAttribute('role', 'dialog');
    const rows = [];
    for (let n = 1; n <= SLOT_COUNT; n += 1) {
      const s = meta().slots[String(n)];
      rows.push(`<button type="button" class="${pending.slot === n ? 'is-on' : ''}" data-import-slot="${n}">Slot ${n}${s ? ` · ${esc(s.name)}` : ''} <small>${s ? `Lv ${s.shopLevel}` : 'Empty'}</small></button>`);
    }
    modal.innerHTML = `<h2>Import save file</h2><p>${esc(pending.fileName)} · Shop Level ${pending.shopLevel}. Which slot should it go into?</p>
      <div class="sv-pick">${rows.join('')}</div>
      <div class="sv-row"><button type="button" class="sv-ghost" data-import-cancel style="flex:1">Cancel</button><button type="button" class="sv-primary" data-import-go>Import</button></div>`;
    modal.hidden = false;
    scrim.hidden = false;
    modal.querySelector('.is-on')?.focus();
  }

  function paintImportConfirm() {
    const s = meta().slots[String(pending.slot)];
    modal.id = 'import-dialog';
    modal.setAttribute('role', 'alertdialog');
    modal.innerHTML = `<h2>Overwrite Slot ${pending.slot} (Shop Lv ${s.shopLevel})?</h2><p>${esc(s.name)} will be replaced by the imported shop (Lv ${pending.shopLevel}). This can't be undone. Export it first if you want a backup.</p>
      <div class="sv-row"><button type="button" class="sv-ghost" data-import-cancel style="flex:1">Cancel</button><button type="button" class="sv-ghost sv-danger sv-solid" style="flex:1" data-import-confirm>Overwrite</button></div>`;
    modal.querySelector('[data-import-cancel]')?.focus();
  }

  async function doImport() {
    const { slot, data, version } = pending;
    const prev = meta().slots[String(slot)];
    const overwrote = Boolean(prev);
    const name = cleanSlotName(data.shopName) || defaultSlotName(meta(), slot);
    data.shopName = name;
    try {
      await store.write(slot, data, name);
    } catch (err) {
      emit('save_error', { slot, reason: err?.name === 'QuotaExceededError' ? 'quota' : 'unknown' });
      closeImport(false);
      return;
    }
    emit('import', { slot, overwrote, version });
    const active = slot === autosave.slot;
    closeImport(false);
    log(`Imported into Slot ${slot}.`);
    // Importing into the active slot reloads the game (SPEC).
    if (active) reloadInto({ slot, isNew: false });
  }

  modal.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !pending) return;
    if (t.dataset.importSlot) {
      pending.slot = Number(t.dataset.importSlot);
      paintImportPick();
    } else if ('importCancel' in t.dataset) closeImport(true);
    else if ('importGo' in t.dataset) {
      if (meta().slots[String(pending.slot)]) paintImportConfirm();
      else doImport();
    } else if ('importConfirm' in t.dataset) doImport();
  });
  scrim.addEventListener('click', () => closeImport(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeImport(true);
  });

  /* ---------------- triggers ---------------- */
  document.addEventListener('rc-save-trigger', (e) => autosave.save(e.detail?.trigger ?? 'quest'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.save('hidden');
  });
  window.addEventListener('pagehide', () => autosave.saveSync('close'));
  window.addEventListener('beforeunload', () => autosave.saveSync('close'));

  /* ---------------- co-op (SPEC section 5) ---------------- */
  document.addEventListener('rc-party', (e) => {
    guest = Boolean(e.detail?.guest);
    autosave.setGuest(guest);
    if (btn) {
      btn.disabled = guest;
      btn.title = guest ? "Your saves aren't touched while visiting" : 'Saves';
    }
    for (const b of settings?.querySelectorAll('button') ?? []) b.disabled = guest;
    if (guest) closeDock();
  });

  return {
    events,
    emit,
    showPicker,
    loadSlotInto,
    startNew,
    openImport,
    paintStatus,
    paintDock,
    openDock,
    closeDock,
    get guest() {
      return guest;
    },
  };
}
