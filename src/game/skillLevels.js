/**
 * Per-recipe skill, unlock level, and XP from PROGRESSION.md.
 * Items added after that spec (nails, pot of flour, multicannon, ancient staff,
 * sawmill planks) sit on the same curve.
 *
 * `applyRecipeLevels` stamps `skill`, `xp`, and `requires` onto catalog recipes.
 * This file does not import the catalog, so the catalog can import it.
 */

import { CONSTRUCTION_UNLOCKS } from './construction.js';
import { GATHER_NODES } from './skills.js';

const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'runite', 'dragon'];

/** [level, xp] in bronze → dragon order. A null slot skips that metal (no dragon full helm). */
function smith(piece, rows) {
  const out = {};
  rows.forEach((row, index) => {
    if (!row) return;
    out[`${METALS[index]}_${piece}`] = ['smithing', row[0], row[1]];
  });
  return out;
}

function smelt(rows) {
  const out = {};
  rows.forEach((row, index) => {
    out[`smelt_${METALS[index]}`] = ['smithing', row[0], row[1]];
  });
  return out;
}

function fletchMetal(piece, rows) {
  const out = {};
  rows.forEach((row, index) => {
    out[`${METALS[index]}_${piece}`] = ['fletching', row[0], row[1]];
  });
  return out;
}

function row(skill, level, xp) {
  return [skill, level, xp];
}

/**
 * Nails are a short anvil batch (one bar → 15). They unlock with that metal's
 * dagger and pay a bit less XP, scaled by the shorter bar.
 */
const NAIL_LEVELS = [
  [1, 3],
  [15, 6],
  [30, 15],
  [50, 46],
  [70, 145],
  [85, 340],
  [90, 480],
];

/** Melee smithing unlocks by metal, not by piece. XP stays on the old curve. */
export const MELEE_SMITH_LEVELS = [1, 5, 10, 20, 30, 40, 60];

/** Altar output doubles once Runecrafting reaches this multiple of the rune's level. */
export const RUNE_DOUBLE_LEVEL_MULT = 2;

const MELEE_SMITH_PIECES = [
  'dagger', 'mace', 'med_helm', 'sword', 'scimitar', 'full_helm', 'spear',
  'boots', 'chainbody', 'kiteshield', '2h_sword', 'plateskirt', 'platelegs', 'platebody',
];

const LEVELS = {
  ...smelt([
    [1, 4], [15, 9], [30, 25], [50, 79], [70, 250], [85, 600], [90, 860],
  ]),
  ...smith('dagger', [
    [1, 4], [15, 9], [30, 25], [50, 79], [70, 250], [85, 600], [90, 860],
  ]),
  ...smith('hatchet', [
    [2, 4], [16, 10], [31, 26], [51, 83], [71, 260], [86, 630], [90, 860],
  ]),
  ...smith('mace', [
    [3, 4], [17, 10], [32, 27], [52, 88], [72, 275], [87, 660], [91, 905],
  ]),
  ...smith('med_helm', [
    [4, 5], [18, 14], [33, 34], [53, 105], [73, 330], [87, 740], [92, 1060],
  ]),
  ...smith('sword', [
    [5, 4], [19, 11], [34, 30], [54, 97], [74, 305], [88, 695], [92, 950],
  ]),
  ...smith('scimitar', [
    [6, 4], [20, 12], [35, 31], [55, 100], [75, 320], [89, 730], [92, 950],
  ]),
  ...smith('pickaxe', [
    [7, 5], [21, 13], [36, 33], [56, 105], [76, 335], [90, 765], [93, 1000],
  ]),
  ...smith('full_helm', [
    [8, 7], [22, 17], [37, 42], [57, 130], [77, 400], [90, 860], null,
  ]),
  ...smith('spear', [
    [9, 5], [23, 14], [38, 36], [58, 120], [78, 370], [91, 805], [94, 1050],
  ]),
  ...smith('boots', [
    [10, 7], [24, 18], [39, 46], [59, 145], [79, 445], [92, 950], [94, 1170],
  ]),
  ...smith('chainbody', [
    [12, 8], [26, 20], [41, 51], [61, 160], [81, 490], [94, 1050], [96, 1290],
  ]),
  ...smith('kiteshield', [
    [13, 8], [27, 21], [42, 53], [62, 165], [82, 515], [94, 1050], [96, 1290],
  ]),
  ...smith('2h_sword', [
    [15, 7], [29, 19], [44, 49], [64, 160], [84, 500], [96, 1030], [97, 1220],
  ]),
  ...smith('plateskirt', [
    [17, 10], [31, 26], [46, 65], [66, 205], [86, 630], [97, 1220], [98, 1420],
  ]),
  ...smith('platelegs', [
    [17, 10], [31, 26], [46, 65], [66, 205], [86, 630], [97, 1220], [98, 1420],
  ]),
  ...smith('platebody', [
    [19, 11], [33, 28], [48, 72], [68, 225], [88, 695], [99, 1340], [99, 1490],
  ]),
  ...smith('nails', NAIL_LEVELS),

  ...fletchMetal('arrows', [
    [1, 4], [15, 9], [30, 25], [45, 62], [60, 150], [75, 365], [90, 860],
  ]),
  ...fletchMetal('thrownaxe', [
    [3, 4], [22, 13], [37, 35], [52, 88], [67, 215], [81, 490], [95, 1100],
  ]),
  ...fletchMetal('crossbow', [
    [9, 5], [24, 15], [39, 38], [54, 97], [61, 160], [69, 270], [78, 475],
  ]),
  shortbow: row('fletching', 5, 4),
  oak_shortbow: row('fletching', 20, 12),
  willow_shortbow: row('fletching', 35, 31),
  maple_shortbow: row('fletching', 50, 79),
  yew_shortbow: row('fletching', 65, 195),
  magic_shortbow: row('fletching', 80, 465),
  longbow: row('fletching', 10, 5),
  oak_longbow: row('fletching', 25, 15),
  willow_longbow: row('fletching', 40, 40),
  maple_longbow: row('fletching', 55, 100),
  yew_longbow: row('fletching', 70, 250),
  magic_longbow: row('fletching', 85, 600),
  cannonballs: row('fletching', 35, 31),
  // End-game cannon. Already locked at Smithing 99; the 12s craft pays a bit
  // above a dragon platebody.
  dwarven_multicannon: row('smithing', 99, 1790),

  attack_potion: row('herblore', 1, 5),
  strength_potion: row('herblore', 10, 9),
  anti_poison_potion: row('herblore', 20, 18),
  energy_potion: row('herblore', 30, 34),
  prayer_potion: row('herblore', 40, 64),
  antifire_potion: row('herblore', 55, 150),
  ranging_potion: row('herblore', 65, 280),
  magic_potion: row('herblore', 75, 500),

  // Cooking: OSRS unlock levels (oldschool.runescape.wiki/w/Cooking). XP follows the
  // game's smithing curve (4*e^(0.06*(lv-1))) plus a +12 floor so early dishes feel quick,
  // and always rises with level. Milling keeps a token 2 XP.
  pot_of_flour: row('cooking', 1, 2),
  shrimp: row('cooking', 1, 16),
  bread: row('cooking', 1, 18),
  pie: row('cooking', 10, 19), // Redberry Pie
  salmon: row('cooking', 25, 29),
  plain_pizza: row('cooking', 35, 43), // Pizza
  lobster: row('cooking', 40, 54),
  cake: row('cooking', 40, 56),
  fish_pie: row('cooking', 47, 75),
  chocolate_cake: row('cooking', 50, 88),
  curry: row('cooking', 60, 150),
  monkfish: row('cooking', 62, 167),
  pizza: row('cooking', 65, 198), // Pineapple Pizza
  shark: row('cooking', 80, 470),
  anglerfish: row('cooking', 84, 594),
  summer_pie: row('cooking', 95, 1138),

  weave_cloth: row('crafting', 1, 5),
  unpowered_orb: row('smithing', 1, 8),
  soft_clay: row('crafting', 1, 5),
  wizard_boots: row('crafting', 3, 5),
  wizard_hat: row('crafting', 5, 6),
  wizard_robe: row('crafting', 8, 7),
  spin_bow_string: row('crafting', 10, 7),
  staff: row('crafting', 12, 8),
  mystic_gloves: row('crafting', 20, 15),
  mystic_boots: row('crafting', 20, 15),
  mystic_hat: row('crafting', 22, 17),
  mystic_robe_bottom: row('crafting', 24, 18),
  mystic_robe_top: row('crafting', 26, 20),
  green_dhide_vambraces: row('crafting', 28, 18),
  green_dhide_boots: row('crafting', 28, 18),
  green_dragon_mask: row('crafting', 30, 20),
  green_dhide_chaps: row('crafting', 32, 22),
  green_dhide_body: row('crafting', 34, 24),
  magic_staff_air: row('crafting', 36, 40),
  magic_staff_water: row('crafting', 36, 40),
  magic_staff_earth: row('crafting', 36, 40),
  magic_staff_fire: row('crafting', 36, 40),
  splitbark_gauntlets: row('crafting', 38, 44),
  splitbark_boots: row('crafting', 38, 44),
  splitbark_hat: row('crafting', 40, 48),
  splitbark_robe_bottom: row('crafting', 42, 53),
  splitbark_robe_top: row('crafting', 44, 59),
  blue_dhide_vambraces: row('crafting', 46, 54),
  blue_dhide_boots: row('crafting', 46, 54),
  blue_dragon_mask: row('crafting', 48, 60),
  blue_dhide_chaps: row('crafting', 50, 66),
  blue_dhide_body: row('crafting', 52, 73),
  air_battlestaff: row('crafting', 54, 130),
  water_battlestaff: row('crafting', 54, 130),
  earth_battlestaff: row('crafting', 54, 130),
  fire_battlestaff: row('crafting', 54, 130),
  battlemage_gloves: row('crafting', 56, 125),
  battlemage_boots: row('crafting', 56, 125),
  battlemage_hat: row('crafting', 58, 135),
  battlemage_robe_bottom: row('crafting', 60, 150),
  battlemage_robe_top: row('crafting', 62, 165),
  red_dhide_vambraces: row('crafting', 64, 160),
  red_dhide_boots: row('crafting', 64, 160),
  red_dragon_mask: row('crafting', 66, 175),
  red_dhide_chaps: row('crafting', 67, 185),
  red_dhide_body: row('crafting', 68, 195),
  lunar_gloves: row('crafting', 70, 285),
  lunar_boots: row('crafting', 70, 285),
  lunar_hat: row('crafting', 72, 315),
  lunar_robe_bottom: row('crafting', 74, 345),
  lunar_robe_top: row('crafting', 76, 385),
  black_dhide_vambraces: row('crafting', 78, 370),
  black_dhide_boots: row('crafting', 78, 370),
  black_dragon_mask: row('crafting', 80, 410),
  black_dhide_chaps: row('crafting', 81, 430),
  black_dhide_body: row('crafting', 82, 450),
  mystic_air_staff: row('crafting', 84, 710),
  mystic_water_staff: row('crafting', 84, 710),
  mystic_earth_staff: row('crafting', 84, 710),
  mystic_fire_staff: row('crafting', 84, 710),
  ancient_gloves: row('crafting', 86, 705),
  ancient_boots: row('crafting', 86, 705),
  ancient_hat: row('crafting', 87, 740),
  ancient_robe_bottom: row('crafting', 88, 780),
  ancient_robe_top: row('crafting', 89, 820),
  ancient_staff: row('crafting', 92, 1270),

  saw_plank: row('construction', 1, 4),
  saw_oak_plank: row('construction', 15, 8),
  saw_willow_plank: row('construction', 30, 20),
  saw_maple_plank: row('construction', 45, 52),
  saw_yew_plank: row('construction', 60, 130),
  saw_magic_plank: row('construction', 75, 320),

  air_rune: row('runecrafting', 1, 4),
  water_rune: row('runecrafting', 5, 9),
  earth_rune: row('runecrafting', 9, 6),
  fire_rune: row('runecrafting', 14, 13),
};

for (const piece of MELEE_SMITH_PIECES) {
  METALS.forEach((metal, index) => {
    const entry = LEVELS[`${metal}_${piece}`];
    if (!entry) return;
    entry[1] = MELEE_SMITH_LEVELS[index];
  });
}

/** Same levels as GROW_RECIPES. Kept here so this file does not import the catalog. */
const FARMING_HERBS = [
  { id: 'grow_guam', name: 'Guam', level: 9 },
  { id: 'grow_marrentill', name: 'Marrentill', level: 14 },
  { id: 'grow_tarromin', name: 'Tarromin', level: 19 },
  { id: 'grow_harralander', name: 'Harralander', level: 26 },
  { id: 'grow_ranarr', name: 'Ranarr', level: 32 },
  { id: 'grow_lantadyme', name: 'Lantadyme', level: 73 },
  { id: 'grow_dwarf_weed', name: 'Dwarf weed', level: 79 },
];

const unlocks = [];

export function applyRecipeLevels(recipes) {
  unlocks.length = 0;
  for (const recipe of Object.values(recipes)) {
    const entry = LEVELS[recipe.id];
    if (!entry) continue;
    const [skill, level, xp] = entry;
    recipe.skill = skill;
    recipe.xp = xp;
    recipe.requires = { skill, level };
    unlocks.push({
      id: recipe.id,
      name: recipe.name,
      skill,
      level,
      kind: 'recipe',
    });
  }
  for (const node of GATHER_NODES) {
    unlocks.push({
      id: node.id,
      name: node.name,
      skill: node.skill,
      level: node.level,
      kind: 'gather',
    });
  }
  for (const herb of FARMING_HERBS) {
    unlocks.push({
      id: herb.id,
      name: herb.name,
      skill: 'farming',
      level: herb.level,
      kind: 'gather',
    });
  }
  for (const row of CONSTRUCTION_UNLOCKS) {
    unlocks.push({
      id: row.id,
      name: row.name,
      skill: 'construction',
      level: row.level,
      kind: 'item',
    });
  }
}

/** Unique unlock levels per skill, after melee metals share one level. Includes gather nodes. */
export function unlockLevelsBySkill() {
  const bySkill = {};
  for (const [skill, level] of Object.values(LEVELS)) {
    (bySkill[skill] ??= new Set()).add(level);
  }
  for (const node of GATHER_NODES) {
    (bySkill[node.skill] ??= new Set()).add(node.level);
  }
  for (const herb of FARMING_HERBS) {
    (bySkill.farming ??= new Set()).add(herb.level);
  }
  for (const row of CONSTRUCTION_UNLOCKS) {
    (bySkill.construction ??= new Set()).add(row.level);
  }
  return Object.fromEntries(
    Object.entries(bySkill).map(([skill, levels]) => [skill, [...levels].sort((a, b) => a - b)]),
  );
}

function visible(row, isHidden) {
  return !(row.kind === 'recipe' && isHidden(row.id));
}

/** Names unlocked from `fromLevel` (exclusive) through `toLevel` (inclusive). */
/** Unlock rows ({ id, name, kind, level }) gained going from fromLevel to toLevel. */
export function unlocksBetween(skillId, fromLevel, toLevel, isHidden = () => false) {
  return unlocks.filter((row) => (
    row.skill === skillId
    && row.level > fromLevel
    && row.level <= toLevel
    && visible(row, isHidden)
  ));
}

export function unlockNamesBetween(skillId, fromLevel, toLevel, isHidden = () => false) {
  return unlocksBetween(skillId, fromLevel, toLevel, isHidden).map((row) => row.name);
}

/** "Next unlock: Iron rock (Lv 5)". Empty at 99 or when nothing is left. */
export function nextUnlockLabel(skillId, level, isHidden = () => false) {
  const upcoming = unlocks.filter((row) => (
    row.skill === skillId && row.level > level && visible(row, isHidden)
  ));
  if (!upcoming.length) return '';
  const next = Math.min(...upcoming.map((row) => row.level));
  const names = upcoming.filter((row) => row.level === next).map((row) => row.name);
  const shown = names.slice(0, 3).join(', ');
  const extra = names.length > 3 ? ` +${names.length - 3}` : '';
  return `Next unlock: ${shown} (Lv ${next})${extra}`;
}
