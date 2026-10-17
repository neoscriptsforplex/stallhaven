/** Brown/gold chrome shared by the manifest and the theme-color meta. */
export const PWA_THEME_COLOR = '#4a301c';
export const PWA_BACKGROUND_COLOR = '#1c120c';

/**
 * GitHub Pages serves this repo as-is, so the manifest lives at
 * ./public/manifest.webmanifest and `../` is the /stallhaven/ app root.
 * Vite copies public/ to the dist root; the built manifest uses `./`.
 */
export function rewriteBuiltPwaHtml(html) {
  return html.replace(
    /href="\.\/public\/(manifest\.webmanifest|favicon\.png|apple-touch-icon\.png)"/g,
    'href="./$1"',
  );
}

export function manifestForBuiltOutput(manifest) {
  return {
    ...manifest,
    start_url: './',
    scope: './',
  };
}

/**
 * Fullscreen is missing on iPhone Safari, and it is redundant when the page
 * is already an installed home-screen app.
 */
export function shouldOfferFullscreen({
  userAgent = '',
  standalone = false,
  displayModeStandalone = false,
  requestFullscreen = true,
} = {}) {
  if (standalone || displayModeStandalone) return false;
  if (/iPhone|iPod/.test(userAgent)) return false;
  if (!requestFullscreen) return false;
  return true;
}

export function fullscreenEnv(nav = globalThis.navigator, doc = globalThis.document, win = globalThis.window) {
  const root = doc?.documentElement;
  let displayModeStandalone = false;
  if (win && typeof win.matchMedia === 'function') {
    displayModeStandalone = win.matchMedia('(display-mode: standalone)').matches === true;
  }
  return {
    userAgent: nav?.userAgent || '',
    standalone: nav?.standalone === true,
    displayModeStandalone,
    requestFullscreen: typeof root?.requestFullscreen === 'function',
  };
}
