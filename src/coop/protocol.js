/**
 * Co-op wire protocol shared by the browser client and the room server.
 * Messages are JSON objects with a `t` (type) field. See docs/COOP.md.
 */
export const PROTOCOL_VERSION = 1;

/** Invite code alphabet: no 0, 1, I or O. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

export const MAX_PLAYERS = 4;
export const COLORS = Object.freeze(['red', 'blue', 'green', 'purple']);
export const NAME_MAX = 16;
export const DEFAULT_NAME = 'Player';

/** Seconds a dropped player's slot is held (host or guest). */
export const HOLD_SECONDS = 120;
/** Client reconnect schedule (seconds between tries), about 60 s in total. */
export const RECONNECT_DELAYS = Object.freeze([2, 5, 10, 18, 25]);
export const PING_EVERY_MS = 2000;

/** Message size caps (bytes of the raw text). */
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_HELLO_BYTES = 512 * 1024;

/** Per connection token bucket. */
export const RATE_BURST = 40;
export const RATE_PER_SECOND = 20;

/** Bad join attempts (unknown or malformed codes) per IP before a lockout. */
export const BAD_JOIN_LIMIT = 5;
export const BAD_JOIN_WINDOW_SECONDS = 60;
export const BAD_JOIN_LOCK_SECONDS = 60;

export const JOIN_ERRORS = Object.freeze(['not_found', 'room_full', 'kicked', 'bad_code', 'bad_name', 'rate_limited']);
export const END_REASONS = Object.freeze(['host_left', 'host_ended', 'kicked', 'room_closed', 'connection_lost']);

/** WebSocket close codes used by the room. */
export const CLOSE = Object.freeze({
  ENDED: 4000,
  KICKED: 4001,
  REPLACED: 4002,
  JOIN_ERROR: 4003,
  ABUSE: 4008,
  BAD_MESSAGE: 4400,
});

export function normalizeCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export function isValidCode(code) {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Random invite code. `randomBytes(n)` returns a Uint8Array. */
export function makeCode(randomBytes) {
  const bytes = randomBytes(CODE_LENGTH * 2);
  let out = '';
  for (let i = 0; out.length < CODE_LENGTH && i < bytes.length; i += 1) {
    // 256 is a multiple of 32, so a mask keeps the pick unbiased.
    out += CODE_ALPHABET[bytes[i] & 31];
  }
  return out;
}

/** Clean a player name. Returns the name, or null when it isn't allowed. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N} ]+$/u.test(name)) return null;
  return name;
}

/** Add " (2)", " (3)" … when the name is taken. */
export function uniqueName(name, taken) {
  const lower = new Set([...taken].map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let i = 2; i < 100; i += 1) {
    const next = `${name} (${i})`;
    if (!lower.has(next.toLowerCase())) return next;
  }
  return `${name} (${Date.now() % 1000})`;
}
