import { SHOP } from './catalog.js';
import {
  EXPANSION_PADS,
  FOUNTAIN,
  ORIGIN_FLOOR,
  PATH_HALF_W,
  PATH_START_Z,
  ROOM_D,
  ROOM_W,
  TRAPDOOR,
  cobblePathSpan,
  gardenBox,
  gardenTrapdoorSpot,
  roomCenter,
  roomFloor,
} from './layout.js';

export const MAP_YAW_OFFSET = Math.PI;
export const MAP_ZOOM_MIN = 0.85;
export const MAP_ZOOM_MAX = 2.4;
export const MAP_ZOOM_DEFAULT = 1;

export function shopMapBounds(expansionIds = []) {
  return gardenBox(expansionIds);
}

/** Same shell as buildDungeon / dungeonWallObstacles: 11×9, walls 0.22 thick. */
const DUNGEON_W = 11;
const DUNGEON_D = 9;
const DUNGEON_WALL_T = 0.22;

export function dungeonShellRect() {
  const hx = DUNGEON_W / 2 + DUNGEON_WALL_T / 2;
  const hz = DUNGEON_D / 2 + DUNGEON_WALL_T / 2;
  return { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz };
}

export function dungeonFloorRect() {
  const hx = DUNGEON_W / 2 - DUNGEON_WALL_T / 2;
  const hz = DUNGEON_D / 2 - DUNGEON_WALL_T / 2;
  return { minX: -hx, maxX: hx, minZ: -hz, maxZ: hz };
}

/** Square bounds big enough that the whole room stays on the canvas when the map yaws. */
export function dungeonMapBounds() {
  const shell = dungeonShellRect();
  const halfW = (shell.maxX - shell.minX) / 2;
  const halfH = (shell.maxZ - shell.minZ) / 2;
  const half = Math.hypot(halfW, halfH) + 0.4;
  return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

export function dungeonMapFocus() {
  return { x: 0, z: 0 };
}

/** Bounds and focus shared by drawing and click-to-walk. */
export function minimapFrame(snap) {
  const dungeon = snap?.sceneMode === 'dungeon';
  if (dungeon) {
    return {
      bounds: snap.bounds ?? dungeonMapBounds(),
      focus: snap.focus ?? dungeonMapFocus(),
      yaw: snap.yaw ?? 0,
    };
  }
  return {
    bounds: snap?.bounds ?? shopMapBounds(snap?.expansions ?? []),
    focus: snap?.focus ?? snap?.player ?? null,
    yaw: snap?.yaw ?? 0,
  };
}

export function clampMapZoom(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return MAP_ZOOM_DEFAULT;
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, value));
}

function mapYaw(yaw) {
  // Camera yaw is negated so turning left spins the map left. The 180° offset
  // still puts shop-forward (+Z) toward the bottom of the canvas at yaw 0.
  return MAP_YAW_OFFSET - (yaw ?? 0);
}

function focusOf(bounds, focus) {
  return {
    x: focus?.x ?? (bounds.minX + bounds.maxX) / 2,
    z: focus?.z ?? (bounds.minZ + bounds.maxZ) / 2,
  };
}

function spanOf(bounds) {
  return Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) || 1;
}

function rotate(dx, dz, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** World XZ → canvas pixels. Yaw rotates the map so camera-forward is up. */
export function worldToMap(x, z, bounds, size, yaw = 0, zoom = 1, focus = null) {
  const origin = focusOf(bounds, focus);
  const spun = rotate(x - origin.x, z - origin.z, -mapYaw(yaw));
  const span = spanOf(bounds);
  const zed = clampMapZoom(zoom);
  return {
    x: (0.5 - (spun.x / span) * zed) * size,
    y: (0.5 - (spun.z / span) * zed) * size,
  };
}

/** Canvas pixels → world XZ. Inverse of worldToMap. */
export function mapToWorld(px, py, bounds, size, yaw = 0, zoom = 1, focus = null) {
  const span = spanOf(bounds);
  const zed = clampMapZoom(zoom);
  const rx = (0.5 - (px / size)) * span / zed;
  const rz = (0.5 - (py / size)) * span / zed;
  const world = rotate(rx, rz, mapYaw(yaw));
  const origin = focusOf(bounds, focus);
  return {
    x: origin.x + world.x,
    z: origin.z + world.z,
  };
}

function fillPoly(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}

function rectPoints(minX, maxX, minZ, maxZ, bounds, size, yaw, zoom, focus) {
  return [
    worldToMap(minX, minZ, bounds, size, yaw, zoom, focus),
    worldToMap(maxX, minZ, bounds, size, yaw, zoom, focus),
    worldToMap(maxX, maxZ, bounds, size, yaw, zoom, focus),
    worldToMap(minX, maxZ, bounds, size, yaw, zoom, focus),
  ];
}

function drawDot(ctx, pt, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Outdoor trapdoor / dungeon entrance. Same visual weight as the fountain circle. */
export const TRAPDOOR_MARKER_RADIUS = 5;
export const TRAPDOOR_MARKER_FILE = 'minimap/trapdoor.png';

/**
 * World XZ for the dungeon-entrance minimap icon.
 *
 * Luke's shot: shop at the top, blue fountain on the vertical cobble, old
 * hatch icon on the LEFT of that path. The circled target is the same
 * height on the RIGHT — opposite the leftover left-side mark, on the real
 * outdoor +X hatch. Keep the 3D trapdoor where it is; only the map point
 * is forced onto that path-right side so a mirrored X cannot sneak back.
 */
export function dungeonEntranceMarkerWorld(hatch = TRAPDOOR) {
  const src = hatch ?? TRAPDOOR;
  const offset = Math.abs(Number(src.x));
  return {
    x: offset > PATH_HALF_W ? offset : TRAPDOOR.x,
    z: Number.isFinite(src.z) ? src.z : TRAPDOOR.z,
  };
}

const BLACK_PUNCH = 24;
let trapdoorIcon = null;
let trapdoorIconTried = false;

export function trapdoorMarkerUrls() {
  let envBase = './';
  try {
    const raw = import.meta.env.BASE_URL || './';
    envBase = raw.endsWith('/') ? raw : `${raw}/`;
  } catch {
    envBase = './';
  }
  const roots = [`${envBase}minimap/`, `${envBase}public/minimap/`];
  if (envBase !== './') roots.push('./minimap/', './public/minimap/');
  return [...new Set(roots)].map((root) => `${root}trapdoor.png`);
}

function punchNearBlackBackdrop(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h || typeof document === 'undefined') return img;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext?.('2d', { willReadFrequently: true });
  if (!ctx?.drawImage || !ctx.getImageData) return img;
  ctx.drawImage(img, 0, 0);
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    return img;
  }
  const data = imageData.data;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    seen[i] = 1;
    const p = i * 4;
    if (data[p + 3] > 0 && data[p] + data[p + 1] + data[p + 2] < BLACK_PUNCH) stack.push(i);
  };
  for (let x = 0; x < w; x += 1) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    data[i * 4 + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function ensureTrapdoorIcon() {
  if (trapdoorIcon) return trapdoorIcon;
  if (trapdoorIconTried) return null;
  trapdoorIconTried = true;
  if (typeof Image !== 'function') return null;
  try {
    const urls = trapdoorMarkerUrls();
    const img = new Image();
    let next = 0;
    const tryNext = () => {
      if (next >= urls.length) return;
      img.src = urls[next];
      next += 1;
    };
    img.decoding = 'async';
    img.onload = () => {
      trapdoorIcon = punchNearBlackBackdrop(img);
    };
    img.onerror = tryNext;
    tryNext();
  } catch {
    return null;
  }
  return null;
}

function drawTrapdoorFallback(ctx, pt) {
  const r = TRAPDOOR_MARKER_RADIUS;
  drawDot(ctx, pt, r, '#5a3a22', '#d8c4a0');
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(pt.x - r * 0.45, pt.y - r * 0.45, r * 0.9, r * 0.9);
  ctx.strokeStyle = '#3a2414';
  ctx.lineWidth = 1;
  ctx.strokeRect(pt.x - r * 0.45, pt.y - r * 0.45, r * 0.9, r * 0.9);
}

function drawTrapdoorMarker(ctx, pt) {
  ensureTrapdoorIcon();
  const icon = trapdoorIcon;
  const size = TRAPDOOR_MARKER_RADIUS * 2;
  if (icon) {
    ctx.drawImage(icon, pt.x - size / 2, pt.y - size / 2, size, size);
    return;
  }
  drawTrapdoorFallback(ctx, pt);
}

function cssHex(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

function drawPlayerMarker(ctx, snap, toMap, yaw) {
  if (!snap.player) return;
  const you = toMap(snap.player.x, snap.player.z);
  ctx.save();
  ctx.translate(you.x, you.y);
  ctx.rotate(-(snap.player.facing ?? 0) + mapYaw(yaw));
  ctx.fillStyle = '#f4f0e4';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3.5, 4);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMovePing(ctx, snap, toMap) {
  const ping = snap.ping;
  if (!ping || ping.age >= 1) return;
  const pt = toMap(ping.x, ping.z);
  const t = Math.min(1, Math.max(0, ping.age));
  const alpha = 1 - t;
  const radius = 4 + t * 16;
  ctx.save();
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(244, 226, 164, ${0.92 * alpha})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(244, 226, 164, ${0.85 * alpha})`;
  ctx.fill();
  ctx.restore();
}

/** Exit ladder, same weight as the outdoor trapdoor mark. */
function drawLadderMarker(ctx, pt) {
  const h = 12;
  const w = 7;
  ctx.save();
  ctx.strokeStyle = '#e6d3b0';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(pt.x - w / 2, pt.y - h / 2);
  ctx.lineTo(pt.x - w / 2, pt.y + h / 2);
  ctx.moveTo(pt.x + w / 2, pt.y - h / 2);
  ctx.lineTo(pt.x + w / 2, pt.y + h / 2);
  for (let i = 0; i < 4; i += 1) {
    const y = pt.y - h / 2 + ((i + 0.5) * h) / 4;
    ctx.moveTo(pt.x - w / 2, y);
    ctx.lineTo(pt.x + w / 2, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDungeonMinimap(ctx, snap, frame, zoom) {
  const size = ctx.canvas.width;
  const { bounds, yaw, focus } = frame;
  const toMap = (x, z) => worldToMap(x, z, bounds, size, yaw, zoom, focus);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#241c16';
  ctx.fillRect(0, 0, size, size);

  const shell = dungeonShellRect();
  ctx.fillStyle = '#4e4338';
  fillPoly(ctx, rectPoints(shell.minX, shell.maxX, shell.minZ, shell.maxZ, bounds, size, yaw, zoom, focus));

  const floor = dungeonFloorRect();
  ctx.fillStyle = '#8d7356';
  fillPoly(ctx, rectPoints(floor.minX, floor.maxX, floor.minZ, floor.maxZ, bounds, size, yaw, zoom, focus));

  for (const rock of snap.rocks ?? []) {
    const large = rock.essence || (rock.scale ?? 1) >= 1.5;
    drawDot(ctx, toMap(rock.x, rock.z), large ? 5.4 : 3.4, cssHex(rock.vein, '#6e5a32'), '#1c140e');
  }
  if (snap.ladder) drawLadderMarker(ctx, toMap(snap.ladder.x, snap.ladder.z));
  for (const rat of snap.rats ?? []) {
    drawDot(ctx, toMap(rat.x, rat.z), 2.4, '#d7cfc4', '#2a2016');
  }
  drawPlayerMarker(ctx, snap, toMap, yaw);
  drawMovePing(ctx, snap, toMap);
}

export function drawMinimap(ctx, snap) {
  const frame = minimapFrame(snap);
  const zoom = clampMapZoom(snap.zoom ?? MAP_ZOOM_DEFAULT);
  if (snap.sceneMode === 'dungeon') {
    drawDungeonMinimap(ctx, snap, frame, zoom);
    return;
  }
  const size = ctx.canvas.width;
  const { bounds, yaw, focus } = frame;
  const toMap = (x, z) => worldToMap(x, z, bounds, size, yaw, zoom, focus);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2f5a30';
  ctx.fillRect(0, 0, size, size);

  const grass = bounds;
  ctx.fillStyle = '#3a6a32';
  fillPoly(ctx, rectPoints(grass.minX, grass.maxX, grass.minZ, grass.maxZ, bounds, size, yaw, zoom, focus));

  const rooms = [{ gx: 0, gz: 0 }, ...EXPANSION_PADS.filter((pad) => (snap.expansions ?? []).includes(pad.id))];
  ctx.fillStyle = '#8a6a3b';
  for (const room of rooms) {
    const floor = room.id ? roomFloor(room.gx, room.gz) : ORIGIN_FLOOR;
    const c = room.id ? roomCenter(room.gx, room.gz) : { x: 0, z: 0 };
    void c;
    fillPoly(ctx, rectPoints(floor.minX, floor.maxX, floor.minZ, floor.maxZ, bounds, size, yaw, zoom, focus));
  }
  void ROOM_W;
  void ROOM_D;

  const path = cobblePathSpan(snap.expansions ?? []);
  ctx.fillStyle = '#b8a078';
  fillPoly(ctx, rectPoints(path.minX, path.maxX, path.minZ, path.maxZ, bounds, size, yaw, zoom, focus));
  void PATH_HALF_W;
  void PATH_START_Z;

  const fountain = toMap(FOUNTAIN.x, FOUNTAIN.z);
  drawDot(ctx, fountain, 5, '#6a8aa8', '#d8e8f0');
  const hatch = gardenTrapdoorSpot(snap.expansions ?? []) ?? TRAPDOOR;
  const mark = dungeonEntranceMarkerWorld(hatch);
  drawTrapdoorMarker(ctx, toMap(mark.x, mark.z));

  const counter = toMap(SHOP.counter.x, SHOP.counter.z);
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(counter.x - 7, counter.y - 2, 14, 4);

  for (const piece of snap.furniture ?? []) {
    drawDot(ctx, toMap(piece.x, piece.z), 2.2, '#c4a05a');
  }
  for (const actor of snap.customers ?? []) {
    drawDot(ctx, toMap(actor.x, actor.z), 2.4, '#e8b45a', '#3a240e');
  }
  drawPlayerMarker(ctx, snap, toMap, yaw);
  drawMovePing(ctx, snap, toMap);
}
