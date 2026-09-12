import * as THREE from 'three';
import {
  CUSTOMERS,
  pickMageRobes,
  pickMercenaryPlate,
  pickPilgrimCiv,
  pickRangerHide,
  RECIPES,
  SHOP,
  appearanceColor,
  defaultAppearance,
  normalizeAppearance,
  isShelfItem,
} from './catalog.js';
import { wornMetal, weaveCloth, woodSurface, scaleHide, checkCloth } from './surfaces.js';

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

  const counter = buildCounter();
  counter.position.set(SHOP.counter.x, 0, SHOP.counter.z);
  root.add(counter);

  return root;
}

export function buildCounter() {
  const group = new THREE.Group();
  group.name = 'counter';
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.85), woodSurface(0x7a5230, 0.84, 1.6, 0.7, 4211)));
  top.position.y = 0.92;
  group.add(top);
  const clothMesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.03, 0.92), weaveCloth(0x7a3d32)));
  clothMesh.position.y = 0.98;
  group.add(clothMesh);
  const drape = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.16, 0.04), weaveCloth(0x6a332a, 0.94)));
  drape.position.set(0, 0.89, 0.46);
  group.add(drape);
  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.82, 0.7), woodSurface(0x4e301c, 0.9, 1.2, 1.1, 5029)));
  body.position.y = 0.46;
  group.add(body);
  const dish = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), wornMetal(0xb08a3c, 0.32, 0.62)));
  dish.position.set(0.7, 1.03, 0.1);
  group.add(dish);
  return group;
}

export function buildDefaultTable() {
  const group = new THREE.Group();
  group.name = 'table';
  const oak = woodSurface(0x8a5a32, 0.86, 1.1, 0.7, 4211);
  const legWood = woodSurface(0x3f2716, 0.9, 0.35, 1.3, 6113);
  const top = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.85), oak));
  top.position.y = 0.82;
  group.add(top);
  const clothMesh = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.02, 0.7), weaveCloth(0x7a3d32)));
  clothMesh.position.y = 0.87;
  group.add(clothMesh);
  for (const [x, z] of [
    [-0.52, -0.3],
    [0.52, -0.3],
    [-0.52, 0.3],
    [0.52, 0.3],
  ]) {
    const leg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), legWood));
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
  const hipY = 0.58;
  const shoulderY = 1.0;
  const shoulderX = 0.152;

  const rig = { legL: null, legR: null, armL: null, armR: null };

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * hipX, hipY, 0);
    group.add(leg);
    if (side < 0) rig.legL = leg;
    else rig.legR = leg;

    const thigh = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.038, 0.26, 7), pants));
    thigh.position.set(side * (hipX * 0.72 - hipX), 0.49 - hipY, 0);
    thigh.rotation.z = side * -0.09;
    leg.add(thigh);

    const knee = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 6), pants));
    knee.position.set(side * (hipX + 0.014 - hipX), 0.35 - hipY, 0);
    leg.add(knee);

    const shin = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.28, 7), pants));
    shin.position.set(side * (hipX + 0.006 - hipX), 0.20 - hipY, 0);
    shin.rotation.z = side * 0.07;
    leg.add(shin);

    const foot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), bootMat));
    foot.scale.set(1.12, 0.52, 1.9);
    foot.position.set(side * (hipX - hipX), 0.03 - hipY, 0.03);
    leg.add(foot);
  }

  const hips = addShadow(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.088, 0),
    new THREE.Vector2(0.122, 0.032),
    new THREE.Vector2(0.116, 0.09),
    new THREE.Vector2(0.098, 0.13),
  ], 10), pants));
  hips.position.y = hipY;
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

  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.38 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.42 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x8a4a40, roughness: 0.62 });
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), eyeWhite);
    white.scale.set(1.05, 0.48, 0.38);
    white.position.set(side * 0.038, 1.238, 0.092);
    group.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 5), eyeMat);
    pupil.scale.set(1.15, 0.7, 0.7);
    pupil.position.set(side * 0.038, 1.236, 0.105);
    group.add(pupil);
    const brow = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.008, 0.01), skin));
    brow.position.set(side * 0.04, 1.258, 0.095);
    brow.rotation.z = side * -0.12;
    group.add(brow);
  }

  const mouth = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.01, 0.012), lip));
  mouth.position.set(0, 1.168, 0.102);
  group.add(mouth);

  const nose = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.036, 5), skin));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.208, 0.102);
  group.add(nose);

  const hands = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * shoulderX, shoulderY, 0);
    group.add(arm);
    if (side < 0) rig.armL = arm;
    else rig.armR = arm;

    const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), sleeveMat));
    cap.scale.set(1.08, 0.82, 0.9);
    cap.position.set(0, 0, 0);
    arm.add(cap);

    const upper = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.22, 7), sleeveMat));
    upper.position.set(side * 0.022, 0.87 - shoulderY, 0.016);
    upper.rotation.z = side * 0.16;
    arm.add(upper);

    const elbow = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), sleeveMat));
    elbow.position.set(side * 0.042, 0.75 - shoulderY, 0.03);
    arm.add(elbow);

    const forearm = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.2, 7), sleeveMat));
    forearm.position.set(side * 0.056, 0.63 - shoulderY, 0.046);
    forearm.rotation.z = side * 0.12;
    arm.add(forearm);

    const palm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.027, 6, 5), skin));
    palm.scale.set(0.9, 0.68, 1.12);
    palm.position.set(side * 0.07, 0.515 - shoulderY, 0.06);
    arm.add(palm);

    const hand = new THREE.Group();
    hand.name = side < 0 ? 'handL' : 'hand';
    hand.position.set(side * 0.07, 0.515 - shoulderY, 0.06);
    arm.add(hand);
    if (side < 0) hands.L = hand;
    else hands.R = hand;
  }

  group.userData.rig = rig;
  group.userData.hand = hands.R;
  group.userData.handL = hands.L;
  group.userData.walkPhase = 0;
  group.userData.walkRest = { legL: 0, legR: 0, armL: 0, armR: 0 };

  return {
    headY: 1.22,
    headTop: 1.345,
    shoulderY,
    shoulderX,
    handR: { x: shoulderX + 0.07, y: 0.515, z: 0.06 },
    handL: { x: -(shoulderX + 0.07), y: 0.515, z: 0.06 },
    rig,
  };
}

const HAIR_COLORS = [0x3a2416, 0x5a3a22, 0x1c1410, 0x8a6a3b, 0x2a2018, 0x4a3028];

export function addHair(group, pose, style = 'short', color = 0x3a2416) {
  if (!style || style === 'bald' || style === 'none') return null;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const hair = new THREE.Group();
  hair.name = 'hair';
  const cap = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.55),
    mat,
  ));
  cap.position.set(0, pose.headY + 0.04, 0.01);
  hair.add(cap);

  if (style === 'long' || style === 'ponytail') {
    const fall = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.42, 8), mat));
    fall.position.set(0, pose.headY - 0.12, -0.08);
    fall.rotation.x = 0.35;
    hair.add(fall);
  }
  if (style === 'ponytail') {
    const tail = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.38, 7), mat));
    tail.position.set(0, pose.headY - 0.22, -0.12);
    tail.rotation.x = 0.55;
    hair.add(tail);
  }
  if (style === 'bun') {
    const bun = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 7), mat));
    bun.position.set(0, pose.headY + 0.14, -0.06);
    hair.add(bun);
  }
  if (style === 'bob') {
    const bob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat));
    bob.scale.set(1.05, 0.72, 1.05);
    bob.position.set(0, pose.headY - 0.02, 0.01);
    hair.add(bob);
  }
  if (style === 'crop') {
    cap.scale.set(0.96, 0.72, 0.96);
  }
  if (style === 'mohawk') {
    cap.scale.set(0.55, 0.42, 0.88);
    const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.16), mat));
    ridge.position.set(0, pose.headY + 0.14, 0.01);
    hair.add(ridge);
  }
  group.add(hair);
  return hair;
}

export function addFaceHair(group, pose, style = 'none', color = 0x3a2416) {
  if (!style || style === 'none') return null;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const face = new THREE.Group();
  face.name = 'face-hair';
  if (style === 'beard' || style === 'goatee') {
    const chin = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(style === 'beard' ? 0.07 : 0.04, 8, 6),
      mat,
    ));
    chin.scale.set(style === 'beard' ? 1.15 : 0.7, 0.7, 0.55);
    chin.position.set(0, pose.headY - 0.1, 0.08);
    face.add(chin);
  }
  if (style === 'beard' || style === 'moustache') {
    const stache = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.03), mat));
    stache.position.set(0, pose.headY - 0.04, 0.11);
    face.add(stache);
  }
  if (style === 'moustache') {
    for (const side of [-1, 1]) {
      const wing = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.014, 0.02), mat));
      wing.position.set(side * 0.045, pose.headY - 0.042, 0.1);
      wing.rotation.z = side * 0.4;
      face.add(wing);
    }
  }
  group.add(face);
  return face;
}

function restX(mesh, key) {
  return mesh?.userData?.walkRest?.[key] ?? 0;
}

function restScaleY(mesh, body) {
  const stored = mesh?.userData?.walkRest?.scaleY;
  if (Number.isFinite(stored)) return stored;
  return body?.scale?.y ?? 1;
}

export function updateWalkPose(mesh, moving, dt = 0.016, now = 0) {
  const rig = mesh?.userData?.rig;
  const body = mesh?.userData?.walkBody;
  const settle = (obj, rest = 0) => {
    if (!obj) return;
    const k = 1 - Math.exp(-dt * 16);
    obj.rotation.x += (rest - obj.rotation.x) * k;
    if (Math.abs(obj.rotation.x - rest) < 0.012) obj.rotation.x = rest;
  };
  const settleBody = () => {
    if (!body || body === mesh) return;
    const k = 1 - Math.exp(-dt * 14);
    body.rotation.x += (0 - body.rotation.x) * k;
    body.rotation.z += (0 - body.rotation.z) * k;
    const restY = restScaleY(mesh, body);
    body.scale.y += (restY - body.scale.y) * k;
  };
  if (!rig?.legL || !rig?.legR) {
    if (moving) {
      mesh.userData.walkPhase = (mesh.userData.walkPhase ?? 0) + dt * 9.2;
      const phase = mesh.userData.walkPhase;
      mesh.position.y = Math.abs(Math.sin(phase * 2)) * 0.046;
      if (body) {
        body.rotation.z = Math.sin(phase) * 0.07;
        body.rotation.x = Math.abs(Math.sin(phase * 2)) * 0.035;
        body.scale.y = restScaleY(mesh, body) * (1 - Math.abs(Math.sin(phase * 2)) * 0.035);
      }
      return;
    }
    mesh.userData.walkPhase = 0;
    mesh.position.y += (0 - mesh.position.y) * (1 - Math.exp(-dt * 16));
    if (Math.abs(mesh.position.y) < 0.002) mesh.position.y = 0;
    settleBody();
    return;
  }
  const phase = mesh.userData.walkPhase ?? 0;
  if (moving) {
    mesh.userData.walkPhase = phase + dt * 9.2;
    const swing = Math.sin(mesh.userData.walkPhase) * 0.62;
    rig.legL.rotation.x = restX(mesh, 'legL') + swing;
    rig.legR.rotation.x = restX(mesh, 'legR') - swing;
    if (rig.armL) rig.armL.rotation.x = restX(mesh, 'armL') - swing * 0.72;
    if (rig.armR) rig.armR.rotation.x = restX(mesh, 'armR') + swing * 0.72;
    mesh.position.y = Math.abs(Math.sin(mesh.userData.walkPhase * 2)) * 0.028;
    if (body) {
      body.rotation.z = Math.sin(mesh.userData.walkPhase) * 0.04;
      body.scale.y = restScaleY(mesh, body) * (1 - Math.abs(Math.sin(mesh.userData.walkPhase * 2)) * 0.02);
    }
    return;
  }
  mesh.userData.walkPhase = 0;
  settle(rig.legL, restX(mesh, 'legL'));
  settle(rig.legR, restX(mesh, 'legR'));
  settle(rig.armL, restX(mesh, 'armL'));
  settle(rig.armR, restX(mesh, 'armR'));
  settleBody();
  mesh.position.y += (0 - mesh.position.y) * (1 - Math.exp(-dt * 16));
  if (Math.abs(mesh.position.y) < 0.002) mesh.position.y = 0;
}

function shaftTip(posY, rotZ, halfLen) {
  return {
    x: -halfLen * Math.sin(rotZ),
    y: posY + halfLen * Math.cos(rotZ),
    z: 0,
  };
}

function assemblePickaxe(group, opts = {}) {
  const tint = opts.tint ?? 0x6a7078;
  const spikeTint = opts.spikeTint ?? tint;
  const rotZ = opts.rotZ ?? 0.48;
  const haftY = opts.haftY ?? 0.16;
  const haftLen = opts.haftLen ?? 0.4;
  const innerR = opts.innerR ?? 0.014;
  const outerR = opts.outerR ?? 0.016;
  const headSize = opts.headSize ?? [0.16, 0.045, 0.045];
  const spikeA = opts.spikeA ?? { r: 0.028, h: 0.12, ox: 0.085, oy: -0.03, rot: 1.15 };
  const spikeB = opts.spikeB ?? { r: 0.024, h: 0.1, ox: -0.072, oy: 0.036, rot: -1.05 };
  const halfLen = haftLen / 2;
  const haft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(innerR, outerR, haftLen, 8), wood(0x5a3a22)));
  haft.name = 'pickaxe-haft';
  haft.position.set(0, haftY, 0);
  haft.rotation.z = rotZ;
  group.add(haft);
  const tip = shaftTip(haftY, rotZ, halfLen);
  const band = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(outerR + 0.01, outerR + 0.008, 0.045, 8),
    metal(tint),
  ));
  band.position.set(tip.x * 0.86, tip.y - 0.018 * Math.cos(rotZ), 0);
  band.rotation.z = rotZ;
  group.add(band);
  const head = addShadow(new THREE.Mesh(new THREE.BoxGeometry(headSize[0], headSize[1], headSize[2]), metal(tint)));
  head.name = 'pickaxe-head';
  head.position.set(tip.x, tip.y, 0);
  head.rotation.z = rotZ + 0.12;
  group.add(head);
  const spike = addShadow(new THREE.Mesh(new THREE.ConeGeometry(spikeA.r, spikeA.h, 6), metal(spikeTint)));
  spike.position.set(tip.x + spikeA.ox, tip.y + spikeA.oy, 0);
  spike.rotation.z = rotZ + spikeA.rot;
  group.add(spike);
  const spike2 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(spikeB.r, spikeB.h, 6), metal(spikeTint)));
  spike2.position.set(tip.x + spikeB.ox, tip.y + spikeB.oy, 0);
  spike2.rotation.z = rotZ + spikeB.rot;
  group.add(spike2);
}

export function poseHeldPickaxe(pickaxe) {
  if (!pickaxe) return;
  pickaxe.position.set(0.012, 0.0, 0.02);
  pickaxe.rotation.set(-0.62, 0.2, 0.1);
}

export function buildPickaxe() {
  const group = new THREE.Group();
  group.name = 'pickaxe';
  assemblePickaxe(group);
  return group;
}

export function setHeldTool(mesh, tool) {
  const hammers = mesh?.userData?.hammers ?? [];
  for (const part of hammers) {
    if (part) part.visible = tool === 'hammer';
  }
  if (mesh?.userData?.pickaxe) mesh.userData.pickaxe.visible = tool === 'pickaxe';
}

export function updateMinePose(mesh, dt = 0.016, now = 0) {
  const rig = mesh?.userData?.rig;
  const body = mesh?.userData?.walkBody;
  const swing = Math.sin(now * 8.2) * 0.72 - 0.32;
  if (rig?.armR) {
    rig.armR.rotation.x = restX(mesh, 'armR') + swing;
    if (rig.armL) rig.armL.rotation.x = restX(mesh, 'armL') - 0.18;
  } else if (body && body !== mesh) {
    body.rotation.x = swing * 0.35;
  }
  mesh.position.y = Math.abs(Math.sin(now * 16.4)) * 0.014;
}

function hashStyle(seed) {
  const raw = Number(seed);
  let s = Math.abs(Math.floor((Number.isFinite(raw) ? raw : Math.random()) * 2147483646)) % 2147483646;
  if (s < 1) s = 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  rand();
  return rand;
}

function addHeldPole(group, { x, y, z, length, woodColor, orb, name }) {
  const stave = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, length, 6),
    wood(woodColor),
  ));
  stave.position.set(x, y, z);
  if (name) stave.name = name;
  group.add(stave);
  if (!orb) return stave;
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
  return stave;
}

export function buildShopkeeper(opts = {}) {
  const look = normalizeAppearance(opts.appearance ?? defaultAppearance());
  const group = new THREE.Group();
  group.name = 'shopkeeper';
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2c2a0, roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: appearanceColor('shirt', look.shirt), roughness: 0.86 });
  const leather = cloth(0x5a3a22, 0.88);
  const hairColor = 0x3a2416;
  const pose = addHumanoid(group, {
    skin,
    shirt,
    pants: new THREE.MeshStandardMaterial({ color: appearanceColor('legs', look.legs), roughness: 0.88 }),
    boots: new THREE.MeshStandardMaterial({ color: appearanceColor('boots', look.boots), roughness: 0.86 }),
    sleeves: skin,
  });

  const rig = group.userData.rig;
  if (rig?.armL && rig?.armR) {
    for (const [arm, side] of [[rig.armL, -1], [rig.armR, 1]]) {
      const cuff = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.1, 7), shirt));
      cuff.position.set(side * 0.02, -0.08, 0.01);
      cuff.rotation.z = side * 0.16;
      arm.add(cuff);
      const band = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.04, 7), leather));
      band.position.set(side * 0.056, -0.38, 0.046);
      arm.add(band);
    }
  }

  const belt = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.014, 6, 12), leather));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.66;
  group.add(belt);

  if (opts.chefHat) {
    const apron = cloth(0x6a4a32, 0.9);
    const bib = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.34, 8), apron));
    bib.scale.z = 0.24;
    bib.position.set(0, 0.9, 0.09);
    group.add(bib);
  }

  addHair(group, pose, look.hair, hairColor);
  addFaceHair(group, pose, look.faceHair, hairColor);

  const hammerHaft = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.38, 6),
    wood(0x5a3a22),
  ));
  hammerHaft.position.set(0, 0.16, 0.04);
  hammerHaft.rotation.z = 0.55;
  const hammerHead = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.07), metal(0x6a7078)));
  hammerHead.position.set(0.12, 0.3, 0.04);
  const pickaxe = buildPickaxe();
  pickaxe.visible = false;
  const hand = group.userData.hand;
  if (hand) {
    hand.add(hammerHaft);
    hand.add(hammerHead);
    hand.add(pickaxe);
    poseHeldPickaxe(pickaxe);
  } else {
    hammerHaft.position.set(pose.handR.x, pose.handR.y + 0.08, pose.handR.z + 0.04);
    group.add(hammerHaft);
    hammerHead.position.set(pose.handR.x + 0.12, pose.handR.y + 0.22, pose.handR.z + 0.04);
    group.add(hammerHead);
    pickaxe.position.set(pose.handR.x, pose.handR.y, pose.handR.z);
    group.add(pickaxe);
    poseHeldPickaxe(pickaxe);
    pickaxe.position.x += pose.handR.x;
    pickaxe.position.y += pose.handR.y;
    pickaxe.position.z += pose.handR.z;
  }
  hammerHaft.visible = false;
  hammerHead.visible = false;
  group.userData.hammers = [hammerHaft, hammerHead];
  group.userData.pickaxe = pickaxe;

  const chefHat = buildChefHat();
  chefHat.position.y = pose.headTop + 0.02;
  chefHat.visible = Boolean(opts.chefHat);
  group.add(chefHat);
  group.userData.chefHat = chefHat;
  group.userData.appearance = look;

  const label = makeNameSprite('You');
  label.position.y = pose.headTop + 0.28;
  group.add(label);
  return group;
}

export function buildChefHat() {
  const group = new THREE.Group();
  group.name = 'chef-hat';
  const white = cloth(0xf4f0e6, 0.86);
  const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 12), white));
  brim.position.y = 0.02;
  group.add(brim);
  const band = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.08, 12), white));
  band.position.y = 0.07;
  group.add(band);
  const puff = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white));
  puff.scale.set(1, 0.85, 1);
  puff.position.y = 0.2;
  group.add(puff);
  return group;
}

export function setChefHatVisible(keeper, on) {
  const hat = keeper?.userData?.chefHat;
  if (hat) hat.visible = Boolean(on);
}

export function buildAnvil() {
  const group = new THREE.Group();
  group.name = 'anvil';
  const iron = wornMetal(0x5a6068, 0.4, 0.78);
  const dark = wornMetal(0x2a2c30, 0.48, 0.7);
  const faceSteel = wornMetal(0xc4ccd4, 0.26, 0.86);
  const stump = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.26, 10), woodSurface(0x4a301c, 0.9, 1.2, 0.8, 5029)));
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
  const face = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.28), faceSteel));
  face.position.y = 0.7;
  group.add(face);
  const label = makeNameSprite('Anvil');
  label.position.y = 1.22;
  group.add(label);
  group.userData.wareY = 0.74;
  return group;
}

export function buildWallShelf() {
  const group = new THREE.Group();
  group.name = 'shelf';
  const boardWood = woodSurface(0x7a5230, 0.86, 1.15, 0.45, 4211);
  const railWood = woodSurface(0x3f2716, 0.9, 0.35, 1.2, 6113);
  const backWood = woodSurface(0x4e301c, 0.9, 1.2, 0.9, 5029);
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.07, 0.38), boardWood));
  board.position.y = 1.56;
  group.add(board);
  const board2 = board.clone();
  board2.position.y = 1.1;
  group.add(board2);
  const bracket = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), railWood));
  bracket.position.set(-0.55, 1.3, -0.12);
  group.add(bracket);
  const bracket2 = bracket.clone();
  bracket2.position.x = 0.55;
  group.add(bracket2);
  const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.82, 0.05), backWood));
  back.position.set(0, 1.33, -0.18);
  group.add(back);
  group.userData.wareY = 1.64;
  group.userData.shelfSlots = true;
  return group;
}

export function buildArmourStand() {
  const group = new THREE.Group();
  group.name = 'armour-stand';
  const post = woodSurface(0x3f2716, 0.88, 0.35, 1.6, 6113);
  const oak = woodSurface(0x7a5230, 0.9, 0.7, 0.9, 4211);
  const baseWood = woodSurface(0x4a301c, 0.9, 0.8, 0.8, 5029);
  const pole = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.48, 8), post));
  pole.position.y = 0.76;
  group.add(pole);
  const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), baseWood));
  base.position.y = 0.04;
  group.add(base);
  const hips = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.14), oak));
  hips.position.y = 0.5;
  group.add(hips);
  const torso = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.14), oak));
  torso.position.y = 0.92;
  group.add(torso);
  const shoulders = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), oak));
  shoulders.position.y = 1.16;
  group.add(shoulders);
  const armL = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.38, 8), post));
  armL.position.set(-0.24, 0.92, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.24;
  group.add(armR);
  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), post));
  neck.position.y = 1.28;
  group.add(neck);
  const knob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), oak));
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
    hatchet: () => addHatchet(group, tint),
    pickaxe: () => addWarePickaxe(group, tint),
    arrows: () => addArrows(group, tint),
    cannonballs: () => addCannonballs(group, tint),
    rune: () => addRune(group, recipe?.runeMark ?? 'air', tint),
    dhide_coif: () => addDhideCoif(group, tint),
    dhide_body: () => addDhideBody(group, tint),
    dhide_chaps: () => addChaps(group, tint),
    dhide_vambraces: () => addVambraces(group, tint),
    dhide_boots: () => addBoots(group, tint, false),
    bread: () => addBread(group, tint),
    pizza: () => addPizza(group, tint),
    cake: () => addCake(group, tint),
    pie: () => addPie(group, tint, 0xb45a4a),
    fish_pie: () => addPie(group, tint, 0x7a9aaa),
    salmon: () => addFish(group, tint, 1),
    lobster: () => addLobster(group, tint),
    chocolate_cake: () => addCake(group, tint, 0x3a2218),
    monkfish: () => addFish(group, tint, 1.12),
    curry: () => addCurry(group, tint),
    shark: () => addFish(group, tint, 1.35),
    summer_pie: () => addPie(group, tint, 0xe8a04a),
    anglerfish: () => addFish(group, tint, 1.22, true),
    potion: () => addPotion(group, tint),
    bar: () => addMetalBar(group, tint),
    bow_string: () => addBowStringCoil(group, tint),
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
  if (isShelfItem(recipe)) group.scale.setScalar(0.55);
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

/** Loft rectangular rings into a solid (flat-shaded). Rings are { y, w, d }. */
function rectLoftGeometry(rings) {
  const pos = [];
  const quad = (a, b, c, d) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    pos.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  };
  const ring = (r) => {
    const hw = r.w * 0.5;
    const hd = r.d * 0.5;
    return [
      [-hw, r.y, -hd],
      [hw, r.y, -hd],
      [hw, r.y, hd],
      [-hw, r.y, hd],
    ];
  };
  const pts = rings.map(ring);
  const bottom = pts[0];
  quad(bottom[0], bottom[3], bottom[2], bottom[1]);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const lo = pts[i];
    const hi = pts[i + 1];
    for (let k = 0; k < 4; k += 1) {
      const n = (k + 1) % 4;
      quad(lo[k], lo[n], hi[n], hi[k]);
    }
  }
  const top = pts[pts.length - 1];
  quad(top[0], top[1], top[2], top[3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Cast ingot: rectangular base, mid shoulder, tapered frustum top. Tint only changes per metal. */
function addMetalBar(group, tint) {
  const iron = metal(tint);
  const mesh = addShadow(new THREE.Mesh(rectLoftGeometry([
    { y: 0, w: 0.38, d: 0.2 },
    { y: 0.052, w: 0.38, d: 0.2 },
    { y: 0.06, w: 0.35, d: 0.185 },
    { y: 0.132, w: 0.22, d: 0.115 },
  ]), iron));
  group.add(mesh);
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
  const hiltX = -0.05;
  const hiltY = 0.16;
  const hiltRot = -0.28;
  addHilt(group, hiltX, hiltY, hiltRot, 0.2);
  const start = new THREE.Vector3(hiltX, hiltY, 0);
  const mid = new THREE.Vector3(0.2, 0.44, 0);
  const end = new THREE.Vector3(0.08, 0.78, 0);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const blade = addShadow(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 14, 0.028, 6, false),
    metal(tint),
  ));
  group.add(blade);
  const ricasso = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.02), metal(tint)));
  ricasso.position.set(hiltX + 0.03, hiltY + 0.05, 0);
  ricasso.rotation.z = hiltRot;
  group.add(ricasso);
  for (let i = 0; i < 8; i += 1) {
    const t = i / 8;
    const p = curve.getPoint(t);
    const belly = 0.034 + Math.sin(t * Math.PI) * 0.028;
    const seg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(belly, 0.07, 0.016), metal(tint)));
    seg.position.copy(p);
    seg.rotation.z = -0.55 + t * 1.15;
    group.add(seg);
  }
  const tipDir = curve.getTangent(1);
  const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), metal(tint)));
  tip.position.copy(curve.getPoint(1)).addScaledVector(tipDir, 0.05);
  tip.rotation.z = Math.atan2(tipDir.x, tipDir.y);
  group.add(tip);
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
  const plate = metal(tint);
  const trim = metal(0xc4a05a);
  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.65), plate));
  dome.position.y = 0.16;
  group.add(dome);
  const brow = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.18), plate));
  brow.position.set(0, 0.16, 0.05);
  group.add(brow);
  for (const side of [-1, 1]) {
    const cheek = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.14), plate));
    cheek.position.set(side * 0.1, 0.08, 0.04);
    group.add(cheek);
  }
  const visor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), metal(0x1a1a1a)));
  visor.position.set(0, 0.15, 0.14);
  group.add(visor);
  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 12), plate));
  neck.position.y = 0.04;
  group.add(neck);
  const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.18), trim));
  ridge.position.set(0, 0.24, 0);
  group.add(ridge);
}

function addMedHelm(group, tint) {
  const plate = metal(tint);
  const trim = metal(0xc4a05a);
  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), plate));
  dome.position.y = 0.14;
  group.add(dome);
  const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 14), plate));
  brim.position.y = 0.08;
  group.add(brim);
  const nasal = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.045), plate));
  nasal.position.set(0, 0.08, 0.13);
  group.add(nasal);
  const collar = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 12), trim));
  collar.position.y = 0.03;
  group.add(collar);
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
  const R = 0.28 * scale;
  const tipX = 0.22 * scale;
  const bottom = new THREE.Vector3(tipX, 0.02 * scale, 0);
  const top = new THREE.Vector3(tipX, 2 * R - 0.02 * scale, 0);
  const belly = new THREE.Vector3(-R * 0.92, R, 0);
  const curve = new THREE.QuadraticBezierCurve3(bottom, belly, top);
  const limb = addShadow(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.016 * Math.max(1, scale * 0.85), 6, false),
    wood(tint),
  ));
  group.add(limb);
  const nockB = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.02 * scale, 6, 5), wood(tint)));
  nockB.position.copy(bottom);
  group.add(nockB);
  const nockT = nockB.clone();
  nockT.position.copy(top);
  group.add(nockT);
  const dir = top.clone().sub(bottom);
  const stringLen = dir.length() + 0.012 * scale;
  const string = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, stringLen, 6),
    new THREE.MeshStandardMaterial({ color: 0xead3ae, roughness: 0.5 }),
  ));
  string.position.copy(bottom).lerp(top, 0.5);
  if (dir.lengthSq() > 1e-8) {
    string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }
  group.add(string);
}

function addBowStringCoil(group, tint) {
  const fibre = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.86,
    metalness: 0.02,
  });
  const points = [];
  const turns = 5.2;
  const steps = 72;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 0.072 * (1 + Math.sin(t * 14) * 0.04);
    points.push(new THREE.Vector3(Math.cos(a) * r, 0.018 + t * 0.086, Math.sin(a) * r));
  }
  const tip = points[points.length - 1];
  points.push(new THREE.Vector3(tip.x * 0.55 + 0.06, tip.y - 0.012, tip.z * 0.35));
  points.push(new THREE.Vector3(0.14, 0.012, 0.03));
  points.push(new THREE.Vector3(0.17, 0.008, 0.055));
  const coil = addShadow(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 0.0085, 6, false),
    fibre,
  ));
  group.add(coil);
  const band = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.007, 6, 14), cloth(0xb8a070)));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.055;
  group.add(band);
}

function addHeldBow(parent, tint, scale = 0.85) {
  const bow = new THREE.Group();
  addBow(bow, tint, scale);
  bow.rotation.set(-0.15, Math.PI / 2, 0.2);
  bow.position.set(0.02, 0.08, 0.04);
  parent.add(bow);
  return bow;
}

function addCannonballs(group, tint) {
  const steel = metal(tint);
  for (const [x, z, y, s] of [
    [-0.05, 0.02, 0.07, 1],
    [0.05, -0.01, 0.07, 0.92],
    [0.0, 0.06, 0.07, 0.88],
    [0.0, 0.0, 0.14, 0.78],
  ]) {
    const ball = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 10, 8), steel));
    ball.position.set(x, y, z);
    group.add(ball);
  }
}

function addRune(group, mark, tint) {
  const stone = new THREE.MeshStandardMaterial({
    color: 0x8a8a90,
    roughness: 0.55,
    metalness: 0.18,
  });
  const disc = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.028, 20), stone));
  disc.position.y = 0.05;
  group.add(disc);
  const ink = glow(tint);
  const y = 0.068;
  if (mark === 'air') {
    for (const [sx, rot] of [[0.055, 0.4], [0.038, 1.8], [0.07, -1.1]]) {
      const swirl = addShadow(new THREE.Mesh(new THREE.TorusGeometry(sx, 0.008, 6, 14, Math.PI * 1.15), ink));
      swirl.rotation.x = Math.PI / 2;
      swirl.rotation.z = rot;
      swirl.position.y = y;
      group.add(swirl);
    }
  } else if (mark === 'earth') {
    for (const [x, w, rot] of [[-0.02, 0.11, 0.35], [0.015, 0.1, -0.2], [0.0, 0.08, 0.7]]) {
      const wave = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.018), ink));
      wave.position.set(x, y, rot * 0.04);
      wave.rotation.y = rot;
      group.add(wave);
    }
  } else if (mark === 'water') {
    const drop = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), ink));
    drop.scale.set(0.85, 1.15, 0.85);
    drop.position.set(0, y + 0.01, 0.01);
    group.add(drop);
    const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.05, 8), ink));
    tip.position.set(0, y + 0.04, 0.01);
    group.add(tip);
  } else {
    for (const [x, h, lean] of [[0, 0.08, 0], [-0.03, 0.06, 0.35], [0.028, 0.055, -0.28]]) {
      const flame = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.018, h, 6), ink));
      flame.position.set(x, y + h * 0.35, 0);
      flame.rotation.z = lean;
      group.add(flame);
    }
  }
}

function addArrows(group, tint) {
  const wrap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), cloth(0x5a3a22)));
  wrap.position.y = 0.16;
  group.add(wrap);
  for (const [x, z, rot] of [[-0.02, 0.01, -0.08], [0.015, -0.015, 0.06], [0.0, 0.02, 0.12]]) {
    const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.42, 6), wood(0x7a5a32)));
    shaft.position.set(x, 0.28, z);
    shaft.rotation.z = rot;
    group.add(shaft);
    const head = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 5), metal(tint)));
    head.position.set(x, 0.5, z);
    head.rotation.z = rot;
    group.add(head);
    const fletch = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.008), cloth(tint)));
    fletch.position.set(x, 0.1, z);
    group.add(fletch);
  }
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

function addHatchet(group, tint) {
  const rotZ = 0.38;
  const haft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.52, 8), wood(0x5a3a22)));
  haft.position.set(0, 0.28, 0);
  haft.rotation.z = rotZ;
  group.add(haft);
  const tip = shaftTip(0.28, rotZ, 0.26);
  const collar = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.06, 8), metal(tint)));
  collar.position.set(tip.x * 0.72, tip.y - 0.04, 0);
  collar.rotation.z = rotZ;
  group.add(collar);
  const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.028), metal(tint)));
  blade.position.set(tip.x + 0.07, tip.y + 0.01, 0);
  blade.rotation.z = rotZ - 0.15;
  group.add(blade);
  const bit = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.1, 6), metal(tint)));
  bit.position.set(tip.x + 0.15, tip.y + 0.02, 0);
  bit.rotation.z = rotZ + Math.PI / 2;
  group.add(bit);
  const poll = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), metal(tint)));
  poll.position.set(tip.x - 0.04, tip.y - 0.01, 0);
  poll.rotation.z = rotZ;
  group.add(poll);
}

function addWarePickaxe(group, tint) {
  assemblePickaxe(group, {
    tint,
    spikeTint: tint,
    rotZ: 0.42,
    haftY: 0.3,
    haftLen: 0.56,
    innerR: 0.016,
    outerR: 0.022,
    headSize: [0.22, 0.05, 0.05],
    spikeA: { r: 0.03, h: 0.16, ox: 0.12, oy: -0.04, rot: 1.15 },
    spikeB: { r: 0.026, h: 0.12, ox: -0.1, oy: 0.05, rot: -1.05 },
  });
}

function addDhideCoif(group, tint) {
  const hide = cloth(tint);
  const lining = cloth(0x3a2a1c);
  const hood = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.42),
    hide,
  ));
  hood.scale.set(1.02, 1.08, 1.05);
  hood.position.y = 0.22;
  group.add(hood);
  const brim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 7, 16, Math.PI * 1.25), hide));
  brim.rotation.x = 0.55;
  brim.position.set(0, 0.2, 0.05);
  group.add(brim);
  const drape = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 10), hide));
  drape.position.set(0, 0.06, -0.05);
  drape.rotation.x = 0.42;
  group.add(drape);
  const tie = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), lining));
  tie.position.set(0, 0.14, 0.12);
  group.add(tie);
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

function addCake(group, tint, icingColor = 0xf4e8d0) {
  const cake = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.86,
  })));
  cake.position.y = 0.06;
  group.add(cake);
  const icing = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.12, 0.03, 12), cloth(icingColor)));
  icing.position.y = 0.12;
  group.add(icing);
}

function addFish(group, tint, scale = 1, lantern = false) {
  const body = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 10, 8), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.55,
  })));
  body.scale.set(1.7, 0.7, 0.85);
  body.position.y = 0.05 * scale;
  group.add(body);
  const tail = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.055 * scale, 0.1 * scale, 6), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.6,
  })));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.16 * scale, 0.05 * scale, 0);
  group.add(tail);
  if (lantern) {
    const lamp = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.028 * scale, 8, 6), glow(0xf0d27a)));
    lamp.position.set(0.16 * scale, 0.1 * scale, 0);
    group.add(lamp);
  }
}

function addLobster(group, tint) {
  const body = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.7,
  })));
  body.scale.set(1.35, 0.55, 0.8);
  body.position.y = 0.05;
  group.add(body);
  for (const side of [-1, 1]) {
    const claw = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.65,
    })));
    claw.scale.set(1.4, 0.7, 0.8);
    claw.position.set(0.1, 0.05, side * 0.08);
    group.add(claw);
  }
}

function addCurry(group, tint) {
  const bowl = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.07, 12), new THREE.MeshStandardMaterial({
    color: 0xc8b48a,
    roughness: 0.55,
  })));
  bowl.position.y = 0.04;
  group.add(bowl);
  const stew = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.45,
  })));
  stew.position.y = 0.075;
  group.add(stew);
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
  const oak = woodSurface(0xc49a62, 0.88, 1, 1, 4211);
  const dark = woodSurface(0x7a4a28, 0.9, 1, 0.7, 5029);
  const lidWood = woodSurface(0xd2a86c, 0.86, 1, 1.15, 6113);
  const band = wornMetal(0xb08a3c, 0.34, 0.64);

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
  const lidBoard = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.62), lidWood));
  lidBoard.position.set(0, 0.04, 0.31);
  lid.add(lidBoard);
  const lidRound = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.9, 12, 1, false, 0, Math.PI),
    lidWood,
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
  root.scale.setScalar(0.6);

  return root;
}

export function setChestLid(chest, open, dt = 1) {
  const lid = chest.userData.lid;
  if (!lid) return;
  const target = open ? -1.15 : 0;
  lid.rotation.x += (target - lid.rotation.x) * Math.min(1, dt * 8);
}

function dressKing(group, { pose, type }) {
  const robe = cloth(type.robe);
  const mantle = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.62, 11), robe));
  mantle.name = 'cue-cape';
  mantle.scale.z = 0.86;
  mantle.position.y = 0.5;
  group.add(mantle);
  const fur = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 14), cloth(0xf4eee4)));
  fur.rotation.x = Math.PI / 2;
  fur.position.y = 0.78;
  group.add(fur);
  const stole = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.54, 0.045), cloth(0xf4eee4)));
  stole.name = 'cue-stole';
  stole.position.set(0, 0.7, 0.12);
  group.add(stole);
  const diamond = metal(0xe8e4f0);
  const spots = [
    [-0.04, 0.88], [0.04, 0.8], [0, 0.7], [-0.038, 0.58], [0.036, 0.5],
  ];
  for (const [x, y] of spots) {
    const gem = addShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), diamond));
    gem.name = 'cue-diamond';
    gem.position.set(x, y, 0.148);
    group.add(gem);
  }
  const crown = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.1, 10), metal(0xe3b34a)));
  crown.name = 'cue-crown';
  crown.position.y = pose.headTop + 0.03;
  group.add(crown);
  for (const side of [-1, -0.5, 0, 0.5, 1]) {
    const point = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 5), metal(0xe3b34a)));
    point.position.set(side * 0.09, pose.headTop + 0.1, 0.02);
    group.add(point);
  }
  const gem = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow(0xc42a28)));
  gem.name = 'cue-gem';
  gem.position.set(0, pose.headTop + 0.07, 0.13);
  group.add(gem);
  const cuff = cloth(0xf4eee4);
  for (const side of [-1, 1]) {
    const band = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.042, 8), cuff));
    band.name = 'cue-cuff';
    band.position.set(side * pose.handR.x, pose.handR.y + 0.055, pose.handR.z);
    group.add(band);
  }
  return pose.headTop + 0.38;
}

function addHeldShortSword(parent, tint) {
  const group = new THREE.Group();
  const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.32, 0.01), metal(tint)));
  blade.position.y = 0.16;
  group.add(blade);
  const guard = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.02), metal(0xc4a05a)));
  group.add(guard);
  group.rotation.set(0.1, 0, -0.35);
  group.position.set(0.02, 0.04, 0.02);
  parent.add(group);
  return group;
}

function addHeldMallet(parent) {
  const group = new THREE.Group();
  const haft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.32, 6), wood(0x5a3a22)));
  haft.position.y = 0.12;
  group.add(haft);
  const head = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.07), wood(0x6a4a28)));
  head.position.y = 0.26;
  group.add(head);
  group.rotation.set(0.15, 0.1, -0.4);
  group.position.set(0.02, 0.05, 0.02);
  parent.add(group);
  return group;
}

function addHeldBouquet(parent) {
  const group = new THREE.Group();
  const stems = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 6), cloth(0x3a5a28)));
  stems.position.y = 0.08;
  group.add(stems);
  for (const [x, y, z, hex] of [[-0.03, 0.2, 0.01, 0x6a3a88], [0.02, 0.22, -0.01, 0xc8d0e4], [0.0, 0.18, 0.02, 0x6a3a88]]) {
    const bloom = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 6), cloth(hex)));
    bloom.position.set(x, y, z);
    group.add(bloom);
  }
  group.rotation.set(0.2, 0, 0.25);
  group.position.set(0.02, 0.04, 0.02);
  parent.add(group);
  return group;
}

function dressPilgrim(group, { pose, rand, set: given }) {
  const kit = given ?? pickPilgrimCiv(rand);
  group.userData.pilgrimSet = kit.id;
  let labelY = pose.headTop + 0.22;

  if (kit.style === 'tunic') {
    const tunic = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.28, 10), cloth(kit.shirt)));
    tunic.name = 'cue-tunic';
    tunic.scale.z = 0.62;
    tunic.position.y = 0.9;
    group.add(tunic);
    if (kit.gloves) {
      for (const hand of [group.userData.hand, group.userData.handL]) {
        if (!hand) continue;
        const glove = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), cloth(kit.gloves)));
        glove.scale.set(1.05, 0.68, 1.1);
        hand.add(glove);
      }
    }
  } else if (kit.style === 'gentry') {
    const doublet = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.118, 0.3, 10), cloth(kit.shirt)));
    doublet.name = 'cue-tunic';
    doublet.scale.z = 0.62;
    doublet.position.y = 0.9;
    group.add(doublet);
    const ruff = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 14), cloth(kit.ruff)));
    ruff.name = 'cue-ruff';
    ruff.rotation.x = Math.PI / 2;
    ruff.position.y = 1.08;
    group.add(ruff);
    const cape = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 9), cloth(kit.cape)));
    cape.name = 'cue-cape';
    cape.position.set(0, 0.62, -0.08);
    cape.rotation.x = 0.32;
    group.add(cape);
  } else if (kit.style === 'skirt') {
    const crop = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.108, 0.18, 10), cloth(kit.shirt)));
    crop.name = 'cue-tunic';
    crop.scale.z = 0.64;
    crop.position.y = 0.96;
    group.add(crop);
    const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.62, 10), cloth(kit.skirt)));
    skirt.name = 'cue-skirt';
    skirt.scale.z = 0.86;
    skirt.position.y = 0.42;
    group.add(skirt);
    const belt = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 12), cloth(kit.belt)));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.72;
    group.add(belt);
  } else if (kit.style === 'cook') {
    const bib = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.34, 8), cloth(kit.apron)));
    bib.name = 'cue-apron';
    bib.scale.z = 0.24;
    bib.position.set(0, 0.9, 0.09);
    group.add(bib);
    const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.28, 10), cloth(kit.apron)));
    skirt.scale.z = 0.7;
    skirt.position.set(0, 0.56, 0.02);
    group.add(skirt);
    const hat = buildChefHat();
    hat.name = 'cue-chefhat';
    hat.position.y = pose.headTop;
    group.add(hat);
    labelY = pose.headTop + 0.38;
  } else {
    const tunic = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.14, 0.26, 9), cloth(kit.shirt)));
    tunic.name = 'cue-tunic';
    tunic.scale.z = 0.64;
    tunic.position.y = 0.92;
    group.add(tunic);
    const wrap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.42, 9), cloth(kit.wrap ?? kit.pants)));
    wrap.scale.z = 0.8;
    wrap.position.y = 0.48;
    group.add(wrap);
    const sash = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 6, 12), cloth(kit.sash)));
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.7;
    group.add(sash);
  }

  const hold = group.userData.hand ?? group;
  if (kit.weapon === 'sword') {
    const sword = addHeldShortSword(hold, 0x4a4e54);
    sword.name = 'cue-sword';
  } else if (kit.weapon === 'mallet') {
    const mallet = addHeldMallet(hold);
    mallet.name = 'cue-mallet';
  } else if (kit.weapon === 'bouquet') {
    const flowers = addHeldBouquet(hold);
    flowers.name = 'cue-bouquet';
  }
  return labelY;
}

function addHeldScimitar(parent, tint) {
  const group = new THREE.Group();
  addScimitar(group, tint);
  group.scale.setScalar(0.52);
  group.rotation.set(0.15, 0.2, -0.85);
  group.position.set(0.02, 0.06, 0.03);
  parent.add(group);
  return group;
}

function addKiteShield(group, kit) {
  const shield = new THREE.Group();
  shield.name = 'cue-shield';
  const rim = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.024), metal(kit.shieldRim)));
  shield.add(rim);
  const face = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.31, 0.03), metal(kit.shield)));
  face.position.z = 0.006;
  shield.add(face);
  const barH = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.012), metal(kit.shieldRim)));
  barH.position.z = 0.02;
  shield.add(barH);
  const barV = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.012), metal(kit.shieldRim)));
  barV.position.z = 0.02;
  shield.add(barV);
  shield.position.set(-0.24, 0.78, 0.02);
  shield.rotation.y = 0.42;
  group.add(shield);
  return shield;
}

function dressMercenary(group, { pose, rand, set: given }) {
  const kit = given ?? pickMercenaryPlate(rand);
  group.userData.mercenarySet = kit.id;
  const plateMat = metal(kit.plate);
  const trimMat = metal(kit.trim);
  const body = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.122, 0.34, 10), plateMat));
  body.name = 'cue-plate';
  body.scale.z = 0.6;
  body.position.set(0, 0.9, 0.03);
  group.add(body);
  const gorget = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.08, 8), trimMat));
  gorget.position.y = 1.08;
  group.add(gorget);
  for (const side of [-1, 1]) {
    const pauldron = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), trimMat));
    pauldron.scale.set(1.25, 0.7, 1);
    pauldron.position.set(side * pose.shoulderX, pose.shoulderY + 0.03, 0.01);
    group.add(pauldron);
  }
  const legsMat = kit.legsStyle === 'hide' ? scaleHide(kit.legs) : metal(kit.legs);
  const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.22, 9), legsMat));
  skirt.scale.z = 0.7;
  skirt.position.y = 0.58;
  group.add(skirt);
  for (const side of [-1, 1]) {
    const greave = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.24, 8), legsMat));
    greave.position.set(side * 0.074, 0.22, 0.01);
    group.add(greave);
    const boot = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.14), metal(kit.boots)));
    boot.position.set(side * 0.074, 0.05, 0.04);
    group.add(boot);
    const toe = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), metal(kit.boots)));
    toe.rotation.x = Math.PI / 2;
    toe.position.set(side * 0.074, 0.04, 0.12);
    group.add(toe);
  }
  const helm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 11, 9), plateMat));
  helm.name = 'cue-helm';
  helm.scale.set(1.04, 1.02, 1.08);
  helm.position.set(0, pose.headY + 0.05, 0.02);
  group.add(helm);
  const visor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.05), metal(0x1a1814)));
  visor.position.set(0, pose.headY + 0.03, 0.14);
  group.add(visor);
  if (kit.plumeOn) {
    const plume = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 6), cloth(kit.plume)));
    plume.position.set(0.02, pose.headY + 0.24, -0.02);
    plume.rotation.z = 0.35;
    group.add(plume);
    const puff = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 6), cloth(kit.plume)));
    puff.position.set(0.06, pose.headY + 0.3, -0.02);
    group.add(puff);
  }
  const cord = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 5, 12), metal(0xe3b34a)));
  cord.name = 'cue-amulet';
  cord.rotation.x = Math.PI / 2;
  cord.position.y = pose.shoulderY - 0.04;
  group.add(cord);
  const charm = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 12), metal(0xe3b34a)));
  charm.position.set(0, pose.shoulderY - 0.12, 0.09);
  group.add(charm);
  const gem = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.014, 7, 6), glow(0xb42a22)));
  gem.position.set(0, pose.shoulderY - 0.12, 0.09);
  group.add(gem);
  for (const hand of [group.userData.hand, group.userData.handL]) {
    if (!hand) continue;
    const glove = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.036, 7, 6), metal(kit.gloves)));
    glove.scale.set(1.08, 0.7, 1.15);
    hand.add(glove);
  }
  addKiteShield(group, kit);
  const hold = group.userData.hand ?? group;
  const scim = addHeldScimitar(hold, kit.plate);
  scim.name = 'cue-scimitar';
  return pose.headTop + (kit.plumeOn ? 0.42 : 0.3);
}

function addHeldCrossbow(parent, tint) {
  const group = new THREE.Group();
  const stock = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.036), wood(tint)));
  stock.position.y = 0.06;
  group.add(stock);
  const prod = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.028), wood(tint)));
  prod.position.y = 0.16;
  group.add(prod);
  for (const side of [-1, 1]) {
    const limb = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.018), wood(tint)));
    limb.position.set(side * 0.16, 0.16, 0);
    limb.rotation.z = side * 0.42;
    group.add(limb);
  }
  const string = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.3, 5),
    new THREE.MeshStandardMaterial({ color: 0xead3ae, roughness: 0.5 }),
  ));
  string.rotation.z = Math.PI / 2;
  string.position.set(0, 0.12, 0.012);
  group.add(string);
  group.rotation.set(-0.22, Math.PI / 2, 0.12);
  group.position.set(0.02, 0.05, 0.04);
  parent.add(group);
  return group;
}

function addRangerQuiver(group, fletchHex, side = 1) {
  const rig = group.userData.rig;
  const parent = (side < 0 ? rig?.legL : rig?.legR) ?? group;
  const quiver = new THREE.Group();
  quiver.name = 'cue-quiver';
  const tube = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.26, 8), cloth(0x4a3018)));
  quiver.add(tube);
  const rim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 5, 10), cloth(0x2a1c10)));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  quiver.add(rim);
  for (const [dx, dy, dz] of [[-0.012, 0.16, 0.004], [0.01, 0.2, -0.006], [0.0, 0.18, 0.01]]) {
    const fletch = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.006), cloth(fletchHex)));
    fletch.position.set(dx, dy, dz);
    quiver.add(fletch);
  }
  if (parent === group) {
    quiver.position.set(side * 0.12, 0.52, 0.04);
    quiver.rotation.z = side * 0.18;
  } else {
    quiver.position.set(side * 0.058, -0.14, 0.05);
    quiver.rotation.z = side * 0.22;
    quiver.rotation.x = 0.12;
  }
  parent.add(quiver);
  return quiver;
}

function addRangerVambraces(group, mat) {
  const rig = group.userData.rig;
  if (!rig?.armL || !rig?.armR) return;
  for (const [arm, side] of [[rig.armL, -1], [rig.armR, 1]]) {
    const bracer = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.11, 7), mat));
    bracer.name = 'cue-vambrace';
    bracer.position.set(side * 0.056, -0.36, 0.046);
    bracer.rotation.z = side * 0.12;
    arm.add(bracer);
  }
}

function addRangerHood(group, pose, hex, { mask = false, name = 'cue-hood' } = {}) {
  const mat = cloth(hex);
  const hood = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.48),
    mat,
  ));
  hood.name = name;
  hood.position.set(0, pose.headY + 0.07, 0.01);
  group.add(hood);
  const drape = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat));
  drape.position.set(0, pose.headY - 0.04, -0.05);
  drape.rotation.x = 0.55;
  group.add(drape);
  if (mask) {
    const wrap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.08), cloth(0x1a1410)));
    wrap.position.set(0, pose.headY - 0.02, 0.08);
    group.add(wrap);
  }
}

function addRangerNecklace(group, pose) {
  const cord = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 5, 12), cloth(0xd8c8a0)));
  cord.rotation.x = Math.PI / 2;
  cord.position.y = pose.shoulderY - 0.06;
  group.add(cord);
  const gem = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.018, 7, 6), glow(0xc4a05a)));
  gem.position.set(0, pose.shoulderY - 0.12, 0.08);
  group.add(gem);
}

function dressRanger(group, { pose, type, rand, set: given }) {
  const kit = given ?? pickRangerHide(rand);
  group.userData.rangerSet = kit.id;
  const hideMat = kit.style === 'hide' ? scaleHide(kit.hide) : cloth(kit.hide);
  const leather = cloth(kit.hide);
  addRangerVambraces(group, leather);
  addRangerQuiver(group, kit.fletch, 1);

  if (kit.style === 'hide') {
    const vest = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.108, 0.3, 10), hideMat));
    vest.name = 'cue-hide';
    vest.scale.z = 0.62;
    vest.position.set(0, 0.9, 0.02);
    group.add(vest);
    for (const side of [-1, 1]) {
      const pad = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), cloth(kit.shoulder ?? 0x3a3a48)));
      pad.scale.set(1.15, 0.62, 0.95);
      pad.position.set(side * pose.shoulderX, pose.shoulderY + 0.02, 0.01);
      group.add(pad);
    }
    const belt = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.014, 6, 12), cloth(kit.belt)));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.66;
    group.add(belt);
  } else {
    const vest = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.108, 0.26, 10), leather));
    vest.name = 'cue-hide';
    vest.scale.z = 0.6;
    vest.position.set(0, 0.9, 0.02);
    group.add(vest);
    const chaps = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.092, 0.34, 9), cloth(kit.chaps ?? type.robe)));
    chaps.name = 'cue-chaps';
    chaps.scale.z = 0.7;
    chaps.position.y = 0.42;
    group.add(chaps);
    addRangerHood(group, pose, kit.hood ?? kit.hide, {
      mask: Boolean(kit.mask),
      name: kit.style === 'coif' ? 'cue-coif' : 'cue-hood',
    });
    addRangerNecklace(group, pose);
  }

  if (kit.shield) {
    const shield = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 6), cloth(0xc8c8c4)));
    shield.name = 'cue-shield';
    shield.rotation.x = Math.PI / 2;
    shield.rotation.z = 0.35;
    shield.position.set(-0.22, 0.76, 0.02);
    group.add(shield);
    const boss = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 6), metal(0xc4a05a)));
    boss.position.set(-0.22, 0.76, 0.04);
    group.add(boss);
  }

  const hold = group.userData.handL ?? group;
  if (kit.weapon === 'crossbow') {
    const bow = addHeldCrossbow(hold, 0x6a4a28);
    bow.name = 'cue-crossbow';
  } else if (kit.weapon === 'blade') {
    const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.22, 0.01), metal(0xc5ccd4)));
    blade.name = 'cue-blade';
    blade.position.set(0.01, 0.1, 0.02);
    blade.rotation.z = -0.2;
    (group.userData.hand ?? group).add(blade);
  } else {
    const bow = addHeldBow(hold, 0x7a5a32, 0.95);
    if (bow) bow.name = 'cue-bow';
  }
  return pose.headTop + (kit.style === 'hide' ? 0.22 : 0.28);
}

function addMageSleeves(group, mat) {
  const rig = group.userData.rig;
  if (!rig?.armL || !rig?.armR) return;
  for (const [arm, side] of [[rig.armL, -1], [rig.armR, 1]]) {
    const sleeve = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.4, 8), mat));
    sleeve.position.set(side * 0.02, -0.18, 0.02);
    sleeve.rotation.z = side * 0.12;
    arm.add(sleeve);
  }
}

function dressMage(group, { pose, rand, set: given }) {
  const set = given ?? pickMageRobes(rand);
  group.userData.mageSet = set.id;
  const robeMat = cloth(set.robe);
  const trimMat = cloth(set.trim);
  const hatMat = cloth(set.hat);
  const skirt = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.72, 10), robeMat));
  skirt.name = 'cue-robes';
  skirt.scale.z = 0.88;
  skirt.position.y = 0.4;
  group.add(skirt);
  const hem = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 6, 14), trimMat));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.06;
  group.add(hem);
  const yoke = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), robeMat));
  yoke.position.y = 0.98;
  yoke.scale.set(1.05, 0.55, 0.85);
  group.add(yoke);
  addMageSleeves(group, robeMat);
  if (set.style !== 'bare') {
    for (const [hand, side] of [[group.userData.handL, -1], [group.userData.hand, 1]]) {
      if (!hand) continue;
      const mitt = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 6), trimMat));
      mitt.scale.set(1.05, 0.72, 1.15);
      mitt.position.set(0, 0, 0);
      hand.add(mitt);
      void side;
    }
  }
  if (set.id === 'umbral') {
    const mark = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.012), glow(set.orb)));
    mark.position.set(0, 0.92, 0.11);
    group.add(mark);
  }
  let labelY = pose.headTop + 0.24;
  if (set.style === 'hood') {
    const hood = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.45),
      robeMat,
    ));
    hood.name = 'cue-hood';
    hood.position.set(0, pose.headY + 0.08, 0.02);
    group.add(hood);
    const cowl = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 8), robeMat));
    cowl.position.set(0, pose.headY - 0.02, 0.08);
    cowl.rotation.x = 1.05;
    group.add(cowl);
    labelY = pose.headTop + 0.28;
  } else if (set.style === 'hat') {
    const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.028, 12), hatMat));
    brim.name = 'cue-hat';
    brim.position.y = pose.headTop - 0.01;
    group.add(brim);
    const cone = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.5, 10), hatMat));
    cone.position.set(0.02, pose.headTop + 0.25, -0.01);
    cone.rotation.z = -0.12;
    group.add(cone);
    const band = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.03, 10), trimMat));
    band.position.y = pose.headTop + 0.02;
    group.add(band);
    labelY = pose.headTop + 0.56;
  }
  addHeldPole(group, {
    x: pose.handR.x,
    y: 0.52,
    z: pose.handR.z,
    length: 1.12,
    woodColor: 0x5a3a22,
    orb: { radius: 0.06, color: set.orb, emissive: set.orb },
    name: 'cue-orb',
  });
  return labelY;
}

/** Per-class customer dressers. Later packs (mercenary/ranger art) plug in here. */
export const CUSTOMER_LOOKS = {
  king: dressKing,
  pilgrim: dressPilgrim,
  mercenary: dressMercenary,
  ranger: dressRanger,
  mage: dressMage,
};

export function buildAdventurer(typeId, opts = {}) {
  const type = CUSTOMERS[typeId] ?? CUSTOMERS.pilgrim;
  const group = new THREE.Group();
  group.name = typeId;
  const rand = hashStyle(opts.seed ?? Math.random());
  const lookId = type.look ?? typeId;
  const mageSet = lookId === 'mage' ? pickMageRobes(rand) : null;
  const rangerSet = lookId === 'ranger' ? pickRangerHide(rand) : null;
  const mercenarySet = lookId === 'mercenary' ? pickMercenaryPlate(rand) : null;
  const pilgrimSet = lookId === 'pilgrim' ? pickPilgrimCiv(rand) : null;
  const lookSet = mageSet ?? rangerSet ?? mercenarySet ?? pilgrimSet;
  const female = typeId === 'kingroald' ? false
    : (lookSet?.female != null ? lookSet.female : rand() < 0.48);
  const hairColor = lookSet?.hair ?? HAIR_COLORS[Math.floor(rand() * HAIR_COLORS.length)];
  const mageHair = ['long', 'bun', 'ponytail', 'bob'];
  const hideHairStyles = ['short', 'crop'];
  const femHair = ['long', 'ponytail', 'bun', 'bob'];
  const mascHair = ['short', 'crop', 'long', 'bun'];
  const hairStyle = typeId === 'kingroald'
    ? 'short'
    : (lookSet?.hairStyle
      ?? (rangerSet?.style === 'hide'
        ? hideHairStyles[Math.floor(rand() * hideHairStyles.length)]
        : (lookId === 'mage'
          ? mageHair[Math.floor(rand() * mageHair.length)]
          : (female ? femHair : mascHair)[Math.floor(rand() * (female ? femHair.length : mascHair.length))])));
  const wantBeard = Boolean(mageSet?.beard);
  const faceHair = typeId === 'kingroald'
    ? 'goatee'
    : (lookSet?.faceHair
      ?? (female
        ? 'none'
        : (wantBeard ? 'beard' : (['none', 'none', 'beard', 'moustache', 'goatee'][Math.floor(rand() * 5)]))));

  const hideBody = rangerSet?.style === 'hide' ? scaleHide(rangerSet.hide) : null;
  const robeHex = mageSet?.robe ?? type.robe;
  const robe = hideBody
    ?? (mercenarySet ? metal(mercenarySet.plate) : null)
    ?? (pilgrimSet ? cloth(pilgrimSet.shirt) : null)
    ?? new THREE.MeshStandardMaterial({ color: robeHex, roughness: 0.88 });
  const skin = new THREE.MeshStandardMaterial({
    color: mageSet?.id === 'ashen' ? 0xf2ece4 : 0xe2c2a0,
    roughness: 0.7,
  });
  const mercLegs = mercenarySet
    ? (mercenarySet.legsStyle === 'hide' ? scaleHide(mercenarySet.legs) : metal(mercenarySet.legs))
    : null;
  const civLegs = pilgrimSet
    ? (pilgrimSet.check ? checkCloth(pilgrimSet.pants) : cloth(pilgrimSet.pants ?? pilgrimSet.skirt ?? type.robe))
    : null;
  const pants = hideBody
    ?? (rangerSet ? cloth(rangerSet.chaps ?? type.robe) : null)
    ?? mercLegs
    ?? civLegs
    ?? robe;
  const sleeves = rangerSet?.sleeve != null
    ? cloth(rangerSet.sleeve)
    : (mercenarySet ? metal(mercenarySet.gloves)
      : (pilgrimSet?.sleeve != null ? cloth(pilgrimSet.sleeve) : robe));
  const pose = addHumanoid(group, {
    skin,
    shirt: robe,
    pants,
    boots: rangerSet?.boots != null
      ? cloth(rangerSet.boots)
      : (mercenarySet ? metal(mercenarySet.boots)
        : (pilgrimSet?.boots != null ? cloth(pilgrimSet.boots)
          : (lookId === 'king' ? metal(0xc4a05a) : cloth(0x2a1c12)))),
    sleeves,
  });

  const hideHair = lookId === 'mercenary' || lookSet?.style === 'hood' || lookSet?.style === 'coif';
  if (!hideHair) addHair(group, pose, hairStyle, hairColor);
  if (lookSet?.style !== 'hood' && lookSet?.style !== 'coif' && lookSet?.style !== 'helm') {
    addFaceHair(group, pose, faceHair, hairColor);
  }

  const dress = CUSTOMER_LOOKS[lookId] ?? dressPilgrim;
  const labelY = dress(group, { type, pose, rand, typeId, set: lookSet }) ?? pose.headTop + 0.24;

  const label = makeNameSprite(type.name);
  label.position.y = labelY;
  group.add(label);

  const speech = makeSpeechSprite('…');
  speech.position.y = labelY + 0.38;
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

  group.userData.pick = pick;
  group.userData.speech = speech;
  group.userData.ring = ring;
  group.userData.female = female;
  return group;
}

export function buildGoblin() {
  const group = new THREE.Group();
  group.name = 'goblin';
  const body = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a8a32, roughness: 0.72 });
  const tunic = cloth(0xc4a06a, 0.9);
  const plate = metal(0x6a7078);
  body.scale.set(0.8, 0.62, 0.78);
  body.rotation.x = 0.38;

  const pose = addHumanoid(body, {
    skin,
    shirt: tunic,
    pants: plate,
    boots: plate,
    sleeves: tunic,
  });

  if (pose.rig?.armL) pose.rig.armL.scale.set(1.08, 1.38, 1.08);
  if (pose.rig?.armR) pose.rig.armR.scale.set(1.08, 1.38, 1.08);

  const wrap = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 8), tunic));
  wrap.name = 'cue-tunic';
  wrap.position.y = 0.8;
  wrap.scale.z = 0.78;
  body.add(wrap);

  for (const side of [-1, 1]) {
    const pad = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), plate));
    pad.name = 'cue-pauldron';
    pad.scale.set(1.15, 0.52, 0.92);
    pad.position.set(side * pose.shoulderX, pose.shoulderY + 0.02, 0.02);
    body.add(pad);
    const greave = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.16, 6), plate));
    greave.name = 'cue-greave';
    greave.position.set(side * 0.074, 0.22, 0.01);
    body.add(greave);
  }

  for (const side of [-1, 1]) {
    const ear = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.2, 6), skin));
    ear.name = 'cue-ear';
    ear.position.set(side * 0.14, pose.headY + 0.08, -0.02);
    ear.rotation.z = side * -0.62;
    ear.rotation.x = -0.28;
    body.add(ear);
  }
  const snout = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.12, 6), skin));
  snout.name = 'cue-nose';
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, pose.headY - 0.02, 0.14);
  body.add(snout);

  const knot = addShadow(new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.8 }),
  ));
  knot.name = 'cue-topknot';
  knot.position.set(0, pose.headTop + 0.06, -0.02);
  knot.rotation.z = 0.18;
  body.add(knot);

  group.add(body);
  group.userData.rig = body.userData.rig;
  group.userData.walkPhase = 0;
  group.userData.walkRest = body.userData.walkRest;

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.05, 0.42),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pick.position.y = 0.52;
  pick.userData.kind = 'goblin';
  group.add(pick);
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
  const { map, scaleX, scaleY } = speechTexture(text, true);
  if (speech.material.map) speech.material.map.dispose();
  speech.material.map = map;
  speech.material.needsUpdate = true;
  speech.scale.set(scaleX, scaleY, 1);
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [String(text)];
}

function speechTexture(text, bubble = false) {
  const font = bubble ? '700 26px Georgia, serif' : '600 26px Georgia, serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const padX = bubble ? 28 : 18;
  const padY = bubble ? 16 : 10;
  const tail = bubble ? 20 : 0;
  const maxText = 420;
  const lines = wrapLines(measure, text, maxText);
  const lineH = bubble ? 30 : 28;
  let textW = 0;
  for (const line of lines) textW = Math.max(textW, measure.measureText(line).width);
  const canvasW = Math.max(64, Math.ceil(textW + padX * 2));
  const canvasH = Math.max(48, Math.ceil(lines.length * lineH + padY * 2 + tail));
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = bubble ? 'rgba(248, 232, 196, 0.96)' : 'rgba(28, 18, 10, 0.78)';
  const boxH = canvasH - tail;
  roundRect(ctx, 8, 6, canvasW - 16, boxH - 10, 14);
  ctx.fill();
  if (bubble) {
    const mid = canvasW / 2;
    ctx.beginPath();
    ctx.moveTo(mid - 10, boxH - 8);
    ctx.lineTo(mid + 10, boxH - 8);
    ctx.lineTo(mid, canvasH - 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = bubble ? '#3a240e' : '#f6e4c4';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textY0 = 6 + (boxH - 10) / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvasW / 2, textY0 + i * lineH);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.needsUpdate = true;
  const px = 280;
  return {
    map,
    scaleX: canvasW / px,
    scaleY: canvasH / px,
    width: canvasW,
    height: canvasH,
  };
}

function makeNameSprite(text) {
  const { map, scaleX, scaleY } = speechTexture(text, false);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false,
  }));
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 2;
  return sprite;
}

function makeSpeechSprite(text) {
  const { map, scaleX, scaleY } = speechTexture(text, true);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false,
  }));
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.center.set(0.5, 0);
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

export function normalizeImported(root, targetSize, sitOnFloor = true, opts = {}) {
  root.updateMatrixWorld(true);
  const rs = root.scale;
  if (Math.abs(rs.x - rs.y) > 1e-4 || Math.abs(rs.y - rs.z) > 1e-4) {
    const uniform = Math.max(Math.abs(rs.x), Math.abs(rs.y), Math.abs(rs.z), 0.0001);
    rs.setScalar(Math.sign(rs.x || 1) * uniform);
    root.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const dim = opts.fit === 'height'
    ? Math.max(size.y, 0.0001)
    : Math.max(size.x, size.y, size.z, 0.0001);
  root.scale.multiplyScalar(targetSize / dim);
  root.updateMatrixWorld(true);
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

function tintImportedMesh(root, hex) {
  if (hex == null) return;
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      const clone = mat.clone();
      if (clone.color) clone.color.setHex(hex);
      return clone;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

const BONE_LEG_L = /left.*(up)?leg|leftthigh|l_?(up)?leg|thigh_?l|upleg_?l|mixamorig:?leftupleg/i;
const BONE_LEG_R = /right.*(up)?leg|rightthigh|r_?(up)?leg|thigh_?r|upleg_?r|mixamorig:?rightupleg/i;
const BONE_ARM_L = /left.*(upper)?arm|l_?(upper)?arm|arm_?l|shoulder_?l|mixamorig:?leftarm/i;
const BONE_ARM_R = /right.*(upper)?arm|r_?(upper)?arm|arm_?r|shoulder_?r|mixamorig:?rightarm/i;
const BONE_HAND_R = /right.*hand|r_?hand|hand_?r|mixamorig:?righthand|wrist_?r/i;

function collectBones(root) {
  const bones = [];
  root.traverse((obj) => {
    if (obj.isBone) bones.push(obj);
    if (obj.isSkinnedMesh && obj.skeleton?.bones) {
      for (const bone of obj.skeleton.bones) bones.push(bone);
    }
  });
  return [...new Set(bones)];
}

function matchBone(bones, pattern) {
  const scored = bones
    .filter((bone) => pattern.test(bone.name || ''))
    .sort((a, b) => (a.name?.length ?? 0) - (b.name?.length ?? 0));
  return scored[0] ?? null;
}

function attachPreservingWorld(child, newParent) {
  child.updateMatrixWorld(true);
  newParent.updateMatrixWorld(true);
  const world = child.matrixWorld.clone();
  newParent.add(child);
  const inv = new THREE.Matrix4().copy(newParent.matrixWorld).invert();
  child.matrix.copy(inv.multiply(world));
  child.matrix.decompose(child.position, child.quaternion, child.scale);
}

function makePivot(parent, worldPos, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  parent.updateMatrixWorld(true);
  const local = parent.worldToLocal(worldPos.clone());
  pivot.position.copy(local);
  parent.add(pivot);
  return pivot;
}

function partitionLimbMeshes(root) {
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh && child.geometry && !child.userData?.skipWalk) meshes.push(child);
  });
  if (meshes.length < 3) return null;
  const box = new THREE.Box3().setFromObject(root);
  const midX = (box.min.x + box.max.x) / 2;
  const ySpan = Math.max(0.01, box.max.y - box.min.y);
  const lowY = box.min.y + ySpan * 0.42;
  const highY = box.min.y + ySpan * 0.5;
  const wide = (box.max.x - box.min.x) * 0.1;
  const legsL = [];
  const legsR = [];
  const armsL = [];
  const armsR = [];
  for (const mesh of meshes) {
    const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    if (center.y < lowY) {
      (center.x < midX ? legsL : legsR).push(mesh);
    } else if (center.y > highY && Math.abs(center.x - midX) > wide) {
      (center.x < midX ? armsL : armsR).push(mesh);
    }
  }
  if (!legsL.length || !legsR.length) return null;
  return { legsL, legsR, armsL, armsR, box };
}

function addProxyLimb(parent, x, y, length, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(x, y, 0);
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.024, length, 6),
    new THREE.MeshStandardMaterial({
      color: 0x2a2218,
      roughness: 0.9,
      transparent: true,
      opacity: 0.42,
    }),
  );
  stick.position.y = -length * 0.45;
  stick.userData.skipWalk = true;
  pivot.add(stick);
  parent.add(pivot);
  return pivot;
}

/** Bind a simple biped rig so imported player/customer meshes use the stock walk cycle. */
export function bindImportedWalkRig(group, mesh, height = 1.7) {
  group.userData.walkBody = mesh;
  const bones = collectBones(mesh);
  const boneLegL = matchBone(bones, BONE_LEG_L);
  const boneLegR = matchBone(bones, BONE_LEG_R);
  if (boneLegL && boneLegR) {
    const armL = matchBone(bones, BONE_ARM_L);
    const armR = matchBone(bones, BONE_ARM_R);
    group.userData.rig = { legL: boneLegL, legR: boneLegR, armL, armR };
    group.userData.walkRest = {
      legL: boneLegL.rotation.x,
      legR: boneLegR.rotation.x,
      armL: armL?.rotation.x ?? 0,
      armR: armR?.rotation.x ?? 0,
    };
    group.userData.walkMode = 'bones';
    return 'bones';
  }
  const parts = partitionLimbMeshes(mesh);
  if (parts) {
    const hipY = parts.box.min.y + (parts.box.max.y - parts.box.min.y) * 0.36;
    const shoulderY = parts.box.min.y + (parts.box.max.y - parts.box.min.y) * 0.64;
    const midX = (parts.box.min.x + parts.box.max.x) / 2;
    const span = Math.max(0.08, (parts.box.max.x - parts.box.min.x) * 0.18);
    mesh.updateMatrixWorld(true);
    const legL = makePivot(mesh, new THREE.Vector3(midX - span, hipY, 0), 'walkLegL');
    const legR = makePivot(mesh, new THREE.Vector3(midX + span, hipY, 0), 'walkLegR');
    for (const child of parts.legsL) attachPreservingWorld(child, legL);
    for (const child of parts.legsR) attachPreservingWorld(child, legR);
    let armL = null;
    let armR = null;
    if (parts.armsL.length) {
      armL = makePivot(mesh, new THREE.Vector3(midX - span * 1.2, shoulderY, 0), 'walkArmL');
      for (const child of parts.armsL) attachPreservingWorld(child, armL);
    }
    if (parts.armsR.length) {
      armR = makePivot(mesh, new THREE.Vector3(midX + span * 1.2, shoulderY, 0), 'walkArmR');
      for (const child of parts.armsR) attachPreservingWorld(child, armR);
    }
    group.userData.rig = { legL, legR, armL, armR };
    group.userData.walkRest = { legL: 0, legR: 0, armL: 0, armR: 0 };
    group.userData.walkMode = 'parts';
    return 'parts';
  }
  const hipY = height * 0.34;
  const shoulderY = height * 0.62;
  const hipX = Math.max(0.07, height * 0.05);
  const legLen = height * 0.36;
  const armLen = height * 0.28;
  group.userData.rig = {
    legL: addProxyLimb(group, -hipX, hipY, legLen, 'proxyLegL'),
    legR: addProxyLimb(group, hipX, hipY, legLen, 'proxyLegR'),
    armL: addProxyLimb(group, -hipX * 1.7, shoulderY, armLen, 'proxyArmL'),
    armR: addProxyLimb(group, hipX * 1.7, shoulderY, armLen, 'proxyArmR'),
  };
  group.userData.walkRest = { legL: 0, legR: 0, armL: 0, armR: 0 };
  group.userData.walkMode = 'proxy';
  return 'proxy';
}

/** Wrap a glTF scene as a player or customer stand-in. Throws if the file has no mesh. */
export function wrapImportedCharacter(source, opts = {}) {
  if (!source) throw new Error('No model to use.');
  const group = new THREE.Group();
  group.name = opts.name ?? 'character';
  const mesh = source.clone(true);
  normalizeImported(mesh, opts.height ?? 1.7, true, { fit: 'height' });
  tintImportedMesh(mesh, opts.tint);
  group.add(mesh);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty() || (box.max.y - box.min.y) < 0.05) {
    throw new Error('That file has no visible mesh.');
  }
  const height = Math.max(0.9, box.max.y - Math.min(0, box.min.y));
  const label = makeNameSprite(opts.label ?? 'You');
  label.position.y = height + 0.18;
  group.add(label);

  if (opts.speech) {
    const speech = makeSpeechSprite('…');
    speech.position.y = height + 0.52;
    speech.visible = false;
    group.add(speech);
    group.userData.speech = speech;
  }

  if (opts.pickKind) {
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.55, (box.max.x - box.min.x) * 0.95),
        height,
        Math.max(0.42, (box.max.z - box.min.z) * 0.95),
      ),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.position.y = height * 0.5;
    pick.userData.kind = opts.pickKind;
    group.add(pick);
    group.userData.pick = pick;
  }

  if (opts.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    group.add(ring);
    group.userData.ring = ring;
  }

  if (opts.chefHat) {
    const chefHat = buildChefHat();
    chefHat.position.y = height + 0.02;
    chefHat.visible = Boolean(opts.chefHatOn);
    group.add(chefHat);
    group.userData.chefHat = chefHat;
  }

  group.userData.hammers = [];
  group.userData.customMesh = true;
  group.userData.walkPhase = 0;
  bindImportedWalkRig(group, mesh, height);
  group.userData.walkRest = {
    ...(group.userData.walkRest ?? {}),
    scaleY: mesh.scale.y,
  };
  attachImportedGrip(group, mesh, height);
  return group;
}

function attachImportedGrip(group, mesh, height) {
  const bones = collectBones(mesh);
  const handBone = matchBone(bones, BONE_HAND_R);
  const arm = group.userData.rig?.armR;
  const grip = new THREE.Group();
  grip.name = 'importedGrip';
  const pickaxe = buildPickaxe();
  pickaxe.visible = false;
  grip.add(pickaxe);
  poseHeldPickaxe(pickaxe);
  if (handBone) {
    handBone.add(grip);
    grip.position.set(0.035, 0.0, 0.02);
    grip.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  } else if (arm) {
    const drop = group.userData.walkMode === 'proxy' ? -height * 0.22 : -0.12;
    grip.position.set(0.03, drop, 0.05);
    grip.rotation.set(-0.35, 0.12, 0.08);
    arm.add(grip);
  } else {
    grip.position.set(0.22, Math.min(height * 0.52, 0.98), 0.1);
    grip.rotation.set(-0.35, 0.12, 0.08);
    group.add(grip);
  }
  group.userData.hand = grip;
  group.userData.pickaxe = pickaxe;
}

export function wareTopY(object) {
  const box = new THREE.Box3().setFromObject(object);
  return box.max.y + 0.02;
}
