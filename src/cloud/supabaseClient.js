/**
 * Minimal Supabase client over fetch (GoTrue auth + PostgREST), so the game
 * does not need the supabase-js bundle. Same interface as memoryBackend.js:
 *
 *   requestLink(email, redirectTo)   -> { ok } | { ok:false, reason: email|offline|rate|unknown, retryAfter? }
 *   verifyCode(email, code)          -> { ok, session } | { ok:false, reason: code|expired|offline|rate|unknown }
 *   sessionFromUrl(href)             -> { session } | { error: 'expired'|'unknown' } | null
 *   session / setSession(s) / signOut()
 *   listSaves()                      -> rows
 *   saveSlot(args)                   -> { ok, conflict, row }
 *   deleteSlot(slot)
 *
 * Network failures throw an Error with .offline = true.
 */
const SESSION_KEY = 'rc-cloud-session';

export function parseHashParams(href) {
  const i = href.indexOf('#');
  if (i < 0) return null;
  const p = new URLSearchParams(href.slice(i + 1));
  if (!p.has('access_token') && !p.has('error') && !p.has('error_code')) return null;
  return p;
}

function offlineError(err) {
  return Object.assign(new Error(err?.message || 'offline'), { offline: true });
}

export function createSupabaseClient({ url, anonKey, fetchImpl, storage, now = () => Date.now() }) {
  const f = fetchImpl ?? ((...a) => globalThis.fetch(...a));
  let session = null;
  try {
    const raw = storage?.getItem(SESSION_KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }

  function persist(s) {
    session = s;
    try {
      if (s) storage?.setItem(SESSION_KEY, JSON.stringify(s));
      else storage?.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  function toSession(body) {
    if (!body?.access_token) return null;
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at ? Number(body.expires_at) * 1000 : now() + (Number(body.expires_in) || 3600) * 1000,
      user: body.user ? { id: body.user.id, email: body.user.email } : null,
    };
  }

  async function call(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
    const h = { apikey: anonKey, 'Content-Type': 'application/json', ...headers };
    if (auth) {
      const token = await accessToken();
      if (!token) throw Object.assign(new Error('signed out'), { signedOut: true });
      h.Authorization = `Bearer ${token}`;
    } else {
      h.Authorization = `Bearer ${anonKey}`;
    }
    let res;
    try {
      res = await f(`${url}${path}`, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
    } catch (err) {
      throw offlineError(err);
    }
    let json = null;
    const text = await res.text().catch(() => '');
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json, headers: res.headers };
  }

  async function accessToken() {
    if (!session) return null;
    if (session.expires_at - now() > 60_000) return session.access_token;
    // Refresh shortly before expiry.
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
    if (r.ok && r.json?.access_token) {
      persist({ ...toSession(r.json), user: r.json.user ? { id: r.json.user.id, email: r.json.user.email } : session.user });
      return session.access_token;
    }
    if (r.status === 400 || r.status === 401) persist(null);
    return null;
  }

  function reasonFor(r) {
    const code = r.json?.error_code ?? r.json?.code ?? '';
    if (r.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'rate';
    if (code === 'otp_expired') return 'expired';
    if (code === 'validation_failed' || code === 'email_address_invalid') return 'email';
    return 'unknown';
  }

  return {
    kind: 'supabase',
    get session() {
      return session;
    },
    setSession: persist,

    async requestLink(email, redirectTo) {
      try {
        const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
        const r = await call(`/auth/v1/otp${q}`, { method: 'POST', body: { email, create_user: true } });
        if (r.ok) return { ok: true };
        const retry = Number(r.headers?.get?.('retry-after')) || null;
        return { ok: false, reason: reasonFor(r), ...(retry ? { retryAfter: retry } : {}) };
      } catch (err) {
        return { ok: false, reason: err.offline ? 'offline' : 'unknown' };
      }
    },

    async verifyCode(email, code) {
      try {
        const r = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } });
        const s = r.ok ? toSession(r.json) : null;
        if (s) {
          persist(s);
          return { ok: true, session: s };
        }
        const reason = reasonFor(r);
        return { ok: false, reason: reason === 'unknown' ? 'code' : reason };
      } catch (err) {
        return { ok: false, reason: err.offline ? 'offline' : 'unknown' };
      }
    },

    /** Read #access_token=… (or #error_code=otp_expired) left by the magic link redirect. */
    async sessionFromUrl(href) {
      const p = parseHashParams(href);
      if (!p) return null;
      if (!p.has('access_token')) {
        return { error: p.get('error_code') === 'otp_expired' ? 'expired' : 'unknown' };
      }
      const s = toSession({
        access_token: p.get('access_token'),
        refresh_token: p.get('refresh_token'),
        expires_at: p.get('expires_at'),
        expires_in: p.get('expires_in'),
      });
      persist(s);
      const r = await call('/auth/v1/user', { auth: true }).catch(() => null);
      if (r?.ok && r.json?.id) persist({ ...s, user: { id: r.json.id, email: r.json.email } });
      return { session };
    },

    async signOut() {
      try {
        if (session) await call('/auth/v1/logout', { method: 'POST', auth: true });
      } catch {
        /* still sign out locally */
      }
      persist(null);
    },

    async listSaves() {
      const r = await call('/rest/v1/saves?select=slot,data,name,level,playtime,updated_at,device_id,device_label,revision&order=slot', { auth: true });
      if (r.status === 401) throw Object.assign(new Error('signed out'), { signedOut: true });
      if (!r.ok) throw new Error(`list ${r.status}`);
      return Array.isArray(r.json) ? r.json : [];
    },

    async saveSlot({ slot, data, name, level, playtime, deviceId, deviceLabel, baseRevision }) {
      const r = await call('/rest/v1/rpc/save_slot', {
        method: 'POST',
        auth: true,
        body: {
          p_slot: slot,
          p_data: data,
          p_name: name ?? '',
          p_level: level ?? 1,
          p_playtime: playtime ?? 0,
          p_device_id: deviceId ?? '',
          p_device_label: deviceLabel ?? '',
          p_base_revision: baseRevision ?? 0,
        },
      });
      if (r.status === 401) throw Object.assign(new Error('signed out'), { signedOut: true });
      if (!r.ok || !r.json) throw new Error(`save ${r.status}`);
      return r.json;
    },

    async deleteSlot(slot) {
      const r = await call(`/rest/v1/saves?slot=eq.${Number(slot)}`, { method: 'DELETE', auth: true });
      if (!r.ok && r.status !== 404) throw new Error(`delete ${r.status}`);
    },
  };
}
