import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from './catalog.js';
import { craftedOutputCount, createState, grantMinedMaterial } from './economy.js';
import { ICONS, defaultTab, nextUnlockLevel, skillGuideShellHtml, sortedRows } from './skillGuide.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import { unlockLevelsBySkill } from './skillLevels.js';
import { ESSENCE_BONUS_LEVELS, ESSENCE_DOUBLE_LEVEL, SKILLS, xpForLevel } from './skills.js';

const root = dirname(fileURLToPath(import.meta.url));

function reachLevel(state, skillId, level) {
  const need = xpForLevel(level);
  const have = state.skills.getXp(skillId);
  if (have < need) state.skills.addXp(skillId, need - have);
}

describe('skill guide', () => {
  it('lists every live unlock, and only live unlocks, outside perks and coming soon', () => {
    const live = unlockLevelsBySkill();
    assert.deepEqual(Object.keys(SKILL_GUIDES).sort(), SKILLS.map((skill) => skill.id).sort());
    for (const skill of SKILLS) {
      const guide = SKILL_GUIDES[skill.id];
      const rows = guide.tabs.flatMap((tab) => tab.rows);
      const covered = new Set(rows.filter((row) => !row.soon).map((row) => row.lv));
      for (const level of live[skill.id] ?? []) {
        assert.ok(covered.has(level), `${skill.id} has no guide row at level ${level}`);
      }
      for (const row of rows) {
        assert.ok(ICONS[row.icon], `${skill.id} row ${row.name} uses an unknown icon ${row.icon}`);
        if (row.soon || row.perk) continue;
        assert.ok(
          (live[skill.id] ?? []).includes(row.lv),
          `${skill.id} row "${row.name}" is level ${row.lv}, which nothing unlocks`,
        );
      }
    }
  });

  it('marks double essence and double runes at the live thresholds', () => {
    const mining = SKILL_GUIDES.mining.tabs[0].rows.filter((row) => row.perk);
    assert.deepEqual(mining.map((row) => row.lv), [...ESSENCE_BONUS_LEVELS]);
    assert.ok(mining.every((row) => row.soon === undefined));
    const runes = ['air_rune', 'water_rune', 'earth_rune', 'fire_rune'];
    const perks = SKILL_GUIDES.runecrafting.tabs[0].rows.filter((row) => row.perk);
    assert.deepEqual(
      perks.map((row) => row.lv),
      runes.map((id) => RECIPES[id].requires.level * 2),
    );
    const state = createState();
    state.materials.essence = 0;
    assert.equal(grantMinedMaterial(state, 'essence'), 1);
    reachLevel(state, 'mining', ESSENCE_DOUBLE_LEVEL);
    assert.equal(grantMinedMaterial(state, 'essence'), 3);
    assert.equal(craftedOutputCount(state, RECIPES.air_rune), 1);
    reachLevel(state, 'runecrafting', RECIPES.air_rune.requires.level * 2);
    assert.equal(craftedOutputCount(state, RECIPES.air_rune), 2);
    assert.equal(craftedOutputCount(state, RECIPES.water_rune), 1);
  });

  it('opens on the next real unlock and skips coming soon', () => {
    const woodcutting = SKILL_GUIDES.woodcutting;
    assert.equal(nextUnlockLevel(woodcutting, 1), 15);
    assert.equal(nextUnlockLevel(woodcutting, 75), null);
    const smithing = SKILL_GUIDES.smithing;
    assert.equal(nextUnlockLevel(smithing, 1), 2);
    assert.equal(defaultTab(smithing, 1), 'bars');
    const herbs = SKILL_GUIDES.farming.tabs.find((tab) => tab.id === 'herbs');
    const realHerbs = new Set(['Guam', 'Marrentill', 'Tarromin', 'Harralander', 'Ranarr', 'Lantadyme', 'Dwarf weed']);
    assert.ok(herbs.rows.filter((row) => realHerbs.has(row.name)).every((row) => !row.soon));
    assert.ok(herbs.rows.filter((row) => !realHerbs.has(row.name)).every((row) => row.soon));
    const ordered = sortedRows({
      rows: [{ lv: 5, perk: true, name: 'perk' }, { lv: 5, name: 'item' }, { lv: 1, name: 'first' }],
    });
    assert.deepEqual(ordered.map((row) => row.name), ['first', 'item', 'perk']);
  });

  it('is a phone sheet with a Skills back button, and a click opens it from the panel', () => {
    const shell = skillGuideShellHtml();
    assert.match(shell, /‹ Skills/);
    assert.match(shell, /role="dialog"/);
    assert.match(shell, /data-guide-tabs/);
    const hud = readFileSync(join(root, 'hud.js'), 'utf8');
    const panel = readFileSync(join(root, 'skillsPanel.js'), 'utf8');
    const css = readFileSync(join(root, '../style.css'), 'utf8');
    assert.match(hud, /onSkillClick: \(id\) => skillGuide\?\.open\(id\)/);
    assert.match(hud, /skillGuide\?\.close\(\);\s*skillsPanel\?\.close\(\)/);
    assert.match(panel, /onSkillClick/);
    assert.match(panel, /Tap a skill to open its guide\./);
    assert.match(css, /\.skill-guide\.is-sheet|\.skill-guide \{/);
    const phone = css.slice(css.indexOf('Phone portrait: full-height bottom sheet'));
    assert.match(phone, /\.guide-back[\s\S]*min-height:\s*44px/);
    assert.match(phone, /\.guide-tab[\s\S]*min-height:\s*44px/);
    assert.match(phone, /\.guide-row[\s\S]*min-height:\s*56px/);
    assert.match(css, /\.guide-open \.skill-toast[\s\S]*z-index:\s*44/);
  });
});
