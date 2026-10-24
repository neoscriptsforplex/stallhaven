import { isPhoneLayout, onLayoutChange } from './layoutQuery.js';
import { dockBand } from './dockFit.js';
import { MIN_ZOOM } from './phoneCraftFit.js';
// Shared fit for every centred .modal > .sheet (stations, chest, trade, offer, upload, help, away, pickers…).
// The sheet fits the band between the top HUD strip (touch) and the button bar, with a margin:
// scale-to-fit down to 0.8, below that compact (.fit-tight) and the sheet's body scrolls.
// Touch non-phone (unfolded foldable/tablet): capped at ~70% of the viewport, centred.
// Desktop mouse: untouched unless it would overflow. Phone stations keep phoneCraftFit.
const STYLE_KEYS = ['zoom', 'maxHeight', 'maxWidth', 'overflowY'];
export function clearModalFit(modal, sheet) {
  modal.classList.remove('modal-fit', 'fit-tight');
  modal.style.paddingTop = ''; modal.style.paddingBottom = '';
  for (const k of STYLE_KEYS) sheet.style[k] = '';
}
export function fitModal(modal) {
  const sheet = modal?.querySelector(':scope > .sheet');
  if (!sheet) return;
  const phoneCraft = isPhoneLayout() && sheet.classList.contains('craft-sheet');
  if (phoneCraft) return; // phoneCraftFit owns these
  const keep = sheet.scrollTop;
  clearModalFit(modal, sheet);
  if (modal.hidden) return;
  const { top, bottom, touch } = dockBand(8);
  const phone = isPhoneLayout();
  let avail = bottom - top;
  let padTop = top;
  let maxW = innerWidth - 16;
  if (touch && !phone) {
    const cap = Math.round(innerHeight * 0.7);
    if (avail > cap) { padTop = top + Math.round((avail - cap) / 2); avail = cap; }
    maxW = Math.min(maxW, Math.max(360, Math.round(innerWidth * 0.7)));
  }
  const r = sheet.getBoundingClientRect();
  const natural = Math.max(sheet.scrollHeight, r.height);
  const fitsW = r.width <= maxW + 1;
  if (!touch && natural <= avail && fitsW && r.top >= top - 1 && r.bottom <= bottom + 1) return; // desktop look unchanged
  modal.classList.add('modal-fit');
  modal.style.paddingTop = `${padTop}px`;
  modal.style.paddingBottom = `${Math.max(0, innerHeight - padTop - avail)}px`;
  sheet.style.maxWidth = `${maxW}px`;
  let z = Math.min(1, avail / natural, maxW / Math.max(1, r.width));
  if (z < MIN_ZOOM) {
    modal.classList.add('fit-tight');
    const n2 = sheet.scrollHeight;
    z = Math.max(MIN_ZOOM, Math.min(1, avail / n2));
  }
  z = +z.toFixed(3);
  if (z < 1) sheet.style.zoom = String(z);
  sheet.style.maxHeight = `${Math.floor(avail / z)}px`;
  sheet.style.overflowY = 'auto';
  sheet.scrollTop = keep;
  requestAnimationFrame(avoidTutorial);
}
/** Fit every .modal now and whenever one opens, its content changes size, or the layout flips. */
export function autoFitModals(root = document) {
  const modals = [...root.querySelectorAll('.modal')];
  const fitAll = () => { for (const m of modals) if (!m.hidden) fitModal(m); requestAnimationFrame(avoidTutorial); };
  for (const m of modals) {
    new MutationObserver(() => requestAnimationFrame(() => fitModal(m))).observe(m, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(() => requestAnimationFrame(avoidTutorial)).observe(m, { attributes: true, attributeFilter: ['hidden'] });
    m.addEventListener('click', () => requestAnimationFrame(() => { if (!m.hidden) fitModal(m); }));
  }
  onLayoutChange(fitAll);
  fitAll();
  return fitAll;
}

// Side docks (skills, heroes, quests, music, co-op, save files…) and small popups (furniture menu, fish picker).
// Touch: keep them inside the HUD/bar band. Docks scale to fit down to 0.8 then scroll (compact);
// touch non-phone caps them at 70% and centres them. Popups are nudged back inside the band.
const PANEL_KEYS = ['top', 'bottom', 'left', 'right', 'maxHeight', 'width', 'zoom', 'overflowY', 'transform'];
export function fitPanel(el) {
  if (!el || el.id === 'settings-dock' || el.id === 'build-dock' || el.id === 'expand-dock' || el.id === 'place-dock') return;
  const popup = el.classList.contains('furn-menu') || el.classList.contains('fish-picker');
  if (!popup) { for (const k of PANEL_KEYS) el.style[k] = ''; el.classList.remove('panel-fit', 'fit-tight'); }
  if (el.hidden || !el.getClientRects().length) return;
  requestAnimationFrame(avoidTutorial);
  const { top, bottom, touch } = dockBand(8);
  const r = el.getBoundingClientRect();
  const inside = r.top >= top - 1 && r.bottom <= bottom + 1 && r.left >= -1 && r.right <= innerWidth + 1;
  if (inside && (!touch || isPhoneLayout() || popup)) return;
  if (popup) {
    const cs = getComputedStyle(el);
    let dy = 0, dx = 0;
    if (r.bottom > bottom) dy = bottom - r.bottom;
    if (r.top + dy < top) dy = top - r.top;
    if (r.right > innerWidth - 8) dx = innerWidth - 8 - r.right;
    if (r.left + dx < 8) dx = 8 - r.left;
    el.style.top = `${(parseFloat(cs.top) || r.top) + dy}px`; el.style.bottom = 'auto';
    el.style.left = `${(parseFloat(cs.left) || r.left) + dx}px`; el.style.right = 'auto';
    if (r.height > bottom - top) { el.style.maxHeight = `${bottom - top}px`; el.style.overflowY = 'auto'; }
    return;
  }
  el.classList.add('panel-fit');
  let avail = bottom - top, t = top;
  let w = Math.min(r.width, innerWidth - 16);
  if (touch && !isPhoneLayout()) {
    const cap = Math.round(innerHeight * 0.7);
    if (avail > cap) { t = top + Math.round((avail - cap) / 2); avail = cap; }
    w = Math.min(w, Math.max(320, Math.round(innerWidth * 0.7)));
  }
  el.style.width = `${w}px`; el.style.left = `${Math.round((innerWidth - w) / 2)}px`; el.style.right = 'auto'; el.style.transform = 'none';
  const natural = el.scrollHeight;
  let z = Math.min(1, avail / natural);
  if (z < MIN_ZOOM) { el.classList.add('fit-tight'); z = Math.max(MIN_ZOOM, Math.min(1, avail / el.scrollHeight)); }
  z = +z.toFixed(3);
  if (z < 1) el.style.zoom = String(z);
  el.style.top = `${Math.round(t / z)}px`; el.style.bottom = 'auto';
  el.style.left = `${Math.round((innerWidth - w * z) / 2 / z)}px`;
  el.style.maxHeight = `${Math.floor(avail / z)}px`; el.style.overflowY = 'auto';
}
export function autoFitPanels(root = document) {
  const els = [...root.querySelectorAll('.expand-dock, .cs-dock, .furn-menu, .fish-picker')];
  const fitAll = () => { for (const e of els) if (!e.hidden) fitPanel(e); };
  for (const e of els) new MutationObserver(() => requestAnimationFrame(() => { fitPanel(e); avoidTutorial(); })).observe(e, { attributes: true, attributeFilter: ['hidden'] });
  onLayoutChange(fitAll);
  return fitAll;
}

// The tutorial card must never cover an open panel's ✕: while a panel is up, it shrinks to a slim strip
// under the HUD strip/above the bar, on whichever side is clear of the panel's close button.
const X_SEL = '.craft-x, .cs-x, [data-close], [aria-label="Close"], [aria-label^="Close"], button.x, .skills-close, .settings-x, .panel-x';
export function avoidTutorial() {
  const root = document.querySelector('.tut-root');
  if (!root) return;
  root.classList.remove('tut-avoid', 'tut-avoid-top');
  const card = root.querySelector('.tut-card');
  if (!card) return;
  const xs = [...document.querySelectorAll(X_SEL)].filter((x) => !root.contains(x) && x.getClientRects().length && !x.closest('[hidden]'));
  const hit = () => { const c = card.getBoundingClientRect(); return xs.some((x) => { const q = x.getBoundingClientRect(); return q.left < c.right && q.right > c.left && q.top < c.bottom && q.bottom > c.top; }); };
  if (!xs.length || !hit()) return;
  root.classList.add('tut-avoid');
}
