// Single source of truth for the phone (portrait touch) layout.
// Narrowness guard keeps unfolded foldables (~882x1104) on the desktop layout.
// Must match every CSS @media phone rule exactly.
export const PHONE_QUERY = '(orientation: portrait) and (pointer: coarse) and (max-aspect-ratio: 3/4)';
export function isPhoneLayout() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}
// Debounced (~100ms) callback on resize and on phone-layout change (fold/unfold).
export function onLayoutChange(fn, delay = 100) {
  if (typeof window === 'undefined') return () => {};
  let t = 0;
  const run = () => { clearTimeout(t); t = setTimeout(fn, delay); };
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  const mq = window.matchMedia?.(PHONE_QUERY);
  mq?.addEventListener?.('change', run);
  return run;
}
