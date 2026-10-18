/**
 * Owned-material list for the bottom (desktop) / left (phone) drawer.
 * Counts of zero stay hidden. Swatches cover ores, bars, logs, essence, and crafts.
 */
import { METALS, formatGold, materialList } from './catalog.js';

/** Coarse pointers, and narrow portrait windows, use the left-edge drawer. */
export const MATERIALS_DRAWER_SIDE_QUERY =
  '(pointer: coarse), (orientation: portrait) and (max-width: 720px)';

/** Open phone panel is double the old quarter-screen, and never past 90% of the width. */
export const MATERIALS_DRAWER_SIDE_SHARE = 0.5;
export const MATERIALS_DRAWER_SIDE_CAP = 0.9;

const EXTRA_TINT = {
  logs: 0x8a5a32,
  flax: 0x6a9a3a,
  wheat: 0xd6b64a,
  bow_string: 0xe6d2a8,
  cloth: 0xd7c4a0,
  soft_clay: 0xc4845a,
  orb: 0x9ec4e8,
  hide: 0x8a5a3a,
  egg: 0xf2e2b0,
  flour: 0xf4efe4,
  pineapple: 0xe2b13a,
  raspberry: 0xc43a52,
  chocolate: 0x6a3a28,
  fish: 0x7aa8c4,
  herbs: 0x3a8a45,
  water: 0x3a7ec8,
  essence: 0xb7e3f5,
  dwarven_plans: 0xc4a05a,
  ancient_plans: 0xc4a05a,
};

export function materialTint(mat) {
  if (mat?.tint != null) return mat.tint;
  if (EXTRA_TINT[mat?.id] != null) return EXTRA_TINT[mat.id];
  const metal = METALS.find((entry) => entry.id === mat?.id);
  if (metal?.tint != null) return metal.tint;
  return 0xc4a06a;
}

export function tintHex(tint) {
  return `#${(Number(tint) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Catalog order, positive counts only. Bars, logs, essence, and crafts included. */
export function ownedMaterials(materials) {
  const rows = [];
  for (const mat of materialList()) {
    const count = Math.max(0, Math.round(Number(materials?.[mat.id]) || 0));
    if (count <= 0) continue;
    rows.push({
      id: mat.id,
      name: mat.name,
      count,
      swatch: tintHex(materialTint(mat)),
    });
  }
  return rows;
}

export function ownedMaterialsKey(materials) {
  return ownedMaterials(materials).map((mat) => `${mat.id}:${mat.count}`).join('|');
}

export function materialsDrawerHtml(materials, cap = 250) {
  const limit = Math.max(1, Math.round(Number(cap) || 250));
  const rows = ownedMaterials(materials);
  if (!rows.length) return '<p class="materials-empty">No materials yet.</p>';
  return rows.map((mat) => {
    const full = mat.count >= limit;
    return `<div class="mat materials-row${full ? ' is-full' : ''}" role="listitem" data-owned="${escapeHtml(mat.id)}">` +
      `<span class="mat-swatch" style="background:${mat.swatch}" aria-hidden="true"></span>` +
      `<span class="mat-name">${escapeHtml(mat.name)}</span>` +
      `<span class="mat-count">×${formatGold(mat.count)}</span>` +
      (full ? `<button type="button" class="sf-full" data-storage-full="${escapeHtml(mat.id)}" title="Storage full">FULL</button>` : '') +
      '</div>';
  }).join('');
}

/**
 * Side-drawer box under the top-left HUD and above a full-width bottom bar.
 * Null top/bottom means "keep the CSS fallback" (safe area, no measured obstacle).
 */
export function materialsDrawerSideBox({
  viewportWidth,
  viewportHeight,
  obstacles = [],
  gap = 8,
} = {}) {
  const width = Number(viewportWidth) || 0;
  const height = Number(viewportHeight) || 0;
  let top = 0;
  let sawTop = false;
  let bottomEdge = null;
  for (const rect of obstacles) {
    if (!rect || !(rect.width > 1) || !(rect.height > 1)) continue;
    const onLeft = rect.left < width * 0.5;
    if (onLeft && rect.top < height * 0.5) {
      top = Math.max(top, rect.bottom);
      sawTop = true;
    }
    const spansWidth = rect.left <= 8 && rect.right >= width * 0.6;
    if (spansWidth && rect.top >= height * 0.5) {
      bottomEdge = bottomEdge == null ? rect.top : Math.min(bottomEdge, rect.top);
    }
  }
  const topPx = sawTop ? top + gap : null;
  const bottomPx = bottomEdge == null ? null : Math.max(0, height - bottomEdge + gap);
  const maxHeight = height - (topPx ?? gap) - (bottomPx ?? 0);
  return {
    top: topPx,
    bottom: bottomPx,
    maxWidth: Math.min(width * MATERIALS_DRAWER_SIDE_SHARE, width * MATERIALS_DRAWER_SIDE_CAP),
    maxHeight: Math.max(0, maxHeight),
  };
}

/** True when a point lies in a rectangle that actually has area. */
export function rectContains(rect, x, y) {
  if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const width = Number.isFinite(rect.width) ? rect.width : rect.right - rect.left;
  const height = Number.isFinite(rect.height) ? rect.height : rect.bottom - rect.top;
  if (!(width > 0) || !(height > 0)) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function primaryPointer(type, button) {
  if (button == null || button === 0) return true;
  return type !== 'pointerdown' && button === -1;
}

/**
 * Mouse and touch share one plan. Arm on a primary press over the tab, and
 * toggle on release only if that press is still on the tab. Swallow the
 * gesture when it is on the tab, or over the open list while the event target
 * is outside the drawer, so the click never reaches the world. Events that
 * already target the open list are left alone so it can scroll.
 */
export function materialsDrawerPointerPlan({
  type,
  button = 0,
  x = 0,
  y = 0,
  toggleRect = null,
  panelRect = null,
  open = false,
  armed = false,
  targetInDrawer = false,
} = {}) {
  const primary = primaryPointer(type, button);
  const onToggle = rectContains(toggleRect, x, y);
  const onPanel = Boolean(open) && rectContains(panelRect, x, y);
  const passThrough = onToggle || (onPanel && !targetInDrawer);
  if (type === 'pointercancel') {
    const swallow = Boolean(armed);
    return { swallow, toggle: false, arm: false, prevent: swallow };
  }
  if (type === 'pointerdown') {
    return {
      swallow: passThrough,
      toggle: false,
      arm: Boolean(primary && onToggle),
      prevent: passThrough,
    };
  }
  if (type === 'pointerup') {
    const toggle = Boolean(primary && armed && onToggle);
    const swallow = toggle || passThrough || Boolean(armed);
    return { swallow, toggle, arm: false, prevent: swallow };
  }
  return { swallow: false, toggle: false, arm: Boolean(armed), prevent: false };
}

/** Backup hit test for the world canvas, using the tab and the open list. */
export function materialsDrawerBlocksPoint(x, y, doc = globalThis.document) {
  const drawer = doc?.querySelector?.('#materials-drawer');
  const toggle = doc?.querySelector?.('#materials-toggle');
  if (!drawer || !toggle) return false;
  const open = drawer.classList.contains('is-open');
  const panel = doc.querySelector('#materials-panel');
  return rectContains(toggle.getBoundingClientRect(), x, y)
    || (open && rectContains(panel?.getBoundingClientRect(), x, y));
}
