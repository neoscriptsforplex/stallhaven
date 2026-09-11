import * as THREE from 'three';
import {
  EXPANSION_PADS,
  ROOM_D,
  ROOM_W,
  neighborsOf,
  occupiedCells,
  padConnects,
  roomCenter,
} from './layout.js';

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

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cobbleMap() {
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
  return tex;
}

function cobbleMat(repeatX, repeatY) {
  const map = cobbleMap();
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.03,
    color: 0xd8d2c6,
  });
}

function addWallSlab(root, mat, x, y, z, sx, sy, sz) {
  if (sx < 0.03 || sy < 0.03 || sz < 0.03) return;
  const mesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
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

function makeSign() {
  const group = new THREE.Group();
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.52, 0.08), wood(0x4e331f)));
  group.add(board);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4e331f';
  ctx.fillRect(0, 0, 640, 128);
  ctx.fillStyle = '#f0d9a8';
  ctx.font = '700 56px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RUNE CRAFT', 320, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.44),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  label.position.z = 0.05;
  group.add(label);
  const left = buildTorch();
  left.position.set(-1.42, 0.02, 0.08);
  left.scale.setScalar(0.85);
  group.add(left);
  const right = buildTorch();
  right.position.set(1.42, 0.02, 0.08);
  right.scale.setScalar(0.85);
  group.add(right);
  return group;
}

function addFloor(root, center) {
  const floorMat = wood(0x6a4a2e, 0.9);
  const floor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.08, ROOM_D), floorMat));
  floor.position.set(center.x, 0.04, center.z);
  root.add(floor);
  for (let i = 0; i < 9; i += 1) {
    const plank = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_W - 0.15, 0.02, 0.62),
      wood(i % 2 ? 0x5c3d24 : 0x704a2c),
    ));
    plank.position.set(center.x, 0.09, center.z - ROOM_D / 2 + 0.45 + i * 0.78);
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

function addRoofForRoom(roofs, center) {
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
  const under = new THREE.MeshStandardMaterial({
    color: 0x3a2416,
    roughness: 0.88,
    transparent: true,
    opacity: 1,
  });
  const slope = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W + 0.55, 0.1, ROOM_D / 2 + 0.45), thatch));
  slope.position.set(0, 3.55, -ROOM_D / 4);
  slope.rotation.x = 0.42;
  group.add(slope);
  const slope2 = slope.clone();
  slope2.position.z = ROOM_D / 4;
  slope2.rotation.x = -0.42;
  group.add(slope2);
  const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W + 0.4, 0.12, 0.22), wood(0x3c2616)));
  ridge.position.set(0, 4.18, 0);
  group.add(ridge);
  const gable = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, ROOM_D + 0.2), under));
  gable.position.set(-ROOM_W / 2 - 0.08, 3.35, 0);
  group.add(gable);
  const gable2 = gable.clone();
  gable2.position.x = ROOM_W / 2 + 0.08;
  group.add(gable2);
  roofs.add(group);
  return group;
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
    if (isOrigin) {
      const sign = makeSign();
      sign.position.set(c.x, 2.08, backZ + 0.13);
      root.add(sign);
    }
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
  const leftX = center.x - ROOM_W / 2 + 0.14;
  const rightX = center.x + ROOM_W / 2 - 0.14;
  const backZ = center.z - ROOM_D / 2 + 0.14;
  const frontZ = center.z + ROOM_D / 2 - 0.14;

  mountWallVines(root, leftX, 1.92, center.z - 2.42, Math.PI / 2, 1);
  mountWallVines(root, leftX, 1.78, center.z + 2.42, Math.PI / 2, 2);
  mountWallVines(root, rightX, 1.92, center.z - 2.42, -Math.PI / 2, 3);
  mountWallVines(root, rightX, 1.78, center.z + 2.42, -Math.PI / 2, 4);
  mountWallVines(root, center.x - 2.28, 2.02, backZ, 0, 5);
  mountWallVines(root, center.x + 2.28, 2.02, backZ, 0, 6);
  mountWallVines(root, center.x - 3.05, 1.84, frontZ, Math.PI, 7);
  mountWallVines(root, center.x + 3.05, 1.84, frontZ, Math.PI, 8);
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

function footprint(cells) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const cell of cells) {
    const c = roomCenter(cell.gx, cell.gz);
    minX = Math.min(minX, c.x - ROOM_W / 2);
    maxX = Math.max(maxX, c.x + ROOM_W / 2);
    minZ = Math.min(minZ, c.z - ROOM_D / 2);
    maxZ = Math.max(maxZ, c.z + ROOM_D / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

function addGarden(root, cells) {
  const box = footprint(cells);
  const pad = 9;
  const grass = addShadow(new THREE.Mesh(
    new THREE.PlaneGeometry((box.maxX - box.minX) + pad * 2, (box.maxZ - box.minZ) + pad * 2),
    new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 }),
  ));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((box.minX + box.maxX) / 2, -0.02, (box.minZ + box.maxZ) / 2);
  root.add(grass);

  const road = addShadow(
    new THREE.Mesh(new THREE.PlaneGeometry(4.4, 14), new THREE.MeshStandardMaterial({ color: 0x9d8664, roughness: 1 })),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.01, 8);
  root.add(road);

  const rand = randAt(1337 + cells.length * 17);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const treeSpots = [
    [box.minX - 2.2, box.minZ + 1.4],
    [box.minX - 2.8, cz],
    [box.minX - 1.8, box.maxZ - 1.2],
    [box.maxX + 2.2, box.minZ + 1.4],
    [box.maxX + 2.6, cz],
    [box.maxX + 1.9, box.maxZ - 1.4],
    [cx - 3.2, box.minZ - 2.4],
    [cx + 3.2, box.minZ - 2.4],
    [cx, box.minZ - 2.8],
    [box.minX - 1.6, box.maxZ + 2.4],
    [box.maxX + 1.6, box.maxZ + 2.4],
  ];
  for (const [x, z] of treeSpots) {
    if (Math.abs(x) < 2.4 && z > 4.2) continue;
    const tree = buildTree(0.85 + rand() * 0.45);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * Math.PI * 2;
    root.add(tree);
  }
  for (let i = 0; i < 14; i += 1) {
    const side = i % 2 === 0 ? box.minX - 1.1 : box.maxX + 1.1;
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
  addGarden(root, cells);

  for (const cell of cells) {
    const c = roomCenter(cell.gx, cell.gz);
    const isOrigin = cell.gx === 0 && cell.gz === 0;
    const neigh = neighborsOf(cell.gx, cell.gz, expansionIds);
    addFloor(root, c);
    addBeams(root, c);
    addRoomWalls(root, cell, neigh, isOrigin);
    addRoofForRoom(roofs, c);
    if (isOrigin) addOriginDecor(root, c);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W - 0.15, ROOM_D - 0.15),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(c.x, 0.09, c.z);
    ground.userData.kind = 'ground';
    grounds.add(ground);
  }

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}
