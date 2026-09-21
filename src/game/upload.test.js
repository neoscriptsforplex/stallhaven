import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './canvas-mock.js';
import { classifyModelFiles, formatUploadLabel } from './modelfiles.js';
import { bundledModelBases, bundledModelRoots, parseModelBuffer } from './upload.js';
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

describe('bundled model paths', () => {
  it('looks under models/ and public/models/ so githack source trees can load dumps', () => {
    const bases = bundledModelBases('player');
    const roots = bundledModelRoots();
    assert.ok(bases.some((base) => base.endsWith('models/player/')));
    assert.ok(bases.some((base) => base.includes('public/models/player/')));
    assert.ok(roots.some((root) => root.endsWith('models/')));
    assert.ok(roots.some((root) => root.includes('public/models/')));
  });

  it('still parses an OBJ when its MTL sidecar is garbage', async () => {
    const objPath = join(dirname(fileURLToPath(import.meta.url)), '../../public/models/rock/rock.obj');
    const obj = readFileSync(objPath);
    const scene = await parseModelBuffer(
      obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength),
      'rock.obj',
      { 'rock.mtl': new TextEncoder().encode('%%% not a material file \0\0').buffer },
    );
    let meshes = 0;
    scene.traverse((child) => {
      if (child.isMesh) meshes += 1;
    });
    assert.ok(meshes > 0);
  });

  it('keeps Blender OBJ face meshes when the dump also has edge lines', async () => {
    const objPath = join(dirname(fileURLToPath(import.meta.url)), '../../public/models/fountain/fountain.obj');
    const obj = readFileSync(objPath, 'utf8');
    assert.match(obj, /^l /m);
    assert.match(obj, /^f /m);
    const buf = readFileSync(objPath);
    const scene = await parseModelBuffer(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      'fountain.obj',
    );
    let meshes = 0;
    let verts = 0;
    scene.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      verts += child.geometry?.getAttribute?.('position')?.count ?? 0;
    });
    assert.ok(meshes > 0, 'fountain dump must load as a mesh, not only LineSegments');
    assert.ok(verts > 80, `fountain dump should keep face verts, got ${verts}`);
  });
});
