/**
 * Online saves are off (and their UI hidden) unless both env vars are set at
 * build time. The live site is served as plain ES modules too, where
 * import.meta.env does not exist, so read it defensively.
 */
export function cloudConfig(env) {
  let e = env;
  if (!e) {
    try {
      e = import.meta.env ?? {};
    } catch {
      e = {};
    }
  }
  const url = String(e?.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(e?.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
