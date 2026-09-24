import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLED_MUSIC_TRACKS,
  DEFAULT_AUTOPLAY_TRACK,
  addMusicUrl,
  getMusicTrackName,
  getMusicVolume,
  isLooping,
  isMusicPlaying,
  resetMusicForTests,
  setLoop,
  startMusicOnLoad,
  stopMusic,
  toggleLoop,
} from './audio.js';

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

  it('toggles a persisted loop flag without needing an audio element', () => {
    resetMusicForTests();
    assert.equal(isLooping(), false);
    assert.equal(setLoop(true), true);
    assert.equal(isLooping(), true);
    assert.equal(toggleLoop(), false);
    assert.equal(isLooping(), false);
  });

  it('puts a Loop toggle beside Play and Playlist in the music dock', () => {
    const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
    const start = html.indexOf('id="music-dock"');
    const end = html.indexOf('id="display-modal"');
    assert.ok(start >= 0 && end > start);
    const dock = html.slice(start, end);
    const play = dock.indexOf('data-music-tab="play"');
    const playlist = dock.indexOf('data-music-tab="playlist"');
    const loop = dock.indexOf('data-music-loop');
    assert.ok(play >= 0 && playlist > play && loop > playlist);
    assert.match(dock, />Loop</);
  });

  it('defaults autoplay to Newbie Melody', () => {
    assert.equal(DEFAULT_AUTOPLAY_TRACK, 'Newbie Melody');
    assert.equal(BUNDLED_MUSIC_TRACKS.includes(DEFAULT_AUTOPLAY_TRACK), true);
  });
});

describe('startMusicOnLoad', () => {
  const OriginalAudio = globalThis.Audio;
  let blockPlay = false;
  const listeners = {};

  function installFakeAudio() {
    class FakeAudio {
      constructor(url) {
        this.src = url;
        this.paused = true;
        this.volume = 1;
        this.loop = false;
        this.preload = '';
        this.playsInline = false;
        this.currentTime = 0;
        this.onended = null;
      }
      setAttribute() {}
      play() {
        if (blockPlay) {
          const err = new Error('NotAllowedError');
          err.name = 'NotAllowedError';
          return Promise.reject(err);
        }
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    }
    globalThis.Audio = FakeAudio;
    globalThis.window = {
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
      removeEventListener(type) {
        delete listeners[type];
      },
    };
  }

  afterEach(() => {
    resetMusicForTests();
    blockPlay = false;
    for (const key of Object.keys(listeners)) delete listeners[key];
    if (OriginalAudio) globalThis.Audio = OriginalAudio;
    else delete globalThis.Audio;
    delete globalThis.window;
  });

  async function seedPlaylist() {
    installFakeAudio();
    await addMusicUrl('adventure.ogg', 'Adventure');
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    await addMusicUrl('garden.ogg', 'Garden');
  }

  it('plays Newbie Melody on load when no track was saved', async () => {
    await seedPlaylist();
    const result = await startMusicOnLoad({ volume: 0.75 });
    assert.equal(result.played, true);
    assert.equal(result.track, 'Newbie Melody');
    assert.equal(result.reason, 'playing');
    assert.equal(isMusicPlaying(), true);
    assert.equal(getMusicTrackName(), 'Newbie Melody');
  });

  it('resumes the last saved track when it is still in the playlist', async () => {
    await seedPlaylist();
    const result = await startMusicOnLoad({ volume: 0.8, track: 'Garden' });
    assert.equal(result.played, true);
    assert.equal(result.track, 'Garden');
    assert.equal(getMusicVolume(), 0.8);
  });

  it('skips autoplay when music was explicitly muted', async () => {
    await seedPlaylist();
    const result = await startMusicOnLoad({ volume: 0.75, muted: true, track: 'Adventure' });
    assert.equal(result.played, false);
    assert.equal(result.reason, 'muted');
    assert.equal(isMusicPlaying(), false);
  });

  it('skips autoplay when saved volume is 0', async () => {
    await seedPlaylist();
    const result = await startMusicOnLoad({ volume: 0, track: 'Adventure' });
    assert.equal(result.played, false);
    assert.equal(result.reason, 'muted');
    assert.equal(getMusicVolume(), 0);
    assert.equal(isMusicPlaying(), false);
  });

  it('arms a first-gesture retry when the browser blocks autoplay', async () => {
    await seedPlaylist();
    blockPlay = true;
    const result = await startMusicOnLoad({ volume: 0.75 });
    assert.equal(result.played, false);
    assert.equal(result.reason, 'gesture');
    assert.equal(result.track, 'Newbie Melody');
    assert.equal(typeof listeners.pointerdown, 'function');
    blockPlay = false;
    await listeners.pointerdown();
    assert.equal(isMusicPlaying(), true);
    assert.equal(getMusicTrackName(), 'Newbie Melody');
  });

  it('does not start after Stop cancels the pending gesture autoplay', async () => {
    await seedPlaylist();
    blockPlay = true;
    await startMusicOnLoad({ volume: 0.75 });
    stopMusic();
    blockPlay = false;
    if (listeners.pointerdown) await listeners.pointerdown();
    assert.equal(isMusicPlaying(), false);
  });
});
