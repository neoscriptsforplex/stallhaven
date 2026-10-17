import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
  manifestForBuiltOutput,
  rewriteBuiltPwaHtml,
  shouldOfferFullscreen,
} from './pwa.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function pngSize(file) {
  const buf = readFileSync(file);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('add to home screen', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const css = readFileSync(join(root, 'src/style.css'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'));

  it('links a standalone manifest and the apple web app metas', () => {
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /name="theme-color" content="#4a301c"/);
    assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /name="mobile-web-app-capable" content="yes"/);
    assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    assert.match(html, /name="apple-mobile-web-app-title" content="RuneCraft"/);
    assert.match(html, /rel="manifest" href="\.\/public\/manifest\.webmanifest"/);
    assert.match(html, /rel="apple-touch-icon" href="\.\/public\/apple-touch-icon\.png"/);
    assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\.\/public\/favicon\.png"/);
    assert.equal(html.includes('data:image/svg+xml'), false);
  });

  it('scopes the installed app at the stallhaven root from public/', () => {
    assert.equal(manifest.name, 'RuneCraft - Legends of Gielenor');
    assert.equal(manifest.short_name, 'RuneCraft');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, PWA_THEME_COLOR);
    assert.equal(manifest.background_color, PWA_BACKGROUND_COLOR);
    // Pages serves public/ under /stallhaven/public/, so ../ is the app root.
    assert.equal(manifest.start_url, '../');
    assert.equal(manifest.scope, '../');
    const bySize = Object.fromEntries(manifest.icons.map((icon) => [`${icon.sizes}:${icon.purpose}`, icon]));
    assert.equal(bySize['192x192:any'].src, 'icon-192.png');
    assert.equal(bySize['512x512:any'].src, 'icon-512.png');
    assert.equal(bySize['192x192:maskable'].src, 'icon-192-maskable.png');
    assert.equal(bySize['512x512:maskable'].src, 'icon-512-maskable.png');
    for (const icon of manifest.icons) {
      assert.equal(icon.src.startsWith('/'), false, icon.src);
      assert.equal(icon.src.includes('stallhaven'), false, icon.src);
      assert.equal(pngSize(join(root, 'public', icon.src)).width, Number(icon.sizes.split('x')[0]));
    }
    assert.deepEqual(pngSize(join(root, 'public/apple-touch-icon.png')), { width: 180, height: 180 });
    assert.deepEqual(pngSize(join(root, 'public/favicon.png')), { width: 32, height: 32 });
  });

  it('rewrites public paths to dist-root relative paths', () => {
    const built = rewriteBuiltPwaHtml(html);
    assert.match(built, /rel="manifest" href="\.\/manifest\.webmanifest"/);
    assert.match(built, /rel="apple-touch-icon" href="\.\/apple-touch-icon\.png"/);
    assert.match(built, /rel="icon" type="image\/png" sizes="32x32" href="\.\/favicon\.png"/);
    assert.match(built, /url\("\.\/public\/runecraft_loading_bg\.webp"\)/);
    const out = manifestForBuiltOutput(manifest);
    assert.equal(out.start_url, './');
    assert.equal(out.scope, './');
    assert.equal(out.icons[0].src, 'icon-192.png');
  });

  it('pads the top bar and bottom panels inside the safe area', () => {
    assert.match(css, /#hud \{[^}]*env\(safe-area-inset-top/);
    assert.match(css, /#hud \{[^}]*env\(safe-area-inset-left/);
    assert.match(css, /#save-bar \{[^}]*env\(safe-area-inset-top/);
    assert.match(css, /#save-bar \{[^}]*env\(safe-area-inset-right/);
    assert.match(css, /#mat-strip \{[^}]*env\(safe-area-inset-bottom/);
    const portrait = css.slice(css.indexOf('/* Phone portrait only.'));
    assert.match(portrait, /#save-bar \{[^}]*env\(safe-area-inset-bottom/);
    assert.match(portrait, /#hud \.ledger \{[^}]*env\(safe-area-inset-top/);
  });
});

describe('fullscreen button', () => {
  it('hides on iPhone and when the app is already standalone', () => {
    assert.equal(shouldOfferFullscreen({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      requestFullscreen: false,
    }), false);
    assert.equal(shouldOfferFullscreen({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      requestFullscreen: true,
    }), false);
    assert.equal(shouldOfferFullscreen({ standalone: true, requestFullscreen: true }), false);
    assert.equal(shouldOfferFullscreen({ displayModeStandalone: true, requestFullscreen: true }), false);
    assert.equal(shouldOfferFullscreen({ requestFullscreen: false }), false);
    assert.equal(shouldOfferFullscreen({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      requestFullscreen: true,
    }), true);
    assert.equal(shouldOfferFullscreen({
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      requestFullscreen: true,
    }), true);
  });
});
