/* Stallhaven new-player tutorial (Youi's design, Luke-approved): overlay engine + 14-step config.
 * Game events arrive through tutorialEvents.js -> window.Tutorial.emit(type).
 * Save flag: state.tutorialDone (new saves false, old saves grandfathered true). */

export const TUTORIAL_REWARD = 250;
/** Card docks full-width to the top or bottom of the HUD band below this width. */
export const DOCK_BELOW = 700;
/** Open panels the desktop card should not cover. */
const AVOID = '#place-dock, #build-dock, .expand-dock, #craft-modal .craft-sheet, #furn-menu';

// Fallback coordinates, used only until the real object exists (layout.js / shopbuild.js / catalog.js).
const TRAPDOOR = { x: 3.35, y: 0.1, z: 9.55 };
const BRONZE_ROCK = { x: -3.3, y: 0.5, z: -3.15 };
const LADDER = { x: -4.6, y: 1.0, z: 0.4 };
const FURNACE_SPOT = { x: -1.65, y: 0.5, z: -0.45 };

/* target: CSS selector | {anchor, fallback, r} (live world object) | {any:[...]} | null (centred card)
 * extra: small pulsing rings; gate: event that completes the step; stages share one counter number. */
export const STEPS = [
  { id: 'welcome', title: 'Welcome to Stallhaven', lines: ['This is your shop. Let\u2019s get it running.', 'You\u2019ll mine ore, smelt a bar, smith armour and sell it.'], target: null },
  { id: 'move', title: 'Moving', lines: ['Tap the ground to walk there.', 'Desktop: left-click. Camera: arrow keys or middle mouse. Phone: swipe to turn, pinch to zoom.'], target: '#view', gate: 'walked' },
  { id: 'to-dungeon', title: 'Go to the dungeon', lines: ['The trapdoor outside leads down to the mines.', 'Walk to it and use it to head down.'], target: { anchor: 'trapdoor', fallback: TRAPDOOR, r: 46 }, extra: ['#minimap'], gate: 'enteredDungeon' },
  { id: 'mine', title: 'Mine a bronze rock', lines: ['Tap the bronze rock to mine Bronze Ore.', 'Watch the XP orb: that\u2019s your Mining XP.'], target: { anchor: 'bronzeRock', fallback: BRONZE_ROCK, r: 54 }, extra: ['.xp-orb'], gate: 'mined:bronze' },
  { id: 'bag', title: 'Your bag', lines: ['Everything you gather lands here.', 'Open it any time to check your ore.'], target: '#materials-toggle' },
  { id: 'to-shop', title: 'Head back to your shop', lines: ['Climb the ladder on the west wall to go back up.', 'Then walk back inside your shop.'], target: { anchor: 'ladder', fallback: LADDER, r: 50 }, extra: ['#minimap'], gate: 'arrivedShop' },
  { id: 'buy', title: 'Buy a station', stages: [
    { lines: ['Stations are bought in the Build menu.', 'Open Build.'], target: '#build-btn', gate: 'click:#build-btn' },
    { lines: ['Stations live in this tab.'], target: '[data-build-tab="stations"]', gate: 'click:[data-build-tab="stations"]' },
    { lines: ['The Furnace smelts ore into bars. Your first one is free.', 'Tap Place to buy it.'], target: { any: ['[data-furnace-buy]'] }, gate: 'click:[data-furnace-buy]' }] },
  { id: 'place', title: 'Placing your furnace', stages: [
    { lines: ['Tap a floor tile to move the furnace. It snaps to the grid.', 'Green means the spot is free. Red means it\u2019s blocked, and the panel says why.'], target: { anchor: 'furnace', fallback: FURNACE_SPOT, r: 60 } },
    { lines: ['Rotate turns it a quarter turn each tap.', 'Desktop: press R. Phone: tap Rotate.'], target: { any: ['[data-place-rotate]:not([hidden])', '#place-dock .furn-row'] } },
    { lines: ['Happy with the spot? Confirm Placement.', 'Cancel spends nothing. Desktop: double-click a tile to confirm.'], target: { any: ['[data-place-confirm]', '#place-dock .furn-row'] }, gate: 'placed:furnace' }] },
  { id: 'smelt', title: 'Smelt a bronze bar', lines: ['Use the furnace and pick Bronze Bar.', 'It turns your Bronze Ore into a bar.'], target: { any: ['#craft-modal:not([hidden]) #crafts', { anchor: 'furnace', fallback: FURNACE_SPOT, r: 60 }] }, gate: 'crafted:smelt_bronze' },
  { id: 'smith', title: 'Smith some armour', lines: ['Use the anvil and make a Bronze Med Helm.', 'It only needs one bar.'], target: { any: ['#craft-modal:not([hidden]) #crafts', '#view'] }, gate: 'crafted:bronze_med_helm' },
  { id: 'sell', title: 'Put it on display', lines: ['Long-press a shelf or stand (desktop: right-click) \u2192 Display item\u2026 and pick your helm.', 'A customer will buy it. Watch your coins go up!'], target: '#gold', gate: 'sold' },
  { id: 'skills', title: 'Skills', lines: ['Every skill and level lives here.', 'Higher levels unlock better recipes.'], target: '#skills-btn', extra: ['.xp-orb'] },
  { id: 'tour', title: 'Quests, Heroes & Saves', stages: [
    { lines: ['Quests: goals with rewards.'], target: '#quests-btn' },
    { lines: ['Heroes: adventurers who buy and fight for you.'], target: '#heroes-btn' },
    { lines: ['Saves: keep your progress. Save before you close the game.'], target: '#saves-btn' }] },
  { id: 'done', title: 'You\u2019re ready!', lines: ['Here\u2019s a little something to get you started.', 'Replay this any time from Help.'], target: null, reward: TUTORIAL_REWARD },
];

/** Does a game event complete this gate? 'mined:bronze' matches gate 'mined:bronze' (or bare 'mined'). */
export function gateMatches(gate, type) {
  if (!gate || !type || gate.startsWith('click:')) return false;
  return gate === type || gate === String(type).split(':')[0];
}

/** Only brand-new saves auto-start (old saves are grandfathered with tutorialDone = true). */
export function shouldAutoStart(state) {
  return Boolean(state) && state.tutorialDone === false && !state.coopGuest;
}

/** Vertical band between the top HUD and the bottom button bar (same rule as buildFit.js). */
export function hudBand(doc = document, W = innerWidth, H = innerHeight) {
  const ledger = doc.querySelector('#hud .ledger')?.getBoundingClientRect();
  const top = Math.max(8, (ledger && ledger.bottom < H / 2 ? ledger.bottom : 0) + 8);
  const bar = doc.getElementById('save-bar')?.getBoundingClientRect();
  const bottom = (bar && bar.height && bar.top > H / 2 ? bar.top : H) - 8;
  return { top, bottom: Math.max(top + 120, bottom), W, H };
}

const hitsRect = ([a, b], cw, ch, o) => a < o.x + o.w && a + cw > o.x && b < o.y + o.h && b + ch > o.y;

/** Desktop card spot: right, left, below, above the target, else the band's bottom-right; always inside the band. */
export function placeCard(r, cw, ch, band, avoid = []) {
  const { W, top, bottom } = band;
  const hits = ([a, b]) => avoid.some((o) => a < o.x + o.w && a + cw > o.x && b < o.y + o.h && b + ch > o.y);
  let x; let y;
  if (!r) { x = (W - cw) / 2; y = top + (bottom - top - ch) / 2; } else {
    const gap = 18;
    const cands = [
      [r.x + r.w + gap, r.y + r.h / 2 - ch / 2], [r.x - cw - gap, r.y + r.h / 2 - ch / 2],
      [r.x + r.w / 2 - cw / 2, r.y + r.h + gap], [r.x + r.w / 2 - cw / 2, r.y - ch - gap]];
    const fits = ([a, b]) => a >= 10 && b >= top && a + cw <= W - 10 && b + ch <= bottom;
    // Prefer a spot that also keeps open panels (place dock, build menu, craft window) uncovered.
    const corners = [[10, top], [W - cw - 10, top], [10, bottom - ch], [W - cw - 10, bottom - ch]];
    [x, y] = cands.find((c) => fits(c) && !hits(c))
      || corners.find((c) => !hits(c) && !(r && hitsRect(c, cw, ch, r)))
      || cands.find(fits) || [W - cw - 10, bottom - ch];
  }
  return {
    x: Math.max(10, Math.min(W - cw - 10, x)),
    y: Math.max(top, Math.min(bottom - ch, y)),
  };
}

export function mountTutorial({ getState, getWorld, onChange = () => {}, doc = document } = {}) {
  const state = () => getState?.() ?? null;
  const world = () => getWorld?.() ?? null;
  const T = { i: 0, s: 0, root: null, card: null, hole: null, confirm: null, extras: [], raf: 0, replay: false };
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const stage = () => { const st = STEPS[T.i]; return st?.stages ? { ...st, ...st.stages[T.s] } : st; };

  function worldPoint(t) {
    const w = world();
    const live = w?.tutorialAnchor?.(t.anchor);
    return live ?? null;
  }
  function rectOf(t) {
    if (!t) return null;
    if (typeof t === 'string') {
      const n = doc.querySelector(t);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    if (t.any) { for (const a of t.any) { const r = rectOf(a); if (r) return r; } return null; }
    if (t.anchor && world()?.projectToClient) {
      const p0 = worldPoint(t);
      if (!p0) return null;
      const p = world().projectToClient(p0.x, p0.y, p0.z); const r = t.r || 48;
      if (!Number.isFinite(p.x) || p.x < -r || p.y < -r || p.x > innerWidth + r || p.y > innerHeight + r) return null;
      return { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, round: true };
    }
    return null;
  }
  /** First live world anchor in a target (for narrow-screen camera framing). */
  function anchorOf(t) {
    if (!t || typeof t === 'string') return null;
    if (t.any) {
      for (const a of t.any) {
        if (typeof a === 'string') { if (rectOf(a)) return null; continue; }
        const p = anchorOf(a); if (p) return p;
      }
      return null;
    }
    return t.anchor ? worldPoint(t) : null;
  }

  function build() {
    T.root = el('div', 'tut-root'); T.root.setAttribute('aria-live', 'polite');
    T.root.append(el('div', 'tut-dim'));
    T.hole = el('div', 'tut-hole'); T.hole.append(el('div', 'tut-ring')); T.root.append(T.hole);
    T.card = el('div', 'tut-card'); T.card.setAttribute('role', 'dialog'); T.root.append(T.card);
    T.confirm = el('div', 'tut-confirm', `<div class="tut-card"><h3>Skip the tutorial?</h3><p>You can replay it any time from Help.</p>
      <div class="tut-row" style="margin-top:8px"><button type="button" class="tut-btn ghost" data-tut-keep>Keep going</button><button type="button" class="tut-btn" data-tut-skipyes>Skip</button></div></div>`);
    T.confirm.hidden = true; T.root.append(T.confirm);
    T.confirm.querySelector('[data-tut-keep]').onclick = () => { T.confirm.hidden = true; };
    T.confirm.querySelector('[data-tut-skipyes]').onclick = () => finish(true);
    doc.body.append(T.root);
  }

  function paint() {
    const st = stage(); const n = STEPS.length;
    const gated = Boolean(st.gate);
    T.card.innerHTML = `<span class="tut-count">${T.i + 1}/${n}</span><button type="button" class="tut-x" data-tut-x aria-label="Skip tutorial">\u2715</button><h3>${STEPS[T.i].title}</h3>${st.lines.map((l) => `<p>${l}</p>`).join('')}
      ${st.reward && !T.replay ? `<div class="tut-reward">+${st.reward} coins</div>` : ''}
      <div class="tut-pips">${STEPS.map((_, k) => `<i class="${k <= T.i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-row">${T.i < n - 1 ? '<button type="button" class="tut-btn ghost" data-tut-skip>Skip</button>' : '<span></span>'}
      ${gated ? '<span class="tut-gate">Do it to continue</span>' : `<button type="button" class="tut-btn" data-tut-next>${T.i === n - 1 ? 'Start playing' : 'Next'}</button>`}</div>`;
    const askSkip = () => { if (T.i >= n - 1) { finish(false); return; } T.confirm.hidden = false; };
    T.card.querySelector('[data-tut-skip]')?.addEventListener('click', askSkip);
    T.card.querySelector('[data-tut-x]')?.addEventListener('click', askSkip);
    T.card.querySelector('[data-tut-next]')?.addEventListener('click', next);
    T.card.dataset.step = STEPS[T.i].id;
    T.card.dataset.stage = String(T.s);
    T.fitKey = '';
    T.focus = false;
    layout();
  }

  /** Scale-to-fit down to 0.8 inside the HUD band, then compact mode (same rule as the other panels). */
  function fitCard(avail) {
    const c = T.card;
    c.classList.remove('is-compact'); c.style.zoom = ''; c.style.maxHeight = '';
    let h = c.offsetHeight;
    if (h <= avail) return 1;
    let z = avail / h;
    if (z < 0.8) { c.classList.add('is-compact'); h = c.offsetHeight; z = Math.min(1, avail / h); }
    z = Math.max(0.8, z);
    c.style.zoom = String(z);
    c.style.maxHeight = `${Math.floor(avail / z)}px`;
    return z;
  }

  function layout() {
    const st = stage(); if (!st || !T.root) return;
    const W = innerWidth; const H = innerHeight;
    const band = hudBand(doc, W, H);
    const docked = W < DOCK_BELOW;
    // Narrow screens: pull the camera so the world target is framed with the player.
    const r = rectOf(st.target); const pad = 6;
    // Also when the target is off screen (e.g. the furnace inside the shop while you stand outside).
    const focus = docked || !r ? anchorOf(st.target) : (T.focus && anchorOf(st.target));
    T.focus = Boolean(focus);
    world()?.frameTutorialTarget?.(focus ? { ...focus, weight: docked ? 0.85 : 0.5 } : null);
    T.root.classList.toggle('is-docked', docked);
    T.root.classList.toggle('has-target', Boolean(r));
    // A world target that isn't on screen yet: no full dim over the scene, just the card.
    T.root.classList.toggle('no-dim', !r && Boolean(st.target));
    if (r) Object.assign(T.hole.style, { left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + pad * 2}px`, height: `${r.h + pad * 2}px` });
    T.hole.classList.toggle('is-round', Boolean(r?.round));
    T.extras.forEach((e) => e.remove()); T.extras = [];
    for (const x of st.extra || []) {
      const er = rectOf(x); if (!er) continue;
      const e = el('div', 'tut-extra');
      Object.assign(e.style, { left: `${er.x - 4}px`, top: `${er.y - 4}px`, width: `${er.w + 8}px`, height: `${er.h + 8}px`, borderRadius: x === '#minimap' || x === '.xp-orb' ? '50%' : '10px' });
      T.root.append(e); T.extras.push(e);
    }
    const c = T.card;
    const key = `${W}x${H}:${docked}:${band.top}:${band.bottom}`;
    let z = Number(c.style.zoom) || 1;
    if (key !== T.fitKey) {
      T.fitKey = key;
      c.style.left = ''; c.style.top = ''; c.style.bottom = '';
      z = fitCard(band.bottom - band.top);
    }
    if (docked) {
      const cy = r ? r.y + r.h / 2 : H;
      const top = cy > (band.top + band.bottom) / 2;
      c.classList.toggle('dock-top', top); c.classList.toggle('dock-bottom', !top);
      if (top) { c.style.top = `${band.top / z}px`; c.style.bottom = ''; } else { c.style.top = ''; c.style.bottom = `${(H - band.bottom) / z}px`; }
      return;
    }
    c.classList.remove('dock-top', 'dock-bottom');
    const cw = c.offsetWidth * z; const ch = c.offsetHeight * z;
    const avoid = [];
    for (const n of doc.querySelectorAll(AVOID)) {
      const o = n.getBoundingClientRect();
      if (o.width && o.height && !n.closest('[hidden]')) avoid.push({ x: o.left, y: o.top, w: o.width, h: o.height });
    }
    const p = placeCard(r, cw, ch, band, avoid);
    c.style.left = `${p.x / z}px`;
    c.style.top = `${p.y / z}px`;
  }

  function loop() { layout(); T.raf = requestAnimationFrame(loop); }

  function next() {
    const st = STEPS[T.i];
    if (!st) return;
    if (st.stages && T.s < st.stages.length - 1) { T.s += 1; paint(); return; }
    if (T.i >= STEPS.length - 1) { finish(false); return; }
    T.i += 1; T.s = 0; paint();
  }

  function finish(skipped) {
    const s = state();
    const last = STEPS[STEPS.length - 1];
    // Coins once: only the first full run of a new save pays out (not skips, not replays).
    if (s && !skipped && !T.replay && !s.tutorialDone && last.reward) s.gold = (s.gold || 0) + last.reward;
    if (s) s.tutorialDone = true;
    cancelAnimationFrame(T.raf);
    world()?.frameTutorialTarget?.(null);
    T.root?.remove(); T.root = null;
    onChange({ type: 'end', skipped });
    window.dispatchEvent(new CustomEvent('tutorial:end', { detail: { skipped } }));
  }

  function emit(type) {
    if (!T.root) return;
    const st = stage();
    if (st && gateMatches(st.gate, type)) next();
  }
  const onClick = (e) => {
    const st = T.root && stage(); if (!st?.gate?.startsWith('click:')) return;
    if (e.target.closest?.(st.gate.slice(6))) setTimeout(next, 60);
  };
  doc.addEventListener('click', onClick, true);

  function start(at = 0, sub = 0, { replay = false } = {}) {
    if (!T.root) build();
    T.replay = replay;
    T.i = Math.max(0, Math.min(STEPS.length - 1, at)); T.s = sub; T.confirm.hidden = true;
    paint(); cancelAnimationFrame(T.raf); loop();
    onChange({ type: 'start' });
  }

  function addHelpEntry() {
    const sheet = doc.querySelector('#help-modal .sheet');
    if (!sheet || sheet.querySelector('[data-tut-replay]')) return;
    const b = el('button', 'tut-btn tut-replay', 'Replay tutorial'); b.type = 'button'; b.dataset.tutReplay = '';
    b.onclick = () => {
      const close = doc.querySelector('#help-modal [data-dismiss]');
      if (close) close.click(); else doc.querySelector('#help-modal').hidden = true;
      start(0, 0, { replay: Boolean(state()?.tutorialDone) });
    };
    sheet.append(b);
  }

  const api = {
    start, next, emit, finish, steps: STEPS, addHelpEntry,
    get index() { return T.i; },
    get stage() { return T.s; },
    get active() { return Boolean(T.root); },
  };
  addHelpEntry();
  return api;
}
