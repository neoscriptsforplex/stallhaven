/**
 * Online saves + backup file UI (Youi's cloud save SPEC).
 * Settings ⚙ → "Save files" row → #savefiles-dock (Online backup, Backup file, Move a save),
 * picker footer pill + sign-in modal, sync badges, conflict prompt, toasts.
 *
 * The online parts render only when a cloud client is passed (VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY set). The backup file and Move a save always work.
 */
import { BOOT_SLOT_KEY } from '../game/saveUi.js';
import { formatPlaytime } from '../game/saveSlots.js';
import { needsReminder } from './autobackup.js';

const I = {
  cloud: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 9.5a4.8 4.8 0 0 1-.5 9.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5h18v11H3zM8 18h8v2H8z"/><rect x="5" y="7" width="14" height="7" fill="#2a1a10"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5L23 21H1zM11 9v6h2V9zm0 8v2h2v-2z"/></svg>',
  mail: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="38" height="27" rx="3"/><path d="M6 13l18 14 18-14"/></svg>',
};
const WARN16 = I.warn.replace('<svg', '<svg width="16" height="16" style="flex:none"');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_S = 60;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function badgeHtml(status, slot) {
  if (status === 'synced') return `<span class="cs-badge is-synced" data-sync="synced">${I.check}Synced</span>`;
  if (status === 'syncing') return `<span class="cs-badge is-syncing" data-sync="syncing"><i class="sv-spin"></i>Syncing…</span>`;
  if (status === 'conflict') return `<button type="button" class="cs-badge is-conflict" data-sync="conflict" data-cloud-conflict-open="${slot}">${I.warn}Conflict</button>`;
  return `<span class="cs-badge is-local" data-sync="local">${I.device}Only on this device</span>`;
}

/** "Today, 5:48 pm" / "Fri 16 Oct, 9:14 pm" in the player's zone. */
export function formatSavedAt(ms, nowMs = Date.now()) {
  if (!ms) return '—';
  const d = new Date(ms);
  const n = new Date(nowMs);
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
  if (d.toDateString() === n.toDateString()) return `Today, ${time}`;
  const y = new Date(nowMs - 86_400_000);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  const day = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  return `${day}, ${time}`;
}

export function relTime(ms, nowMs = Date.now()) {
  if (!ms) return 'never';
  const m = Math.round((nowMs - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function deviceLabel(ua = globalThis.navigator?.userAgent ?? '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  return `${os} · ${browser}`;
}

export function mountCloud({ saves, store, autosave, sync, client, backup, emit, isLive = () => false }) {
  const online = Boolean(sync && client);
  const ui = {
    view: online && sync.signedIn ? 'signed-in' : 'signed-out',
    error: null,
    email: '',
    resendAt: 0,
    rateUntil: 0,
    sending: false,
    toastTimer: null,
    guest: false,
  };
  const isOffline = () => (typeof navigator !== 'undefined' && navigator.onLine === false) || sync?.offline;

  /* ---------------- Settings entry + #savefiles-dock ---------------- */
  const settingsDock = document.querySelector('#settings-dock');
  const entry = document.querySelector('[data-settings-saves-open]');
  const dock = document.querySelector('#savefiles-dock');
  const cloudSec = dock?.querySelector('[data-cloud-section]');
  const backupBody = dock?.querySelector('[data-autobackup-body]');
  if (cloudSec) cloudSec.hidden = !online;

  function paintSummary() {
    const el = entry?.querySelector('[data-savefiles-summary]');
    if (!el) return;
    if (!online) el.textContent = 'Import, export, backup file';
    else if (sync.signedIn) el.textContent = `Backed up as ${sync.email ?? 'you'} · Import, export`;
    else el.textContent = 'Online backup off · Import, export, backup file';
  }

  function openDock() {
    if (!dock) return;
    if (settingsDock) settingsDock.hidden = true;
    paintAll();
    dock.hidden = false;
    document.querySelector('#settings-btn')?.classList.add('is-active');
  }
  function closeDock(back = false) {
    if (!dock) return;
    dock.hidden = true;
    if (back) {
      document.querySelector('#settings-btn')?.click();
    } else document.querySelector('#settings-btn')?.classList.remove('is-active');
  }
  entry?.addEventListener('click', openDock);
  dock?.querySelector('[data-savefiles-back]')?.addEventListener('click', () => closeDock(true));
  dock?.querySelector('[data-savefiles-close]')?.addEventListener('click', () => closeDock(false));
  document.querySelector('#settings-btn')?.addEventListener('click', () => {
    if (dock && !dock.hidden) dock.hidden = true;
    // Settings and the Saves panel share the same corner; only one is open at a time.
    const savesDock = document.querySelector('#saves-dock');
    if (savesDock && !savesDock.hidden) document.querySelector('[data-saves-close]')?.click();
  }, true);

  /* ---------------- online backup block ---------------- */
  const blocks = new Set(); // containers showing the cloud block (dock + picker modal)
  if (cloudSec) blocks.add(cloudSec);

  function emailField(bad) {
    return `<label class="cs-field${bad ? ' is-bad' : ''}">Email
      <input type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" value="${esc(ui.email)}" data-cloud-email ${bad ? 'aria-invalid="true" aria-describedby="cs-email-err"' : ''} />
      ${bad ? '<span class="cs-field-err" id="cs-email-err">That doesn\'t look like an email. Check for typos.</span>' : ''}
    </label>`;
  }
  const privacy = '<p class="cs-privacy" data-cloud-privacy>We only use your email to sign in and keep your saves.</p>';
  const head = `<h3>${I.cloud}Online backup</h3>`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function cloudHtml() {
    if (ui.guest) {
      return `${head}<div class="cs-note is-warn" data-cloud-paused>${WARN16}<span><b>Paused while visiting.</b> Your saves sync again when you leave the party.</span></div>`;
    }
    if (ui.view === 'signed-in') {
      const email = sync.email ?? '';
      const conflicts = sync.conflictSlots().length;
      const line = isOffline()
        ? '<span class="cs-sync is-off" data-cloud-last>Offline · will sync when you\'re back</span>'
        : conflicts
          ? `<span class="cs-sync is-off" data-cloud-last>⚠ ${conflicts === 1 ? `Slot ${sync.conflictSlots()[0]} needs a choice` : `${conflicts} slots need a choice`}</span>`
          : `<span class="cs-sync" data-cloud-last>✓ All 3 slots synced · ${relTime(sync.lastSyncAt)}</span>`;
      return `${head}<div class="cs-acct" data-cloud-state="signed-in"><span class="cs-ava">${esc((email[0] ?? '?').toUpperCase())}</span><span class="cs-email" title="${esc(email)}">${esc(email)}</span>${line}</div>
        <div class="cs-row"><button type="button" class="sv-ghost" data-cloud-sync-now>Sync now</button><button type="button" class="sv-ghost" data-cloud-signout>Sign out</button></div>
        <label class="cs-check"><input type="checkbox" data-cloud-signout-remove /> Also remove saves from this device</label>
        <p class="cs-help" style="margin-top:6px">Signing out keeps your saves on this device.</p>`;
    }
    if (ui.view === 'link-sent') {
      const left = Math.max(0, Math.ceil((ui.resendAt - Date.now()) / 1000));
      const codeErr = ui.error === 'code' || ui.error === 'expired-code'
        ? `<div class="cs-note is-err" role="alert" data-cloud-error="code">${WARN16}<span>${ui.error === 'code' ? '<b>That code didn\'t work.</b> Check the 6 digits and try again.' : '<b>That code has expired or was already used.</b> Send a new link.'}</span></div>` : '';
      return `<div class="cs-sent" data-cloud-state="link-sent"><div class="cs-env">${I.mail}</div><h3>Check your email</h3>
        <p class="cs-p">We sent a login link to <b>${esc(ui.email)}</b>. Open it on this device to sign in. It works once and expires in 1 hour.</p>
        ${codeErr}
        <p class="cs-or">Opened it on another device? Type the 6-digit code instead.</p>
        <div class="cs-code" data-cloud-code>${'<input inputmode="numeric" autocomplete="one-time-code" maxlength="1" aria-label="Code digit" />'.repeat(6)}</div>
        <div class="cs-row"><button type="button" class="sv-ghost" data-cloud-resend ${left ? 'disabled' : ''}>${left ? `Resend in ${mmss(left)}` : 'Resend'}</button><button type="button" class="sv-ghost" data-cloud-change>Use another email</button></div></div>`;
    }
    // signed out (+ sending / errors)
    const e = ui.error;
    const rateLeft = Math.max(0, Math.ceil((ui.rateUntil - Date.now()) / 1000));
    const off = e === 'offline' && isOffline();
    let note = '';
    if (off) note = `<div class="cs-note is-warn" role="alert" data-cloud-error="offline">${WARN16}<span><b>You're offline.</b> Connect to the internet, then send the link again.</span></div>`;
    else if (e === 'rate' && rateLeft) note = `<div class="cs-note is-err" role="alert" data-cloud-error="rate">${WARN16}<span><b>Too many tries.</b> Wait a few minutes before asking for another link.</span></div>`;
    else if (e === 'expired') note = `<div class="cs-note is-err" role="alert" data-cloud-error="expired">${WARN16}<span><b>That login link has expired or was already used.</b> Send a new one.</span></div>`;
    else if (e === 'unknown') note = `<div class="cs-note is-err" role="alert" data-cloud-error="unknown">${WARN16}<span><b>Couldn't send the link.</b> Try again in a moment.</span></div>`;
    const label = ui.sending ? '<i class="sv-spin"></i> Sending…' : e === 'rate' && rateLeft ? `Try again in ${mmss(rateLeft)}` : e === 'expired' ? 'Send a new link' : 'Send login link';
    const disabled = ui.sending || off || (e === 'rate' && rateLeft > 0);
    return `${head}${note}${note ? '' : '<p class="cs-p">Sign in with your email to back up all 3 slots and play on any device. No password needed.</p>'}
      <form data-cloud-form novalidate>${emailField(e === 'email')}<button type="submit" class="sv-primary" data-cloud-send ${disabled ? 'disabled' : ''}>${label}</button></form>${privacy}`;
  }

  function paintCloud() {
    if (!online) return;
    const html = cloudHtml();
    const state = ui.guest ? 'paused' : ui.view === 'signed-out' && ui.error ? `error-${ui.error}` : ui.sending ? 'sending' : ui.view;
    for (const el of blocks) {
      const focused = el.contains(document.activeElement) ? document.activeElement : null;
      const caret = focused?.matches?.('[data-cloud-email]') ? focused.selectionStart : null;
      el.innerHTML = html;
      el.dataset.cloudState = state;
      if (caret != null) {
        const i = el.querySelector('[data-cloud-email]');
        i?.focus();
        try {
          i?.setSelectionRange(caret, caret);
        } catch {
          /* type=email has no selection API in some browsers */
        }
      }
    }
    if (dock) dock.dataset.cloudState = state;
  }

  function paintBackup() {
    if (!backupBody || !backup) return;
    if (backup.supported) {
      const on = backup.on;
      backupBody.innerHTML = `<label class="cs-toggle"><span>Auto-backup to a file</span><input type="checkbox" data-autobackup ${on ? 'checked' : ''} /><span class="cs-sw"></span></label>
        <p class="cs-help">Keeps a copy of all 3 slots in a file on this device, rewritten every time the game autosaves.</p>
        ${on ? `<div class="cs-file"><span>${esc(backup.fileName)}${backup.lastWriteAt ? ` · ${formatSavedAt(backup.lastWriteAt).replace(/^Today, /, '')}` : ''}</span>${backup.needsPermission ? '<button type="button" class="cs-link" data-autobackup-allow>Allow again</button>' : '<button type="button" class="cs-link" data-autobackup-file>Change file</button>'}</div>` : ''}`;
    } else {
      const last = backup.lastDownloadAt();
      backupBody.innerHTML = `<button type="button" class="sv-ghost" data-backup-download style="width:100%">Download a backup</button>
        <p class="cs-help" style="margin-top:6px">This browser can't update a file by itself, so we'll remind you once a week to download a copy of all 3 slots.${last ? ` Last download: ${formatSavedAt(last)}.` : ''}</p>`;
    }
  }

  function paintAll() {
    paintSummary();
    paintCloud();
    paintBackup();
  }

  /* ---------------- actions ---------------- */
  function redirectUrl() {
    return `${location.origin}${location.pathname}`;
  }

  async function sendLink(container) {
    const input = container.querySelector('[data-cloud-email]');
    ui.email = (input?.value ?? ui.email).trim();
    if (!EMAIL_RE.test(ui.email)) {
      ui.error = 'email';
      emit('cloud_link_error', { reason: 'email' });
      paintCloud();
      container.querySelector('[data-cloud-email]')?.focus();
      return;
    }
    if (isOffline()) {
      ui.error = 'offline';
      emit('cloud_link_error', { reason: 'offline' });
      paintCloud();
      return;
    }
    ui.sending = true;
    ui.error = null;
    emit('cloud_link_requested');
    paintCloud();
    const res = await client.requestLink(ui.email, redirectUrl());
    ui.sending = false;
    if (res.ok) {
      ui.view = 'link-sent';
      ui.resendAt = Date.now() + RESEND_S * 1000;
      emit('cloud_link_sent');
      paintCloud();
      [...blocks].at(-1)?.querySelector('[data-cloud-code] input')?.focus();
      return;
    }
    ui.view = 'signed-out';
    ui.error = res.reason;
    if (res.reason === 'rate') ui.rateUntil = Date.now() + (res.retryAfter ?? 300) * 1000;
    emit('cloud_link_error', { reason: res.reason });
    paintCloud();
  }

  async function verify(code) {
    const res = await client.verifyCode(ui.email, code);
    if (res.ok) {
      await afterSignIn();
      return;
    }
    ui.error = res.reason === 'expired' ? 'expired-code' : 'code';
    paintCloud();
    [...blocks].at(-1)?.querySelector('[data-cloud-code] input')?.focus();
  }

  async function afterSignIn() {
    ui.view = 'signed-in';
    ui.error = null;
    emit('cloud_signed_in', { email: sync.email });
    closeModal();
    toast('Signed in. Backing up your saves…');
    paintAll();
    await sync.pull();
    paintAll();
    saves.repaintPicker();
  }

  async function signOut(removeLocal) {
    await sync.signOut({ removeLocal });
    ui.view = 'signed-out';
    ui.error = null;
    paintAll();
    saves.repaintPicker();
    if (removeLocal) {
      autosave.setSlot(null);
      location.reload();
    }
  }

  function onBlockClick(e) {
    const container = e.currentTarget;
    const t = e.target.closest('button');
    if (!t) return;
    if ('cloudResend' in t.dataset) {
      ui.view = 'signed-out';
      sendLink(container);
    } else if ('cloudChange' in t.dataset) {
      ui.view = 'signed-out';
      ui.error = null;
      paintCloud();
      container.querySelector('[data-cloud-email]')?.focus();
    } else if ('cloudSyncNow' in t.dataset) {
      sync.pull().then(() => {
        paintAll();
        saves.repaintPicker();
      });
      t.textContent = 'Syncing…';
    } else if ('cloudSignout' in t.dataset) {
      signOut(Boolean(container.querySelector('[data-cloud-signout-remove]')?.checked));
    }
  }
  function onBlockSubmit(e) {
    e.preventDefault();
    if (e.target.matches('[data-cloud-form]')) sendLink(e.currentTarget);
  }
  function onBlockInput(e) {
    const box = e.target.closest('[data-cloud-code]');
    if (!box) return;
    const inputs = [...box.querySelectorAll('input')];
    const i = inputs.indexOf(e.target);
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 1) {
      // Pasted the whole code.
      digits.slice(0, 6).split('').forEach((d, k) => { if (inputs[k]) inputs[k].value = d; });
    } else {
      e.target.value = digits;
      if (digits && inputs[i + 1]) inputs[i + 1].focus();
    }
    const code = inputs.map((x) => x.value).join('');
    if (/^\d{6}$/.test(code)) verify(code);
  }
  function onBlockKey(e) {
    if (e.key === 'Backspace' && e.target.closest('[data-cloud-code]') && !e.target.value) {
      e.target.previousElementSibling?.focus();
    }
  }
  function wire(el) {
    el.addEventListener('click', onBlockClick);
    el.addEventListener('submit', onBlockSubmit);
    el.addEventListener('input', onBlockInput);
    el.addEventListener('keydown', onBlockKey);
  }
  if (online && cloudSec) wire(cloudSec);

  backupBody?.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-autobackup]')) return;
    if (e.target.checked) {
      try {
        await backup.enable();
      } catch {
        /* picker cancelled */
      }
    } else backup.disable();
    paintBackup();
  });
  backupBody?.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if ('autobackupFile' in t.dataset) {
      try {
        await backup.changeFile();
      } catch {
        /* cancelled */
      }
    } else if ('autobackupAllow' in t.dataset) await backup.write();
    else if ('backupDownload' in t.dataset) await backup.download();
    paintBackup();
  });

  /* ---------------- toast ---------------- */
  function toast(text, action) {
    document.querySelector('.cs-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'cs-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `${I.check.replace('<svg', '<svg width="14" height="14"')}<span>${esc(text)}</span>${action ? `<button type="button" class="cs-link" data-toast-action>${esc(action.label)}</button>` : ''}`;
    document.body.appendChild(el);
    if (action) el.querySelector('[data-toast-action]').addEventListener('click', () => { action.run(); el.remove(); });
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => el.remove(), action ? 12000 : 4000);
  }

  /* ---------------- picker: footer pill, badges, conflict lock ---------------- */
  let modal = null;
  let scrim = null;
  function closeModal() {
    if (modal) blocks.delete(modal.querySelector('.cs-sec'));
    modal?.remove();
    scrim?.remove();
    modal = null;
    scrim = null;
  }
  function openModal(html, { onClose } = {}) {
    closeModal();
    scrim = document.createElement('div');
    scrim.className = 'cs-scrim';
    modal = document.createElement('div');
    modal.innerHTML = html;
    modal = modal.firstElementChild;
    document.body.append(scrim, modal);
    const close = () => {
      closeModal();
      onClose?.();
    };
    scrim.addEventListener('click', close);
    modal.querySelector('.cs-x')?.addEventListener('click', close);
    return modal;
  }

  function openSignInModal() {
    const m = openModal(`<div class="cs-modal" role="dialog" aria-label="Back up online"><h2>Back up online</h2><button type="button" class="cs-x" aria-label="Close">✕</button><section class="cs-sec"></section></div>`);
    const sec = m.querySelector('.cs-sec');
    blocks.add(sec);
    wire(sec);
    paintCloud();
    sec.querySelector('[data-cloud-email]')?.focus();
  }

  function openConflict(slot) {
    const c = sync.conflict(slot);
    if (!c) return;
    const local = store.meta.slots[String(slot)];
    const cloud = c.cloud;
    const localAt = local?.savedAt ?? 0;
    const cloudAt = cloud ? Date.parse(cloud.updated_at) : 0;
    const newer = cloudAt > localAt ? 'cloud' : 'local';
    const empty = [1, 2, 3].find((n) => !store.meta.slots[String(n)]);
    const name = local?.name ?? cloud?.name ?? `Slot ${slot}`;
    const side = (who) => {
      const isCloud = who === 'cloud';
      const lv = isCloud ? cloud?.level : local?.shopLevel;
      const pt = isCloud ? cloud?.playtime : local?.playTime;
      const at = isCloud ? cloudAt : localAt;
      const from = isCloud ? (cloud ? `From ${esc(cloud.device_label || 'another device')}` : 'Deleted on another device') : 'This browser';
      return `<div class="cs-side${newer === who ? ' is-newer' : ''}">${newer === who ? '<span class="cs-tag">Newer</span>' : ''}<h4>${isCloud ? I.cloud : I.device}${isCloud ? 'Cloud' : 'This device'}</h4>
        <dl><dt>Shop Level</dt><dd>${cloud || !isCloud ? lv ?? 1 : '—'}</dd><dt>Playtime</dt><dd>${cloud || !isCloud ? formatPlaytime(pt) : '—'}</dd><dt>Saved</dt><dd>${formatSavedAt(at)}</dd></dl>
        <span class="cs-from">${from}</span><button type="button" class="sv-primary" data-conflict-keep="${who}">${isCloud ? 'Keep cloud' : 'Keep this device'}</button></div>`;
    };
    const both = empty && cloud
      ? `<button type="button" class="sv-ghost cs-both" data-conflict-keep="both">Keep both · cloud copy goes to Slot ${empty}</button>`
      : '<button type="button" class="sv-ghost cs-both" data-conflict-keep="both" disabled>Keep both (needs an empty slot)</button>';
    const m = openModal(`<div class="cs-modal cs-conflict" role="alertdialog" aria-labelledby="cs-cf-h" data-cloud-conflict="${slot}">
      <h2 id="cs-cf-h">Slot ${slot} doesn't match</h2><button type="button" class="cs-x" aria-label="Decide later">✕</button>
      <p class="cs-p"><b style="word-break:normal">${esc(name)}</b> was played on another device too. Which one do you want to keep?</p>
      <div class="cs-vs">${side('local')}${side('cloud')}</div>${both}
      <p class="cs-fine">The one you don't keep is deleted. ✕ decides later; Slot ${slot} won't sync until you choose.</p></div>`);
    m.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-conflict-keep]');
      if (!t || t.disabled) return;
      const choice = t.dataset.conflictKeep;
      m.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      const res = await sync.resolve(slot, choice);
      closeModal();
      paintAll();
      saves.repaintPicker();
      saves.paintDock?.();
      if (res.ok && choice === 'cloud' && isLive(slot)) {
        // The running shop was replaced by the cloud copy: reload into it.
        try {
          sessionStorage.setItem(BOOT_SLOT_KEY, JSON.stringify({ slot, isNew: false }));
        } catch {
          /* ignore */
        }
        autosave.setSlot(null);
        location.reload();
      }
    });
    m.querySelector('[data-conflict-keep].is-newer, .cs-side.is-newer [data-conflict-keep]')?.focus();
  }

  let pulling = null;
  document.addEventListener('rc-picker-painted', (e) => {
    const root = e.detail.root;
    if (!online) return;
    for (const card of root.querySelectorAll('.sv-card[data-slot]:not(.is-empty)')) {
      const slot = Number(card.dataset.slot);
      const st = sync.status(slot);
      const when = card.querySelector('.sv-when');
      if (when && !when.parentElement.classList.contains('cs-meta')) {
        const meta = document.createElement('div');
        meta.className = 'cs-meta';
        when.replaceWith(meta);
        meta.append(when);
        meta.insertAdjacentHTML('beforeend', badgeHtml(st, slot));
      }
      if (st === 'conflict') {
        card.classList.add('is-conflict');
        const cont = card.querySelector('[data-slot-continue]');
        if (cont) cont.textContent = 'Choose version';
      }
    }
    const foot = document.createElement('div');
    foot.className = 'cs-picker-foot';
    foot.dataset.cloudPicker = '';
    foot.innerHTML = sync.signedIn
      ? `${I.cloud}<span>Backed up as ${esc(sync.email ?? '')}</span><button type="button" class="cs-link" data-cloud-open>Manage</button>`
      : `${I.cloud}<button type="button" class="cs-link" data-cloud-open>Back up online</button><span>· play on any device</span>`;
    root.querySelector('.sv-picker')?.append(foot);
  });

  const pickerEl = document.querySelector('#slot-picker');
  pickerEl?.addEventListener('click', async (e) => {
    if (!online) return;
    const openBtn = e.target.closest('[data-cloud-open]');
    if (openBtn) {
      e.stopPropagation();
      if (sync.signedIn) {
        // Manage: show the signed-in block in the same modal.
        openSignInModal();
      } else openSignInModal();
      return;
    }
    const badge = e.target.closest('[data-cloud-conflict-open]');
    if (badge) {
      e.stopPropagation();
      openConflict(Number(badge.dataset.cloudConflictOpen));
      return;
    }
    const cont = e.target.closest('[data-slot-continue]');
    if (!cont) return;
    const slot = Number(cont.dataset.slotContinue);
    if (sync.status(slot) === 'conflict') {
      e.stopPropagation();
      openConflict(slot);
      return;
    }
    if (pulling && !cont.dataset.cloudWaited) {
      // Let the startup pull finish so we don't load a copy that is about to change.
      e.stopPropagation();
      cont.textContent = 'Syncing…';
      await pulling;
      saves.repaintPicker();
      const again = pickerEl.querySelector(`[data-slot-continue="${slot}"]`);
      if (again && sync.status(slot) !== 'conflict') {
        again.dataset.cloudWaited = '1';
        again.click();
      }
    }
  }, true);

  /* ---------------- Saves panel sync line ---------------- */
  function paintSavesDock() {
    const info = document.querySelector('#saves-dock .sv-panel-info');
    if (!info) return;
    info.querySelector('.cs-saves-sync')?.remove();
    const meta = document.querySelector('#saves-dock .sv-panel-info + .sv-stack + .meta, #saves-dock > p.meta');
    if (meta) meta.textContent = 'Online backup, import and export are in Settings ⚙ → Save files.';
    if (!online) return;
    const slot = autosave.slot;
    if (!slot) return;
    const st = sync.status(slot);
    const s = sync.syncInfo(slot);
    const line = !sync.signedIn ? 'Online backup off' : st === 'synced' && s ? `Cloud · ${relTime(sync.lastSyncAt)}` : st === 'conflict' ? 'Choose which version to keep' : isOffline() ? 'Waiting to sync' : 'Cloud';
    info.insertAdjacentHTML('beforeend', `<div class="cs-saves-sync">${badgeHtml(st, slot)}<span style="font-size:.74rem;opacity:.8">${line}</span></div>`);
    info.querySelector('[data-cloud-conflict-open]')?.addEventListener('click', () => openConflict(slot));
  }

  /* ---------------- wiring to the game ---------------- */
  document.addEventListener('rc-save', (e) => {
    const { type, slot } = e.detail ?? {};
    if (type === 'save_ok') {
      if (online) sync.markDirty(slot).then(() => { paintSavesDock(); paintCloud(); });
      if (backup?.on) backup.write().then(() => { if (dock && !dock.hidden) paintBackup(); });
    } else if (type === 'slot_deleted') {
      if (online) sync.markDeleted(slot);
    } else if (type === 'saves_opened') paintSavesDock();
    else if (type === 'cloud_status' || type === 'cloud_conflict' || type === 'cloud_offline') {
      paintSavesDock();
      saves.repaintPicker();
      if (dock && !dock.hidden) paintCloud();
    } else if (type === 'cloud_signed_out' && e.detail.reason === 'expired') {
      ui.view = 'signed-out';
      paintAll();
    }
  });
  window.addEventListener('online', () => {
    if (ui.error === 'offline') ui.error = null;
    paintCloud();
    if (online && sync.signedIn) sync.pull().then(() => { paintAll(); saves.repaintPicker(); });
  });
  window.addEventListener('offline', () => paintCloud());
  document.addEventListener('rc-party', (e) => {
    ui.guest = Boolean(e.detail?.guest);
    sync?.setPaused(ui.guest);
    paintCloud();
    if (!ui.guest && online && sync.signedIn) sync.flush();
  });
  // Relative times and countdowns.
  setInterval(() => {
    if (dock && !dock.hidden) paintCloud();
    else if (modal && (ui.view === 'link-sent' || ui.error === 'rate')) paintCloud();
  }, 1000 * 15);
  setInterval(() => {
    if ((ui.view === 'link-sent' && ui.resendAt > Date.now() - 1000) || (ui.error === 'rate' && ui.rateUntil > Date.now() - 1000)) {
      const anyFocus = [...blocks].some((b) => b.contains(document.activeElement) && document.activeElement.matches('input'));
      if (!anyFocus) paintCloud();
    }
  }, 1000);

  /* ---------------- boot ---------------- */
  async function start(href = location.href) {
    paintAll();
    if (!online) return;
    const fromUrl = await client.sessionFromUrl(href).catch(() => null);
    if (fromUrl) {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        /* ignore */
      }
    }
    if (fromUrl?.error) {
      ui.view = 'signed-out';
      ui.error = 'expired';
      emit('cloud_link_error', { reason: 'expired' });
      paintAll();
      return { expired: true };
    }
    if (fromUrl?.session) {
      ui.view = 'signed-in';
      emit('cloud_signed_in', { email: sync.email, via: 'link' });
      toast('Signed in. Backing up your saves…');
    }
    if (sync.signedIn) {
      pulling = sync.pull().finally(() => {
        pulling = null;
        paintAll();
        saves.repaintPicker();
      });
    }
    return { signedIn: sync.signedIn };
  }

  /** After a slot is chosen: weekly backup reminder where files can't auto-update. */
  function afterPick() {
    if (!backup || backup.supported) return;
    const hasSaves = Object.keys(store.meta.slots).length > 0;
    if (needsReminder({ lastDownloadAt: backup.lastDownloadAt(), hasSaves })) {
      toast("It's been a week since your last backup.", { label: 'Download', run: () => backup.download() });
    }
  }

  return {
    start,
    afterPick,
    openDock,
    openSignInModal,
    openConflict,
    paintAll,
    get pulling() {
      return pulling;
    },
    showExpiredInPicker() {
      openSignInModal();
    },
  };
}
