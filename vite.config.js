import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { manifestForBuiltOutput, rewriteBuiltPwaHtml } from './src/game/pwa.js';

export default defineConfig({
  base: '/stallhaven/',
  plugins: [
    {
      name: 'stallhaven-pwa-paths',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // public/ is copied to the dist root, so the built page links ./manifest
          // rather than ./public/manifest. Source HTML keeps ./public/ for Pages.
          return rewriteBuiltPwaHtml(html);
        },
      },
      closeBundle() {
        const file = resolve('dist/manifest.webmanifest');
        try {
          const manifest = JSON.parse(readFileSync(file, 'utf8'));
          writeFileSync(file, `${JSON.stringify(manifestForBuiltOutput(manifest), null, 2)}\n`);
        } catch {
          /* A build that skips the public copy has nothing to rewrite. */
        }
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
});
