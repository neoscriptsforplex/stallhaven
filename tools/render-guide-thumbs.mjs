// Re-run when models change: node tools/render-guide-thumbs.mjs  (vite dev server on :5299)
// Writes thumbs/<kind>-<id>.png (128x128 = 64px@2x, transparent) + thumbs/manifest.json.
import { chromium } from '/workspace/pw/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { enter, clean } from './enter.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
pg.on('console', (m) => m.type() === 'error' && console.log('C', m.text().slice(0, 200)));
await enter(pg); await clean(pg);
const out = await pg.evaluate(async () => {
  const threeUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /deps\/three\.js/.test(n));
  const THREE = await import(threeUrl);
  const G = await import('/stallhaven/src/game/skillGuideData.js');
  const R = await import('/stallhaven/src/game/guideRenders.js');
  const M = await import('/stallhaven/src/game/models.js');
  const C = await import('/stallhaven/src/game/catalog.js');
  const P = await import('/stallhaven/src/game/craftpreview.js');
  const A = await import('/stallhaven/src/game/animProps.js');
  const K = await import('/stallhaven/src/game/construction.js');
  const L = await import('/stallhaven/src/game/skillLevels.js');
  const known = (id) => C.RECIPES[id] || C.MATERIALS?.[id] || C.isCraftOreId(id);
  const U = await import('/stallhaven/src/game/upload.js');
  async function build(key) {
    const [kind, id] = key.split(':');
    if (kind === 'look') {
      if (id === 'small_net') { const n = await U.loadBundledPropScene('items/small_net'); n.scale.setScalar(0.01125); return n; }
      let l = M.getBundledLook(id);
      if (!l && id.startsWith('ore-')) { const o = id.slice(4); const f = o === 'essence' ? 'essence' : `${o === 'runite' ? 'rune' : o}-rocks`; try { l = await U.loadBundledPropScene(`dungeon-rocks/${f}`); } catch (e) { console.error('rock', id, e.message); } } if (!l) return null; const m = l.clone(true); return m; }
    if (kind === 'item') {
      if (!known(id)) return null;
      const w = M.buildWare(id); try { P.applyCraftPreviewEuler(w, id); } catch {}
      return w;
    }
    const s = 0.01125 * (K.constructionPiece(id)?.scale ?? 1);
    const anim = A.animPieceVisual(id, s); if (anim) return anim;
    let look = M.getBundledLook(K.constructionLookId(id));
    if (!look) { try { look = await U.loadBundledPropScene(`furniture/${id}`); } catch (e) { console.error('load', id, e.message); } }
    if (!look) return null; const m = look.clone(true); m.scale.setScalar(s); return m;
  }
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(128, 128); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  const shots = {}; const rows = []; const cache = {};
  async function shoot(key) {
    if (key in cache) return cache[key];
    let ok = false;
    try {
      const obj = await build(key);
      if (obj) {
        obj.updateMatrixWorld(true);
        let meshes = 0; obj.traverse((o) => { if (o.isMesh) meshes++; });
        const box = new THREE.Box3().setFromObject(obj);
        let boxOnly = meshes === 1; obj.traverse((o) => { if (o.isMesh && o.geometry?.type !== 'BoxGeometry') boxOnly = false; });
        if (boxOnly) { const z = box.getSize(new THREE.Vector3()); const a = [z.x, z.y, z.z].sort((p, q) => p - q); if (a[2] / a[0] > 1.6) boxOnly = false; } // planks are real boxes; the no-model fallback is a cube
        if (boxOnly) console.log('placeholder', key);
        if (meshes && !boxOnly && Number.isFinite(box.min.x)) {
          const scene = new THREE.Scene();
          scene.add(new THREE.HemisphereLight(0xfff2dd, 0x40301f, 2.2));
          const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 5, 4); scene.add(d);
          scene.add(obj);
          const c = box.getCenter(new THREE.Vector3()); const sph = box.getBoundingSphere(new THREE.Sphere());
          const cam = new THREE.PerspectiveCamera(28, 1, 0.001, 1000);
          const dist = sph.radius / Math.sin((28 / 2) * Math.PI / 180) * 1.05;
          cam.position.copy(c).add(new THREE.Vector3(0.62, 0.45, 0.65).normalize().multiplyScalar(dist)); cam.lookAt(c);
          cam.near = dist / 100; cam.far = dist * 10; cam.updateProjectionMatrix();
          r.render(scene, cam); shots[key] = r.domElement.toDataURL('image/png'); ok = true;
        }
      }
    } catch (e) { console.error(key, e.message); }
    return (cache[key] = ok);
  }
  for (const [skill, guide] of Object.entries(G.SKILL_GUIDES)) for (const tab of guide.tabs) for (const row of tab.rows) {
    const cands = R.renderCandidates(skill, row);
    let key = null; for (const k of cands) if (await shoot(k)) { key = k; break; }
    rows.push({ skill, tab: tab.id, lv: row.lv, name: row.name, perk: !!row.perk, soon: !!row.soon, key, tried: cands });
  }
  const popup = {};
  if (!L.unlocksBetween('smithing', 0, 99, () => false).length) L.applyRecipeLevels(C.RECIPES); // fresh module copy

  for (const skill of Object.keys(G.SKILL_GUIDES)) {
    let list = []; try { list = L.unlocksBetween(skill, 0, 99, () => false); } catch (e) { console.error('ub', skill, e.message); }
    for (const u of list) { const id = u.id.replace(/^grow_/, '');
      const cands = K.constructionPiece(id) ? [`furn:${id}`] : [`item:${id}`, ...(skill === 'fishing' ? ['look:small_net'] : []), ...(C.isCraftOreId(id) || ['essence', 'hard_clay'].includes(id) ? [`look:ore-${id === 'hard_clay' ? 'clay' : id}`] : [])];
      let k = null; for (const c of cands) if (await shoot(c)) { k = c; break; }
      popup[u.id] = { key: k, name: u.name }; }
  }
  return { shots, rows, popup };
});
for (const [k, v] of Object.entries(out.shots)) await writeFile(`public/thumbs/guide/${k.replace(':', '-')}.png`, Buffer.from(v.split(',')[1], 'base64'));
const map = Object.fromEntries(out.rows.filter((r) => r.key).map((r) => [`${r.skill}|${r.name}`, r.key]));
await writeFile('src/game/guideThumbs.js', '// Generated by tools/render-guide-thumbs.mjs. Do not edit.\nexport default ' + JSON.stringify({ rows: map, popup: out.popup }, null, 1) + ';\n');
await writeFile('/tmp/render-report.json', JSON.stringify(out.rows, null, 1));
const miss = out.rows.filter((r) => !r.key);
console.log('pngs', Object.keys(out.shots).length, 'rows', out.rows.length, 'rendered', out.rows.length - miss.length);
for (const r of miss) console.log('MISS', r.skill, r.lv, r.name, r.perk ? '(perk)' : r.soon ? '(soon)' : '', r.tried.join(','));
console.log('popupMiss', Object.entries(out.popup).filter(([, v]) => !v.key).map(([k]) => k).join(' '));
await b.close();
