/**
 * Heroes + Quests: data and pure logic (draft for Maker, not in the game yet).
 * No DOM, no three.js, so it runs under `node --test` like the other src/game/*.js modules.
 * Every timer is wall-clock (Date.now()), never playTime, so quests keep running while the game is closed.
 */

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Hire order is fixed. `customerId` is the CUSTOMERS / BUYER_PACKS key in catalog.js. */
export const HERO_CLASSES = [
  { id: 'adventurer', label: 'Adventurer', title: 'Adventurer', customerId: 'pilgrim', price: 50_000 },
  { id: 'melee', label: 'Melee', title: 'Warrior', customerId: 'mercenary', price: 250_000 },
  { id: 'ranger', label: 'Ranger', title: 'Ranger', customerId: 'ranger', price: 5_000_000 },
  { id: 'mage', label: 'Mage', title: 'Mage', customerId: 'hedgemage', price: 25_000_000 },
];

/** Random hero names (fantasy / RuneScape flavour). One is picked at hire time; no two hired heroes share one. */
export const HERO_NAMES = [
  'Sir Aldric', 'Wren', 'Thalia', 'Grimbold', 'Brannoc', 'Elowen', 'Sir Cedric', 'Morwen',
  'Torvald', 'Isolde', 'Fenwick', 'Rowena', 'Garrick', 'Lyra', 'Dunstan', 'Seren',
  'Hilda', 'Osric', 'Kestrel', 'Bramwell', 'Dame Elspeth', 'Thorne', 'Gwendolyn', 'Harlow',
  'Bjorn', 'Ysolde', 'Corwin', 'Maelis', 'Ulfric', 'Tamsin', 'Roderick', 'Brynja',
  'Ashby', 'Sigrun', 'Percival', 'Nell', 'Haldor', 'Linnea', 'Gideon', 'Saradine',
];

/** Picks a name no hired hero already has. `rand` is injectable for tests. */
export function pickHeroName(hq, rand = Math.random) {
  const taken = new Set(Object.values(hq.heroes).filter(Boolean).map((h) => h.name));
  const free = HERO_NAMES.filter((n) => !taken.has(n));
  const pool = free.length ? free : HERO_NAMES;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** 'Wren' */
export function heroName(hq, classId) {
  return hq.heroes[classId]?.name ?? '';
}

/** 'Wren the Ranger' (Melee reads 'the Warrior'). */
export function heroTitle(hq, classId) {
  const cls = HERO_CLASSES.find((c) => c.id === classId);
  return hq.heroes[classId] ? `${heroName(hq, classId)} the ${cls.title}` : '';
}

/** Display names for the hireable NPCs, keyed by BUYER_PACKS id. Names come from the model dumps. */
export const HERO_NPC_NAMES = {
  'buyer-adventurer-bob': 'Bob',
  'buyer-adventurer-cooking-tutor': 'Cooking Tutor',
  'buyer-adventurer-donie': 'Donie',
  'buyer-adventurer-man-level-2': 'Man',
  'buyer-adventurer-woman-level-2': 'Woman',
  'buyer-guard-barbarian-level-17': 'Barbarian',
  'buyer-guard-guard-level-21': 'Guard',
  'buyer-ranger-armour-salesman': 'Armour Salesman',
  'buyer-ranger-ranging-guild-doorman': 'Ranging Guild Doorman',
  'buyer-wizard-archmage-sedridor': 'Archmage Sedridor',
  'buyer-wizard-wizard-level-9': 'Wizard',
  'buyer-wizard-wizard-grayzag': 'Wizard Grayzag',
  'buyer-wizard-wizard-jalarast': 'Wizard Jalarast',
  'buyer-wizard-wizard-mizgog': 'Wizard Mizgog',
  'buyer-wizard-wizard-traiborn': 'Wizard Traiborn',
};

export const QUEST_TABS = [
  { id: 'min1', label: '1 min' },
  { id: 'min15', label: '15 min' },
  { id: 'min30', label: '30 min' },
  { id: 'hr1', label: '1 hr' },
  { id: 'day1', label: '1 day' },
  { id: 'dragon', label: 'Dragon Hide' },
];

/** Each tab opens after this many total completions of the tab before it. */
export const QUEST_TAB_UNLOCK = Object.freeze({
  min15: Object.freeze({ tab: 'min1', count: 50 }),
  min30: Object.freeze({ tab: 'min15', count: 40 }),
  hr1: Object.freeze({ tab: 'min30', count: 30 }),
  day1: Object.freeze({ tab: 'hr1', count: 20 }),
});

/** Dragonhide quests need this Crafting level. */
export const DRAGON_QUEST_CRAFTING = Object.freeze({ green_dragon: 25, blue_dragon: 45, red_dragon: 50, black_dragon: 75 });

const ORES = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'runite', 'dragon'];
const each = (ids, n) => Object.fromEntries(ids.map((id) => [id, n]));

/**
 * Rewards are material ids -> amount. Ids marked NEW in SPEC.md do not exist in MATERIALS yet.
 * Moss Giant pays 10 of each real herb.
 */
const HERB_IDS = ['guam', 'marrentill', 'tarromin', 'harralander', 'ranarr', 'lantadyme', 'dwarf_weed'];
export const QUESTS = [
  { id: 'imp', tab: 'min1', enemy: 'Imp', render: 'icons/quests/imp.png', icon: 'horns', tint: '#c4462e', duration: 1 * MIN, rewards: { molten_glass: 5 } },
  { id: 'chicken', tab: 'min1', enemy: 'Chicken', render: 'icons/quests/chicken.png', icon: 'beak', tint: '#e8dcc0', duration: 1 * MIN, rewards: { egg: 5 } },
  { id: 'cow', tab: 'min1', enemy: 'Cow', render: 'icons/quests/cow.png', icon: 'hoof', tint: '#8a5a3a', duration: 1 * MIN, rewards: { hide: 5 } },
  { id: 'goblin', tab: 'min15', enemy: 'Goblin', render: 'icons/quests/goblin.png', icon: 'head', tint: '#5f8a3a', duration: 15 * MIN, rewards: { raspberry: 5, pineapple: 5, chocolate: 5 } },
  { id: 'giant_spider', tab: 'min15', enemy: 'Giant Spider', render: 'icons/quests/giant_spider.png', icon: 'spider', tint: '#4a3a4a', duration: 15 * MIN, rewards: { cloth: 50 } },
  { id: 'grizzly_bear', tab: 'min15', enemy: 'Grizzly Bear', render: 'icons/quests/grizzly_bear.png', icon: 'paw', tint: '#6a4428', duration: 15 * MIN, rewards: { hide: 50 } },
  { id: 'giant_rat', tab: 'min30', enemy: 'Giant Rat', render: 'icons/quests/giant_rat.png', icon: 'paw', tint: '#7a6a5a', duration: 30 * MIN, rewards: { soft_clay: 10 } },
  { id: 'skeleton', tab: 'min30', enemy: 'Skeleton', render: 'icons/quests/skeleton.png', icon: 'skull', tint: '#e6dcc4', duration: 30 * MIN, rewards: { orb: 5 } },
  { id: 'scorpion', tab: 'min30', enemy: 'Scorpion', render: 'icons/quests/scorpion.png', icon: 'claw', tint: '#b8862f', duration: 30 * MIN, rewards: { steel_bar: 50 } },
  { id: 'ghost', tab: 'hr1', enemy: 'Ghost', render: 'icons/quests/ghost.png', icon: 'ghost', tint: '#b7e3f5', duration: 1 * HOUR, rewards: { orb: 20 } },
  { id: 'moss_giant', tab: 'hr1', enemy: 'Moss Giant', render: 'icons/quests/moss_giant.png', icon: 'head', tint: '#3a8a45', duration: 1 * HOUR, rewards: each(HERB_IDS, 10) },
  { id: 'pirate', tab: 'hr1', enemy: 'Pirate', render: 'icons/quests/pirate.png', icon: 'head', tint: '#8a2424', duration: 1 * HOUR, rewards: each(ORES, 20) },
  { id: 'dark_wizard', tab: 'day1', enemy: 'Dark Wizard', render: 'icons/quests/grayzag.png', iconBright: 1.35, icon: 'hat', tint: '#3a2a52', duration: 1 * DAY, rewards: { essence: 500 } },
  { id: 'vampyre', tab: 'day1', enemy: 'Vampyre', render: 'icons/quests/vampyre.png', icon: 'fangs', tint: '#6a1c28', duration: 1 * DAY, rewards: { dragon_bar: 50 } },
  { id: 'lesser_demon', tab: 'day1', enemy: 'Lesser Demon', render: 'icons/quests/lesser_demon.png', icon: 'horns', tint: '#a82a1c', duration: 1 * DAY, rewards: { dwarven_plans: 1 } },
  { id: 'kalphite', tab: 'day1', enemy: 'Kalphite', render: 'icons/quests/kalphite.png', iconBright: 1.45, icon: 'claw', tint: '#6a8a3a', duration: 1 * DAY, rewards: { ancient_plans: 1 } },
  { id: 'green_dragon', tab: 'dragon', enemy: 'Green Dragon', render: 'icons/quests/green_dragon.png', icon: 'dragon', tint: '#2d6a32', duration: 15 * MIN, rewards: { green_dhide: 50 } },
  { id: 'blue_dragon', tab: 'dragon', enemy: 'Blue Dragon', render: 'icons/quests/blue_dragon.png', icon: 'dragon', tint: '#2a4a8a', duration: 30 * MIN, rewards: { blue_dhide: 50 } },
  { id: 'red_dragon', tab: 'dragon', enemy: 'Red Dragon', render: 'icons/quests/red_dragon.png', icon: 'dragon', tint: '#8a2424', duration: 45 * MIN, rewards: { red_dhide: 50 } },
  { id: 'black_dragon', tab: 'dragon', enemy: 'Black Dragon', render: 'icons/quests/black_dragon.png', iconBright: 1.4, icon: 'dragon', tint: '#1c1c1c', duration: 1 * HOUR, rewards: { black_dhide: 50 } },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** New MATERIALS entries the quests need (same shape as dwarven_plans: no regen, quest-only). */
export const NEW_MATERIALS = {
  molten_glass: { id: 'molten_glass', name: 'Molten Glass', restock: 0, start: 0, tier: 2, regenEvery: 0, quest: true, tint: 0xe8a040 },
  green_dhide: { id: 'green_dhide', name: 'Green Dragonhide', restock: 0, start: 0, tier: 4, regenEvery: 0, quest: true, tint: 0x2d6a32 },
  blue_dhide: { id: 'blue_dhide', name: 'Blue Dragonhide', restock: 0, start: 0, tier: 5, regenEvery: 0, quest: true, tint: 0x5b8ee6 },
  red_dhide: { id: 'red_dhide', name: 'Red Dragonhide', restock: 0, start: 0, tier: 6, regenEvery: 0, quest: true, tint: 0x8a2424 },
  black_dhide: { id: 'black_dhide', name: 'Black Dragonhide', restock: 0, start: 0, tier: 7, regenEvery: 0, quest: true, tint: 0x6a6a72 },
};

// ---------- State ----------

/** Save shape: `heroes` and `quests` go next to `skills` in serializeState(). */
export function emptyHeroQuestState() {
  return {
    heroes: { adventurer: null, melee: null, ranger: null, mage: null },
    quests: { active: {}, done: {} },
    lastSeenAt: 0,
  };
}

/** Defensive load: drops unknown classes or quests, bad timestamps, and a hero listed on two quests. */
export function normalizeHeroQuestState(raw, now = Date.now()) {
  const next = emptyHeroQuestState();
  for (const cls of HERO_CLASSES) {
    const h = raw?.heroes?.[cls.id];
    if (h && typeof h.npcId === 'string' && HERO_NPC_NAMES[h.npcId]) {
      next.heroes[cls.id] = { npcId: h.npcId, name: null, hiredAt: Number.isFinite(h.hiredAt) ? h.hiredAt : now };
    }
  }
  // Keep saved names (any non-empty string up to 24 chars, so a future rename survives). Missing or duplicate names get a fresh pick.
  const seen = new Set();
  for (const cls of HERO_CLASSES) {
    const hero = next.heroes[cls.id];
    const saved = hero && raw.heroes[cls.id].name;
    if (typeof saved === 'string' && saved.trim() && saved.length <= 24 && !seen.has(saved.trim())) { hero.name = saved.trim(); seen.add(hero.name); }
  }
  for (const cls of HERO_CLASSES) {
    const hero = next.heroes[cls.id];
    if (hero && !hero.name) hero.name = pickHeroName(next);
  }
  const busy = new Set();
  for (const [questId, run] of Object.entries(raw?.quests?.active ?? {})) {
    const quest = QUEST_BY_ID[questId];
    if (!quest || !run || !next.heroes[run.heroId] || busy.has(run.heroId)) continue;
    if (!Number.isFinite(run.startedAt)) continue;
    // A clock set backwards would push the end into the far future; cap a start in the future at now.
    const startedAt = Math.min(run.startedAt, now);
    next.quests.active[questId] = { heroId: run.heroId, startedAt, endsAt: startedAt + quest.duration };
    busy.add(run.heroId);
  }
  for (const [questId, n] of Object.entries(raw?.quests?.done ?? {})) {
    if (QUEST_BY_ID[questId] && Number.isFinite(n) && n > 0) next.quests.done[questId] = Math.floor(n);
  }
  next.lastSeenAt = Number.isFinite(raw?.lastSeenAt) ? raw.lastSeenAt : 0;
  return next;
}

// ---------- Heroes ----------

export function nextHireClass(hq) {
  return HERO_CLASSES.find((cls) => !hq.heroes[cls.id]) ?? null;
}

/** 'hired' | 'next' | 'locked' for the class card. */
export function heroClassStatus(hq, classId) {
  if (hq.heroes[classId]) return 'hired';
  return nextHireClass(hq)?.id === classId ? 'next' : 'locked';
}

export function heroQuest(hq, classId) {
  return Object.entries(hq.quests.active).find(([, run]) => run.heroId === classId)?.[0] ?? null;
}

/** Spends gold from the game state (`state.gold`). Returns false and changes nothing if not allowed. */
export function hireHero(state, hq, classId, npcId, rand = Math.random) {
  const cls = HERO_CLASSES.find((c) => c.id === classId);
  if (!cls || heroClassStatus(hq, classId) !== 'next') return false;
  if (!String(npcId).startsWith(`buyer-${{ pilgrim: 'adventurer', mercenary: 'guard', ranger: 'ranger', hedgemage: 'wizard' }[cls.customerId]}-`)) return false;
  if (!HERO_NPC_NAMES[npcId] || (state.gold ?? 0) < cls.price) return false;
  state.gold -= cls.price;
  hq.heroes[classId] = { npcId, name: pickHeroName(hq, rand), hiredAt: Date.now() };
  return true;
}

/** Retire a hired hero: frees the class slot and drops their running quest (no reward). */
export function retireHero(hq, classId) {
  if (!hq?.heroes?.[classId]) return false;
  for (const [questId, run] of Object.entries(hq.quests?.active ?? {})) {
    if (run.heroId === classId) delete hq.quests.active[questId];
  }
  hq.heroes[classId] = null;
  return true;
}

// ---------- Quests ----------

/** 'idle' | 'running' | 'ready' */
export function questStatus(hq, questId, now = Date.now()) {
  const run = hq.quests.active[questId];
  if (!run) return 'idle';
  return now >= run.endsAt ? 'ready' : 'running';
}

export function questProgress(hq, questId, now = Date.now()) {
  const run = hq.quests.active[questId];
  if (!run) return { t: 0, msLeft: 0 };
  const total = run.endsAt - run.startedAt;
  const left = Math.max(0, run.endsAt - now);
  return { t: total > 0 ? 1 - left / total : 1, msLeft: left };
}

/** Total completions of every quest in one tab. */
export function tabCompletions(hq, tabId) {
  return QUESTS.filter((q) => q.tab === tabId).reduce((sum, q) => sum + (hq?.quests?.done?.[q.id] ?? 0), 0);
}

/** '' when the quest can start, else why it is locked. */
export function questLockReason(hq, questId, craftingLevel = 1) {
  const quest = QUEST_BY_ID[questId];
  if (!quest) return 'Unknown quest.';
  const gate = QUEST_TAB_UNLOCK[quest.tab];
  if (gate) {
    const have = tabCompletions(hq, gate.tab);
    if (have < gate.count) {
      const label = QUEST_TABS.find((t) => t.id === gate.tab)?.label ?? gate.tab;
      return `Finish ${gate.count - have} more ${label} quests to unlock.`;
    }
  }
  const need = DRAGON_QUEST_CRAFTING[questId];
  if (need && craftingLevel < need) return `Needs Crafting level ${need}.`;
  return '';
}

export function idleHeroes(hq) {
  return HERO_CLASSES.filter((cls) => hq.heroes[cls.id] && !heroQuest(hq, cls.id)).map((cls) => cls.id);
}

export function startQuest(hq, questId, heroId, now = Date.now(), craftingLevel = 1) {
  const quest = QUEST_BY_ID[questId];
  if (!quest || questLockReason(hq, questId, craftingLevel) || hq.quests.active[questId] || !hq.heroes[heroId] || heroQuest(hq, heroId)) return false;
  hq.quests.active[questId] = { heroId, startedAt: now, endsAt: now + quest.duration };
  return true;
}

/** Hands the rewards to `grant(materialId, amount)` and frees the hero. Only works once the timer is done. */
export function collectQuest(hq, questId, grant, now = Date.now()) {
  if (questStatus(hq, questId, now) !== 'ready') return null;
  const quest = QUEST_BY_ID[questId];
  for (const [id, n] of Object.entries(quest.rewards)) grant(id, n); // pass (id, n) => grantQuestReward(state.materials, id, n)
  delete hq.quests.active[questId];
  hq.quests.done[questId] = (hq.quests.done[questId] ?? 0) + 1;
  return quest.rewards;
}

/** Sends the hero home with no reward and no completion. Works while the fight is still running. */
export function recallQuest(hq, questId) {
  if (!hq?.quests?.active?.[questId]) return false;
  delete hq.quests.active[questId];
  return true;
}

export function readyQuests(hq, now = Date.now()) {
  return Object.keys(hq.quests.active).filter((id) => questStatus(hq, id, now) === 'ready');
}

/** For the "While you were away" popup after boot or Load: quests that finished after lastSeenAt. */
export function finishedWhileAway(hq, now = Date.now()) {
  return readyQuests(hq, now).filter((id) => hq.quests.active[id].endsAt > (hq.lastSeenAt || 0));
}

/** 42s, 9:12, 1:04:09, 23h 59m */
export function formatLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600 * 10) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (m) return `${m}:${String(sec).padStart(2, '0')}`;
  return `${sec}s`;
}

export function formatDuration(ms) {
  if (ms >= DAY) return `${ms / DAY} day`;
  if (ms >= HOUR) return `${ms / HOUR} hr`;
  return `${ms / MIN} min`;
}

// ---------- Storage cap (Luke, 2026-10-18) ----------
/** Mirrors MATERIAL_CAP in src/game/layout.js. */
export const MATERIAL_CAP = 250;

/**
 * Per-material cap. ASSUMED v1: the cap grows with the existing chest level so "Upgrade chest" frees space
 * (L1 250, L2 500 … L10 2,500). Pass chestLevel 1 to keep today's flat 250.
 */
export function materialCap(chestLevel = 1) {
  const lv = Math.max(1, Math.min(10, Math.round(Number(chestLevel) || 1)));
  return MATERIAL_CAP * lv;
}

/** Quest rewards are never clipped: they may push a material past its cap. */
export function grantQuestReward(materials, materialId, amount) {
  const add = Math.max(0, Math.round(Number(amount) || 0));
  if (!add || !materials) return 0;
  materials[materialId] = (materials[materialId] ?? 0) + add;
  return add;
}

/** At or over the cap = full. Full materials block crafting and gathering that would add more. */
export function isMaterialFull(materials, materialId, cap = MATERIAL_CAP) {
  return (Number(materials?.[materialId]) || 0) >= cap;
}

/** Which of an action's outputs are full. Empty array = allowed. Use for craft buttons and gathering starts. */
export function fullOutputs(materials, outputIds, cap = MATERIAL_CAP) {
  return outputIds.filter((id) => isMaterialFull(materials, id, cap));
}

// ---------- D'hide recipes (Luke, 2026-10-18) ----------
export const DHIDE_COLOURS = ['green', 'blue', 'red', 'black'];
export const DHIDE_PIECE_IDS = ['dragon_mask', 'dhide_body', 'dhide_chaps', 'dhide_vambraces', 'dhide_boots'];

/** recipeId -> new materials cost. Each piece swaps `hide: 1` for 1 matching coloured dragonhide; gold is unchanged. */
export const DHIDE_RECIPE_COSTS = Object.fromEntries(DHIDE_COLOURS.flatMap((c) =>
  DHIDE_PIECE_IDS.map((piece) => [`${c}_${piece}`, { [`${c}_dhide`]: 1 }])));
