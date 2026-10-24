/**
 * Heroes dock, hire picker, and the quest board.
 * Timers stay on Date.now() inside heroesQuests.js. This file only paints and sends intents.
 */
import { BUYER_PACKS, MATERIALS, formatGold } from './catalog.js';
import {
  HERO_CLASSES,
  HERO_NPC_NAMES,
  NEW_MATERIALS,
  QUEST_BY_ID,
  QUEST_TABS,
  QUESTS,
  emptyHeroQuestState,
  finishedWhileAway,
  formatDuration,
  formatLeft,
  heroClassStatus,
  heroName,
  heroQuest,
  heroTitle,
  idleHeroes,
  questLockReason,
  questProgress,
  questStatus,
  readyQuests,
} from './heroesQuests.js';
import { intentBus } from './intents.js';

function portraitUrl(npcId, mode) {
  const file = String(npcId ?? '').replace(/^buyer-[a-z]+-/, '');
  let base = './public/';
  try {
    const raw = import.meta.env.BASE_URL;
    if (raw) base = raw.endsWith('/') ? raw : `${raw}/`;
  } catch { /* GitHub Pages serves this file unbuilt, where import.meta.env is missing. */ }
  return `${base}portraits/${file}-${mode}.png`;
}

function article(label) {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

function npcsFor(classId) {
  const cls = HERO_CLASSES.find((item) => item.id === classId);
  return BUYER_PACKS[cls?.customerId] ?? [];
}

export function bindHeroesPanel({
  state,
  onOpen = null,
  onFullscreen = null,
  offerFullscreen = true,
  log = null,
  toast = null,
  render = null,
} = {}) {
  if (!state.hq) state.hq = emptyHeroQuestState();
  const heroesBtn = document.querySelector('#heroes-btn');
  const questsBtn = document.querySelector('#quests-btn');
  const heroesDock = document.querySelector('#heroes-dock');
  const questsDock = document.querySelector('#quests-dock');
  const picker = document.querySelector('#hero-picker');
  const badge = document.querySelector('[data-quest-badge]');
  if (!heroesDock || !questsDock || !picker) {
    throw new Error('bindHeroesPanel needs the heroes dock, quests dock, and hire picker');
  }

  let pickClass = null;
  let pickNpc = null;
  let heroHtml = '';

  function setPressed(btn, open) {
    btn?.classList.toggle('is-on', open);
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function paintBadge(now = Date.now()) {
    const n = readyQuests(state.hq, now).length;
    if (badge) {
      badge.hidden = n === 0;
      badge.textContent = String(n);
    }
    questsBtn?.setAttribute('aria-label', n ? `Quests, ${n} ready to collect` : 'Quests');
  }

  function heroCard(cls, index, now) {
    const status = heroClassStatus(state.hq, cls.id);
    if (status === 'hired') {
      const questId = heroQuest(state.hq, cls.id);
      const quest = questId ? QUEST_BY_ID[questId] : null;
      const st = questId ? questStatus(state.hq, questId, now) : 'idle';
      const pill = !quest
        ? '<span class="hq-pill is-idle">Idle</span>'
        : st === 'ready'
          ? `<span class="hq-pill is-ready">Back from ${quest.enemy}</span>`
          : `<span class="hq-pill is-busy" data-live="${questId}">${quest.enemy} · ${formatLeft(questProgress(state.hq, questId, now).msLeft)}</span>`;
      const action = !quest
        ? `<button type="button" class="hq-gold-btn" data-quests="${cls.id}">Send on a quest</button>`
        : st === 'ready'
          ? `<button type="button" class="hq-gold-btn" data-quests="${cls.id}" data-quest="${questId}">Collect in Quests</button>`
          : `<button type="button" data-quests="${cls.id}" data-quest="${questId}">View quest</button>`;
      return `<article class="hero-card">
        <div class="hero-portrait"><img src="${portraitUrl(state.hq.heroes[cls.id].npcId, 'bust')}" alt=""></div>
        <p class="hero-class">${index + 1}. ${cls.label}</p>
        <p class="hero-name">${heroName(state.hq, cls.id)}</p>
        <p class="hero-look">Look: ${HERO_NPC_NAMES[state.hq.heroes[cls.id].npcId] ?? ''}</p>
        ${pill}
        <div class="hero-actions">${action}<button type="button" class="hero-retire" data-retire="${cls.id}">Retire</button></div>
      </article>`;
    }
    if (status === 'next') {
      const short = (state.gold ?? 0) < cls.price;
      const need = short ? `<span class="hero-lock-note">Need ${formatGold(cls.price - state.gold)} more gp</span>` : '';
      return `<article class="hero-card is-next">
        <div class="hero-portrait is-empty"></div>
        <p class="hero-class">${index + 1}. ${cls.label}</p>
        <p class="hero-name is-empty">Not hired</p>
        <p class="hero-price">${formatGold(cls.price)} gp</p>
        <div class="hero-actions">
          <button type="button" class="hq-gold-btn" data-hire="${cls.id}" ${short ? 'disabled' : ''}>Hire…</button>
          ${need}
        </div>
      </article>`;
    }
    return `<article class="hero-card is-locked">
      <div class="hero-portrait is-empty is-locked"></div>
      <p class="hero-class">${index + 1}. ${cls.label}</p>
      <p class="hero-name is-empty">Locked</p>
      <p class="hero-price">${formatGold(cls.price)} gp</p>
      <p class="hero-lock-note">Hire the previous hero first</p>
    </article>`;
  }

  function paintHeroes(now = Date.now()) {
    const html = HERO_CLASSES.map((cls, index) => heroCard(cls, index, now)).join('');
    if (html !== heroHtml) {
      heroHtml = html;
      heroesDock.querySelector('[data-hero-grid]').innerHTML = html;
    }
    const hired = HERO_CLASSES.filter((cls) => state.hq.heroes[cls.id]).length;
    heroesDock.querySelector('[data-hero-foot]').textContent = `${hired}/4 heroes hired · each hero can be on one quest at a time.`;
    paintBadge(now);
  }

  const ICONS = {
    horns: '<path d="M8 16c0-4 1.2-8 4-8s4 4 4 8"/><path d="M8 9C6 4 3 3 2 6M16 9c2-5 5-6 6-3"/>',
    beak: '<path d="M7 11c0-4 10-4 10 0v3H7z"/><path d="M17 12h5l-5 3"/>',
    hoof: '<path d="M7 7h10v7c0 3-2.2 4-5 4s-5-1-5-4z"/>',
    head: '<circle cx="12" cy="9" r="4.5"/><path d="M7 20c1.2-3.2 8.8-3.2 10 0"/>',
    spider: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9V3M12 15v6M9 12H3M15 12h6M8 8L4 4M16 8l4-4M8 16l-4 4M16 16l4 4"/>',
    paw: '<circle cx="12" cy="15" r="3.4"/><circle cx="7" cy="8" r="1.7"/><circle cx="12" cy="6" r="1.7"/><circle cx="17" cy="8" r="1.7"/>',
    skull: '<circle cx="12" cy="10" r="5.5"/><circle cx="10" cy="10" r="1.1"/><circle cx="14" cy="10" r="1.1"/><path d="M10 18h4M11 15v3M13 15v3"/>',
    claw: '<path d="M5 18c1.6-8 2.6-12 3.6-12s1.6 4 3.2 12M13 18c1-6 1.8-9 2.8-9s1 3 2 9"/>',
    ghost: '<path d="M7 11c0-4 10-5 10 0v8l-2.2-1.6L12 19l-2.8-1.6L7 19z"/>',
    hat: '<path d="M3 15h18M8 15c0-5 8-5 8 0"/><path d="M9 10h6"/>',
    fangs: '<path d="M5 8h14v5c-2 0-2.2 5-3.4 5S14 13 12 13s-2.2 5-3.6 5S7 13 5 13z"/>',
    dragon: '<path d="M3 15c4-1 6-7 8-7 1.4 2 3.2 2 7-1-2 4-4 7-7 7-2 2-5 2-8 1z"/>',
  };

  let currentTab = readQuestTab();
  let pickedHero = null;
  let questHtml = '';
  const notified = new Set();

  function readQuestTab() {
    try {
      const saved = localStorage.getItem('questTab');
      if (QUEST_TABS.some((tab) => tab.id === saved)) return saved;
    } catch { /* private mode */ }
    return QUEST_TABS[0].id;
  }

  function rememberTab(id) {
    currentTab = id;
    try { localStorage.setItem('questTab', id); } catch { /* private mode */ }
  }

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function materialName(id) {
    return MATERIALS[id]?.name ?? NEW_MATERIALS[id]?.name ?? id;
  }

  function questSvg(quest) {
    const path = ICONS[quest.icon] ?? ICONS.head;
    return `<div class="quest-icon" style="--tint:${quest.tint}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></div>`;
  }

  function rewardChips(rewards) {
    return Object.entries(rewards).map(([id, n]) => {
      const fresh = Boolean(NEW_MATERIALS[id]) && !MATERIALS[id];
      return `<span class="mat${fresh ? ' is-new' : ''}"><span class="mat-count">${n}</span> ${esc(materialName(id))}${fresh ? ' <span class="mat-new-tag">NEW</span>' : ''}</span>`;
    }).join('');
  }

  function syncNotified(now = Date.now()) {
    notified.clear();
    for (const id of readyQuests(state.hq, now)) notified.add(id);
  }

  function showQuestToast(html) {
    document.querySelectorAll('.game-toast').forEach((old) => old.remove());
    const el = document.createElement('div');
    el.className = 'game-toast hq-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = html;
    document.body.appendChild(el);
    window.setTimeout(() => {
      el.classList.add('is-leaving');
      window.setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  function saveQuestProgress() {
    document.dispatchEvent(new CustomEvent('rc-save-trigger', { detail: { trigger: 'quest' } }));
  }

  function logRewards(rows) {
    for (const row of rows) {
      const quest = QUEST_BY_ID[row.questId];
      for (const [id, n] of Object.entries(row.rewards)) {
        log?.(`Collected ${n} ${materialName(id)} from the ${quest?.enemy ?? 'quest'}.`);
      }
      notified.delete(row.questId);
    }
  }

  function afterQuestChange() {
    heroHtml = '';
    questHtml = '';
    if (!heroesDock.hidden) paintHeroes();
    if (!questsDock.hidden) paintQuests();
    else paintBadge();
    render?.();
  }

  function runCollect(questId) {
    const rows = intentBus.run({ type: 'collectQuest', questId });
    if (!rows) return false;
    logRewards(rows);
    saveQuestProgress();
    afterQuestChange();
    return true;
  }

  function runStart(questId, heroId) {
    if (!intentBus.run({ type: 'startQuest', questId, heroId })) return false;
    const quest = QUEST_BY_ID[questId];
    log?.(`${heroTitle(state.hq, heroId)} sets off to fight the ${quest.enemy}.`);
    afterQuestChange();
    return true;
  }

  function runRecall(questId) {
    const run = state.hq.quests.active[questId];
    const name = heroName(state.hq, run?.heroId);
    if (name && !window.confirm(`Recall ${name}? They come home with nothing.`)) return false;
    if (!intentBus.run({ type: 'recallQuest', questId })) return false;
    log?.(`${name || 'Your hero'} comes home with nothing.`);
    afterQuestChange();
    return true;
  }

  function moveTab(delta) {
    const index = Math.max(0, QUEST_TABS.findIndex((tab) => tab.id === currentTab));
    const next = QUEST_TABS[(index + delta + QUEST_TABS.length) % QUEST_TABS.length];
    rememberTab(next.id);
    questHtml = '';
    paintQuests();
  }

  function questCard(quest, now) {
    const status = questStatus(state.hq, quest.id, now);
    const rewards = `<div class="quest-rewards">${rewardChips(quest.rewards)}</div>`;
    const title = `<div class="quest-title"><strong>${esc(quest.enemy)}</strong><span class="meta">${esc(formatDuration(quest.duration))}</span></div>`;
    const lock = status === 'idle' ? questLockReason(state.hq, quest.id, state.skills?.getLevel?.('crafting') ?? 1) : '';
    if (lock) {
      return `<article class="quest-card is-locked" data-quest="${quest.id}">
        ${questSvg(quest)}
        ${title}
        ${rewards}
        <div class="quest-side"><span class="quest-hint">🔒 ${esc(lock)}</span></div>
      </article>`;
    }
    if (status === 'idle') {
      const idle = idleHeroes(state.hq);
      if (pickedHero && !idle.includes(pickedHero)) pickedHero = null;
      const chosen = idle.includes(pickedHero) ? pickedHero : idle[0] ?? null;
      const picks = HERO_CLASSES.filter((cls) => state.hq.heroes[cls.id]).map((cls) => {
        const busy = Boolean(heroQuest(state.hq, cls.id));
        const on = !busy && cls.id === chosen;
        return `<button type="button" class="hero-pick${on ? ' is-on' : ''}" data-pick-hero="${cls.id}" ${busy ? 'disabled' : ''} aria-pressed="${on}"><img src="${portraitUrl(state.hq.heroes[cls.id].npcId, 'bust')}" alt="">${esc(heroName(state.hq, cls.id))}</button>`;
      }).join('');
      const hint = idle.length ? '' : '<span class="quest-hint">Every hero is away</span>';
      return `<article class="quest-card" data-quest="${quest.id}">
        ${questSvg(quest)}
        ${title}
        ${rewards}
        <div class="quest-side">
          <div class="quest-assign" role="radiogroup" aria-label="Hero for ${esc(quest.enemy)}">${picks}</div>
          <button type="button" class="hq-gold-btn hq-start" data-start="${quest.id}" ${chosen ? '' : 'disabled'}>Start</button>
          ${hint}
        </div>
      </article>`;
    }
    const run = state.hq.quests.active[quest.id];
    const prog = questProgress(state.hq, quest.id, now);
    const who = heroName(state.hq, run.heroId);
    const npc = state.hq.heroes[run.heroId]?.npcId;
    const runRow = `<div class="quest-run"><span class="hero-chip"><img src="${portraitUrl(npc, 'bust')}" alt=""></span><span class="quest-who">${esc(who)}</span><span class="quest-bar" style="--t:${prog.t}"><i></i></span><span class="quest-left" data-left="${quest.id}">${status === 'ready' ? 'Ready' : esc(formatLeft(prog.msLeft))}</span></div>`;
    const action = status === 'ready'
      ? `<button type="button" class="hq-gold-btn hq-collect" data-collect="${quest.id}">Collect</button>`
      : `<button type="button" class="quest-recall" data-recall="${quest.id}">Recall</button>`;
    return `<article class="quest-card is-${status}" data-quest="${quest.id}">
      ${questSvg(quest)}
      ${title}
      ${rewards}
      ${runRow}
      <div class="quest-side">${action}</div>
    </article>`;
  }

  function paintQuests(now = Date.now()) {
    const list = questsDock.querySelector('[data-quest-list]');
    const tabs = questsDock.querySelector('[data-quest-tabs]');
    const summary = questsDock.querySelector('[data-quest-summary]');
    const heroes = questsDock.querySelector('[data-quest-heroes]');
    if (!list) return;
    const hired = HERO_CLASSES.filter((cls) => state.hq.heroes[cls.id]);
    const ready = readyQuests(state.hq, now);
    const running = Object.keys(state.hq.quests.active).length - ready.length;
    if (summary) {
      const collect = ready.length
        ? '<button type="button" class="hq-gold-btn quest-collect-all" data-collect="all">Collect all</button>'
        : '';
      summary.innerHTML = hired.length
        ? `<span><b>${ready.length}</b> ready · ${running} out</span>${collect}`
        : '<span>Hire a hero to send them out.</span>';
    }
    if (heroes) {
      heroes.innerHTML = hired.map((cls) => {
        const questId = heroQuest(state.hq, cls.id);
        const quest = questId ? QUEST_BY_ID[questId] : null;
        const st = questId ? questStatus(state.hq, questId, now) : 'idle';
        const label = !quest
          ? `${esc(heroName(state.hq, cls.id))} idle`
          : st === 'ready'
            ? `${esc(heroName(state.hq, cls.id))} · back`
            : `${esc(heroName(state.hq, cls.id))} · ${esc(quest.enemy)}`;
        const kind = !quest ? 'is-idle' : st === 'ready' ? 'is-ready' : 'is-busy';
        return `<span class="hq-pill ${kind}">${label}</span>`;
      }).join('');
    }
    if (tabs) {
      tabs.innerHTML = QUEST_TABS.map((tab) => {
        const rows = QUESTS.filter((quest) => quest.tab === tab.id);
        const nReady = rows.filter((quest) => questStatus(state.hq, quest.id, now) === 'ready').length;
        const nBusy = rows.filter((quest) => questStatus(state.hq, quest.id, now) === 'running').length;
        const dot = nReady
          ? `<span class="tab-dot is-ready">${nReady}</span>`
          : nBusy
            ? `<span class="tab-dot is-busy">${nBusy}</span>`
            : '';
        const on = tab.id === currentTab;
        return `<button type="button" class="sidetab${on ? ' is-on' : ''}" role="tab" aria-selected="${on}" data-quest-tab="${tab.id}">${esc(tab.label)} <small>${rows.length}</small>${dot}</button>`;
      }).join('');
    }
    if (!hired.length) {
      list.innerHTML = '<div class="quest-empty"><p>You need a hero to send on quests.</p><button type="button" class="hq-gold-btn" data-open-heroes>Hire your first hero · 50,000 gp</button></div>';
      questHtml = '';
      paintBadge(now);
      return;
    }
    const rows = QUESTS.filter((quest) => quest.tab === currentTab);
    const sig = [
      currentTab,
      pickedHero ?? '',
      hired.map((cls) => cls.id).join(','),
      idleHeroes(state.hq).join(','),
      ...rows.map((quest) => `${quest.id}:${questStatus(state.hq, quest.id, now)}:${state.hq.quests.active[quest.id]?.heroId ?? ''}:${questLockReason(state.hq, quest.id, state.skills?.getLevel?.('crafting') ?? 1)}`),
    ].join('|');
    if (sig !== questHtml) {
      questHtml = sig;
      list.innerHTML = rows.map((quest) => questCard(quest, now)).join('');
    }
    paintBadge(now);
  }

  function showAway(now = Date.now()) {
    const away = document.querySelector('#away-modal');
    const ids = finishedWhileAway(state.hq, now);
    syncNotified(now);
    if (!away) return;
    if (!ids.length) {
      away.hidden = true;
      return;
    }
    const list = away.querySelector('[data-away-list]');
    if (list) {
      list.innerHTML = ids.map((id) => {
        const quest = QUEST_BY_ID[id];
        const run = state.hq.quests.active[id];
        const name = heroName(state.hq, run?.heroId);
        const npc = state.hq.heroes[run?.heroId]?.npcId;
        const loot = Object.entries(quest.rewards).map(([mid, n]) => `${n} ${materialName(mid)}`).join(', ');
        return `<div class="away-row"><span class="hero-chip"><img src="${portraitUrl(npc, 'bust')}" alt=""></span><p><b>${esc(name)}</b> is back from the ${esc(quest.enemy)}.</p><p>${esc(loot)}</p></div>`;
      }).join('');
    }
    away.hidden = false;
  }

  function paintPicker() {
    const cls = HERO_CLASSES.find((item) => item.id === pickClass);
    if (!cls) return;
    const npcs = npcsFor(cls.id);
    if (!pickNpc || !npcs.some((npc) => npc.id === pickNpc)) pickNpc = npcs[0]?.id ?? null;
    picker.querySelector('[data-picker-title]').textContent = `Hire ${article(cls.label)} ${cls.label}`;
    picker.querySelector('[data-picker-grid]').innerHTML = npcs.map((npc) => `
      <button type="button" role="radio" aria-checked="${npc.id === pickNpc}" class="npc-card${npc.id === pickNpc ? ' is-on' : ''}" data-npc="${npc.id}">
        <img src="${portraitUrl(npc.id, 'full')}" alt="">
        <span>${HERO_NPC_NAMES[npc.id] ?? npc.id}</span>
      </button>`).join('');
    const look = HERO_NPC_NAMES[pickNpc] ?? '';
    picker.querySelector('[data-picker-note]').innerHTML = `Look: <b>${look}</b> · you have ${formatGold(state.gold)} gp`;
    const hireBtn = picker.querySelector('[data-picker-hire]');
    hireBtn.textContent = `Hire ${cls.label} · ${formatGold(cls.price)} gp`;
    hireBtn.disabled = (state.gold ?? 0) < cls.price;
  }

  function openPicker(classId) {
    pickClass = classId;
    pickNpc = npcsFor(classId)[0]?.id ?? null;
    paintPicker();
    picker.hidden = false;
  }

  function closePicker() {
    picker.hidden = true;
    pickClass = null;
  }

  function openHeroes() {
    onOpen?.();
    questsDock.hidden = true;
    setPressed(questsBtn, false);
    closePicker();
    heroesDock.hidden = false;
    setPressed(heroesBtn, true);
    paintHeroes();
  }

  function openQuests({ heroId = null, questId = null } = {}) {
    onOpen?.();
    heroesDock.hidden = true;
    setPressed(heroesBtn, false);
    closePicker();
    const quest = questId ? QUEST_BY_ID[questId] : null;
    if (quest) rememberTab(quest.tab);
    if (heroId && idleHeroes(state.hq).includes(heroId)) pickedHero = heroId;
    questsDock.hidden = false;
    setPressed(questsBtn, true);
    questHtml = '';
    paintQuests();
    if (questId) questsDock.querySelector(`[data-quest="${questId}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    heroesDock.hidden = true;
    questsDock.hidden = true;
    setPressed(heroesBtn, false);
    setPressed(questsBtn, false);
    closePicker();
  }

  function toggleHeroes() {
    if (!heroesDock.hidden) close();
    else openHeroes();
  }

  function toggleQuests() {
    if (!questsDock.hidden) close();
    else openQuests();
  }

  heroesBtn?.addEventListener('click', toggleHeroes);
  questsBtn?.addEventListener('click', toggleQuests);
  heroesDock.querySelector('[data-heroes-close]')?.addEventListener('click', close);
  questsDock.querySelector('[data-quests-close]')?.addEventListener('click', close);
  picker.querySelector('[data-picker-close]')?.addEventListener('click', closePicker);
  picker.addEventListener('click', (event) => {
    if (event.target === picker) closePicker();
  });

  heroesDock.addEventListener('click', (event) => {
    const retire = event.target.closest('[data-retire]');
    if (retire) {
      const classId = retire.dataset.retire;
      const name = heroName(state.hq, classId);
      if (!window.confirm(`Retire ${name}? They leave for good and any quest they are on is lost.`)) return;
      if (!intentBus.run({ type: 'retireHero', classId })) return;
      log?.(`${name} retires.`);
      saveQuestProgress();
      afterQuestChange();
      return;
    }
    const hire = event.target.closest('[data-hire]');
    if (hire && !hire.disabled) {
      openPicker(hire.dataset.hire);
      return;
    }
    const go = event.target.closest('[data-quests]');
    if (go) openQuests({ heroId: go.dataset.quests, questId: go.dataset.quest || null });
  });

  picker.querySelector('[data-picker-grid]')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-npc]');
    if (!card) return;
    pickNpc = card.dataset.npc;
    paintPicker();
  });

  picker.querySelector('[data-picker-hire]')?.addEventListener('click', () => {
    const cls = HERO_CLASSES.find((item) => item.id === pickClass);
    if (!cls || !pickNpc) return;
    const hired = intentBus.run({ type: 'hireHero', classId: cls.id, npcId: pickNpc });
    if (hired) saveQuestProgress();
    if (!hired) {
      paintPicker();
      paintHeroes();
      return;
    }
    const line = `Meet ${heroTitle(state.hq, cls.id)}!`;
    log?.(line);
    toast?.(line);
    closePicker();
    heroHtml = '';
    paintHeroes();
    render?.();
  });

  questsDock.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-heroes]')) {
      openHeroes();
      return;
    }
    const tab = event.target.closest('[data-quest-tab]');
    if (tab) {
      rememberTab(tab.dataset.questTab);
      questHtml = '';
      paintQuests();
      return;
    }
    const pick = event.target.closest('[data-pick-hero]');
    if (pick && !pick.disabled) {
      pickedHero = pick.dataset.pickHero;
      questHtml = '';
      paintQuests();
      return;
    }
    const start = event.target.closest('[data-start]');
    if (start && !start.disabled) {
      const idle = idleHeroes(state.hq);
      const heroId = idle.includes(pickedHero) ? pickedHero : idle[0];
      if (heroId) runStart(start.dataset.start, heroId);
      return;
    }
    const collect = event.target.closest('[data-collect]');
    if (collect) {
      runCollect(collect.dataset.collect);
      return;
    }
    const recall = event.target.closest('[data-recall]');
    if (recall) runRecall(recall.dataset.recall);
  });

  const awayModal = document.querySelector('#away-modal');
  awayModal?.querySelector('[data-away-later]')?.addEventListener('click', () => {
    awayModal.hidden = true;
  });
  awayModal?.querySelector('[data-away-collect]')?.addEventListener('click', () => {
    runCollect('all');
    awayModal.hidden = true;
  });
  awayModal?.addEventListener('click', (event) => {
    if (event.target === awayModal) awayModal.hidden = true;
  });

  const settings = document.querySelector('#settings-dock');
  const fullBtn = settings?.querySelector('[data-more="fullscreen"]');
  if (fullBtn && !offerFullscreen) fullBtn.hidden = true;
  settings?.querySelector('.more-quick')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-more]');
    if (!btn) return;
    if (btn.dataset.more === 'fullscreen') {
      onFullscreen?.();
      return;
    }
    const id = { help: '#help-btn', saves: '#saves-btn' }[btn.dataset.more];
    if (id) document.querySelector(id)?.click();
  });

  function onKey(event) {
    const typing = event.target?.closest?.('input, textarea, select');
    if (!typing && !questsDock.hidden && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      event.stopPropagation();
      moveTab(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key !== 'Escape') return;
    if (awayModal && !awayModal.hidden) {
      event.stopPropagation();
      awayModal.hidden = true;
      return;
    }
    if (!picker.hidden) {
      event.stopPropagation();
      closePicker();
      return;
    }
    if (!heroesDock.hidden || !questsDock.hidden) {
      event.stopPropagation();
      close();
    }
  }
  window.addEventListener('keydown', onKey, true);

  const timer = window.setInterval(() => {
    const now = Date.now();
    const fresh = [];
    for (const id of readyQuests(state.hq, now)) {
      if (!notified.has(id)) {
        notified.add(id);
        fresh.push(id);
      }
    }
    if (!fresh.length) {
      for (const el of heroesDock.querySelectorAll('[data-live]')) {
        const questId = el.dataset.live;
        if (questStatus(state.hq, questId, now) !== 'running') continue;
        const quest = QUEST_BY_ID[questId];
        el.textContent = `${quest.enemy} · ${formatLeft(questProgress(state.hq, questId, now).msLeft)}`;
      }
      for (const el of questsDock.querySelectorAll('[data-left]')) {
        const questId = el.dataset.left;
        if (questStatus(state.hq, questId, now) !== 'running') continue;
        const prog = questProgress(state.hq, questId, now);
        el.textContent = formatLeft(prog.msLeft);
        el.closest('.quest-card')?.querySelector('.quest-bar')?.style.setProperty('--t', String(prog.t));
      }
    } else {
      if (fresh.length === 1) {
        const quest = QUEST_BY_ID[fresh[0]];
        const heroId = state.hq.quests.active[fresh[0]]?.heroId;
        showQuestToast(`<b>${esc(heroName(state.hq, heroId))}</b> is back from the <b>${esc(quest.enemy)}</b>.`);
      } else {
        showQuestToast(`<b>${fresh.length}</b> heroes are back from their quests.`);
      }
      heroHtml = '';
      questHtml = '';
      if (!heroesDock.hidden) paintHeroes(now);
      if (!questsDock.hidden) paintQuests(now);
      saveQuestProgress();
    }
    paintBadge(now);
  }, 1000);

  syncNotified();
  paintBadge();

  return {
    openHeroes,
    openQuests,
    close,
    paintHeroes,
    paintQuests,
    showAway,
    isOpen: () => !heroesDock.hidden || !questsDock.hidden,
    destroy() {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      close();
    },
  };
}
