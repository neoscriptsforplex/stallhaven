import * as THREE from 'three';

/** Cached source maps. Callers clone and set their own repeat. */
const MAPS = new Map();

function randFrom(seed) {
  let s = Math.abs(Math.floor(seed) || 1);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function finishMap(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function makeMap(key, width, height, draw) {
  let tex = MAPS.get(key);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    tex = finishMap(canvas);
    MAPS.set(key, tex);
  }
  return tex.clone();
}

function drawWood(ctx, w, h, seed) {
  const rand = randFrom(seed);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(0, 0, w, h);
  const boards = 5;
  const boardH = h / boards;
  for (let i = 0; i < boards; i += 1) {
    const y = i * boardH;
    const warm = 118 + Math.floor(rand() * 46);
    ctx.fillStyle = `rgb(${warm + 18}, ${Math.floor(warm * 0.62)}, ${Math.floor(warm * 0.28)})`;
    ctx.fillRect(0, y, w, boardH);
    for (let g = 0; g < 14; g += 1) {
      const gy = y + 4 + rand() * (boardH - 8);
      ctx.strokeStyle = `rgba(42, 22, 10, ${0.12 + rand() * 0.3})`;
      ctx.lineWidth = 0.6 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        w * 0.28,
        gy + (rand() - 0.5) * 8,
        w * 0.68,
        gy + (rand() - 0.5) * 8,
        w,
        gy,
      );
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(210, 168, 96, ${0.08 + rand() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + boardH * 0.35);
    ctx.bezierCurveTo(w * 0.4, y + boardH * 0.2, w * 0.7, y + boardH * 0.5, w, y + boardH * 0.4);
    ctx.stroke();
    if (rand() > 0.35) {
      const kx = 16 + rand() * (w - 32);
      const ky = y + boardH * (0.28 + rand() * 0.44);
      ctx.fillStyle = 'rgba(48, 26, 12, 0.52)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 3.2 + rand() * 4, 2 + rand() * 2.2, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 16, 8, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(22, 12, 6, 0.78)';
    ctx.fillRect(0, y, w, 4);
    ctx.fillStyle = 'rgba(210, 160, 90, 0.22)';
    ctx.fillRect(0, y + 4, w, 2);
  }
}

function drawMetal(ctx, w, h, seed, soot) {
  const rand = randFrom(seed);
  ctx.fillStyle = soot ? '#2a2e32' : '#6a7076';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (soot ? 28 : 16); i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 12 + rand() * (soot ? 48 : 28);
    const shade = soot ? 8 + rand() * 18 : 70 + rand() * 40;
    ctx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 4}, ${soot ? 0.35 : 0.18})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.45 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const scratches = soot ? 55 : 90;
  for (let i = 0; i < scratches; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 8 + rand() * (soot ? 28 : 46);
    const ang = (rand() - 0.5) * 0.7 + (rand() > 0.7 ? Math.PI * 0.5 : 0);
    const lite = soot ? 90 + rand() * 40 : 170 + rand() * 60;
    ctx.strokeStyle = `rgba(${lite}, ${lite + 4}, ${lite + 8}, ${0.12 + rand() * 0.28})`;
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i += 1) {
    const cx = rand() * w;
    const cy = rand() * h;
    ctx.strokeStyle = `rgba(200, 205, 210, ${0.08 + rand() * 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + rand() * 22, 0, Math.PI * (0.6 + rand() * 1.1));
    ctx.stroke();
  }
  if (soot) {
    ctx.fillStyle = 'rgba(8, 8, 10, 0.28)';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
  }
}

function drawWeave(ctx, w, h, seed) {
  const rand = randFrom(seed);
  ctx.fillStyle = '#8a6a58';
  ctx.fillRect(0, 0, w, h);
  const step = 4;
  for (let y = 0; y < h; y += step) {
    const shade = 110 + Math.floor(rand() * 36);
    ctx.fillStyle = `rgba(${shade + 20}, ${shade}, ${shade - 18}, 0.55)`;
    ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = `rgba(40, 24, 18, 0.18)`;
    ctx.fillRect(0, y + 2, w, 1);
  }
  for (let x = 0; x < w; x += step) {
    const shade = 100 + Math.floor(rand() * 30);
    ctx.fillStyle = `rgba(${shade + 16}, ${shade}, ${shade - 14}, 0.32)`;
    ctx.fillRect(x, 0, 2, h);
  }
  for (let i = 0; i < 18; i += 1) {
    ctx.fillStyle = `rgba(30, 16, 12, ${0.04 + rand() * 0.08})`;
    ctx.fillRect(rand() * w, rand() * h, 10 + rand() * 24, 6 + rand() * 10);
  }
}

function drawBrick(ctx, w, h, seed) {
  const rand = randFrom(seed);
  ctx.fillStyle = '#6a5346';
  ctx.fillRect(0, 0, w, h);
  const rows = 8;
  const cols = 6;
  const bh = h / rows;
  const bw = w / cols;
  for (let row = 0; row < rows; row += 1) {
    const stagger = (row % 2) * (bw * 0.5);
    for (let col = -1; col <= cols; col += 1) {
      const x = col * bw + stagger + 1;
      const y = row * bh + 1;
      const warm = 96 + Math.floor(rand() * 38);
      ctx.fillStyle = `rgb(${warm + 28}, ${Math.floor(warm * 0.48)}, ${Math.floor(warm * 0.32)})`;
      ctx.fillRect(x, y, bw - 3, bh - 3);
      ctx.fillStyle = `rgba(255, 210, 160, ${0.06 + rand() * 0.08})`;
      ctx.fillRect(x + 2, y + 1, (bw - 6) * 0.45, 3);
      ctx.fillStyle = `rgba(20, 10, 8, ${0.12 + rand() * 0.16})`;
      ctx.fillRect(x, y + bh - 6, bw - 3, 3);
    }
  }
  ctx.fillStyle = 'rgba(12, 10, 10, 0.32)';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = `rgba(8, 8, 8, ${0.1 + rand() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, h * (0.5 + rand() * 0.5), 18 + rand() * 30, 10 + rand() * 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStone(ctx, w, h, seed) {
  const rand = randFrom(seed);
  ctx.fillStyle = '#7a746c';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i += 1) {
    const shade = 70 + Math.floor(rand() * 70);
    ctx.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 10}, ${0.18 + rand() * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 8 + rand() * 28, 6 + rand() * 18, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 10; i += 1) {
    ctx.strokeStyle = `rgba(30, 26, 22, ${0.18 + rand() * 0.25})`;
    ctx.lineWidth = 0.8 + rand();
    const x = rand() * w;
    const y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 50, y + 10 + rand() * 40);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(10, 8, 8, 0.28)';
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.fillStyle = 'rgba(10, 8, 8, 0.34)';
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
}

function withRepeat(map, repeatX, repeatY) {
  map.repeat.set(repeatX, repeatY);
  return map;
}

/** Boarded oak grain. Same family as the chest planks. */
export function woodSurface(color, roughness = 0.86, repeatX = 1, repeatY = 1, seed = 4211) {
  const map = withRepeat(makeMap(`wood:${seed}`, 256, 256, (ctx, w, h) => drawWood(ctx, w, h, seed)), repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0.03,
  });
}

/** Scratched iron / brass. */
export function wornMetal(color, roughness = 0.36, metalness = 0.74) {
  const map = withRepeat(makeMap('metal-iron', 256, 256, (ctx, w, h) => drawMetal(ctx, w, h, 9001, false)), 1.4, 1.1);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness,
  });
}

/** Darker forge iron with soot wash. */
export function sootMetal(color, roughness = 0.48, metalness = 0.58) {
  const map = withRepeat(makeMap('metal-soot', 256, 256, (ctx, w, h) => drawMetal(ctx, w, h, 7741, true)), 1.2, 1.2);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness,
  });
}

/** Tight fabric weave for counter and table cloths. */
export function weaveCloth(color, roughness = 0.92) {
  const map = withRepeat(makeMap('cloth-weave', 128, 128, (ctx, w, h) => drawWeave(ctx, w, h, 3311)), 3.2, 2.4);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

/** Sooted brick for the cooking range. */
export function brickSurface(color = 0xc4a090, roughness = 0.9) {
  const map = withRepeat(makeMap('brick-soot', 256, 256, (ctx, w, h) => drawBrick(ctx, w, h, 5107)), 1.6, 1.3);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0.06,
  });
}

/** Mottled hearth stone for the furnace. */
export function stoneSoot(color = 0xb4aea4, roughness = 0.92) {
  const map = withRepeat(makeMap('stone-soot', 256, 256, (ctx, w, h) => drawStone(ctx, w, h, 6209)), 1.5, 1.4);
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0.08,
  });
}
