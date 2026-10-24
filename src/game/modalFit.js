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
}
/** Fit every .modal now and whenever one opens, its content changes size, or the layout flips. */
export function autoFitModals(root = document) {
  const modals = [...root.querySelectorAll('.modal')];
  const fitAll = () => { for (const m of modals) if (!m.hidden) fitModal(m); };
  for (const m of modals) {
    new MutationObserver(() => requestAnimationFrame(() => fitModal(m))).observe(m, { attributes: true, attributeFilter: ['hidden'] });
    m.addEventListener('click', () => requestAnimationFrame(() => { if (!m.hidden) fitModal(m); }));
  }
  onLayoutChange(fitAll);
  fitAll();
  return fitAll;
}
