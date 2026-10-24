import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mountFillBucket, updateFillBucket, restartFillBucket } from './models.js';

function load(path) {
  const buf = readFileSync(new URL(`../../public/models/${path}`, import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

describe('FillBucket', () => {
  it('v5 player has FillBucket and keeps the old clips', async () => {
    const g = await load('player/character_rigged.glb');
    const names = g.animations.map((c) => c.name);
    for (const n of ['Walk', 'Idle', 'Mine', 'Chop', 'Pick', 'Fish', 'Cast', 'NetFish', 'FillBucket']) assert.ok(names.includes(n), n);
  });
  it('bucket shows only while FillBucket plays and follows its time', async () => {
    const player = await load('player/character_rigged.glb');
    const bucketG = await load('items/bucket_fill/bucket_fill.glb');
    const mesh = new THREE.Group();
    mesh.add(player.scene);
    const mixer = new THREE.AnimationMixer(player.scene);
    const action = mixer.clipAction(THREE.AnimationClip.findByName(player.animations, 'FillBucket'));
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    mesh.userData.clipLocomotion = { mixer, actions: { fillbucket: action }, gather: 'fillbucket' };
    const bucket = mountFillBucket(mesh, bucketG);
    assert.ok(bucket && bucket.parent.name === 'Hand_R');
    assert.equal(bucket.visible, false);
    restartFillBucket(mesh);
    mixer.update(1.2);
    updateFillBucket(mesh);
    assert.equal(bucket.visible, true);
    assert.ok(Math.abs(mesh.userData.bucketFill.time - action.time) < 1e-6);
    mixer.update(2.5);
    updateFillBucket(mesh);
    assert.equal(bucket.visible, false);
  });
});
