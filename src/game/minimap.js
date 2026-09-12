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

export function clampMapZoom(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return MAP_ZOOM_DEFAULT;
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, value));
}

function mapYaw(yaw) {
  return (yaw ?? 0) + MAP_YAW_OFFSET;
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
    x: (0.5 + (spun.x / span) * zed) * size,
    y: (0.5 - (spun.z / span) * zed) * size,
  };
}

/** Canvas pixels → world XZ. Inverse of worldToMap. */
export function mapToWorld(px, py, bounds, size, yaw = 0, zoom = 1, focus = null) {
  const span = spanOf(bounds);
  const zed = clampMapZoom(zoom);
  const rx = ((px / size) - 0.5) * span / zed;
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

export function drawMinimap(ctx, snap) {
  const size = ctx.canvas.width;
  const bounds = snap.bounds ?? shopMapBounds(snap.expansions ?? []);
  const yaw = snap.yaw ?? 0;
  const zoom = clampMapZoom(snap.zoom ?? MAP_ZOOM_DEFAULT);
  const focus = snap.focus ?? snap.player ?? null;
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
  const hatch = toMap(TRAPDOOR.x, TRAPDOOR.z);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(hatch.x - 3, hatch.y - 3, 6, 6);

  const counter = toMap(SHOP.counter.x, SHOP.counter.z);
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(counter.x - 7, counter.y - 2, 14, 4);

  for (const piece of snap.furniture ?? []) {
    drawDot(ctx, toMap(piece.x, piece.z), 2.2, '#c4a05a');
  }
  for (const actor of snap.customers ?? []) {
    drawDot(ctx, toMap(actor.x, actor.z), 2.4, '#e8b45a', '#3a240e');
  }
  if (snap.player) {
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

  const ping = snap.ping;
  if (ping && ping.age < 1) {
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
}
