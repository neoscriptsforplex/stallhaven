/**
 * Co-op UI (SPEC rev 3): #coop-btn after Music, #coop-dock (Invite / Join with code),
 * HUD party panel, toasts, banner, End-party confirm and the ended modal.
 * The network code (net.js) is only loaded when the player hosts or joins.
 */
// coop.css is linked from index.html (the live site serves src/ as plain ES modules, so no CSS imports).
import { CODE_ALPHABET, DEFAULT_NAME, NAME_MAX, RECONNECT_DELAYS } from './protocol.js';

const SWATCH = { red: 'var(--coop-p1)', blue: 'var(--coop-p2)', green: 'var(--coop-p3)', purple: 'var(--coop-p4)' };
const NAME_KEY = 'stallhaven-coop-name';
const MAX_PLAYERS = 4;

const ERRORS = {
  not_found: ['Code not found.', 'Check the letters, or ask the host for a new code.', 'code'],
  room_full: ['Party full (4/4).', 'This party already has 4 players.', 'code'],
  kicked: ['You were removed from this party,', "so you'll need a new code.", 'code'],
  bad_code: ["That code isn't valid.", 'Codes are 6 characters: 2–9 and A–Z, without I or O.', 'code'],
  bad_name: ['Pick another name.', 'Use 1–16 letters, numbers or spaces.', 'name'],
  rate_limited: ['Too many tries.', 'Try again in <span class="coop-timer" data-retry>0s</span>.', 'none'],
  offline: ["Can't reach the co-op server.", 'Check your connection and try again.', 'none'],
};

const ENDS = {
  host_left: ['♛', 'The host left', (h) => `${h} left the party, or didn't reconnect within 2 minutes.`],
  host_ended: ['⌂', 'Party ended', (h) => `${h} ended the party.`],
  kicked: ['⚑', 'You were removed', () => "The host removed you from the party, so you'll need a new code to join again."],
  room_closed: ['⌂', 'Party closed', () => 'The party was closed.'],
  connection_lost: ['⚠', 'Connection lost', () => `We couldn't reconnect after ${RECONNECT_DELAYS.length} tries.`],
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function storedName() {
  try {
    const v = (localStorage.getItem(NAME_KEY) ?? '').trim();
    return v && v.length <= NAME_MAX ? v : DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

const ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8.5" cy="7.5" r="3.3"/><path d="M2 20c0-4 2.9-6.6 6.5-6.6S15 16 15 20z"/><circle cx="16.5" cy="8.5" r="2.8" opacity=".8"/><path d="M15.6 13.7c3.6-.4 6.4 1.9 6.4 6.3h-5.4c0-2.5-.4-4.6-1-6.3z" opacity=".8"/></svg>';

const DOCK_HTML = `
  <header class="skills-head">
    <span class="skills-grip" aria-hidden="true"></span>
    <h2>Co-op</h2>
    <button type="button" class="skills-close" data-coop-close aria-label="Close co-op">✕</button>
  </header>
  <div class="tabs coop-tabs" role="tablist">
    <button type="button" class="tab is-on" data-coop-tab="invite" role="tab">Invite</button>
    <button type="button" class="tab" data-coop-tab="join" role="tab">Join with code</button>
  </div>
  <div class="coop-pane" data-coop-pane="invite-empty">
    <p class="coop-hint">Open your shop to up to 3 friends. You keep playing, and they can drop in any time.</p>
    <label class="coop-label" for="coop-host-name">Your name</label>
    <input id="coop-host-name" class="coop-namein" maxlength="${NAME_MAX}" placeholder="Player" autocomplete="off" />
    <div data-coop-create-errors></div>
    <button type="button" class="coop-primary coop-create" data-coop-create>Create invite code</button>
    <p class="coop-status">Nothing changes until someone joins. You can end the party at any time.</p>
  </div>
  <div class="coop-pane" data-coop-pane="invite" hidden>
    <p class="coop-hint" data-coop-invite-hint>Share this code. Friends open Co-op → Join with code and drop straight into your shop.</p>
    <div class="coop-code-box" data-coop-codebox>
      <span class="coop-code" data-coop-code></span>
      <button type="button" class="coop-copy" data-coop-copy>Copy</button>
    </div>
    <div class="coop-slots" data-coop-slots></div>
    <div class="coop-actions" data-coop-actions></div>
    <p class="coop-status" data-coop-status></p>
  </div>
  <div class="coop-pane" data-coop-pane="join" hidden>
    <p class="coop-hint">Ask the host for their 6-character code.</p>
    <div class="coop-codein" data-coop-codein title="Letters and numbers only: 2–9 and A–Z without I or O">
      ${Array.from({ length: 6 }, (_, i) => `<input maxlength="1" aria-label="Code letter ${i + 1}" autocapitalize="characters" autocomplete="off" spellcheck="false" />`).join('')}
    </div>
    <label class="coop-label" for="coop-name">Your name</label>
    <input id="coop-name" class="coop-namein" maxlength="${NAME_MAX}" placeholder="Player" autocomplete="off" />
    <div data-coop-errors></div>
    <div class="coop-actions">
      <button type="button" class="ghost" data-coop-close>Cancel</button>
      <button type="button" class="coop-primary" data-coop-join disabled>Join</button>
    </div>
    <p class="coop-status" data-coop-join-status>Your own shop is saved first. Leaving the party brings you back to it.</p>
  </div>
  <div class="coop-pane coop-connecting" data-coop-pane="connecting" hidden>
    <p class="coop-hint" data-coop-connecting-title>Joining…</p>
    <div class="boot-track"><div class="boot-bar"></div></div>
    <div class="coop-steps" data-coop-steps></div>
    <button type="button" class="ghost" data-coop-cancel>Cancel</button>
  </div>`;

export function mountCoop({ state, world, hud, autosave } = {}) {
  if (typeof document === 'undefined') return null;
  const saveBar = document.querySelector('#save-bar');
  const hudRoot = document.querySelector('#hud');
  if (!saveBar) return null;

  // ------------------------------------------------------------ DOM
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'coop-btn';
  btn.title = 'Co-op';
  btn.setAttribute('aria-label', 'Co-op');
  btn.setAttribute('aria-controls', 'coop-dock');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `${ICON}<span class="coop-badge" data-coop-badge hidden></span>`;
  const music = saveBar.querySelector('#music-btn');
  if (music) music.after(btn);
  else saveBar.append(btn);

  const dock = document.createElement('aside');
  dock.id = 'coop-dock';
  dock.className = 'expand-dock coop-dock';
  dock.setAttribute('role', 'dialog');
  dock.setAttribute('aria-label', 'Co-op');
  dock.hidden = true;
  dock.innerHTML = DOCK_HTML;
  document.body.append(dock);

  const partyEl = document.createElement('section');
  partyEl.className = 'panel coop-party';
  partyEl.dataset.coopParty = '';
  partyEl.setAttribute('aria-label', 'Party');
  partyEl.hidden = true;
  (hudRoot ?? document.body).append(partyEl);

  const toasts = document.createElement('div');
  toasts.className = 'coop-toasts';
  toasts.dataset.coopToasts = '';
  toasts.hidden = true;
  const banner = document.createElement('div');
  banner.className = 'coop-banner';
  banner.setAttribute('role', 'status');
  banner.hidden = true;
  banner.innerHTML = '<span class="coop-spin" aria-hidden="true"></span><span data-coop-banner-text></span>';
  const confirmEl = document.createElement('div');
  confirmEl.className = 'modal';
  confirmEl.dataset.coopConfirm = '';
  confirmEl.hidden = true;
  confirmEl.innerHTML = `<div class="sheet coop-end coop-confirm" role="alertdialog" aria-labelledby="coop-confirm-title">
      <h2 id="coop-confirm-title">End the party for everyone?</h2>
      <p>Your shop will be saved.</p>
      <div class="coop-actions">
        <button type="button" class="ghost" data-confirm-cancel>Cancel</button>
        <button type="button" class="coop-danger" data-confirm-end>End party</button>
      </div></div>`;
  const endEl = document.createElement('div');
  endEl.className = 'modal';
  endEl.dataset.coopEnd = '';
  endEl.hidden = true;
  endEl.innerHTML = `<div class="sheet coop-end">
      <div class="coop-icon" data-end-icon></div>
      <h2 data-end-title></h2>
      <p data-end-sub></p>
      <p class="coop-safe">Your own shop is just as you left it.</p>
      <button type="button" class="coop-primary" data-end-ok>Back to my shop</button></div>`;
  document.body.append(toasts, banner, confirmEl, endEl);

  const $ = (sel) => dock.querySelector(sel);
  const badge = btn.querySelector('[data-coop-badge]');
  const hostName = $('#coop-host-name');
  const joinName = $('#coop-name');
  const codeInputs = [...dock.querySelectorAll('[data-coop-codein] input')];
  const joinBtn = $('[data-coop-join]');
  hostName.value = storedName();
  joinName.value = storedName() === DEFAULT_NAME ? '' : storedName();

  // ---------------------------------------------------------- state
  let net = null;
  let netLoading = null;
  let tab = 'invite';
  let players = [];
  let pings = new Map();
  let you = null;
  let code = '';
  let joinError = null;
  let retryTimer = null;
  let bannerTimer = null;
  let hostAwayUntil = 0;
  let reconnecting = null;
  let hostNameForEnd = 'The host';
  let joiningCode = '';

  async function loadNet() {
    if (net) return net;
    if (!netLoading) {
      netLoading = import('./net.js').then(({ createNet }) => {
        net = createNet({ state, world, hud, autosave });
        wire(net);
        return net;
      });
    }
    return netLoading;
  }

  // ---------------------------------------------------------- dock
  function otherDocksClosed() {
    for (const el of document.querySelectorAll('.expand-dock:not(#coop-dock)')) el.hidden = true;
    document.querySelector('#skills-btn')?.classList.remove('is-on');
    document.querySelector('#skills-btn')?.setAttribute('aria-expanded', 'false');
  }

  function openDock() {
    otherDocksClosed();
    dock.hidden = false;
    btn.classList.add('is-on');
    btn.setAttribute('aria-expanded', 'true');
    paint();
  }

  function closeDock() {
    dock.hidden = true;
    btn.classList.remove('is-on');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', () => (dock.hidden ? openDock() : closeDock()));
  for (const id of ['#skills-btn', '#music-btn', '#settings-btn', '#build-btn', '#help-btn']) {
    document.querySelector(id)?.addEventListener('click', closeDock);
  }
  dock.querySelectorAll('[data-coop-close]').forEach((el) => el.addEventListener('click', closeDock));
  dock.querySelectorAll('[data-coop-tab]').forEach((el) =>
    el.addEventListener('click', () => {
      tab = el.dataset.coopTab;
      paint();
    }));

  function status() {
    return net?.status ?? 'solo';
  }

  function pane() {
    const s = status();
    if (s === 'connecting') return tab === 'join' ? 'connecting' : 'invite-empty';
    if (s === 'hosting' || s === 'in_game' || s === 'reconnecting') return 'invite';
    return tab === 'join' ? 'join' : 'invite-empty';
  }

  function paint() {
    const inRoom = ['hosting', 'in_game', 'reconnecting'].includes(status());
    if (inRoom) tab = 'invite';
    const p = pane();
    dock.querySelectorAll('[data-coop-tab]').forEach((t) => {
      t.classList.toggle('is-on', t.dataset.coopTab === (p === 'connecting' ? 'join' : p.startsWith('invite') ? 'invite' : 'join'));
      t.disabled = inRoom && t.dataset.coopTab === 'join';
    });
    dock.querySelectorAll('[data-coop-pane]').forEach((el) => {
      el.hidden = el.dataset.coopPane !== p;
    });
    if (p === 'invite') paintLobby();
    if (p === 'join') paintJoin();
    paintParty();
  }

  // ---------------------------------------------------------- lobby
  function paintLobby() {
    const amHost = Boolean(net?.isHost);
    const host = players.find((pl) => pl.host);
    $('[data-coop-code]').textContent = code;
    $('[data-coop-code]').setAttribute('aria-label', `Invite code ${code.split('').join(' ')}`);
    const slots = [];
    for (let i = 0; i < MAX_PLAYERS; i += 1) slots.push(players[i] ?? null);
    $('[data-coop-slots]').innerHTML = slots
      .map((pl) => (pl
        ? `<div class="coop-slot${pl.id === you?.id ? ' is-you' : ''}">
            <span class="coop-swatch" style="background:${SWATCH[pl.color] ?? SWATCH.blue}"></span>
            <span class="coop-name">${pl.host ? '<span class="coop-crown" title="Host">♛</span>' : ''}${esc(pl.name)}${pl.id === you?.id ? ' <small>(you)</small>' : ''}</span>
            ${pl.host ? '<span class="coop-host-tag">Host</span>' : amHost ? `<button type="button" class="coop-kick" data-kick="${esc(pl.id)}" title="Remove ${esc(pl.name)}" aria-label="Remove ${esc(pl.name)}">✕</button>` : '<span></span>'}
          </div>`
        : '<div class="coop-slot is-empty"><span class="coop-swatch"></span><span class="coop-name">Open slot. Share the code</span><span></span></div>'))
      .join('');
    const actions = $('[data-coop-actions]');
    actions.classList.toggle('is-single', !amHost);
    actions.innerHTML = amHost
      ? '<button type="button" class="ghost" data-coop-leave>Leave party</button><button type="button" class="coop-danger" data-coop-end>End party</button>'
      : '<button type="button" class="ghost" data-coop-leave>Leave party</button>';
    const count = `${players.length}/${MAX_PLAYERS} players`;
    $('[data-coop-status]').textContent = amHost
      ? `${count} · friends can drop in any time`
      : `You're in ${host?.name ?? 'the host'}'s shop · ${count}`;
    $('[data-coop-invite-hint]').textContent = amHost
      ? 'Share this code. Friends open Co-op → Join with code and drop straight into your shop.'
      : `${host?.name ?? 'The host'}'s invite code. Share it to bring a friend (4 players max).`;
  }

  dock.addEventListener('click', (e) => {
    const kick = e.target.closest('[data-kick]');
    if (kick) net?.kick(kick.dataset.kick);
    if (e.target.closest('[data-coop-leave]')) {
      if (net?.isHost) confirmEl.hidden = false; // Leaving as host ends it for everyone too.
      else net?.leave();
    }
    if (e.target.closest('[data-coop-end]')) confirmEl.hidden = false;
  });

  $('[data-coop-copy]').addEventListener('click', async () => {
    const copyBtn = $('[data-coop-copy]');
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = 'Copied!';
    } catch {
      copyBtn.textContent = code;
    }
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 1500);
  });

  confirmEl.querySelector('[data-confirm-cancel]').addEventListener('click', () => {
    confirmEl.hidden = true;
  });
  confirmEl.querySelector('[data-confirm-end]').addEventListener('click', () => {
    confirmEl.hidden = true;
    net?.endRoom();
  });

  // ------------------------------------------------------- create
  $('[data-coop-create]').addEventListener('click', async () => {
    const name = hostName.value.trim() || DEFAULT_NAME;
    $('[data-coop-create-errors]').innerHTML = '';
    $('[data-coop-create]').disabled = true;
    $('[data-coop-create]').textContent = 'Creating…';
    try {
      const n = await loadNet();
      await n.createRoom(name);
    } finally {
      $('[data-coop-create]').disabled = false;
      $('[data-coop-create]').textContent = 'Create invite code';
    }
  });

  // --------------------------------------------------------- join
  codeInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const chars = inp.value.toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c));
      inp.value = chars[0] ?? '';
      chars.slice(1).forEach((c, k) => {
        if (codeInputs[i + 1 + k]) codeInputs[i + 1 + k].value = c;
      });
      if (chars.length) codeInputs[Math.min(5, i + chars.length)].focus();
      clearCodeError();
      syncJoin();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) codeInputs[i - 1].focus();
      if (e.key === 'Enter' && !joinBtn.disabled) joinBtn.click();
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData?.getData('text') ?? '').toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c));
      if (!text.length) return;
      e.preventDefault();
      codeInputs.forEach((box, k) => {
        box.value = text[k] ?? '';
      });
      codeInputs[Math.min(5, text.length - 1)].focus();
      clearCodeError();
      syncJoin();
    });
  });
  joinName.addEventListener('input', () => {
    joinName.classList.remove('is-error');
    syncJoin();
  });

  function clearCodeError() {
    $('[data-coop-codein]').classList.remove('is-error');
  }

  function syncJoin() {
    if (retryTimer) return;
    const ok = codeInputs.every((x) => x.value) && joinName.value.trim();
    joinBtn.disabled = !ok;
  }

  function paintJoin() {
    const errBox = $('[data-coop-errors]');
    $('[data-coop-codein]').classList.toggle('is-error', joinError && ERRORS[joinError.reason]?.[2] === 'code');
    joinName.classList.toggle('is-error', joinError && ERRORS[joinError.reason]?.[2] === 'name');
    if (!joinError) {
      errBox.innerHTML = '';
      joinBtn.textContent = 'Join';
      syncJoin();
      return;
    }
    const [title, line] = ERRORS[joinError.reason] ?? ERRORS.not_found;
    errBox.innerHTML = `<p class="coop-error" role="alert" data-reason="${esc(joinError.reason)}"><span>✖</span><span><b>${title}</b> ${line}</span></p>`;
    joinBtn.textContent = 'Try again';
    if (joinError.reason === 'rate_limited') startRetry(joinError.retryAfter ?? 60);
    else syncJoin();
  }

  function startRetry(secs) {
    if (retryTimer) clearInterval(retryTimer);
    let left = Math.max(1, Math.round(secs));
    const tickRetry = () => {
      const t = dock.querySelector('[data-retry]');
      if (t) t.textContent = `${left}s`;
      joinBtn.disabled = left > 0;
      joinBtn.textContent = left > 0 ? `Wait ${left}s` : 'Try again';
      if (left <= 0) {
        clearInterval(retryTimer);
        retryTimer = null;
        joinError = null;
        paintJoin();
      }
      left -= 1;
    };
    retryTimer = setInterval(tickRetry, 1000);
    tickRetry();
  }

  joinBtn.addEventListener('click', async () => {
    const raw = codeInputs.map((x) => x.value).join('');
    joiningCode = raw;
    joinError = null;
    const n = await loadNet();
    if (n.joinRoom(raw, joinName.value.trim())) {
      paintConnecting();
    }
    paint();
  });

  function paintConnecting(hostLabel = null) {
    $('[data-coop-connecting-title]').textContent = `Joining ${joiningCode}…`;
    $('[data-coop-steps]').innerHTML = `
      <span class="is-done">✔ Saving your shop</span>
      <span class="${hostLabel ? 'is-done' : 'is-now'}">${hostLabel ? '✔' : '●'} Finding room ${esc(joiningCode)}</span>
      <span class="${hostLabel ? 'is-now' : ''}">${hostLabel ? '●' : '○'} Loading ${esc(hostLabel ?? 'the host')}'s shop</span>`;
  }

  $('[data-coop-cancel]').addEventListener('click', () => {
    net?.leave();
    tab = 'join';
    paint();
  });

  // ---------------------------------------------------- party HUD
  function dotClass(pl) {
    if (pl.connected === false) return 'is-bad';
    const ms = pings.get(pl.id);
    if (ms == null) return pl.host && hostAwayUntil ? 'is-bad' : 'is-ok';
    if (ms < 100) return 'is-ok';
    if (ms <= 250) return 'is-warn';
    return 'is-bad';
  }

  function paintParty() {
    const inRoom = ['hosting', 'in_game', 'reconnecting'].includes(status());
    const show = inRoom && (players.length > 1 || !net?.isHost);
    partyEl.hidden = !show;
    badge.hidden = !inRoom;
    const paused = status() === 'reconnecting' || hostAwayUntil > 0;
    badge.textContent = `${players.length}/${MAX_PLAYERS}`;
    badge.classList.toggle('is-warn', paused);
    partyEl.classList.toggle('is-paused', paused);
    if (!show) return;
    partyEl.innerHTML = `<p class="coop-party-head"><span>Party ${players.length}/${MAX_PLAYERS}</span><span>${esc(code)}</span></p>${players
      .map((pl) => {
        const ms = pings.get(pl.id);
        const isYou = pl.id === you?.id;
        const ping = status() === 'reconnecting' || pl.connected === false ? '…' : pl.host && !isYou ? 'host' : ms == null ? '—' : `${ms} ms`;
        return `<div class="coop-pm${isYou ? ' is-you' : ''}"><span class="coop-swatch" style="background:${SWATCH[pl.color] ?? SWATCH.blue}"></span><span class="coop-name">${pl.host ? '<span class="coop-crown">♛</span>' : ''}${esc(pl.name)}${isYou ? ' (you)' : ''}</span><span class="coop-dot ${dotClass(pl)}"></span><span class="coop-ping">${ping}</span></div>`;
      })
      .join('')}`;
  }

  // ---------------------------------------------------- toasts/banner
  function toast(text, color, cls = '') {
    toasts.hidden = false;
    const el = document.createElement('div');
    el.className = `coop-toast${cls ? ` ${cls}` : ''}`;
    el.innerHTML = `${color ? `<span class="coop-swatch" style="background:${SWATCH[color] ?? SWATCH.blue}"></span>` : ''}${esc(text)}`;
    toasts.append(el);
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
    setTimeout(() => {
      el.remove();
      if (!toasts.children.length) toasts.hidden = true;
    }, 3000);
  }

  function showBanner(html) {
    banner.hidden = false;
    banner.querySelector('[data-coop-banner-text]').innerHTML = html;
  }

  function hideBanner() {
    banner.hidden = true;
    if (bannerTimer) clearInterval(bannerTimer);
    bannerTimer = null;
  }

  function paintHostWait() {
    const host = players.find((pl) => pl.host);
    const left = Math.max(0, Math.ceil((hostAwayUntil - Date.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, '0');
    showBanner(`<b>Waiting for ${esc(host?.name ?? 'the host')} to reconnect…</b> <span class="coop-timer">${m}:${s}</span> · actions paused`);
  }

  // ---------------------------------------------------- ended modal
  function showEnded(reason) {
    const end = ENDS[reason] ?? ENDS.room_closed;
    endEl.dataset.reason = reason;
    endEl.querySelector('[data-end-icon]').textContent = end[0];
    endEl.querySelector('[data-end-title]').textContent = end[1];
    endEl.querySelector('[data-end-sub]').textContent = end[2](hostNameForEnd);
    endEl.hidden = false;
  }
  endEl.querySelector('[data-end-ok]').addEventListener('click', () => {
    endEl.hidden = true;
    net?.reset();
    paint();
  });

  // ---------------------------------------------------- events
  function wire(n) {
    n.on('status', () => paint());
    n.on('room_created', (e) => {
      code = e.code;
    });
    n.on('join_ok', (e) => {
      code = e.code;
      you = e.you;
      players = n.players;
      hostNameForEnd = players.find((pl) => pl.host)?.name ?? 'The host';
      joinError = null;
      if (!n.isHost) paintConnecting(hostNameForEnd);
      paint();
    });
    n.on('join_error', (e) => {
      joinError = e;
      if (tab === 'invite' || !joiningCode) {
        const [title, line] = ERRORS[e.reason] ?? ERRORS.offline;
        $('[data-coop-create-errors]').innerHTML = `<p class="coop-error" role="alert"><span>✖</span><span><b>${title}</b> ${line}</span></p>`;
        joinError = null;
      }
      paint();
    });
    n.on('players', (e) => {
      players = e.players;
      paint();
    });
    n.on('player_joined', (e) => toast(`${e.name} joined`, e.color));
    n.on('player_left', (e) => {
      pings.delete(e.id);
      toast(`${e.name} left`, e.color, 'is-left');
    });
    n.on('player_dropped', () => paintParty());
    n.on('player_reconnected', (e) => {
      toast(`${e.name} reconnected`, e.color);
      if (e.host && hostAwayUntil) {
        hostAwayUntil = 0;
        hideBanner();
      }
      paint();
    });
    n.on('ping_update', (e) => {
      if (e.ms == null) pings.delete(e.id);
      else pings.set(e.id, e.ms);
      paintParty();
    });
    n.on('connection_lost', () => {
      reconnecting = { n: 0, max: RECONNECT_DELAYS.length };
      showBanner('<b>Reconnecting…</b> · actions paused');
      paint();
    });
    n.on('reconnect_attempt', (e) => {
      reconnecting = e;
      showBanner(`<b>Reconnecting…</b> attempt ${e.n} of ${e.max} · actions paused`);
    });
    n.on('reconnected', () => {
      reconnecting = null;
      hideBanner();
      toast('Reconnected');
      paint();
    });
    n.on('host_waiting', (e) => {
      if (n.isHost) return;
      hostAwayUntil = Date.now() + (e.secondsLeft ?? 120) * 1000;
      paintHostWait();
      if (!bannerTimer) bannerTimer = setInterval(paintHostWait, 1000);
      paint();
    });
    n.on('room_ended', (e) => {
      hideBanner();
      hostAwayUntil = 0;
      reconnecting = null;
      confirmEl.hidden = true;
      players = [];
      pings = new Map();
      you = null;
      code = '';
      tab = e.self ? 'invite' : tab;
      hostName.value = storedName();
      if (!joinName.value) joinName.value = storedName() === DEFAULT_NAME ? '' : storedName();
      // The host never sees the modal for their own End party, and a guest who left doesn't either.
      if (!e.self) showEnded(e.reason);
      paint();
    });
  }

  paint();
  return {
    open: openDock,
    close: closeDock,
    get net() {
      return net;
    },
    get status() {
      return status();
    },
  };
}
