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
  installPageVisibilityAudio,
  isLooping,
  isMusicPlaying,
  pauseMusic,
  resetMusicForTests,
  setLoop,
  startMusicOnLoad,
  stopMusic,
  toggleLoop,
  unlockAudio,
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

  it('starts the track in the gesture turn before AudioContext.resume settles', async () => {
    installFakeAudio();
    let releaseResume = null;
    let resumed = false;
    class FakeAC {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 0;
      }
      resume() {
        return new Promise((resolve) => {
          releaseResume = () => {
            resumed = true;
            this.state = 'running';
            resolve();
          };
        });
      }
    }
    globalThis.window.AudioContext = FakeAC;
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    unlockAudio();
    assert.equal(typeof releaseResume, 'function');
    assert.equal(resumed, false);
    const pending = startMusicOnLoad({ volume: 0.75 });
    assert.equal(isMusicPlaying(), true);
    assert.equal(resumed, false);
    assert.equal(getMusicTrackName(), 'Newbie Melody');
    assert.equal(getMusicVolume(), 0.75);
    releaseResume();
    await pending;
    assert.equal(resumed, true);
  });
});

describe('page visibility audio', () => {
  const OriginalAudio = globalThis.Audio;
  let playCalls = 0;
  let rejectPlay = false;
  let audioContext = null;
  const docListeners = {};
  const winListeners = {};

  function installEnv() {
    playCalls = 0;
    rejectPlay = false;
    audioContext = null;
    for (const key of Object.keys(docListeners)) delete docListeners[key];
    for (const key of Object.keys(winListeners)) delete winListeners[key];
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
        playCalls += 1;
        if (rejectPlay) return Promise.reject(new Error('NotAllowedError'));
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    }
    class FakeAC {
      constructor() {
        audioContext = this;
        this.state = 'suspended';
        this.currentTime = 0;
        this.suspends = 0;
        this.resumes = 0;
      }
      suspend() {
        this.suspends += 1;
        this.state = 'suspended';
        return Promise.resolve();
      }
      resume() {
        this.resumes += 1;
        this.state = 'running';
        return Promise.resolve();
      }
    }
    globalThis.Audio = FakeAudio;
    globalThis.document = {
      hidden: false,
      addEventListener(type, fn) { docListeners[type] = fn; },
      removeEventListener(type) { delete docListeners[type]; },
    };
    globalThis.window = {
      AudioContext: FakeAC,
      addEventListener(type, fn) { winListeners[type] = fn; },
      removeEventListener(type) { delete winListeners[type]; },
    };
    installPageVisibilityAudio();
  }

  function hidePage() {
    globalThis.document.hidden = true;
    docListeners.visibilitychange();
    winListeners.pagehide();
  }

  function showPage() {
    globalThis.document.hidden = false;
    winListeners.pageshow();
    docListeners.visibilitychange();
  }

  afterEach(() => {
    resetMusicForTests();
    if (OriginalAudio) globalThis.Audio = OriginalAudio;
    else delete globalThis.Audio;
    delete globalThis.document;
    delete globalThis.window;
  });

  it('does not start music on pageshow before the play gesture', async () => {
    installEnv();
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    winListeners.pageshow();
    hidePage();
    showPage();
    assert.equal(playCalls, 0);
    assert.equal(isMusicPlaying(), false);
    assert.equal(audioContext, null);
  });

  it('pauses playing music and the audio context while hidden, then resumes both', async () => {
    installEnv();
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    unlockAudio();
    const result = await startMusicOnLoad({ volume: 0.4 });
    assert.equal(result.played, true);
    const playsAfterStart = playCalls;
    const resumesAfterUnlock = audioContext.resumes;
    hidePage();
    assert.equal(isMusicPlaying(), false);
    assert.equal(audioContext.state, 'suspended');
    assert.equal(audioContext.suspends, 1);
    showPage();
    assert.equal(isMusicPlaying(), true);
    assert.equal(getMusicVolume(), 0.4);
    assert.equal(getMusicTrackName(), 'Newbie Melody');
    assert.equal(audioContext.state, 'running');
    assert.equal(playCalls, playsAfterStart + 1);
    assert.equal(audioContext.resumes, resumesAfterUnlock + 1);
    assert.equal(audioContext.suspends, 1);
  });

  it('does not resume music that was paused or stopped before the page was shown', async () => {
    installEnv();
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    await startMusicOnLoad({ volume: 0.75 });
    pauseMusic();
    const playsAfterPause = playCalls;
    hidePage();
    showPage();
    assert.equal(isMusicPlaying(), false);
    assert.equal(playCalls, playsAfterPause);

    await startMusicOnLoad({ volume: 0.75 });
    stopMusic();
    const playsAfterStop = playCalls;
    hidePage();
    showPage();
    assert.equal(isMusicPlaying(), false);
    assert.equal(playCalls, playsAfterStop);
  });

  it('leaves a muted load silent and still suspends a running context', async () => {
    installEnv();
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    unlockAudio();
    const result = await startMusicOnLoad({ volume: 0, muted: true });
    assert.equal(result.reason, 'muted');
    assert.equal(audioContext.state, 'running');
    hidePage();
    assert.equal(audioContext.state, 'suspended');
    showPage();
    assert.equal(isMusicPlaying(), false);
    assert.equal(playCalls, 0);
    assert.equal(audioContext.state, 'running');
    assert.equal(getMusicVolume(), 0);
  });

  it('swallows a rejected play() when resuming music', async () => {
    installEnv();
    await addMusicUrl('newbie.ogg', 'Newbie Melody');
    await startMusicOnLoad({ volume: 0.75 });
    hidePage();
    rejectPlay = true;
    const rejections = [];
    const onReject = (err) => rejections.push(err);
    process.on('unhandledRejection', onReject);
    showPage();
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', onReject);
    assert.equal(rejections.length, 0);
    assert.equal(isMusicPlaying(), false);
  });
});
