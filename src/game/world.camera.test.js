import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canvasPointerStartsCamOrbit } from './world.js';

describe('canvas camera orbit pointers', () => {
  it('orbits on desktop middle-mouse and one-finger canvas touch', () => {
    assert.equal(canvasPointerStartsCamOrbit({ button: 1, pointerType: 'mouse' }), true);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }), true);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch', isPrimary: true }), true);
  });

  it('leaves desktop left-click and extra fingers for walk / pinch', () => {
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'mouse' }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 2, pointerType: 'mouse' }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { touchCount: 2 }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch', isPrimary: false }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moveTarget: true }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { expandMode: true }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { modalOpen: true }), false);
  });
});
