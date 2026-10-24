import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { phoneCraftZoom, MIN_ZOOM } from './phoneCraftFit.js';
import { TOUCH_HUD_QUERY } from './layoutQuery.js';
describe('phone craft fit', () => {
  it('keeps full size when it fits', () => assert.deepEqual(phoneCraftZoom(500, 600), { zoom: 1, tight: false }));
  it('scales down to the 0.8 floor', () => assert.deepEqual(phoneCraftZoom(1000, 850), { zoom: 0.85, tight: false }));
  it('switches to the tight layout below the floor', () => {
    const r = phoneCraftZoom(1000, 700, 760);
    assert.equal(r.tight, true); assert.ok(r.zoom >= 0.6 && r.zoom <= 1); assert.equal(MIN_ZOOM, 0.8);
  });
  it('shares the touch HUD query', () => assert.equal(TOUCH_HUD_QUERY, '(pointer: coarse)'));
});
