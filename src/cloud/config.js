/**
 * Online saves are off (and their UI hidden) unless a Supabase URL and anon key are found:
 *  1. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time (local dev and the mock win), else
 *  2. <meta name="stallhaven-supabase-url"> and <meta name="stallhaven-supabase-anon-key"> in
 *     index.html. The live GitHub Pages site serves src/ unbuilt, so env vars never reach it.
 * The anon key is a public client key; row-level security protects the data.
 */
export const SUPABASE_URL_META = 'stallhaven-supabase-url';
export const SUPABASE_KEY_META = 'stallhaven-supabase-anon-key';

function readEnv() {
  try {
    return import.meta.env ?? {};
  } catch {
    return {};
  }
}

function readMeta(doc) {
  const d = doc ?? (typeof document !== 'undefined' ? document : null);
  const get = (name) => d?.querySelector?.(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
  return { VITE_SUPABASE_URL: get(SUPABASE_URL_META), VITE_SUPABASE_ANON_KEY: get(SUPABASE_KEY_META) };
}

function pick(e) {
  const url = String(e?.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(e?.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey || !/^https?:\/\//.test(url)) return null;
  return { url, anonKey };
}

export function cloudConfig(env, doc) {
  if (env) return pick(env);
  return pick(readEnv()) ?? pick(readMeta(doc));
}
