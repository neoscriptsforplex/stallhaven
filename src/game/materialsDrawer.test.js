import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIALS, METALS } from './catalog.js';
import {
  MATERIALS_DRAWER_SIDE_QUERY,
  materialTint,
  materialsDrawerHtml,
  materialsDrawerSideBox,
  ownedMaterials,
  tintHex,
} from './materialsDrawer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('materials drawer', () => {
  it('lists everything owned and hides zero counts', () => {
    const rows = ownedMaterials({
      logs: 3,
      essence: 1,
      bronze_bar: 2,
      bow_string: 4,
      bronze: 0,
      flax: 0,
      adamant: 0,
    });
    const ids = rows.map((row) => row.id);
    assert.deepEqual(ids, ['logs', 'bow_string', 'essence', 'bronze_bar']);
    assert.equal(rows.find((row) => row.id === 'logs').name, 'Logs');
    assert.equal(rows.find((row) => row.id === 'logs').count, 3);
    assert.equal(rows.find((row) => row.id === 'bronze_bar').name, 'Bronze Bar');
    assert.equal(rows.find((row) => row.id === 'bow_string').name, MATERIALS.bow_string.name);
    assert.equal(ownedMaterials({}).length, 0);
    assert.equal(ownedMaterials({ essence: 0.4 }).length, 0);
  });

  it('paints a swatch, name, and count, and skips empty stacks', () => {
    const html = materialsDrawerHtml({
      logs: 1500,
      essence: 2,
      bronze_bar: 1,
      bronze: 0,
    });
    assert.match(html, /data-owned="logs"/);
    assert.match(html, /Logs/);
    assert.match(html, /×1,500/);
    assert.match(html, /data-owned="essence"/);
    assert.match(html, /Essence/);
    assert.match(html, /data-owned="bronze_bar"/);
    assert.match(html, /Bronze Bar/);
    assert.equal(html.includes('Bronze Ore'), false);
    assert.equal(html.includes('data-restock'), false);
    assert.match(html, new RegExp(`background:${tintHex(materialTint(MATERIALS.essence))}`));
    assert.equal(tintHex(materialTint(MATERIALS.bronze_bar)), tintHex(METALS[0].tint));
    assert.equal(materialsDrawerHtml({ flax: 0 }), '<p class="materials-empty">No materials yet.</p>');
  });

  it('sits the side drawer under the top-left HUD and above the bottom bar', () => {
    const phone = materialsDrawerSideBox({
      viewportWidth: 400,
      viewportHeight: 800,
      obstacles: [
        { left: 0, right: 400, top: 0, bottom: 47, width: 400, height: 47 },
        { left: 8, right: 120, top: 55, bottom: 167, width: 112, height: 112 },
        { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 },
        { left: 0, right: 400, top: 736, bottom: 800, width: 400, height: 64 },
      ],
    });
    assert.equal(phone.top, 175);
    assert.equal(phone.bottom, 72);
    assert.equal(phone.maxWidth, 100);
    assert.equal(phone.maxHeight, 800 - 175 - 72);

    const desk = materialsDrawerSideBox({
      viewportWidth: 1200,
      viewportHeight: 800,
      obstacles: [
        { left: 16, right: 244, top: 16, bottom: 300, width: 228, height: 284 },
        { left: 900, right: 1180, top: 16, bottom: 48, width: 280, height: 32 },
      ],
    });
    assert.equal(desk.top, 308);
    assert.equal(desk.bottom, null);
    assert.equal(desk.maxWidth, 300);
  });

  it('wires a non-blocking drawer that stays within a quarter of the screen', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const css = readFileSync(join(root, 'src/style.css'), 'utf8');
    const hud = readFileSync(join(root, 'src/game/hud.js'), 'utf8');
    assert.match(html, /id="materials-drawer"/);
    assert.match(html, /id="materials-toggle"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /materials-arrow-up/);
    assert.match(html, /materials-arrow-down/);
    assert.match(html, /id="owned-materials"/);
    assert.match(css, /\.materials-drawer \{[^}]*pointer-events:\s*none/);
    assert.match(css, /\.materials-toggle \{[^}]*pointer-events:\s*auto/);
    assert.match(css, /max-height:\s*25dvh/);
    assert.match(css, /max-width:\s*calc\(25vw - env\(safe-area-inset-left, 0px\)\)/);
    assert.match(css, /\.materials-drawer \{[^}]*env\(safe-area-inset-bottom/);
    assert.match(css, /env\(safe-area-inset-top, 0px\) \+ 165px/);
    assert.match(css, /64px \+ env\(safe-area-inset-bottom, 0px\)/);
    assert.match(css, new RegExp(MATERIALS_DRAWER_SIDE_QUERY.replace(/[()]/g, '\\$&')));
    assert.match(hud, /MATERIALS_DRAWER_SIDE_QUERY/);
    assert.match(hud, /ownedMaterialsKey\(state\.materials\)/);
    assert.match(hud, /if \(open\) closeMaterialsDrawer\(\)/);
    assert.match(hud, /syncOwnedMaterials\(\)/);
    assert.match(hud, /syncMaterialsDrawerPlace\(\)/);
    assert.match(hud, /setMaterialsOpen\(!materialsDrawer\.classList\.contains\('is-open'\)\)/);
  });
});
