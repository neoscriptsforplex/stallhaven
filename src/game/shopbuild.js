import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  EXPANSION_PADS,
  FOUNTAIN,
  ROOM_D,
  ROOM_W,
  SHOP_DOOR_LINTEL,
  SHOP_FLOOR_SLAB,
  shopFloorTopY,
  SHOP_FURNITURE_FLOOR_Y,
  cobblePathSpan,
  cobbleRingTuck,
  gardenBox,
  gardenFlowerSpots,
  gardenGrassClusters,
  gardenRockSpots,
  gardenTrapdoorSpot,
  gardenTreeSpots,
  notePlantedTrunk,
  OUTDOOR_GROUND_Y,
  OUTDOOR_TREE_SCALE,
  resetPlantedTrunks,
  TREE_SCALE_SPREAD,
  TREE_TRUNK_RADIUS,
  keepFountain,
  keepGardenSpot,
  pointHitsTrapdoor,
  segmentHitsTrapdoor,
  neighborsOf,
  occupiedCells,
  padConnects,
  roomCenter,
  SHOP_RUG,
  doorwayFloor,
  wallVineMounts,
} from './layout.js';
import { METALS } from './catalog.js';
import { DUNGEON_LIGHT_BOOST } from './lighting.js';
import { initRatWander, RAT_DUMP_YAW } from './rats.js';
import { brickSurface, sootMetal, wornMetal, woodSurface } from './surfaces.js';
import { getBundledLook, measureVisibleBox, sitVisibleOnY, wrapBundledProp, wrapRiggedRat, dumpStandEuler } from './models.js';
import { prepareDungeonRockMaterials } from './upload.js';

export { DUNGEON_ROCK_ALBEDO_LIFT, DUNGEON_ROCK_AMBIENT, DUNGEON_ROCK_EMIT } from './upload.js';

function wood(color, roughness = 0.86) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

function cloth(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function metal(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.72 });
}

function pickMat() {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let cachedCobble = null;

function cobbleMap() {
  if (cachedCobble) return cachedCobble.clone();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5a564e';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 7919;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const cols = 8;
  const rows = 8;
  const cw = 256 / cols;
  const ch = 256 / rows;
  for (let row = 0; row < rows; row += 1) {
    const stagger = (row % 2) * 0.5;
    for (let col = -1; col <= cols; col += 1) {
      const x = (col + stagger) * cw + 2;
      const y = row * ch + 2;
      const bw = cw - 5 + rand() * 2;
      const bh = ch - 5 + rand() * 2;
      const shade = 108 + Math.floor(rand() * 42);
      ctx.fillStyle = `rgb(${shade + 6},${shade},${shade - 12})`;
      roundRect(ctx, x, y, bw, bh, 5 + rand() * 3);
      ctx.fill();
      ctx.strokeStyle = `rgba(40, 36, 32, ${0.28 + rand() * 0.2})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + rand() * 0.07})`;
      roundRect(ctx, x + 3, y + 2, bw * 0.42, bh * 0.28, 3);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cachedCobble = tex;
  return tex.clone();
}

/**
 * Tiles of shop_wall_512.png per world metre, on both S and T.
 * The tile is 4 bricks across and 8 rows of 2:1 bricks, so one tile per metre
 * draws a brick about 25cm wide and 12.5cm tall — the same size as the shop
 * cobble this replaces (8 stones across 4.2 tiles per 8.2m, and 8 stones up
 * 2.6 tiles per 2.7m, about 24cm × 13cm).
 */
export const SHOP_WALL_REPEAT = 1;
const SHOP_WALL_FILE = 'shop_wall_512.png';

function assetBaseUrl() {
  try {
    return import.meta.env.BASE_URL || './';
  } catch {
    return './';
  }
}

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function shopWallTextureUrls() {
  const raw = assetBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const urls = [
    `${envBase}textures/${SHOP_WALL_FILE}`,
    `${envBase}public/textures/${SHOP_WALL_FILE}`,
  ];
  if (envBase !== './') {
    urls.push(`./textures/${SHOP_WALL_FILE}`, `./public/textures/${SHOP_WALL_FILE}`);
  }
  return [...new Set(urls)];
}

let shopWallSource = null;
const shopWallClones = [];

function configureShopWallTexture(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function applyShopWallImage(loaded) {
  if (!shopWallSource || !loaded?.image) return;
  shopWallSource.image = loaded.image;
  shopWallSource.needsUpdate = true;
  for (const tex of shopWallClones) {
    tex.image = loaded.image;
    tex.needsUpdate = true;
  }
  shopWallClones.length = 0;
}

function beginShopWallLoad() {
  const urls = shopWallTextureUrls();
  const attempt = (index) => {
    if (index >= urls.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.load(urls[index], applyShopWallImage, undefined, () => attempt(index + 1));
    } catch {
      // Node tests stub document without an image element. Wrap and repeat still apply.
    }
  };
  attempt(0);
}

function shopWallMap() {
  if (!shopWallSource) {
    shopWallSource = configureShopWallTexture(new THREE.Texture());
    shopWallSource.userData.kind = 'shop-wall';
    beginShopWallLoad();
  }
  const tex = configureShopWallTexture(shopWallSource.clone());
  tex.userData.kind = 'shop-wall';
  if (shopWallSource.image) {
    tex.image = shopWallSource.image;
    tex.needsUpdate = true;
  } else {
    shopWallClones.push(tex);
  }
  return tex;
}

function shopWallMat() {
  const map = shopWallMap();
  map.repeat.set(1, 1);
  map.offset.set(0, 0);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.03,
    color: 0xffffff,
  });
  mat.userData.shopWall = true;
  return mat;
}

const wallUvA = new THREE.Vector3();
const wallUvB = new THREE.Vector3();
const wallUvC = new THREE.Vector3();
const wallUvN = new THREE.Vector3();
const wallUvP = new THREE.Vector3();

/** World-space UVs so each face, including cut edges, repeats SHOP_WALL_REPEAT per metre. */
function writeShopWallUVs(geo, wx, wy, wz) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const at = (k) => (index ? index.getX(k) : k);
  const seen = new Set();
  for (let f = 0; f < count; f += 3) {
    wallUvA.fromBufferAttribute(pos, at(f));
    wallUvB.fromBufferAttribute(pos, at(f + 1));
    wallUvC.fromBufferAttribute(pos, at(f + 2));
    wallUvN.subVectors(wallUvB, wallUvA).cross(wallUvC.sub(wallUvA));
    const ax = Math.abs(wallUvN.x);
    const ay = Math.abs(wallUvN.y);
    const az = Math.abs(wallUvN.z);
    let uKey = 'x';
    let vKey = 'y';
    if (ay >= ax && ay >= az) {
      uKey = 'x';
      vKey = 'z';
    } else if (ax >= az) {
      uKey = 'z';
      vKey = 'y';
    }
    for (let k = 0; k < 3; k += 1) {
      const vi = at(f + k);
      if (seen.has(vi)) continue;
      seen.add(vi);
      wallUvP.fromBufferAttribute(pos, vi);
      const worldX = wallUvP.x + wx;
      const worldY = wallUvP.y + wy;
      const worldZ = wallUvP.z + wz;
      const world = uKey === 'z' ? worldZ : worldX;
      const up = vKey === 'z' ? worldZ : worldY;
      uv.setXY(vi, world * SHOP_WALL_REPEAT, up * SHOP_WALL_REPEAT);
    }
  }
  uv.needsUpdate = true;
}

function grassGroundMat() {
  return new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 });
}

function cobbleMat(repeatX, repeatY, offsetX = 0, offsetY = 0) {
  const map = cobbleMap();
  map.repeat.set(repeatX, repeatY);
  map.offset.set(offsetX, offsetY);
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.03,
    color: 0xd8d2c6,
  });
}

function addWallSlab(root, x, y, z, sx, sy, sz) {
  if (sx < 0.03 || sy < 0.03 || sz < 0.03) return;
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  writeShopWallUVs(geo, x, y, z);
  const mesh = addShadow(new THREE.Mesh(geo, shopWallMat()));
  mesh.position.set(x, y, z);
  mesh.userData.shopWall = true;
  root.add(mesh);
}

function addWallWithWindow(root, {
  x, y, z, w, h, t, axis, winAlong, winY, winW, winH,
}) {
  const along0 = axis === 'x' ? x : z;
  const left = along0 - w / 2;
  const right = along0 + w / 2;
  const bottom = y - h / 2;
  const top = y + h / 2;
  const winL = winAlong - winW / 2;
  const winR = winAlong + winW / 2;
  const winB = winY - winH / 2;
  const winT = winY + winH / 2;
  const place = (along, cy, sw, sh) => {
    addWallSlab(
      root,
      axis === 'x' ? along : x,
      cy,
      axis === 'x' ? z : along,
      axis === 'x' ? sw : t,
      sh,
      axis === 'x' ? t : sw,
    );
  };
  place(left + (winL - left) / 2, y, winL - left, h);
  place(winR + (right - winR) / 2, y, right - winR, h);
  place(winAlong, bottom + (winB - bottom) / 2, winW, winB - bottom);
  place(winAlong, winT + (top - winT) / 2, winW, top - winT);
}

function addWallWithDoor(root, {
  x, y, z, w, h, t, axis, doorAlong, doorW = 1.28, doorH = 2.18,
}) {
  const along0 = axis === 'x' ? x : z;
  const left = along0 - w / 2;
  const right = along0 + w / 2;
  const doorL = doorAlong - doorW / 2;
  const doorR = doorAlong + doorW / 2;
  const beam = wood(0x3c2616, 0.78);
  const place = (along, cy, sw, sh) => {
    addWallSlab(
      root,
      axis === 'x' ? along : x,
      cy,
      axis === 'x' ? z : along,
      axis === 'x' ? sw : t,
      sh,
      axis === 'x' ? t : sw,
    );
  };
  place(left + (doorL - left) / 2, y, doorL - left, h);
  place(doorR + (right - doorR) / 2, y, right - doorR, h);
  const lintelY = doorH + 0.2;
  const lintelH = h - doorH;
  place(doorAlong, lintelY + lintelH / 2 - 0.05, doorW, lintelH);
  const lintel = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(axis === 'x' ? doorW + 0.28 : 0.22, 0.28, axis === 'x' ? 0.22 : doorW + 0.28),
    beam,
  ));
  lintel.position.set(axis === 'x' ? doorAlong : x, doorH + 0.06, axis === 'x' ? z : doorAlong);
  root.add(lintel);
}

function addShopWindow(root, { x, y, z, rotY = 0, w = 0.78, h = 0.9 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  const frame = wood(0x3a2414, 0.82);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xb7d7e6,
    roughness: 0.08,
    metalness: 0.18,
    transparent: true,
    opacity: 0.42,
    emissive: 0x7eb8d0,
    emissiveIntensity: 0.16,
    side: THREE.DoubleSide,
  });
  const pane = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.03), glass));
  group.add(pane);
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.09), frame));
  top.position.y = h / 2 - 0.02;
  group.add(top);
  const bot = top.clone();
  bot.position.y = -h / 2 + 0.02;
  group.add(bot);
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.09), frame));
  left.position.x = -w / 2 + 0.02;
  group.add(left);
  const right = left.clone();
  right.position.x = w / 2 - 0.02;
  group.add(right);
  const mullionV = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.045, h - 0.08, 0.05), frame));
  group.add(mullionV);
  const mullionH = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.045, 0.05), frame));
  group.add(mullionH);
  const sill = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, 0.16), wood(0x4a301c)));
  sill.position.set(0, -h / 2 - 0.02, 0.02);
  group.add(sill);
  root.add(group);
  return group;
}

function flameMat() {
  return new THREE.MeshStandardMaterial({
    color: 0xffc56a,
    emissive: 0xff7a18,
    emissiveIntensity: 1.6,
    roughness: 0.45,
  });
}

export function buildTorch() {
  const bundled = getBundledLook('torch');
  if (bundled) {
    const fitted = wrapBundledProp(bundled, buildProceduralTorchBody(), {
      name: 'torch',
      fit: 'max',
      rotateZ: Math.PI / 2,
    });
    fitted.name = 'torch';
    attachTorchFx(fitted);
    return fitted;
  }
  const group = buildProceduralTorchBody();
  attachTorchFx(group);
  return group;
}

function localPointAtWorld(mesh, worldPoint) {
  mesh.updateMatrixWorld(true);
  return mesh.worldToLocal(worldPoint.clone());
}

/**
 * PointLight + ember sit in an inverse-scaled holder at the visible tip so a
 * tiny dumped torch scale cannot pull the bloom down the shaft.
 */
function attachTorchFx(mesh) {
  mesh.updateMatrixWorld(true);
  const box = measureVisibleBox(mesh);
  const tipWorld = new THREE.Vector3(
    (box.min.x + box.max.x) / 2,
    Number.isFinite(box.max.y) ? box.max.y : 0.42,
    (box.min.z + box.max.z) / 2,
  );
  const holder = new THREE.Group();
  holder.name = 'torch-fx';
  holder.position.copy(localPointAtWorld(mesh, tipWorld));
  const worldScale = new THREE.Vector3();
  mesh.getWorldScale(worldScale);
  const s = Math.max(Math.abs(worldScale.x), 1e-8);
  holder.scale.setScalar(1 / s);
  mesh.add(holder);

  if (!mesh.getObjectByName('torch-flame')) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 7), flameMat());
    flame.name = 'torch-flame';
    flame.position.y = 0.04;
    holder.add(flame);
  }

  const glow = new THREE.PointLight(0xff9a3a, 1.55, 1.9, 2);
  glow.name = 'torch-glow';
  // Slightly above the tip and toward local −Z (wall-facing on typical mounts).
  glow.position.set(0, 0.05, -0.03);
  holder.add(glow);
}

function buildProceduralTorchBody() {
  const group = new THREE.Group();
  group.name = 'torch';
  const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 6), wood(0x5a3a22)));
  shaft.position.y = 0.12;
  group.add(shaft);
  const wrap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8), metal(0xb08a3c)));
  wrap.position.y = 0.3;
  group.add(wrap);
  const flame = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 7), flameMat()));
  flame.name = 'torch-flame';
  flame.position.y = 0.42;
  group.add(flame);
  return group;
}

function buildProceduralTorch() {
  const group = buildProceduralTorchBody();
  attachTorchFx(group);
  return group;
}

function addWallTorch(root, x, y, z, rotY = 0, glowMul = 1) {
  const torch = buildTorch();
  torch.position.set(x, y, z);
  torch.rotation.y = rotY;
  // Procedural sconces lean off the wall. The dumped torch stays upright.
  if (!getBundledLook('torch')) torch.rotation.z = 0.55;
  torch.traverse((child) => {
    if (!child.isLight) return;
    if (glowMul !== 1) child.intensity *= glowMul;
    child.userData.baseIntensity = child.intensity;
  });
  root.add(torch);
  return torch;
}

function makePlaque(text) {
  const group = new THREE.Group();
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.42, 0.08), wood(0x4e331f)));
  group.add(board);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4e331f';
  ctx.fillRect(0, 0, 640, 128);
  ctx.fillStyle = '#f0d9a8';
  ctx.font = '700 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 320, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.34),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  label.position.z = 0.05;
  group.add(label);
  const rail = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 0.1), wood(0x3c2616)));
  rail.position.y = 0.24;
  group.add(rail);
  return group;
}

/** Metres of shop floor covered by one seamless shop_floor tile. */
export const SHOP_FLOOR_TILE_M = 4;
const SHOP_FLOOR_FILE = 'shop_floor_512.png';

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function shopFloorTextureUrls() {
  const raw = assetBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const urls = [
    `${envBase}textures/${SHOP_FLOOR_FILE}`,
    `${envBase}public/textures/${SHOP_FLOOR_FILE}`,
  ];
  if (envBase !== './') {
    urls.push(`./textures/${SHOP_FLOOR_FILE}`, `./public/textures/${SHOP_FLOOR_FILE}`);
  }
  return [...new Set(urls)];
}

let shopFloorSource = null;

function configureShopFloorTexture(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  tex.userData.kind = 'shop-floor';
  return tex;
}

function applyShopFloorImage(loaded) {
  if (!shopFloorSource || !loaded?.image) return;
  shopFloorSource.image = loaded.image;
  shopFloorSource.needsUpdate = true;
}

function beginShopFloorLoad() {
  const urls = shopFloorTextureUrls();
  const attempt = (index) => {
    if (index >= urls.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.load(urls[index], applyShopFloorImage, undefined, () => attempt(index + 1));
    } catch {
      // Node tests stub document without an image element. Wrap and repeat still apply.
    }
  };
  attempt(0);
}

function shopFloorMap() {
  if (!shopFloorSource) {
    shopFloorSource = configureShopFloorTexture(new THREE.Texture());
    beginShopFloorLoad();
  }
  return shopFloorSource;
}

function shopFloorMat() {
  return new THREE.MeshStandardMaterial({
    map: shopFloorMap(),
    roughness: 0.88,
    metalness: 0.04,
    color: 0xffffff,
  });
}

const floorUvA = new THREE.Vector3();
const floorUvB = new THREE.Vector3();
const floorUvC = new THREE.Vector3();
const floorUvN = new THREE.Vector3();
const floorUvP = new THREE.Vector3();

/** World-space UVs so every room and board sits on one 4 m tile grid. */
function writeShopFloorUVs(geo, wx, wy, wz) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const at = (k) => (index ? index.getX(k) : k);
  const scale = 1 / SHOP_FLOOR_TILE_M;
  for (let f = 0; f < count; f += 3) {
    floorUvA.fromBufferAttribute(pos, at(f));
    floorUvB.fromBufferAttribute(pos, at(f + 1));
    floorUvC.fromBufferAttribute(pos, at(f + 2));
    floorUvN.subVectors(floorUvB, floorUvA).cross(floorUvC.sub(floorUvA));
    const ax = Math.abs(floorUvN.x);
    const ay = Math.abs(floorUvN.y);
    const az = Math.abs(floorUvN.z);
    let uKey = 'x';
    let vKey = 'y';
    if (ay >= ax && ay >= az) {
      uKey = 'x';
      vKey = 'z';
    } else if (ax >= az) {
      uKey = 'z';
      vKey = 'y';
    }
    for (let k = 0; k < 3; k += 1) {
      const vi = at(f + k);
      floorUvP.fromBufferAttribute(pos, vi);
      const worldX = floorUvP.x + wx;
      const worldY = floorUvP.y + wy;
      const worldZ = floorUvP.z + wz;
      const world = uKey === 'z' ? worldZ : worldX;
      const up = vKey === 'z' ? worldZ : worldY;
      uv.setXY(vi, world * scale, up * scale);
    }
  }
  uv.needsUpdate = true;
}

function markGround(mesh) {
  mesh.userData.kind = 'ground';
  return mesh;
}

function tagShopFloor(mesh, kind, cell) {
  mesh.userData.shopFloor = kind;
  mesh.userData.floorGx = cell?.gx ?? 0;
  mesh.userData.floorGz = cell?.gz ?? 0;
  return mesh;
}

function addFloor(root, center, cell = { gx: 0, gz: 0 }) {
  const slab = SHOP_FLOOR_SLAB;
  const top = shopFloorTopY();
  const bottom = slab.centerY - slab.thickness / 2;
  const thickness = top - bottom;
  const centerY = bottom + thickness / 2;
  const geo = new THREE.BoxGeometry(ROOM_W, thickness, ROOM_D);
  writeShopFloorUVs(geo, center.x, centerY, center.z);
  const mesh = addShadow(new THREE.Mesh(geo, shopFloorMat()));
  mesh.position.set(center.x, centerY, center.z);
  markGround(mesh);
  tagShopFloor(mesh, 'plank', cell);
  root.add(mesh);
}

/** Top face of the shop floor slabs, from the built meshes. */
export function measureShopFloorTop(root) {
  const pieces = measureShopFloorPieces(root);
  if (!pieces.length) return -Infinity;
  return Math.max(...pieces.map((piece) => piece.top));
}

/** Slab top and XZ bounds for each built room, including expansion floors. */
export function measureShopFloorPieces(root) {
  const groups = new Map();
  root?.updateMatrixWorld?.(true);
  root?.traverse((child) => {
    if (!child.isMesh || child.userData?.shopFloor !== 'plank') return;
    const gx = child.userData.floorGx ?? 0;
    const gz = child.userData.floorGz ?? 0;
    const key = `${gx},${gz}`;
    const box = new THREE.Box3().setFromObject(child);
    let piece = groups.get(key);
    if (!piece) {
      piece = {
        gx,
        gz,
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
        top: -Infinity,
      };
      groups.set(key, piece);
    }
    piece.minX = Math.min(piece.minX, box.min.x);
    piece.maxX = Math.max(piece.maxX, box.max.x);
    piece.minZ = Math.min(piece.minZ, box.min.z);
    piece.maxZ = Math.max(piece.maxZ, box.max.z);
    if (Number.isFinite(box.max.y)) piece.top = Math.max(piece.top, box.max.y);
  });
  return [...groups.values()];
}

function addBeams(root, center) {
  const beam = wood(0x3c2616, 0.78);
  const beamBar = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.16, 0.16), beam));
  beamBar.position.set(center.x, 2.55, center.z - ROOM_D / 2 + 0.1);
  root.add(beamBar);
  const sideBeam = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, ROOM_D - 0.1), beam));
  sideBeam.position.set(center.x - ROOM_W / 2 + 0.1, 2.55, center.z);
  root.add(sideBeam);
  const sideBeam2 = sideBeam.clone();
  sideBeam2.position.x = center.x + ROOM_W / 2 - 0.1;
  root.add(sideBeam2);
}

/** Metres of roof covered by one seamless roof tile on the main shop. */
export const SHOP_ROOF_TILE_M = 6;
/** Expansion and other small roof pieces use a slightly smaller tile. */
export const SHOP_ROOF_SMALL_TILE_M = 5;
const SHOP_ROOF_FILE = 'roof_512.png';

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function shopRoofTextureUrls() {
  const raw = assetBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const urls = [
    `${envBase}textures/${SHOP_ROOF_FILE}`,
    `${envBase}public/textures/${SHOP_ROOF_FILE}`,
  ];
  if (envBase !== './') {
    urls.push(`./textures/${SHOP_ROOF_FILE}`, `./public/textures/${SHOP_ROOF_FILE}`);
  }
  return [...new Set(urls)];
}

let shopRoofSource = null;

function configureShopRoofTexture(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  tex.userData.kind = 'shop-roof';
  return tex;
}

function applyShopRoofImage(loaded) {
  if (!shopRoofSource || !loaded?.image) return;
  shopRoofSource.image = loaded.image;
  shopRoofSource.needsUpdate = true;
}

function beginShopRoofLoad() {
  const urls = shopRoofTextureUrls();
  const attempt = (index) => {
    if (index >= urls.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.load(urls[index], applyShopRoofImage, undefined, () => attempt(index + 1));
    } catch {
      // Node tests stub document without an image element. Wrap and repeat still apply.
    }
  };
  attempt(0);
}

function shopRoofMap() {
  if (!shopRoofSource) {
    shopRoofSource = configureShopRoofTexture(new THREE.Texture());
    beginShopRoofLoad();
  }
  return shopRoofSource;
}

function shopRoofMat() {
  const mat = new THREE.MeshStandardMaterial({
    map: shopRoofMap(),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });
  mat.userData.isRoof = true;
  return mat;
}

/**
 * U runs along the eave (local Z). V is 0 at the eave — the bottom of the
 * image — and increases toward the ridge by distance along the slope, not
 * by vertical rise. ridgeSign is +1 when local +X is the ridge.
 */
function writeRoofSlopeUVs(geo, tileM, ridgeSign) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const eaveX = ridgeSign > 0 ? minX : maxX;
  const scale = 1 / tileM;
  for (let i = 0; i < pos.count; i += 1) {
    const alongSlope = (pos.getX(i) - eaveX) * ridgeSign;
    uv.setXY(i, pos.getZ(i) * scale, alongSlope * scale);
  }
  uv.needsUpdate = true;
}

function addRoofSlope(group, mat, tileM, ridgeSign, x, y, rotZ, roofSpan) {
  const geo = new THREE.BoxGeometry(roofSpan, 0.1, ROOM_D + 0.55);
  writeRoofSlopeUVs(geo, tileM, ridgeSign);
  const slope = addShadow(new THREE.Mesh(geo, mat));
  slope.position.set(x, y, 0);
  slope.rotation.z = rotZ;
  group.add(slope);
  return slope;
}

function addRoofForRoom(roofs, center, neigh = {}, isOrigin = false) {
  const group = new THREE.Group();
  group.userData.isRoof = true;
  group.position.copy(new THREE.Vector3(center.x, 0, center.z));
  const tilt = 0.42;
  const roofSpan = ROOM_W / 2 + 0.45;
  const rise = (roofSpan / 2) * Math.sin(tilt);
  const eaveY = 2.82;
  const ridgeY = eaveY + rise * 2;
  const tileM = isOrigin ? SHOP_ROOF_TILE_M : SHOP_ROOF_SMALL_TILE_M;
  const roofMat = shopRoofMat();
  const slopeY = eaveY + rise;
  addRoofSlope(group, roofMat, tileM, 1, -ROOM_W / 4, slopeY, tilt, roofSpan);
  addRoofSlope(group, roofMat, tileM, -1, ROOM_W / 4, slopeY, -tilt, roofSpan);
  const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, ROOM_D + 0.4), wood(0x3c2616)));
  ridge.position.set(0, ridgeY, 0);
  group.add(ridge);
  const rafter = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 0.2, 0.12, 0.12), wood(0x3c2616)));
  rafter.position.set(0, 2.55, 0);
  group.add(rafter);
  roofs.add(group);
  addRoofGables(group, center, neigh, ridgeY);
  return group;
}

/** Match shop-wall bricks: texture U/V is world metres times SHOP_WALL_REPEAT. */
function writeGableUVs(geo, end, wallTop) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const cos = Math.cos(end.rotY);
  const sin = Math.sin(end.rotY);
  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const worldX = end.x + lx * cos + lz * sin;
    const worldY = wallTop + ly;
    const worldZ = end.z - lx * sin + lz * cos;
    const along = end.side ? worldZ : worldX;
    uv.setXY(i, along * SHOP_WALL_REPEAT, worldY * SHOP_WALL_REPEAT);
  }
  uv.needsUpdate = true;
}

function addRoofGables(group, center, neigh, ridgeY) {
  const wallTop = 2.66;
  const peakH = Math.max(0.2, ridgeY - wallTop);
  const thick = 0.2;
  const ends = [];
  if (!neigh?.front) ends.push({ x: center.x, z: center.z + ROOM_D / 2, rotY: 0 });
  if (!neigh?.back) ends.push({ x: center.x, z: center.z - ROOM_D / 2, rotY: Math.PI });
  if (!neigh?.left) ends.push({ x: center.x - ROOM_W / 2, z: center.z, rotY: Math.PI / 2, side: true });
  if (!neigh?.right) ends.push({ x: center.x + ROOM_W / 2, z: center.z, rotY: -Math.PI / 2, side: true });
  for (const end of ends) {
    const width = end.side ? ROOM_D : ROOM_W;
    const height = end.side ? Math.min(0.22, peakH) : peakH;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -thick / 2);
    writeGableUVs(geo, end, wallTop);
    const mat = shopWallMat();
    mat.transparent = true;
    mat.opacity = 1;
    mat.depthWrite = true;
    mat.userData.isRoof = true;
    const mesh = addShadow(new THREE.Mesh(geo, mat));
    mesh.name = 'roof-gable';
    mesh.position.set(end.x - center.x, wallTop, end.z - center.z);
    mesh.rotation.y = end.rotY;
    group.add(mesh);
  }
}

function addOriginFront(root, center) {
  const beam = wood(0x3c2616, 0.78);
  const doorHalf = 0.58;
  const lintel = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(doorHalf * 2 + 0.36, SHOP_DOOR_LINTEL.height, 0.22),
    beam,
  ));
  lintel.position.set(center.x, SHOP_DOOR_LINTEL.centerY, center.z + ROOM_D / 2);
  root.add(lintel);
  const postL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.18, 0.2), beam));
  postL.position.set(center.x - doorHalf - 0.02, 1.14, center.z + ROOM_D / 2);
  root.add(postL);
  const postR = postL.clone();
  postR.position.x = center.x + doorHalf + 0.02;
  root.add(postR);
  const sill = addShadow(new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 + 0.2, 0.08, 0.42), wood(0x4a301c)));
  sill.position.set(center.x, 0.08, center.z + ROOM_D / 2 + 0.04);
  root.add(sill);
  const stoop = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.7), wood(0x5a3b22, 0.92)));
  stoop.position.set(center.x, 0.04, center.z + ROOM_D / 2 + 0.54);
  root.add(stoop);

  const posts = [
    [center.x - 3.7, center.z + ROOM_D / 2 - 0.1],
    [center.x + 3.7, center.z + ROOM_D / 2 - 0.1],
    [center.x - 3.7, center.z + ROOM_D / 2 + 0.8],
    [center.x + 3.7, center.z + ROOM_D / 2 + 0.8],
  ];
  for (const [x, z] of posts) {
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 8), beam));
    post.position.set(x, 1.2, z);
    root.add(post);
  }
  // The red canopy used to run through the wall and hang inside the room. Keep its
  // outer lip and stop the cloth on the exterior face so that inside bar is gone.
  const awningTilt = -0.18;
  const awningCos = Math.cos(awningTilt);
  const awningSin = Math.sin(awningTilt);
  const oldHalf = 0.85;
  const oldCenterY = 2.32;
  const oldCenterZ = center.z + ROOM_D / 2 + 0.47;
  const outerZ = oldCenterZ + oldHalf * awningCos;
  const outerY = oldCenterY - oldHalf * awningSin;
  const wallOuterZ = center.z + ROOM_D / 2 + 0.08;
  const awningHalf = (outerZ - wallOuterZ) / (2 * awningCos);
  const awning = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(8.1, 0.06, awningHalf * 2),
    cloth(0x8b4336),
  ));
  awning.position.set(center.x, outerY + awningHalf * awningSin, wallOuterZ + awningHalf * awningCos);
  awning.rotation.x = awningTilt;
  root.add(awning);
  const stripe = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.12, 0.02, 0.28), cloth(0xead3ae)));
  stripe.position.set(center.x, 2.36, center.z + ROOM_D / 2 - 0.03);
  stripe.rotation.x = -0.18;
  root.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.z = center.z + ROOM_D / 2 + 0.62;
  root.add(stripe2);

  const join = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_W + 0.18, 0.28, 0.48),
    wood(0x3c2616, 0.78),
  ));
  join.position.set(center.x, 2.64, center.z + ROOM_D / 2 + 0.1);
  root.add(join);

  const fasciaW = ROOM_W + 0.12;
  const fasciaH = 0.16;
  const fasciaD = 0.28;
  const fasciaX = center.x;
  const fasciaY = 2.78;
  const fasciaZ = center.z + ROOM_D / 2 + 0.02;
  const fasciaGeo = new THREE.BoxGeometry(fasciaW, fasciaH, fasciaD);
  writeShopWallUVs(fasciaGeo, fasciaX, fasciaY, fasciaZ);
  const fascia = addShadow(new THREE.Mesh(fasciaGeo, shopWallMat()));
  fascia.name = 'fascia';
  fascia.position.set(fasciaX, fasciaY, fasciaZ);
  root.add(fascia);
  for (const side of [-1, 1]) {
    const cap = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.5),
      wood(0x3c2616, 0.78),
    ));
    cap.position.set(center.x + side * (ROOM_W / 2 - 0.1), 2.68, center.z + ROOM_D / 2 + 0.14);
    root.add(cap);
  }

  const awningZ = center.z + ROOM_D / 2 + 0.47;
  const plaque = makePlaque('General Store');
  plaque.position.set(center.x, 1.94, awningZ);
  root.add(plaque);
  const chainMat = metal(0x9a9aa2);
  for (const side of [-0.82, 0.82]) {
    const chain = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), chainMat));
    chain.position.set(center.x + side, 2.14, awningZ);
    root.add(chain);
  }
}

function addRoomTorches(root, center, neigh) {
  const y = 1.62;
  const inset = 0.18;
  if (!neigh?.left) {
    addWallTorch(root, center.x - ROOM_W / 2 + inset, y, center.z - 1.85, Math.PI / 2);
    addWallTorch(root, center.x - ROOM_W / 2 + inset, y, center.z + 1.85, Math.PI / 2);
  }
  if (!neigh?.right) {
    addWallTorch(root, center.x + ROOM_W / 2 - inset, y, center.z - 1.85, -Math.PI / 2);
    addWallTorch(root, center.x + ROOM_W / 2 - inset, y, center.z + 1.85, -Math.PI / 2);
  }
  if (!neigh?.back) {
    addWallTorch(root, center.x - 1.7, y, center.z - ROOM_D / 2 + inset, 0);
    addWallTorch(root, center.x + 1.7, y, center.z - ROOM_D / 2 + inset, 0);
  }
  if (!neigh?.front) {
    addWallTorch(root, center.x - 1.7, y, center.z + ROOM_D / 2 - inset, Math.PI);
    addWallTorch(root, center.x + 1.7, y, center.z + ROOM_D / 2 - inset, Math.PI);
  }
}

function addOriginDecor(root, center) {
  addWallVines(root, center);

  addWallTorch(root, center.x - ROOM_W / 2 + 0.18, 1.62, center.z - 1.85, Math.PI / 2);
  addWallTorch(root, center.x - ROOM_W / 2 + 0.18, 1.62, center.z + 1.85, Math.PI / 2);
  addWallTorch(root, center.x + ROOM_W / 2 - 0.18, 1.62, center.z - 1.85, -Math.PI / 2);
  addWallTorch(root, center.x + ROOM_W / 2 - 0.18, 1.62, center.z + 1.85, -Math.PI / 2);
}

function addRoomWalls(root, cell, neigh, isOrigin) {
  const c = roomCenter(cell.gx, cell.gz);
  const h = 2.7;
  const t = 0.16;
  const y = 1.4;
  const leftX = c.x - ROOM_W / 2;
  const rightX = c.x + ROOM_W / 2;
  const backZ = c.z - ROOM_D / 2;
  const frontZ = c.z + ROOM_D / 2;

  if (!neigh.left) {
    addWallWithWindow(root, {
      x: leftX, y, z: c.z, w: ROOM_D, h, t, axis: 'z',
      winAlong: c.z, winY: 1.42, winW: 0.86, winH: 0.95,
    });
    addShopWindow(root, { x: leftX + 0.02, y: 1.42, z: c.z, rotY: Math.PI / 2 });
  }

  if (neigh.right) {
    addWallWithDoor(root, {
      x: rightX, y, z: c.z, w: ROOM_D, h, t, axis: 'z', doorAlong: c.z,
    });
  } else {
    addWallWithWindow(root, {
      x: rightX, y, z: c.z, w: ROOM_D, h, t, axis: 'z',
      winAlong: c.z, winY: 1.42, winW: 0.86, winH: 0.95,
    });
    addShopWindow(root, { x: rightX - 0.02, y: 1.42, z: c.z, rotY: -Math.PI / 2 });
  }

  if (neigh.back) {
    addWallWithDoor(root, {
      x: c.x, y, z: backZ, w: ROOM_W, h, t, axis: 'x', doorAlong: c.x,
    });
  } else {
    addWallSlab(root, c.x, y, backZ, ROOM_W, h, t);
    const cap = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_W + 0.08, 0.14, 0.22),
      wood(0x3c2616, 0.78),
    ));
    cap.position.set(c.x, 2.72, backZ);
    root.add(cap);
  }

  if (!neigh.front) {
    if (isOrigin) {
      const doorHalf = 0.58;
      const wallSpan = ROOM_W / 2 - doorHalf;
      addWallWithWindow(root, {
        x: c.x - ROOM_W / 2 + wallSpan / 2, y, z: frontZ, w: wallSpan, h, t, axis: 'x',
        winAlong: c.x - 1.48, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addWallWithWindow(root, {
        x: c.x + ROOM_W / 2 - wallSpan / 2, y, z: frontZ, w: wallSpan, h, t, axis: 'x',
        winAlong: c.x + 1.48, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addShopWindow(root, { x: c.x - 1.48, y: 1.42, z: frontZ - 0.08 });
      addShopWindow(root, { x: c.x + 1.48, y: 1.42, z: frontZ - 0.08 });
      addOriginFront(root, c);
    } else {
      addWallWithWindow(root, {
        x: c.x - ROOM_W / 4, y, z: frontZ, w: ROOM_W / 2, h, t, axis: 'x',
        winAlong: c.x - ROOM_W / 4, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addWallWithWindow(root, {
        x: c.x + ROOM_W / 4, y, z: frontZ, w: ROOM_W / 2, h, t, axis: 'x',
        winAlong: c.x + ROOM_W / 4, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addShopWindow(root, { x: c.x - ROOM_W / 4, y: 1.42, z: frontZ - 0.08 });
      addShopWindow(root, { x: c.x + ROOM_W / 4, y: 1.42, z: frontZ - 0.08 });
    }
  }
}

function randAt(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildRug() {
  const group = new THREE.Group();
  group.name = 'rug';
  group.userData.kind = 'rug';
  group.userData.rug = true;
  group.userData.walkable = true;
  group.userData.floorY = SHOP_RUG.y;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b2e24';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#e3b34a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 144);
  ctx.strokeStyle = '#c45a32';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 20, 212, 120);
  ctx.fillStyle = '#8a4332';
  ctx.fillRect(48, 40, 160, 80);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(SHOP_RUG.w, 0.025, SHOP_RUG.d),
    new THREE.MeshStandardMaterial({ map, roughness: 0.95 }),
  );
  rug.userData.kind = 'rug';
  rug.userData.rug = true;
  rug.userData.walkable = true;
  rug.receiveShadow = true;
  group.add(rug);
  return group;
}

function leafMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

export function buildWallVines(seed = 1) {
  const group = new THREE.Group();
  group.name = 'wall-vines';
  const rand = randAt(4100 + seed * 131);

  const trough = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.13, 0.18),
    wood(0x6a3a22, 0.8),
  ));
  trough.position.set(0, 0.04, 0.01);
  group.add(trough);
  const lip = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.035, 0.05),
    wood(0x4a2816, 0.78),
  ));
  lip.position.set(0, 0.1, 0.1);
  group.add(lip);
  const soil = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 }),
  ));
  soil.position.set(0, 0.12, 0.02);
  group.add(soil);

  const greens = [0x245828, 0x2f6a32, 0x3d7a38, 0x4a8a3e, 0x1f4f24];
  const strands = 6;
  for (let s = 0; s < strands; s += 1) {
    const x0 = -0.3 + s * 0.12 + (rand() - 0.5) * 0.04;
    const length = 0.62 + rand() * 0.58;
    const segs = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < segs; i += 1) {
      const t = i / (segs - 1);
      const y = 0.08 - t * length;
      const z = 0.1 + Math.sin((t + s * 0.2) * 3.1) * 0.05 + t * 0.07;
      const x = x0 + Math.sin((t * 4.2) + s) * 0.07;
      const leaf = addShadow(new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + rand() * 0.03, 6, 5),
        leafMat(greens[Math.floor(rand() * greens.length)]),
      ));
      leaf.scale.set(1.55, 0.38 + rand() * 0.16, 0.95);
      leaf.position.set(x, y, z);
      leaf.rotation.set(0.35 + rand() * 0.6, rand() * Math.PI, 0.15 + rand() * 0.4);
      group.add(leaf);
    }
  }

  const blooms = [0xc45a32, 0xe3b34a, 0xd7c09a, 0x8a3a6a];
  for (let i = 0; i < 4; i += 1) {
    const blossom = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + rand() * 0.012, 6, 5),
      new THREE.MeshStandardMaterial({ color: blooms[i % blooms.length], roughness: 0.62 }),
    ));
    blossom.position.set(-0.24 + i * 0.16, 0.18 + rand() * 0.06, 0.07);
    group.add(blossom);
  }
  return group;
}

function mountWallVines(root, x, y, z, rotY, seed) {
  const vines = buildWallVines(seed);
  vines.position.set(x, y, z);
  vines.rotation.y = rotY;
  root.add(vines);
  return vines;
}

function addWallVines(root, center) {
  // Food/potion wall shelves stay vine-free so plates and flasks can sit on them.
  wallVineMounts(center).forEach((spot, index) => {
    mountWallVines(root, spot.x, spot.y, spot.z, spot.rotY, index + 1);
  });
}

/** Uniform world scale vs the baked range (dump or procedural) after size-match. */
export const RANGE_WORLD_SCALE = 2;
/** Dump wooden plate is Y 0–16 of the 224-tall Cooking range mesh. */
export const RANGE_PLATE_FRAC = 16 / 224;

function applyRangeWorldScale(mesh) {
  mesh.scale.multiplyScalar(RANGE_WORLD_SCALE);
  mesh.updateMatrixWorld(true);
  const box = measureVisibleBox(mesh);
  if (Number.isFinite(box.min.y)) mesh.position.y -= box.min.y;
  if (mesh.userData.wareY != null) mesh.userData.wareY *= RANGE_WORLD_SCALE;
  return mesh;
}

/** Drop the dump so the brown base plate sits under the floorboards. */
function sinkRangePlate(mesh) {
  mesh.updateMatrixWorld(true);
  const box = measureVisibleBox(mesh);
  const height = box.max.y - box.min.y;
  if (!Number.isFinite(height) || height <= 0) return mesh;
  mesh.position.y -= height * RANGE_PLATE_FRAC;
  mesh.userData.floorY = mesh.position.y;
  return mesh;
}

export function buildRange() {
  const bundled = getBundledLook('range');
  const target = applyRangeWorldScale(buildProceduralRange());
  if (bundled) {
    return sinkRangePlate(wrapBundledProp(bundled, target, {
      name: 'range',
      fit: 'height',
      label: 'Range',
      wareY: 'top',
    }));
  }
  return target;
}

function buildProceduralRange() {
  const group = new THREE.Group();
  group.name = 'range';
  const iron = sootMetal(0x4a4e54, 0.5, 0.6);
  const brick = brickSurface(0xc8a090, 0.9);
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.46), brick));
  body.position.y = 0.32;
  group.add(body);
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.5), iron));
  top.position.y = 0.6;
  group.add(top);
  const door = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.04), iron));
  door.position.set(0, 0.3, 0.24);
  group.add(door);
  const handle = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.03), wornMetal(0xb08a3c, 0.32, 0.64)));
  handle.position.set(0.08, 0.3, 0.27);
  group.add(handle);
  for (const x of [-0.14, 0.14]) {
    const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 12), iron));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.64, 0.02);
    group.add(ring);
  }
  const pipe = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 8), iron));
  pipe.position.set(0.2, 0.84, -0.12);
  group.add(pipe);
  const cap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.05, 8), iron));
  cap.position.set(0.2, 1.06, -0.12);
  group.add(cap);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xff6a18, emissive: 0xff4a00, emissiveIntensity: 0.9 }),
  );
  glow.position.set(0, 0.3, 0.25);
  group.add(glow);
  group.userData.wareY = 0.68;
  const label = makeNameSprite('Range');
  label.position.y = 1.22;
  group.add(label);
  return group;
}

export function buildCauldron() {
  const bundled = getBundledLook('cauldron');
  if (bundled) {
    const target = buildProceduralCauldron();
    return wrapBundledProp(bundled, target, { name: 'cauldron', fit: 'max', label: 'Cauldron', wareY: 'top' });
  }
  return buildProceduralCauldron();
}

function buildProceduralCauldron() {
  const group = new THREE.Group();
  group.name = 'cauldron';
  const iron = sootMetal(0x3a4248, 0.5, 0.58);
  const dark = sootMetal(0x1c2226, 0.55, 0.5);
  const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 18), iron));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.52;
  group.add(ring);
  const bowl = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.35), dark));
  bowl.position.y = 0.38;
  group.add(bowl);
  const brew = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 14),
    new THREE.MeshStandardMaterial({
      color: 0x4a8a3e,
      emissive: 0x2a6a28,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    }),
  );
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = 0.5;
  group.add(brew);
  for (const [x, z] of [[-0.2, 0.12], [0.2, 0.12], [0, -0.22]]) {
    const leg = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.34, 6), iron));
    leg.position.set(x, 0.17, z);
    leg.rotation.z = x * 0.35;
    leg.rotation.x = -z * 0.25;
    group.add(leg);
  }
  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0xffc56a, emissive: 0xff7a18, emissiveIntensity: 1.2, roughness: 0.5 }),
  );
  fire.position.y = 0.1;
  group.add(fire);
  const glow = new THREE.PointLight(0xff9a3a, 0.55, 2.4, 2);
  glow.position.y = 0.18;
  group.add(glow);
  group.userData.wareY = 0.58;
  const label = makeNameSprite('Cauldron');
  label.position.y = 1.05;
  group.add(label);
  return group;
}

export function buildFurnace() {
  const bundled = getBundledLook('furnace');
  if (bundled) {
    const target = buildProceduralFurnace();
    const fitted = wrapBundledProp(bundled, target, { name: 'furnace', fit: 'height', label: 'Furnace', wareY: 'top' });
    sitVisibleOnY(fitted, SHOP_FURNITURE_FLOOR_Y);
    const root = new THREE.Group();
    root.name = 'furnace';
    root.add(fitted);
    root.userData.wareY = fitted.userData.wareY;
    return root;
  }
  return buildProceduralFurnace();
}

function buildProceduralFurnace() {
  const group = new THREE.Group();
  group.name = 'furnace';
  const brick = brickSurface(0x8a9098, 0.9);
  const dark = sootMetal(0x3a342e, 0.55, 0.22);
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.62), brick));
  body.position.y = 0.39;
  group.add(body);
  const hearth = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.12), dark));
  hearth.position.set(0, 0.28, 0.27);
  group.add(hearth);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.2, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xff6a18, emissive: 0xff4a00, emissiveIntensity: 1.1, roughness: 0.4 }),
  );
  glow.position.set(0, 0.28, 0.32);
  group.add(glow);
  const chimney = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), brick));
  chimney.position.set(-0.16, 0.98, -0.08);
  group.add(chimney);
  const lip = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), dark));
  lip.position.set(-0.16, 1.26, -0.08);
  group.add(lip);
  const fire = new THREE.PointLight(0xff7a28, 0.55, 2.6, 2);
  fire.position.set(0, 0.32, 0.2);
  group.add(fire);
  group.userData.wareY = 0.8;
  const label = makeNameSprite('Furnace');
  label.position.y = 1.42;
  group.add(label);
  return group;
}

/** Uniform world scale vs the baked spinning wheel after size-match.
 * Live size was 4× the dump (2× of the prior 2× live size). Halve that
 * in-game size back to 2× the original baked fit. */
export const WHEEL_WORLD_SCALE = 2;

function applyWheelWorldScale(mesh) {
  mesh.scale.multiplyScalar(WHEEL_WORLD_SCALE);
  mesh.updateMatrixWorld(true);
  const box = measureVisibleBox(mesh);
  if (Number.isFinite(box.min.y)) mesh.position.y -= box.min.y;
  if (mesh.userData.wareY != null) mesh.userData.wareY *= WHEEL_WORLD_SCALE;
  return mesh;
}

function buildWorkBench(name, topHex, accentHex) {
  const group = new THREE.Group();
  group.name = name;
  const top = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.08, 0.56),
    wood(topHex, 0.84),
  ));
  top.position.y = 0.74;
  group.add(top);
  for (const [x, z] of [[-0.36, -0.2], [0.36, -0.2], [-0.36, 0.2], [0.36, 0.2]]) {
    const leg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.74, 0.07), wood(0x3e2616, 0.9)));
    leg.position.set(x, 0.37, z);
    group.add(leg);
  }
  const accent = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.04, 0.08),
    wood(accentHex, 0.7),
  ));
  accent.position.set(0, 0.82, 0);
  group.add(accent);
  return group;
}

function fitBundledStation(id, procedural) {
  const bundled = getBundledLook(id);
  if (!bundled) return procedural;
  const targetBox = new THREE.Box3().setFromObject(procedural);
  const fitted = wrapBundledProp(bundled, procedural, {
    name: id,
    fit: 'max',
    targetBox,
    ...dumpStandEuler(bundled, targetBox),
  });
  sitVisibleOnY(fitted, 0);
  return fitted;
}

function buildProceduralLoom() {
  const group = buildWorkBench('loom', 0x6b4423, 0xc4a05a);
  const frame = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), wood(0x4a301c, 0.88)));
  frame.position.set(-0.28, 1.05, 0);
  group.add(frame);
  const frame2 = frame.clone();
  frame2.position.x = 0.28;
  group.add(frame2);
  const beam = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.06), wood(0x8a6238, 0.8)));
  beam.position.set(0, 1.3, 0);
  group.add(beam);
  return group;
}

export function buildLoom() {
  return fitBundledStation('loom', buildProceduralLoom());
}

function buildProceduralFletchingBench() {
  const group = buildWorkBench('fletch', 0x5a3a22, 0xd7c09a);
  const stave = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), wood(0xc4a05a, 0.7)));
  stave.position.set(0.05, 0.84, 0.08);
  stave.rotation.y = 0.4;
  group.add(stave);
  return group;
}

export function buildFletchingBench() {
  const fitted = fitBundledStation('fletch', buildProceduralFletchingBench());
  if (!getBundledLook('fletch')) return fitted;
  fitted.scale.multiplyScalar(1.5);
  fitted.updateMatrixWorld(true);
  sitVisibleOnY(fitted, 0);
  return fitted;
}

function buildProceduralPotterWheel() {
  const group = new THREE.Group();
  group.name = 'potter';
  const stand = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.62, 10), wood(0x4a301c, 0.88)));
  stand.position.y = 0.31;
  group.add(stand);
  const disc = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16), wood(0x6b4423, 0.8)));
  disc.position.y = 0.64;
  group.add(disc);
  const clay = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xb56a3a, roughness: 0.9 }),
  ));
  clay.position.y = 0.73;
  group.add(clay);
  return group;
}

export function buildPotterWheel() {
  return fitBundledStation('potter', buildProceduralPotterWheel());
}

export function buildSpinningWheel() {
  const bundled = getBundledLook('wheel');
  if (bundled) {
    const target = applyWheelWorldScale(buildProceduralSpinningWheel());
    const fitted = wrapBundledProp(bundled, target, {
      name: 'wheel',
      fit: 'max',
      label: 'Spinning Wheel',
      wareY: 'top',
    });
    sitVisibleOnY(fitted, 0);
    const spinner = new THREE.Group();
    spinner.name = 'spin-wheel';
    fitted.add(spinner);
    fitted.userData.spinWheel = spinner;
    return fitted;
  }
  return applyWheelWorldScale(buildProceduralSpinningWheel());
}

function buildProceduralSpinningWheel() {
  const group = new THREE.Group();
  group.name = 'wheel';
  const oak = woodSurface(0x6b4423, 0.86, 0.8, 1.1, 4211);
  const dark = woodSurface(0x3e2616, 0.88, 0.6, 0.8, 6113);
  const base = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.28), oak));
  base.position.y = 0.03;
  group.add(base);
  const post = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.06), oak));
  post.position.set(-0.08, 0.32, 0);
  group.add(post);
  const bench = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.2), oak));
  bench.position.set(0.14, 0.22, 0);
  group.add(bench);
  const spinner = new THREE.Group();
  spinner.name = 'spin-wheel';
  const rim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 22), dark));
  spinner.add(rim);
  for (let i = 0; i < 8; i += 1) {
    const spoke = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.012), oak));
    spoke.rotation.z = (i * Math.PI) / 8;
    spinner.add(spoke);
  }
  const hub = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), dark));
  hub.rotation.x = Math.PI / 2;
  spinner.add(hub);
  spinner.position.set(-0.08, 0.52, 0);
  group.add(spinner);
  group.userData.spinWheel = spinner;
  group.userData.wareY = 0.7;
  const label = makeNameSprite('Spinning Wheel');
  label.position.y = 1.12;
  group.add(label);
  return group;
}

function makeNameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(28, 18, 10, 0.72)';
  roundRect(ctx, 16, 10, 288, 48, 12);
  ctx.fill();
  ctx.fillStyle = '#f6e4c4';
  ctx.font = '600 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 35);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false,
  }));
  sprite.scale.set(0.9, 0.22, 1);
  sprite.renderOrder = 2;
  return sprite;
}

export function buildTree(scale = 1) {
  const target = buildProceduralTree(scale * OUTDOOR_TREE_SCALE);
  const bundled = getBundledLook('tree');
  const fitted = bundled
    ? wrapBundledProp(bundled, target, { name: 'pine', fit: 'height' })
    : target;
  return mountOutdoorTree(fitted);
}

/**
 * Sit the uniformly scaled pine on the grass.
 * The visual lives under a placement group so the garden can pin the group
 * without lifting the trunk. Materials stay opaque: the roof fade adopts
 * transparent meshes, and this must not join that pass.
 */
function mountOutdoorTree(visual) {
  sitVisibleOnY(visual, 0);
  visual.name = 'pine-visual';
  const root = new THREE.Group();
  root.name = 'pine';
  root.add(visual);
  return root;
}

/** How far under the lawn plane the lowest root vertex should sit, in metres. */
const TREE_ROOT_SINK = 0.015;
const GRASS_PLANE_Y = -0.02;

/**
 * After every scale, drop the pine so its lowest world vertex meets the grass.
 * Scaling around a pivot above the roots lifts the fins; this measures the
 * finished box and corrects it.
 */
export function seatTreeOnGround(tree, surfaceY = GRASS_PLANE_Y) {
  if (!tree) return tree;
  tree.updateMatrixWorld(true);
  const box = measureVisibleBox(tree);
  if (!Number.isFinite(box.min.y)) return tree;
  const target = surfaceY - TREE_ROOT_SINK;
  tree.position.y += target - box.min.y;
  tree.updateMatrixWorld(true);
  return tree;
}

/** Bark radius above the root fins, in world metres. Falls back to the 2× column. */
export function measureTrunkRadius(tree) {
  if (!tree) return TREE_TRUNK_RADIUS;
  tree.updateMatrixWorld(true);
  const origin = new THREE.Vector3();
  tree.getWorldPosition(origin);
  const box = measureVisibleBox(tree);
  const height = Math.max(0.01, box.max.y - box.min.y);
  const y0 = box.min.y + height * 0.14;
  const y1 = box.min.y + height * 0.24;
  const v = new THREE.Vector3();
  let maxR = 0;
  let n = 0;
  tree.traverse((child) => {
    if (!child.isMesh || !child.geometry || child.userData?.kind === 'tree') return;
    const pos = child.geometry.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      if (v.y < y0 || v.y > y1) continue;
      const r = Math.hypot(v.x - origin.x, v.z - origin.z);
      if (r > maxR) maxR = r;
      n += 1;
    }
  });
  return n ? maxR : TREE_TRUNK_RADIUS;
}

/** Knee-high next to the shopkeeper. The uploaded dump is a wide flat spray. */
export const FLAX_PLANT_HEIGHT = 0.5;

export function buildProceduralFlax() {
  const group = new THREE.Group();
  group.name = 'flax-plant';
  group.userData.flaxProcedural = true;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a7a32, roughness: 0.86 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0x6ec8d4, roughness: 0.62 });
  const stems = [
    { x: 0, z: 0, h: FLAX_PLANT_HEIGHT, lean: 0.06 },
    { x: 0.07, z: 0.04, h: 0.42, lean: -0.14 },
    { x: -0.06, z: 0.05, h: 0.46, lean: 0.16 },
    { x: 0.02, z: -0.07, h: 0.36, lean: -0.08 },
  ];
  for (const stem of stems) {
    const mesh = addShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, stem.h, 5),
      stemMat,
    ));
    mesh.position.set(stem.x, stem.h / 2, stem.z);
    mesh.rotation.z = stem.lean;
    group.add(mesh);
    const flower = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 5), flowerMat));
    flower.position.set(
      stem.x + Math.sin(stem.lean) * stem.h * 0.45,
      stem.h + 0.01,
      stem.z,
    );
    group.add(flower);
  }
  return group;
}

function flaxDoubleSide(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const copies = mats.map((mat) => {
      const copy = mat.clone();
      copy.side = THREE.DoubleSide;
      return copy;
    });
    child.material = Array.isArray(child.material) ? copies : copies[0];
  });
}

/** Uploaded flax dump, stood up and fit to the procedural plant. Procedural if the dump is missing. */
export function buildFlaxPlant() {
  const target = buildProceduralFlax();
  const bundled = getBundledLook('flax-plant');
  if (!bundled) return target;
  try {
    const fitted = wrapBundledProp(bundled, target, {
      name: 'flax-plant',
      fit: 'height',
      // The dump lies flat in XZ (broad face, short Y). Tip it so that face stands up.
      rotateX: -Math.PI / 2,
    });
    if (!fitted) return target;
    fitted.userData.flaxProcedural = false;
    flaxDoubleSide(fitted);
    sitVisibleOnY(fitted, 0);
    return fitted;
  } catch (err) {
    console.warn('Flax plant model skipped:', err?.message || err);
    return target;
  }
}

function buildProceduralTree(scale = 1) {
  const group = new THREE.Group();
  group.name = 'pine';
  const bark = wood(0x6a4a28);
  const flare = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * scale, 0.2 * scale, 0.18 * scale, 7),
    bark,
  ));
  flare.position.y = 0.08 * scale;
  group.add(flare);
  const trunk = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.88 * scale, 7),
    bark,
  ));
  trunk.position.y = 0.54 * scale;
  group.add(trunk);
  const stub = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.022 * scale, 0.03 * scale, 0.22 * scale, 5),
    bark,
  ));
  stub.position.set(0.14 * scale, 0.64 * scale, 0.02 * scale);
  stub.rotation.z = 1.2;
  group.add(stub);
  const leaf = new THREE.MeshStandardMaterial({
    color: 0x3a8a3a,
    roughness: 0.88,
    flatShading: true,
  });
  const layers = [
    { y: 0.98, r: 0.64, h: 0.5 },
    { y: 1.26, r: 0.5, h: 0.44 },
    { y: 1.52, r: 0.36, h: 0.4 },
    { y: 1.76, r: 0.2, h: 0.36 },
  ];
  for (const layer of layers) {
    const cone = addShadow(new THREE.Mesh(
      new THREE.ConeGeometry(layer.r * scale, layer.h * scale, 7),
      leaf,
    ));
    cone.position.y = layer.y * scale;
    group.add(cone);
  }
  return group;
}

function addFountainWater(group, opts = {}) {
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x7ec8e8,
    roughness: 0.08,
    metalness: 0.18,
    transparent: true,
    opacity: 0.52,
    emissive: 0x1a4a68,
    emissiveIntensity: 0.16,
  });
  const topY = opts.topY ?? 0.9;
  const basinY = opts.basinY ?? 0.31;
  const streamH = Math.max(0.18, topY - basinY);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.04, streamH, 10), waterMat);
  stream.name = 'fountain-stream';
  stream.position.y = basinY + streamH / 2;
  group.add(stream);

  const count = 40;
  const dropGeo = new THREE.SphereGeometry(0.016, 6, 5);
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0xb8e8f6,
    roughness: 0.08,
    metalness: 0.18,
    transparent: true,
    opacity: 0.72,
  });
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, count);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.name = 'fountain-drops';
  group.add(drops);

  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.15, 16),
    new THREE.MeshStandardMaterial({
      color: 0xa8d8ec,
      roughness: 0.12,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    }),
  );
  splash.name = 'fountain-splash';
  splash.rotation.x = -Math.PI / 2;
  splash.position.y = basinY + 0.005;
  group.add(splash);

  const dummy = new THREE.Object3D();
  const seeds = Array.from({ length: count }, (_, i) => ({
    phase: i / count,
    spin: (i * 2.399) % (Math.PI * 2),
    spread: 0.035 + (i % 7) * 0.016,
  }));
  group.userData.fountainWater = {
    stream, drops, splash, dummy, seeds, fallStart: topY, fallEnd: basinY,
  };
}

function stepFountainWater(fx, now) {
  const { stream, drops, splash, dummy, seeds } = fx;
  stream.scale.x = 0.86 + Math.sin(now * 14) * 0.12;
  stream.scale.z = 0.86 + Math.cos(now * 16) * 0.12;
  stream.material.opacity = 0.42 + Math.sin(now * 11) * 0.1;
  splash.scale.setScalar(1 + Math.sin(now * 9) * 0.18);
  splash.material.opacity = 0.2 + Math.sin(now * 9) * 0.1;
  const fallStart = fx.fallStart ?? 0.93;
  const fallEnd = fx.fallEnd ?? 0.32;
  const fall = fallStart - fallEnd;
  for (let i = 0; i < seeds.length; i += 1) {
    const seed = seeds[i];
    const t = (seed.phase + now * 0.55) % 1;
    const y = fallStart - t * fall;
    const flare = t * t;
    dummy.position.set(
      Math.cos(seed.spin + now * 0.4) * seed.spread * flare,
      y,
      Math.sin(seed.spin + now * 0.4) * seed.spread * flare,
    );
    dummy.scale.setScalar(0.7 + (1 - t) * 0.55);
    dummy.updateMatrix();
    drops.setMatrixAt(i, dummy.matrix);
  }
  drops.instanceMatrix.needsUpdate = true;
}

export function tickFountainWater(root, now) {
  if (!root) return;
  root.traverse((child) => {
    const fx = child.userData?.fountainWater;
    if (fx) stepFountainWater(fx, now);
  });
}

export function buildFountain() {
  const group = new THREE.Group();
  group.name = 'fountain';
  // Outdoor mesh is public/models/fountain/fountain.obj (Blender Object_Fountain_2026-09-12).
  const bundled = getBundledLook('fountain');
  if (bundled) {
    const target = buildProceduralFountain();
    group.add(wrapBundledProp(bundled, target, { name: 'fountain-body', fit: 'height' }));
  } else {
    for (const child of buildProceduralFountain().children.slice()) {
      group.add(child);
    }
  }
  mountFountainWater(group);
  return group;
}

export function mountFountainWater(group) {
  const box = measureVisibleBox(group);
  const height = Math.max(0.2, box.max.y - box.min.y);
  addFountainWater(group, {
    topY: box.max.y,
    basinY: box.min.y + height * 0.3,
  });
}

function buildProceduralFountain() {
  const group = new THREE.Group();
  group.name = 'fountain';
  const stone = cobbleMat(1.1, 0.7);
  const basin = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.28, 14), stone));
  basin.position.y = 0.16;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshStandardMaterial({
      color: 0x6aa8c8,
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.31;
  group.add(water);
  const stem = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 10), stone));
  stem.position.y = 0.48;
  group.add(stem);
  const bowl = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.1, 12), stone));
  bowl.position.y = 0.78;
  group.add(bowl);
  const spout = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x9fd0e8, roughness: 0.18, transparent: true, opacity: 0.7 }),
  );
  spout.position.y = 0.9;
  group.add(spout);
  return group;
}

function addFountain(root, x, z) {
  const group = buildFountain();
  group.position.set(x, 0, z);
  root.add(group);
  return group;
}

const FLOWER_TINTS = [0xffffff, 0xffb7c8, 0xffd56a, 0xf3efe6, 0xd98ad4, 0xff8a5b];

function buildFlowerCluster(rand) {
  const target = buildProceduralFlowerCluster(rand);
  const bundled = getBundledLook('flowers');
  if (bundled) {
    return wrapBundledProp(bundled, target, { name: 'flowers', fit: 'max' });
  }
  return target;
}

function meshTint(material) {
  const mat = Array.isArray(material) ? material[0] : material;
  return mat?.color ?? new THREE.Color(1, 1, 1);
}

/** One grounded flower, vertex colours baked, ready to instance. */
function flowerGeometry(rand) {
  const visual = buildFlowerCluster(rand);
  // Keep the fitted wrapper scale. Zeroing it restores the raw dump, which is metres wide.
  visual.updateMatrixWorld(true);
  const pieces = [];
  visual.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (child.material && child.material.visible === false) return;
    const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    source.applyMatrix4(child.matrixWorld);
    const position = source.getAttribute('position');
    if (!position) return;
    if (!source.getAttribute('normal')) source.computeVertexNormals();
    const tint = meshTint(child.material);
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', position.clone());
    next.setAttribute('normal', source.getAttribute('normal').clone());
    next.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(next);
    source.dispose();
  });
  if (!pieces.length) return null;
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((geo) => geo.dispose());
  if (!merged) return null;
  merged.computeBoundingBox();
  const box = merged.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);
  merged.translate(-center.x, -box.min.y, -center.z);
  return merged;
}

function addGrassFlowers(root, expansionIds) {
  const spots = gardenFlowerSpots(expansionIds);
  const geometry = flowerGeometry(randAt(8801));
  if (!spots.length || !geometry) return;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  mesh.name = 'flowers';
  mesh.userData.kind = 'decor';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < spots.length; i += 1) {
    const spot = spots[i];
    dummy.position.set(spot.x, GRASS_PLANE_Y, spot.z);
    dummy.rotation.set(0, spot.yaw, 0);
    dummy.scale.setScalar(spot.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(FLOWER_TINTS[spot.tint % FLOWER_TINTS.length]);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  root.add(mesh);
}

function buildProceduralFlowerCluster(rand) {
  const group = new THREE.Group();
  group.name = 'flowers';
  const colors = [0xc45a32, 0xe3b34a, 0xd7c09a, 0x8a3a6a, 0xf0e2c4];
  const count = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i += 1) {
    const stem = addShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.16, 5),
      new THREE.MeshStandardMaterial({ color: 0x3a7a32, roughness: 0.9 }),
    ));
    const x = (rand() - 0.5) * 0.55;
    const z = (rand() - 0.5) * 0.55;
    stem.position.set(x, 0.08, z);
    group.add(stem);
    const blossom = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + rand() * 0.02, 6, 5),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(rand() * colors.length)], roughness: 0.7 }),
    ));
    blossom.position.set(x, 0.18, z);
    group.add(blossom);
  }
  return group;
}

function addGarden(root, cells, expansionIds = []) {
  const grass = gardenBox(expansionIds);
  const grassW = grass.maxX - grass.minX;
  const grassD = grass.maxZ - grass.minZ;
  const grassMesh = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry(grassW, grassD),
    grassGroundMat(),
  ));
  grassMesh.name = 'grass-ground';
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.set((grass.minX + grass.maxX) / 2, -0.02, (grass.minZ + grass.maxZ) / 2);
  grassMesh.userData.kind = 'ground';
  root.add(grassMesh);

  addCobblePath(root, expansionIds);
  if (keepFountain(expansionIds)) addFountain(root, FOUNTAIN.x, FOUNTAIN.z);

  const rand = randAt(1337 + cells.length * 17);
  resetPlantedTrunks();
  for (const spot of gardenTreeSpots(expansionIds)) {
    const vary = 1 + (rand() * 2 - 1) * TREE_SCALE_SPREAD;
    const tree = buildTree(vary);
    tree.position.set(spot.x, OUTDOOR_GROUND_Y, spot.z);
    tree.rotation.y = rand() * Math.PI * 2;
    seatTreeOnGround(tree);
    const trunkRadius = measureTrunkRadius(tree);
    tree.userData.gardenSide = spot.side;
    tree.userData.uniformScale = vary;
    tree.userData.trunkRadius = trunkRadius;
    notePlantedTrunk(spot.x, spot.z, trunkRadius);
    attachTreePick(tree, spot);
    attachTreeStump(tree);
    root.add(tree);
  }
  for (const spot of gardenRockSpots(expansionIds)) {
    const rock = buildBoulder(spot.scale ?? 1);
    rock.position.set(spot.x, 0, spot.z);
    rock.rotation.y = rand() * Math.PI * 2;
    sitVisibleOnY(rock, 0);
    root.add(rock);
  }
  const hatch = gardenTrapdoorSpot(expansionIds);
  if (hatch) {
    const door = buildTrapdoor();
    door.position.set(hatch.x, 0, hatch.z);
    root.add(door);
  }
  addLushGrass(root, grass, expansionIds, rand);
  addGrassFlowers(root, expansionIds);
}

/** Metres of ground covered by one seamless fountain_cobble tile. */
export const FOUNTAIN_COBBLE_TILE_M = 0.75;
const FOUNTAIN_COBBLE_FILE = 'fountain_cobble_512.png';

/** Vite public/ root, plus raw-repo / githack paths that still include public/. */
export function fountainCobbleTextureUrls() {
  const raw = assetBaseUrl();
  const envBase = raw.endsWith('/') ? raw : `${raw}/`;
  const urls = [
    `${envBase}textures/${FOUNTAIN_COBBLE_FILE}`,
    `${envBase}public/textures/${FOUNTAIN_COBBLE_FILE}`,
  ];
  if (envBase !== './') {
    urls.push(`./textures/${FOUNTAIN_COBBLE_FILE}`, `./public/textures/${FOUNTAIN_COBBLE_FILE}`);
  }
  return [...new Set(urls)];
}

let fountainCobbleSource = null;
const fountainCobbleClones = [];

function configureFountainCobbleTexture(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.userData.kind = 'fountain-cobble';
  return tex;
}

function applyFountainCobbleImage(loaded) {
  if (!fountainCobbleSource || !loaded?.image) return;
  fountainCobbleSource.image = loaded.image;
  fountainCobbleSource.needsUpdate = true;
  for (const tex of fountainCobbleClones) {
    tex.image = loaded.image;
    tex.needsUpdate = true;
  }
  fountainCobbleClones.length = 0;
}

function beginFountainCobbleLoad() {
  const urls = fountainCobbleTextureUrls();
  const attempt = (index) => {
    if (index >= urls.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.load(urls[index], applyFountainCobbleImage, undefined, () => attempt(index + 1));
    } catch {
      // Node tests stub document without an image element. Wrap and repeat still apply.
    }
  };
  attempt(0);
}

function fountainCobbleMap() {
  if (!fountainCobbleSource) {
    fountainCobbleSource = configureFountainCobbleTexture(new THREE.Texture());
    beginFountainCobbleLoad();
  }
  const tex = configureFountainCobbleTexture(fountainCobbleSource.clone());
  if (fountainCobbleSource.image) {
    tex.image = fountainCobbleSource.image;
    tex.needsUpdate = true;
  } else {
    fountainCobbleClones.push(tex);
  }
  return tex;
}

function fountainCobbleMat(repeatX, repeatY, offsetX = 0, offsetY = 0) {
  const map = fountainCobbleMap();
  map.repeat.set(repeatX, repeatY);
  map.offset.set(offsetX, offsetY);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.03,
    color: 0xffffff,
  });
  mat.userData.fountainCobble = true;
  return mat;
}

/**
 * Plane and ring UVs both span 0..1 across their world extent. Repeat is that
 * extent divided by the tile so stones stay square, and the offset locks every
 * piece to the same world grid (texture V grows toward -Z after the ground tilt).
 */
function fountainCobbleGroundMat(spanX, spanZ, minX, maxZ) {
  const tile = FOUNTAIN_COBBLE_TILE_M;
  return fountainCobbleMat(spanX / tile, spanZ / tile, minX / tile, -maxZ / tile);
}

function addPathRect(root, minX, maxX, minZ, maxZ) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 0.05 || d < 0.05) return;
  const mesh = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    fountainCobbleGroundMat(w, d, minX, maxZ),
  ));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, -0.008, (minZ + maxZ) / 2);
  mesh.userData.kind = 'ground';
  mesh.userData.pathCobble = true;
  root.add(mesh);
}

function addCobblePath(root, expansionIds = []) {
  const span = cobblePathSpan(expansionIds);
  if (span.maxZ <= span.minZ) return;
  const fountainOn = keepFountain(expansionIds)
    && FOUNTAIN.z > span.minZ + 1.1
    && FOUNTAIN.z < span.maxZ - 1.1;
  const apron = FOUNTAIN.apron ?? 1.42;
  if (fountainOn) {
    const tuck = cobbleRingTuck(apron, (span.maxX - span.minX) / 2);
    addPathRect(root, span.minX, span.maxX, span.minZ, FOUNTAIN.z - apron + tuck);
    addPathRect(root, span.minX, span.maxX, FOUNTAIN.z + apron - tuck, span.maxZ);
    const ring = addShadow(new THREE.Mesh(
      new THREE.RingGeometry(FOUNTAIN.radius + 0.04, apron, 28),
      fountainCobbleGroundMat(apron * 2, apron * 2, FOUNTAIN.x - apron, FOUNTAIN.z + apron),
    ));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(FOUNTAIN.x, -0.006, FOUNTAIN.z);
    ring.userData.kind = 'ground';
    ring.userData.fountainApron = true;
    root.add(ring);
  } else {
    addPathRect(root, span.minX, span.maxX, span.minZ, span.maxZ);
  }
}

function buildBoulder(scale = 1) {
  const target = buildProceduralGardenRock(scale);
  const bundled = getBundledLook('rock');
  if (bundled) {
    return wrapBundledProp(bundled, target, { name: 'rock', fit: 'max' });
  }
  return target;
}

function buildProceduralGardenRock(scale = 1) {
  const group = new THREE.Group();
  group.name = 'rock';
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.94 });
  const body = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * scale, 0), stone));
  body.scale.set(1.15, 0.72, 1);
  body.position.y = 0.14 * scale;
  group.add(body);
  const bump = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 6, 5), stone));
  bump.position.set(0.1 * scale, 0.16 * scale, -0.06 * scale);
  group.add(bump);
  return group;
}

function markTrapdoorMesh(mesh) {
  mesh.userData.kind = 'trapdoor';
  return mesh;
}

function trapdoorFitTarget() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95));
  mesh.position.y = 0.08;
  return mesh;
}

function attachTrapdoorPick(root) {
  const pick = markTrapdoorMesh(new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 2.2),
    pickMat(),
  ));
  pick.position.y = 0.55;
  root.add(pick);
  return pick;
}

function buildTrapdoor() {
  const bundled = getBundledLook('trapdoor');
  if (bundled) {
    const fitted = wrapBundledProp(bundled, trapdoorFitTarget(), { name: 'trapdoor', fit: 'max' });
    fitted.name = 'trapdoor';
    sitVisibleOnY(fitted, 0);
    markTrapdoorMesh(fitted);
    fitted.traverse((child) => {
      if (child.isMesh) markTrapdoorMesh(child);
    });
    const group = new THREE.Group();
    group.name = 'trapdoor';
    group.add(fitted);
    attachTrapdoorPick(group);
    return group;
  }
  return buildProceduralTrapdoor();
}

function buildProceduralTrapdoor() {
  const group = new THREE.Group();
  group.name = 'trapdoor';
  const frame = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), wood(0x3f2716)));
  frame.position.y = 0.04;
  group.add(markTrapdoorMesh(frame));
  const door = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.72), wood(0x6a4324)));
  door.position.set(0, 0.08, 0.08);
  door.rotation.x = -0.28;
  group.add(markTrapdoorMesh(door));
  const hinge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.06), metal(0xb08a3c)));
  hinge.position.set(0, 0.09, -0.34);
  group.add(hinge);
  const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10), metal(0xb08a3c)));
  ring.position.set(0, 0.12, 0.22);
  group.add(ring);
  attachTrapdoorPick(group);
  return group;
}

function addLushGrass(root, grass, expansionIds, rand) {
  const clusters = gardenGrassClusters(expansionIds);
  const bladeGeo = new THREE.ConeGeometry(0.016, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  const greens = [
    new THREE.MeshStandardMaterial({
      color: 0x3a7a30,
      roughness: 0.92,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x4a8a38,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x2e6828,
      roughness: 0.94,
      side: THREE.DoubleSide,
    }),
  ];
  const dummy = new THREE.Object3D();
  const tip = new THREE.Vector3();
  const buckets = greens.map(() => []);
  for (const cluster of clusters) {
    const n = cluster.blades;
    for (let i = 0; i < n; i += 1) {
      const x = cluster.x + (rand() - 0.5) * 0.4;
      const z = cluster.z + (rand() - 0.5) * 0.4;
      if (!keepGardenSpot({ x, z, side: 'edge' }, expansionIds)) continue;
      if (pointHitsTrapdoor(x, z)) continue;
      const h = (0.14 + rand() * 0.46) * cluster.scale;
      dummy.position.set(x, 0, z);
      dummy.rotation.set((rand() - 0.5) * 0.38, rand() * Math.PI * 2, (rand() - 0.5) * 0.48);
      dummy.scale.set(0.65 + rand() * 0.55, h, 0.65 + rand() * 0.55);
      dummy.updateMatrix();
      tip.set(0, 1, 0).applyMatrix4(dummy.matrix);
      if (segmentHitsTrapdoor(x, z, tip.x, tip.z, 0.55)) continue;
      buckets[Math.floor(rand() * buckets.length)].push(dummy.matrix.clone());
    }
  }
  void grass;
  for (let i = 0; i < buckets.length; i += 1) {
    const mats = buckets[i];
    if (!mats.length) continue;
    const mesh = new THREE.InstancedMesh(bladeGeo, greens[i], mats.length);
    mesh.name = 'grass';
    mesh.userData.kind = 'grass';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (let j = 0; j < mats.length; j += 1) mesh.setMatrixAt(j, mats[j]);
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }
}

export function buildShop(expansionIds = []) {
  const root = new THREE.Group();
  root.name = 'stall';
  const roofs = new THREE.Group();
  roofs.name = 'roofs';
  const grounds = new THREE.Group();
  grounds.name = 'grounds';
  const pads = new THREE.Group();
  pads.name = 'expand-pads';

  const cells = occupiedCells(expansionIds);
  addGarden(root, cells, expansionIds);

  for (const cell of cells) {
    const c = roomCenter(cell.gx, cell.gz);
    const isOrigin = cell.gx === 0 && cell.gz === 0;
    const neigh = neighborsOf(cell.gx, cell.gz, expansionIds);
    addFloor(root, c, cell);
    addBeams(root, c);
    addRoomWalls(root, cell, neigh, isOrigin);
    addRoofForRoom(roofs, c, neigh, isOrigin);
    if (isOrigin) addOriginDecor(root, c);
    else addRoomTorches(root, c, neigh);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      pickMat(),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(c.x, 0.09, c.z);
    ground.userData.kind = 'ground';
    grounds.add(ground);
  }

  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const door = doorwayFloor(cells[i], cells[j]);
      if (!door) continue;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(door.maxX - door.minX, door.maxZ - door.minZ),
        pickMat(),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (door.minX + door.maxX) / 2,
        0.095,
        (door.minZ + door.maxZ) / 2,
      );
      mesh.userData.kind = 'ground';
      grounds.add(mesh);
    }
  }

  const grass = gardenBox(expansionIds);
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(grass.maxX - grass.minX, grass.maxZ - grass.minZ),
    pickMat(),
  );
  yard.rotation.x = -Math.PI / 2;
  yard.position.set((grass.minX + grass.maxX) / 2, 0.02, (grass.minZ + grass.maxZ) / 2);
  yard.userData.kind = 'ground';
  grounds.add(yard);

  for (const pad of EXPANSION_PADS) {
    if (expansionIds.includes(pad.id)) continue;
    const c = roomCenter(pad.gx, pad.gz);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W - 0.6, ROOM_D - 0.6),
      new THREE.MeshBasicMaterial({
        color: 0xe3b34a,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(c.x, 0.12, c.z);
    mesh.userData.kind = 'expand-pad';
    mesh.userData.padId = pad.id;
    mesh.userData.connects = padConnects(pad, expansionIds);
    pads.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.85, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf0d27a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.13, c.z);
    pads.add(ring);
  }

  return { root, roofs, grounds, pads };
}

const ORE_ROCK_BASE = 0x6e5a32;
const ORE_VEIN_COLOR = {
  bronze: 0xb56a28,
  iron: 0x8d939a,
  steel: 0xd4dbe2,
  mithril: 0x2458a6,
  adamant: METALS.find((metal) => metal.id === 'adamant')?.tint ?? 0x3a8a45,
  runite: 0x8fd4f5,
  dragon: 0xd41e1e,
};

/** Visible top of the dungeon cobble slab. Ore rocks sit on this plane. */
export const DUNGEON_FLOOR_Y = 0.02;
/** Tuck bases into the cobble so a lit edge does not read as a gap. */
export const DUNGEON_ROCK_SINK = 0.015;
/**
 * Seat this far up the rock, not on a single dangling vertex. The dumps rest
 * on one low point while the underside the player sees is higher.
 */
const DUNGEON_ROCK_BASE_QUANTILE = 0.2;

/** Previous essence xz — a second skeleton slump sits here after essence moved to the cave middle. */
export const ESSENCE_OLD_XZ = { x: 0.2, z: 3.15 };

/** Mineable rocks: olive-brown body; vein colour marks the tier. */
export const DUNGEON_BOULDERS = [
  { id: 'essence', materialId: 'essence', name: 'Essence', x: 0, z: 0, rot: 0.25, scale: 2, rock: 0xb8babf, vein: 0xe8d8ff, essence: true },
  { id: 'bronze', materialId: 'bronze', name: 'Bronze Ore', x: -3.3, z: -3.15, rot: 0.5, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.bronze },
  { id: 'iron', materialId: 'iron', name: 'Iron Ore', x: 1.4, z: -3.15, rot: -0.3, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.iron },
  { id: 'steel', materialId: 'steel', name: 'Steel Ore', x: 4.05, z: -1.5, rot: 0.8, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.steel },
  { id: 'mithril', materialId: 'mithril', name: 'Mithril Ore', x: 4.05, z: 2.15, rot: -0.6, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.mithril },
  { id: 'adamant', materialId: 'adamant', name: 'Adamantite', x: -1.5, z: 3.15, rot: 1.1, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.adamant },
  { id: 'runite', materialId: 'runite', name: 'Runite', x: -4.05, z: 1.7, rot: 0.2, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.runite },
  { id: 'dragon', materialId: 'dragon', name: 'Dragon Ore', x: -4.05, z: -1.35, rot: -0.9, rock: ORE_ROCK_BASE, vein: ORE_VEIN_COLOR.dragon },
  // North wall, between the old essence skeleton and mithril — clear of the ladder and the east aisle.
  { id: 'clay', materialId: 'hard_clay', name: 'Clay', x: 1.9, z: 3.15, rot: 0.55, rock: 0x8a6230, vein: 0xc48a4a },
];

export function treeInspect() {
  return { name: 'Tree', blurb: 'An outdoor pine. Chop it for 5 Logs.' };
}

export function flaxInspect() {
  return { name: 'Flax', blurb: 'A knee-high flax plant. Left-click to walk over and pick it. You get 1 flax.' };
}

export function boulderInspect(materialId) {
  const spot = DUNGEON_BOULDERS.find((item) => item.materialId === materialId);
  if (!spot) return { name: 'Rock', blurb: 'A mineable rock.' };
  if (spot.essence) {
    return { name: 'Essence', blurb: 'A pale boulder. Mine it for Essence, used to craft runes.' };
  }
  const article = /^[aeiou]/i.test(spot.name) ? 'An' : 'A';
  return { name: spot.name, blurb: `${article} ${spot.name.toLowerCase()} boulder. Left-click to walk over and mine.` };
}

function shadeHex(hex, factor) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  return color.getHex();
}

const TREE_PICK_XZ = 0.85 * OUTDOOR_TREE_SCALE;

function attachTreePick(tree, spot) {
  tree.updateMatrixWorld(true);
  const box = measureVisibleBox(tree);
  const base = Number.isFinite(box.min.y) ? box.min.y : tree.position.y;
  const top = Number.isFinite(box.max.y) ? box.max.y : base + 1.7;
  const scaleY = Math.abs(tree.scale.y) || 1;
  const localBase = (base - tree.position.y) / scaleY;
  const height = Math.max(1.7, (top - base) / scaleY);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(TREE_PICK_XZ, height, TREE_PICK_XZ), pickMat());
  pick.position.y = localBase + height / 2;
  pick.userData.kind = 'tree';
  pick.userData.materialId = 'logs';
  pick.userData.name = 'Tree';
  pick.userData.x = spot.x;
  pick.userData.z = spot.z;
  pick.userData.trunkRadius = tree.userData.trunkRadius;
  tree.add(pick);
}

/** Short cut trunk. Hidden until the pine is felled; the crown stays the click target. */
function attachTreeStump(tree) {
  const radius = Number(tree.userData.trunkRadius) > 0
    ? tree.userData.trunkRadius
    : TREE_TRUNK_RADIUS;
  const height = 0.36;
  const stump = new THREE.Group();
  stump.name = 'tree-stump';
  const bark = new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.94 });
  const cut = new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 0.78 });
  const body = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.35, height, 8),
    bark,
  ));
  body.position.y = height / 2;
  stump.add(body);
  const face = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.025, 8),
    cut,
  ));
  face.position.y = height + 0.01;
  stump.add(face);
  stump.visible = false;
  tree.add(stump);
}

function attachBoulderPick(group, spot) {
  const s = spot.scale ?? 1;
  const pick = new THREE.Mesh(new THREE.BoxGeometry(1.35 * s, 1.05 * s, 1.35 * s), pickMat());
  pick.position.y = 0.48 * s;
  pick.userData.kind = 'boulder';
  pick.userData.materialId = spot.materialId;
  pick.userData.name = spot.name;
  pick.userData.x = spot.x;
  pick.userData.z = spot.z;
  group.add(pick);
}

function stripEmissive(root) {
  const lights = [];
  root?.traverse((child) => {
    if (child.isLight) lights.push(child);
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      const copy = mat.clone();
      if (copy.emissive) copy.emissive.setHex(0x000000);
      if ('emissiveIntensity' in copy) copy.emissiveIntensity = 0;
      copy.emissiveMap = null;
      if ('envMapIntensity' in copy) copy.envMapIntensity = 0;
      return copy;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
  for (const light of lights) light.parent?.remove(light);
}

function oreFitTarget(spot) {
  const target = buildProceduralOreRock(spot);
  const scale = spot.scale ?? 1;
  if (scale !== 1) {
    target.scale.setScalar(scale);
    target.updateMatrixWorld(true);
  }
  return target;
}

/** Slightly darker than the dump, still blue. Other ore tiers are untouched. */
const MITHRIL_ROCK_DARKEN = 0.82;

function darkenMithrilRock(root) {
  root?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      if (!mat?.color) return mat;
      const copy = mat.clone();
      copy.color.multiplyScalar(MITHRIL_ROCK_DARKEN);
      if (copy.emissive) copy.emissive.multiplyScalar(MITHRIL_ROCK_DARKEN);
      copy.userData = { ...(mat.userData ?? {}), mithrilRockDark: true };
      return copy;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function buildMineBoulder(spot, floorY = DUNGEON_FLOOR_Y) {
  const group = new THREE.Group();
  group.name = `boulder-${spot.id}`;
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = spot.rot ?? 0;
  const target = oreFitTarget(spot);
  const bundled = getBundledLook(`ore-${spot.id}`);
  const visual = bundled
    ? wrapBundledProp(bundled, target, { name: `ore-${spot.id}`, fit: 'max' })
    : target;
  if (bundled) prepareDungeonRockMaterials(visual);
  if (bundled && spot.materialId === 'mithril') darkenMithrilRock(visual);
  group.add(visual);
  group.updateMatrixWorld(true);
  if (bundled) seatDungeonRockBases(visual, floorY);
  else sitVisibleOnY(visual, floorY - DUNGEON_ROCK_SINK);
  attachBoulderPick(group, spot);
  if (spot.essence) stripEmissive(group);
  return group;
}

/**
 * Top of the dungeon cobble slab in world Y. Measured from the floor mesh so a
 * raised tile is not mistaken for y = 0.
 */
export function dungeonFloorSurfaceY(root) {
  let top = null;
  root?.updateMatrixWorld(true);
  root?.traverse((child) => {
    const height = child.geometry?.parameters?.height;
    const width = child.geometry?.parameters?.width;
    if (!child.isMesh || !(width > 8) || !(height > 0) || height > 0.25) return;
    child.updateWorldMatrix(true, false);
    const y = new THREE.Box3().setFromObject(child).max.y;
    if (top == null || y > top) top = y;
  });
  return top ?? DUNGEON_FLOOR_Y;
}

function findParent(parent, index) {
  let cursor = index;
  while (parent[cursor] !== cursor) {
    parent[cursor] = parent[parent[cursor]];
    cursor = parent[cursor];
  }
  return cursor;
}

function uniteParent(parent, a, b) {
  const ra = findParent(parent, a);
  const rb = findParent(parent, b);
  if (ra !== rb) parent[rb] = ra;
}

/**
 * RuneLite dumps pack every rock at a site — full ore, clay, essence, and the
 * depleted stubs — into one mesh, and those pieces do not share a floor height.
 * After the fit scale, drop each piece so its underside meets the cobble. A
 * single low vertex is allowed to tuck into the floor; seating only that point
 * leaves the face the player sees hovering.
 */
export function seatDungeonRockBases(visual, floorY = DUNGEON_FLOOR_Y) {
  const parts = collectDungeonRockParts(visual);
  if (!parts.length || !Number.isFinite(floorY)) return visual;
  const target = floorY - DUNGEON_ROCK_SINK;
  const inverse = new Map();
  const moved = new Set();
  const world = new THREE.Vector3();
  for (const part of parts) {
    const dy = target - part.contactY;
    if (Math.abs(dy) < 1e-5) continue;
    for (const sample of part.samples) {
      const mesh = sample.mesh;
      if (!inverse.has(mesh.uuid)) inverse.set(mesh.uuid, mesh.matrixWorld.clone().invert());
      world.set(sample.x, sample.y + dy, sample.z).applyMatrix4(inverse.get(mesh.uuid));
      mesh.geometry.getAttribute('position').setXYZ(sample.index, world.x, world.y, world.z);
      moved.add(mesh);
    }
  }
  for (const mesh of moved) {
    const attr = mesh.geometry.getAttribute('position');
    attr.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }
  return visual;
}

/** World Y of each separate rock's underside after the fit scale. */
export function dungeonRockContactMins(visual) {
  return collectDungeonRockParts(visual).map((part) => part.contactY);
}

function collectDungeonRockParts(visual) {
  if (!visual) return [];
  let top = visual;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  const meshes = [];
  visual.traverse((child) => {
    if (!child.isMesh || !child.geometry?.getAttribute?.('position')) return;
    if (child.userData?.kind === 'boulder') return;
    if (child.material?.visible === false) return;
    if (!child.userData.rockGeometryOwned) {
      child.geometry = child.geometry.clone();
      child.userData.rockGeometryOwned = true;
    }
    meshes.push(child);
  });
  const samples = [];
  const ids = new Map();
  const weld = new Map();
  const world = new THREE.Vector3();
  for (const mesh of meshes) {
    const attr = mesh.geometry.getAttribute('position');
    for (let index = 0; index < attr.count; index += 1) {
      world.fromBufferAttribute(attr, index).applyMatrix4(mesh.matrixWorld);
      const sample = { mesh, index, x: world.x, y: world.y, z: world.z };
      const id = samples.length;
      samples.push(sample);
      ids.set(`${mesh.uuid}:${index}`, id);
      const key = `${Math.round(world.x * 1000)}:${Math.round(world.y * 1000)}:${Math.round(world.z * 1000)}`;
      if (!weld.has(key)) weld.set(key, []);
      weld.get(key).push(id);
    }
  }
  if (!samples.length) return [];
  const parent = samples.map((_, index) => index);
  for (const group of weld.values()) {
    for (let i = 1; i < group.length; i += 1) uniteParent(parent, group[0], group[i]);
  }
  for (const mesh of meshes) {
    const index = mesh.geometry.index;
    const count = index ? index.count : mesh.geometry.getAttribute('position').count;
    const vert = (n) => (index ? index.getX(n) : n);
    for (let tri = 0; tri + 2 < count; tri += 3) {
      const a = ids.get(`${mesh.uuid}:${vert(tri)}`);
      const b = ids.get(`${mesh.uuid}:${vert(tri + 1)}`);
      const c = ids.get(`${mesh.uuid}:${vert(tri + 2)}`);
      if (a == null || b == null || c == null) continue;
      uniteParent(parent, a, b);
      uniteParent(parent, b, c);
    }
  }
  const groups = new Map();
  samples.forEach((sample, index) => {
    const root = findParent(parent, index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(sample);
  });
  return [...groups.values()]
    .map((group) => partBounds(group))
    .filter((part) => part.samples.length >= 3);
}

function partBounds(samples) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const heights = [];
  for (const sample of samples) {
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minY = Math.min(minY, sample.y);
    maxY = Math.max(maxY, sample.y);
    minZ = Math.min(minZ, sample.z);
    maxZ = Math.max(maxZ, sample.z);
    heights.push(sample.y);
  }
  heights.sort((a, b) => a - b);
  const index = Math.min(
    heights.length - 1,
    Math.max(0, Math.round((heights.length - 1) * DUNGEON_ROCK_BASE_QUANTILE)),
  );
  return {
    samples,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    contactY: heights[index],
  };
}

function buildProceduralOreRock(spot) {
  const group = new THREE.Group();
  group.name = `ore-${spot.id}`;
  const rockHex = spot.rock ?? 0xb8babf;
  const rock = new THREE.MeshStandardMaterial({
    color: rockHex,
    roughness: 0.94,
    metalness: 0.12,
  });
  const mottled = new THREE.MeshStandardMaterial({
    color: shadeHex(rockHex, 0.72),
    roughness: 0.96,
    metalness: 0.08,
  });
  const vein = new THREE.MeshStandardMaterial({
    color: spot.vein,
    roughness: 0.55,
    metalness: 0.16,
    emissive: spot.essence ? 0x000000 : spot.vein,
    emissiveIntensity: spot.essence ? 0 : 0.22,
  });
  const body = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), rock));
  body.scale.set(1.35, 0.72, 1.15);
  body.position.y = 0.26;
  group.add(body);
  const peak = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 6), rock));
  peak.position.set(-0.08, 0.48, 0.04);
  peak.rotation.z = -0.22;
  group.add(peak);
  const peak2 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 6), mottled));
  peak2.position.set(0.18, 0.4, -0.06);
  peak2.rotation.z = 0.28;
  group.add(peak2);
  const lump = addShadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mottled));
  lump.position.set(0.22, 0.16, 0.14);
  lump.scale.set(1.05, 0.7, 0.9);
  group.add(lump);
  for (const [x, z, s] of [[-0.42, 0.18, 0.07], [0.4, -0.16, 0.055], [0.08, 0.38, 0.05]]) {
    const pebble = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mottled));
    pebble.position.set(x, s * 0.7, z);
    group.add(pebble);
  }
  for (const [x, y, z, sx, sy, sz, rx, rz] of [
    [-0.16, 0.36, 0.04, 0.22, 0.045, 0.07, 0.35, 0.7],
    [0.02, 0.32, 0.02, 0.24, 0.04, 0.065, -0.55, 0.35],
    [0.18, 0.28, -0.02, 0.2, 0.035, 0.055, 0.8, -0.45],
  ]) {
    const streak = addShadow(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), vein));
    streak.position.set(x, y, z);
    streak.rotation.set(rx, 0, rz);
    group.add(streak);
  }
  return group;
}

/** Dumped skeleton slumps only — no procedural white skull / loose-bone clutter. */
export const DUNGEON_REMAINS = [
  { kind: 'slump', x: -1.1, z: -3.4, rot: 2.1 },
  { kind: 'slump', x: 4.6, z: -2.8, rot: -1.2 },
  { kind: 'slump', x: -4.5, z: 2.6, rot: 0.8 },
  { kind: 'slump', x: ESSENCE_OLD_XZ.x, z: ESSENCE_OLD_XZ.z, rot: 1.35 },
];

function slumpFitTarget() {
  const body = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3));
  box.position.y = 0.25;
  body.add(box);
  return body;
}

function addSlumpedSkeleton(root, x, z, rot = 0) {
  const bundled = getBundledLook('skeleton');
  if (!bundled) return;
  const mesh = wrapBundledProp(bundled, slumpFitTarget(), { name: 'skeleton', fit: 'height' });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rot;
  root.add(mesh);
}

function addDungeonRemains(root) {
  for (const spot of DUNGEON_REMAINS) {
    addSlumpedSkeleton(root, spot.x, spot.z, spot.rot);
  }
}

function addDungeonWallTorches(root, W = 11, D = 9) {
  const y = 1.7;
  const inset = 0.18;
  const mounts = [
    { x: -W / 2 + inset, z: -2.2, rot: Math.PI / 2 },
    { x: -W / 2 + inset, z: 2.2, rot: Math.PI / 2 },
    { x: W / 2 - inset, z: -2.2, rot: -Math.PI / 2 },
    { x: W / 2 - inset, z: 2.2, rot: -Math.PI / 2 },
    { x: -3, z: -D / 2 + inset, rot: 0 },
    { x: 3, z: -D / 2 + inset, rot: 0 },
    { x: -3, z: D / 2 - inset, rot: Math.PI },
    { x: 3, z: D / 2 - inset, rot: Math.PI },
  ];
  for (const mount of mounts) {
    addWallTorch(root, mount.x, y, mount.z, mount.rot, DUNGEON_LIGHT_BOOST);
  }
}

/** Cobble wall height. The exit ladder is stretched to this top. */
export const DUNGEON_WALL_H = 3.4;

export function buildDungeon(opts = {}) {
  const root = new THREE.Group();
  root.name = 'dungeon';
  const grounds = new THREE.Group();
  grounds.name = 'dungeon-grounds';
  const W = 11;
  const D = 9;
  const H = DUNGEON_WALL_H;
  /** Top face of the cobble slab (0.12 thick, centered at y=-0.04). */
  const floor = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.12, D),
    cobbleMat(6.5, 5.2),
  ));
  floor.position.y = -0.04;
  root.add(floor);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.2, D - 0.2),
    pickMat(),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.04;
  ground.userData.kind = 'ground';
  grounds.add(ground);

  const wallMat = cobbleMat(6.5, 2.8);
  const walls = [
    { x: 0, z: -D / 2, w: W, d: 0.22 },
    { x: 0, z: D / 2, w: W, d: 0.22 },
    { x: -W / 2, z: 0, w: 0.22, d: D },
    { x: W / 2, z: 0, w: 0.22, d: D },
  ];
  for (const wall of walls) {
    const mesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(wall.w, H, wall.d), wallMat));
    mesh.position.set(wall.x, H / 2, wall.z);
    root.add(mesh);
  }

  addDungeonWallTorches(root);

  const cobweb = () => {
    const group = new THREE.Group();
    const silk = new THREE.MeshStandardMaterial({
      color: 0xe8e0d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    for (let i = 0; i < 5; i += 1) {
      const strand = new THREE.Mesh(new THREE.PlaneGeometry(0.55 - i * 0.07, 0.02), silk);
      strand.rotation.z = i * 0.4;
      strand.position.set(0.1, -i * 0.08, 0);
      group.add(strand);
    }
    return group;
  };
  const corners = [
    { x: -W / 2 + 0.3, z: -D / 2 + 0.3, rot: 0.4 },
    { x: W / 2 - 0.3, z: -D / 2 + 0.3, rot: -0.5 },
    { x: -W / 2 + 0.3, z: D / 2 - 0.3, rot: 2.2 },
    { x: W / 2 - 0.3, z: D / 2 - 0.3, rot: 3.5 },
  ];
  for (const corner of corners) {
    const web = cobweb();
    web.position.set(corner.x, 2.6, corner.z);
    web.rotation.y = corner.rot;
    root.add(web);
  }

  addDungeonRemains(root);

  root.updateMatrixWorld(true);
  const floorY = dungeonFloorSurfaceY(root);
  const boulders = DUNGEON_BOULDERS.map((spot) => {
    const boulder = buildMineBoulder(spot, floorY);
    root.add(boulder);
    return boulder;
  });

  const rats = [];
  const ratStarts = [
    [-2.8, 1.8],
    [-2.6, -1.9],
    [2.7, 1.6],
    [2.8, -1.8],
  ];
  for (let i = 0; i < ratStarts.length; i += 1) {
    const rat = buildRat(opts.riggedRat ?? null);
    rat.position.set(ratStarts[i][0], 0.06, ratStarts[i][1]);
    if (rat.userData.clipLocomotion) rat.userData.groundY = 0.06;
    initRatWander(rat, i);
    root.add(rat);
    rats.push(rat);
  }

  const ladder = buildDungeonLadder();
  ladder.position.set(-W / 2 + 0.22, 0, 0.4);
  root.add(ladder);
  ladder.updateMatrixWorld(true);
  const ladderBox = measureVisibleBox(ladder);
  if (Number.isFinite(ladderBox.min.x)) {
    const wallInner = -W / 2 + 0.11;
    ladder.position.x += wallInner + 0.02 - ladderBox.min.x;
  }

  return { root, grounds, rats, ladder, boulders, size: { w: W, d: D } };
}

export function buildRat(riggedGltf = null) {
  if (riggedGltf) {
    try {
      return wrapRiggedRat(riggedGltf);
    } catch (err) {
      console.warn('Rigged rat skipped:', err?.message || err);
    }
  }
  const bundled = getBundledLook('rat');
  const visual = bundled
    ? wrapBundledProp(bundled, buildProceduralRat(), { name: 'rat-mesh', fit: 'max', rotateY: RAT_DUMP_YAW })
    : buildProceduralRat();
  // Wander yaw lives on the root so dump facing stays baked on the child.
  const root = new THREE.Group();
  root.name = 'rat';
  root.add(visual);
  return root;
}

function buildProceduralRat() {
  const group = new THREE.Group();
  group.name = 'rat';
  const fur = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.92 });
  const body = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), fur));
  body.scale.set(1.55, 0.68, 0.92);
  body.position.set(0, 0.055, 0.01);
  body.rotation.x = 0.28;
  group.add(body);
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 6), fur));
  head.position.set(0, 0.07, 0.1);
  group.add(head);
  const snout = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 5), fur));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.062, 0.14);
  group.add(snout);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xc42828,
    emissive: 0x6a1010,
    roughness: 0.35,
  });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.018, 3), eyeMat);
    eye.name = 'cue-eye';
    eye.rotation.x = Math.PI;
    eye.position.set(side * 0.022, 0.082, 0.128);
    group.add(eye);
  }
  const tan = new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 0.86 });
  for (let i = 0; i < 4; i += 1) {
    const seg = addShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.007 - i * 0.001, 0.011 - i * 0.0012, 0.045, 5),
      tan,
    ));
    seg.name = 'cue-tail';
    seg.rotation.x = 1.05;
    seg.position.set(0, 0.04 - i * 0.006, -0.08 - i * 0.038);
    group.add(seg);
  }
  return group;
}

function markLadder(mesh) {
  mesh.userData.kind = 'ladder';
  return mesh;
}

function ladderFitTarget() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.41, 2.6, 0.1));
  mesh.position.y = 1.3;
  return mesh;
}

/** One copy at half the fitted size, so width, height, and depth stay in proportion. */
function makeProportionalLadderCopy() {
  const bundled = getBundledLook('ladder');
  const visual = bundled
    ? wrapBundledProp(bundled, ladderFitTarget(), { name: 'ladder-mesh', fit: 'max' })
    : buildProceduralDungeonLadder();
  visual.name = 'ladder-mesh';
  markLadder(visual);
  visual.traverse((child) => markLadder(child));
  visual.scale.multiplyScalar(0.5);
  sitVisibleOnY(visual, 0);
  return visual;
}

/**
 * Two half-size copies, one above the other, then one uniform scale so the
 * stack meets the wall. Rails share the same X so the joint reads as one ladder.
 */
function stackLadderToWall() {
  const lower = makeProportionalLadderCopy();
  const upper = makeProportionalLadderCopy();
  lower.updateMatrixWorld(true);
  const copyHeight = measureVisibleBox(lower).getSize(new THREE.Vector3()).y;
  upper.position.y += copyHeight;
  const stack = new THREE.Group();
  stack.name = 'ladder-stack';
  stack.add(lower);
  stack.add(upper);
  stack.updateMatrixWorld(true);
  const stacked = measureVisibleBox(stack).getSize(new THREE.Vector3()).y;
  if (stacked > 1e-4) stack.scale.multiplyScalar(DUNGEON_WALL_H / stacked);
  sitVisibleOnY(stack, 0);
  return stack;
}

export function buildDungeonLadder() {
  const stack = stackLadderToWall();
  stack.updateMatrixWorld(true);
  const width = measureVisibleBox(stack).getSize(new THREE.Vector3()).x;
  const ladder = new THREE.Group();
  ladder.name = 'ladder';
  ladder.add(stack);
  ladder.add(makeLadderPick(width));
  markLadder(ladder);
  // Dump and rails are wide in X; yaw so the face sits flat on the west wall.
  ladder.rotation.y = Math.PI / 2;
  return ladder;
}

function makeLadderPick(width) {
  const pick = markLadder(new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.12, width), DUNGEON_WALL_H, 0.7),
    pickMat(),
  ));
  pick.name = 'ladder-pick';
  pick.position.set(0, DUNGEON_WALL_H / 2, 0.12);
  return pick;
}

function buildProceduralDungeonLadder() {
  const group = new THREE.Group();
  group.name = 'ladder-mesh';
  const rail = wood(0x5a3a22);
  for (const x of [-0.18, 0.18]) {
    const post = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), rail));
    post.position.set(x, 1.3, 0);
    group.add(markLadder(post));
  }
  for (let i = 0; i < 8; i += 1) {
    const rung = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.05), rail));
    rung.position.set(0, 0.28 + i * 0.3, 0.02);
    group.add(markLadder(rung));
  }
  return group;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}
