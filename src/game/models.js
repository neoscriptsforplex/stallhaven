import * as THREE from 'three';
import { CUSTOMERS, RECIPES } from './catalog.js';

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

export function buildStall() {
  const root = new THREE.Group();
  root.name = 'stall';

  const plaster = new THREE.MeshStandardMaterial({
    color: 0xc6b496,
    roughness: 0.94,
  });
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

  const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.7, 0.16), plaster));
  back.position.set(0, 1.4, -3.45);
  root.add(back);

  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 7.2), plaster));
  left.position.set(-4.1, 1.4, 0.1);
  root.add(left);

  const right = left.clone();
  right.position.x = 4.1;
  root.add(right);

  const frontLeft = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 0.16), plaster));
  frontLeft.position.set(-2.75, 1.4, 3.55);
  root.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = 2.75;
  root.add(frontRight);

  const lintel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.2), beam));
  lintel.position.set(0, 2.45, 3.55);
  root.add(lintel);

  const doorLeft = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.05, 0.18), beam));
  doorLeft.position.set(-1.12, 1.1, 3.55);
  root.add(doorLeft);
  const doorRight = doorLeft.clone();
  doorRight.position.x = 1.12;
  root.add(doorRight);

  const halfDoor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.08), wood(0x4a301c)));
  halfDoor.position.set(-0.52, 0.62, 3.48);
  halfDoor.rotation.y = 0.55;
  root.add(halfDoor);

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

  const lanternGlow = new THREE.MeshStandardMaterial({
    color: 0xffc56a,
    emissive: 0xff9a3a,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });
  const lantern = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lanternGlow));
  lantern.position.set(-1.35, 2.08, -3.2);
  root.add(lantern);
  const lantern2 = lantern.clone();
  lantern2.position.x = 1.35;
  root.add(lantern2);

  const sign = makeSign();
  sign.position.set(0, 2.05, -3.32);
  root.add(sign);

  const counter = buildCounter();
  counter.position.set(0, 0, -2.05);
  root.add(counter);

  const crate = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.55), wood(0x5a3b22)));
  crate.position.set(3.35, 0.32, -2.3);
  root.add(crate);

  const sack = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), cloth(0xbfa06c)));
  sack.scale.set(1, 0.75, 1.1);
  sack.position.set(-3.4, 0.28, -2.15);
  root.add(sack);

  return root;
}

function makeSign() {
  const group = new THREE.Group();
  const board = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.08), wood(0x4e331f)));
  group.add(board);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4e331f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f0d9a8';
  ctx.font = '700 56px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STALLHAVEN', 256, 52);
  ctx.font = '22px Georgia, serif';
  ctx.fillStyle = '#d7b27a';
  ctx.fillText('wares for the dusty road', 256, 98);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.25, 0.46),
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
  dish.position.set(0.7, 0.99, 0.1);
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

export function buildWare(recipeId) {
  const recipe = RECIPES[recipeId];
  const group = new THREE.Group();
  group.name = recipeId;

  if (recipeId === 'trailbread') {
    const loaf = addShadow(
      new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), new THREE.MeshStandardMaterial({
        color: recipe.tint,
        roughness: 0.9,
      })),
    );
    loaf.scale.set(1.35, 0.55, 0.9);
    loaf.position.y = 0.08;
    group.add(loaf);
    const loaf2 = loaf.clone();
    loaf2.position.set(0.12, 0.12, 0.05);
    loaf2.rotation.z = 0.2;
    group.add(loaf2);
  } else if (recipeId === 'emberflask') {
    const glass = new THREE.MeshStandardMaterial({
      color: 0x6a220e,
      emissive: 0xc13a10,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.1,
    });
    const body = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), glass));
    body.position.y = 0.14;
    group.add(body);
    const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), glass));
    neck.position.y = 0.3;
    group.add(neck);
    const cork = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), wood(0x6b4423)));
    cork.position.y = 0.39;
    group.add(cork);
  } else if (recipeId === 'thornpike') {
    const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 8), wood(0x5a3a22)));
    shaft.rotation.z = 0.55;
    shaft.rotation.x = -0.2;
    shaft.position.set(-0.05, 0.28, 0);
    group.add(shaft);
    const head = addShadow(
      new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), new THREE.MeshStandardMaterial({
        color: 0x8ea86a,
        roughness: 0.45,
        metalness: 0.25,
      })),
    );
    head.rotation.z = 0.55;
    head.rotation.x = -0.2;
    head.position.set(0.28, 0.58, -0.08);
    group.add(head);
  } else if (recipeId === 'waycloak') {
    const stand = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 8), wood(0x3a2a1c)));
    stand.position.y = 0.28;
    group.add(stand);
    const cape = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.22, 4, 8), cloth(recipe.tint)));
    cape.position.y = 0.34;
    cape.scale.set(1.2, 1, 0.45);
    group.add(cape);
    const hood = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), cloth(0x3c4c56)));
    hood.position.set(0, 0.52, 0.02);
    group.add(hood);
  }

  group.userData.recipeId = recipeId;
  return group;
}

export function buildAdventurer(typeId) {
  const type = CUSTOMERS[typeId];
  const group = new THREE.Group();
  group.name = typeId;

  const robe = new THREE.MeshStandardMaterial({ color: type.robe, roughness: 0.88 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2c2a0, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: type.accent, roughness: 0.7 });

  const body = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 10), robe));
  body.position.y = 0.62;
  group.add(body);
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin));
  head.position.y = 1.05;
  group.add(head);

  if (typeId === 'pilgrim') {
    const hood = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), robe));
    hood.position.y = 1.1;
    group.add(hood);
    const staff = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.15, 6), wood(0x5b3c22)));
    staff.position.set(0.22, 0.58, 0.05);
    group.add(staff);
  } else if (typeId === 'mercenary') {
    const helm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), accent));
    helm.position.y = 1.1;
    group.add(helm);
    const pauldron = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.22), accent));
    pauldron.position.y = 0.86;
    group.add(pauldron);
  } else {
    const hat = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 8), accent));
    hat.position.y = 1.28;
    group.add(hat);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x9b6cff, emissive: 0x6a3cff, emissiveIntensity: 1.2 }),
    );
    orb.position.set(0.22, 0.7, 0.08);
    group.add(orb);
    const stave = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.9, 6), wood(0x2f4a3a)));
    stave.position.set(0.22, 0.45, 0.08);
    group.add(stave);
  }

  const label = makeNameSprite(type.name);
  label.position.y = 1.48;
  group.add(label);

  const hand = new THREE.Group();
  hand.name = 'hand';
  hand.position.set(0.18, 0.72, 0.12);
  group.add(hand);

  group.userData.hand = hand;
  return group;
}

function makeNameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(28, 18, 10, 0.72)';
  roundRect(ctx, 16, 12, 224, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#f6e4c4';
  ctx.font = '600 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const map = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
  sprite.scale.set(0.9, 0.22, 1);
  sprite.renderOrder = 2;
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
