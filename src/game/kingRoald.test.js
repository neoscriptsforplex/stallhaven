import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideRequest, RECIPES, KING_ROALD_PRICE_MULT, mostExpensiveChestId } from './catalog.js';
import { nextBuyerLookId, RIGGED_BUYER_MODELS, KING_ROALD_LOOK_ID } from './models.js';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('King Roald buyer', () => {
  it('buys the priciest in-stock item at double price', () => {
    const ids = Object.keys(RECIPES).filter((id) => RECIPES[id].price > 0).slice(0, 3);
    const state = { chest: Object.fromEntries(ids.map((id) => [id, 1])) };
    const best = mostExpensiveChestId(state);
    const req = decideRequest('kingroald', Math.random, state);
    assert.equal(KING_ROALD_PRICE_MULT, 2);
    assert.equal(req.recipeId, best);
    assert.equal(req.gold, RECIPES[best].price * 2);
    assert.equal(req.royal, true);
  });
  it('uses the rigged king model at scale 0.863', () => {
    assert.equal(nextBuyerLookId('kingroald'), KING_ROALD_LOOK_ID);
    const spec = RIGGED_BUYER_MODELS.find((s) => s.lookId === KING_ROALD_LOOK_ID);
    assert.equal(spec.scale, 0.863);
    assert.equal(existsSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/models', spec.file)), true);
  });
});
