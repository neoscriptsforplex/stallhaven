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
  const hud = readFileSync(join(root, 'hud.js'), 'utf8');

  it('documents middle-mouse orbit next to the existing arrow-key rotate', () => {
    const help = slice(html, 'id="help-modal"', 'id="chest-modal"');
    assert.match(help, /middle mouse button and drag/);
    assert.match(help, /arrow keys/);
  });

  it('covers the canvas with a black loading bar until models are ready', () => {
    assert.match(html, /id="boot-cover"/);
    assert.match(html, /data-boot-bar/);
    assert.match(html, /data-boot-label/);
  });

  it('labels the shop placement panel Build, not Upgrade', () => {
    assert.match(html, /id="build-btn"[^>]*>Build</);
    assert.match(html, /id="build-btn"[^>]*aria-label="Build"/);
    const build = slice(html, 'id="build-dock"', 'id="place-dock"');
    assert.match(build, /<h2>Build<\/h2>/);
    assert.equal(build.includes('<h2>Upgrade</h2>'), false);
    const chest = slice(html, 'id="chest-upgrade-modal"', 'id="expand-dock"');
    assert.match(chest, /<h2>Upgrade Chest<\/h2>/);
    assert.match(chest, /data-upgrade-buy>Upgrade</);
  });

  it('states furnace and range place/cost once on Build cards', () => {
    const build = slice(html, 'id="build-dock"', 'id="place-dock"');
    const furnace = build.slice(build.indexOf('Furnace'), build.indexOf('Cooking Range'));
    const range = build.slice(build.indexOf('Cooking Range'), build.indexOf('Spinning Wheel'));
    assert.equal((furnace.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.equal((range.match(/Place it on the floor snap grid/g) ?? []).length, 1);
    assert.match(furnace, /data-furnace-status class="meta">Free\.</);
    assert.match(range, /data-range-status class="meta">Free\.</);
    assert.equal(furnace.includes('Free. Place it on the floor snap grid, then confirm.'), false);
    assert.equal(range.includes('Free. Place it on the floor snap grid, then confirm.'), false);
    assert.equal(hud.includes('Free. Place it on the floor snap grid, then confirm.'), false);
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
