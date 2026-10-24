#!/usr/bin/env node
/**
 * Local stand-in for Supabase (auth + the saves table) used when Docker / the
 * Supabase CLI can't run. It speaks the same REST subset the game uses:
 *
 *   POST /auth/v1/otp?redirect_to=…        send a magic link + 6-digit code (caught in the mailbox)
 *   GET  /auth/v1/verify?token=…&type=magiclink&redirect_to=…   303 → redirect_to#access_token=…
 *   POST /auth/v1/verify {type:'email', email, token}           → session
 *   POST /auth/v1/token?grant_type=refresh_token
 *   GET  /auth/v1/user, POST /auth/v1/logout
 *   GET  /rest/v1/saves, DELETE /rest/v1/saves?slot=eq.N, POST /rest/v1/rpc/save_slot
 *
 * Row-level security is emulated: every query is filtered by the bearer token's user.
 * Test helpers (like Inbucket/Mailpit): GET /mock/mail?email=…  POST /mock/expire?email=…  POST /mock/reset
 *
 * Run: node tools/mock-supabase.mjs [port]   (default 54321). Anon key: any non-empty apikey header.
 */
import { createServer } from 'node:http';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function createMockSupabase({ rateLimit = 5, rateWindowMs = 60_000, tokenTtlS = 3600, now = () => Date.now() } = {}) {
  const users = new Map(); // email -> { id, email }
  const tokens = new Map(); // access token -> { userId, exp }
  const refresh = new Map(); // refresh token -> userId
  const links = new Map(); // token_hash -> { email, code, exp, used, redirect }
  const mail = new Map(); // email -> [{ link, code, at }]
  const sends = new Map(); // email -> [timestamps]
  const saves = new Map(); // `${userId}:${slot}` -> row

  const rand = (n = 24) => randomBytes(n).toString('hex');
  const userFor = (email) => {
    let u = users.get(email);
    if (!u) {
      u = { id: randomUUID(), email };
      users.set(email, u);
    }
    return u;
  };
  const session = (u) => {
    const access = rand();
    const ref = rand();
    tokens.set(access, { userId: u.id, exp: now() + tokenTtlS * 1000 });
    refresh.set(ref, u.id);
    return { access_token: access, refresh_token: ref, token_type: 'bearer', expires_in: tokenTtlS, expires_at: Math.floor(now() / 1000) + tokenTtlS, user: { id: u.id, email: u.email } };
  };
  const byId = (id) => [...users.values()].find((u) => u.id === id);

  function send(res, status, body, headers = {}) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, x-client-info',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
      'Access-Control-Expose-Headers': 'retry-after',
      ...headers,
    });
    res.end(body == null ? '' : JSON.stringify(body));
  }

  async function readBody(req) {
    let s = '';
    for await (const c of req) s += c;
    try {
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  }

  function authUser(req) {
    const t = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const rec = tokens.get(t);
    if (!rec || rec.exp < now()) return null;
    return byId(rec.userId) ?? null;
  }

  const strip = (row) => {
    const { user_id: _u, ...rest } = row;
    return rest;
  };

  async function handle(req, res) {
    const u = new URL(req.url, 'http://mock');
    const p = u.pathname;
    if (req.method === 'OPTIONS') return send(res, 204, null);

    // ---- test helpers
    if (p === '/mock/mail') {
      const list = mail.get((u.searchParams.get('email') ?? '').toLowerCase()) ?? [];
      return send(res, 200, list.at(-1) ?? null);
    }
    if (p === '/mock/expire' && req.method === 'POST') {
      const email = (u.searchParams.get('email') ?? '').toLowerCase();
      for (const l of links.values()) if (l.email === email) l.exp = 0;
      return send(res, 200, { ok: true });
    }
    if (p === '/mock/reset' && req.method === 'POST') {
      users.clear(); tokens.clear(); refresh.clear(); links.clear(); mail.clear(); sends.clear(); saves.clear();
      return send(res, 200, { ok: true });
    }
    if (p === '/mock/saves') return send(res, 200, [...saves.values()]);

    if (!req.headers.apikey && p !== '/auth/v1/verify') return send(res, 401, { message: 'No API key found in request' });

    // ---- auth
    if (p === '/auth/v1/otp' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
      const recent = (sends.get(email) ?? []).filter((t) => now() - t < rateWindowMs);
      if (recent.length >= rateLimit) {
        return send(res, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }, { 'Retry-After': String(Math.ceil(rateWindowMs / 1000)) });
      }
      recent.push(now());
      sends.set(email, recent);
      const hash = rand(16);
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const redirect = u.searchParams.get('redirect_to') ?? '';
      links.set(hash, { email, code, exp: now() + 3600_000, used: false, redirect });
      const host = `http://${req.headers.host}`;
      const link = `${host}/auth/v1/verify?token=${hash}&type=magiclink&redirect_to=${encodeURIComponent(redirect)}`;
      const list = mail.get(email) ?? [];
      list.push({ to: email, subject: 'Your Store of Geilenor login link', link, code, at: now() });
      mail.set(email, list);
      return send(res, 200, {});
    }
    if (p === '/auth/v1/verify' && req.method === 'GET') {
      const l = links.get(u.searchParams.get('token') ?? '');
      const redirect = u.searchParams.get('redirect_to') || l?.redirect || '/';
      if (!l || l.used || l.exp < now()) {
        res.writeHead(303, { Location: `${redirect}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired` });
        return res.end();
      }
      l.used = true;
      const s = session(userFor(l.email));
      const frag = new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: String(s.expires_at), expires_in: String(s.expires_in), token_type: 'bearer', type: 'magiclink' });
      res.writeHead(303, { Location: `${redirect}#${frag}` });
      return res.end();
    }
    if (p === '/auth/v1/verify' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email ?? '').trim().toLowerCase();
      const l = [...links.values()].reverse().find((x) => x.email === email && x.code === String(body.token ?? ''));
      if (!l) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      if (l.used || l.exp < now()) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      l.used = true;
      return send(res, 200, session(userFor(email)));
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const body = await readBody(req);
      const id = refresh.get(body.refresh_token);
      if (!id) return send(res, 400, { error_code: 'refresh_token_not_found' });
      refresh.delete(body.refresh_token);
      return send(res, 200, session(byId(id)));
    }
    if (p === '/auth/v1/user') {
      const me = authUser(req);
      return me ? send(res, 200, { id: me.id, email: me.email }) : send(res, 401, { msg: 'invalid JWT' });
    }
    if (p === '/auth/v1/logout' && req.method === 'POST') {
      tokens.delete((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
      return send(res, 204, null);
    }

    // ---- data (RLS: only the caller's rows)
    if (p.startsWith('/rest/v1/')) {
      const me = authUser(req);
      if (!me) return send(res, 401, { code: 'PGRST301', message: 'JWT expired or missing' });
      if (p === '/rest/v1/saves' && req.method === 'GET') {
        const rows = [...saves.values()].filter((r) => r.user_id === me.id).sort((a, b) => a.slot - b.slot).map(strip);
        return send(res, 200, rows);
      }
      if (p === '/rest/v1/saves' && req.method === 'DELETE') {
        const m = /^eq\.(\d)$/.exec(u.searchParams.get('slot') ?? '');
        if (m) saves.delete(`${me.id}:${m[1]}`);
        return send(res, 204, null);
      }
      if (p === '/rest/v1/rpc/save_slot' && req.method === 'POST') {
        const b = await readBody(req);
        const slot = Number(b.p_slot);
        if (!(slot >= 1 && slot <= 3) || !b.p_data || typeof b.p_data !== 'object') return send(res, 400, { message: 'bad args' });
        const key = `${me.id}:${slot}`;
        const cur = saves.get(key);
        const base = Number(b.p_base_revision) || 0;
        if (!cur && base !== 0) return send(res, 200, { ok: false, conflict: true, row: null });
        if (cur && cur.revision !== base) return send(res, 200, { ok: false, conflict: true, row: strip(cur) });
        const row = {
          user_id: me.id,
          slot,
          data: b.p_data,
          name: String(b.p_name ?? '').slice(0, 64),
          level: Number(b.p_level) || 1,
          playtime: Number(b.p_playtime) || 0,
          updated_at: new Date(now()).toISOString(),
          device_id: String(b.p_device_id ?? '').slice(0, 64),
          device_label: String(b.p_device_label ?? '').slice(0, 64),
          revision: (cur?.revision ?? 0) + 1,
        };
        saves.set(key, row);
        return send(res, 200, { ok: true, conflict: false, row: strip(row) });
      }
    }
    return send(res, 404, { message: `no route ${req.method} ${p}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => send(res, 500, { message: String(err?.message ?? err) }));
  });
  return {
    server,
    saves,
    mail,
    listen(port = 54321) {
      return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port)));
    },
    close: () => new Promise((r) => server.close(() => r())),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.argv[2]) || 54321;
  const mock = createMockSupabase();
  mock.listen(port).then((p) => console.log(`mock supabase on http://127.0.0.1:${p}  (mailbox: /mock/mail?email=…)`));
}
