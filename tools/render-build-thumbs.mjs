// Dev script: render Build-menu thumbnails for construction pieces from their bundled OBJ.
// Usage: npx vite --port 5233 & node tools/render-build-thumbs.mjs cabinet flag_pole garden_bush
// Needs playwright (PW=/path/to/playwright/index.mjs).
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PW ?? 'playwright');
const ids = process.argv.slice(2);
const url = process.env.URL ?? 'http://localhost:5233/stallhaven/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await pg.goto(url, { waitUntil: 'load' });
await pg.waitForTimeout(4000);
const out = await pg.evaluate(async ({ ids, base }) => {
  const threeUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /deps\/three\.js/.test(n));
  const THREE = await import(threeUrl);
  const U = await import(`${base}src/game/upload.js`);
  const C = await import(`${base}src/game/construction.js`);
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(128, 128); r.setClearColor(0x000000, 0);
  const res = {};
  for (const id of ids) {
    try {
      const dir = `${base}models/furniture/${id}/`;
      const obj = await (await fetch(`${dir}${id}.obj`)).arrayBuffer();
      const mtl = await (await fetch(`${dir}${id}.mtl`)).arrayBuffer();
      const mesh = await U.parseModelBuffer(obj, `${id}.obj`, { [`${id}.mtl`]: mtl });
      mesh.scale.setScalar(0.01125 * (C.constructionPiece(id)?.scale ?? 1));
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff2dd, 0x40301f, 2.2));
      const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); scene.add(d);
      scene.add(mesh); mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()).length() || 1;
      const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      cam.position.set(c.x + s * 1.1, c.y + s * 0.8, c.z + s * 1.5); cam.lookAt(c);
      r.render(scene, cam);
      res[id] = { png: r.domElement.toDataURL('image/png'), size: box.getSize(new THREE.Vector3()).toArray() };
    } catch (e) { res[id] = { err: String(e?.message ?? e) }; }
  }
  return res;
}, { ids, base: new URL(url).pathname });
for (const [id, v] of Object.entries(out)) {
  if (v.err) { console.log(id, 'ERR', v.err); continue; }
  await writeFile(`public/thumbs/build/${id.replace(/_/g, '-')}.png`, Buffer.from(v.png.split(',')[1], 'base64'));
  console.log(id, 'size m', v.size.map((n) => n.toFixed(2)).join(' x '));
}
await b.close();
