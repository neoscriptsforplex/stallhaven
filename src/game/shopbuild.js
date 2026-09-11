import * as THREE from 'three';
import {
  EXPANSION_PADS,
  FOUNTAIN,
  PATH_START_Z,
  ROOM_D,
  ROOM_W,
  cobblePathSpan,
  gardenBox,
  gardenRockSpots,
  gardenTrapdoorSpot,
  gardenTreeSpots,
  keepFountain,
  neighborsOf,
  occupiedCells,
  padConnects,
  roomCenter,
  wallVineMounts,
} from './layout.js';
import { initRatWander } from './rats.js';

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

const COBBLE_U = 4.2 / ROOM_W;
const COBBLE_V = 2.6 / 2.7;

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

function cobbleSlabMat(alongSize, height, along0, y0) {
  return cobbleMat(
    Math.max(0.08, alongSize * COBBLE_U),
    Math.max(0.08, height * COBBLE_V),
    along0 * COBBLE_U,
    y0 * COBBLE_V,
  );
}

function addWallSlab(root, mat, x, y, z, sx, sy, sz, uvAlong = null, uvY = null) {
  if (sx < 0.03 || sy < 0.03 || sz < 0.03) return;
  const slabMat = uvAlong == null
    ? mat
    : cobbleSlabMat(uvAlong.size, sy, uvAlong.origin - uvAlong.size / 2, (uvY ?? y) - sy / 2);
  const mesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), slabMat));
  mesh.position.set(x, y, z);
  root.add(mesh);
}

function addWallWithWindow(root, mat, {
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
      mat,
      axis === 'x' ? along : x,
      cy,
      axis === 'x' ? z : along,
      axis === 'x' ? sw : t,
      sh,
      axis === 'x' ? t : sw,
      { origin: along, size: sw },
      cy,
    );
  };
  place(left + (winL - left) / 2, y, winL - left, h);
  place(winR + (right - winR) / 2, y, right - winR, h);
  place(winAlong, bottom + (winB - bottom) / 2, winW, winB - bottom);
  place(winAlong, winT + (top - winT) / 2, winW, top - winT);
}

function addWallWithDoor(root, mat, {
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
      mat,
      axis === 'x' ? along : x,
      cy,
      axis === 'x' ? z : along,
      axis === 'x' ? sw : t,
      sh,
      axis === 'x' ? t : sw,
      { origin: along, size: sw },
      cy,
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
  const group = new THREE.Group();
  group.name = 'torch';
  const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 6), wood(0x5a3a22)));
  shaft.position.y = 0.12;
  group.add(shaft);
  const wrap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8), metal(0xb08a3c)));
  wrap.position.y = 0.3;
  group.add(wrap);
  const flame = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 7), flameMat()));
  flame.position.y = 0.42;
  group.add(flame);
  const glow = new THREE.PointLight(0xff9a3a, 1.15, 4.5, 2);
  glow.position.y = 0.46;
  group.add(glow);
  return group;
}

function addWallTorch(root, x, y, z, rotY = 0) {
  const torch = buildTorch();
  torch.position.set(x, y, z);
  torch.rotation.y = rotY;
  torch.rotation.z = 0.55;
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

function woodFloorMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6a4a2c';
  ctx.fillRect(0, 0, 256, 64);
  let seed = 3181;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 40; i += 1) {
    const y = rand() * 64;
    ctx.strokeStyle = `rgba(${90 + rand() * 40}, ${50 + rand() * 24}, ${20 + rand() * 16}, ${0.18 + rand() * 0.22})`;
    ctx.lineWidth = 0.8 + rand();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + (rand() - 0.5) * 8, 160, y + (rand() - 0.5) * 8, 256, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40, 24, 12, 0.35)';
  ctx.fillRect(0, 0, 256, 3);
  ctx.fillRect(0, 61, 256, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function addFloor(root, center) {
  const base = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_W, 0.08, ROOM_D),
    wood(0x5a3a22, 0.92),
  ));
  base.position.set(center.x, 0.04, center.z);
  root.add(base);
  const plankW = 0.28;
  const count = Math.ceil(ROOM_D / plankW);
  for (let i = 0; i < count; i += 1) {
    const map = woodFloorMap();
    map.repeat.set(ROOM_W / 1.4, 1);
    const mat = new THREE.MeshStandardMaterial({
      map,
      color: i % 2 ? 0xc4a070 : 0xb48a58,
      roughness: 0.88,
      metalness: 0.04,
    });
    const plank = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_W - 0.18, 0.025, plankW - 0.03),
      mat,
    ));
    const z = center.z - ROOM_D / 2 + plankW * 0.5 + i * plankW;
    plank.position.set(center.x, 0.085, z);
    root.add(plank);
  }
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

function addRoofForRoom(roofs, walls, center, neigh = {}, isOrigin = false) {
  const group = new THREE.Group();
  group.position.copy(new THREE.Vector3(center.x, 0, center.z));
  const thatch = new THREE.MeshStandardMaterial({
    color: 0x6b3a24,
    roughness: 0.92,
    metalness: 0.02,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });
  const tilt = 0.42;
  const roofSpan = ROOM_W / 2 + 0.45;
  const rise = (roofSpan / 2) * Math.sin(tilt);
  const eaveY = 2.82;
  const ridgeY = eaveY + rise * 2;
  const slope = addShadow(new THREE.Mesh(new THREE.BoxGeometry(roofSpan, 0.1, ROOM_D + 0.55), thatch));
  slope.position.set(-ROOM_W / 4, eaveY + rise, 0);
  slope.rotation.z = tilt;
  group.add(slope);
  const slope2 = slope.clone();
  slope2.position.x = ROOM_W / 4;
  slope2.rotation.z = -tilt;
  group.add(slope2);
  const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, ROOM_D + 0.4), wood(0x3c2616)));
  ridge.position.set(0, ridgeY, 0);
  group.add(ridge);
  const rafter = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 0.2, 0.12, 0.12), wood(0x3c2616)));
  rafter.position.set(0, 2.55, 0);
  group.add(rafter);
  roofs.add(group);
  addRoofGables(walls, center, neigh, ridgeY);
  return group;
}

function addRoofGables(root, center, neigh, ridgeY) {
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
    const mat = cobbleMat(width * COBBLE_U, Math.max(0.45, height * 1.05));
    const mesh = addShadow(new THREE.Mesh(geo, mat));
    mesh.position.set(end.x, wallTop, end.z);
    mesh.rotation.y = end.rotY;
    root.add(mesh);
  }
}

function addOriginFront(root, center) {
  const beam = wood(0x3c2616, 0.78);
  const doorHalf = 0.58;
  const lintel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 + 0.36, 0.38, 0.22), beam));
  lintel.position.set(center.x, 2.52, center.z + ROOM_D / 2);
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
  const awning = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.06, 1.7), cloth(0x8b4336)));
  awning.position.set(center.x, 2.32, center.z + ROOM_D / 2 + 0.47);
  awning.rotation.x = -0.18;
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
  const fascia = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_W + 0.12, 0.16, 0.28),
    cobbleMat(4.2, 0.4),
  ));
  fascia.position.set(center.x, 2.78, center.z + ROOM_D / 2 + 0.02);
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

function addOriginDecor(root, center) {
  const rug = buildRug();
  rug.position.set(center.x, 0.11, center.z + 0.15);
  root.add(rug);

  addWallVines(root, center);

  addWallTorch(root, center.x - ROOM_W / 2 + 0.18, 1.62, center.z - 1.85, Math.PI / 2);
  addWallTorch(root, center.x - ROOM_W / 2 + 0.18, 1.62, center.z + 1.85, Math.PI / 2);
  addWallTorch(root, center.x + ROOM_W / 2 - 0.18, 1.62, center.z - 1.85, -Math.PI / 2);
  addWallTorch(root, center.x + ROOM_W / 2 - 0.18, 1.62, center.z + 1.85, -Math.PI / 2);
}

function addRoomWalls(root, cell, neigh, isOrigin) {
  const c = roomCenter(cell.gx, cell.gz);
  const stoneFront = cobbleMat(4.2, 2.6);
  const stoneSide = cobbleMat(7.2, 2.6);
  const stoneBack = cobbleMat(8.2, 2.6);
  const h = 2.7;
  const t = 0.16;
  const y = 1.4;
  const leftX = c.x - ROOM_W / 2;
  const rightX = c.x + ROOM_W / 2;
  const backZ = c.z - ROOM_D / 2;
  const frontZ = c.z + ROOM_D / 2;

  if (!neigh.left) {
    addWallWithWindow(root, stoneSide, {
      x: leftX, y, z: c.z, w: ROOM_D, h, t, axis: 'z',
      winAlong: c.z, winY: 1.42, winW: 0.86, winH: 0.95,
    });
    addShopWindow(root, { x: leftX + 0.02, y: 1.42, z: c.z, rotY: Math.PI / 2 });
  }

  if (neigh.right) {
    addWallWithDoor(root, stoneSide, {
      x: rightX, y, z: c.z, w: ROOM_D, h, t, axis: 'z', doorAlong: c.z,
    });
  } else {
    addWallWithWindow(root, stoneSide, {
      x: rightX, y, z: c.z, w: ROOM_D, h, t, axis: 'z',
      winAlong: c.z, winY: 1.42, winW: 0.86, winH: 0.95,
    });
    addShopWindow(root, { x: rightX - 0.02, y: 1.42, z: c.z, rotY: -Math.PI / 2 });
  }

  if (neigh.back) {
    addWallWithDoor(root, stoneBack, {
      x: c.x, y, z: backZ, w: ROOM_W, h, t, axis: 'x', doorAlong: c.x,
    });
  } else {
    const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, h, t), stoneBack));
    back.position.set(c.x, y, backZ);
    root.add(back);
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
      addWallWithWindow(root, stoneFront, {
        x: c.x - ROOM_W / 2 + wallSpan / 2, y, z: frontZ, w: wallSpan, h, t, axis: 'x',
        winAlong: c.x - 1.48, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addWallWithWindow(root, stoneFront, {
        x: c.x + ROOM_W / 2 - wallSpan / 2, y, z: frontZ, w: wallSpan, h, t, axis: 'x',
        winAlong: c.x + 1.48, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addShopWindow(root, { x: c.x - 1.48, y: 1.42, z: frontZ - 0.08 });
      addShopWindow(root, { x: c.x + 1.48, y: 1.42, z: frontZ - 0.08 });
      addOriginFront(root, c);
    } else {
      addWallWithWindow(root, stoneFront, {
        x: c.x - ROOM_W / 4, y, z: frontZ, w: ROOM_W / 2, h, t, axis: 'x',
        winAlong: c.x - ROOM_W / 4, winY: 1.42, winW: 0.82, winH: 0.95,
      });
      addWallWithWindow(root, stoneFront, {
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
    new THREE.BoxGeometry(2.35, 0.025, 1.55),
    new THREE.MeshStandardMaterial({ map, roughness: 0.95 }),
  );
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

export function buildRange() {
  const group = new THREE.Group();
  group.name = 'range';
  const iron = metal(0x4a4e54);
  const brick = new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.88 });
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.46), brick));
  body.position.y = 0.32;
  group.add(body);
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.5), iron));
  top.position.y = 0.6;
  group.add(top);
  const door = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.04), iron));
  door.position.set(0, 0.3, 0.24);
  group.add(door);
  const handle = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.03), metal(0xb08a3c)));
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
  const group = new THREE.Group();
  group.name = 'cauldron';
  const iron = metal(0x3a4248);
  const dark = metal(0x1c2226);
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
  const group = new THREE.Group();
  group.name = 'furnace';
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.92, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.88, metalness: 0.12 });
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.62), stone));
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
  const chimney = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), stone));
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

export function buildSpinningWheel() {
  const group = new THREE.Group();
  group.name = 'wheel';
  const oak = wood(0x6b4423);
  const dark = wood(0x3e2616);
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

function buildTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 1.15 * scale, 7), wood(0x5a3a22)));
  trunk.position.y = 0.55 * scale;
  group.add(trunk);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6a32, roughness: 0.9 });
  const crown = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.55 * scale, 8, 6), leaf));
  crown.position.y = 1.35 * scale;
  group.add(crown);
  const crown2 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 8, 6), leaf));
  crown2.position.set(0.22 * scale, 1.55 * scale, -0.1 * scale);
  group.add(crown2);
  return group;
}

function addFountain(root, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
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
  root.add(group);
  return group;
}

function addGardenBed(root, x, z, rand) {
  const soil = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a331c, roughness: 1 }),
  ));
  soil.position.set(x, 0.04, z);
  root.add(soil);
  const flowers = buildFlowerCluster(rand);
  flowers.position.set(x, 0.08, z);
  root.add(flowers);
  const bush = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2f6a32, roughness: 0.9 }),
  ));
  bush.position.set(x + 0.45, 0.28, z + 0.15);
  root.add(bush);
}

function buildFlowerCluster(rand) {
  const group = new THREE.Group();
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
  const box = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const cell of cells) {
    const c = roomCenter(cell.gx, cell.gz);
    box.minX = Math.min(box.minX, c.x - ROOM_W / 2);
    box.maxX = Math.max(box.maxX, c.x + ROOM_W / 2);
    box.minZ = Math.min(box.minZ, c.z - ROOM_D / 2);
    box.maxZ = Math.max(box.maxZ, c.z + ROOM_D / 2);
  }
  const grass = gardenBox(expansionIds);
  const grassMesh = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry(grass.maxX - grass.minX, grass.maxZ - grass.minZ),
    new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 }),
  ));
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.set((grass.minX + grass.maxX) / 2, -0.02, (grass.minZ + grass.maxZ) / 2);
  grassMesh.userData.kind = 'ground';
  root.add(grassMesh);

  addCobblePath(root, expansionIds);
  if (keepFountain(expansionIds)) addFountain(root, FOUNTAIN.x, FOUNTAIN.z);

  addGardenBed(root, 2.45, 6.2, randAt(2201));
  addGardenBed(root, -2.7, 7.6, randAt(3311));
  addGardenBed(root, -3.15, 10.6, randAt(4411));
  addGardenBed(root, 3.2, 11.15, randAt(5511));

  const rand = randAt(1337 + cells.length * 17);
  const hasLeft = expansionIds.includes('left');
  const hasRight = expansionIds.includes('right');
  for (const spot of gardenTreeSpots(expansionIds)) {
    const tree = buildTree((spot.side === 'edge' ? 1.15 : 0.85) + rand() * 0.45);
    tree.position.set(spot.x, 0, spot.z);
    tree.rotation.y = rand() * Math.PI * 2;
    tree.userData.gardenSide = spot.side;
    root.add(tree);
  }
  for (const spot of gardenRockSpots(expansionIds)) {
    const rock = buildBoulder(spot.scale ?? 1);
    rock.position.set(spot.x, 0, spot.z);
    rock.rotation.y = rand() * Math.PI * 2;
    root.add(rock);
  }
  const hatch = gardenTrapdoorSpot(expansionIds);
  if (hatch) {
    const door = buildTrapdoor();
    door.position.set(hatch.x, 0, hatch.z);
    root.add(door);
  }
  addEdgeGrass(root, grass, expansionIds, rand);
  for (let i = 0; i < 14; i += 1) {
    const leftSide = i % 2 === 0;
    if (leftSide && hasLeft) continue;
    if (!leftSide && hasRight) continue;
    const side = leftSide ? box.minX - 1.1 : box.maxX + 1.1;
    const z = box.minZ - 1.2 + rand() * ((box.maxZ - box.minZ) + 3);
    if (Math.abs(side) < 2.2 && z > 4) continue;
    const flowers = buildFlowerCluster(rand);
    flowers.position.set(side + (rand() - 0.5), 0, z);
    root.add(flowers);
  }
  for (let i = 0; i < 6; i += 1) {
    const flowers = buildFlowerCluster(rand);
    flowers.position.set(
      box.minX + rand() * (box.maxX - box.minX),
      0,
      box.minZ - 1.4 - rand() * 1.6,
    );
    root.add(flowers);
  }
}

function addPathRect(root, minX, maxX, minZ, maxZ) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 0.05 || d < 0.05) return;
  const mesh = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    cobbleMat(w * COBBLE_U, d * COBBLE_U),
  ));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, -0.008, (minZ + maxZ) / 2);
  mesh.userData.kind = 'ground';
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
    addPathRect(root, span.minX, span.maxX, span.minZ, FOUNTAIN.z - apron);
    addPathRect(root, span.minX, span.maxX, FOUNTAIN.z + apron, span.maxZ);
    const ring = addShadow(new THREE.Mesh(
      new THREE.RingGeometry(FOUNTAIN.radius + 0.04, apron, 28),
      cobbleMat(apron * 2 * COBBLE_U, apron * 2 * COBBLE_U),
    ));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(FOUNTAIN.x, -0.006, FOUNTAIN.z);
    ring.userData.kind = 'ground';
    root.add(ring);
  } else {
    addPathRect(root, span.minX, span.maxX, span.minZ, span.maxZ);
  }
}

function buildBoulder(scale = 1) {
  const group = new THREE.Group();
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

function buildTrapdoor() {
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
  const pick = markTrapdoorMesh(new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 2.2),
    pickMat(),
  ));
  pick.position.y = 0.55;
  group.add(pick);
  return group;
}

function addEdgeGrass(root, grass, expansionIds, rand) {
  const tufts = 22;
  for (let i = 0; i < tufts; i += 1) {
    const along = i / tufts;
    const edge = i % 4;
    let x;
    let z;
    if (edge === 0) {
      x = grass.minX + 0.6 + rand() * 1.2;
      z = grass.minZ + along * (grass.maxZ - grass.minZ);
    } else if (edge === 1) {
      x = grass.maxX - 0.6 - rand() * 1.2;
      z = grass.minZ + along * (grass.maxZ - grass.minZ);
    } else if (edge === 2) {
      x = grass.minX + along * (grass.maxX - grass.minX);
      z = grass.minZ + 0.6 + rand() * 1.2;
    } else {
      x = grass.minX + along * (grass.maxX - grass.minX);
      z = grass.maxZ - 0.6 - rand() * 1.2;
    }
    if (pointHitsShopSafe(x, z, expansionIds) || Math.abs(x) < 1.4 && z > PATH_START_Z) continue;
    const clump = buildGrassTuft(0.9 + rand() * 0.7, rand);
    clump.position.set(x, 0, z);
    clump.rotation.y = rand() * Math.PI * 2;
    root.add(clump);
  }
}

function pointHitsShopSafe(x, z, expansionIds) {
  return occupiedCells(expansionIds).some((cell) => {
    const c = roomCenter(cell.gx, cell.gz);
    return x >= c.x - ROOM_W / 2 - 0.8
      && x <= c.x + ROOM_W / 2 + 0.8
      && z >= c.z - ROOM_D / 2 - 0.8
      && z <= c.z + ROOM_D / 2 + 0.8;
  });
}

function buildGrassTuft(scale, rand) {
  const group = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({
    color: 0x3d7a32,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const count = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i += 1) {
    const blade = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32 * scale, 5), green));
    blade.position.set((rand() - 0.5) * 0.22, 0.14 * scale, (rand() - 0.5) * 0.22);
    blade.rotation.z = (rand() - 0.5) * 0.45;
    blade.rotation.x = (rand() - 0.5) * 0.3;
    group.add(blade);
  }
  return group;
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
    addFloor(root, c);
    addBeams(root, c);
    addRoomWalls(root, cell, neigh, isOrigin);
    addRoofForRoom(roofs, root, c, neigh, isOrigin);
    if (isOrigin) addOriginDecor(root, c);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W - 0.15, ROOM_D - 0.15),
      pickMat(),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(c.x, 0.09, c.z);
    ground.userData.kind = 'ground';
    grounds.add(ground);
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

export function buildDungeon() {
  const root = new THREE.Group();
  root.name = 'dungeon';
  const grounds = new THREE.Group();
  grounds.name = 'dungeon-grounds';
  const W = 11;
  const D = 9;
  const H = 3.4;
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

  addWallTorch(root, -W / 2 + 0.18, 1.7, -2.2, Math.PI / 2);
  addWallTorch(root, -W / 2 + 0.18, 1.7, 2.2, Math.PI / 2);
  addWallTorch(root, W / 2 - 0.18, 1.7, -2.2, -Math.PI / 2);
  addWallTorch(root, W / 2 - 0.18, 1.7, 2.2, -Math.PI / 2);

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

  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.7 });
  const skull = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bone));
  skull.position.set(1.6, 0.12, -1.4);
  skull.scale.set(1, 0.85, 1.15);
  root.add(skull);
  const jaw = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), bone));
  jaw.position.set(1.6, 0.04, -1.28);
  root.add(jaw);
  for (const [x, z, rot] of [[1.35, -1.55, 0.6], [1.85, -1.2, -0.4], [1.5, -1.05, 1.2], [1.95, -1.55, 0.2]]) {
    const rib = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.32, 6), bone));
    rib.position.set(x, 0.08, z);
    rib.rotation.z = rot;
    rib.rotation.x = 1.1;
    root.add(rib);
  }

  const rats = [];
  for (let i = 0; i < 4; i += 1) {
    const rat = buildRat();
    rat.position.set(-2 + i * 1.1, 0.06, 1.2 - i * 0.6);
    initRatWander(rat, i);
    root.add(rat);
    rats.push(rat);
  }

  const ladder = buildDungeonLadder();
  ladder.position.set(-W / 2 + 0.22, 0, 0.4);
  root.add(ladder);

  return { root, grounds, rats, ladder, size: { w: W, d: D } };
}

function buildRat() {
  const group = new THREE.Group();
  group.name = 'rat';
  const fur = new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 0.9 });
  const body = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fur));
  body.scale.set(1.4, 0.8, 0.9);
  body.position.y = 0.05;
  group.add(body);
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), fur));
  head.position.set(0, 0.06, 0.08);
  group.add(head);
  const tail = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.16, 5), fur));
  tail.rotation.x = 1.1;
  tail.position.set(0, 0.04, -0.1);
  group.add(tail);
  return group;
}

function buildDungeonLadder() {
  const group = new THREE.Group();
  group.name = 'ladder';
  const rail = wood(0x5a3a22);
  const mark = (mesh) => {
    mesh.userData.kind = 'ladder';
    return mesh;
  };
  for (const x of [-0.18, 0.18]) {
    const post = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), rail));
    post.position.set(x, 1.3, 0);
    group.add(mark(post));
  }
  for (let i = 0; i < 8; i += 1) {
    const rung = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.05), rail));
    rung.position.set(0, 0.28 + i * 0.3, 0.02);
    group.add(mark(rung));
  }
  const pick = mark(new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.8, 0.7),
    pickMat(),
  ));
  pick.position.set(0, 1.3, 0.12);
  group.add(pick);
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
