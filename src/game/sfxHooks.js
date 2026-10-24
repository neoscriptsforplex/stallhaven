/**
 * Turns game state changes into sound effects. Pure: the caller passes play/loop
 * functions and a per-frame snapshot, so node tests can drive it.
 */
import { STATION_LOOPS, STATION_REPEATS, STATION_STARTS } from './sfx.js';

export const CHOP_SWING_SEC = 0.75;
export const MINE_SWING_SEC = 0.8;

/** Intent → sound when it succeeds. */
const INTENT_OK = {
  sell: 'coin_sell',
  buyStation: 'purchase',
  buyExpansion: 'purchase',
  buyFurniture: 'purchase',
  restock: 'purchase',
  buyFromCustomer: 'purchase',
  hireHero: 'purchase',
  placePiece: 'build_place',
  movePiece: 'build_place',
  moveFurniture: 'build_place',
  movePatch: 'build_place',
  placeOnDisplay: 'item_drop',
  placeFromChest: 'item_drop',
  fillStand: 'item_drop',
  plantHerb: 'sow_seeds',
  clearDisplay: 'item_pickup',
  pickupPiece: 'item_pickup',
  harvestHerb: 'item_pickup',
  removeFurniture: 'item_pickup',
  collectQuest: 'quest_complete',
};
/** Player-pressed intents whose refusal (can't afford, locked, full) buzzes. */
const INTENT_ERROR = new Set([
  'craft', 'sell', 'buyStation', 'buyExpansion', 'buyFurniture', 'restock', 'buyFromCustomer',
  'placePiece', 'placeOnDisplay', 'placeFromChest', 'fillStand', 'hireHero', 'startQuest', 'upgradeChest', 'plantHerb',
]);
/** Gold rises from these are already voiced (coin_sell / quest stinger). */
const GOLD_VOICED = new Set(['sell', 'collectQuest', 'sellPiece', 'pickupPiece', 'removeFurniture']);

export function intentSound(intent, result) {
  const type = intent?.type;
  if (!type) return null;
  if (result?.ok) return INTENT_OK[type] ?? null;
  if (INTENT_ERROR.has(type) && result && result.reason !== 'no-state') return 'ui_error';
  return null;
}

/** Fire pieces whose crackle the player hears up close. */
export const FIRE_PIECES = new Set(['fire', 'fireplace', 'fancy_fireplace', 'fire_outdoor', 'fireplace_light', 'fancy_fireplace_light']);
export const FIRE_FULL_DIST = 2;
export const FIRE_SILENT_DIST = 5;

/** Distance to the nearest fire (m) → crackle gain 0..1 (full within 2 m, silent past 5 m). */
export function fireCrackleGain(dist) {
  if (!Number.isFinite(dist) || dist >= FIRE_SILENT_DIST) return 0;
  if (dist <= FIRE_FULL_DIST) return 1;
  const g = 1 - (dist - FIRE_FULL_DIST) / (FIRE_SILENT_DIST - FIRE_FULL_DIST);
  return Math.round(g * 20) / 20;
}

/** Pick-pop variants and how far into each file the pop lands (s); played that early so the pop meets the end of the pick. */
export const PICK_POP_OFFSETS = {
  flax: { pick_flax_01: 0.24, pick_flax_02: 0.21 },
  wheat: { pick_wheat_01: 0.24, pick_wheat_02: 0.24 },
};

export function createSfxDirector({ play, loop, rng = Math.random }) {
  let pickPop = null;
  let lastFillStart = null;
  let lastGold = null;
  let goldVoicedUntil = -Infinity;
  let stations = new Set();
  const repeatAt = new Map();
  let swing = null;
  let lastFishStart = null;
  let ambience = 0;
  let herbsReady = null;

  function onIntent(intent, result, now) {
    const id = intentSound(intent, result);
    if (id) play(id);
    if (result?.ok && GOLD_VOICED.has(intent.type)) goldVoicedUntil = now + 0.25;
  }

  function frame(snap, now) {
    // Gold gains (not sales, which already play coin_sell).
    if (Number.isFinite(snap.gold)) {
      if (lastGold != null && snap.gold > lastGold && now > goldVoicedUntil) play('coin');
      lastGold = snap.gold;
    }
    // Station loops and repeating craft sounds while a craft is running there.
    const next = new Set(snap.stations ?? []);
    for (const st of next) {
      if (!stations.has(st)) {
        if (STATION_STARTS[st]) play(STATION_STARTS[st]);
        repeatAt.set(st, now);
      }
      const rep = STATION_REPEATS[st];
      if (rep && now >= (repeatAt.get(st) ?? now)) {
        play(rep.id);
        repeatAt.set(st, now + rep.every);
      }
    }
    for (const [st, name] of Object.entries(STATION_LOOPS)) loop(name, next.has(st));
    for (const st of stations) if (!next.has(st)) repeatAt.delete(st);
    stations = next;
    // Gathering swings.
    const m = snap.mining;
    if (m && (m.mode === 'chop' || m.mode === 'mine')) {
      const period = m.mode === 'chop' ? CHOP_SWING_SEC : MINE_SWING_SEC;
      if (!swing || swing.mode !== m.mode) swing = { mode: m.mode, at: now + period * 0.5 };
      if (now >= swing.at) {
        play(m.mode === 'chop' ? 'tree_chop' : 'mining_pick');
        swing.at = now + period;
      }
    } else swing = null;
    if (m?.mode === 'fish') {
      if (lastFishStart !== m.startedAt) play('fishing_splash');
      lastFishStart = m.startedAt;
    } else lastFishStart = null;
    // Flax/wheat: the pop transient lands as the plant comes out at the end of the pick.
    if (m?.mode === 'pick' && PICK_POP_OFFSETS[m.crop] && Number.isFinite(m.duration)) {
      if (!pickPop || pickPop.startedAt !== m.startedAt) {
        const names = Object.keys(PICK_POP_OFFSETS[m.crop]);
        const variant = names[Math.floor(rng() * names.length) % names.length];
        const at = m.startedAt + Math.max(0, m.duration - PICK_POP_OFFSETS[m.crop][variant]);
        pickPop = { startedAt: m.startedAt, group: `pick_${m.crop}`, variant, at, done: false };
      }
      if (!pickPop.done && now >= pickPop.at) {
        play(pickPop.group, { variant: pickPop.variant });
        pickPop.done = true;
      }
    } else pickPop = null;
    // Fountain: one fill sound per bucket-fill bar.
    if (m?.mode === 'fill') {
      if (lastFillStart !== m.startedAt) play('fill_bucket');
      lastFillStart = m.startedAt;
    } else lastFillStart = null;
    // Farming: a shimmer when another herb patch finishes growing.
    if (Number.isFinite(snap.herbsReady)) {
      if (herbsReady != null && snap.herbsReady > herbsReady) play('herb_grown');
      herbsReady = snap.herbsReady;
    }
    // Hearth crackle: only near a placed Fire or fireplace, fading with distance.
    const amb = fireCrackleGain(snap.fireDist);
    if (amb !== ambience) {
      loop('shop_ambience_loop', amb > 0, amb);
      ambience = amb;
    }
  }

  return { frame, onIntent };
}
