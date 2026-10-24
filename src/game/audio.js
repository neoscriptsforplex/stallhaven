import {
  createRetriggerGuard,
  DEFAULT_SOUND_MIX,
  normalizeSoundMix,
  parseSfxManifest,
  pickSfxVariant,
} from './sfx.js';

export const MUSIC_EXTENSIONS = ['mp3', 'wav', 'ogg'];
export const MUSIC_ACCEPT = '.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg,audio/x-wav';
export const BUNDLED_MUSIC_TRACKS = [
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
];
const MUSIC_MIME = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/vorbis',
];

let ctx = null;
let bg = null;
let volume = 0.75;
let masterVolume = 1;
const playlist = [];
let currentIndex = -1;
let serial = 1;
let shuffle = false;
let loopTrack = false;
let autoplayArmed = false;
let autoplayCancelled = false;
let pageHidden = false;
let holdMusic = false;
let holdContext = false;
let visibilityBound = false;
let visibilityDoc = null;
let visibilityWin = null;
export const DEFAULT_AUTOPLAY_TRACK = 'Newbie Melody';

function makeAudioElement(url, { preload = 'auto' } = {}) {
  const audioEl = new Audio(url);
  audioEl.preload = preload;
  audioEl.playsInline = true;
  audioEl.setAttribute?.('playsinline', '');
  audioEl.setAttribute?.('webkit-playsinline', '');
  return audioEl;
}

function kickAudioContext() {
  const ac = audio();
  if (ac?.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

/** Resume the shared context from a user gesture so music and UI sounds can start. */
export function unlockAudio() {
  kickAudioContext();
}

function audio() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function playClick(kind = 'ui') {
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const freq = kind === 'move' ? 390 : kind === 'craft' ? 640 : kind === 'trade' ? 520 : 470;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.05);
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

export function getMusicVolume() {
  return volume;
}

export function getMusicTrackName() {
  return playlist[currentIndex]?.name ?? '';
}

export function getPlaylist() {
  return playlist.map((track, index) => ({
    id: track.id,
    name: track.name,
    index,
    current: index === currentIndex,
  }));
}

export function isMusicPlaying() {
  return Boolean(bg && !bg.paused);
}

export function isShuffle() {
  return shuffle;
}

export function isLooping() {
  return loopTrack;
}

export function setLoop(on) {
  loopTrack = Boolean(on);
  if (bg) {
    bg.loop = loopTrack;
    if (!loopTrack) bindEndedHandler();
  }
  return loopTrack;
}

export function toggleLoop() {
  return setLoop(!loopTrack);
}

export function cancelMusicAutoplay() {
  autoplayCancelled = true;
}

export function setShuffle(on) {
  shuffle = Boolean(on);
  return shuffle;
}

export function toggleShuffle() {
  shuffle = !shuffle;
  return shuffle;
}

function pickShuffledIndex(from) {
  if (playlist.length <= 1) return 0;
  let next = from;
  while (next === from) {
    next = Math.floor(Math.random() * playlist.length);
  }
  return next;
}

export function setMusicVolume(next) {
  volume = Math.min(1, Math.max(0, Number(next) || 0));
  sfxMix.music = volume;
  if (bg) bg.volume = volume * masterVolume;
  return volume;
}

function stopCurrent(resetTime = true) {
  if (!bg) return;
  bg.onended = null;
  bg.pause();
  if (resetTime) bg.currentTime = 0;
}

function bindEndedHandler() {
  if (!bg) return;
  bg.onended = () => {
    if (loopTrack) return;
    if (playlist.length === 0) return;
    const next = shuffle && playlist.length > 1
      ? pickShuffledIndex(currentIndex)
      : (currentIndex + 1) % playlist.length;
    playTrackAt(next).catch(() => {});
  };
}

function bindTrack(index) {
  const track = playlist[index];
  if (!track) {
    currentIndex = -1;
    bg = null;
    return null;
  }
  currentIndex = index;
  bg = track.audio;
  bg.loop = loopTrack;
  bg.volume = volume * masterVolume;
  bindEndedHandler();
  return track;
}

export async function playTrackAt(index) {
  if (index < 0 || index >= playlist.length) return false;
  stopCurrent();
  bindTrack(index);
  if (!bg) return false;
  bg.playsInline = true;
  bg.volume = volume * masterVolume;
  kickAudioContext();
  try {
    await bg.play();
    return Boolean(bg && !bg.paused);
  } catch {
    return false;
  }
}

export function isAllowedMusicFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (MUSIC_EXTENSIONS.includes(ext)) return true;
  const type = String(file.type || '').toLowerCase();
  return MUSIC_MIME.includes(type);
}

export function musicRejectMessage(file) {
  const name = file?.name || 'That file';
  return `${name} is not supported. Upload an MP3, WAV, or OGG file.`;
}

export async function addMusicFiles(files) {
  const added = [];
  const rejected = [];
  for (const file of files ?? []) {
    if (!file) continue;
    if (!isAllowedMusicFile(file)) {
      rejected.push(musicRejectMessage(file));
      continue;
    }
    const url = URL.createObjectURL(file);
    const audioEl = makeAudioElement(url, { preload: 'auto' });
    const track = {
      id: `track-${serial}`,
      name: file.name || `Track ${serial}`,
      url,
      audio: audioEl,
      revoke: true,
    };
    serial += 1;
    playlist.push(track);
    added.push(track.name);
  }
  if (added.length && currentIndex < 0) await playTrackAt(0);
  return { added, rejected };
}

export function movePlaylistTrack(from, to) {
  if (from === to) return false;
  if (from < 0 || from >= playlist.length || to < 0 || to >= playlist.length) return false;
  const [track] = playlist.splice(from, 1);
  playlist.splice(to, 0, track);
  if (currentIndex === from) currentIndex = to;
  else if (from < currentIndex && to >= currentIndex) currentIndex -= 1;
  else if (from > currentIndex && to <= currentIndex) currentIndex += 1;
  return true;
}

export function removePlaylistTrack(index) {
  const track = playlist[index];
  if (!track) return false;
  const wasCurrent = index === currentIndex;
  if (wasCurrent) stopCurrent();
  if (track.url && track.revoke) URL.revokeObjectURL(track.url);
  playlist.splice(index, 1);
  if (!playlist.length) {
    currentIndex = -1;
    bg = null;
    return true;
  }
  if (index < currentIndex) currentIndex -= 1;
  else if (wasCurrent) {
    const next = Math.min(index, playlist.length - 1);
    playTrackAt(next).catch(() => {});
  }
  return true;
}

export async function loadMusicFile(file) {
  const { added } = await addMusicFiles(file ? [file] : []);
  return added[0] ?? null;
}

export async function playMusic() {
  if (currentIndex < 0) {
    if (!playlist.length) return false;
    return playTrackAt(0);
  }
  bindTrack(currentIndex);
  if (!bg) return false;
  bg.playsInline = true;
  bg.volume = volume * masterVolume;
  kickAudioContext();
  try {
    await bg.play();
    return Boolean(bg && !bg.paused);
  } catch {
    return false;
  }
}

export function pauseMusic() {
  if (!bg) return;
  holdMusic = false;
  bg.pause();
}

export function stopMusic() {
  cancelMusicAutoplay();
  holdMusic = false;
  stopCurrent(true);
}

export async function skipTrack() {
  if (!playlist.length) return false;
  if (currentIndex < 0) return playTrackAt(0);
  const next = shuffle && playlist.length > 1
    ? pickShuffledIndex(currentIndex)
    : (currentIndex + 1) % playlist.length;
  return playTrackAt(next);
}

export function clearMusic() {
  stopCurrent();
  for (const track of playlist) {
    if (track.url && track.revoke) URL.revokeObjectURL(track.url);
  }
  playlist.length = 0;
  currentIndex = -1;
  bg = null;
}

function bundledMusicBases() {
  let envBase = './';
  try {
    const raw = import.meta.env.BASE_URL || './';
    envBase = raw.endsWith('/') ? raw : `${raw}/`;
  } catch {
    envBase = './';
  }
  const roots = [`${envBase}music/`, `${envBase}public/music/`];
  if (envBase !== './') roots.push('./music/', './public/music/');
  return [...new Set(roots)];
}

export async function addMusicUrl(url, name, { revoke = false, autoplay = false } = {}) {
  const audioEl = makeAudioElement(url, { preload: 'metadata' });
  const track = {
    id: `track-${serial}`,
    name: name || `Track ${serial}`,
    url,
    audio: audioEl,
    revoke: Boolean(revoke),
  };
  serial += 1;
  playlist.push(track);
  if (autoplay && currentIndex < 0) await playTrackAt(playlist.length - 1);
  return track.name;
}

export async function loadBundledMusic() {
  const added = [];
  const bases = bundledMusicBases();
  for (const name of BUNDLED_MUSIC_TRACKS) {
    const encoded = encodeURIComponent(`${name}.ogg`);
    const urls = bases.map((base) => `${base}${encoded}`);
    let url = urls.find((item) => item.includes('public/music/')) ?? urls[0];
    for (const candidate of urls) {
      try {
        const res = await fetch(candidate, { method: 'GET', headers: { Range: 'bytes=0-0' } });
        if (res.ok || res.status === 206) {
          url = candidate;
          break;
        }
      } catch {
        // try the next public/githack root
      }
    }
    added.push(await addMusicUrl(url, name, { autoplay: false }));
  }
  return added;
}

function playlistIndexByName(name) {
  if (!name) return -1;
  return playlist.findIndex((track) => track.name === name);
}

function armGestureAutoplay(index) {
  if (autoplayArmed || typeof window === 'undefined') return;
  autoplayArmed = true;
  const resume = async (event) => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
    if (autoplayCancelled) return;
    unlockAudio();
    await playTrackAt(index).catch(() => {});
    void event;
  };
  window.addEventListener('pointerdown', resume, { once: true, capture: true });
  window.addEventListener('keydown', resume, { once: true, capture: true });
  window.addEventListener('touchstart', resume, { once: true, capture: true, passive: true });
}

/** Start bundled/playlist music on boot. Skips when muted; arms a first-gesture retry if autoplay is blocked. */
export async function startMusicOnLoad({
  volume: nextVolume,
  muted = false,
  track = '',
  loop = false,
} = {}) {
  if (nextVolume != null) setMusicVolume(nextVolume);
  setLoop(loop);
  if (!playlist.length) {
    return { played: false, reason: 'empty' };
  }
  if (muted || getMusicVolume() <= 0) {
    return { played: false, reason: 'muted', track: track || DEFAULT_AUTOPLAY_TRACK };
  }
  autoplayCancelled = false;
  autoplayArmed = false;
  let index = playlistIndexByName(track);
  if (index < 0) index = playlistIndexByName(DEFAULT_AUTOPLAY_TRACK);
  if (index < 0) index = 0;
  const played = await playTrackAt(index);
  if (!played) armGestureAutoplay(index);
  return { played, track: getMusicTrackName(), reason: played ? 'playing' : 'gesture' };
}

function ignoreRejection(result) {
  if (result && typeof result.catch === 'function') result.catch(() => {});
}

function suspendHeldContext() {
  if (!ctx || ctx.state !== 'running' || typeof ctx.suspend !== 'function') return;
  try {
    ignoreRejection(ctx.suspend());
  } catch {
    // suspend() can throw if the context is already closing
  }
}

function suspendAudioForHiddenPage() {
  if (pageHidden) return;
  pageHidden = true;
  if (bg && !bg.paused) holdMusic = true;
  if (holdMusic && bg) {
    try { bg.pause(); } catch { /* element already stopped */ }
  }
  if (ctx && (ctx.state === 'running' || ctx.state === 'interrupted')) holdContext = true;
  suspendHeldContext();
}

function resumeHeldContext() {
  if (!holdContext || !ctx || typeof ctx.resume !== 'function' || ctx.state === 'closed') return;
  if (ctx.state === 'running') {
    holdContext = false;
    return;
  }
  let pending;
  try {
    pending = ctx.resume();
  } catch {
    return;
  }
  const finish = () => {
    if (pageHidden || !holdContext) {
      suspendHeldContext();
      return;
    }
    holdContext = false;
  };
  if (pending && typeof pending.then === 'function') pending.then(finish, () => {});
  else finish();
}

function resumeHeldMusic() {
  if (!holdMusic || !bg) return;
  bg.volume = volume * masterVolume;
  let pending;
  try {
    pending = bg.play();
  } catch {
    return;
  }
  const finish = () => {
    if (pageHidden || !holdMusic) {
      try { bg.pause(); } catch { /* ignore */ }
      return;
    }
    holdMusic = false;
  };
  if (pending && typeof pending.then === 'function') pending.then(finish, () => {});
  else finish();
}

function resumeAudioForVisiblePage() {
  if (!pageHidden) return;
  pageHidden = false;
  resumeHeldContext();
  resumeHeldMusic();
}

function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.hidden) suspendAudioForHiddenPage();
  else resumeAudioForVisiblePage();
}

function onPageHide() {
  suspendAudioForHiddenPage();
}

function onPageShow() {
  // A load-time pageshow must not start audio; only undo a hide we already applied.
  resumeAudioForVisiblePage();
}

function unbindPageVisibility() {
  if (!visibilityBound) return;
  visibilityDoc?.removeEventListener('visibilitychange', onVisibilityChange);
  visibilityWin?.removeEventListener('pagehide', onPageHide);
  visibilityWin?.removeEventListener('pageshow', onPageShow);
  visibilityBound = false;
  visibilityDoc = null;
  visibilityWin = null;
}

/** Pause music and the shared AudioContext while the tab or app is backgrounded. */
export function installPageVisibilityAudio() {
  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;
  if (!doc && !win) return;
  if (visibilityBound && visibilityDoc === doc && visibilityWin === win) return;
  unbindPageVisibility();
  visibilityBound = true;
  visibilityDoc = doc;
  visibilityWin = win;
  doc?.addEventListener('visibilitychange', onVisibilityChange);
  win?.addEventListener('pagehide', onPageHide);
  win?.addEventListener('pageshow', onPageShow);
}

/* ---------------- Sound effects (Sfx pack in public/audio/sfx/) ---------------- */
let sfxGroups = new Map();
let sfxBase = '';
let sfxManifestPromise = null;
let sfxUnlocked = false;
const sfxBuffers = new Map();
const sfxPending = new Map();
const sfxLastPick = new Map();
const sfxLoops = new Map();
let sfxBus = null;
let sfxMix = { ...DEFAULT_SOUND_MIX };
let sfxRetrigger = createRetriggerGuard();

function sfxBases() {
  let envBase = './';
  try {
    const raw = import.meta.env.BASE_URL || './';
    envBase = raw.endsWith('/') ? raw : `${raw}/`;
  } catch {
    envBase = './';
  }
  const roots = [`${envBase}audio/sfx/`, `${envBase}public/audio/sfx/`];
  if (envBase !== './') roots.push('./audio/sfx/', './public/audio/sfx/');
  return [...new Set(roots)];
}

/** Load manifest.json once; resolves to the variant groups (empty on failure). */
export function loadSfxManifest(fetchFn = typeof fetch === 'function' ? fetch : null) {
  if (sfxManifestPromise) return sfxManifestPromise;
  sfxManifestPromise = (async () => {
    if (!fetchFn) return sfxGroups;
    for (const base of sfxBases()) {
      try {
        const res = await fetchFn(`${base}manifest.json`);
        if (!res.ok) continue;
        sfxGroups = parseSfxManifest(await res.json());
        sfxBase = base;
        break;
      } catch {
        // try the next root
      }
    }
    return sfxGroups;
  })();
  return sfxManifestPromise;
}

export function getSfxGroups() {
  return sfxGroups;
}

function ensureSfxBus() {
  const ac = audio();
  if (!ac) return null;
  if (sfxBus && sfxBus.ctx === ac) return sfxBus;
  const master = ac.createGain();
  master.connect(ac.destination);
  const channels = {};
  for (const key of ['ui', 'world', 'ambience']) {
    channels[key] = ac.createGain();
    channels[key].connect(master);
  }
  sfxBus = { ctx: ac, master, channels };
  applySfxMix();
  return sfxBus;
}

function applySfxMix() {
  if (!sfxBus) return;
  sfxBus.master.gain.value = sfxMix.master;
  for (const key of ['ui', 'world', 'ambience']) sfxBus.channels[key].gain.value = sfxMix[key];
}

export function getSoundMix() {
  return { ...sfxMix };
}

/** Apply the Settings → Sound mix (music uses master × music). */
export function setSoundMix(next) {
  sfxMix = normalizeSoundMix({ ...sfxMix, ...next });
  masterVolume = sfxMix.master;
  if (next && 'music' in next) volume = sfxMix.music;
  if (bg) bg.volume = volume * masterVolume;
  applySfxMix();
  return getSoundMix();
}

async function sfxBuffer(entry) {
  if (sfxBuffers.has(entry.name)) return sfxBuffers.get(entry.name);
  if (sfxPending.has(entry.name)) return sfxPending.get(entry.name);
  const ac = audio();
  if (!ac || typeof fetch !== 'function') return null;
  const job = (async () => {
    for (const file of [entry.file, entry.mp3]) {
      try {
        const res = await fetch(`${sfxBase}${file}`);
        if (!res.ok) continue;
        const data = await res.arrayBuffer();
        const buf = await new Promise((resolve, reject) => {
          const p = ac.decodeAudioData(data, resolve, reject);
          if (p && typeof p.then === 'function') p.then(resolve, reject);
        });
        sfxBuffers.set(entry.name, buf);
        return buf;
      } catch {
        // Safari without Vorbis: fall back to the MP3 copy
      }
    }
    return null;
  })();
  sfxPending.set(entry.name, job);
  return job;
}

/** Called from the Tap/Click to play gesture: no SFX play before this. Preloads every sound. */
export function enableSfx() {
  sfxUnlocked = true;
  kickAudioContext();
  ensureSfxBus();
  loadSfxManifest().then((groups) => {
    for (const list of groups.values()) for (const entry of list) sfxBuffer(entry);
  }).catch(() => {});
}

function sfxAudible(channel) {
  if (!sfxUnlocked || pageHidden) return false;
  if (sfxMix.master <= 0 || sfxMix[channel] <= 0) return false;
  return true;
}

/** Play one random variant of a sound group ("coin", "anvil_hammer", "levelup"...). */
export function playSfx(id, { gain = 1, force = false } = {}) {
  const variants = sfxGroups.get(id);
  if (!variants?.length) return false;
  const pick = pickSfxVariant(variants, Math.random, sfxLastPick.get(id));
  if (!pick || pick.loop || !sfxAudible(pick.channel)) return false;
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && sfxRetrigger(id, nowMs)) return false;
  sfxLastPick.set(id, pick);
  const bus = ensureSfxBus();
  if (!bus) return false;
  if (bus.ctx.state === 'suspended') bus.ctx.resume().catch(() => {});
  sfxBuffer(pick).then((buf) => {
    if (!buf || pageHidden) return;
    const src = bus.ctx.createBufferSource();
    src.buffer = buf;
    const g = bus.ctx.createGain();
    g.gain.value = pick.gain * gain;
    src.connect(g);
    g.connect(bus.channels[pick.channel]);
    src.start();
  }).catch(() => {});
  return true;
}

/** Start/stop a looping sound by its full name ("furnace_loop"). */
export function setSfxLoop(name, on, { gain = 1 } = {}) {
  const entry = sfxGroups.get(name)?.[0];
  const running = sfxLoops.get(name);
  if (!on || !entry || !sfxUnlocked) {
    if (running) {
      running.stopped = true;
      try {
        const t = running.ctx.currentTime;
        running.gain.gain.setTargetAtTime(0, t, 0.08);
        running.src?.stop(t + 0.4);
      } catch { /* already stopped */ }
      sfxLoops.delete(name);
    }
    return false;
  }
  if (running) return true;
  const bus = ensureSfxBus();
  if (!bus) return false;
  const g = bus.ctx.createGain();
  g.gain.value = 0;
  g.connect(bus.channels[entry.channel]);
  const handle = { ctx: bus.ctx, gain: g, src: null, stopped: false };
  sfxLoops.set(name, handle);
  sfxBuffer(entry).then((buf) => {
    if (!buf || handle.stopped) return;
    const src = bus.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    src.start();
    handle.src = src;
    g.gain.setTargetAtTime(entry.gain * gain, bus.ctx.currentTime, 0.15);
  }).catch(() => {});
  return true;
}

export function activeSfxLoops() {
  return [...sfxLoops.keys()];
}

/** Test-only: reset SFX state. */
export function resetSfxForTests() {
  sfxGroups = new Map();
  sfxBase = '';
  sfxManifestPromise = null;
  sfxUnlocked = false;
  sfxBuffers.clear();
  sfxPending.clear();
  sfxLastPick.clear();
  sfxLoops.clear();
  sfxBus = null;
  sfxMix = { ...DEFAULT_SOUND_MIX };
  masterVolume = 1;
  sfxRetrigger = createRetriggerGuard();
}

installPageVisibilityAudio();

/** Test-only: drop playlist/autoplay state between cases. */
export function resetMusicForTests() {
  unbindPageVisibility();
  pageHidden = false;
  holdMusic = false;
  holdContext = false;
  autoplayArmed = false;
  autoplayCancelled = false;
  clearMusic();
  volume = 0.75;
  shuffle = false;
  loopTrack = false;
  ctx = null;
}
