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
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');

  it('keeps Settings to a Player Avatar Customize button, not look grids', () => {
    const settings = slice(html, 'id="settings-dock"', 'id="look-dock"');
    assert.match(settings, /<h3>Player Avatar<\/h3>/);
    assert.match(settings, /data-look-open>Player Avatar: Customize</);
    assert.equal(settings.includes('data-look="hair"'), false);
    assert.equal(settings.includes('data-look="shirt"'), false);
    assert.equal(settings.includes('data-look="legs"'), false);
    assert.equal(settings.includes('data-look="boots"'), false);
    assert.equal(settings.includes('data-look="faceHair"'), false);
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
