/**
 * Owned-material list for the bottom (desktop) / left (phone) drawer.
 * Counts of zero stay hidden. Swatches cover ores, bars, logs, essence, and crafts.
 */
import { METALS, formatGold, materialList } from './catalog.js';

/** Coarse pointers, and narrow portrait windows, use the left-edge drawer. */
export const MATERIALS_DRAWER_SIDE_QUERY =
  '(pointer: coarse), (orientation: portrait) and (max-width: 720px)';

const EXTRA_TINT = {
  logs: 0x8a5a32,
  flax: 0x6a9a3a,
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

export function materialsDrawerHtml(materials) {
  const rows = ownedMaterials(materials);
  if (!rows.length) return '<p class="materials-empty">No materials yet.</p>';
  return rows.map((mat) => (
    `<div class="mat materials-row" role="listitem" data-owned="${escapeHtml(mat.id)}">` +
    `<span class="mat-swatch" style="background:${mat.swatch}" aria-hidden="true"></span>` +
    `<span class="mat-name">${escapeHtml(mat.name)}</span>` +
    `<span class="mat-count">×${formatGold(mat.count)}</span>` +
    '</div>'
  )).join('');
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
    maxWidth: width * 0.25,
    maxHeight: Math.max(0, maxHeight),
  };
}
