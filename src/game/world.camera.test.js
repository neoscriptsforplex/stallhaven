import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUCH_DOUBLE_TAP_MS,
  TOUCH_DOUBLE_TAP_PX,
  TOUCH_HOLD_MOVE_PX,
  TOUCH_LONG_PRESS_MS,
  DEFAULT_CAM,
  applyCanvasOrbitDelta,
  resetCamPose,
  applyPinchZoom,
  canvasPointerMovedPastHold,
  canvasPointerStartsCamOrbit,
  isCanvasDoubleTap,
  pinchSpanDelta,
} from './world.js';

describe('canvas camera orbit pointers', () => {
  it('resets the follow camera to the load pose', () => {
    const cam = resetCamPose({ yaw: 2, pitch: 1, distance: 20 });
    assert.equal(cam.yaw, DEFAULT_CAM.yaw);
    assert.equal(cam.pitch, DEFAULT_CAM.pitch);
    assert.equal(cam.distance, DEFAULT_CAM.distance);
  });

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

  it('treats a nearby second tap as a right-click and a pinch-apart as zoom in', () => {
    assert.equal(TOUCH_DOUBLE_TAP_MS, 280);
    assert.equal(TOUCH_DOUBLE_TAP_PX, 28);
    const first = { x: 40, y: 50, t: 1000 };
    assert.equal(isCanvasDoubleTap(first, { clientX: 50, clientY: 58 }, 1200), true);
    assert.equal(isCanvasDoubleTap(first, { x: 40, y: 50 }, 1000 + TOUCH_DOUBLE_TAP_MS + 1), false);
    assert.equal(isCanvasDoubleTap(first, { x: 40 + TOUCH_DOUBLE_TAP_PX + 2, y: 50 }, 1100), false);
    assert.ok(pinchSpanDelta(100, 140) > 0);
    assert.equal(pinchSpanDelta(0, 140), 0);
    const cam = { distance: 8 };
    applyPinchZoom(cam, 40);
    assert.ok(cam.distance < 8);
  });
});
