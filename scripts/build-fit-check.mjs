// Construction catalogue fit check: every tab + category at 5 viewports (mouse + touch).
// Usage: BASE=http://localhost:5173/ node scripts/build-fit-check.mjs   (needs playwright + chromium)
const pwPath = process.env.PLAYWRIGHT || 'playwright';
const { chromium } = await import(pwPath);
const BASE = process.env.BASE || 'http://localhost:5173/';
const TAG = process.env.TAG || 'check';
const VIEWS = [['1280x800', false], ['1280x620', false], ['1024x720', true], ['390x844', true], ['344x882', true], ['882x1104', true]];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
for (const [sz, touch] of VIEWS) {
  const [width, height] = sz.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load', timeout: 120000 }); await pg.waitForTimeout(2500);
  await pg.getByText(/(Click|Tap) to play/).click({ timeout: 15000 }).catch(() => {});
  await pg.locator('[data-slot-new="1"]').click({ timeout: 15000 }).catch(() => {});
  await pg.locator('[data-slot-start="1"]').click({ timeout: 15000 }).catch(() => {});
  await pg.waitForFunction(() => window.stallhaven?.hud, null, { timeout: 120000 }); await pg.waitForTimeout(3000);
  await pg.evaluate(() => { document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; }); document.querySelector('#build-btn')?.click(); });
  await pg.waitForTimeout(600);
  const tabs = await pg.evaluate(() => [...document.querySelectorAll('#build-dock .build-tabs button')].map((_, i) => i));
  for (const ti of tabs) {
    await pg.evaluate((i) => document.querySelectorAll('#build-dock .build-tabs button')[i].click(), ti); await pg.waitForTimeout(300);
    const cats = await pg.evaluate(() => [...document.querySelectorAll('#build-dock .build-side:not([hidden]) button')].length);
    for (let ci = 0; ci < Math.max(1, cats); ci++) {
      const name = await pg.evaluate(({ ti, ci }) => {
        const t = document.querySelectorAll('#build-dock .build-tabs button')[ti];
        const c = document.querySelectorAll('#build-dock .build-side:not([hidden]) button')[ci];
        c?.click(); return `${t.textContent.trim()}/${c ? c.textContent.trim() : '-'}`;
      }, { ti, ci });
      await pg.waitForTimeout(350);
      const over = await pg.evaluate(() => {
        const d = document.querySelector('#build-dock'); const r = d.getBoundingClientRect(); const o = [];
        const hud = document.querySelector('#hud .ledger')?.getBoundingClientRect(); const bar = document.querySelector('#save-bar')?.getBoundingClientRect();
        if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) o.push(`offscreen ${Math.round(r.bottom)}>${innerHeight}`);
        if (hud && hud.height && r.top < hud.bottom - 1 && r.left < hud.right && r.right > hud.left) o.push('under hud');
        if (bar && bar.height && bar.top > innerHeight / 2 && r.bottom > bar.top + 1) o.push('under bar');
        const x = d.querySelector('.craft-x'); if (x) { const q = x.getBoundingClientRect(); const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); if (!x.contains(h)) o.push('x covered'); }
        if (d.scrollHeight > d.clientHeight + 2) o.push(`panel content spills ${d.scrollHeight}>${d.clientHeight}`);
        const items = [...d.querySelectorAll('.build-item:not([hidden])')].filter((e) => e.offsetParent);
        const last = items[items.length - 1]; const l = d.querySelector('.build-layout');
        if (last && l && getComputedStyle(l).overflowY === 'visible' && last.getBoundingClientRect().bottom > Math.min(r.bottom, innerHeight) + 1) o.push('items past panel, no list scroll');
        const de = document.documentElement; if (de.scrollWidth > innerWidth + 1 || de.scrollHeight > innerHeight + 1) o.push('page scroll');
        return o;
      });
      if (over.length) { fails++; console.log('FAIL', sz, name, over.join(', ')); await pg.screenshot({ path: `/workspace/uifit_build_${width}_${TAG}.png` }).catch(() => {}); }
      else console.log('ok  ', sz, name);
    }
  }
  await ctx.close();
}
await b.close();
console.log(fails ? `FAILED ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
