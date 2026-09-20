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
const playlist = [];
let currentIndex = -1;
let serial = 1;
let shuffle = false;
let loopTrack = false;
let autoplayArmed = false;
let autoplayCancelled = false;
const DEFAULT_AUTOPLAY_TRACK = 'Newbie Melody';

function audio() {
  if (ctx) return ctx;
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
  if (bg) bg.volume = volume;
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
  bg.volume = volume;
  bindEndedHandler();
  return track;
}

export async function playTrackAt(index) {
  if (index < 0 || index >= playlist.length) return false;
  stopCurrent();
  bindTrack(index);
  try {
    await bg.play();
    return true;
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
    const audioEl = new Audio(url);
    audioEl.preload = 'auto';
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
  try {
    await bg.play();
    return true;
  } catch {
    return false;
  }
}

export function pauseMusic() {
  if (!bg) return;
  bg.pause();
}

export function stopMusic() {
  cancelMusicAutoplay();
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
  const audioEl = new Audio(url);
  audioEl.preload = 'metadata';
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
  const resume = async () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
    if (autoplayCancelled) return;
    const ac = audio();
    if (ac?.state === 'suspended') await ac.resume().catch(() => {});
    await playTrackAt(index).catch(() => {});
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
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
  if (muted || getMusicVolume() <= 0 || !playlist.length) {
    return { played: false, reason: 'muted' };
  }
  autoplayCancelled = false;
  let index = playlistIndexByName(track);
  if (index < 0) index = playlistIndexByName(DEFAULT_AUTOPLAY_TRACK);
  if (index < 0) index = 0;
  const played = await playTrackAt(index);
  if (!played) armGestureAutoplay(index);
  return { played, track: getMusicTrackName() };
}
