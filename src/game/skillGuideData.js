/**
 * Skill guide content: ONE config for every skill.
 *
 * Metal weapon and armour rows, mining rocks, and trees take their levels from
 * the live tables. Smithing bars, hatchets, pickaxes, and nails stay on the
 * stepped levels the anvil still uses. Perk rows match the live bonuses:
 * double essence, and double runes at twice that rune's level.
 *
 * Each skill has `tabs`. A tab with one entry renders without a tab bar.
 * Row fields:
 *   lv      level needed (1–99)
 *   name    what unlocks
 *   desc    short line under the name (optional)
 *   icon    glyph id from skillGuide.js ICONS (bar, ore, log, rune, sword, helm, ...)
 *   tint    icon colour (tier colour); defaults to gold
 *   perk    true = a perk row (special style, star badge)
 *   soon    true = not in the game yet ("Coming soon" badge, always shown locked)
 *
 * To add an unlock: add one row. Rows are sorted by level when rendered, so order here doesn't matter.
 * Levels here follow Luke's 18 Oct 2026 list where given, otherwise skillLevels.js / GATHER_NODES (live),
 * otherwise PROGRESSION.md (marked soon).
 */

import { RECIPES } from './catalog.js';
import { MELEE_SMITH_LEVELS, RUNE_DOUBLE_LEVEL_MULT } from './skillLevels.js';
import { CONSTRUCTION_GUIDE } from './construction.js';
import { DOUBLE_PICK_LEVELS, ESSENCE_BONUS_LEVELS, FISHING_LEVELS, MINING_LEVELS, WOODCUTTING_LEVELS } from './skills.js';

export const TIER = {
  bronze: '#c07a3e',
  iron: '#9a9fa6',
  steel: '#c9d0d8',
  mithril: '#5b6fd6',
  adamant: '#3f9a5c',
  rune: '#4fc3d9',
  dragon: '#d8433a',
  clay: '#c9a27a',
  essence: '#e8e6f2',
  gold: '#e3b34a',
};

/** Melee smithing bands. Tools and bars do not use this table. */
const METALS = [
  ['bronze', 'Bronze'],
  ['iron', 'Iron'],
  ['steel', 'Steel'],
  ['mithril', 'Mithril'],
  ['adamant', 'Adamant'],
  ['rune', 'Rune'],
  ['dragon', 'Dragon'],
].map(([id, name], index) => [id, name, MELEE_SMITH_LEVELS[index]]);

const WEAPONS = 'Dagger, sword, scimitar, mace, spear, 2H sword';
const ARMOUR = 'Med helm, full helm, chainbody, platebody, platelegs, plateskirt, kiteshield, boots';

const smithing = {
  tabs: [
    {
      id: 'weapons', label: 'Weapons',
      rows: METALS.map(([id, name, lv]) => ({ lv, name: `${name} weapons`, desc: WEAPONS, icon: 'sword', tint: TIER[id] })),
    },
    {
      id: 'armour', label: 'Armour',
      rows: METALS.map(([id, name, lv]) => ({
        lv, name: `${name} armour`,
        desc: id === 'dragon' ? ARMOUR.replace('full helm, ', '') + ' (no full helm)' : ARMOUR,
        icon: 'helm', tint: TIER[id],
      })),
    },
    {
      id: 'bars', label: 'Bars & tools',
      rows: [
        { lv: 1, name: 'Bronze bar & nails', desc: 'Smelt the bar, then smith nails. Unpowered orbs too', icon: 'bar', tint: TIER.bronze },
        { lv: 2, name: 'Bronze hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.bronze },
        { lv: 7, name: 'Bronze pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.bronze },
        { lv: 15, name: 'Iron bar & nails', desc: 'Smelt at the furnace, nails at the anvil', icon: 'bar', tint: TIER.iron },
        { lv: 16, name: 'Iron hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.iron },
        { lv: 21, name: 'Iron pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.iron },
        { lv: 30, name: 'Steel bar & nails', desc: 'Smelt at the furnace, nails at the anvil', icon: 'bar', tint: TIER.steel },
        { lv: 31, name: 'Steel hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.steel },
        { lv: 36, name: 'Steel pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.steel },
        { lv: 50, name: 'Mithril bar & nails', desc: 'Smelt at the furnace, nails at the anvil', icon: 'bar', tint: TIER.mithril },
        { lv: 51, name: 'Mithril hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.mithril },
        { lv: 56, name: 'Mithril pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.mithril },
        { lv: 70, name: 'Adamant bar & nails', desc: 'Smelt at the furnace, nails at the anvil', icon: 'bar', tint: TIER.adamant },
        { lv: 71, name: 'Adamant hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.adamant },
        { lv: 76, name: 'Adamant pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.adamant },
        { lv: 85, name: 'Rune bar & nails', desc: 'Smelt at the furnace, nails at the anvil', icon: 'bar', tint: TIER.rune },
        { lv: 86, name: 'Rune hatchet', desc: 'Anvil', icon: 'pick', tint: TIER.rune },
        { lv: 90, name: 'Dragon bar, nails & hatchet', desc: 'The rune pickaxe unlocks here too', icon: 'pick', tint: TIER.dragon },
        { lv: 93, name: 'Dragon pickaxe', desc: 'Anvil', icon: 'pick', tint: TIER.dragon },
        { lv: 99, name: 'Dwarven multicannon', desc: 'The end-game anvil build', icon: 'cannon', tint: TIER.steel },
      ],
    },
  ],
};

const mining = {
  tabs: [{
    id: 'ores', label: 'Ores',
    rows: [
      { lv: MINING_LEVELS.hard_clay, name: 'Clay rock', desc: 'Hard clay. Soften it on the potter wheel', icon: 'ore', tint: TIER.clay },
      { lv: MINING_LEVELS.essence, name: 'Essence rock', desc: 'Rune essence for the altars', icon: 'ore', tint: TIER.essence },
      ...METALS.map(([id, name]) => ({
        lv: MINING_LEVELS[id === 'rune' ? 'runite' : id],
        name: `${id === 'adamant' ? 'Adamantite' : id === 'rune' ? 'Runite' : name} rock`,
        desc: `${name} ore in the dungeon`,
        icon: 'ore', tint: TIER[id],
      })),
      ...ESSENCE_BONUS_LEVELS.map((lv, i) => ({ lv, perk: true, name: `${i + 2} essence per bar`, desc: `Every filled essence bar gives ${i + 2}`, icon: 'star', tint: TIER.essence })),
    ],
  }],
};

const woodcutting = {
  tabs: [{
    id: 'trees', label: 'Trees',
    rows: [
      { lv: WOODCUTTING_LEVELS.logs, name: 'Logs', desc: 'Chop normal (pine) trees', icon: 'log', tint: '#a0703f' },
      { lv: WOODCUTTING_LEVELS.oak, name: 'Oak logs', desc: 'Chop oak trees', icon: 'log', tint: '#b8874a' },
      { lv: WOODCUTTING_LEVELS.willow, name: 'Willow logs', desc: 'Chop willow trees', icon: 'log', tint: '#9aa65a' },
      { lv: WOODCUTTING_LEVELS.teak, name: 'Teak logs', desc: 'Chop teak trees', icon: 'log', tint: '#8a5a32', soon: true },
      { lv: WOODCUTTING_LEVELS.maple, name: 'Maple logs', desc: 'Chop maple trees', icon: 'log', tint: '#c0572e' },
      { lv: WOODCUTTING_LEVELS.mahogany, name: 'Mahogany logs', desc: 'Chop mahogany trees', icon: 'log', tint: '#7a2e22', soon: true },
      { lv: WOODCUTTING_LEVELS.yew, name: 'Yew logs', desc: 'Chop yew trees', icon: 'log', tint: '#6e7a3a' },
      { lv: WOODCUTTING_LEVELS.magic, name: 'Magic logs', desc: 'Chop magic trees', icon: 'log', tint: '#5fb7d8' },
    ],
  }],
};

/** Pond fishing spots. Levels come from the live FISHING_LEVELS table. */
const fishing = {
  tabs: [{
    id: 'pond', label: 'Pond',
    rows: [
      ['raw_shrimp', 'Raw shrimp', '#e8a060'],
      ['raw_salmon', 'Raw salmon', '#d98a72'],
      ['raw_lobster', 'Raw lobster', '#3d5a6e'],
      ['raw_monkfish', 'Raw monkfish', '#8c7a62'],
      ['raw_shark', 'Raw shark', '#7d8c98'],
      ['raw_anglerfish', 'Raw anglerfish', '#6e4038'],
    ].map(([id, name, tint]) => ({ lv: FISHING_LEVELS[id], name, desc: 'Fish at the pond', icon: 'food', tint })),
  }],
};

/** Altar order and colours. Levels come from the live rune recipes. */
const RUNES = [
  ['air_rune', 'Air', '#dfe8ee'],
  ['water_rune', 'Water', '#4c8de0'],
  ['earth_rune', 'Earth', '#8a6a3a'],
  ['fire_rune', 'Fire', '#e2582c'],
];
const runecrafting = {
  tabs: [{
    id: 'runes', label: 'Runes',
    rows: [
      ...RUNES.map(([id, name, tint]) => ({
        lv: RECIPES[id].requires.level,
        name: `${name} rune`,
        desc: `Craft at the ${name.toLowerCase()} altar`,
        icon: 'rune',
        tint,
      })),
      ...RUNES.map(([id, name, tint]) => ({
        lv: RECIPES[id].requires.level * RUNE_DOUBLE_LEVEL_MULT,
        perk: true,
        name: `Double ${name.toLowerCase()} runes`,
        desc: `The altar gives 2 ${name.toLowerCase()} runes`,
        icon: 'star',
        tint,
      })),
    ],
    footer: 'More runes and altars are coming soon.',
  }],
};

const HERBS = [
  [9, 'Guam'], [14, 'Marrentill'], [19, 'Tarromin'], [26, 'Harralander'], [32, 'Ranarr'],
  [38, 'Toadflax'], [44, 'Irit'], [50, 'Avantoe'], [56, 'Kwuarm'], [62, 'Snapdragon'],
  [67, 'Cadantine'], [73, 'Lantadyme'], [79, 'Dwarf weed'], [85, 'Torstol'],
];
const farming = {
  tabs: [
    {
      id: 'crops', label: 'Crops',
      rows: [
        { lv: 1, name: 'Flax', desc: 'Pick flax in the field', icon: 'sheaf', tint: '#8fb0d8' },
        { lv: 5, name: 'Wheat', desc: 'Pick wheat; mill it into flour', icon: 'sheaf', tint: '#e0c060' },
        { lv: DOUBLE_PICK_LEVELS.flax, perk: true, name: 'Double flax', desc: 'Every flax pick gives 2', icon: 'star', tint: '#8fb0d8' },
        { lv: DOUBLE_PICK_LEVELS.wheat, perk: true, name: 'Double wheat', desc: 'Every wheat pick gives 2', icon: 'star', tint: '#e0c060' },
      ],
    },
    {
      id: 'herbs', label: 'Herbs',
      rows: HERBS.map(([lv, name]) => {
        const real = ['Guam', 'Marrentill', 'Tarromin', 'Harralander', 'Ranarr', 'Lantadyme', 'Dwarf weed'].includes(name);
        return { lv, name, desc: 'Herb patch · feeds Herblore', icon: 'leaf', tint: '#6fbf5a', ...(real ? {} : { soon: true }) };
      }),
    },
  ],
};

const fletchMetal = (piece, levels, icon) => METALS.map(([id, name], i) => ({
  lv: levels[i], name: `${name} ${piece}`, icon, tint: TIER[id],
}));
const fletching = {
  tabs: [
    {
      id: 'bows', label: 'Bows',
      rows: [
        ['Shortbow', 5], ['Longbow', 10], ['Oak shortbow', 20], ['Oak longbow', 25],
        ['Willow shortbow', 35], ['Willow longbow', 40], ['Maple shortbow', 50], ['Maple longbow', 55],
        ['Yew shortbow', 65], ['Yew longbow', 70], ['Magic shortbow', 80], ['Magic longbow', 85],
      ].map(([name, lv]) => ({ lv, name, icon: 'bow', tint: '#b8874a' })),
    },
    {
      id: 'ammo', label: 'Ammo',
      rows: [
        ...fletchMetal('arrows (x20)', [1, 15, 30, 45, 60, 75, 90], 'arrow'),
        { lv: 35, name: 'Cannonballs (x20)', desc: 'Steel bar', icon: 'ball', tint: TIER.steel },
      ],
    },
    {
      id: 'other', label: 'Crossbows & axes',
      rows: [
        ...fletchMetal('crossbow', [9, 24, 39, 54, 61, 69, 78], 'crossbow'),
        ...fletchMetal('thrown axe', [3, 22, 37, 52, 67, 81, 95], 'axe'),
      ],
    },
  ],
};

const herblore = {
  tabs: [{
    id: 'potions', label: 'Potions',
    rows: [
      [1, 'Attack potion', '#40c8c0'], [10, 'Strength potion', '#e8d24a'], [20, 'Antipoison', '#8ee53f'],
      [30, 'Energy potion', '#e87aa8'], [40, 'Prayer potion', '#3ec8c4'], [55, 'Antifire potion', '#8a4ec8'],
      [65, 'Ranging potion', '#87ceeb'], [75, 'Magic potion', '#f4c49a'],
    ].map(([lv, name, tint]) => ({ lv, name, desc: 'Brew in the cauldron', icon: 'potion', tint }))
      .concat([
        [45, 'Super attack'], [50, 'Super strength'], [60, 'Super defence'], [70, 'Stamina potion'],
        [80, 'Super restore'], [85, 'Saradomin brew'], [88, 'Extended antifire'], [92, 'Super combat'], [96, 'Divine super combat'],
      ].map(([lv, name]) => ({ lv, name, icon: 'potion', tint: '#b9a6e0', soon: true }))),
  }],
};

const cooking = {
  tabs: [{
    id: 'food', label: 'Food',
    rows: [
      [1, 'Pot of flour', 'Mill wheat'], [1, 'Bread'], [1, 'Shrimp'], [25, 'Salmon'], [20, 'Pizza'], [30, 'Pie'], [35, 'Cake'],
      [40, 'Lobster'], [47, 'Fish pie'], [50, 'Chocolate cake'], [60, 'Curry'], [62, 'Monkfish'],
      [80, 'Shark'], [84, 'Anglerfish'], [95, 'Summer pie'],
    ].map(([lv, name, desc]) => ({ lv, name, desc: desc ?? 'Cook on the range', icon: 'food', tint: '#e0a050' }))
      .concat([
        [5, 'Cooked chicken'], [15, 'Trout'], [25, 'Stew'], [30, 'Tuna'], [45, 'Swordfish'], [55, 'Meat pizza'],
        [70, 'Tuna potato'], [75, 'Sea turtle'], [90, 'Dark crab'], [91, 'Manta ray'],
      ].map(([lv, name]) => ({ lv, name, icon: 'food', tint: '#c9a27a', soon: true }))),
  }],
};

const set = (lv, name, desc, icon, tint) => ({ lv, name, desc, icon, tint });
const crafting = {
  tabs: [
    {
      id: 'robes', label: 'Robes',
      rows: [
        set(3, 'Wizard boots', 'Loom', 'cloth', '#4a62c8'), set(5, 'Wizard hat', 'Loom', 'cloth', '#4a62c8'),
        set(8, 'Wizard robe', 'Loom', 'cloth', '#4a62c8'),
        set(20, 'Mystic gloves & boots', 'Loom', 'cloth', '#3d5bd9'), set(22, 'Mystic hat', 'Loom', 'cloth', '#3d5bd9'),
        set(24, 'Mystic robe bottom', 'Loom', 'cloth', '#3d5bd9'), set(26, 'Mystic robe top', 'Loom', 'cloth', '#3d5bd9'),
        set(38, 'Splitbark gauntlets & boots', 'Loom', 'cloth', '#8a6a3a'), set(40, 'Splitbark hat', 'Loom', 'cloth', '#8a6a3a'),
        set(42, 'Splitbark robe bottom', 'Loom', 'cloth', '#8a6a3a'), set(44, 'Splitbark robe top', 'Loom', 'cloth', '#8a6a3a'),
        set(56, 'Battlemage gloves & boots', 'Loom', 'cloth', '#6a3d8a'), set(58, 'Battlemage hat', 'Loom', 'cloth', '#6a3d8a'),
        set(60, 'Battlemage robe bottom', 'Loom', 'cloth', '#6a3d8a'), set(62, 'Battlemage robe top', 'Loom', 'cloth', '#6a3d8a'),
        set(70, 'Lunar gloves & boots', 'Loom', 'cloth', '#7fa8c8'), set(72, 'Lunar hat', 'Loom', 'cloth', '#7fa8c8'),
        set(74, 'Lunar robe bottom', 'Loom', 'cloth', '#7fa8c8'), set(76, 'Lunar robe top', 'Loom', 'cloth', '#7fa8c8'),
        set(86, 'Ancient gloves & boots', 'Loom', 'cloth', '#c9a24e'), set(87, 'Ancient hat', 'Loom', 'cloth', '#c9a24e'),
        set(88, 'Ancient robe bottom', 'Loom', 'cloth', '#c9a24e'), set(89, 'Ancient robe top', 'Loom', 'cloth', '#c9a24e'),
      ],
    },
    {
      id: 'leather', label: "D'hide",
      rows: [
        ['Green', 28, '#3f9a5c'], ['Blue', 46, '#4c6fe0'], ['Red', 64, '#c8402e'], ['Black', 78, '#3a3a40'],
      ].flatMap(([c, lv, tint]) => [
        set(lv, `${c} d'hide vambraces & boots`, 'Loom', 'vest', tint),
        set(lv + 2, `${c} dragon mask`, 'Loom', 'helm', tint),
        set(lv + (c === 'Red' ? 3 : c === 'Black' ? 3 : 4), `${c} d'hide chaps`, 'Loom', 'vest', tint),
        set(lv + (c === 'Red' ? 4 : c === 'Black' ? 4 : 6), `${c} d'hide body`, 'Loom', 'vest', tint),
      ]),
    },
    {
      id: 'staves', label: 'Staves & more',
      rows: [
        set(1, 'Cloth', 'Weave flax on the loom', 'cloth', '#d8cfb8'), set(1, 'Soft clay', '1 hard clay + 1 bucket of water', 'pot', TIER.clay),
        set(10, 'Bow string', 'Spinning wheel', 'string', '#e8dcc0'), set(12, 'Staff', 'Anvil, 50 logs', 'staff', '#a0703f'),
        set(36, 'Elemental staves', 'Air, water, earth, fire', 'staff', '#4c8de0'),
        set(54, 'Battlestaves', 'Air, water, earth, fire', 'staff', '#6a3d8a'),
        set(84, 'Mystic staves', 'Air, water, earth, fire', 'staff', '#3d5bd9'),
        set(92, 'Ancient staff', '', 'staff', '#c9a24e'),
      ],
    },
  ],
};

const construction = {
  tabs: [
    {
      id: 'planks', label: 'Planks',
      rows: [
        [1, 'Plank', '#c8a06a'], [15, 'Oak plank', '#b8874a'], [30, 'Willow plank', '#9aa65a'],
        [35, 'Teak plank', '#8a5a32', true], [45, 'Maple plank', '#c0572e'], [50, 'Mahogany plank', '#7a2e22', true],
        [60, 'Yew plank', '#6e7a3a'], [75, 'Magic plank', '#5fb7d8'],
      ].map(([lv, name, tint, soon]) => ({ lv, name, desc: 'Saw logs at the sawmill', icon: 'plank', tint, soon })),
    },
    {
      id: 'builds', label: 'Builds',
      rows: [
        { lv: 1, name: 'Rooms & stations', desc: 'XP for every paid placement', icon: 'house', tint: TIER.gold },
        ...CONSTRUCTION_GUIDE,
      ],
    },
  ],
};

export const SKILL_GUIDES = {
  farming, fletching, herblore, woodcutting, smithing, mining, fishing, cooking, crafting, construction, runecrafting,
};
