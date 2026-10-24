/**
 * Settings → Sound window (#sound-dock) plus the DOM-level UI sounds:
 * button clicks and panel (aside) open/close.
 */
import { getSoundMix, playSfx, setSoundMix } from './audio.js';
import { loadSoundMix, saveSoundMix, SOUND_CHANNELS } from './sfx.js';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Restore the saved mix (music keeps its own saved volume from the Music panel). */
export function restoreSoundMix({ musicVolume } = {}) {
  const mix = loadSoundMix(storage());
  if (Number.isFinite(musicVolume)) mix.music = musicVolume;
  return setSoundMix(mix);
}

export function mountSoundSettings() {
  const dock = document.querySelector('#sound-dock');
  const entry = document.querySelector('[data-settings-sound-open]');
  const settingsDock = document.querySelector('#settings-dock');
  if (!dock) return;

  function paint() {
    const mix = getSoundMix();
    for (const key of SOUND_CHANNELS) {
      const input = dock.querySelector(`[data-sound="${key}"]`);
      const label = dock.querySelector(`[data-sound-label="${key}"]`);
      const pct = Math.round(mix[key] * 100);
      if (input) input.value = String(pct);
      if (label) label.textContent = `${pct}%`;
    }
  }
  function open() {
    if (settingsDock) settingsDock.hidden = true;
    paint();
    dock.hidden = false;
    document.querySelector('#settings-btn')?.classList.add('is-active');
  }
  function close(back) {
    dock.hidden = true;
    if (back) document.querySelector('#settings-btn')?.click();
    else document.querySelector('#settings-btn')?.classList.remove('is-active');
  }
  entry?.addEventListener('click', open);
  dock.querySelector('[data-sound-back]')?.addEventListener('click', () => close(true));
  dock.querySelector('[data-sound-close]')?.addEventListener('click', () => close(false));
  document.querySelector('#settings-btn')?.addEventListener('click', () => {
    if (!dock.hidden) dock.hidden = true;
  });
  dock.addEventListener('input', (event) => {
    const key = event.target?.dataset?.sound;
    if (!key) return;
    const value = Number(event.target.value) / 100;
    const mix = setSoundMix({ [key]: value });
    saveSoundMix(storage(), mix);
    if (key === 'music') {
      // Keep the Music panel slider and its saved volume in step.
      const musicSlider = document.querySelector('[data-music-volume]');
      if (musicSlider) {
        musicSlider.value = String(Math.round(value * 100));
        musicSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    paint();
  });
  document.querySelector('[data-music-volume]')?.addEventListener('input', (event) => {
    if (event.isTrusted) setSoundMix({ music: Number(event.target.value) / 100 });
  });
  paint();
}

/** Click sound on any button press, and open/close sounds for every side panel. */
export function installUiSounds(root = document) {
  root.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('button, [role="button"], .tab');
    if (!btn || btn.disabled || btn.closest('#boot-cover')) return;
    playSfx('ui_click');
  }, true);
  const seen = new WeakMap();
  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      const el = rec.target;
      const hidden = el.hidden;
      if (seen.get(el) === hidden) continue;
      seen.set(el, hidden);
      playSfx(hidden ? 'panel_close' : 'panel_open');
    }
  });
  for (const el of root.querySelectorAll('aside')) {
    seen.set(el, el.hidden);
    observer.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
}
