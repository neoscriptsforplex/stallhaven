import * as THREE from 'three';
import { CUSTOMERS, RECIPES, SHOP } from './catalog.js';

function wood(color, roughness = 0.86) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
  });
}

function cloth(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function addShadow(mesh) {
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
      const r = shade + 6;
      const g = shade;
      const b = shade - 12;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const rx = 5 + rand() * 3;
      roundRect(ctx, x, y, bw, bh, rx);
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

export function buildStall() {
  const root = new THREE.Group();
  root.name = 'stall';

  const stoneFront = cobbleMat(4.2, 2.6);
  const stoneSide = cobbleMat(7.2, 2.6);
  const stoneBack = cobbleMat(8.2, 2.6);
  const beam = wood(0x3c2616, 0.78);
  const floorMat = wood(0x6a4a2e, 0.9);
  const dustGround = new THREE.MeshStandardMaterial({
    color: 0xb59a72,
    roughness: 1,
  });

  const ground = addShadow(new THREE.Mesh(new THREE.PlaneGeometry(28, 28), dustGround));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  root.add(ground);

  const road = addShadow(
    new THREE.Mesh(new THREE.PlaneGeometry(4.4, 14), new THREE.MeshStandardMaterial({ color: 0x9d8664, roughness: 1 })),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.01, 8);
  root.add(road);

  const floor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.08, 7.2), floorMat));
  floor.position.set(0, 0.04, 0.1);
  root.add(floor);

  for (let i = 0; i < 9; i += 1) {
    const plank = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.05, 0.02, 0.62), wood(i % 2 ? 0x5c3d24 : 0x704a2c)));
    plank.position.set(0, 0.09, -3.1 + i * 0.78);
    root.add(plank);
  }

  const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.7, 0.16), stoneBack));
  back.position.set(0, 1.4, -3.45);
  root.add(back);

  addWallWithWindow(root, stoneSide, {
    x: -4.1, y: 1.4, z: 0.1, w: 7.2, h: 2.7, t: 0.16, axis: 'z',
    winAlong: 0.15, winY: 1.42, winW: 0.86, winH: 0.95,
  });
  addWallWithWindow(root, stoneSide, {
    x: 4.1, y: 1.4, z: 0.1, w: 7.2, h: 2.7, t: 0.16, axis: 'z',
    winAlong: 0.15, winY: 1.42, winW: 0.86, winH: 0.95,
  });
  addShopWindow(root, { x: -4.08, y: 1.42, z: 0.15, rotY: Math.PI / 2 });
  addShopWindow(root, { x: 4.08, y: 1.42, z: 0.15, rotY: -Math.PI / 2 });

  const doorHalf = 0.58;
  const wallSpan = 4.1 - doorHalf;
  addWallWithWindow(root, stoneFront, {
    x: -4.1 + wallSpan / 2, y: 1.4, z: 3.58, w: wallSpan, h: 2.7, t: 0.16, axis: 'x',
    winAlong: -1.48, winY: 1.42, winW: 0.82, winH: 0.95,
  });
  addWallWithWindow(root, stoneFront, {
    x: 4.1 - wallSpan / 2, y: 1.4, z: 3.58, w: wallSpan, h: 2.7, t: 0.16, axis: 'x',
    winAlong: 1.48, winY: 1.42, winW: 0.82, winH: 0.95,
  });
  addShopWindow(root, { x: -1.48, y: 1.42, z: 3.5 });
  addShopWindow(root, { x: 1.48, y: 1.42, z: 3.5 });

  const lintel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 + 0.36, 0.38, 0.22), beam));
  lintel.position.set(0, 2.52, 3.58);
  root.add(lintel);
  const postL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.18, 0.2), beam));
  postL.position.set(-doorHalf - 0.02, 1.14, 3.58);
  root.add(postL);
  const postR = postL.clone();
  postR.position.x = doorHalf + 0.02;
  root.add(postR);
  const sill = addShadow(new THREE.Mesh(new THREE.BoxGeometry(doorHalf * 2 + 0.2, 0.08, 0.42), wood(0x4a301c)));
  sill.position.set(0, 0.08, 3.62);
  root.add(sill);
  const stoop = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.7), wood(0x5a3b22, 0.92)));
  stoop.position.set(0, 0.04, 4.12);
  root.add(stoop);

  const posts = [
    [-3.7, 3.45],
    [3.7, 3.45],
    [-3.7, 4.35],
    [3.7, 4.35],
  ];
  for (const [x, z] of posts) {
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 8), beam));
    post.position.set(x, 1.2, z);
    root.add(post);
  }

  const awning = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.06, 1.7), cloth(0x8b4336)));
  awning.position.set(0, 2.32, 4.05);
  awning.rotation.x = -0.18;
  root.add(awning);
  const stripe = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.12, 0.02, 0.28), cloth(0xead3ae)));
  stripe.position.set(0, 2.36, 3.55);
  stripe.rotation.x = -0.18;
  root.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.z = 4.2;
  root.add(stripe2);

  const beamBar = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.16, 0.16), beam));
  beamBar.position.set(0, 2.55, -3.35);
  root.add(beamBar);
  const sideBeam = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 7.1), beam));
  sideBeam.position.set(-4, 2.55, 0.1);
  root.add(sideBeam);
  const sideBeam2 = sideBeam.clone();
  sideBeam2.position.x = 4;
  root.add(sideBeam2);

  const sign = makeSign();
  sign.position.set(0, 2.05, -3.32);
  root.add(sign);

  const counter = buildCounter();
  counter.position.set(SHOP.counter.x, 0, SHOP.counter.z);
  root.add(counter);

  return root;
}

function makeSign() {
  const group = new THREE.Group();
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.55, 0.08), wood(0x4e331f)));
  group.add(board);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4e331f';
  ctx.fillRect(0, 0, 640, 128);
  ctx.fillStyle = '#f0d9a8';
  ctx.font = '700 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RUNE CRAFT', 320, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 0.46),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  label.position.z = 0.05;
  group.add(label);
  return group;
}

export function buildCounter() {
  const group = new THREE.Group();
  group.name = 'counter';
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.85), wood(0x7a5230)));
  top.position.y = 0.92;
  group.add(top);
  const clothMesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.03, 0.92), cloth(0x7a3d32)));
  clothMesh.position.y = 0.98;
  group.add(clothMesh);
  const drape = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.16, 0.04), cloth(0x6a332a)));
  drape.position.set(0, 0.89, 0.46);
  group.add(drape);
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.82, 0.7), wood(0x4e301c)));
  body.position.y = 0.46;
  group.add(body);
  const dish = addShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), new THREE.MeshStandardMaterial({
      color: 0xb08a3c,
      metalness: 0.55,
      roughness: 0.35,
    })),
  );
  dish.position.set(0.7, 1.03, 0.1);
  group.add(dish);
  return group;
}

export function buildDefaultTable() {
  const group = new THREE.Group();
  group.name = 'table';
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.85), wood(0x8a5a32)));
  top.position.y = 0.82;
  group.add(top);
  const clothMesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.02, 0.7), cloth(0x7a3d32)));
  clothMesh.position.y = 0.87;
  group.add(clothMesh);
  for (const [x, z] of [
    [-0.52, -0.3],
    [0.52, -0.3],
    [-0.52, 0.3],
    [0.52, 0.3],
  ]) {
    const leg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), wood(0x3f2716)));
    leg.position.set(x, 0.4, z);
    group.add(leg);
  }
  group.userData.wareY = 0.92;
  return group;
}

export function buildShopDoor() {
  const root = new THREE.Group();
  root.name = 'shop-door';
  const hingeX = -0.58;
  const hingeZ = 3.4;
  for (const y of [0.38, 1.12, 1.86]) {
    const knuckle = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), metal(0xe3b34a)));
    knuckle.rotation.x = Math.PI / 2;
    knuckle.position.set(hingeX, y, hingeZ);
    root.add(knuckle);
  }
  const hinge = new THREE.Group();
  hinge.position.set(hingeX, 0, hingeZ);
  const oak = wood(0x8a5230, 0.68);
  const leaf = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.08, 0.1), oak));
  leaf.position.set(0.56, 1.12, 0);
  hinge.add(leaf);
  const panel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.72, 0.05), wood(0xb06a38, 0.74)));
  panel.position.set(0.56, 0.62, 0.05);
  hinge.add(panel);
  const panel2 = panel.clone();
  panel2.position.y = 1.48;
  hinge.add(panel2);
  const mid = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.12), wood(0x3f2716)));
  mid.position.set(0.56, 1.06, 0.04);
  hinge.add(mid);
  const strap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.12), metal(0xe3b34a)));
  strap.position.set(0.12, 1.12, 0.04);
  hinge.add(strap);
  const strap2 = strap.clone();
  strap2.position.x = 1.0;
  hinge.add(strap2);
  const window = addShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.28, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0xcfe8f2,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7,
    }),
  ));
  window.position.set(0.56, 1.62, 0.06);
  hinge.add(window);
  const handle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), metal(0xe8c56a)));
  handle.position.set(1.0, 1.02, 0.1);
  hinge.add(handle);
  hinge.rotation.y = OPEN_DOOR_ANGLE;
  root.add(hinge);
  root.userData.hinge = hinge;
  return root;
}

const OPEN_DOOR_ANGLE = 1.72;

export function setDoorOpen(door, _open, dt = 1) {
  const hinge = door.userData.hinge;
  if (!hinge) return;
  hinge.rotation.y += (OPEN_DOOR_ANGLE - hinge.rotation.y) * Math.min(1, dt * 5);
}

function addHumanoid(group, {
  skin,
  shirt,
  pants,
  boots,
  sleeves,
}) {
  const bootMat = boots ?? pants;
  const sleeveMat = sleeves ?? shirt;
  const hipX = 0.074;

  for (const side of [-1, 1]) {
    const foot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), bootMat));
    foot.scale.set(1.12, 0.52, 1.9);
    foot.position.set(side * hipX, 0.03, 0.03);
    group.add(foot);

    const shin = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.28, 7), pants));
    shin.position.set(side * (hipX + 0.006), 0.20, 0);
    shin.rotation.z = side * 0.07;
    group.add(shin);

    const knee = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 6), pants));
    knee.position.set(side * (hipX + 0.014), 0.35, 0);
    group.add(knee);

    const thigh = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.038, 0.26, 7), pants));
    thigh.position.set(side * (hipX * 0.72), 0.49, 0);
    thigh.rotation.z = side * -0.09;
    group.add(thigh);
  }

  const hips = addShadow(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.088, 0),
    new THREE.Vector2(0.122, 0.032),
    new THREE.Vector2(0.116, 0.09),
    new THREE.Vector2(0.098, 0.13),
  ], 10), pants));
  hips.position.y = 0.58;
  hips.scale.z = 0.76;
  group.add(hips);

  const torso = addShadow(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.098, 0),
    new THREE.Vector2(0.11, 0.05),
    new THREE.Vector2(0.12, 0.14),
    new THREE.Vector2(0.14, 0.26),
    new THREE.Vector2(0.126, 0.33),
    new THREE.Vector2(0.048, 0.38),
  ], 10), shirt));
  torso.position.y = 0.68;
  torso.scale.z = 0.7;
  group.add(torso);

  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.07, 8), skin));
  neck.position.y = 1.08;
  group.add(neck);

  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10), skin));
  head.scale.set(0.92, 1.06, 0.88);
  head.position.set(0, 1.22, 0.012);
  group.add(head);

  for (const side of [-1, 1]) {
    const ear = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), skin));
    ear.scale.set(0.5, 1.05, 0.75);
    ear.position.set(side * 0.108, 1.22, 0);
    group.add(ear);
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.42 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), eyeMat);
    eye.position.set(side * 0.036, 1.235, 0.09);
    group.add(eye);
  }

  const nose = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.036, 5), skin));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.208, 0.102);
  group.add(nose);

  const shoulderY = 1.0;
  const shoulderX = 0.152;
  for (const side of [-1, 1]) {
    const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), sleeveMat));
    cap.scale.set(1.08, 0.82, 0.9);
    cap.position.set(side * shoulderX, shoulderY, 0);
    group.add(cap);

    const upper = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.22, 7), sleeveMat));
    upper.position.set(side * (shoulderX + 0.022), 0.87, 0.016);
    upper.rotation.z = side * 0.16;
    group.add(upper);

    const elbow = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), sleeveMat));
    elbow.position.set(side * (shoulderX + 0.042), 0.75, 0.03);
    group.add(elbow);

    const forearm = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.2, 7), sleeveMat));
    forearm.position.set(side * (shoulderX + 0.056), 0.63, 0.046);
    forearm.rotation.z = side * 0.12;
    group.add(forearm);

    const palm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.027, 6, 5), skin));
    palm.scale.set(0.9, 0.68, 1.12);
    palm.position.set(side * (shoulderX + 0.07), 0.515, 0.06);
    group.add(palm);
  }

  return {
    headY: 1.22,
    headTop: 1.345,
    shoulderY,
    shoulderX,
    handR: { x: shoulderX + 0.07, y: 0.515, z: 0.06 },
    handL: { x: -(shoulderX + 0.07), y: 0.515, z: 0.06 },
  };
}

function addHeldPole(group, { x, y, z, length, woodColor, orb }) {
  const stave = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, length, 6),
    wood(woodColor),
  ));
  stave.position.set(x, y, z);
  group.add(stave);
  if (!orb) return;
  const tipY = y + length / 2;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(orb.radius, 8, 8),
    new THREE.MeshStandardMaterial({
      color: orb.color,
      emissive: orb.emissive,
      emissiveIntensity: 1.2,
    }),
  );
  ball.position.set(x, tipY + orb.radius * 0.7, z);
  group.add(ball);
}

export function buildShopkeeper() {
  const group = new THREE.Group();
  group.name = 'shopkeeper';
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2c2a0, roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.86 });
  const apron = cloth(0xd8c49a, 0.9);
  const hair = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.8 });
  const pose = addHumanoid(group, {
    skin,
    shirt,
    pants: cloth(0x3a2a1c),
    boots: cloth(0x2a1c12),
    sleeves: shirt,
  });

  const bib = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.3, 8), apron));
  bib.scale.z = 0.22;
  bib.position.set(0, 0.88, 0.08);
  group.add(bib);
  const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, 0.22, 10), apron));
  skirt.scale.z = 0.72;
  skirt.position.set(0, 0.58, 0.02);
  group.add(skirt);

  const haircap = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7),
    hair,
  ));
  haircap.position.set(0, pose.headY + 0.04, 0.01);
  group.add(haircap);
  const hat = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.09, 10), cloth(0x6b4336)));
  hat.position.y = pose.headTop + 0.02;
  group.add(hat);

  const label = makeNameSprite('You');
  label.position.y = pose.headTop + 0.28;
  group.add(label);
  return group;
}

export function buildAnvil() {
  const group = new THREE.Group();
  group.name = 'anvil';
  const iron = metal(0x5a6068);
  const dark = metal(0x2a2c30);
  const stump = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.26, 10), wood(0x4a301c)));
  stump.position.y = 0.14;
  group.add(stump);
  const waist = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.22), dark));
  waist.position.y = 0.38;
  group.add(waist);
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.32), iron));
  body.position.y = 0.58;
  group.add(body);
  const horn = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 0.36, 8), iron));
  horn.rotation.z = Math.PI / 2;
  horn.position.set(-0.46, 0.58, 0);
  group.add(horn);
  const heel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.26), iron));
  heel.position.set(0.4, 0.55, 0);
  group.add(heel);
  const face = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.28), metal(0xb0b8c0)));
  face.position.y = 0.7;
  group.add(face);
  const hammer = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.42, 6), wood(0x5a3a22)));
  hammer.position.set(0.26, 0.86, 0.18);
  hammer.rotation.z = 0.7;
  group.add(hammer);
  const head = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.06), iron));
  head.position.set(0.42, 1.0, 0.18);
  group.add(head);
  const label = makeNameSprite('Anvil');
  label.position.y = 1.22;
  group.add(label);
  group.userData.wareY = 0.74;
  return group;
}

export function buildWallShelf() {
  const group = new THREE.Group();
  group.name = 'shelf';
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.07, 0.38), wood(0x7a5230)));
  board.position.y = 1.38;
  group.add(board);
  const board2 = board.clone();
  board2.position.y = 0.92;
  group.add(board2);
  const bracket = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), wood(0x3f2716)));
  bracket.position.set(-0.55, 1.12, -0.12);
  group.add(bracket);
  const bracket2 = bracket.clone();
  bracket2.position.x = 0.55;
  group.add(bracket2);
  const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.82, 0.05), wood(0x4e301c)));
  back.position.set(0, 1.15, -0.18);
  group.add(back);
  group.userData.wareY = 1.46;
  group.userData.shelfSlots = true;
  return group;
}

export function buildArmourStand() {
  const group = new THREE.Group();
  group.name = 'armour-stand';
  const pole = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.48, 8), wood(0x3f2716)));
  pole.position.y = 0.76;
  group.add(pole);
  const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), wood(0x4a301c)));
  base.position.y = 0.04;
  group.add(base);
  const hips = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.14), wood(0x5a3b22)));
  hips.position.y = 0.5;
  group.add(hips);
  const torso = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.14), wood(0x7a5230, 0.9)));
  torso.position.y = 0.92;
  group.add(torso);
  const shoulders = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), wood(0x5a3b22)));
  shoulders.position.y = 1.16;
  group.add(shoulders);
  const armL = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.38, 8), wood(0x3f2716)));
  armL.position.set(-0.24, 0.92, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.24;
  group.add(armR);
  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), wood(0x3f2716)));
  neck.position.y = 1.28;
  group.add(neck);
  const knob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), wood(0x6a4324)));
  knob.position.y = 1.4;
  group.add(knob);
  group.userData.wareY = 0;
  group.userData.stand = true;
  group.userData.slots = {
    helm: { x: 0, y: 1.4, z: 0 },
    body: { x: 0, y: 0.82, z: 0 },
    legs: { x: 0, y: 0.3, z: 0 },
    ware: { x: 0.18, y: 0.62, z: 0.1 },
  };
  return group;
}

export function buildFurniture(kind) {
  if (kind === 'shelf') return buildWallShelf();
  if (kind === 'stand') return buildArmourStand();
  return buildDefaultTable();
}

export function slotPose(slot) {
  if (slot === 'helm') return { x: 0, y: 1.4, z: 0 };
  if (slot === 'body') return { x: 0, y: 0.82, z: 0 };
  if (slot === 'legs') return { x: 0, y: 0.32, z: 0 };
  if (slot === 'boots') return { x: 0, y: 0.08, z: 0.02 };
  if (slot === 'gloves') return { x: 0.24, y: 0.74, z: 0.04 };
  return { x: 0, y: 0.62, z: 0 };
}

export function buildWare(recipeId) {
  const recipe = RECIPES[recipeId];
  const group = new THREE.Group();
  group.name = recipeId;
  const shape = recipe?.shape;
  const tint = recipe?.tint ?? 0x888888;
  const builders = {
    scimitar: () => addScimitar(group, tint),
    dagger: () => addDagger(group, tint),
    sword: () => addSword(group, tint, 1),
    mace: () => addMace(group, tint),
    spear: () => addSpear(group, tint),
    '2h': () => addSword(group, tint, 1.38),
    defender: () => addDefender(group, tint),
    full_helm: () => addFullHelm(group, tint),
    med_helm: () => addMedHelm(group, tint),
    platebody: () => addPlatebody(group, tint),
    platelegs: () => addPlatelegs(group, tint),
    boots: () => addBoots(group, tint, true),
    gloves: () => addGloves(group, tint, true),
    chainbody: () => addChainbody(group, tint),
    plateskirt: () => addPlateskirt(group, tint),
    staff_plain: () => addMagicStaff(group, tint, 'plain'),
    staff_mystic: () => addMagicStaff(group, tint, 'mystic'),
    staff_battle: () => addMagicStaff(group, tint, 'battle'),
    staff_lunar: () => addMagicStaff(group, tint, 'lunar'),
    staff_ancient: () => addMagicStaff(group, tint, 'ancient'),
    wizard_hat: () => addWizardHat(group, tint, recipe?.accent),
    robe_top: () => addRobeTop(group, tint, recipe?.accent),
    robe_bottom: () => addRobeBottom(group, tint, recipe?.accent),
    magic_boots: () => addBoots(group, tint, false),
    magic_gloves: () => addGloves(group, tint, false),
    shortbow: () => addBow(group, tint, 0.78),
    longbow: () => addBow(group, tint, 1.18),
    crossbow: () => addCrossbow(group, tint),
    knives: () => addKnives(group, tint),
    thrownaxe: () => addThrownaxe(group, tint),
    dhide_body: () => addDhideBody(group, tint),
    dhide_chaps: () => addChaps(group, tint),
    dhide_vambraces: () => addVambraces(group, tint),
    dhide_boots: () => addBoots(group, tint, false),
    bread: () => addBread(group, tint),
    pizza: () => addPizza(group, tint),
    cake: () => addCake(group, tint),
    pie: () => addPie(group, tint, 0xb45a4a),
    fish_pie: () => addPie(group, tint, 0x7a9aaa),
    potion: () => addPotion(group, tint),
  };
  if (builders[shape]) builders[shape]();
  else {
    const lump = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.6 }),
    ));
    lump.position.y = 0.1;
    group.add(lump);
  }
  if (recipe?.category === 'food' || recipe?.category === 'potion') group.scale.setScalar(0.55);
  group.userData.recipeId = recipeId;
  return group;
}

function metal(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.72,
  });
}

function glow(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.4,
    roughness: 0.28,
    metalness: 0.15,
  });
}

function addHilt(group, x, y, rot, wide = 0.22) {
  const guard = addShadow(new THREE.Mesh(new THREE.BoxGeometry(wide, 0.035, 0.05), metal(0xc4a05a)));
  guard.position.set(x, y, 0);
  guard.rotation.z = rot;
  group.add(guard);
  const grip = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.16, 8), wood(0x4a301c)));
  grip.position.set(x - 0.06, y - 0.1, 0);
  grip.rotation.z = rot;
  group.add(grip);
}

function addSword(group, tint, scale = 1) {
  const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.055 * scale, 0.62 * scale, 0.016), metal(tint)));
  blade.position.set(0.08, 0.34 + 0.08 * scale, 0);
  blade.rotation.z = -0.45;
  group.add(blade);
  const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.038 * scale, 0.12 * scale, 6), metal(tint)));
  tip.position.set(0.08 + 0.14 * scale, 0.34 + 0.36 * scale, 0);
  tip.rotation.z = -0.45;
  group.add(tip);
  addHilt(group, -0.02, 0.18, -0.45, 0.2 * scale);
}

function addScimitar(group, tint) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.02, 0.2, 0),
    new THREE.Vector3(0.18, 0.42, 0),
    new THREE.Vector3(0.08, 0.78, 0),
  );
  const blade = addShadow(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 14, 0.028, 6, false),
    metal(tint),
  ));
  group.add(blade);
  for (let i = 1; i < 8; i += 1) {
    const t = i / 8;
    const p = curve.getPoint(t);
    const belly = 0.034 + Math.sin(t * Math.PI) * 0.028;
    const seg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(belly, 0.07, 0.016), metal(tint)));
    seg.position.copy(p);
    seg.rotation.z = -0.55 + t * 1.15;
    group.add(seg);
  }
  const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), metal(tint)));
  tip.position.set(0.06, 0.84, 0);
  tip.rotation.z = 0.55;
  group.add(tip);
  addHilt(group, -0.05, 0.16, -0.28, 0.2);
}

function shaftTip(posY, rotZ, halfLen) {
  return {
    x: -halfLen * Math.sin(rotZ),
    y: posY + halfLen * Math.cos(rotZ),
    z: 0,
  };
}

function addMace(group, tint) {
  const rotZ = 0.35;
  const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 8), wood(0x4a301c)));
  shaft.position.set(0, 0.28, 0);
  shaft.rotation.z = rotZ;
  group.add(shaft);
  const tip = shaftTip(0.28, rotZ, 0.24);
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), metal(tint)));
  head.position.set(tip.x, tip.y + 0.02, 0);
  group.add(head);
  const dirX = -Math.sin(rotZ);
  const dirY = Math.cos(rotZ);
  for (const [ox, oy, oz] of [[0.08, 0.04, 0], [-0.02, 0.09, 0.05], [-0.02, 0.09, -0.05]]) {
    const spike = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 5), metal(tint)));
    spike.position.set(head.position.x + ox * dirX, head.position.y + oy * dirY, oz);
    spike.rotation.z = rotZ;
    group.add(spike);
  }
}

function addSpear(group, tint) {
  const rotZ = 0.42;
  const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.92, 8), wood(0x5a3a22)));
  shaft.position.set(0, 0.4, 0);
  shaft.rotation.z = rotZ;
  group.add(shaft);
  const tip = shaftTip(0.4, rotZ, 0.46);
  const head = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), metal(tint)));
  head.position.set(tip.x, tip.y + 0.02, 0);
  head.rotation.z = rotZ;
  group.add(head);
}

function addDagger(group, tint) {
  const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.014), metal(tint)));
  blade.position.set(0.04, 0.28, 0);
  blade.rotation.z = -0.4;
  group.add(blade);
  const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), metal(tint)));
  tip.position.set(0.1, 0.44, 0);
  tip.rotation.z = -0.4;
  group.add(tip);
  addHilt(group, -0.04, 0.14, -0.4, 0.16);
}

function addDefender(group, tint) {
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.05), metal(tint)));
  board.position.y = 0.24;
  group.add(board);
  const boss = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), metal(0xc4a05a)));
  boss.position.set(0, 0.24, 0.04);
  group.add(boss);
  const rim = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.06), metal(0xc4a05a)));
  rim.position.y = 0.44;
  group.add(rim);
}

function addFullHelm(group, tint) {
  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.5), metal(tint)));
  dome.position.y = 0.14;
  group.add(dome);
  const face = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.16), metal(tint)));
  face.position.set(0, 0.1, 0.02);
  group.add(face);
  const slit = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), metal(0x1a1a1a)));
  slit.position.set(0, 0.14, 0.1);
  group.add(slit);
}

function addMedHelm(group, tint) {
  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.85), metal(tint)));
  dome.position.y = 0.12;
  group.add(dome);
  const nasal = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.04), metal(tint)));
  nasal.position.set(0, 0.08, 0.12);
  group.add(nasal);
}

function addPlatebody(group, tint) {
  const plate = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.16), metal(tint)));
  plate.position.y = 0.22;
  group.add(plate);
  const collar = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), metal(0xc4a05a)));
  collar.position.y = 0.42;
  group.add(collar);
}

function addChainbody(group, tint) {
  const vest = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.14), metal(tint)));
  vest.position.y = 0.22;
  group.add(vest);
  for (let i = 0; i < 4; i += 1) {
    const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10), metal(tint)));
    ring.position.set(-0.1 + (i % 2) * 0.2, 0.14 + Math.floor(i / 2) * 0.14, 0.08);
    group.add(ring);
  }
}

function addPlatelegs(group, tint) {
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), metal(tint)));
  left.position.set(-0.08, 0.2, 0);
  group.add(left);
  const right = left.clone();
  right.position.x = 0.08;
  group.add(right);
  const knee = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.13), metal(0xc4a05a)));
  knee.position.set(-0.08, 0.22, 0.02);
  group.add(knee);
  const knee2 = knee.clone();
  knee2.position.x = 0.08;
  group.add(knee2);
}

function addPlateskirt(group, tint) {
  const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.28, 10), metal(tint)));
  skirt.position.y = 0.16;
  group.add(skirt);
  const belt = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 14), metal(0xc4a05a)));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.28;
  group.add(belt);
}

function addBoots(group, tint, plated) {
  const mat = plated ? metal(tint) : cloth(tint);
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.16), mat));
  left.position.set(-0.07, 0.06, 0.02);
  group.add(left);
  const right = left.clone();
  right.position.x = 0.07;
  group.add(right);
}

function addGloves(group, tint, plated) {
  const mat = plated ? metal(tint) : cloth(tint);
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), mat));
  left.position.set(-0.08, 0.06, 0);
  group.add(left);
  const right = left.clone();
  right.position.x = 0.08;
  group.add(right);
}

function addMagicStaff(group, tint, kind) {
  const fancy = kind === 'battle';
  const rotZ = 0.22;
  const posY = 0.4;
  const halfLen = 0.41;
  const shaft = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(fancy ? 0.024 : 0.018, fancy ? 0.032 : 0.024, halfLen * 2, fancy ? 10 : 8),
    wood(fancy ? 0x2a1a10 : 0x3a2a1c),
  ));
  shaft.position.set(0, posY, 0);
  shaft.rotation.z = rotZ;
  group.add(shaft);
  const dirX = -Math.sin(rotZ);
  const dirY = Math.cos(rotZ);
  const tip = shaftTip(posY, rotZ, halfLen);
  const onTip = (along) => ({
    x: tip.x + dirX * along,
    y: tip.y + dirY * along,
    z: 0,
  });
  if (fancy) {
    for (const dist of [0.08, 0.22]) {
      const wrap = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.01, 6, 10), metal(0xc4a05a)));
      wrap.position.set(-dist * Math.sin(rotZ), posY + dist * Math.cos(rotZ), 0);
      wrap.rotation.x = Math.PI / 2;
      wrap.rotation.z = rotZ;
      group.add(wrap);
    }
  }
  if (kind === 'plain') {
    const capH = 0.06;
    const cap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, capH, 8), wood(0x4a301c)));
    const p = onTip(capH * 0.32);
    cap.position.set(p.x, p.y, 0);
    cap.rotation.z = rotZ;
    group.add(cap);
    return;
  }
  if (kind === 'lunar') {
    const moon = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 18, Math.PI * 1.35), glow(tint)));
    const p = onTip(0.02);
    moon.position.set(p.x, p.y, 0);
    moon.rotation.z = rotZ + 0.38;
    group.add(moon);
    return;
  }
  if (kind === 'ancient') {
    const arch = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glow(tint)));
    const p = onTip(0.11 * 0.72);
    arch.position.set(p.x, p.y, 0);
    arch.scale.set(0.85, 1.15, 0.45);
    arch.rotation.z = rotZ;
    group.add(arch);
    for (const [dx, dy] of [[-0.04, 0.04], [0.04, 0.04], [-0.04, -0.04], [0.04, -0.04]]) {
      const cut = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.08), cloth(0x1a1210)));
      cut.position.set(p.x + dx, p.y + dy, 0.04);
      group.add(cut);
    }
    return;
  }
  const radius = fancy ? 0.1 : 0.09;
  const orb = addShadow(new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), glow(tint)));
  const p = onTip(radius * 0.72);
  orb.position.set(p.x, p.y, 0);
  group.add(orb);
}

function addWizardHat(group, tint, accent = 0xc4a05a) {
  const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), cloth(tint)));
  brim.position.y = 0.08;
  group.add(brim);
  const cone = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 10), cloth(tint)));
  cone.position.y = 0.24;
  group.add(cone);
  const band = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 10), cloth(accent)));
  band.position.y = 0.12;
  group.add(band);
}

function addRobeTop(group, tint, accent = 0xc4a05a) {
  const robe = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 10), cloth(tint)));
  robe.position.y = 0.22;
  group.add(robe);
  const trim = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.16), cloth(accent)));
  trim.position.y = 0.38;
  group.add(trim);
}

function addRobeBottom(group, tint, accent = 0xc4a05a) {
  const wrap = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 10), cloth(tint)));
  wrap.position.y = 0.18;
  group.add(wrap);
  const hem = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 14), cloth(accent)));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.04;
  group.add(hem);
}

function addBow(group, tint, scale = 1) {
  const limb = addShadow(new THREE.Mesh(
    new THREE.TorusGeometry(0.28 * scale, 0.016, 8, 16, Math.PI),
    wood(tint),
  ));
  limb.rotation.y = Math.PI / 2;
  limb.rotation.z = Math.PI / 2;
  limb.position.set(0, 0.28 * scale, 0);
  group.add(limb);
  const string = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.54 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0xead3ae, roughness: 0.5 }),
  ));
  string.position.set(0.18 * scale, 0.28 * scale, 0);
  group.add(string);
}

function addCrossbow(group, tint) {
  const stock = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), wood(0x5a3a22)));
  stock.position.y = 0.12;
  group.add(stock);
  const prod = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.05), metal(tint)));
  prod.position.set(0, 0.16, 0.12);
  group.add(prod);
  const bow = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 12, Math.PI), wood(tint)));
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.16, 0.14);
  group.add(bow);
}

function addKnives(group, tint) {
  for (const [x, rot] of [[-0.08, -0.5], [0.02, -0.2], [0.1, 0.15]]) {
    const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.01), metal(tint)));
    blade.position.set(x, 0.16, 0);
    blade.rotation.z = rot;
    group.add(blade);
  }
}

function addThrownaxe(group, tint) {
  const haft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.36, 8), wood(0x4a301c)));
  haft.position.y = 0.2;
  haft.rotation.z = 0.4;
  group.add(haft);
  const blade = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI), metal(tint)));
  blade.rotation.y = Math.PI / 2;
  blade.position.set(0.08, 0.34, 0);
  group.add(blade);
}

function addDhideBody(group, tint) {
  const vest = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.14), cloth(tint)));
  vest.position.y = 0.22;
  group.add(vest);
  const strap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.16), cloth(0x3a2a1c)));
  strap.position.set(0.08, 0.22, 0);
  strap.rotation.z = -0.3;
  group.add(strap);
}

function addChaps(group, tint) {
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), cloth(tint)));
  left.position.set(-0.08, 0.2, 0);
  group.add(left);
  const right = left.clone();
  right.position.x = 0.08;
  group.add(right);
}

function addVambraces(group, tint) {
  const left = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 8), cloth(tint)));
  left.position.set(-0.1, 0.1, 0);
  left.rotation.z = 0.4;
  group.add(left);
  const right = left.clone();
  right.position.x = 0.1;
  right.rotation.z = -0.4;
  group.add(right);
}

function addBread(group, tint) {
  const loaf = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.92,
  })));
  loaf.scale.set(1.4, 0.5, 0.85);
  loaf.position.y = 0.06;
  group.add(loaf);
}

function addPizza(group, tint) {
  const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.88,
  })));
  base.position.y = 0.03;
  group.add(base);
  const topping = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10), new THREE.MeshStandardMaterial({
    color: 0xd45a32,
    roughness: 0.7,
  })));
  topping.position.y = 0.05;
  group.add(topping);
}

function addCake(group, tint) {
  const cake = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.86,
  })));
  cake.position.y = 0.06;
  group.add(cake);
  const icing = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.12, 0.03, 12), cloth(0xf4e8d0)));
  icing.position.y = 0.12;
  group.add(icing);
}

function addPotion(group, tint) {
  const glass = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.068, 0.16, 10),
    new THREE.MeshStandardMaterial({
      color: 0xd8ece8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.12,
      metalness: 0.08,
    }),
  ));
  glass.position.y = 0.1;
  group.add(glass);
  const liquid = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.052, 0.1, 10),
    glow(tint),
  ));
  liquid.position.y = 0.08;
  group.add(liquid);
  const neck = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.03, 0.055, 8),
    new THREE.MeshStandardMaterial({
      color: 0xd8ece8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.12,
    }),
  ));
  neck.position.y = 0.2;
  group.add(neck);
  const cork = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.026, 0.028, 8),
    wood(0x8a5a32),
  ));
  cork.position.y = 0.24;
  group.add(cork);
}

function addPie(group, tint, filling) {
  const dish = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.06, 12), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.85,
  })));
  dish.position.y = 0.04;
  group.add(dish);
  const top = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({
    color: filling,
    roughness: 0.7,
  })));
  top.position.y = 0.06;
  group.add(top);
}

export function buildChest() {
  const root = new THREE.Group();
  root.name = 'chest';
  const oak = wood(0x6a4324, 0.8);
  const dark = wood(0x3d2414, 0.78);
  const band = metal(0xb08a3c);

  const base = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.62), oak));
  base.position.y = 0.27;
  root.add(base);
  const trim = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.66), dark));
  trim.position.y = 0.48;
  root.add(trim);
  const strap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.64), band));
  strap.position.set(-0.22, 0.27, 0);
  root.add(strap);
  const strap2 = strap.clone();
  strap2.position.x = 0.22;
  root.add(strap2);

  const lid = new THREE.Group();
  lid.position.set(0, 0.48, -0.28);
  const lidBoard = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.62), oak));
  lidBoard.position.set(0, 0.04, 0.31);
  lid.add(lidBoard);
  const lidRound = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12, 1, false, 0, Math.PI),
    oak,
  ));
  lidRound.rotation.z = Math.PI / 2;
  lidRound.position.set(0, 0.08, 0.31);
  lid.add(lidRound);
  const latch = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), band));
  latch.position.set(0, 0.02, 0.62);
  lid.add(latch);
  root.add(lid);
  root.userData.lid = lid;
  const label = makeNameSprite('Chest');
  label.position.y = 1.05;
  root.add(label);

  return root;
}

export function setChestLid(chest, open, dt = 1) {
  const lid = chest.userData.lid;
  if (!lid) return;
  const target = open ? -1.15 : 0;
  lid.rotation.x += (target - lid.rotation.x) * Math.min(1, dt * 8);
}

export function buildAdventurer(typeId) {
  const type = CUSTOMERS[typeId];
  const group = new THREE.Group();
  group.name = typeId;

  const robe = new THREE.MeshStandardMaterial({ color: type.robe, roughness: 0.88 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2c2a0, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: type.accent, roughness: 0.7 });
  const pants = typeId === 'mercenary' || typeId === 'ranger'
    ? new THREE.MeshStandardMaterial({ color: type.robe, roughness: 0.86 })
    : robe;
  const pose = addHumanoid(group, {
    skin,
    shirt: robe,
    pants,
    boots: typeId === 'mercenary' ? metal(0x4a463f) : cloth(0x2a1c12),
    sleeves: robe,
  });

  let labelY = pose.headTop + 0.24;
  if (typeId === 'pilgrim') {
    const tunic = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.46, 10), robe));
    tunic.scale.z = 0.78;
    tunic.position.y = 0.44;
    group.add(tunic);
    const cord = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 12), cloth(type.accent)));
    cord.rotation.x = Math.PI / 2;
    cord.position.y = 0.64;
    group.add(cord);
    const hood = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.85),
      robe,
    ));
    hood.position.set(0, pose.headY + 0.04, 0.01);
    group.add(hood);
    addHeldPole(group, {
      x: pose.handR.x,
      y: 0.62,
      z: pose.handR.z,
      length: 1.18,
      woodColor: 0x5b3c22,
    });
  } else if (typeId === 'mercenary') {
    const plate = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.28, 10), accent));
    plate.scale.z = 0.52;
    plate.position.set(0, 0.9, 0.04);
    group.add(plate);
    for (const side of [-1, 1]) {
      const pauldron = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), accent));
      pauldron.scale.set(1.15, 0.7, 0.95);
      pauldron.position.set(side * pose.shoulderX, pose.shoulderY + 0.02, 0.01);
      group.add(pauldron);
    }
    const helm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), accent));
    helm.scale.set(0.98, 0.88, 0.95);
    helm.position.set(0, pose.headY + 0.03, 0.01);
    group.add(helm);
    const visor = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.045, 10), metal(0x6a5a3a)));
    visor.scale.z = 0.55;
    visor.position.set(0, pose.headY + 0.02, 0.06);
    group.add(visor);
    labelY = pose.headTop + 0.2;
  } else if (typeId === 'ranger') {
    const vest = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.108, 0.26, 10), cloth(0x2f3a26)));
    vest.scale.z = 0.62;
    vest.position.set(0, 0.9, 0.02);
    group.add(vest);
    const hood = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7),
      robe,
    ));
    hood.position.set(0, pose.headY + 0.05, 0.01);
    group.add(hood);
    const quiver = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.32, 8), wood(0x5a3a22)));
    quiver.position.set(-0.08, 0.92, -0.12);
    quiver.rotation.z = 0.35;
    group.add(quiver);
    const bow = addShadow(new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.014, 6, 14, Math.PI),
      wood(0x7a5a32),
    ));
    bow.rotation.y = Math.PI / 2;
    bow.position.set(pose.handL.x, pose.handL.y + 0.16, pose.handL.z - 0.04);
    group.add(bow);
  } else {
    const robeSkirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.5, 10), robe));
    robeSkirt.scale.z = 0.78;
    robeSkirt.position.y = 0.42;
    group.add(robeSkirt);
    const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), accent));
    brim.position.y = pose.headTop - 0.02;
    group.add(brim);
    const hat = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), accent));
    hat.position.y = pose.headTop + 0.14;
    group.add(hat);
    addHeldPole(group, {
      x: pose.handR.x,
      y: 0.55,
      z: pose.handR.z,
      length: 0.95,
      woodColor: 0x2f4a3a,
      orb: { radius: 0.05, color: 0x9b6cff, emissive: 0x6a3cff },
    });
    labelY = pose.headTop + 0.42;
  }

  const label = makeNameSprite(type.name);
  label.position.y = labelY;
  group.add(label);

  const speech = makeSpeechSprite('…');
  speech.position.y = labelY + 0.3;
  speech.visible = false;
  group.add(speech);

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.78, 0.58),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pick.position.y = 0.9;
  pick.userData.kind = 'customer';
  group.add(pick);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.visible = false;
  group.add(ring);

  const hand = new THREE.Group();
  hand.name = 'hand';
  hand.position.set(pose.handR.x, pose.handR.y, pose.handR.z);
  group.add(hand);

  group.userData.hand = hand;
  group.userData.pick = pick;
  group.userData.speech = speech;
  group.userData.ring = ring;
  return group;
}

export function setSpeechText(adventurer, text) {
  const speech = adventurer.userData.speech;
  if (!speech) return;
  if (!text) {
    speech.visible = false;
    return;
  }
  speech.visible = true;
  speech.material.map = speechTexture(text, true);
  speech.material.needsUpdate = true;
}

function speechTexture(text, bubble = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 320, 80);
  ctx.fillStyle = bubble ? 'rgba(248, 232, 196, 0.92)' : 'rgba(28, 18, 10, 0.72)';
  roundRect(ctx, 16, 10, 288, 48, 12);
  ctx.fill();
  if (bubble) {
    ctx.beginPath();
    ctx.moveTo(150, 56);
    ctx.lineTo(162, 56);
    ctx.lineTo(156, 72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = bubble ? '#3a240e' : '#f6e4c4';
  ctx.font = bubble ? '700 26px Georgia, serif' : '600 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 35);
  const map = new THREE.CanvasTexture(canvas);
  map.needsUpdate = true;
  return map;
}

function makeNameSprite(text) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: speechTexture(text, false),
    transparent: true,
    depthTest: false,
  }));
  sprite.scale.set(0.9, 0.22, 1);
  sprite.renderOrder = 2;
  return sprite;
}

function makeSpeechSprite(text) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: speechTexture(text, true),
    transparent: true,
    depthTest: false,
  }));
  sprite.scale.set(1.15, 0.3, 1);
  sprite.renderOrder = 3;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildDust() {
  const count = 160;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = 0.3 + Math.random() * 2.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8d3a8,
    size: 0.035,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'dust';
  return points;
}

export function normalizeImported(root, targetSize, sitOnFloor = true) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  root.scale.multiplyScalar(targetSize / maxDim);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = box2.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  if (sitOnFloor) {
    const box3 = new THREE.Box3().setFromObject(root);
    root.position.y -= box3.min.y;
  } else {
    root.position.y -= center.y;
  }
  return root;
}

export function wareTopY(object) {
  const box = new THREE.Box3().setFromObject(object);
  return box.max.y + 0.02;
}
