/**
 * In-memory cloud with the same interface as supabaseClient.js, for unit tests.
 * createMemoryCloud() is the "server"; cloud.client(email) is one device's client.
 */
export function createMemoryCloud({ now = () => Date.now() } = {}) {
  const rows = new Map(); // `${email}:${slot}` -> row
  let down = false;
  const fail = () => {
    if (down) throw Object.assign(new Error('offline'), { offline: true });
  };
  return {
    rows,
    setOffline(v) {
      down = Boolean(v);
    },
    client(email) {
      let session = null;
      const key = (slot) => `${session.user.email}:${slot}`;
      return {
        kind: 'memory',
        get session() {
          return session;
        },
        setSession(s) {
          session = s;
        },
        async requestLink() {
          fail();
          return { ok: true };
        },
        async verifyCode() {
          fail();
          session = { access_token: 't', user: { id: `id-${email}`, email } };
          return { ok: true, session };
        },
        async sessionFromUrl() {
          return null;
        },
        async signOut() {
          session = null;
        },
        async deleteAccount() {
          fail();
          if (!session) throw Object.assign(new Error('signed out'), { signedOut: true });
          for (const k of [...rows.keys()]) if (k.startsWith(`${session.user.email}:`)) rows.delete(k);
          session = null;
        },
        async listSaves() {
          fail();
          return [...rows.entries()].filter(([k]) => k.startsWith(`${email}:`)).map(([, r]) => structuredClone(r)).sort((a, b) => a.slot - b.slot);
        },
        async saveSlot(a) {
          fail();
          const cur = rows.get(key(a.slot));
          const base = Number(a.baseRevision) || 0;
          if ((!cur && base !== 0) || (cur && cur.revision !== base)) {
            return { ok: false, conflict: true, row: cur ? structuredClone(cur) : null };
          }
          const row = {
            slot: a.slot,
            data: structuredClone(a.data),
            name: a.name,
            level: a.level,
            playtime: a.playtime,
            updated_at: new Date(now()).toISOString(),
            device_id: a.deviceId,
            device_label: a.deviceLabel,
            revision: (cur?.revision ?? 0) + 1,
          };
          rows.set(key(a.slot), row);
          return { ok: true, conflict: false, row: structuredClone(row) };
        },
        async deleteSlot(slot) {
          fail();
          rows.delete(key(slot));
        },
      };
    },
  };
}
