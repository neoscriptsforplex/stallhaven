import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUCH_HOLD_MOVE_PX,
  TOUCH_LONG_PRESS_MS,
  applyCanvasOrbitDelta,
  canvasPointerMovedPastHold,
  canvasPointerStartsCamOrbit,
} from './world.js';

describe('canvas camera orbit pointers', () => {
  it('orbits on desktop middle-mouse and one-finger canvas swipe after a small move', () => {
    assert.equal(canvasPointerStartsCamOrbit({ button: 1, pointerType: 'mouse' }), true);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moved: true }), true);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch', isPrimary: true }, { moved: true }), true);
  });

  it('leaves desktop left-click and extra fingers for walk / pinch', () => {
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'mouse' }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 2, pointerType: 'mouse' }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moved: true, touchCount: 2 }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch', isPrimary: false }, { moved: true }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moved: true, moveTarget: true }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moved: true, expandMode: true }), false);
    assert.equal(canvasPointerStartsCamOrbit({ button: 0, pointerType: 'touch' }, { moved: true, modalOpen: true }), false);
  });
});

describe('canvas orbit yaw', () => {
  it('swaps left/right drag yaw and leaves pitch sign alone', () => {
    const cam = { yaw: 0, pitch: 0.62 };
    applyCanvasOrbitDelta(cam, 10, 0);
    assert.ok(cam.yaw > 0, 'drag right increases yaw');
    assert.equal(cam.pitch, 0.62);
    applyCanvasOrbitDelta(cam, -10, 8);
    assert.ok(Math.abs(cam.yaw) < 1e-9, 'drag left undoes the same yaw');
    assert.ok(cam.pitch < 0.62, 'downward drag still pitches down');
  });
});

describe('canvas touch long-press', () => {
  it('treats a still ~2s hold as a right-click, and a swipe as orbit', () => {
    assert.equal(TOUCH_LONG_PRESS_MS, 2000);
    assert.equal(TOUCH_HOLD_MOVE_PX, 8);
    assert.equal(canvasPointerMovedPastHold({ x: 10, y: 10 }, { x: 12, y: 11 }), false);
    assert.equal(canvasPointerMovedPastHold({ x: 10, y: 10 }, { clientX: 10, clientY: 10 + TOUCH_HOLD_MOVE_PX }), false);
    assert.equal(canvasPointerMovedPastHold({ x: 10, y: 10 }, { x: 10 + TOUCH_HOLD_MOVE_PX + 1, y: 10 }), true);
  });
});
