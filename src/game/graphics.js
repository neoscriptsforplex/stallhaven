// Graphics quality (Low / Medium / High), saved in localStorage, applied live.
import { isPhoneLayout, isTouchHud } from './layoutQuery.js';

export const GRAPHICS_KEY = 'stallhaven-graphics';
export const GRAPHICS_LEVELS = ['low', 'medium', 'high'];
const listeners = new Set();

export function graphicsProfile(level, dpr = 1) {
  if (level === 'low') return { pixelRatio: 1, shadows: false, shadowMap: 512, far: 120, grassDist: 16, anisotropy: 1 };
  if (level === 'medium') return { pixelRatio: Math.min(dpr, 1.5), shadows: true, shadowMap: 512, far: 180, grassDist: 24, anisotropy: 2 };
  return { pixelRatio: Math.min(dpr, 2), shadows: true, shadowMap: 1024, far: 180, grassDist: Infinity, anisotropy: 8 };
}

function store() {
  try { return window.localStorage; } catch { return null; }
}

export function getGraphicsLevel() {
  const saved = store()?.getItem(GRAPHICS_KEY);
  if (GRAPHICS_LEVELS.includes(saved)) return saved;
  return isPhoneLayout() || isTouchHud() ? 'medium' : 'high';
}

export function setGraphicsLevel(level) {
  if (!GRAPHICS_LEVELS.includes(level)) return;
  try { store()?.setItem(GRAPHICS_KEY, level); } catch { /* ignore */ }
  syncButtons();
  for (const fn of listeners) fn(level);
}

export function onGraphicsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function syncButtons() {
  if (typeof document === 'undefined') return;
  const level = getGraphicsLevel();
  for (const b of document.querySelectorAll('[data-graphics]')) {
    const on = b.dataset.graphics === level;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

export function initGraphicsSettings() {
  if (typeof document === 'undefined') return;
  const list = document.querySelector('[data-graphics-list]');
  if (!list || list.dataset.wired) return;
  list.dataset.wired = '1';
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-graphics]');
    if (b) setGraphicsLevel(b.dataset.graphics);
  });
  syncButtons();
}
