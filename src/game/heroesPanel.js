/**
 * Heroes dock and hire picker. Quest board painting lands with the quests panel.
 */
import { BUYER_PACKS, formatGold } from './catalog.js';
import {
  HERO_CLASSES,
  HERO_NPC_NAMES,
  QUEST_BY_ID,
  emptyHeroQuestState,
  formatLeft,
  heroClassStatus,
  heroName,
  heroQuest,
  heroTitle,
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
          ? `<button type="button" class="hq-gold-btn" data-quests="${cls.id}">Collect in Quests</button>`
          : `<button type="button" data-quests="${cls.id}">View quest</button>`;
      return `<article class="hero-card">
        <div class="hero-portrait"><img src="${portraitUrl(state.hq.heroes[cls.id].npcId, 'bust')}" alt=""></div>
        <p class="hero-class">${index + 1}. ${cls.label}</p>
        <p class="hero-name">${heroName(state.hq, cls.id)}</p>
        <p class="hero-look">Look: ${HERO_NPC_NAMES[state.hq.heroes[cls.id].npcId] ?? ''}</p>
        ${pill}
        <div class="hero-actions">${action}</div>
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

  function paintQuests() {
    const list = questsDock.querySelector('[data-quest-list]');
    if (!list) return;
    const hired = HERO_CLASSES.some((cls) => state.hq.heroes[cls.id]);
    list.innerHTML = hired
      ? '<div class="quest-empty"><p>Your heroes are ready. Quest fights open from this board.</p></div>'
      : '<div class="quest-empty"><p>You need a hero to send on quests.</p><button type="button" class="hq-gold-btn" data-open-heroes>Hire your first hero · 50,000 gp</button></div>';
    paintBadge();
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

  function openQuests() {
    onOpen?.();
    heroesDock.hidden = true;
    setPressed(heroesBtn, false);
    closePicker();
    questsDock.hidden = false;
    setPressed(questsBtn, true);
    paintQuests();
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
    const hire = event.target.closest('[data-hire]');
    if (hire && !hire.disabled) {
      openPicker(hire.dataset.hire);
      return;
    }
    const go = event.target.closest('[data-quests]');
    if (go) openQuests();
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
    if (hired) document.dispatchEvent(new CustomEvent('rc-save-trigger', { detail: { trigger: 'quest' } }));
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
    if (event.target.closest('[data-open-heroes]')) openHeroes();
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
    if (event.key !== 'Escape') return;
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
    let becameReady = false;
    for (const el of heroesDock.querySelectorAll('[data-live]')) {
      const questId = el.dataset.live;
      if (questStatus(state.hq, questId, now) !== 'running') {
        becameReady = true;
        break;
      }
      const quest = QUEST_BY_ID[questId];
      el.textContent = `${quest.enemy} · ${formatLeft(questProgress(state.hq, questId, now).msLeft)}`;
    }
    if (becameReady) {
      heroHtml = '';
      if (!heroesDock.hidden) paintHeroes(now);
    }
    paintBadge(now);
  }, 1000);

  paintBadge();

  return {
    openHeroes,
    openQuests,
    close,
    paintHeroes,
    paintQuests,
    isOpen: () => !heroesDock.hidden || !questsDock.hidden,
    destroy() {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      close();
    },
  };
}
