// UI fit audit: opens every panel/popup at desktop, foldable and phone sizes and fails if any
// leaves the screen, overlaps the HUD strip / button bar, spills its content, scrolls the page,
// or has its ✕ covered. Usage: npm run dev, then BASE=http://localhost:5173/stallhaven/ npm run ui-fit
// Needs playwright + chromium (PLAYWRIGHT=/path/to/playwright/index.mjs if not installed here).
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:5173/stallhaven/';
const TAG = process.env.TAG || 'check';
const SHOTS = process.env.SHOTS || '/workspace';
const VIEWS = (process.env.VIEWS || '1280x800:m,1024x720:t,390x844:t,344x882:t,882x1104:t').split(',').map((v) => { const [sz, k] = v.split(':'); const [w, h] = sz.split('x').map(Number); return { sz, w, h, touch: k === 't' }; });
const STATIONS = ['anvil', 'furnace', 'range', 'wheel', 'loom', 'fletch', 'potter', 'sawmill', 'altar-air'];
// [name, selector of the visible box, opener (runs in page)]
const P = [
  ...STATIONS.map((st) => [`craft:${st}`, '#craft-modal .craft-sheet', `H.openCraft(${JSON.stringify(st)})`]),
  ['cauldron', '#potion-modal .craft-sheet', 'D.openPotion()'],
  ['shop-chest', '#chest-modal .sheet', 'H.openChest()'],
  ['chest-upgrade', '#chest-upgrade-modal .sheet', 'D.openUpgrade()'],
  ['trade', '#trade-modal .sheet', "S('#trade-modal')"],
  ['offer', '#offer-modal .sheet', "S('#offer-modal')"],
  ['upload', '#import-modal .sheet', "S('#import-modal')"],
  ['help', '#help-modal .sheet', 'D.openHelp()'],
  ['away', '#away-modal .sheet', "S('#away-modal')"],
  ['hero-picker', '#hero-picker .sheet', "S('#hero-picker')"],
  ['display', '#display-modal .sheet', "S('#display-modal')"],
  ['fill', '#fill-modal .sheet', "S('#fill-modal')"],
  ['expand', '#expand-dock', 'D.openExpand()'],
  ['build', '#build-dock', 'D.openBuild()'],
  ['place', '#place-dock', 'D.openPlaceDock()'],
  ['settings', '#settings-dock', "C('#settings-btn')"],
  ['sound', '#sound-dock', "S('#sound-dock')"],
  ['savefiles', '#savefiles-dock', "S('#savefiles-dock')"],
  ['saves', '#saves-dock', "C('#saves-btn')"],
  ['skills', '#skills-dock', "C('#skills-btn')"],
  ['skill-guide', '#skill-guide', "C('#skills-btn'); document.querySelector('#skills-dock [data-skill]')?.click()"],
  ['heroes', '#heroes-dock', "C('#heroes-btn')"],
  ['quests', '#quests-dock', "C('#quests-btn')"],
  ['music', '#music-dock', 'D.openMusic()'],
  ['coop', '#coop-dock', "C('#coop-btn')"],
  ['map', '.is-expanded', "document.querySelector('[data-map-toggle]')?.click()"],
  ['fish-picker', '.fish-picker', 'D.showFishPicker(innerWidth/2, innerHeight/2)'],
  ['furn-menu', '#furn-menu', "S('#furn-menu')"],
];
const closeAll = `document.querySelector('.is-expanded [data-map-toggle], [data-map-close]')?.click(); document.querySelector('[data-guide-back]')?.offsetParent && document.querySelector('#skill-guide').setAttribute('hidden',''); document.querySelectorAll('.modal, .expand-dock, .cs-dock, .furn-menu, .fish-picker').forEach((m) => { m.hidden = true; }); document.querySelectorAll('.skill-guide, .sv-modal').forEach((m) => m.remove?.());`;
const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let b;
const results = [];
for (const v of VIEWS) {
  b = await launch(); // fresh browser per size: swiftshader leaks over long runs
  const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: v.touch, isMobile: v.touch });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'load', timeout: 120000 }); await pg.waitForTimeout(2500);
  await pg.getByText(/(Click|Tap) to play/).click({ timeout: 15000 }).catch(() => {});
  await pg.locator('[data-slot-new="1"]').click({ timeout: 15000 }).catch(() => {});
  await pg.locator('[data-slot-start="1"]').click({ timeout: 15000 }).catch(() => {});
  await pg.waitForFunction(() => window.stallhaven?.hud, null, { timeout: 120000 }); await pg.waitForTimeout(3000);
  for (const [name, sel, open] of P) {
    await pg.evaluate(closeAll); await pg.waitForTimeout(150);
    const err = await pg.evaluate((code) => { const H = window.stallhaven.hud, D = H.debugOpen || {}; const S = (q) => { const e = document.querySelector(q); if (e) e.hidden = false; }; const C = (q) => document.querySelector(q)?.click(); try { new Function('H', 'D', 'S', 'C', code)(H, D, S, C); dispatchEvent(new Event('resize')); return ''; } catch (e) { return String(e); } }, open);
    await pg.waitForTimeout(900);
    await pg.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1500))]));
    await pg.waitForTimeout(150);
    const probe = async (drawer) => pg.evaluate(({ sel, drawer }) => {
      const box = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && !e.closest('[hidden]'));
      if (!box) return null;
      const r = box.getBoundingClientRect(); const o = [];
      const bar = document.querySelector('#save-bar')?.getBoundingClientRect();
      const hud = document.querySelector('#hud .ledger')?.getBoundingClientRect();
      const ov = (a) => a && a.height && r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) o.push(`offscreen [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`);
      if (ov(bar)) o.push('overlaps bar');
      if (matchMedia('(pointer: coarse)').matches && ov(hud)) o.push('overlaps hud');
      const cs = getComputedStyle(box);
      if (cs.overflowY === 'visible' && box.scrollHeight > box.clientHeight + 2) o.push(`content spills ${box.scrollHeight}>${box.clientHeight}`);
      if (box.scrollWidth > box.clientWidth + 2 && cs.overflowX !== 'visible') o.push('h-scroll');
      const x = box.querySelector('.craft-x, .cs-x, [data-close], [aria-label="Close"], button.x');
      if (x) { const q = x.getBoundingClientRect(); const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); if (!x.contains(h)) o.push(`x covered${drawer ? ' (drawer)' : ''} by ${h?.id || h?.className}`); }
      const de = document.documentElement; if (de.scrollWidth > innerWidth + 1 || de.scrollHeight > innerHeight + 1 || scrollY > 0) o.push('page scroll');
      return { rect: [r.left, r.top, r.width, r.height].map(Math.round), zoom: box.style.zoom || getComputedStyle(box).zoom, o };
    }, { sel, drawer });
    let res = await probe(false);
    if (res && v.touch) { // with the materials drawer open too
      await pg.evaluate(() => document.querySelector('#materials-toggle')?.click()); await pg.waitForTimeout(900);
      const r2 = await probe(true); if (r2) res.o.push(...r2.o.filter((x) => x.includes('drawer')));
      await pg.evaluate(() => { if (document.querySelector('#materials-toggle')?.getAttribute('aria-expanded') === 'true') document.querySelector('#materials-toggle').click(); }); await pg.waitForTimeout(200);
      res = (await probe(false)) ? { ...res } : res;
    }
    const row = { view: v.sz, name, status: !res ? 'SKIP' : res.o.length ? 'FAIL' : 'ok', info: res ? res.o.join('; ') : (err || 'not opened'), zoom: res?.zoom };
    results.push(row); console.log(row.status.padEnd(4), v.sz.padEnd(9), name.padEnd(14), row.info);
    if (res) { await pg.evaluate(closeAll); await pg.evaluate((code) => { const H = window.stallhaven.hud, D = H.debugOpen || {}; const S = (q) => { const e = document.querySelector(q); if (e) e.hidden = false; }; const C = (q) => document.querySelector(q)?.click(); try { new Function('H', 'D', 'S', 'C', code)(H, D, S, C); } catch {} }, open); await pg.waitForTimeout(1200); await pg.screenshot({ path: `${SHOTS}/uifit_${name.replace(/\W/g, '-')}_${v.sz}_${TAG}.png` }).catch(() => {}); }
  }
  await ctx.close(); await b.close();
}
const f = results.filter((r) => r.status === 'FAIL'); const s = results.filter((r) => r.status === 'SKIP');
console.log(`\n${results.length} checks, ${f.length} fail, ${s.length} skipped`);
process.exit(f.length ? 1 : 0);
