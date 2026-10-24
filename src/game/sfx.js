/**
 * Sound effects: manifest parsing, variant groups, mixer channels and settings.
 * Pure helpers (no DOM / WebAudio) so node tests can cover them; the player lives in audio.js.
 */

/** Sounds that are peak-limited before they reach the loudness target (Sfx NOTES.md): ~+2.5 dB. */
export const SHORT_SFX_GAIN = 10 ** (2.5 / 20);
const SHORT_GROUPS = new Set(['ui_click', 'tree_chop', 'anvil_hammer', 'mining_pick', 'panel_open', 'panel_close']);

/** Mixer channels shown in Settings → Sound. */
export const SOUND_CHANNELS = ['master', 'music', 'ui', 'world', 'ambience'];
export const DEFAULT_SOUND_MIX = Object.freeze({ master: 1, music: 0.75, ui: 0.8, world: 0.8, ambience: 0.3 });
export const SOUND_MIX_KEY = 'stallhaven.soundMix';
/** The same sound id fired again inside this window is dropped so it does not stack. */
export const SFX_RETRIGGER_MS = 300;

const AMBIENCE = new Set(['shop_ambience_loop', 'sawmill_loop', 'furnace_loop', 'cooking_loop', 'spinning_wheel_loop']);

/** "coin_02" → "coin", "shop_ambience_loop" stays as is. */
export function sfxGroupName(name) {
  return String(name).replace(/_\d+$/, '');
}

export function channelForSfx(entry) {
  if (AMBIENCE.has(entry.name) || entry.loop) return 'ambience';
  if (entry.category === 'ui') return 'ui';
  return 'world'; // world + stingers
}

/** Manifest array → Map(group → [entries]). Drops malformed rows. */
export function parseSfxManifest(list) {
  const groups = new Map();
  if (!Array.isArray(list)) return groups;
  for (const raw of list) {
    if (!raw || typeof raw.file !== 'string' || !/\.ogg$/i.test(raw.file)) continue;
    const name = typeof raw.name === 'string' && raw.name ? raw.name : raw.file.replace(/\.ogg$/i, '');
    const group = sfxGroupName(name);
    const entry = {
      name,
      group,
      file: raw.file,
      mp3: `mp3/${raw.file.replace(/\.ogg$/i, '.mp3')}`,
      category: raw.category || 'world',
      volume: Number.isFinite(raw.volume) ? Math.max(0, Math.min(1, raw.volume)) : 0.8,
      loop: Boolean(raw.loop),
    };
    entry.channel = channelForSfx(entry);
    entry.gain = entry.volume * (SHORT_GROUPS.has(group) ? SHORT_SFX_GAIN : 1);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
  }
  return groups;
}

/** Random variant; avoids repeating the previous pick when there is more than one. */
export function pickSfxVariant(variants, rng = Math.random, last = null) {
  if (!variants?.length) return null;
  if (variants.length === 1) return variants[0];
  let pick = variants[Math.floor(rng() * variants.length) % variants.length];
  if (last && pick.name === last.name) {
    pick = variants[(variants.indexOf(pick) + 1) % variants.length];
  }
  return pick;
}

/** True when `id` played less than SFX_RETRIGGER_MS ago (and records the play otherwise). */
export function createRetriggerGuard(windowMs = SFX_RETRIGGER_MS) {
  const last = new Map();
  return (id, nowMs) => {
    const prev = last.get(id);
    if (prev != null && nowMs - prev < windowMs) return true;
    last.set(id, nowMs);
    return false;
  };
}

export function normalizeSoundMix(raw) {
  const out = { ...DEFAULT_SOUND_MIX };
  if (raw && typeof raw === 'object') {
    for (const key of SOUND_CHANNELS) {
      const v = Number(raw[key]);
      if (Number.isFinite(v)) out[key] = Math.max(0, Math.min(1, v));
    }
  }
  return out;
}

export function loadSoundMix(storage) {
  try {
    const text = storage?.getItem?.(SOUND_MIX_KEY);
    return normalizeSoundMix(text ? JSON.parse(text) : null);
  } catch {
    return normalizeSoundMix(null);
  }
}

export function saveSoundMix(storage, mix) {
  try {
    storage?.setItem?.(SOUND_MIX_KEY, JSON.stringify(normalizeSoundMix(mix)));
  } catch {
    // private mode / quota: the mix still applies for this visit
  }
}

/** Station id → its craft loop, or a one-shot that repeats while crafting. */
export const STATION_LOOPS = Object.freeze({ sawmill: 'sawmill_loop', furnace: 'furnace_loop', range: 'cooking_loop', wheel: 'spinning_wheel_loop', potter: 'spinning_wheel_loop' });
export const STATION_REPEATS = Object.freeze({ anvil: { id: 'anvil_hammer', every: 0.9 }, fletch: { id: 'anvil_hammer', every: 0.9 }, loom: { id: 'loom', every: 1.6 }, cauldron: { id: 'potion_mix', every: 3.2 } });
export const STATION_STARTS = Object.freeze({ sawmill: 'sawmill', furnace: 'furnace', range: 'cooking_range', wheel: 'spinning_wheel', potter: 'spinning_wheel' });
