// Item 13: keep a dock sized to its content and never scrolling.
// CSS reflows Settings to 2 columns on short windows; this scales down whatever still doesn't fit.
export function fitPanel(el, { margin = 12 } = {}) {
  if (!el || el.hidden) return;
  el.classList.add('fit-panel'); el.style.zoom = '';
  const r = el.getBoundingClientRect(), barH = document.getElementById('save-bar')?.getBoundingClientRect();
  const portraitPhone = matchMedia('(orientation: portrait) and (pointer: coarse)').matches;
  const reserved = portraitPhone ? (barH?.height ?? 64) + 58 : (barH?.height ?? 54) + 72;
  const avail = window.innerHeight - reserved - margin;
  const z = Math.min(1, avail / r.height, (window.innerWidth - 2 * margin) / r.width);
  if (z < 1) { const zz = Math.max(0.6, z); el.style.zoom = zz.toFixed(3); if (!portraitPhone) el.style.bottom = `${(72 / zz).toFixed(0)}px`; } else el.style.bottom = '';
}
export function autoFit(el) {
  const run = () => fitPanel(el);
  new MutationObserver(run).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('resize', run); run();
}
