/** Shop/dungeon light levels. Shop is a modest bump over the old 0.9 hemi / 1.05 exposure. */

export const SHOP_LIGHT = {
  hemi: 1.14,
  ambient: 0.24,
  fill: 0.48,
  door: 2.2,
  sun: 1.15,
  exposure: 1.12,
};

/** Dungeon base lights vs the previous cave values. Shop base is unchanged. */
export const DUNGEON_LIGHT_BOOST = 2.5;
export const DUNGEON_LIGHT = {
  hemi: 0.46 * DUNGEON_LIGHT_BOOST,
  ambient: 0.06 * DUNGEON_LIGHT_BOOST,
  fill: 0,
  door: 0,
  sun: 0.35 * DUNGEON_LIGHT_BOOST,
  exposure: 0.94,
};

/** 100% on the shop brightness slider — the shop lighting bump. */
export const BRIGHTNESS_NEUTRAL = 1;
export const BRIGHTNESS_MIN = 0.5;
export const BRIGHTNESS_MAX = 1.5;
/** New players / unset settings start at the slider maximum (full bright). */
export const DEFAULT_BRIGHTNESS = BRIGHTNESS_MAX;
export const BRIGHTNESS_STORAGE_KEY = 'stallhaven-brightness';
/** Dungeon-only slider: 0% to 150% of the cave baseline. Independent of shop brightness. */
export const DUNGEON_BRIGHTNESS_MIN = 0;
export const DUNGEON_BRIGHTNESS_MAX = 1.5;
export const DEFAULT_DUNGEON_BRIGHTNESS = DUNGEON_BRIGHTNESS_MAX;
export const DUNGEON_BRIGHTNESS_STORAGE_KEY = 'stallhaven-dungeon-brightness';
export const PHOTO_MODE_STORAGE_KEY = 'stallhaven-photo-mode';

export function clampBrightness(value, fallback = DEFAULT_BRIGHTNESS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, n));
}

export function clampDungeonBrightness(value, fallback = DEFAULT_DUNGEON_BRIGHTNESS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(DUNGEON_BRIGHTNESS_MAX, Math.max(DUNGEON_BRIGHTNESS_MIN, n));
}

export function readStoredBrightness() {
  if (typeof localStorage === 'undefined') return DEFAULT_BRIGHTNESS;
  try {
    const raw = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT_BRIGHTNESS;
    return clampBrightness(raw, DEFAULT_BRIGHTNESS);
  } catch {
    return DEFAULT_BRIGHTNESS;
  }
}

export function writeStoredBrightness(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(clampBrightness(value)));
  } catch {
    // Private mode / quota — save JSON still keeps the value.
  }
}

export function readStoredDungeonBrightness() {
  if (typeof localStorage === 'undefined') return DEFAULT_DUNGEON_BRIGHTNESS;
  try {
    const raw = localStorage.getItem(DUNGEON_BRIGHTNESS_STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT_DUNGEON_BRIGHTNESS;
    return clampDungeonBrightness(raw, DEFAULT_DUNGEON_BRIGHTNESS);
  } catch {
    return DEFAULT_DUNGEON_BRIGHTNESS;
  }
}

export function writeStoredDungeonBrightness(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DUNGEON_BRIGHTNESS_STORAGE_KEY, String(clampDungeonBrightness(value)));
  } catch {
    // Private mode / quota — save JSON still keeps the value.
  }
}

export function readStoredPhotoMode() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(PHOTO_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeStoredPhotoMode(on) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PHOTO_MODE_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Private mode / quota — save JSON still keeps the value.
  }
}

export function brightnessPercent(value) {
  return Math.round(clampBrightness(value) * 100);
}

export function dungeonBrightnessPercent(value) {
  return Math.round(clampDungeonBrightness(value) * 100);
}

/** Shop/outdoor use the shop slider. Dungeon uses its own 0–150% slider. */
export function brightnessForScene(
  mode = 'shop',
  brightness = DEFAULT_BRIGHTNESS,
  dungeonBrightness = DEFAULT_DUNGEON_BRIGHTNESS,
) {
  if (mode === 'dungeon') return clampDungeonBrightness(dungeonBrightness);
  return clampBrightness(brightness);
}

export function lightingForScene(
  mode = 'shop',
  brightness = DEFAULT_BRIGHTNESS,
  dungeonBrightness = DEFAULT_DUNGEON_BRIGHTNESS,
) {
  const base = mode === 'dungeon' ? DUNGEON_LIGHT : SHOP_LIGHT;
  const mul = brightnessForScene(mode, brightness, dungeonBrightness);
  return {
    hemi: base.hemi * mul,
    ambient: base.ambient * mul,
    fill: base.fill * mul,
    door: base.door * mul,
    sun: base.sun * mul,
    exposure: base.exposure * mul,
  };
}

export function applySceneLighting(
  lights,
  mode = 'shop',
  brightness = DEFAULT_BRIGHTNESS,
  dungeonBrightness = DEFAULT_DUNGEON_BRIGHTNESS,
) {
  const next = lightingForScene(mode, brightness, dungeonBrightness);
  if (lights.hemi) lights.hemi.intensity = next.hemi;
  if (lights.ambient) lights.ambient.intensity = next.ambient;
  if (lights.fill) lights.fill.intensity = next.fill;
  if (lights.door) lights.door.intensity = next.door;
  if (lights.sun) lights.sun.intensity = next.sun;
  if (lights.renderer) lights.renderer.toneMappingExposure = next.exposure;
  return next;
}
