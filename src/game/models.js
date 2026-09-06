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

  const doorHalf = 0.58;
  const wallSpan = 4.1 - doorHalf;
  const frontLeft = addShadow(new THREE.Mesh(new THREE.BoxGeometry(wallSpan, 2.7, 0.16), plaster));
  frontLeft.position.set(-4.1 + wallSpan / 2, 1.4, 3.58);
  root.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = 4.1 - wallSpan / 2;
  root.add(frontRight);

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

export function buildShopDoor() {
  const root = new THREE.Group();
  root.name = 'shop-door';
  const hinge = new THREE.Group();
  hinge.position.set(-0.56, 0, 3.5);
  const leaf = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.08, 0.08), wood(0x6a4324, 0.7)));
  leaf.position.set(0.56, 1.12, 0);
  hinge.add(leaf);
  const panel = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.72, 0.04), wood(0x8a5a32, 0.78)));
  panel.position.set(0.56, 0.62, 0.03);
  hinge.add(panel);
  const panel2 = panel.clone();
  panel2.position.y = 1.48;
  hinge.add(panel2);
  const mid = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), wood(0x3f2716)));
  mid.position.set(0.56, 1.06, 0.03);
  hinge.add(mid);
  const strap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.0, 0.1), metal(0xc4a05a)));
  strap.position.set(0.12, 1.12, 0.03);
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
  window.position.set(0.56, 1.62, 0.04);
  hinge.add(window);
  const handle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metal(0xe3b34a)));
  handle.position.set(1.0, 1.02, 0.08);
  hinge.add(handle);
  root.add(hinge);
  root.userData.hinge = hinge;
  return root;
}

export function setDoorOpen(door, open, dt = 1) {
  const hinge = door.userData.hinge;
  if (!hinge) return;
  const target = open ? -1.35 : 0.04;
  hinge.rotation.y += (target - hinge.rotation.y) * Math.min(1, dt * 5);
}

export function buildShopkeeper() {
  const group = new THREE.Group();
  group.name = 'shopkeeper';
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2c2a0, roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.86 });
  const apron = cloth(0xd8c49a, 0.9);
  const hair = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.8 });

  const legs = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), cloth(0x3a2a1c)));
  legs.position.y = 0.32;
  group.add(legs);
  const body = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 4, 10), shirt));
  body.position.y = 0.78;
  group.add(body);
  const bib = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), apron));
  bib.position.set(0, 0.72, 0.12);
  group.add(bib);
  const skirt = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.16), apron));
  skirt.position.set(0, 0.48, 0.06);
  group.add(skirt);
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin));
  head.position.y = 1.18;
  group.add(head);
  const haircap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hair));
  haircap.position.y = 1.22;
  group.add(haircap);
  const armL = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 3, 8), shirt));
  armL.position.set(-0.22, 0.78, 0.02);
  armL.rotation.z = 0.18;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.22;
  armR.rotation.z = -0.18;
  group.add(armR);
  const label = makeNameSprite('You');
  label.position.y = 1.55;
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
  return group;
}

export function buildArmourStand() {
  const group = new THREE.Group();
  group.name = 'armour-stand';
  const pole = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.42, 8), wood(0x3f2716)));
  pole.position.y = 0.72;
  group.add(pole);
  const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 10), wood(0x4a301c)));
  base.position.y = 0.04;
  group.add(base);
  const hips = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), wood(0x5a3b22)));
  hips.position.y = 0.52;
  group.add(hips);
  const shoulders = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.1), wood(0x5a3b22)));
  shoulders.position.y = 1.18;
  group.add(shoulders);
  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), wood(0x3f2716)));
  neck.position.y = 1.3;
  group.add(neck);
  const knob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), wood(0x6a4324)));
  knob.position.y = 1.42;
  group.add(knob);
  const dummy = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.1), wood(0x7a5230, 0.9)));
  dummy.position.y = 0.96;
  group.add(dummy);
  group.userData.wareY = 0;
  group.userData.stand = true;
  group.userData.slots = {
    helm: { x: 0, y: 1.38, z: 0 },
    body: { x: 0, y: 0.78, z: 0 },
    legs: { x: 0, y: 0.28, z: 0 },
    ware: { x: 0.16, y: 0.62, z: 0.08 },
  };
  return group;
}

export function buildFurniture(kind) {
  if (kind === 'shelf') return buildWallShelf();
  if (kind === 'stand') return buildArmourStand();
  return buildDefaultTable();
}

export function slotPose(slot) {
  if (slot === 'helm') return { x: 0, y: 1.38, z: 0 };
  if (slot === 'body') return { x: 0, y: 0.78, z: 0 };
  if (slot === 'legs') return { x: 0, y: 0.28, z: 0 };
  return { x: 0, y: 0.62, z: 0 };
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
  } else if (recipe?.slot === 'sword') {
    addSword(group, recipe.tint);
  } else if (recipe?.slot === 'bow') {
    addBow(group, recipe.tint);
  } else if (recipe?.slot === 'staff') {
    addStaff(group, recipe.tint);
  } else if (recipe?.slot === 'helm') {
    addHelm(group, recipe.tint, recipe.combatClass);
  } else if (recipe?.slot === 'body') {
    addBody(group, recipe.tint, recipe.combatClass);
  } else if (recipe?.slot === 'legs') {
    addLegs(group, recipe.tint, recipe.combatClass);
  } else {
    const lump = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: recipe?.tint ?? 0x888888, roughness: 0.6 }),
    ));
    lump.position.y = 0.1;
    group.add(lump);
  }

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

function addSword(group, tint) {
  const blade = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.016), metal(tint)));
  blade.position.set(0.08, 0.42, 0);
  blade.rotation.z = -0.45;
  group.add(blade);
  const tip = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), metal(tint)));
  tip.position.set(0.22, 0.7, 0);
  tip.rotation.z = -0.45;
  group.add(tip);
  const guard = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), metal(0xc4a05a)));
  guard.position.set(-0.02, 0.18, 0);
  guard.rotation.z = -0.45;
  group.add(guard);
  const grip = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.16, 8), wood(0x4a301c)));
  grip.position.set(-0.08, 0.08, 0);
  grip.rotation.z = -0.45;
  group.add(grip);
}

function addBow(group, tint) {
  const limb = addShadow(new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.018, 8, 16, Math.PI),
    wood(tint),
  ));
  limb.rotation.y = Math.PI / 2;
  limb.rotation.z = Math.PI / 2;
  limb.position.set(0, 0.32, 0);
  group.add(limb);
  const string = addShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.54, 6),
    new THREE.MeshStandardMaterial({ color: 0xead3ae, roughness: 0.5 }),
  ));
  string.position.set(0.18, 0.32, 0);
  group.add(string);
}

function addStaff(group, tint) {
  const shaft = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.82, 8), wood(0x3a2a1c)));
  shaft.position.set(0, 0.4, 0);
  shaft.rotation.z = 0.28;
  group.add(shaft);
  const orb = addShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    }),
  ));
  orb.position.set(0.12, 0.82, 0);
  group.add(orb);
}

function addHelm(group, tint, combatClass) {
  if (combatClass === 'magic') {
    const band = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), metal(tint)));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.16;
    group.add(band);
    const gem = addShadow(new THREE.Mesh(
      new THREE.OctahedronGeometry(0.05),
      new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.35 }),
    ));
    gem.position.y = 0.22;
    group.add(gem);
    return;
  }
  if (combatClass === 'range') {
    const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), cloth(tint)));
    cap.position.y = 0.12;
    group.add(cap);
    const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), cloth(0x3a2a1c)));
    brim.position.y = 0.12;
    group.add(brim);
    return;
  }
  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), metal(tint)));
  dome.position.y = 0.12;
  group.add(dome);
  const visor = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.08), metal(0x2a2a2a)));
  visor.position.set(0, 0.12, 0.1);
  group.add(visor);
}

function addBody(group, tint, combatClass) {
  if (combatClass === 'magic') {
    const robe = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.48, 10), cloth(tint)));
    robe.position.y = 0.24;
    group.add(robe);
    return;
  }
  if (combatClass === 'range') {
    const vest = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.14), cloth(tint)));
    vest.position.y = 0.22;
    group.add(vest);
    const strap = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.16), cloth(0x3a2a1c)));
    strap.position.set(0.08, 0.22, 0);
    strap.rotation.z = -0.3;
    group.add(strap);
    return;
  }
  const plate = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.16), metal(tint)));
  plate.position.y = 0.22;
  group.add(plate);
  const collar = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), metal(0xc4a05a)));
  collar.position.y = 0.42;
  group.add(collar);
}

function addLegs(group, tint, combatClass) {
  if (combatClass === 'magic') {
    const wrap = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10), cloth(tint)));
    wrap.position.y = 0.2;
    group.add(wrap);
    const hem = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 14), cloth(0xc4a05a)));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.04;
    group.add(hem);
    return;
  }
  const mat = combatClass === 'range' ? cloth(tint) : metal(tint);
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), mat));
  left.position.set(-0.08, 0.2, 0);
  group.add(left);
  const right = left.clone();
  right.position.x = 0.08;
  group.add(right);
  if (combatClass === 'melee') {
    const knee = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.13), metal(0xc4a05a)));
    knee.position.set(-0.08, 0.22, 0.02);
    group.add(knee);
    const knee2 = knee.clone();
    knee2.position.x = 0.08;
    group.add(knee2);
  }
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
  } else if (typeId === 'ranger') {
    const hood = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), robe));
    hood.position.y = 1.1;
    group.add(hood);
    const bow = addShadow(new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.014, 6, 14, Math.PI),
      wood(0x7a5a32),
    ));
    bow.rotation.y = Math.PI / 2;
    bow.position.set(-0.2, 0.7, -0.08);
    group.add(bow);
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

  const speech = makeSpeechSprite('…');
  speech.position.y = 1.78;
  speech.visible = false;
  group.add(speech);

  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.7, 0.62),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pick.position.y = 0.85;
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
  hand.position.set(0.18, 0.72, 0.12);
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
