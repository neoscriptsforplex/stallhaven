import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLED_MUSIC_TRACKS } from './audio.js';

describe('bundled music', () => {
  it('ships fifteen OSRS tracks in alphabetical playlist order', () => {
    assert.deepEqual(BUNDLED_MUSIC_TRACKS, [
      'Adventure',
      'Dream',
      'Flute Salad',
      'Garden',
      'Harmony',
      'Horizon',
      'Long Way Home',
      'Medieval',
      'Newbie Melody',
      'Overture',
      'Scape Soft',
      'Spirit',
      'Start',
      'Still Night',
      'Yesteryear',
    ]);
    const sorted = [...BUNDLED_MUSIC_TRACKS].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(BUNDLED_MUSIC_TRACKS, sorted);
    const dir = join(dirname(fileURLToPath(import.meta.url)), '../../public/music');
    for (const name of BUNDLED_MUSIC_TRACKS) {
      assert.equal(existsSync(join(dir, `${name}.ogg`)), true, name);
    }
  });
});
