/** Light UI clicks plus optional looping background music from an uploaded file. */

let ctx = null;
let bg = null;
let objectUrl = null;
let volume = 0.45;
let trackName = '';

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
  return trackName;
}

export function isMusicPlaying() {
  return Boolean(bg && !bg.paused);
}

export function setMusicVolume(next) {
  volume = Math.min(1, Math.max(0, Number(next) || 0));
  if (bg) bg.volume = volume;
  return volume;
}

function disposeTrack() {
  if (bg) {
    bg.pause();
    bg.src = '';
    bg = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export async function loadMusicFile(file) {
  if (!file) return null;
  disposeTrack();
  objectUrl = URL.createObjectURL(file);
  trackName = file.name || 'Uploaded track';
  bg = new Audio(objectUrl);
  bg.loop = true;
  bg.volume = volume;
  try {
    await bg.play();
  } catch {
    // Autoplay can wait for the next Play click.
  }
  return trackName;
}

export async function playMusic() {
  if (!bg) return false;
  try {
    await bg.play();
    return true;
  } catch {
    return false;
  }
}

export function stopMusic() {
  if (!bg) return;
  bg.pause();
  bg.currentTime = 0;
}

export function clearMusic() {
  disposeTrack();
  trackName = '';
}
