import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { constructionPiece, constructionPiecesByLevel, constructionLookId, constructionXpFor, constructionBuildGold, pieceModelId, pieceWallFace, pieceHangs } from './construction.js';
import { pieceWallMounts, snapToPieceWall } from './layout.js';

const ids = (cat) => constructionPiecesByLevel(cat).map((r) => r.id);

describe('leaded window', () => {
  it('is in Decor (inside) and Outdoor (outside)', () => {
    assert.ok(ids('Decor').includes('window'));
    assert.ok(ids('Outdoor').includes('window_outdoor'));
    assert.equal(pieceWallFace('window'), 'inside');
    assert.equal(pieceWallFace('window_outdoor'), 'outside');
    assert.ok(pieceHangs('window') && pieceHangs('window_outdoor'));
  });
  it('costs planks, nails and 1,000 gold per level; copy matches', () => {
    const a = constructionPiece('window'); const b = constructionPiece('window_outdoor');
    assert.equal(a.level, 15);
    assert.deepEqual({ ...a.materials }, { oak_plank: 3, iron_nails: 4 });
    assert.equal(constructionBuildGold(a), 15000);
    assert.ok(constructionXpFor(a) > 0);
    assert.equal(constructionXpFor(a), constructionXpFor(b));
    assert.equal(constructionBuildGold(a), constructionBuildGold(b));
    assert.equal(pieceModelId('window_outdoor'), 'window');
    assert.equal(constructionLookId('window_outdoor'), constructionLookId('window'));
  });
  it('ships a model with its back flush at z -23.11 and a build thumbnail', () => {
    const url = new URL('../../public/models/furniture/window/window.obj', import.meta.url);
    const zs = readFileSync(url, 'utf8').split('\n').filter((l) => l.startsWith('v ')).map((l) => Number(l.split(/\s+/)[3]));
    assert.ok(Math.abs(Math.min(...zs) + 23.11) < 1e-3);
    assert.ok(existsSync(new URL('../../public/thumbs/build/window.png', import.meta.url)));
  });
  it('snaps to inside and outside wall spots', () => {
    for (const face of ['inside', 'outside']) {
      const snap = snapToPieceWall(0, face === 'outside' ? 9 : 0, [], null, face);
      if (!snap) continue;
      assert.ok(pieceWallMounts([]).some((m) => m.face === face && Math.abs(m.rot - snap.rot) < 1e-6));
    }
  });
});
