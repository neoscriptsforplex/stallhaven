import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyState, createState, serializeState } from './economy.js';
import * as HQ from './heroesQuests.js';

const root = dirname(fileURLToPath(import.meta.url));

test('hire order and prices', () => {
  const hq = HQ.emptyHeroQuestState();
  const state = { gold: 300_000 };
  assert.equal(HQ.heroClassStatus(hq, 'adventurer'), 'next');
  assert.equal(HQ.heroClassStatus(hq, 'melee'), 'locked');
  assert.equal(HQ.hireHero(state, hq, 'melee', 'buyer-guard-guard-level-21'), false);
  assert.equal(HQ.hireHero(state, hq, 'adventurer', 'buyer-guard-guard-level-21'), false, 'wrong class model');
  assert.equal(HQ.hireHero(state, hq, 'adventurer', 'buyer-adventurer-bob'), true);
  assert.equal(state.gold, 250_000);
  assert.equal(HQ.hireHero(state, hq, 'melee', 'buyer-guard-guard-level-21'), true);
  assert.equal(state.gold, 0);
  assert.equal(HQ.hireHero(state, hq, 'ranger', 'buyer-ranger-armour-salesman'), false, 'cannot afford');
});

test('quest runs on wall clock and survives a save round trip', () => {
  const hq = HQ.emptyHeroQuestState();
  hq.heroes.adventurer = { npcId: 'buyer-adventurer-bob', hiredAt: 0 };
  const t0 = 1_000_000;
  assert.ok(HQ.startQuest(hq, 'cow', 'adventurer', t0));
  assert.equal(HQ.startQuest(hq, 'imp', 'adventurer', t0), false, 'hero busy');
  assert.equal(HQ.questStatus(hq, 'cow', t0 + 30_000), 'running');
  assert.equal(Math.round(HQ.questProgress(hq, 'cow', t0 + 30_000).t * 100), 50);
  const loaded = HQ.normalizeHeroQuestState(JSON.parse(JSON.stringify({ ...hq, lastSeenAt: t0 + 10_000 })), t0 + 3 * HQ.HOUR);
  assert.deepEqual(HQ.finishedWhileAway(loaded, t0 + 3 * HQ.HOUR), ['cow']);
  const got = {};
  HQ.collectQuest(loaded, 'cow', (id, n) => { got[id] = (got[id] ?? 0) + n; }, t0 + 3 * HQ.HOUR);
  assert.deepEqual(got, { hide: 5 });
  assert.deepEqual(HQ.idleHeroes(loaded), ['adventurer']);
  assert.equal(loaded.quests.done.cow, 1);
});

test('a start time in the future (clock moved back) is capped at now', () => {
  const raw = { heroes: { adventurer: { npcId: 'buyer-adventurer-bob' } }, quests: { active: { imp: { heroId: 'adventurer', startedAt: 9e12 } } } };
  const hq = HQ.normalizeHeroQuestState(raw, 5000);
  assert.equal(hq.quests.active.imp.endsAt, 5000 + HQ.MIN);
});

test('recall sends a hero home with no reward', () => {
  const hq = HQ.emptyHeroQuestState();
  hq.heroes.adventurer = { npcId: 'buyer-adventurer-bob', name: 'Wren', hiredAt: 1 };
  assert.equal(HQ.recallQuest(hq, 'cow'), false);
  assert.ok(HQ.startQuest(hq, 'cow', 'adventurer', 1000));
  assert.equal(HQ.recallQuest(hq, 'cow'), true);
  assert.equal(hq.quests.active.cow, undefined);
  assert.equal(hq.quests.done.cow, undefined);
  assert.deepEqual(HQ.idleHeroes(hq), ['adventurer']);
});

test('config covers every quest Luke listed', () => {
  assert.equal(HQ.QUESTS.length, 20);
  assert.deepEqual(HQ.QUEST_BY_ID.vampyre.rewards, { dragon_bar: 50 });
  assert.equal(HQ.formatLeft(42_000), '42s');
  assert.equal(HQ.formatLeft(552_000), '9:12');
  assert.equal(HQ.formatLeft(HQ.DAY - 60_000), '23h 59m');
});

test('hired heroes get a random name with no duplicates, kept through save/load', () => {
  assert.ok(HQ.HERO_NAMES.length >= 40);
  assert.equal(new Set(HQ.HERO_NAMES).size, HQ.HERO_NAMES.length, 'list has no repeats');
  const hq = HQ.emptyHeroQuestState();
  const state = { gold: 40_000_000 };
  const always0 = () => 0; // would pick the same name every time if duplicates were allowed
  HQ.hireHero(state, hq, 'adventurer', 'buyer-adventurer-bob', always0);
  HQ.hireHero(state, hq, 'melee', 'buyer-guard-guard-level-21', always0);
  HQ.hireHero(state, hq, 'ranger', 'buyer-ranger-armour-salesman', always0);
  HQ.hireHero(state, hq, 'mage', 'buyer-wizard-wizard-mizgog', always0);
  const names = HQ.HERO_CLASSES.map((c) => HQ.heroName(hq, c.id));
  assert.equal(new Set(names).size, 4);
  names.forEach((n) => assert.ok(HQ.HERO_NAMES.includes(n)));
  assert.equal(HQ.heroTitle(hq, 'ranger'), `${names[2]} the Ranger`);
  assert.equal(HQ.heroTitle(hq, 'melee'), `${names[1]} the Warrior`);
  const back = HQ.normalizeHeroQuestState(JSON.parse(JSON.stringify(hq)));
  assert.deepEqual(HQ.HERO_CLASSES.map((c) => HQ.heroName(back, c.id)), names);
});

test('old or broken saves get names filled in without duplicates', () => {
  const raw = { heroes: {
    adventurer: { npcId: 'buyer-adventurer-bob' },
    melee: { npcId: 'buyer-guard-guard-level-21', name: 'Wren' },
    ranger: { npcId: 'buyer-ranger-armour-salesman', name: 'Wren' },
  } };
  const hq = HQ.normalizeHeroQuestState(raw);
  const names = ['adventurer', 'melee', 'ranger'].map((id) => HQ.heroName(hq, id));
  assert.equal(names[1], 'Wren');
  assert.equal(new Set(names).size, 3);
  assert.ok(names.every(Boolean));
});

test('quest rewards go past the cap; full materials block more', () => {
  const materials = { essence: 240 };
  HQ.grantQuestReward(materials, 'essence', 500);
  assert.equal(materials.essence, 740, 'no clipping');
  assert.equal(HQ.isMaterialFull(materials, 'essence'), true);
  assert.equal(HQ.isMaterialFull({ hide: 249 }, 'hide'), false);
  assert.equal(HQ.isMaterialFull({ hide: 250 }, 'hide'), true, 'at the cap counts as full');
  assert.deepEqual(HQ.fullOutputs({ steel_bar: 262, iron_bar: 3 }, ['steel_bar', 'iron_bar']), ['steel_bar']);
  assert.equal(HQ.materialCap(1), 250);
  assert.equal(HQ.materialCap(3), 750);
  assert.equal(HQ.isMaterialFull(materials, 'essence', HQ.materialCap(3)), false, 'a bigger chest frees space');
});

test("d'hide recipes use the matching coloured hide", () => {
  assert.equal(Object.keys(HQ.DHIDE_RECIPE_COSTS).length, 20);
  assert.deepEqual(HQ.DHIDE_RECIPE_COSTS.green_dhide_body, { green_dhide: 1 });
  assert.deepEqual(HQ.DHIDE_RECIPE_COSTS.black_dragon_mask, { black_dhide: 1 });
  for (const [id, cost] of Object.entries(HQ.DHIDE_RECIPE_COSTS)) assert.ok(Object.keys(cost)[0] === `${id.split('_')[0]}_dhide`);
});

test('hero hires survive save and load, and old saves stay empty', () => {
  const state = createState();
  state.gold = 80_000;
  assert.equal(HQ.hireHero(state, state.hq, 'adventurer', 'buyer-adventurer-bob', () => 0), true);
  const saved = serializeState(state);
  assert.equal(saved.version, 15);
  assert.equal(saved.hq.heroes.adventurer.name, 'Sir Aldric');
  assert.equal(saved.hq.heroes.melee, null);
  assert.ok(saved.hq.lastSeenAt > 0);
  const next = createState();
  next.gold = 1;
  next.hq.heroes.mage = { npcId: 'buyer-wizard-wizard-level-9', name: 'Gone', hiredAt: 1 };
  assert.equal(applyState(next, saved), true);
  assert.equal(next.gold, 80_000 - 50_000);
  assert.equal(next.hq.heroes.adventurer.npcId, 'buyer-adventurer-bob');
  assert.equal(next.hq.heroes.adventurer.name, 'Sir Aldric');
  assert.equal(next.hq.heroes.mage, null);
  const old = createState();
  const bare = serializeState(createState());
  delete bare.hq;
  bare.version = 11;
  assert.equal(applyState(old, bare), true);
  assert.equal(old.hq.heroes.adventurer, null);
  assert.deepEqual(old.hq.quests, { active: {}, done: {} });
});

test('the top bar has Heroes and Quests, and the phone gear menu keeps Help Saves Fullscreen', () => {
  const html = readFileSync(join(root, '../../index.html'), 'utf8');
  const css = readFileSync(join(root, '../style.css'), 'utf8');
  const bar = html.slice(html.indexOf('id="save-bar"'), html.indexOf('id="hud"'));
  assert.match(bar, /id="heroes-btn"[\s\S]*id="quests-btn"[\s\S]*id="skills-btn"[\s\S]*id="build-btn"/);
  assert.match(html, /id="heroes-dock"/);
  assert.match(html, /id="hero-picker"/);
  assert.match(html, /data-more="help"[\s\S]*data-more="saves"[\s\S]*data-more="fullscreen"/);
  assert.match(css, /#save-bar #help-btn, #save-bar #saves-btn, #save-bar #expand-btn \{ display: none; \}/);
  assert.match(css, /#settings-dock \.more-quick \{ display: grid; \}/);
  const panel = readFileSync(join(root, 'heroesPanel.js'), 'utf8');
  assert.match(panel, /let base = '\.\/public\/';/);
  assert.match(panel, /try \{[\s\S]*import\.meta\.env\.BASE_URL/);
  assert.match(html, /id="away-modal"/);
  assert.match(html, /While you were away/);
  assert.match(panel, /localStorage\.getItem\('questTab'\)/);
  assert.match(panel, /type: 'startQuest'/);
  assert.match(panel, /type: 'collectQuest'/);
  assert.match(panel, /type: 'recallQuest'/);
  assert.match(panel, /game-toast hq-toast/);
  assert.match(panel, /Collected \$\{n\}/);
  assert.match(panel, /data-left/);
  assert.match(panel, /ArrowDown/);
  assert.match(panel, /new CustomEvent\('rc-save-trigger', \{ detail: \{ trigger: 'quest' \} \}\)/);
  assert.match(panel, /if \(hired\) saveQuestProgress\(\)/);
  assert.match(panel, /logRewards\(rows\);\n    saveQuestProgress\(\)/);
  assert.match(panel, /paintQuests\(now\);\n      saveQuestProgress\(\)/);
});

test('a co-op patch keeps this browser lastSeenAt', async () => {
  const { applySharedPatch } = await import('../coop/sharedState.js');
  const state = createState();
  state.hq.heroes.adventurer = { npcId: 'buyer-adventurer-bob', name: 'Wren', hiredAt: 1 };
  state.hq.lastSeenAt = 12345;
  applySharedPatch(state, {
    hq: {
      heroes: state.hq.heroes,
      quests: { active: { cow: { heroId: 'adventurer', startedAt: 1000, endsAt: 1000 + 60_000 } }, done: {} },
    },
  });
  assert.equal(state.hq.lastSeenAt, 12345);
  assert.equal(state.hq.quests.active.cow.heroId, 'adventurer');
});

test("quest unlocks", async (t) => {
  await t.test("gates tabs on completions of the tab before and dragons on Crafting", async () => {
    const { emptyHeroQuestState, questLockReason, startQuest } = await import('./heroesQuests.js');
    const hq = emptyHeroQuestState();
    hq.heroes.adventurer = { npcId: 'x', name: 'A', hiredAt: 0 };
    assert.equal(questLockReason(hq, 'imp'), '');
    assert.match(questLockReason(hq, 'goblin'), /50 more/);
    assert.equal(startQuest(hq, 'goblin', 'adventurer', 0), false);
    hq.quests.done.imp = 30; hq.quests.done.cow = 20;
    assert.equal(questLockReason(hq, 'goblin'), '');
    assert.match(questLockReason(hq, 'giant_rat'), /40 more/);
    hq.quests.done.goblin = 40;
    assert.equal(questLockReason(hq, 'giant_rat'), '');
    hq.quests.done.giant_rat = 30;
    assert.equal(questLockReason(hq, 'ghost'), '');
    assert.match(questLockReason(hq, 'vampyre'), /20 more/);
    assert.match(questLockReason(hq, 'green_dragon', 24), /Crafting level 25/);
    assert.equal(questLockReason(hq, 'green_dragon', 25), '');
    assert.match(questLockReason(hq, 'blue_dragon', 44), /45/);
    assert.match(questLockReason(hq, 'red_dragon', 49), /50/);
    assert.match(questLockReason(hq, 'black_dragon', 74), /75/);
  });
});
