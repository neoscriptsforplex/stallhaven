/**
 * Stallhaven skills: data and logic only (no DOM).
 *
 * Ten skills on the OSRS XP curve, levels 1 to 99. Everyone starts at level 1 (0 XP).
 * A skills tracker is a small object that lives at `state.skills`:
 *
 *   const skills = createSkills();
 *   skills.onLevelUp(({ name, level }) => pushLog(state, `Your ${name} level is now ${level}.`));
 *   skills.addXp('woodcutting', 25);
 *   skills.getLevel('woodcutting'); // 1
 *   const saved = skills.toJSON();  // { xp: { woodcutting: 25, ... } }
 *   skills.fromJSON(saved);         // same object, so listeners stay attached
 */

export const MAX_LEVEL = 99;
/** OSRS caps XP at 200m. Past level 99 XP still counts toward this cap. */
export const MAX_XP = 200_000_000;

/** Order here is the panel order (left to right, top to bottom). */
export const SKILLS = [
  { id: 'farming', name: 'Farming', trainedBy: 'Picking flax. More crops later.' },
  { id: 'fletching', name: 'Fletching', trainedBy: 'Crafting at the fletching bench.' },
  { id: 'herblore', name: 'Herblore', trainedBy: 'Brewing potions in the cauldron.' },
  { id: 'woodcutting', name: 'Woodcutting', trainedBy: 'Chopping trees.' },
  { id: 'smithing', name: 'Smithing', trainedBy: 'Smelting at the furnace and working the anvil.' },
  { id: 'mining', name: 'Mining', trainedBy: 'Mining rocks in the dungeon.' },
  { id: 'cooking', name: 'Cooking', trainedBy: 'Cooking on the range.' },
  { id: 'crafting', name: 'Crafting', trainedBy: "Spinning wheel, potter's wheel and loom." },
  { id: 'construction', name: 'Construction', trainedBy: 'Opening new rooms. A sawmill later.' },
  { id: 'runecrafting', name: 'Runecrafting', trainedBy: 'Crafting runes.' },
];

export const SKILL_IDS = SKILLS.map((skill) => skill.id);
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));

export function isSkillId(id) {
  return Object.prototype.hasOwnProperty.call(SKILL_BY_ID, id);
}

export function skillInfo(id) {
  return SKILL_BY_ID[id] ?? null;
}

/* ---------- XP curve (OSRS) ---------- */

/**
 * XP_TABLE[level] is the total XP needed to reach `level`.
 * XP_TABLE[1] = 0, XP_TABLE[2] = 83, XP_TABLE[99] = 13,034,431.
 */
export const XP_TABLE = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * 2 ** (level / 7));
    table.push(Math.floor(points / 4));
  }
  return Object.freeze(table);
})();

/** Total XP needed to reach `level` (1 to 99). */
export function xpForLevel(level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return XP_TABLE[lv];
}

/** Level for a total XP amount (1 to 99). */
export function levelForXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (XP_TABLE[mid] <= total) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Everything the panel needs for one skill.
 * At 99, `next` is null, `toNext` is 0 and `t` is 1.
 */
export function progressForXp(xp) {
  const total = clampXp(xp);
  const level = levelForXp(total);
  const start = XP_TABLE[level];
  const next = level >= MAX_LEVEL ? null : XP_TABLE[level + 1];
  return {
    level,
    xp: total,
    levelStartXp: start,
    nextLevelXp: next,
    toNext: next == null ? 0 : next - total,
    t: next == null ? 1 : (total - start) / (next - start),
  };
}

function clampXp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Whole XP only, like the shop XP. Round down so saves never gain XP.
  return Math.min(MAX_XP, Math.floor(n));
}

/* ---------- Which skill a craft trains ---------- */

/**
 * Station id (from catalog.stationForRecipe) to skill id.
 * Runes are crafted at the anvil today, so `skillForRecipe` checks them first.
 */
export const STATION_SKILL = Object.freeze({
  anvil: 'smithing',
  furnace: 'smithing',
  range: 'cooking',
  cauldron: 'herblore',
  fletch: 'fletching',
  wheel: 'crafting',
  potter: 'crafting',
  loom: 'crafting',
});

/**
 * Skill trained by finishing one craft action of `recipe`.
 * Pass the station from `stationForRecipe(recipe)` so this file needs no catalog import.
 */
export function skillForRecipe(recipe, station) {
  if (!recipe) return null;
  if (recipe.category === 'rune') return 'runecrafting';
  return STATION_SKILL[station] ?? null;
}

/**
 * Suggested XP per finished craft action. Mirrors economy.craftXp (6 + tier × 10),
 * so a tier-1 craft gives 16 XP and a tier-7 (Dragon) craft gives 76 XP.
 * Tune the numbers in XP_RATES rather than here.
 */
export const XP_RATES = Object.freeze({
  craftBase: 6,
  craftPerTier: 10,
  /** One completed chop bar (5 logs). */
  chop: 25,
  /** One completed flax pick (1 flax). */
  pickFlax: 10,
  /** One completed mining bar, by rock. */
  mine: Object.freeze({
    hard_clay: 5,
    essence: 5,
    bronze: 18,
    iron: 35,
    steel: 50,
    mithril: 80,
    adamant: 95,
    runite: 125,
    dragon: 150,
  }),
});

export function xpForCraft(recipe) {
  const tier = Math.max(1, Math.round(Number(recipe?.tier) || 1));
  return XP_RATES.craftBase + tier * XP_RATES.craftPerTier;
}

export function xpForMine(materialId) {
  return XP_RATES.mine[materialId] ?? 0;
}

/**
 * Construction XP for one paid build-menu placement (room, station, or build-menu item
 * such as today's table/mannequin/shelf and future planters/extra shelves):
 *   XP = BUILD_BASE[kind] + round(BUILD_GP_FACTOR * sqrt(gp)) + sum(planks[type] * PLANK_XP[type])
 * A new build-menu item only declares its kind, gp and planks. Give 0 for moves/re-placements.
 * Placements are one-off, so the repeatable Construction action is sawing planks (xpForSaw).
 */
export const BUILD_BASE = Object.freeze({ item: 25, station: 100, room: 500 });
export const BUILD_GP_FACTOR = 2;
/** Each plank gives this XP when sawn at the sawmill, and the same again when used in a build. */
export const PLANK_XP = Object.freeze({
  plank: 4, oak_plank: 8, willow_plank: 20, teak_plank: 28, maple_plank: 52,
  mahogany_plank: 73, yew_plank: 130, magic_plank: 320, redwood_plank: 935,
});
/** Construction level needed to saw each plank (future sawmill). */
export const PLANK_LEVEL = Object.freeze({
  plank: 1, oak_plank: 15, willow_plank: 30, teak_plank: 35, maple_plank: 45,
  mahogany_plank: 50, yew_plank: 60, magic_plank: 75, redwood_plank: 90,
});

export function xpForBuild({ kind = 'item', gp = 0, planks = null, xp = null } = {}) {
  if (Number.isFinite(xp)) return Math.max(0, Math.floor(xp)); // per-item override
  const base = BUILD_BASE[kind] ?? BUILD_BASE.item;
  const gpPart = Math.round(BUILD_GP_FACTOR * Math.sqrt(Math.max(0, Number(gp) || 0)));
  let plankPart = 0;
  for (const [type, n] of Object.entries(planks ?? {})) {
    plankPart += (PLANK_XP[type] ?? 0) * Math.max(0, Math.floor(Number(n) || 0));
  }
  return base + gpPart + plankPart;
}

/** Construction XP for sawing `count` planks of one type at the sawmill (the repeatable action). */
export function xpForSaw(plankType, count = 1) {
  return (PLANK_XP[plankType] ?? 0) * Math.max(0, Math.floor(Number(count) || 0));
}

/** Room XP from the real expansion cost: 500,000 gp x 3^roomsBefore (layout.expansionCost). */
export function xpForExpansion(roomsBefore = 0, firstCost = 500000, mult = 3) {
  const gp = firstCost * mult ** Math.max(0, Math.floor(roomsBefore));
  return xpForBuild({ kind: 'room', gp });
}

/* ---------- The tracker ---------- */

function emptyXp() {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, 0]));
}

/**
 * Create a skills tracker. `saved` is optional and uses the toJSON() shape.
 * Returns an object; keep one per game state.
 */
export function createSkills(saved = null) {
  let xp = emptyXp();
  const levelUpListeners = new Set();
  const changeListeners = new Set();

  function emit(listeners, payload) {
    for (const fn of [...listeners]) {
      try {
        fn(payload);
      } catch (err) {
        // One bad listener must not stop XP from being granted.
        console.error('[skills] listener failed', err);
      }
    }
  }

  const api = {
    /**
     * Add XP to a skill. Returns the XP actually added (0 for an unknown skill,
     * a bad amount, or a skill at the 200m cap). Fires level-up listeners once
     * per gain, with `from`/`to` levels (a big gain can jump several levels).
     */
    addXp(skillId, amount) {
      if (!isSkillId(skillId)) return 0;
      const gain = clampXp(amount);
      if (gain <= 0) return 0;
      const before = xp[skillId];
      const after = Math.min(MAX_XP, before + gain);
      const added = after - before;
      if (added <= 0) return 0;
      xp[skillId] = after;
      const fromLevel = levelForXp(before);
      const toLevel = levelForXp(after);
      emit(changeListeners, { skillId, xp: after, added });
      if (toLevel > fromLevel) {
        emit(levelUpListeners, {
          skillId,
          name: SKILL_BY_ID[skillId].name,
          from: fromLevel,
          level: toLevel,
          levelsGained: toLevel - fromLevel,
          totalLevel: api.getTotalLevel(),
        });
      }
      return added;
    },

    getXp(skillId) {
      return isSkillId(skillId) ? xp[skillId] : 0;
    },

    /** Base level from XP, 1 to 99. */
    getLevel(skillId) {
      return levelForXp(api.getXp(skillId));
    },

    getProgress(skillId) {
      return progressForXp(api.getXp(skillId));
    },

    /** Sum of every base level. 10 at the start, 990 when everything is 99. */
    getTotalLevel() {
      return SKILL_IDS.reduce((sum, id) => sum + levelForXp(xp[id]), 0);
    },

    getTotalXp() {
      return SKILL_IDS.reduce((sum, id) => sum + xp[id], 0);
    },

    /** Panel rows in display order. */
    list() {
      return SKILLS.map((skill) => ({ ...skill, ...progressForXp(xp[skill.id]) }));
    },

    /** Called as fn({ skillId, name, from, level, levelsGained, totalLevel }). Returns an unsubscribe. */
    onLevelUp(fn) {
      levelUpListeners.add(fn);
      return () => levelUpListeners.delete(fn);
    },

    /** Called on every XP gain as fn({ skillId, xp, added }). Use it to repaint the panel. */
    onChange(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },

    /** Save shape. Only XP is stored; levels are worked out from it. */
    toJSON() {
      return { xp: { ...xp } };
    },

    /**
     * Load from a save. Missing, unknown or broken values fall back to 0 XP,
     * so old saves without skills load fine. Listeners stay attached.
     * Does not fire level-up events.
     */
    fromJSON(data) {
      const next = emptyXp();
      const source = data && typeof data === 'object' ? (data.xp ?? data) : null;
      if (source && typeof source === 'object') {
        for (const id of SKILL_IDS) next[id] = clampXp(source[id]);
      }
      xp = next;
      emit(changeListeners, { skillId: null, xp: null, added: 0 });
      return api;
    },

    reset() {
      return api.fromJSON(null);
    },
  };

  if (saved) api.fromJSON(saved);
  return api;
}

/**
 * Optional, for old saves: rebuild skill XP from craft history so a player
 * who has crafted for hours does not start at level 1.
 * `craftCounts` is state.craftCounts, `recipes` is catalog.RECIPES and
 * `stationFor` is catalog.stationForRecipe. Gathering and rooms are not
 * tracked in old saves, so only crafting skills are rebuilt.
 */
export function xpFromCraftHistory(craftCounts, recipes, stationFor) {
  const out = emptyXp();
  for (const [recipeId, count] of Object.entries(craftCounts ?? {})) {
    const recipe = recipes?.[recipeId];
    if (!recipe) continue;
    const skillId = skillForRecipe(recipe, stationFor?.(recipe));
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!skillId || !n) continue;
    out[skillId] = Math.min(MAX_XP, out[skillId] + n * xpForCraft(recipe));
  }
  return { xp: out };
}
