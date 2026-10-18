import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('craft panel', () => {
  it('keeps the old station layout and sizes the window to its content', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(join(root, '../../index.html'), 'utf8');
    const css = readFileSync(join(root, '../style.css'), 'utf8');
    const hud = readFileSync(join(root, 'hud.js'), 'utf8');
    const craft = html.slice(html.indexOf('id="craft-modal"'), html.indexOf('id="trade-modal"'));
    assert.match(craft, /<h2 data-craft-title>/);
    assert.match(craft, /<p data-craft-blurb>/);
    assert.match(craft, /id="craft-tabs"/);
    assert.match(craft, /id="craft-sidetabs"/);
    assert.match(craft, /class="craft-preview-pane"/);
    assert.match(craft, /data-craft-cancel/);
    assert.match(craft, /class="ghost" data-craft-close>Close/);
    assert.match(craft, /class="craft-x"/);
    assert.doesNotMatch(craft, /class="tabbar"/);
    assert.doesNotMatch(craft, /craft-info/);
    assert.match(css, /width: fit-content;/);
    assert.match(css, /height: auto;/);
    assert.match(css, /max-width: 94vw;/);
    assert.match(css, /max-height: 92vh;/);
    assert.match(css, /\.craft-x \{[\s\S]*width: 28px;[\s\S]*height: 28px;[\s\S]*font-size: 16px;/);
    assert.match(hud, /tabsEl\.hidden = simpleStation \|\| tabsEl\.querySelectorAll\('\[data-tab\]'\)\.length <= 1/);
    assert.match(hud, /paintSideTabs\(groups\)/);
    assert.match(hud, /headings: false/);
    assert.match(hud, /nav\.hidden = !show/);
  });
});
