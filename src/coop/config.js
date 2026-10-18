/**
 * Where the co-op room server lives, and whether the Co-op button shows.
 *
 * The button only appears when a room server is configured, or when the game
 * runs on this machine (localhost / 127.0.0.1), where `npm run coop:server`
 * provides one. On the live site, with no server configured, co-op stays hidden.
 *
 * Configure a server with either:
 *  - VITE_ROOM_SERVER_URL=https://… at Vite build time, or
 *  - <meta name="stallhaven-room-server" content="https://…"> in index.html
 *    (the live Pages site serves src/ unbundled, so it has no import.meta.env).
 */
export const LOCAL_ROOM_SERVER = 'http://127.0.0.1:8787';
export const ROOM_SERVER_META = 'stallhaven-room-server';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalHost(hostname) {
  const h = String(hostname ?? '').toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith('.localhost');
}

/** The configured room server URL, or null when none is set. */
export function configuredServerUrl({ env = import.meta.env, doc = globalThis.document } = {}) {
  const fromEnv = typeof env?.VITE_ROOM_SERVER_URL === 'string' ? env.VITE_ROOM_SERVER_URL.trim() : '';
  const fromMeta = doc?.querySelector?.(`meta[name="${ROOM_SERVER_META}"]`)?.getAttribute('content')?.trim() ?? '';
  const url = fromEnv || fromMeta;
  return url ? url.replace(/\/+$/, '') : null;
}

/** URL the client connects to: configured, else the local dev server. */
export function roomServerUrl(opts = {}) {
  return configuredServerUrl(opts) ?? LOCAL_ROOM_SERVER;
}

/** Show the Co-op button? Only with a configured server, or when running locally. */
export function coopAvailable({ env = import.meta.env, doc = globalThis.document, hostname = globalThis.location?.hostname } = {}) {
  return Boolean(configuredServerUrl({ env, doc })) || isLocalHost(hostname);
}
