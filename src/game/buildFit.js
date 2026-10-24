import { TOUCH_HUD_QUERY, isPhoneLayout } from './layoutQuery.js';
import { phoneCraftZoom } from './phoneCraftFit.js';
// Touch devices (phone, folded and unfolded foldables): the Build/Construction panel fits the band
// between the HUD and the button bar. Scale-to-fit down to ~0.8, below that the compact "is-tight"
// layout. Only the item list (.build-layout) scrolls. Unfolded/tablet: capped at ~70% of the viewport, centred.
function band() {
  const top = Math.max(8, (document.querySelector('#hud .ledger')?.getBoundingClientRect().bottom ?? 0) + 8);
  const bar = document.getElementById('save-bar')?.getBoundingClientRect();
  const bottom = (bar && bar.height && bar.top > innerHeight / 2 ? bar.top : innerHeight) - 8;
  return { top, bottom };
}
export function fitBuildDock(dock) {
  if (!dock) return;
  const s = dock.style;
  const clear = () => { dock.classList.remove('build-fit', 'build-bound', 'is-tight'); for (const k of ['zoom', 'top', 'left', 'width', 'height', 'maxHeight', 'bottom']) s[k] = ''; };
  const list = dock.querySelector('.build-layout'); const keep = list?.scrollTop || 0;
  clear();
  const touch = typeof matchMedia === 'function' && matchMedia(TOUCH_HUD_QUERY).matches;
  if (dock.hidden) return;
  if (!touch) {
    // Desktop/mouse: keep the normal placement but never grow past the screen; the item list scrolls.
    dock.classList.add('build-bound');
    const { bottom } = band();
    const r = dock.getBoundingClientRect();
    // Bottom-anchored docks grow upwards, top-anchored ones downwards: cap whichever edge would leave the screen.
    const cap = r.top < 8 ? r.bottom - 8 : Math.min(bottom, innerHeight - 8) - r.top;
    s.maxHeight = `${Math.max(160, Math.floor(cap))}px`;
    if (list) list.scrollTop = keep;
    return;
  }
  const phone = isPhoneLayout();
  let { top, bottom } = band();
  let width = phone ? innerWidth : Math.min(innerWidth - 16, Math.max(320, Math.round(innerWidth * 0.7)));
  let avail = bottom - top;
  if (!phone) {
    const cap = Math.round(innerHeight * 0.7);
    if (avail > cap) { top += Math.round((avail - cap) / 2); avail = cap; }
  }
  const left = Math.round((innerWidth - width) / 2);
  dock.classList.add('build-fit');
  const measure = () => { s.height = 'auto'; s.maxHeight = 'none'; s.width = `${width}px`; const h = dock.scrollHeight; return h; };
  const natural = measure();
  let tightNatural = natural;
  if (avail / natural < 0.8) { dock.classList.add('is-tight'); tightNatural = measure(); }
  let { zoom, tight } = phoneCraftZoom(natural, avail, tightNatural);
  zoom = Math.max(0.8, zoom); // below 0.8 the list scrolls instead of shrinking further
  dock.classList.toggle('is-tight', tight);
  // Chrome's standardized CSS zoom scales the element's own lengths, so pre-divide by zoom.
  s.zoom = String(zoom);
  s.top = `${top / zoom}px`; s.left = `${left / zoom}px`; s.width = `${width / zoom}px`;
  s.height = ''; s.maxHeight = `${Math.floor(avail / zoom)}px`;
  if (list) list.scrollTop = keep;
}
