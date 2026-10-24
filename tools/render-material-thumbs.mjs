// Materials drawer icons: reuse public/thumbs/guide/item-<id>.png, render any missing with the guide pipeline.
// Run: node tools/render-material-thumbs.mjs  (vite dev server on :5299). Writes src/game/materialThumbs.js.
import { chromium } from '/workspace/pw/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { enter, clean } from './enter.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
pg.on('console', (m) => m.type() === 'error' && console.log('C', m.text().slice(0, 200)));
await enter(pg); await clean(pg);
const ids = await pg.evaluate(async () => (await import('/stallhaven/src/game/catalog.js')).materialList().map((m) => m.id));
// Existing guide renders that already show the material (bars = smelt, cloth = weave, ...).
const ALIAS = { cloth: 'item:weave_cloth', bow_string: 'item:spin_bow_string', hard_clay: 'look:ore-clay', essence: 'look:ore-essence', flour: 'item:pot_of_flour' };
for (const f of ['shrimp', 'salmon', 'lobster', 'monkfish', 'shark', 'anglerfish']) ALIAS[`raw_${f}`] = `item:${f}`; // cooked-fish render until raw models exist
for (const m of ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'runite', 'dragon']) ALIAS[`${m}_bar`] = `item:smelt_${m}`;
const file = (key) => `public/thumbs/guide/${key.replace(':', '-')}.png`;
const keyFor = (id) => (existsSync(file(`item:${id}`)) ? `item:${id}` : ALIAS[id] && existsSync(file(ALIAS[id])) ? ALIAS[id] : null);
// Real OBJ dumps already unpacked under public/models (from Materials/Clay/Hides/Herbs/... .rar): render these
// straight from the model instead of a stand-in render.
const DIRECT = { cloth: 'materials/cloth', hard_clay: 'materials/clay', soft_clay: 'materials/clay', flour: 'food/pot-of-flour', wheat: 'wheat', hide: 'materials/hide', molten_glass: 'materials/molten-glass' };
for (const c of ['green', 'blue', 'red', 'black']) DIRECT[`${c}_dhide`] = `materials/${c}-dhide`;
for (const f of ['shrimp', 'salmon', 'lobster', 'monkfish', 'shark', 'anglerfish']) DIRECT[`raw_${f}`] = `materials/raw-${f}`;
const FORCE = process.argv.includes('--force');
const need = ids.filter((id) => !keyFor(id) || (DIRECT[id] && (FORCE || keyFor(id) !== `item:${id}`)));
const out = await pg.evaluate(async ({ need, DIRECT }) => {
  const threeUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /deps\/three\.js/.test(n));
  const THREE = await import(threeUrl);
  const M = await import('/stallhaven/src/game/models.js');
  const P = await import('/stallhaven/src/game/craftpreview.js');
  const U = await import('/stallhaven/src/game/upload.js');
  const GL = await import('/stallhaven/src/game/gearlooks.js');
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(128, 128); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  const shots = {}; const fails = [];
  for (const id of need) {
    try {
      // buildWare shows a grey cube until the bundled model loads: rebuild until it is not the cube.
      const isCube = (o) => { let n = 0; let box = true; o.traverse((m) => { if (m.isMesh) { n++; if (m.geometry?.type !== 'BoxGeometry') box = false; } }); if (n !== 1 || !box) return n === 0; const z = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); const a = [z.x, z.y, z.z].sort((p, q) => p - q); return a[2] / a[0] <= 1.6; };
      let obj = null;
      if (DIRECT[id]) { try { obj = await U.loadBundledPropScene(DIRECT[id]); } catch (e) { console.error('load', id, e.message); } }
      if (!obj) for (let i = 0; i < 12; i++) { obj = M.buildWare(id); if (!isCube(obj)) break; obj = null; await new Promise((res) => setTimeout(res, 200)); }
      // Still the cube: load the material's own OBJ folder directly.
      if (!obj) { const f = GL.LUKE_MODEL_FOLDERS.find((x) => x.id === id); if (f) { try { obj = await U.loadBundledPropScene(f.folder); } catch (e) { console.error('load', id, e.message); } } }
      if (!obj) { fails.push(id); continue; }
      try { P.applyCraftPreviewEuler(obj, id); } catch {}
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      let meshes = 0; obj.traverse((o) => { if (o.isMesh) meshes++; });
      if (!meshes || !Number.isFinite(box.min.x)) { fails.push(id); continue; }
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff2dd, 0x40301f, 2.2));
      const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 5, 4); scene.add(d); scene.add(obj);
      const c = box.getCenter(new THREE.Vector3()); const sph = box.getBoundingSphere(new THREE.Sphere());
      const cam = new THREE.PerspectiveCamera(28, 1, 0.001, 1000);
      const dist = sph.radius / Math.sin(14 * Math.PI / 180) * 1.05;
      cam.position.copy(c).add(new THREE.Vector3(0.62, 0.45, 0.65).normalize().multiplyScalar(dist)); cam.lookAt(c);
      cam.near = dist / 100; cam.far = dist * 10; cam.updateProjectionMatrix();
      r.render(scene, cam); shots[id] = r.domElement.toDataURL('image/png');
    } catch (e) { fails.push(id + ':' + e.message); }
  }
  return { shots, fails };
}, { need, DIRECT });
for (const [id, v] of Object.entries(out.shots)) await writeFile(`public/thumbs/guide/item-${id}.png`, Buffer.from(v.split(',')[1], 'base64'));
const have = Object.fromEntries(ids.map((id) => [id, keyFor(id)]).filter(([, k]) => k));
await writeFile('src/game/materialThumbs.js', '// Generated by tools/render-material-thumbs.mjs. Do not edit.\n// Material id -> guide render key (thumbs/guide/<kind>-<id>.png). Missing ids keep the colour swatch.\nexport default ' + JSON.stringify(have, null, 1) + ';\n');
console.log('RENDERED', Object.keys(out.shots).join(' '));
console.log('FAILED', out.fails.join(' '));
await b.close();
