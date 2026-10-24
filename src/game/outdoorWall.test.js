import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { constructionPiece, constructionPiecesByLevel, constructionLookId, constructionXpFor, constructionBuildGold, pieceModelId, pieceWallFace, CONSTRUCTION_UNLOCKS } from './construction.js';
import { pieceWallMounts, snapToPieceWall } from './layout.js';

const ids = (cat) => constructionPiecesByLevel(cat).map((r) => r.id);

describe('outdoor wall pieces', () => {
  it('lists Wall Plant, Lit Torch and Window Box in Outdoor', () => {
    for (const id of ['wall_plant', 'lit_torch_outdoor', 'window_box_outdoor']) assert.ok(ids('Outdoor').includes(id), id);
    assert.ok(!ids('Decor').includes('wall_plant'));
    for (const id of ['lit_torch', 'window_box']) assert.ok(ids('Decor').includes(id), id);
  });
  it('keeps tabs ordered by level', () => {
    for (const cat of ['Outdoor', 'Decor']) {
      const lv = constructionPiecesByLevel(cat).map((r) => r.level);
      assert.deepEqual(lv, [...lv].sort((a, b) => a - b));
    }
  });
  it('outdoor copies are outside-only and match their originals', () => {
    for (const [copy, orig] of [['lit_torch_outdoor', 'lit_torch'], ['window_box_outdoor', 'window_box']]) {
      const a = constructionPiece(copy); const b = constructionPiece(orig);
      assert.equal(pieceWallFace(copy), 'outside');
      assert.equal(pieceModelId(copy), orig);
      assert.equal(constructionLookId(copy), constructionLookId(orig));
      assert.equal(a.level, b.level);
      assert.deepEqual(a.materials, b.materials);
      assert.equal(constructionXpFor(a), constructionXpFor(b));
      assert.equal(constructionBuildGold(a), constructionBuildGold(b));
    }
    assert.equal(pieceWallFace('wall_plant'), 'outside');
    assert.equal(pieceWallFace('window_box'), 'inside');
    assert.deepEqual(CONSTRUCTION_UNLOCKS.filter((u) => u.id.endsWith('_outdoor')), []);
  });
  it('snaps outdoor copies to an outside wall spot', () => {
    const snap = snapToPieceWall(0, 9, [], null, pieceWallFace('window_box_outdoor'));
    assert.ok(snap);
    const outside = pieceWallMounts([]).filter((m) => m.face === 'outside');
    assert.ok(outside.some((m) => (m.axis === 'x' ? Math.abs(m.z - snap.z) : Math.abs(m.x - snap.x)) < 1e-6 && Math.abs(m.rot - snap.rot) < 1e-6));
  });
});
