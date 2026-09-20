import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUNGEON_LIGHT,
  DUNGEON_LIGHT_BOOST,
  SHOP_LIGHT,
  BRIGHTNESS_MAX,
  BRIGHTNESS_NEUTRAL,
  DEFAULT_BRIGHTNESS,
  applySceneLighting,
  brightnessForScene,
  brightnessPercent,
  clampBrightness,
  lightingForScene,
  readStoredBrightness,
  writeStoredBrightness,
} from './lighting.js';

describe('scene lighting', () => {
  it('brightens the shop with a modest ambient and fill, not a blown-out key', () => {
    assert.ok(SHOP_LIGHT.hemi > 0.9);
    assert.ok(SHOP_LIGHT.hemi < 1.4);
    assert.ok(SHOP_LIGHT.ambient > 0.12);
    assert.ok(SHOP_LIGHT.ambient < 0.4);
    assert.ok(SHOP_LIGHT.fill > 0.25);
    assert.ok(SHOP_LIGHT.fill < 0.8);
    assert.ok(SHOP_LIGHT.exposure < 1.25);
  });

  it('keeps the dungeon dimmer than the shop', () => {
    assert.ok(DUNGEON_LIGHT.ambient < SHOP_LIGHT.ambient);
    assert.equal(DUNGEON_LIGHT.fill, 0);
    assert.ok(DUNGEON_LIGHT.exposure < SHOP_LIGHT.exposure);
    assert.ok(
      DUNGEON_LIGHT.hemi * DUNGEON_LIGHT.exposure < SHOP_LIGHT.hemi * SHOP_LIGHT.exposure,
    );
    assert.ok(lightingForScene('dungeon', BRIGHTNESS_NEUTRAL).exposure < lightingForScene('shop', BRIGHTNESS_NEUTRAL).exposure);
  });

  it('writes shop and dungeon intensities onto the live lights', () => {
    const lights = {
      hemi: { intensity: 0 },
      ambient: { intensity: 0 },
      fill: { intensity: 0 },
      door: { intensity: 0 },
      sun: { intensity: 0 },
      renderer: { toneMappingExposure: 1 },
    };
    applySceneLighting(lights, 'shop', BRIGHTNESS_NEUTRAL);
    assert.equal(lights.hemi.intensity, SHOP_LIGHT.hemi);
    assert.equal(lights.fill.intensity, SHOP_LIGHT.fill);
    applySceneLighting(lights, 'dungeon', BRIGHTNESS_NEUTRAL);
    assert.equal(lights.hemi.intensity, DUNGEON_LIGHT.hemi);
    assert.equal(lights.fill.intensity, 0);
    assert.equal(lights.door.intensity, 0);
  });

  it('starts unset brightness at the slider maximum and keeps a stored preference', () => {
    assert.equal(DEFAULT_BRIGHTNESS, BRIGHTNESS_MAX);
    assert.equal(DEFAULT_BRIGHTNESS, 1.5);
    assert.equal(clampBrightness(undefined), 1.5);
    assert.equal(brightnessPercent(undefined), 150);
    const store = {};
    const previous = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (key) => (Object.hasOwn(store, key) ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
    };
    try {
      assert.equal(readStoredBrightness(), BRIGHTNESS_MAX);
      writeStoredBrightness(1);
      assert.equal(readStoredBrightness(), 1);
      writeStoredBrightness(0.75);
      assert.equal(readStoredBrightness(), 0.75);
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
    }
  });

  it('uses 100% brightness as the current shop bump and damps dungeon highs', () => {
    assert.equal(clampBrightness(0.2), 0.5);
    assert.equal(clampBrightness(2), 1.5);
    assert.equal(brightnessForScene('shop', 1), 1);
    assert.equal(brightnessForScene('dungeon', 1), 1);
    assert.equal(brightnessForScene('shop', 1.5), 1.5);
    assert.ok(brightnessForScene('dungeon', 1.5) < 1.5);
    assert.ok(brightnessForScene('dungeon', 1.5) <= 1.12);
    const shopHigh = lightingForScene('shop', 1.5);
    const dungeonHigh = lightingForScene('dungeon', 1.5);
    assert.ok(shopHigh.hemi > SHOP_LIGHT.hemi);
    assert.ok(dungeonHigh.hemi < DUNGEON_LIGHT.hemi * 1.5);
    assert.ok(dungeonHigh.exposure < DUNGEON_LIGHT.exposure * 1.5);
    const shopNeutral = lightingForScene('shop', BRIGHTNESS_NEUTRAL);
    assert.equal(shopNeutral.hemi, SHOP_LIGHT.hemi);
    assert.equal(shopNeutral.exposure, SHOP_LIGHT.exposure);
    assert.equal(DUNGEON_LIGHT_BOOST, 2.5);
    assert.ok(Math.abs(DUNGEON_LIGHT.hemi - 0.46 * DUNGEON_LIGHT_BOOST) < 1e-9);
    assert.ok(Math.abs(DUNGEON_LIGHT.ambient - 0.06 * DUNGEON_LIGHT_BOOST) < 1e-9);
    assert.equal(SHOP_LIGHT.hemi, 1.14);
    assert.equal(SHOP_LIGHT.ambient, 0.24);
  });
});
