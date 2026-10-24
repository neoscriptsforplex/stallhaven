import { TOUCH_HUD_QUERY, isPhoneLayout } from './layoutQuery.js';
// Shared "roomy dock" fit: a fixed-width panel whose header (h2 + ✕) stays put while its body scrolls.
// Height is capped to the band between the top HUD strip and the bottom button bar (with a margin).
// Desktop: keeps its CSS placement (top-right). Touch non-phone (unfolded foldable/tablet): centred, ≤70% of the
// viewport. Phone: full-width sheet in the band, compact styles via .is-compact.
export function dockBand(margin = 8) {
  const touch = typeof matchMedia === 'function' && matchMedia(TOUCH_HUD_QUERY).matches;
  const led = document.querySelector('#hud .ledger')?.getBoundingClientRect();
  // On desktop the ledger is a left column, not a top strip, so it doesn't limit the top.
  const top = Math.max(margin, touch && led ? led.bottom + margin : margin);
  const bar = document.getElementById('save-bar')?.getBoundingClientRect();
  const bottom = (bar && bar.height && bar.top > innerHeight / 2 ? bar.top : innerHeight) - margin;
  return { top, bottom, touch };
}
export function fitScrollDock(dock, { width = 460, cls = 'dock-fit' } = {}) {
  if (!dock) return;
  const s = dock.style;
  for (const k of ['top', 'left', 'right', 'bottom', 'width', 'maxHeight', 'transform']) s[k] = '';
  dock.classList.remove(cls, 'is-compact', 'is-centred');
  if (dock.hidden) return;
  const { top, bottom, touch } = dockBand();
  const phone = isPhoneLayout();
  dock.classList.add(cls);
  let avail = bottom - top;
  if (phone) {
    dock.classList.add('is-compact');
    s.left = '8px'; s.right = 'auto'; s.width = `${innerWidth - 16}px`; s.top = `${top}px`; s.bottom = 'auto';
  } else if (touch) {
    dock.classList.add('is-centred');
    const w = Math.min(innerWidth - 16, Math.max(320, Math.round(innerWidth * 0.7)), width + 80);
    const cap = Math.round(innerHeight * 0.7);
    const h = Math.min(avail, cap);
    s.width = `${w}px`; s.left = `${Math.round((innerWidth - w) / 2)}px`; s.right = 'auto';
    s.top = `${Math.round(top + (avail - h) / 2)}px`; s.bottom = 'auto'; avail = h;
  } else {
    s.width = `${Math.min(width, innerWidth - 24)}px`;
    const r = dock.getBoundingClientRect();
    const t = Math.max(top, 58, Math.min(r.top, 120));
    s.top = `${t}px`; s.bottom = 'auto'; avail = bottom - t;
  }
  s.maxHeight = `${Math.max(160, Math.floor(avail))}px`;
}
