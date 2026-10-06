import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { BUYER_PACK_FOLDERS, CRAFT_ORE_FOLDERS, recipeList } from './catalog.js';
import { LUKE_MODEL_FOLDERS } from './gearlooks.js';
import { classifyModelFiles, formatUploadLabel } from './modelfiles.js';
import { UPLOADS_CLEARED, clearModels, saveModel } from './storage.js';
import { normalizeImported } from './models.js';

export { classifyModelFiles, formatUploadLabel } from './modelfiles.js';

const gltfLoader = new GLTFLoader();

const MODEL_ACCEPT = '.glb,.gltf,.obj,.mtl,.png,.jpg,.jpeg,.webp,model/gltf-binary,model/gltf+json';

function decodeText(buffer) {
  return new TextDecoder().decode(buffer);
}

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

function basename(path) {
  return String(path ?? '').split(/[\\/]/).pop().split('?')[0].toLowerCase();
}

function sidecarMap(sidecars = {}) {
  const urls = new Map();
  const revoke = [];
  for (const [name, data] of Object.entries(sidecars)) {
    if (!data || IMAGE_EXT.test(name)) continue;
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    revoke.push(url);
    urls.set(name.toLowerCase(), url);
    urls.set(basename(name), url);
  }
  return { urls, revoke };
}

function hasMesh(root) {
  let found = false;
  root?.traverse?.((child) => {
    if (child.isMesh) found = true;
  });
  return found;
}

function sanitizeObjText(objText) {
  // Blender OBJ dumps often include `l` edges plus `f` faces. Three's OBJLoader
  // then treats the whole object as LineSegments and drops the mesh.
  if (/^f /m.test(objText) && /^l /m.test(objText)) {
    return objText.replace(/^l\s+.*$/gm, '');
  }
  return objText;
}

const MTL_MAP_PROP = {
  map_kd: 'map',
  map_ks: 'specularMap',
  map_ke: 'emissiveMap',
  map_bump: 'bumpMap',
  bump: 'bumpMap',
  map_d: 'alphaMap',
  map_kn: 'normalMap',
  norm: 'normalMap',
  disp: 'displacementMap',
};

/** Filename after optional `-flag value` pairs. Keeps spaces inside the name. */
function mtlMapFilename(rest) {
  const tokens = String(rest ?? '').trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length && tokens[i].startsWith('-')) i += 2;
  return tokens.slice(i).join(' ').replace(/\\/g, '/');
}

function mtlMapRefs(mtlText) {
  const refs = [];
  let material = '';
  for (const line of String(mtlText).split(/\r?\n/)) {
    const named = line.match(/^newmtl\s+(\S+)/i);
    if (named) {
      material = named[1];
      continue;
    }
    const mapped = line.match(/^\s*(map_ka|map_kd|map_ks|map_ke|map_ns|map_d|map_bump|bump|map_kn|norm|disp|refl)\s+(.+)$/i);
    if (!mapped || !material) continue;
    const file = mtlMapFilename(mapped[2]);
    if (!file) continue;
    refs.push({ material, token: mapped[1].toLowerCase(), file });
  }
  return refs;
}

function mtlWithoutMaps(mtlText) {
  return String(mtlText).replace(/^(?:map_ka|map_kd|map_ks|map_ke|map_ns|map_d|map_bump|bump|map_kn|norm|disp|refl)\s+.*$/gmi, '');
}

function imageMapFiles(mtlText) {
  const files = [];
  const seen = new Set();
  for (const ref of mtlMapRefs(mtlText)) {
    if (!IMAGE_EXT.test(ref.file)) continue;
    const key = ref.file.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    files.push(ref.file);
  }
  return files;
}

function encodeAssetPath(file) {
  return String(file).split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function decodeSidecarImages(sidecars = {}) {
  const images = new Map();
  if (typeof createImageBitmap !== 'function') return images;
  for (const [name, data] of Object.entries(sidecars)) {
    if (!data || !IMAGE_EXT.test(name)) continue;
    try {
      const bitmap = await createImageBitmap(new Blob([data]), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      images.set(basename(name), bitmap);
    } catch {
      // A missing or undecodable map stays off the material.
    }
  }
  return images;
}

function attachDecodedMaps(group, mtlText, images) {
  if (!images?.size) return;
  const textures = new Map();
  const byMaterial = new Map();
  for (const ref of mtlMapRefs(mtlText)) {
    const prop = MTL_MAP_PROP[ref.token];
    const image = images.get(basename(ref.file));
    if (!prop || !image) continue;
    const key = `${prop}:${basename(ref.file)}`;
    let texture = textures.get(key);
    if (!texture) {
      texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      texture.colorSpace = prop === 'map' || prop === 'emissiveMap'
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;
      textures.set(key, texture);
    }
    if (!byMaterial.has(ref.material)) byMaterial.set(ref.material, []);
    byMaterial.get(ref.material).push({ prop, texture });
  }
  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      const assigns = byMaterial.get(mat.name);
      if (!assigns) continue;
      for (const { prop, texture } of assigns) mat[prop] = texture;
      mat.needsUpdate = true;
    }
  });
}

async function parseObjBuffer(buffer, sidecars = {}, name = '') {
  const objText = sanitizeObjText(decodeText(buffer));
  if (!objText.trim()) throw new Error('That .obj file is empty.');
  const { urls, revoke } = sidecarMap(sidecars);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => urls.get(basename(url)) || url);
  const finish = () => {
    for (const url of revoke) URL.revokeObjectURL(url);
  };
  manager.onLoad = finish;
  const revokeTimer = setTimeout(finish, 60000);
  revokeTimer.unref?.();

  const objLoader = new OBJLoader(manager);
  const mtlEntry = Object.entries(sidecars).find(([fileName]) => fileName.toLowerCase().endsWith('.mtl'));
  let mtlText = '';
  if (mtlEntry) {
    try {
      mtlText = decodeText(mtlEntry[1]);
      // Map lines are applied from decoded sidecars below. Leaving them for
      // MTLLoader would fetch page-relative URLs that 404 and never finish
      // before dropUnusableMaps runs.
      const mtlLoader = new MTLLoader(manager);
      const materials = mtlLoader.parse(mtlWithoutMaps(mtlText), '');
      materials.preload();
      objLoader.setMaterials(materials);
    } catch (err) {
      console.warn('MTL parse failed; loading OBJ without materials.', err?.message || err);
    }
  }
  const group = objLoader.parse(objText);
  if (!hasMesh(group)) throw new Error('That .obj has no mesh.');
  attachDecodedMaps(group, mtlText, await decodeSidecarImages(sidecars));
  dropUnusableMaps(group);
  if (isDungeonRockDump(name) || isDungeonRockDump(mtlEntry?.[0])) {
    prepareDungeonRockMaterials(group);
  }
  return group;
}

/** MTL map_Kd to missing files (e.g. .psd) otherwise multiplies albedo toward black. */
function dropUnusableMaps(root) {
  const keys = ['map', 'emissiveMap', 'specularMap', 'normalMap', 'bumpMap', 'displacementMap', 'alphaMap'];
  root?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      for (const key of keys) {
        const tex = mat[key];
        if (!tex) continue;
        const img = tex.image;
        const ok = Boolean(img && ((img.width ?? 0) > 0 || img.data));
        if (!ok) mat[key] = null;
      }
    }
  });
}

/** sRGB albedo lift so dump Kd colors read under cave lights, nearer Blender. */
export const DUNGEON_ROCK_ALBEDO_LIFT = 2;
/** Extra sRGB floor — Blender's studio/world fill; keeps dark verts from sinking. */
export const DUNGEON_ROCK_AMBIENT = 0.08;
/** Fraction of lifted albedo copied to emissive so cave shadows still show Kd. */
export const DUNGEON_ROCK_EMIT = 0.25;

const DUNGEON_ROCK_FILE = /^(bronze|iron|steel|mithril|adamant|rune|dragon|clay)-rocks$|^essence$/i;

export function isDungeonRockFolder(folder = '') {
  return String(folder).replace(/\\/g, '/').toLowerCase().includes('dungeon-rocks/');
}

export function isDungeonRockDump(nameOrFolder = '') {
  const normalized = String(nameOrFolder).replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('dungeon-rocks/')) return true;
  const base = basename(normalized).replace(/\.(obj|mtl)$/i, '');
  return DUNGEON_ROCK_FILE.test(base);
}

function liftDungeonRockColor(color) {
  const srgb = color.clone();
  if (typeof srgb.convertLinearToSRGB === 'function') srgb.convertLinearToSRGB();
  srgb.r = Math.min(1, srgb.r * DUNGEON_ROCK_ALBEDO_LIFT + DUNGEON_ROCK_AMBIENT);
  srgb.g = Math.min(1, srgb.g * DUNGEON_ROCK_ALBEDO_LIFT + DUNGEON_ROCK_AMBIENT);
  srgb.b = Math.min(1, srgb.b * DUNGEON_ROCK_ALBEDO_LIFT + DUNGEON_ROCK_AMBIENT);
  if (typeof srgb.convertSRGBToLinear === 'function') srgb.convertSRGBToLinear();
  return srgb;
}

function dumpAlbedo(mat) {
  const color = mat?.color ? mat.color.clone() : new THREE.Color(0x888888);
  const ka = mat?.emissive;
  if (ka && (ka.r + ka.g + ka.b) > 0.02) color.add(ka);
  return liftDungeonRockColor(color);
}

function mapLooksMissing(map) {
  if (!map) return true;
  const img = map.image;
  return !(img && ((img.width ?? 0) > 0 || img.data));
}

/** Shared OBJ/MTL tweak for every dungeon-rocks/* dump. Idempotent. */
export function prepareDungeonRockMaterials(root) {
  if (!root || root.userData?.dungeonRockLift) return root;
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      if (mat?.userData?.dungeonRockLift) return mat;
      const color = dumpAlbedo(mat);
      const emit = color.clone().multiplyScalar(DUNGEON_ROCK_EMIT);
      const std = new THREE.MeshStandardMaterial({
        name: mat.name,
        color,
        emissive: emit,
        emissiveIntensity: 1,
        roughness: 0.68,
        metalness: 0,
        side: mat.side ?? THREE.FrontSide,
        vertexColors: Boolean(mat.vertexColors),
        flatShading: false,
      });
      if (mat.map && !mapLooksMissing(mat.map)) std.map = mat.map;
      if ('envMapIntensity' in std) std.envMapIntensity = 0;
      std.userData.dungeonRockLift = true;
      return std;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
  root.userData.dungeonRockLift = true;
  return root;
}

function friendlyParseError(err, kind) {
  const raw = err?.message || String(err || '');
  if (kind === 'obj') return raw || 'Could not parse that .obj file.';
  return raw || 'Could not parse that model.';
}

export function parseModelFile(file) {
  return file.arrayBuffer().then((buffer) => parseModelBuffer(buffer, file.name));
}

export function parseModelBuffer(buffer, name, sidecars = {}) {
  return new Promise((resolve, reject) => {
    const ext = (name || '').toLowerCase();
    if (ext.endsWith('.obj')) {
      parseObjBuffer(buffer, sidecars, name)
        .then(resolve)
        .catch((err) => reject(new Error(friendlyParseError(err, 'obj'))));
      return;
    }
    if (ext.endsWith('.mtl')) {
      reject(new Error('That .mtl needs its .obj. Select both files together.'));
      return;
    }
    const onError = (err) => reject(new Error(friendlyParseError(err, 'gltf')));
    if (ext.endsWith('.gltf')) {
      const text = decodeText(buffer);
      if (/"uri"\s*:\s*"[^d]/.test(text) && !text.includes('data:')) {
        reject(new Error('That .gltf needs extra files. Use a single .glb instead.'));
        return;
      }
      gltfLoader.parse(text, '', (gltf) => resolve(gltf.scene), onError);
      return;
    }
    gltfLoader.parse(buffer, '', (gltf) => resolve(gltf.scene), onError);
  });
}

export const FOUNTAIN_DUMP_REV = 'blender-4e9b2aee-overwrite';

export const BUNDLED_PLAYER_DIR = 'models/player';

export const BUNDLED_PROP_FOLDERS = [
  { id: 'chest', folder: 'chest' },
  { id: 'furnace', folder: 'furnace' },
  { id: 'range', folder: 'range' },
  { id: 'anvil', folder: 'anvil' },
  { id: 'cauldron', folder: 'cauldron' },
  { id: 'door', folder: 'door' },
  { id: 'ladder', folder: 'ladder' },
  { id: 'torch', folder: 'torch' },
  { id: 'trapdoor', folder: 'trapdoor' },
  { id: 'wheel', folder: 'wheel' },
  { id: 'goblin', folder: 'goblin' },
  { id: 'rat', folder: 'rat' },
  { id: 'table', folder: 'table' },
  { id: 'counter', folder: 'counter' },
  { id: 'tree', folder: 'tree' },
  { id: 'flowers', folder: 'flowers' },
  { id: 'flax-plant', folder: 'flax' },
  { id: 'rock', folder: 'rock' },
  { id: 'fountain', folder: 'fountain', rev: FOUNTAIN_DUMP_REV },
  { id: 'skeleton', folder: 'skeleton' },
  { id: 'rune-air', folder: 'runes/air' },
  { id: 'rune-water', folder: 'runes/water' },
  { id: 'rune-earth', folder: 'runes/earth' },
  { id: 'rune-fire', folder: 'runes/fire' },
  { id: 'ore-bronze', folder: 'dungeon-rocks/bronze-rocks' },
  { id: 'ore-iron', folder: 'dungeon-rocks/iron-rocks' },
  { id: 'ore-steel', folder: 'dungeon-rocks/steel-rocks' },
  { id: 'ore-mithril', folder: 'dungeon-rocks/mithril-rocks' },
  { id: 'ore-adamant', folder: 'dungeon-rocks/adamant-rocks' },
  { id: 'ore-runite', folder: 'dungeon-rocks/rune-rocks' },
  { id: 'ore-dragon', folder: 'dungeon-rocks/dragon-rocks' },
  { id: 'ore-essence', folder: 'dungeon-rocks/essence' },
  { id: 'ore-clay', folder: 'dungeon-rocks/clay-rocks' },
  ...recipeList()
    .filter((recipe) => recipe.category === 'food')
    .map((recipe) => {
      const slug = String(recipe.id).replaceAll('_', '-');
      return { id: `food-${slug}`, folder: `food/${slug}` };
    }),
  ...CRAFT_ORE_FOLDERS,
  ...BUYER_PACK_FOLDERS,
  ...LUKE_MODEL_FOLDERS,
];

export async function parseBundledPlayerBuffers(objBuffer, mtlBuffer) {
  const sidecars = {};
  if (mtlBuffer) sidecars['player.mtl'] = mtlBuffer;
  return parseModelBuffer(objBuffer, 'player.obj', sidecars);
}

function assertObjPayload(buffer, label) {
  const text = decodeText(buffer);
  const start = text.trimStart();
  if (!start || start.startsWith('<!') || /^<html/i.test(start)) {
    const err = new Error(`Missing ${label}`);
    err.code = 'MISSING_MODEL';
    throw err;
  }
  return buffer;
}

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function envBaseUrl() {
  try {
    return import.meta.env.BASE_URL || './';
  } catch {
    return './';
  }
}

export function bundledModelRoots() {
  const raw = envBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const roots = [`${envBase}models/`, `${envBase}public/models/`];
  if (envBase !== './') {
    roots.push('./models/', './public/models/');
  }
  return [...new Set(roots)];
}

export function bundledModelBases(folder) {
  return bundledModelRoots().map((root) => `${root}${folder}/`);
}

let cachedModelsRoot = null;
let resolveRootPromise = null;

export function resetBundledModelRoot() {
  cachedModelsRoot = null;
  resolveRootPromise = null;
}

export function resolveBundledModelRoot() {
  if (cachedModelsRoot) return Promise.resolve(cachedModelsRoot);
  if (!resolveRootPromise) {
    resolveRootPromise = (async () => {
      for (const root of bundledModelRoots()) {
        try {
          const res = await fetch(`${root}player/player.obj`);
          if (!res.ok) continue;
          assertObjPayload(await res.arrayBuffer(), `${root}player/player.obj`);
          cachedModelsRoot = root;
          return root;
        } catch {
          // HTML fallback or a missing tree — try the next root.
        }
      }
      cachedModelsRoot = bundledModelRoots()[0];
      return cachedModelsRoot;
    })();
  }
  return resolveRootPromise;
}

function missingModel(label) {
  const err = new Error(`Missing ${label}`);
  err.code = 'MISSING_MODEL';
  return err;
}

function assetQuery(rev) {
  return rev ? `?v=${encodeURIComponent(rev)}` : '';
}

async function fetchObjMtl(folder, objFile, mtlFile, rev) {
  const roots = cachedModelsRoot ? [cachedModelsRoot] : bundledModelRoots();
  let lastMissing = missingModel(`models/${folder}/${objFile}`);
  const q = assetQuery(rev);
  for (const root of roots) {
    const base = `${root}${folder}/`;
    try {
      const objRes = await fetch(`${base}${objFile}${q}`);
      if (!objRes.ok) {
        lastMissing = missingModel(`models/${folder}/${objFile}`);
        continue;
      }
      const objBuffer = assertObjPayload(await objRes.arrayBuffer(), `models/${folder}/${objFile}`);
      cachedModelsRoot = root;
      const sidecars = {};
      if (mtlFile) {
        const mtlRes = await fetch(`${base}${mtlFile}${q}`);
        if (mtlRes.ok) {
          const mtlBuffer = await mtlRes.arrayBuffer();
          try {
            assertObjPayload(mtlBuffer, `models/${folder}/${mtlFile}`);
            sidecars[mtlFile] = mtlBuffer;
          } catch {
            // Ignore an HTML fallback for a missing .mtl; the OBJ can still load.
          }
        }
      }
      const mtlBuffer = sidecars[mtlFile];
      if (mtlBuffer) {
        await Promise.all(imageMapFiles(decodeText(mtlBuffer)).map(async (file) => {
          try {
            const mapRes = await fetch(`${base}${encodeAssetPath(file)}${q}`);
            if (!mapRes.ok) return;
            const mapBuffer = await mapRes.arrayBuffer();
            if (mapBuffer.byteLength > 0) sidecars[file] = mapBuffer;
          } catch {
            // A missing map leaves that material on its Kd color.
          }
        }));
      }
      const scene = await parseModelBuffer(objBuffer, objFile, sidecars);
      if (isDungeonRockFolder(folder)) prepareDungeonRockMaterials(scene);
      return scene;
    } catch (err) {
      if (err?.code === 'MISSING_MODEL') {
        lastMissing = err;
        continue;
      }
      throw err;
    }
  }
  throw lastMissing;
}

/** Fetch the shipped LilRunnerBoi OBJ+MTL from the static /models/player/ folder. */
export async function loadBundledPlayerScene() {
  await resolveBundledModelRoot();
  return fetchObjMtl('player', 'player.obj', 'player.mtl');
}

/** Fetch a shipped GLB from the same models roots as the other public assets. */
async function loadBundledGltf(file) {
  await resolveBundledModelRoot();
  const roots = cachedModelsRoot ? [cachedModelsRoot] : bundledModelRoots();
  const base = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
  let lastMissing = missingModel(`models/${file}`);
  for (const root of roots) {
    try {
      const res = await fetch(`${root}${file}`);
      if (!res.ok) {
        lastMissing = missingModel(`models/${file}`);
        continue;
      }
      const buffer = await res.arrayBuffer();
      const magic = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
      const tag = String.fromCharCode(magic[0] ?? 0, magic[1] ?? 0, magic[2] ?? 0, magic[3] ?? 0);
      if (tag !== 'glTF') {
        lastMissing = missingModel(`models/${file}`);
        continue;
      }
      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.parse(buffer, `${root}${base}`, resolve, reject);
      });
      if (!gltf?.scene) throw new Error(`Rigged model ${file} has no scene.`);
      cachedModelsRoot = root;
      return gltf;
    } catch (err) {
      if (err?.code === 'MISSING_MODEL') {
        lastMissing = err;
        continue;
      }
      throw err;
    }
  }
  throw lastMissing;
}

/** Fetch character_rigged.glb from the same models roots as the OBJ player. */
export async function loadBundledRiggedPlayer() {
  return loadBundledGltf('player/character_rigged.glb');
}

/** Fetch goblin_rigged.glb. Throws so the caller can keep the old goblin. */
export async function loadBundledRiggedGoblin() {
  return loadBundledGltf('npc/goblin_rigged.glb');
}

/** Fetch rat_rigged.glb. Throws so the caller can keep the old rat. */
export async function loadBundledRiggedRat() {
  return loadBundledGltf('npc/rat_rigged.glb');
}

export async function loadBundledPropScene(folder, rev) {
  const baseName = String(folder).split('/').pop();
  const names = [`${baseName}.obj`, `${folder}.obj`, 'model.obj', 'player.obj'];
  let lastErr = null;
  for (const objFile of names) {
    const mtlFile = objFile.replace(/\.obj$/i, '.mtl');
    try {
      return await fetchObjMtl(folder, objFile, mtlFile, rev);
    } catch (err) {
      lastErr = err;
      if (err?.code === 'MISSING_MODEL') break;
    }
  }
  throw lastErr ?? new Error(`Missing bundled ${folder} model.`);
}

export async function loadBundledLooks(onProgress) {
  await resolveBundledModelRoot();
  const total = BUNDLED_PROP_FOLDERS.length;
  let done = 0;
  const entries = await Promise.all(BUNDLED_PROP_FOLDERS.map(async ({ id, folder, rev }) => {
    try {
      const scene = await loadBundledPropScene(folder, rev);
      done += 1;
      onProgress?.(done, total, id);
      return [id, scene];
    } catch (err) {
      done += 1;
      onProgress?.(done, total, id);
      if (err?.code !== 'MISSING_MODEL') {
        console.warn(`Bundled ${id} model skipped:`, err?.message || err);
      }
      return [id, null];
    }
  }));
  const looks = {};
  for (const [id, scene] of entries) {
    if (scene) looks[id] = scene;
  }
  return looks;
}

export async function parseModelFiles(files) {
  const classified = classifyModelFiles(files);
  if (classified.error) throw new Error(classified.error);
  const buffer = await classified.primary.arrayBuffer();
  const sidecars = {};
  for (const file of classified.sidecars ?? []) {
    sidecars[file.name] = await file.arrayBuffer();
  }
  const scene = await parseModelBuffer(buffer, classified.primary.name, sidecars);
  return {
    scene,
    name: classified.primary.name,
    label: formatUploadLabel(classified),
    buffer,
    sidecars,
  };
}

function syncModalClass() {
  const any = [...document.querySelectorAll('.modal')].some((el) => !el.hidden);
  document.body.classList.toggle('modal-open', any);
}

const KIND_IDS = {
  furniture: 'furniture-look',
  player: 'player-look',
  customer: 'customer-look',
};

export function bindUploadUI({ button, modal, state, world, onChange }) {
  const fileInput = modal.querySelector('input[type="file"]');
  const pickBtn = modal.querySelector('[data-upload-pick]');
  const dropHint = modal.querySelector('[data-upload-drop]');
  const title = modal.querySelector('[data-import-name]');
  const furnitureBtn = modal.querySelector('[data-tag="furniture"]');
  const wareBtn = modal.querySelector('[data-tag="ware"]');
  const playerBtn = modal.querySelector('[data-tag="player"]');
  const customerBtn = modal.querySelector('[data-tag="customer"]');
  const tagRow = modal.querySelector('[data-tags]');
  const recipeRow = modal.querySelector('[data-recipes]');
  const cancelBtn = modal.querySelector('[data-cancel]');
  const errorEl = modal.querySelector('[data-error]');
  const clearBtn = modal.querySelector('[data-clear-uploads]');
  const clearBox = modal.querySelector('[data-clear-box]');
  const clearYes = modal.querySelector('[data-clear-yes]');
  const clearNo = modal.querySelector('[data-clear-no]');
  const clearNote = modal.querySelector('[data-clear-note]');

  if (fileInput) {
    fileInput.accept = MODEL_ACCEPT;
    fileInput.multiple = true;
  }

  recipeRow.innerHTML = recipeList().map((r) => (
    `<button type="button" class="recipe-bind" data-recipe="${r.id}">${r.name}</button>`
  )).join('');

  let pending = null;

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  function showClearNote(text) {
    if (!clearNote) return;
    clearNote.textContent = text || '';
    clearNote.hidden = !text;
  }

  function hideClearConfirm() {
    if (clearBox) clearBox.hidden = true;
  }

  function showTags(on) {
    if (tagRow) tagRow.hidden = !on;
    recipeRow.hidden = true;
  }

  function close() {
    pending = null;
    modal.hidden = true;
    showTags(false);
    showError('');
    showClearNote('');
    hideClearConfirm();
    title.textContent = '';
    syncModalClass();
  }

  function openModal() {
    pending = null;
    title.textContent = '';
    showTags(false);
    showError('');
    showClearNote('');
    hideClearConfirm();
    modal.hidden = false;
    syncModalClass();
  }

  async function receiveFiles(fileList) {
    const files = [...(fileList ?? [])];
    const names = files.map((file) => file.name).join(' + ');
    try {
      const loaded = await parseModelFiles(files);
      pending = {
        id: `up-${Date.now()}`,
        name: loaded.name,
        buffer: loaded.buffer,
        sidecars: loaded.sidecars,
        scene: loaded.scene,
      };
      title.textContent = loaded.label;
      showError('');
      showTags(true);
      modal.hidden = false;
      syncModalClass();
    } catch (err) {
      title.textContent = names;
      pending = null;
      showTags(false);
      showError(err.message || 'Could not read that model. The default look is unchanged.');
      modal.hidden = false;
      syncModalClass();
    }
  }

  async function persist(record) {
    try {
      await saveModel(record);
    } catch {
      // Memory-only is fine for a session.
    }
  }

  async function applyTag(kind, recipeId) {
    if (!pending) return;
    const record = {
      id: KIND_IDS[kind] ?? pending.id,
      name: pending.name,
      kind,
      recipeId: recipeId ?? null,
      displayIndex: kind === 'furniture' ? state.selectedDisplay : null,
      buffer: pending.buffer,
      sidecars: pending.sidecars ?? {},
    };

    if (kind === 'furniture') {
      try {
        const furniture = pending.scene.clone(true);
        normalizeImported(furniture, 1.25, true);
        await persist(record);
        world.replaceFurniture(state.selectedDisplay, pending.scene);
      } catch (err) {
        showError(err.message || 'Could not replace that furniture. The table is unchanged.');
        return;
      }
    } else if (kind === 'ware') {
      try {
        const ware = pending.scene.clone(true);
        normalizeImported(ware, 0.55, true);
        await persist(record);
        world.bindWareLook(recipeId, pending.scene);
      } catch (err) {
        showError(err.message || 'Could not bind that ware. The recipe look is unchanged.');
        return;
      }
    } else if (kind === 'player') {
      const result = world.setPlayerLook(pending.scene);
      if (!result?.ok) {
        showError(result?.reason || 'Could not use that as a player model. The default character is unchanged.');
        return;
      }
      await persist(record);
    } else if (kind === 'customer') {
      const result = world.setCustomerLook(pending.scene);
      if (!result?.ok) {
        showError(result?.reason || 'Could not use that as a customer model. Default travelers are unchanged.');
        return;
      }
      await persist(record);
    }

    onChange();
    close();
  }

  button?.addEventListener('click', openModal);
  pickBtn.addEventListener('click', () => fileInput.click());

  const dropTarget = dropHint ?? modal;
  dropTarget.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropHint?.classList.add('is-hot');
  });
  dropTarget.addEventListener('dragleave', () => dropHint?.classList.remove('is-hot'));
  dropTarget.addEventListener('drop', (event) => {
    event.preventDefault();
    dropHint?.classList.remove('is-hot');
    const files = event.dataTransfer?.files;
    if (files?.length) receiveFiles(files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) receiveFiles(fileInput.files);
    fileInput.value = '';
  });

  furnitureBtn.addEventListener('click', () => applyTag('furniture'));
  playerBtn?.addEventListener('click', () => applyTag('player'));
  customerBtn?.addEventListener('click', () => applyTag('customer'));
  wareBtn.addEventListener('click', () => {
    recipeRow.hidden = false;
  });
  recipeRow.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-recipe]');
    if (btn) applyTag('ware', btn.dataset.recipe);
  });
  clearBtn?.addEventListener('click', () => {
    if (clearBox) clearBox.hidden = false;
    showClearNote('');
    showError('');
  });
  clearNo?.addEventListener('click', hideClearConfirm);
  clearYes?.addEventListener('click', async () => {
    hideClearConfirm();
    try {
      world.clearUploads?.();
      await clearModels();
    } catch {
      world.clearUploads?.();
    }
    showClearNote(UPLOADS_CLEARED);
    onChange();
  });
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
}
