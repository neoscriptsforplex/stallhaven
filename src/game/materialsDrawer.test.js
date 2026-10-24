import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIALS, METALS } from './catalog.js';
import {
  MATERIALS_DRAWER_SIDE_CAP,
  MATERIALS_DRAWER_SIDE_QUERY,
  MATERIALS_DRAWER_SIDE_SHARE,
  materialTint,
  materialsDrawerHtml,
  materialsDrawerPointerPlan,
  materialsDrawerSideBox,
  ownedMaterials,
  rectContains,
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
    assert.equal(ownedMaterials({ oak_logs: 0, plank: 0, magic_plank: 0 }).length, 0);
    const woods = ownedMaterials({ logs: 1, oak_logs: 2, willow_plank: 3, magic_logs: 1 });
    assert.deepEqual(woods.map((row) => row.id), ['logs', 'oak_logs', 'magic_logs', 'willow_plank']);
    assert.equal(woods.find((row) => row.id === 'oak_logs').name, 'Oak Logs');
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
    assert.match(materialsDrawerHtml({ wheat: 1 }), /class="mat-icon" src="[^"]*item-wheat\.png"/); // every material now has a model render
    assert.equal(tintHex(materialTint(MATERIALS.bronze_bar)), tintHex(METALS[0].tint));
    assert.equal(materialsDrawerHtml({ flax: 0 }), '<p class="materials-empty">No materials yet.</p>');
    assert.equal(materialsDrawerHtml({ bronze_nails: 0, dragon_nails: 0 }).includes('Nails'), false);
    const nails = materialsDrawerHtml({ bronze_nails: 15, dragon_nails: 2 });
    assert.match(nails, /data-owned="bronze_nails"/);
    assert.match(nails, /Bronze Nails/);
    assert.match(nails, /×15/);
    assert.match(nails, /data-owned="dragon_nails"/);
    assert.match(nails, /Dragon Nails/);
    assert.match(nails, /class="mat-icon" src="[^"]*item-bronze_nails\.png"/);
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
    assert.equal(phone.maxWidth, 200);
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
    assert.equal(desk.maxWidth, 600);
    assert.equal(MATERIALS_DRAWER_SIDE_SHARE, 0.5);
    assert.equal(MATERIALS_DRAWER_SIDE_CAP, 0.9);
    assert.equal(
      materialsDrawerSideBox({ viewportWidth: 1000, viewportHeight: 400 }).maxWidth,
      Math.min(1000 * MATERIALS_DRAWER_SIDE_SHARE, 1000 * MATERIALS_DRAWER_SIDE_CAP),
    );
  });

  it('wires a non-blocking drawer that doubles on phones and stays within 90% of the screen', () => {
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
    assert.match(css, /@media \(pointer: coarse\)/);
    assert.match(css, /calc\(2 \* \(25vw - env\(safe-area-inset-left, 0px\)\)\)/);
    assert.match(css, /calc\(90vw - env\(safe-area-inset-left, 0px\)\)/);
    assert.match(css, /\.materials-drawer\.is-open \.materials-toggle \{[^}]*pointer-events:\s*auto/);
    assert.match(css, /\.materials-drawer\.is-open \.materials-toggle \{[^}]*width:\s*26px/);
    assert.match(css, /\.materials-drawer \{[^}]*env\(safe-area-inset-bottom/);
    assert.match(css, /env\(safe-area-inset-top, 0px\) \+ 165px/);
    assert.match(css, /bottom: calc\(var\(--portrait-thumb, 64px\) \+ 8px\)/);
    assert.match(css, new RegExp(MATERIALS_DRAWER_SIDE_QUERY.replace(/[()]/g, '\\$&')));
    assert.match(hud, /MATERIALS_DRAWER_SIDE_QUERY/);
    assert.match(hud, /ownedMaterialsKey\(state\.materials\)/);
    assert.match(hud, /if \(open\) closeMaterialsDrawer\(\)/);
    assert.match(hud, /syncOwnedMaterials\(\)/);
    assert.match(hud, /syncMaterialsDrawerPlace\(\)/);
    assert.match(hud, /setMaterialsOpen\(!materialsDrawer\.classList\.contains\('is-open'\)\)/);
    assert.match(hud, /materialsDrawerPointerPlan/);
    assert.match(hud, /addEventListener\('pointerdown', onMaterialsPointer, true\)/);
    assert.match(hud, /addEventListener\('pointerup', onMaterialsPointer, true\)/);
    assert.match(hud, /addEventListener\('pointercancel', onMaterialsPointer, true\)/);
  });

  it('hides Dwarven Plans until the player owns one', () => {
    assert.equal(ownedMaterials({ dwarven_plans: 0 }).some((row) => row.id === 'dwarven_plans'), false);
    const rows = ownedMaterials({ dwarven_plans: 1, logs: 2 });
    assert.equal(rows.find((row) => row.id === 'dwarven_plans').name, 'Dwarven Plans');
    assert.match(materialsDrawerHtml({ dwarven_plans: 1 }), /Dwarven Plans/);
    assert.equal(materialsDrawerHtml({ dwarven_plans: 0 }).includes('Dwarven Plans'), false);
  });

  it('hides Ancient Plans and Wheat until the player owns some', () => {
    assert.equal(ownedMaterials({ ancient_plans: 0, wheat: 0 }).some((row) => row.id === 'ancient_plans' || row.id === 'wheat'), false);
    const rows = ownedMaterials({ ancient_plans: 1, wheat: 3 });
    assert.equal(rows.find((row) => row.id === 'ancient_plans').name, 'Ancient Plans');
    assert.equal(rows.find((row) => row.id === 'wheat').name, 'Wheat');
    assert.equal(rows.find((row) => row.id === 'wheat').count, 3);
    assert.match(materialsDrawerHtml({ ancient_plans: 1 }), /Ancient Plans/);
    assert.equal(materialsDrawerHtml({ ancient_plans: 0, wheat: 0 }).includes('Ancient Plans'), false);
    assert.equal(materialsDrawerHtml({ wheat: 0 }).includes('Wheat'), false);
  });
});

describe('materials drawer pointer', () => {
  const toggle = { left: 100, right: 146, top: 400, bottom: 422, width: 46, height: 22 };
  const panel = { left: 40, right: 400, top: 200, bottom: 400, width: 360, height: 200 };
  const closed = { left: 40, right: 400, top: 420, bottom: 420, width: 360, height: 0 };

  it('ignores rectangles with no area', () => {
    assert.equal(rectContains(closed, 80, 420), false);
    assert.equal(rectContains(toggle, 120, 410), true);
    assert.equal(rectContains(toggle, 99, 410), false);
  });

  it('arms and toggles for a mouse click and a touch tap', () => {
    for (const button of [0, null]) {
      const down = materialsDrawerPointerPlan({
        type: 'pointerdown', button, x: 120, y: 410, toggleRect: toggle, open: false,
      });
      assert.equal(down.arm, true, `button ${button}`);
      assert.equal(down.toggle, false);
      assert.equal(down.swallow, true);
      const up = materialsDrawerPointerPlan({
        type: 'pointerup', button, x: 120, y: 410, toggleRect: toggle, open: false, armed: true,
      });
      assert.equal(up.toggle, true, `button ${button}`);
      assert.equal(up.swallow, true);
      assert.equal(up.arm, false);
    }
    const lifted = materialsDrawerPointerPlan({
      type: 'pointerup', button: -1, x: 120, y: 410, toggleRect: toggle, armed: true,
    });
    assert.equal(lifted.toggle, true);
  });

  it('does not toggle a press that slides off, a right click, or a scroll in the list', () => {
    const dragged = materialsDrawerPointerPlan({
      type: 'pointerup', button: 0, x: 10, y: 10, toggleRect: toggle, armed: true,
    });
    assert.equal(dragged.toggle, false);
    assert.equal(dragged.swallow, true);

    const rightDown = materialsDrawerPointerPlan({
      type: 'pointerdown', button: 2, x: 120, y: 410, toggleRect: toggle,
    });
    assert.equal(rightDown.arm, false);
    assert.equal(rightDown.swallow, true);
    const rightUp = materialsDrawerPointerPlan({
      type: 'pointerup', button: 2, x: 120, y: 410, toggleRect: toggle, armed: false,
    });
    assert.equal(rightUp.toggle, false);

    const scrolling = materialsDrawerPointerPlan({
      type: 'pointerdown',
      button: 0,
      x: 80,
      y: 240,
      toggleRect: toggle,
      panelRect: panel,
      open: true,
      targetInDrawer: true,
    });
    assert.equal(scrolling.swallow, false);
    assert.equal(scrolling.arm, false);
    assert.equal(scrolling.toggle, false);

    const throughPanel = materialsDrawerPointerPlan({
      type: 'pointerdown',
      button: 0,
      x: 80,
      y: 240,
      toggleRect: toggle,
      panelRect: panel,
      open: true,
      targetInDrawer: false,
    });
    assert.equal(throughPanel.swallow, true);
    assert.equal(throughPanel.toggle, false);

    const cancel = materialsDrawerPointerPlan({ type: 'pointercancel', armed: true });
    assert.equal(cancel.toggle, false);
    assert.equal(cancel.arm, false);
    assert.equal(cancel.swallow, true);
  });
});

describe('materials drawer icons and bin', () => {
  it('shows the model render when one exists, else the colour swatch', async () => {
    const thumbs = (await import('./materialThumbs.js')).default;
    const withIcon = Object.keys(MATERIALS).find((id) => thumbs[id]);
    const without = Object.keys(MATERIALS).find((id) => !thumbs[id]);
    const html = materialsDrawerHtml({ [withIcon]: 3, ...(without ? { [without]: 2 } : {}) });
    assert.match(html, new RegExp(`<img class="mat-icon" src="[^"]*thumbs/guide/${thumbs[withIcon].replace(':', '-')}\\.png"`));
    if (without) assert.match(html, /class="mat-swatch"/);
    assert.match(html, /data-mat-discard=/);
    for (const key of Object.values(thumbs)) {
      assert.ok(readFileSync(join(root, 'public/thumbs/guide', `${key.replace(':', '-')}.png`)).length > 100, key);
    }
  });
  it('keeps the icon on narrow phones and pins the throw-away box in view', () => {
    const css = readFileSync(join(root, 'src/style.css'), 'utf8');
    const hud = readFileSync(join(root, 'src/game/hud.js'), 'utf8');
    const narrow = css.slice(css.indexOf('@media (max-width: 359px)'));
    assert.doesNotMatch(narrow.slice(0, narrow.indexOf('\n}')), /mat-icon[^{]*\{\s*display:\s*none/);
    assert.match(css, /\.mat-discard \{[^}]*position: sticky;[^}]*top: 0;/);
    assert.match(hud, /matDiscardBox\.scrollIntoView\(/);
  });
});
