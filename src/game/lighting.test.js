import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEON_LIGHT, SHOP_LIGHT, applySceneLighting, lightingForScene } from './lighting.js';

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
    assert.ok(DUNGEON_LIGHT.hemi < SHOP_LIGHT.hemi);
    assert.ok(DUNGEON_LIGHT.ambient < SHOP_LIGHT.ambient);
    assert.equal(DUNGEON_LIGHT.fill, 0);
    assert.ok(lightingForScene('dungeon').exposure < lightingForScene('shop').exposure);
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
    applySceneLighting(lights, 'shop');
    assert.equal(lights.hemi.intensity, SHOP_LIGHT.hemi);
    assert.equal(lights.fill.intensity, SHOP_LIGHT.fill);
    applySceneLighting(lights, 'dungeon');
    assert.equal(lights.hemi.intensity, DUNGEON_LIGHT.hemi);
    assert.equal(lights.fill.intensity, 0);
    assert.equal(lights.door.intensity, 0);
  });
});
