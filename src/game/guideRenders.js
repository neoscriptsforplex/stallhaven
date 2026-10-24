// Skill guide + level-up popup: which 3D model each unlock row shows.
// renderKey(skillId, row) -> 'item:<recipe/material id>' | 'furn:<piece id>' | null (keep the SVG glyph).
// PNGs live at public/thumbs/guide/<kind>-<id>.png (made by tools/render-guide-thumbs.mjs).
import { CONSTRUCTION_PIECES } from './construction.js';

const slug = (s) => s.toLowerCase().replace(/\(x\d+\)/g, '').replace(/d'hide/g, 'dhide').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const metal = (w) => (w === 'rune' ? 'runite' : w);

/** Rows whose name is a group or a node: the one model that stands for them. */
const BY_NAME = {
  'Dragon bar, nails & hatchet': 'dragon_hatchet',
  'Clay rock': 'hard_clay', 'Essence rock': 'essence',
  'Adamantite rock': 'adamant', 'Runite rock': 'runite',
  'Logs': 'logs', 'Plank': 'saw_plank',
  'Cloth': 'weave_cloth', 'Bow string': 'spin_bow_string', 'Soft clay': 'soft_clay',
  'Staff': 'staff', 'Elemental staves': 'magic_staff_air', 'Battlestaves': 'air_battlestaff',
  'Mystic staves': 'mystic_air_staff', 'Ancient staff': 'ancient_staff',
  'Redberry pie': 'pie', 'Pizza': 'plain_pizza', 'Pineapple pizza': 'pizza',
  'Antipoison': 'anti_poison_potion', 'Cannonballs (x20)': 'cannonballs', 'Dwarven multicannon': 'dwarven_multicannon',
};

export function itemCandidates(name) {
  if (BY_NAME[name]) return [BY_NAME[name]];
  const [first, ...rest] = name.split(' ');
  const m = metal(first.toLowerCase());
  const out = [];
  let r;
  if (/ weapons$/.test(name)) out.push(`${m}_scimitar`);
  else if (/ armour$/.test(name)) out.push(`${m}_platebody`);
  else if ((r = name.match(/^(\w+) bar & nails$/))) out.push(`smelt_${metal(r[1].toLowerCase())}`, `${metal(r[1].toLowerCase())}_bar`);
  else if (/ rock$/.test(name)) out.push(m);
  else if (/ (gloves|gauntlets) & boots$/.test(name) || /vambraces & boots$/.test(name)) out.push(slug(name.split(' & ')[0]).replace(/gloves|gauntlets|vambraces/, (g) => g));
  else if (/ plank$/.test(name)) out.push(`saw_${slug(name)}`);
  else if (/ rune$/.test(name)) out.push(`${slug(name)}`);
  else if (/thrown axe$/.test(name)) out.push(`${m}_thrownaxe`);
  else if (/robe$/.test(name)) out.push(`${slug(name)}_top`, slug(name));
  out.push(slug(name), `${m}_${slug(rest.join(' '))}`);
  return [...new Set(out)];
}

export function renderCandidates(skillId, row) {
  if (row.perk) return []; // perks keep the star
  if (skillId === 'construction') {
    const piece = CONSTRUCTION_PIECES.find((p) => p.name === row.name);
    if (piece) return [`furn:${piece.id}`];
    if (row.name === 'Rooms & stations') return [];
  }
  const items = itemCandidates(row.name).map((id) => `item:${id}`);
  const rock = row.name.match(/^(\w+) rock$/);
  if (rock) {
    const w = rock[1].toLowerCase();
    const ore = { adamantite: 'adamant', clay: 'clay', essence: 'essence' }[w] ?? w;
    return [`look:ore-${ore}`, ...items];
  }
  // Fishing rows with no fish model show the small fishing net.
  if (skillId === 'fishing') return [...items, 'look:small_net'];
  return items;
}

function baseUrl() {
  try {
    return import.meta.env.BASE_URL || './';
  } catch {
    return './';
  }
}
export const thumbUrl = (key, base = `${baseUrl()}thumbs/guide/`) => `${base}${key.replace(':', '-')}.png`;

/** Level-up popup groups: first underlying row id -> model. */
export const groupRenderKey = (group, firstRow) => (firstRow?.id ? `item:${firstRow.id}` : null);
