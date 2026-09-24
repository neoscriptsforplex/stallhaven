import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function slice(html, startId, endId) {
  const start = html.indexOf(startId);
  const end = html.indexOf(endId);
  assert.ok(start >= 0 && end > start, `${startId} .. ${endId}`);
  return html.slice(start, end);
}

describe('player look UI', () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(root, '../../index.html'), 'utf8');
  const css = readFileSync(join(root, '../style.css'), 'utf8');
  const main = readFileSync(join(root, '../main.js'), 'utf8');
  const hud = readFileSync(join(root, 'hud.js'), 'utf8');

  it('documents middle-mouse orbit next to the existing arrow-key rotate', () => {
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.match(help, /middle mouse button and drag/);
    assert.match(help, /arrow keys/);
  });

  it('covers the canvas with a black loading bar until models are ready', () => {
    assert.match(html, /class="is-booting"/);
    assert.match(html, /id="boot-cover"/);
    assert.match(html, /data-boot-bar/);
    assert.match(html, /data-boot-label/);
    assert.match(html, /html.is-booting #view/);
    assert.match(css, /#boot-cover\.is-leaving/);
    assert.match(css, /@keyframes boot-slide/);
    assert.match(main, /classList.remove\('is-booting'\)/);
    assert.match(main, /requestAnimationFrame/);
    assert.match(main, /setBundledLooks\(bundledLooks\)[\s\S]*createWorld\(canvas/);
    assert.match(main, /world\.tick\(0[\s\S]*hideBootCover\(\)/);
  });

  it('labels the shop placement panel Build, not Upgrade', () => {
    assert.match(html, /id="build-btn"[^>]*>Build</);
    assert.match(html, /id="build-btn"[^>]*title="Build"/);
    assert.match(html, /id="build-btn"[^>]*aria-label="Build"/);
    const build = slice(html, 'id="build-dock"', 'id="place-dock"');
    assert.match(build, /<h2>Build<\/h2>/);
    assert.equal(build.includes('<h2>Upgrade</h2>'), false);
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.match(help, /from Build/);
    assert.equal(help.includes('from Upgrade'), false);
    const chest = slice(html, 'id="chest-upgrade-modal"', 'id="expand-dock"');
    assert.match(chest, /<h2>Upgrade Chest<\/h2>/);
    assert.match(chest, /data-upgrade-buy>Upgrade</);
  });

  it('lists Build cards furnace-first and names the extra room Shop Expansion', () => {
    const build = slice(html, 'id="build-dock"', 'id="place-dock"');
    const order = ['Furnace', 'Cooking Range', 'Spinning Wheel', 'Cauldron', 'Table', 'Shelf', 'Mannequin', 'Shop Expansion'];
    let last = -1;
    for (const label of order) {
      const at = build.indexOf(`<h3>${label}</h3>`);
      assert.ok(at > last, label);
      last = at;
    }
    assert.equal(build.includes('<h3>Shop Room</h3>'), false);
  });

  it('states furnace and range place/cost once on Build cards', () => {
    const build = slice(html, 'id="build-dock"', 'id="place-dock"');
    const furnace = build.slice(build.indexOf('Furnace'), build.indexOf('Cooking Range'));
    const range = build.slice(build.indexOf('Cooking Range'), build.indexOf('Spinning Wheel'));
    assert.equal((furnace.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.equal((range.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.match(furnace, /data-furnace-status class="meta" hidden><\/p>/);
    assert.match(range, /data-range-status class="meta" hidden><\/p>/);
    assert.match(furnace, /data-furnace-buy>Place · Free</);
    assert.match(range, /data-range-buy>Place · Free</);
    assert.equal(furnace.includes('Free. Place it on the floor snap grid, then confirm.'), false);
    assert.equal(range.includes('Free. Place it on the floor snap grid, then confirm.'), false);
    assert.equal(hud.includes('Free. Place it on the floor snap grid, then confirm.'), false);
    assert.equal(hud.includes(": 'Free.'"), false);
    assert.match(hud, /itemStatus\.hidden = !paid/);
    const wheel = build.slice(build.indexOf('Spinning Wheel'), build.indexOf('Cauldron'));
    const cauldron = build.slice(build.indexOf('Cauldron'), build.indexOf('Table'));
    assert.equal((wheel.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.equal((cauldron.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.match(wheel, /data-wheel-status class="meta">Costs 100,000 gp\.</);
    assert.match(cauldron, /data-cauldron-status class="meta">Costs 1,000,000 gp\.</);
  });

  it('does not show old buyer class names in Help', () => {
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.equal(help.includes('Pilgrim'), false);
    assert.equal(help.includes('Mercenary'), false);
    assert.equal(help.includes('Hedge Mage'), false);
  });

  it('names dungeon adamant rocks Adamantite in Help, not Adamant Ore', () => {
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.match(help, /Adamantite/);
    assert.equal(help.includes('Adamant Ore'), false);
  });

  it('names runite rocks Runite in Help and gear Rune, not Rune Ore', () => {
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.match(help, /Adamantite, Runite/);
    assert.match(help, /including Rune/);
    assert.equal(help.includes('Rune Ore'), false);
  });

  it('keeps Settings to a Player Avatar Customize button, not look grids', () => {
    const settings = slice(html, 'id="settings-dock"', 'id="look-dock"');
    assert.match(settings, /<h3>Player Avatar<\/h3>/);
    assert.match(settings, /data-dungeon-brightness/);
    assert.match(settings, /Dungeon brightness/);
    assert.equal(settings.includes('data-look="hair"'), false);
    assert.equal(settings.includes('data-look="shirt"'), false);
    assert.equal(settings.includes('data-look="legs"'), false);
    assert.equal(settings.includes('data-look="boots"'), false);
    assert.equal(settings.includes('data-look="faceHair"'), false);
  });

  it('puts Mine above Close on dungeon rock inspect', () => {
    const pop = slice(html, 'id="inspect-pop"', 'id="furn-menu"');
    const mine = pop.indexOf('data-inspect-mine');
    const close = pop.indexOf('data-inspect-close');
    assert.ok(mine >= 0 && close > mine, 'Mine should sit above Close');
    assert.match(pop, />Mine</);
  });

  it('shows a +N yield under the gather progress bar', () => {
    const hudBar = slice(html, 'id="active-craft"', 'id="help-modal"');
    const bar = hudBar.indexOf('data-active-craft-bar');
    const yieldAt = hudBar.indexOf('data-active-craft-yield');
    assert.ok(bar >= 0 && yieldAt > bar, 'yield should sit under the bar');
    assert.match(hud, /mining\.yield/);
    assert.match(hud, /kind === 'tree' \? 'Chop'/);
  });

  it('rotates furniture with the wheel while placing', () => {
    const world = readFileSync(join(root, 'world.js'), 'utf8');
    assert.match(world, /if \(moveTarget\) \{\s*const dir = Math\.sign\(event\.deltaY\)/);
    assert.match(world, /rotateFurniturePose\(moveTarget, dir\)/);
  });

  it('resets anvil tabs with craftUiForStation so furnace smelt state cannot leak', () => {
    assert.match(hud, /craftUiForStation\(craftStation/);
    const catalog = readFileSync(join(root, 'catalog.js'), 'utf8');
    assert.match(catalog, /ANVIL_TAB_IDS\.has\(prev\.tab\) \? prev\.tab : 'melee'/);
  });

  it('opens a dedicated customize dock with every look slot and a back path', () => {
    const look = slice(html, 'id="look-dock"', 'id="music-dock"');
    assert.match(look, /id="look-dock"/);
    for (const slot of ['hair', 'shirt', 'legs', 'boots', 'faceHair']) {
      assert.match(look, new RegExp(`data-look="${slot}"`));
    }
    assert.match(look, /data-look-back>Back to Settings</);
    assert.match(look, /data-look-close>Close</);
  });
});
