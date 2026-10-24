import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase } from '../../tools/mock-supabase.mjs';
import { createSupabaseClient, parseHashParams } from './supabaseClient.js';
import { memoryStore } from '../game/saveSlots.js';

let mock;
let url;
before(async () => {
  mock = createMockSupabase({ rateLimit: 3 });
  const port = await mock.listen(0);
  url = `http://127.0.0.1:${port}`;
});
after(() => mock.close());

const client = (storage = memoryStore()) => createSupabaseClient({ url, anonKey: 'anon', storage });
const mailFor = async (email) => (await fetch(`${url}/mock/mail?email=${encodeURIComponent(email)}`)).json();

test('magic link redirect signs in; a used link reports expired', async () => {
  const c = client();
  assert.deepEqual(await c.requestLink('a@example.com', 'http://game/'), { ok: true });
  const m = await mailFor('a@example.com');
  assert.match(m.code, /^\d{6}$/);
  const r = await fetch(m.link, { redirect: 'manual' });
  assert.equal(r.status, 303);
  const loc = r.headers.get('location');
  assert.ok(loc.startsWith('http://game/#access_token='));
  const s = await c.sessionFromUrl(loc);
  assert.equal(s.session.user.email, 'a@example.com');
  const again = await fetch(m.link, { redirect: 'manual' });
  assert.deepEqual(await c.sessionFromUrl(again.headers.get('location')), { error: 'expired' });
  assert.equal(parseHashParams('http://game/#foo=1'), null);
});

test('6-digit code signs in; wrong code fails; session persists', async () => {
  const storage = memoryStore();
  const c = client(storage);
  await c.requestLink('b@example.com', 'http://game/');
  const { code } = await mailFor('b@example.com');
  assert.equal((await c.verifyCode('b@example.com', '000000')).ok, code === '000000');
  const ok = await c.verifyCode('b@example.com', code);
  assert.equal(ok.ok, true);
  assert.equal(client(storage).session.user.email, 'b@example.com');
  await c.signOut();
  assert.equal(c.session, null);
});

test('bad email and rate limit map to reasons', async () => {
  const c = client();
  assert.equal((await c.requestLink('nope', '')).reason, 'email');
  for (let i = 0; i < 3; i += 1) await c.requestLink('r@example.com', '');
  const r = await c.requestLink('r@example.com', '');
  assert.equal(r.reason, 'rate');
  assert.ok(r.retryAfter > 0);
});

test('offline maps to reason offline', async () => {
  const c = createSupabaseClient({ url, anonKey: 'anon', storage: memoryStore(), fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
  assert.equal((await c.requestLink('x@example.com', '')).reason, 'offline');
  c.setSession({ access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 3600_000, user: { id: 'u' } });
  await assert.rejects(c.listSaves(), (e) => e.offline === true);
});

test('save_slot compare-and-swap and RLS isolation', async () => {
  const signIn = async (email) => {
    const c = client();
    await c.requestLink(email, '');
    await c.verifyCode(email, (await mailFor(email)).code);
    return c;
  };
  const a = await signIn('rls-a@example.com');
  const b = await signIn('rls-b@example.com');
  const r1 = await a.saveSlot({ slot: 1, data: { gold: 1 }, name: 'A', level: 2, playtime: 3, baseRevision: 0 });
  assert.equal(r1.ok, true);
  assert.equal(r1.row.revision, 1);
  const stale = await a.saveSlot({ slot: 1, data: { gold: 2 }, baseRevision: 0 });
  assert.deepEqual([stale.ok, stale.conflict, stale.row.revision], [false, true, 1]);
  const r2 = await a.saveSlot({ slot: 1, data: { gold: 3 }, baseRevision: 1 });
  assert.equal(r2.row.revision, 2);
  assert.equal((await a.listSaves()).length, 1);
  assert.equal((await b.listSaves()).length, 0, 'B cannot see A');
  await b.deleteSlot(1);
  assert.equal((await a.listSaves()).length, 1, 'B cannot delete A');
  await a.deleteSlot(1);
  assert.equal((await a.listSaves()).length, 0);
  const anon = createSupabaseClient({ url, anonKey: 'anon', storage: memoryStore() });
  await assert.rejects(anon.listSaves(), (e) => e.signedOut);
});

test('expired access token refreshes', async () => {
  const c = client();
  await c.requestLink('ref@example.com', '');
  await c.verifyCode('ref@example.com', (await mailFor('ref@example.com')).code);
  const old = c.session.access_token;
  c.setSession({ ...c.session, expires_at: Date.now() - 1 });
  assert.deepEqual(await c.listSaves(), []);
  assert.notEqual(c.session.access_token, old);
});

test('delete_my_account removes only the caller and their saves', async () => {
  const signIn = async (email) => {
    const c = client();
    await c.requestLink(email, '');
    await c.verifyCode(email, (await mailFor(email)).code);
    return c;
  };
  const a = await signIn('del-a@example.com');
  const b = await signIn('del-b@example.com');
  await a.saveSlot({ slot: 1, data: { gold: 1 }, baseRevision: 0 });
  await b.saveSlot({ slot: 1, data: { gold: 2 }, baseRevision: 0 });
  await a.deleteAccount();
  assert.equal(a.session, null);
  const rows = await (await fetch(`${url}/mock/saves`)).json();
  assert.deepEqual(rows.map((r) => r.data.gold), [2]);
  assert.equal((await b.listSaves()).length, 1);
  // Anonymous callers are refused.
  const anon = await fetch(`${url}/rest/v1/rpc/delete_my_account`, { method: 'POST', headers: { apikey: 'anon', Authorization: 'Bearer anon' } });
  assert.equal(anon.status, 401);
  // An expired session reports signedOut.
  const c = client();
  c.setSession({ access_token: 'dead', refresh_token: 'dead', expires_at: Date.now() + 3600_000, user: { id: 'x', email: 'x@x' } });
  await assert.rejects(c.deleteAccount(), (e) => e.signedOut === true);
});
