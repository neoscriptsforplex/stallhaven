import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import GUIDE_THUMBS from './guideThumbs.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { unlockListHtml } from './unlockGroups.js';

const file = (key) => `public/thumbs/guide/${key.replace(':', '-')}.png`;

describe('skill guide renders', () => {
  it('every manifest key resolves to a PNG', () => {
    const keys = [...Object.values(GUIDE_THUMBS.rows), ...Object.values(GUIDE_THUMBS.popup).map((v) => v.key).filter(Boolean)];
    for (const k of new Set(keys)) assert.ok(existsSync(file(k)), k);
  });
  it('rows without a render still exist (they keep their glyph)', () => {
    const rows = Object.entries(SKILL_GUIDES).flatMap(([s, g]) => g.tabs.flatMap((t) => t.rows.map((r) => `${s}|${r.name}`)));
    assert.ok(rows.some((k) => !GUIDE_THUMBS.rows[k]));
    assert.equal(GUIDE_THUMBS.rows['fishing|Raw shrimp'] !== undefined, true);
  });
  it('level-up list uses a render when one exists, glyph otherwise', () => {
    const html = unlockListHtml([{ label: 'Pizza', icon: 'food', count: 1, firstId: 'plain_pizza' }, { label: 'Wheat', icon: 'ore', count: 1, firstId: 'wheat' }]);
    assert.match(html, /lu-render/);
    assert.match(html, /<svg/);
  });
  it('removed coming-soon rows are gone', () => {
    const names = Object.values(SKILL_GUIDES).flatMap((g) => g.tabs.flatMap((t) => t.rows.map((r) => r.name)));
    for (const n of ['Super attack', 'Divine super combat', 'Manta ray', 'Cooked chicken', 'Bronze thrown axe', 'Lunar hat']) assert.ok(!names.includes(n), n);
    for (const n of ['Teak logs', 'Mahogany plank', 'Torstol', 'Wizard boots', 'Pizza', 'Pineapple pizza']) assert.ok(names.includes(n), n);
  });
});
