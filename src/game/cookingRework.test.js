import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, stationForRecipe } from './catalog.js';
import { xpForCraft } from './skills.js';

describe('cooking rework', () => {
  const dishes = Object.values(RECIPES)
    .filter((r) => stationForRecipe(r) === 'range' && r.price > 0)
    .sort((a, b) => a.requires.level - b.requires.level || a.price - b.price);
  it('has the reworked dish list', () => { assert.ok(dishes.length >= 15); assert.ok(RECIPES.plain_pizza); });
  it('price and XP never drop as level rises, and rise across levels', () => {
    for (let i = 1; i < dishes.length; i++) {
      const a = dishes[i - 1], b = dishes[i];
      assert.ok(b.price >= a.price, `${b.id} price`);
      assert.ok(xpForCraft(b) >= xpForCraft(a), `${b.id} xp`);
      if (b.requires.level > a.requires.level) {
        assert.ok(b.price > a.price, `${b.id} price rises`);
        assert.ok(xpForCraft(b) > xpForCraft(a), `${b.id} xp rises`);
      }
    }
  });
  it('cheapest sellable dish is at least 1,000 gp and levels stay within 1–99', () => {
    assert.ok(Math.min(...dishes.map((d) => d.price)) >= 1000);
    for (const d of dishes) assert.ok(d.requires.level >= 1 && d.requires.level <= 99, d.id);
  });
});
