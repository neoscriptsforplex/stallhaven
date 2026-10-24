// Item 14: turn raw unlock rows into short popup groups.
// rows = unlocksBetween(skillId, from, to) -> [{id,name,kind,level}] from skillLevels.js.
import { ICONS } from './skillGuide.js';
import { TIER } from './skillGuideData.js';
import GUIDE_THUMBS from './guideThumbs.js';
import { thumbUrl } from './guideRenders.js';

/** Render key for an unlock id (herb patches drop their grow_ prefix), or null. */
export function popupRenderKey(id) {
  if (!id) return null;
  const p = GUIDE_THUMBS.popup;
  return p[id]?.key ?? p[String(id).replace(/^grow_/, '')]?.key ?? null;
}

const CAT_LABEL = { weapon: 'weapons', armour: 'armour', ammo: 'ammo', tool: 'tools', potion: 'potions', food: 'food' };
const CAT_ICON = { weapon: 'sword', armour: 'helm', ammo: 'sword', tool: 'pick', potion: 'potion', food: 'food' };
export function groupUnlocks(rows, recipes = {}) {
  const groups = new Map();
  for (const row of rows) {
    const r = recipes[row.id] ?? {};
    const first = row.name.split(' ')[0];
    let key, label, icon;
    // Food lists each dish by name ("Fish Pie", not "Fish food").
    if (row.kind === 'recipe' && r.category && r.category !== 'food' && CAT_LABEL[r.category] && row.name.includes(' ')) {
      key = `${first}|${r.category}`; label = `${first}${row.name.includes("D'hide") ? " d'hide" : ''} ${CAT_LABEL[r.category]}`; icon = CAT_ICON[r.category];
    } else if (/\b(Bar|Nails)$/.test(row.name)) {
      key = `${first}|bar`; label = `${first} bar & nails`; icon = 'bar';
    } else {
      key = row.id; label = row.name; icon = row.kind === 'gather' ? 'ore' : row.kind === 'item' ? 'house' : 'star';
    }
    const g = groups.get(key) ?? { key, label, icon, level: row.level, count: 0, names: [], firstId: row.id };
    g.count += 1; g.names.push(row.name); groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.level - b.level || b.count - a.count);
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** "UNLOCKED" block for the level-up popup: up to `max` groups, then "+N more". */
export function unlockListHtml(groups, { max = 4 } = {}) {
  if (!groups?.length) return '';
  const items = groups.slice(0, max).map((g) => {
    const tint = TIER[g.label.split(' ')[0].toLowerCase()] ?? TIER.gold;
    const glyph = ICONS[g.icon] ?? ICONS.star;
    const rk = popupRenderKey(g.firstId);
    const pic = rk
      ? `<img class="lu-render" src="${esc(thumbUrl(rk))}" width="24" height="24" alt="">`
      : `<i style="color:${tint}"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">${glyph}</svg></i>`;
    return `<li><span class="lu-icons">${pic}</span>`
      + `<span>${esc(g.label)}</span><span class="lu-count">${g.count > 1 ? `×${g.count}` : ''}</span></li>`;
  }).join('');
  const rest = groups.length - max;
  return `<div class="lu-unlocks"><p class="lu-head">Unlocked</p><ul class="lu-list">${items}</ul>`
    + (rest > 0 ? `<p class="lu-more">+${rest} more · see the Skills guide</p>` : '') + '</div>';
}
