import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyModelFiles, formatUploadLabel } from './modelfiles.js';
import { UPLOADS_CLEARED } from './storage.js';

function file(name) {
  return { name };
}

describe('model upload classify', () => {
  it('accepts a single glb or gltf', () => {
    const glb = classifyModelFiles([file('table.glb')]);
    assert.equal(glb.kind, 'gltf');
    assert.equal(glb.primary.name, 'table.glb');
    assert.deepEqual(glb.sidecars, []);
    const gltf = classifyModelFiles([file('hero.gltf')]);
    assert.equal(gltf.kind, 'gltf');
  });

  it('pairs one obj with its mtl and texture maps', () => {
    const classified = classifyModelFiles([
      file('scimitar.mtl'),
      file('scimitar.obj'),
      file('blade.png'),
    ]);
    assert.equal(classified.kind, 'obj');
    assert.equal(classified.primary.name, 'scimitar.obj');
    assert.equal(classified.mtl.name, 'scimitar.mtl');
    assert.deepEqual(classified.sidecars.map((item) => item.name), ['scimitar.mtl', 'blade.png']);
    assert.equal(formatUploadLabel(classified), 'scimitar.obj + scimitar.mtl + blade.png');
  });

  it('rejects an mtl alone, mixed obj+glb, or two objs', () => {
    assert.match(classifyModelFiles([file('only.mtl')]).error, /obj/i);
    assert.match(classifyModelFiles([file('a.obj'), file('b.glb')]).error, /not both/i);
    assert.match(classifyModelFiles([file('a.obj'), file('b.obj')]).error, /one \.obj/i);
    assert.match(classifyModelFiles([file('notes.txt')]).error, /glb|obj/i);
  });
});

describe('clear uploads copy', () => {
  it('tells the player default looks are back', () => {
    assert.match(UPLOADS_CLEARED, /cleared uploaded models/i);
    assert.match(UPLOADS_CLEARED, /default looks/i);
  });
});
