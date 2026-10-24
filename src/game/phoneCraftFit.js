import { isPhoneLayout } from './layoutQuery.js';
// Narrow phone (e.g. 344px folded): station windows never scroll vertically.
// Scale-to-fit down to MIN_ZOOM; below that switch to the compact "is-tight" layout and refit.
export const MIN_ZOOM = 0.8;
export function phoneCraftZoom(natural, avail, tightNatural = natural) {
  if (!(natural > 0) || !(avail > 0)) return { zoom: 1, tight: false };
  const z = avail / natural;
  if (z >= 1) return { zoom: 1, tight: false };
  if (z >= MIN_ZOOM) return { zoom: +z.toFixed(3), tight: false };
  const zt = avail / (tightNatural || natural);
  return { zoom: +Math.max(0.6, Math.min(1, zt)).toFixed(3), tight: true };
}
function limits() {
  const top = Math.max(8, (document.querySelector('#hud .ledger')?.getBoundingClientRect().bottom ?? 0) + 6);
  const bar = document.getElementById('save-bar')?.getBoundingClientRect();
  const bottom = (bar && bar.top > innerHeight / 2 ? bar.top : innerHeight) - 6;
  return { top, bottom };
}
export function fitPhoneCraft(modal) {
  const sheet = modal?.querySelector('.craft-sheet');
  if (!sheet) return;
  const clear = () => { modal.classList.remove('phone-fit', 'is-tight'); sheet.style.zoom = ''; sheet.style.maxHeight = ''; sheet.style.height = ''; modal.style.paddingTop = ''; modal.style.paddingBottom = ''; };
  clear();
  if (modal.hidden || !isPhoneLayout()) return;
  const { top, bottom } = limits();
  const avail = bottom - top;
  const measure = () => { sheet.style.maxHeight = 'none'; const h = sheet.scrollHeight; sheet.style.maxHeight = ''; return h; };
  modal.classList.add('phone-fit', 'is-measuring');
  modal.style.paddingTop = `${top}px`; modal.style.paddingBottom = `${innerHeight - bottom}px`;
  const natural = measure();
  let tightNatural = natural;
  if (avail / natural < MIN_ZOOM) { modal.classList.add('is-tight'); tightNatural = measure(); }
  modal.classList.remove('is-measuring');
  const { zoom, tight } = phoneCraftZoom(natural, avail, tightNatural);
  modal.classList.toggle('is-tight', tight);
  sheet.style.zoom = String(zoom);
  // Cap to the band; the recipe list (flex) absorbs any remainder so the sheet itself never scrolls.
  sheet.style.maxHeight = `${Math.floor(avail / zoom)}px`;
}
