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

export function shopMapBounds(expansionIds = []) {
  return gardenBox(expansionIds);
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
export function worldToMap(x, z, bounds, size, yaw = 0) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const spun = rotate(x - cx, z - cz, -yaw);
  const span = spanOf(bounds);
  return {
    x: (0.5 + spun.x / span) * size,
    y: (0.5 - spun.z / span) * size,
  };
}

/** Canvas pixels → world XZ. Inverse of worldToMap. */
export function mapToWorld(px, py, bounds, size, yaw = 0) {
  const span = spanOf(bounds);
  const rx = ((px / size) - 0.5) * span;
  const rz = (0.5 - (py / size)) * span;
  const world = rotate(rx, rz, yaw);
  return {
    x: (bounds.minX + bounds.maxX) / 2 + world.x,
    z: (bounds.minZ + bounds.maxZ) / 2 + world.z,
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

function rectPoints(minX, maxX, minZ, maxZ, bounds, size, yaw) {
  return [
    worldToMap(minX, minZ, bounds, size, yaw),
    worldToMap(maxX, minZ, bounds, size, yaw),
    worldToMap(maxX, maxZ, bounds, size, yaw),
    worldToMap(minX, maxZ, bounds, size, yaw),
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
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2f5a30';
  ctx.fillRect(0, 0, size, size);

  const grass = bounds;
  ctx.fillStyle = '#3a6a32';
  fillPoly(ctx, rectPoints(grass.minX, grass.maxX, grass.minZ, grass.maxZ, bounds, size, yaw));

  const rooms = [{ gx: 0, gz: 0 }, ...EXPANSION_PADS.filter((pad) => (snap.expansions ?? []).includes(pad.id))];
  ctx.fillStyle = '#8a6a3b';
  for (const room of rooms) {
    const floor = room.id ? roomFloor(room.gx, room.gz) : ORIGIN_FLOOR;
    const c = room.id ? roomCenter(room.gx, room.gz) : { x: 0, z: 0 };
    void c;
    fillPoly(ctx, rectPoints(floor.minX, floor.maxX, floor.minZ, floor.maxZ, bounds, size, yaw));
  }
  void ROOM_W;
  void ROOM_D;

  const path = cobblePathSpan(snap.expansions ?? []);
  ctx.fillStyle = '#b8a078';
  fillPoly(ctx, rectPoints(path.minX, path.maxX, path.minZ, path.maxZ, bounds, size, yaw));
  void PATH_HALF_W;
  void PATH_START_Z;

  const fountain = worldToMap(FOUNTAIN.x, FOUNTAIN.z, bounds, size, yaw);
  drawDot(ctx, fountain, 5, '#6a8aa8', '#d8e8f0');
  const hatch = worldToMap(TRAPDOOR.x, TRAPDOOR.z, bounds, size, yaw);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(hatch.x - 3, hatch.y - 3, 6, 6);

  const counter = worldToMap(SHOP.counter.x, SHOP.counter.z, bounds, size, yaw);
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(counter.x - 7, counter.y - 2, 14, 4);

  for (const piece of snap.furniture ?? []) {
    drawDot(ctx, worldToMap(piece.x, piece.z, bounds, size, yaw), 2.2, '#c4a05a');
  }
  for (const actor of snap.customers ?? []) {
    drawDot(ctx, worldToMap(actor.x, actor.z, bounds, size, yaw), 2.4, '#e8b45a', '#3a240e');
  }
  if (snap.player) {
    const you = worldToMap(snap.player.x, snap.player.z, bounds, size, yaw);
    ctx.save();
    ctx.translate(you.x, you.y);
    ctx.rotate(-(snap.player.facing ?? 0) + yaw);
    ctx.fillStyle = '#f4f0e4';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 4);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
