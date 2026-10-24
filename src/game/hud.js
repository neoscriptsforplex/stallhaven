import { PHONE_QUERY, TOUCH_HUD_QUERY, onLayoutChange } from './layoutQuery.js';
import {
  ANVIL_TABS,
  FLETCH_TABS,
  LOOM_TABS,
  anvilSubtabsForTab,
  MATERIALS,
  RECIPES,
  SKYBOXES,
  classLabel,
  costLabel,
  customerName,
  displayKind,
  isHandOrFootWare,
  formatGold,
  isAmmoRecipe,
  isCraftedMaterial,
  isCraftOreId,
  isMinedMaterial,
  materialList,
  offerClassLabel,
  offerClassOf,
  isCraftHidden,
  recipeMatsLabel,
  recipesForAltar,
  recipesForTab,
  growRecipes,
  GROW_RECIPES,
  GROW_BY_ID,
  HERB_GROW_YIELD,
  SHELF_SLOT_LABELS,
  stationForRecipe,
  craftUiForStation,
} from './catalog.js';
import {
  addMusicFiles,
  getMusicTrackName,
  getMusicVolume,
  getPlaylist,
  isLooping,
  isMusicPlaying,
  isShuffle,
  movePlaylistTrack,
  pauseMusic,
  playClick,
  playMusic,
  playTrackAt,
  removePlaylistTrack,
  setMusicVolume,
  setLoop,
  skipTrack,
  startMusicOnLoad,
  stopMusic,
  toggleLoop,
  toggleShuffle,
  playSfx,
} from './audio.js';
import { deleteModel, loadModels, saveModel } from './storage.js';
import { parseModelBuffer, validatePlayerModelFile } from './upload.js';
import {
  assignStandPiece,
  applyCheat,
  buyExpansion,
  buyFromCustomer,
  buyFurniture,
  buyStation,
  canBuyCauldron,
  canBuyExpansion,
  canBuyFurniture,
  canBuyStation,
  canCraft,
  canRestock,
  canUpgradeChest,
  CAULDRON_COST,
  chestCapacity,
  chestDisplayList,
  chestList,
  chestTotal,
  craftBlockReason,
  craftDuration,
  craftProgress,
  DEFAULT_BRIGHTNESS,
  DEFAULT_MUSIC_VOLUME,
  discardFromChest,
  fillStandFromRecipe,
  buildMaterialLabel,
  buildMaterialNeedLine,
  furniturePlaceBlock,
  stationPlaceBlock,
  hasStock,
  isMastered,
  isUnlocked,
  liveFurnitureCount,
  includedFurnitureCount,
  nextFurnitureCost,
  ownsCauldron,
  ownsStation,
  placeFromChest,
  pushLog,
  visibleLog,
  clearDisplay,
  removePlacedFurniture,
  restock,
  offerChoices,
  placeOnDisplay,
  sellToCustomer,
  shopProgress,
  maxCraftActions,
  materialIsFull,
  storageCap,
  gatherFullMessage,
  busyCraftId,
  cancelCrafts,
  startCraft,
  startCraftBatch,
  stationCost,
  unlockRemaining,
  upgradeChest,
  chestCount,
} from './economy.js';
import {
  CONSTRUCTION_PIECES,
  constructionCategories,
  shopFurnitureInCategory,
  constructionPiece,
  constructionPlaceBlock,
  constructionBuildGold,
  missingMaterials,
  constructionPiecesByLevel,
} from './construction.js';
import {
  CHEST_MAX_LEVEL,
  chestSlots,
  chestUpgradeCost,
  expansionCost,
  FARMING_PATCH_CAP,
  FURNITURE_SHOP,
  furnitureKindForType,
  furnitureLabelForType,
  padById,
  stationLabel,
  STATION_UNLOCKS,
} from './layout.js';
import { clampMapZoom, compassAssetUrl, compassNeedleDegrees, drawMinimap, mapToWorld, minimapBufferPixels, minimapFrame } from './minimap.js';
import { boulderInspect, fishingInspect, flaxInspect, treeInspect, wheatInspect } from './shopbuild.js';
import { intentBus } from './intents.js';
import { createCraftPreview } from './craftpreview.js';
import { gatherLevelRequirement } from './skills.js';
import { FISHING_SPOTS } from './layout.js';
import { createSkills, gatherInspectTitle, levelRequirementText, meetsLevelRequirement, skillLevelOf } from './skills.js';
import { bindSkillsPanel, showLevelUpToast } from './skillsPanel.js';
import { bindSkillGuide } from './skillGuide.js';
import { bindHeroesPanel } from './heroesPanel.js';
import { nextUnlockLabel, unlockNamesBetween, unlocksBetween } from './skillLevels.js';
import { groupUnlocks, unlockListHtml } from './unlockGroups.js';
import { createXpOrb } from './xpOrb.js';
import { fitPhoneCraft } from './phoneCraftFit.js';
import { fitBuildDock } from './buildFit.js';
import { fitScrollDock } from './dockFit.js';
import {
  brightnessPercent,
  clampBrightness,
  clampDungeonBrightness,
  dungeonBrightnessPercent,
  writeStoredBrightness,
  writeStoredDungeonBrightness,
  writeStoredPhotoMode,
  DEFAULT_DUNGEON_BRIGHTNESS,
} from './lighting.js';
import { fullscreenEnv, shouldOfferFullscreen } from './pwa.js';
import {
  MATERIALS_DRAWER_SIDE_QUERY,
  materialsDrawerHtml,
  materialsDrawerPointerPlan,
  materialsDrawerSideBox,
  ownedMaterialsKey,
} from './materialsDrawer.js';

export function bindHud(root, state, world) {
  setupPhoneAboutToggles(root);
  intentBus.bind(state);
  const goldEl = root.querySelector('#gold');
  const matsEl = document.querySelector('#materials');
  const potionMatsEl = document.querySelector('#potion-materials');
  const craftsEl = document.querySelector('#crafts');
  const potionCraftsEl = document.querySelector('#potion-crafts');
  const tabsEl = document.querySelector('#craft-tabs');
  const subtabsEl = document.querySelector('#craft-subtabs');
  const chestCountEl = document.querySelector('#chest-count');
  const importModal = document.querySelector('#import-modal');
  const helpModal = document.querySelector('#help-modal');
  const dismiss = helpModal.querySelector('[data-dismiss]');
  const chestModal = document.querySelector('#chest-modal');
  const chestItems = document.querySelector('#chest-items');
  const tradeModal = document.querySelector('#trade-modal');
  const offerModal = document.querySelector('#offer-modal');
  const offerItems = document.querySelector('#offer-items');
  const displayModal = document.querySelector('#display-modal');
  const displayItems = document.querySelector('#display-items');
  const craftModal = document.querySelector('#craft-modal');
  const upgradeModal = document.querySelector('#chest-upgrade-modal');
  const expandModal = document.querySelector('#expand-dock');
  const buildModal = document.querySelector('#build-dock');
  const placeModal = document.querySelector('#place-dock');
  const potionModal = document.querySelector('#potion-modal');
  const musicDock = document.querySelector('#music-dock');
  const settingsDock = document.querySelector('#settings-dock');
  const settingsBtn = document.querySelector('#settings-btn');
  let skillsPanel = null;
  let skillGuide = null;
  let heroesPanel = null;
  const skills = state.skills?.getLevel ? state.skills : createSkills();
  if (!state.skills) state.skills = skills;
  const furnMenu = document.querySelector('#furn-menu');
  const inspectPop = document.querySelector('#inspect-pop');
  let inspectTarget = null;
  const minimap = document.querySelector('#minimap');
  const minimapWrap = document.querySelector('.minimap-wrap');
  let compassBase = './public/';
  try {
    const raw = import.meta.env.BASE_URL;
    if (raw) compassBase = raw.endsWith('/') ? raw : `${raw}/`;
  } catch { /* GitHub Pages serves this file unbuilt, where import.meta.env is missing. */ }
  const compassHref = compassAssetUrl(compassBase, document.baseURI);
  document.documentElement.style.setProperty('--compass-url', `url("${compassHref}")`);
  const mapToggle = document.querySelector('[data-map-toggle]');
  const mapClose = document.querySelector('[data-map-close]');
  const mapDismiss = document.querySelector('[data-map-dismiss]');
  const mapNorth = document.querySelector('[data-map-north]');
  const mapZoomIn = document.querySelector('[data-map-zoom="in"]');
  const mapZoomOut = document.querySelector('[data-map-zoom="out"]');
  const portraitTouchMedia = window.matchMedia(TOUCH_HUD_QUERY);
  const materialsDrawer = document.querySelector('#materials-drawer');
  const materialsToggle = document.querySelector('#materials-toggle');
  const materialsPanel = document.querySelector('#materials-panel');
  const ownedMaterialsEl = document.querySelector('#owned-materials');
  const materialsSideMedia = window.matchMedia(MATERIALS_DRAWER_SIDE_QUERY);
  let ownedKey = '';
  let materialsPlaceKey = '';
  let mapZoom = 1;
  let mapPing = null;
  const shopFade = document.querySelector('#shop-fade');
  const activeCraft = root.querySelector('#active-craft');
  const activeCraftName = activeCraft?.querySelector('[data-active-craft-name]');
  const activeCraftYield = activeCraft?.querySelector('[data-active-craft-yield]');
  const chestCapEl = document.querySelector('#chest-cap');
  const fullscreenBox = document.querySelector('[data-fullscreen]');
  const fullscreenRow = document.querySelector('[data-fullscreen-row]');
  const buildBtn = document.querySelector('#build-btn');
  const musicBtn = document.querySelector('#music-btn');
  const musicFile = document.querySelector('#music-file');
  const fillModal = document.querySelector('#fill-modal');
  const fillItems = document.querySelector('#fill-items');
  let craftPreview = null;
  let potionPreview = null;
  let lastPreviewAt = 0;
  let fillClass = 'melee';
  let selectedFillId = null;
  let fillTarget = null;
  let pendingDiscardId = null;

  let craftTab = 'melee';
  let craftSubtab = 'weapon';
  let craftSide = '';
  let craftStation = 'anvil';
  let activePatchIndex = null;
  let craftFocusId = null;
  let tradeActor = null;
  let furnTarget = null;
  let selectedOfferId = null;
  let lastOfferListKey = '';
  let selectedDisplayId = null;
  let lastDisplayListKey = '';
  let displayTarget = null;
  let pendingPlace = null;
  let buildTab = 'furniture';
  let buildCategory = 'Seating';
  let selectedPiece = null;
  let pieceSnap = true;
  let constructionHost = true;
  document.addEventListener('rc-party', (event) => {
    const detail = event.detail ?? {};
    constructionHost = !detail.inRoom || Boolean(detail.host);
  });
  let resumeTrade = null;

  tabsEl.innerHTML = ANVIL_TABS.map((tab) => (
    `<button type="button" class="tab" data-tab="${tab.id}">${tab.label}</button>`
  )).join('');
  tabsEl.classList.add('has-tools');

  function paintSubtabs() {
    const tabs = anvilSubtabsForTab(craftTab);
    subtabsEl.innerHTML = tabs.map((tab) => (
      `<button type="button" class="tab" data-subtab="${tab.id}">${tab.label}</button>`
    )).join('');
    subtabsEl.classList.toggle('has-extra', tabs.length > 2);
  }
  paintSubtabs();

  function currentRecipes() {
    if (craftStation === 'range') return recipesForTab('food');
    if (craftStation === 'cauldron') return recipesForTab('potion');
    if (craftStation === 'furnace') return recipesForTab('smelt');
    if (craftStation === 'wheel') return recipesForTab('spin');
    if (craftStation === 'potter') return recipesForTab('potter');
    if (craftStation === 'sawmill') return recipesForTab('saw');
    if (craftStation === 'farming_patch') return growRecipes();
    if (craftStation === 'loom') {
      if (craftTab === 'ranged') {
        return recipesForTab('ranged', 'armour');
      }
      if (craftTab === 'magic') return recipesForTab('magic', 'armour');
      return recipesForTab('cloth');
    }
    if (craftStation === 'fletch') {
      return recipesForTab('ranged', craftTab === 'ammo' ? 'ammo' : 'weapon');
    }
    if (typeof craftStation === 'string' && craftStation.startsWith('altar-')) {
      return recipesForAltar(craftStation.slice('altar-'.length));
    }
    return recipesForTab(craftTab, craftSubtab).filter((recipe) => stationForRecipe(recipe) === 'anvil');
  }

  function setCraftNote(text) {
    const note = craftModal.querySelector('[data-craft-note]');
    if (!note) return;
    note.hidden = !text;
    note.textContent = text || '';
  }

  function escCraft(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function recipeGroups(recipes) {
    const groups = new Map();
    for (const recipe of recipes) {
      const name = recipe.lineName || recipe.name || recipe.id;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(recipe);
    }
    for (const list of groups.values()) list.sort((a, b) => a.lineIndex - b.lineIndex);
    return groups;
  }

  function craftSideStorageKey() {
    return `craftSide:${craftStation}:${craftTab}:${craftSubtab}`;
  }

  function savedCraftSide() {
    try {
      return localStorage.getItem(craftSideStorageKey()) || '';
    } catch {
      return '';
    }
  }

  function rememberCraftSide(name) {
    if (!name) return;
    try {
      localStorage.setItem(craftSideStorageKey(), name);
    } catch {
      /* private mode */
    }
  }

  function recipeOpen(recipe) {
    return isUnlocked(state, recipe.id)
      && meetsLevelRequirement(recipe, (skillId) => skillLevelOf(state, skillId));
  }

  function chooseCraftSide(groups) {
    const names = [...groups.keys()];
    if (craftFocusId) {
      const recipe = RECIPES[craftFocusId];
      const name = recipe?.lineName || recipe?.name;
      if (name && groups.has(name)) {
        craftSide = name;
        rememberCraftSide(name);
        return;
      }
    }
    const saved = savedCraftSide();
    if (saved && groups.has(saved)) {
      craftSide = saved;
      return;
    }
    if (groups.has(craftSide)) return;
    const unlocked = names.find((name) => groups.get(name).some(recipeOpen));
    craftSide = unlocked || names[0] || '';
  }

  function paintSideTabs(groups) {
    const nav = document.querySelector('#craft-sidetabs');
    const body = craftModal.querySelector('.craft-body');
    if (!nav || !body) return;
    const show = groups.size >= 2;
    nav.hidden = !show;
    body.classList.toggle('no-side', !show);
    if (!show) {
      nav.innerHTML = '';
      return;
    }
    nav.innerHTML = [...groups.entries()].map(([name, list]) => {
      const open = list.filter(recipeOpen).length;
      const on = name === craftSide;
      return `<button type="button" class="sidetab${on ? ' is-on' : ''}" role="tab" aria-selected="${on ? 'true' : 'false'}" data-side="${escCraft(name)}">${escCraft(name)}<span class="sidetab-count">${open}/${list.length}</span></button>`;
    }).join('');
    if (window.matchMedia(PHONE_QUERY).matches) {
      nav.querySelector('.sidetab.is-on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }

  function paintRecipeButtons(container, recipes, { headings = true } = {}) {
    if (!container) return;
    if (craftStation === 'farming_patch' && recipes.length === 0) {
      container.innerHTML = '<p class="empty">Nothing to grow yet.</p>';
      return;
    }
    const lines = new Map();
    for (const recipe of recipes) {
      const lineId = recipe.lineId || recipe.id;
      if (!lines.has(lineId)) lines.set(lineId, []);
      lines.get(lineId).push(recipe);
    }
    container.innerHTML = [...lines.values()].map((list) => {
      list.sort((a, b) => a.lineIndex - b.lineIndex);
      const lineTitle = headings && list[0]?.lineName ? `<h4 class="line">${escCraft(list[0].lineName)}</h4>` : '';
      return lineTitle + list.map((recipe) => {
        const levelText = levelRequirementText(recipe);
        const levelLocked = Boolean(levelText)
          && !meetsLevelRequirement(recipe, (skillId) => skillLevelOf(state, skillId));
        const chainLocked = !isUnlocked(state, recipe.id);
        const locked = chainLocked || levelLocked;
        const mastered = isMastered(state, recipe.id);
        const prev = recipe.previousId ? RECIPES[recipe.previousId] : null;
        const remain = unlockRemaining(state, recipe.id);
        const duration = craftDuration(state, recipe.id);
        const lockText = levelLocked
          ? levelText
          : chainLocked
            ? `Locked · ${remain} more ${prev?.name ?? 'crafts'}`
            : costLabel(recipe, duration);
        const mats = recipeMatsLabel(recipe);
        const focus = recipe.id === craftFocusId ? ' is-focus' : '';
        const star = mastered ? '<span class="mastery-star" title="Mastered">★</span>' : '';
        const affordable = locked ? 0 : maxCraftActions(state, recipe.id);
        const storageFull = !locked && Boolean(recipe.outputMaterial) && materialIsFull(state, recipe.outputMaterial);
        const fullTitle = storageFull ? ' title="Storage full"' : '';
        const fullActions = storageFull
          ? `<button type="button" class="sf-full" data-storage-full="${escCraft(recipe.outputMaterial)}" title="Storage full">FULL</button><button type="button" class="sf-link" data-storage-upgrade>Upgrade chest</button>`
          : '';
        return `
          <article class="craft-row${locked ? ' is-locked' : ''}${storageFull ? ' is-full' : ''}${focus}" data-craft-row="${recipe.id}">
            <button type="button" class="craft${locked ? ' is-locked' : ''}${mastered ? ' is-mastered' : ''}${focus}" data-craft="${recipe.id}"${storageFull ? ' disabled title="Storage full"' : ''}>
              <strong>${star}${recipe.name}</strong>
              <span class="meta">${lockText}</span>
              ${mats ? `<span class="craft-mats-line">${mats}</span>` : ''}
              <span class="timer" data-timer="${recipe.id}"></span>
              <span class="craft-bar" aria-hidden="true"><i data-bar="${recipe.id}"></i></span>
            </button>
            <div class="craft-qty">
              <button type="button" data-craft-qty="1" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}${fullTitle}>1×</button>
              <button type="button" data-craft-qty="5" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}${fullTitle}>5×</button>
              <button type="button" data-craft-qty="max" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}${fullTitle}>Max</button>
            </div>
            ${fullActions}
          </article>
        `;
      }).join('');
    }).join('');
  }

  let paintedTabStation = '';
  let revealCraftFocus = false;
  let craftScrollPlan = null;
  let craftScrollFlushQueued = false;

  function holdCraftScroll(list, { reveal = false, focusId = null } = {}) {
    if (!list) return;
    if (reveal && focusId) {
      craftScrollPlan = { focusId, list };
      return;
    }
    if (craftScrollPlan) return;
    const sheet = list.closest('.craft-sheet') || list.closest('.sheet');
    craftScrollPlan = {
      top: list.scrollTop,
      sheetTop: sheet?.scrollTop ?? 0,
      sheet,
      list,
      key: `${craftStation}:${craftTab}:${craftSubtab}:${craftSide}`,
    };
  }

  function restoreCraftScrollNow() {
    const plan = craftScrollPlan;
    if (!plan || plan.focusId) return;
    const key = `${craftStation}:${craftTab}:${craftSubtab}:${craftSide}`;
    if (plan.key && plan.key !== key) {
      if (plan.list) plan.list.scrollTop = 0;
      return;
    }
    if (plan.list) plan.list.scrollTop = plan.top;
    if (plan.sheet) plan.sheet.scrollTop = plan.sheetTop;
  }

  function queueCraftScrollFlush() {
    if (craftScrollFlushQueued) return;
    craftScrollFlushQueued = true;
    requestAnimationFrame(() => {
      craftScrollFlushQueued = false;
      const plan = craftScrollPlan;
      craftScrollPlan = null;
      if (!plan?.list) return;
      if (plan.focusId) {
        plan.list.querySelector(`[data-craft-row="${plan.focusId}"]`)?.scrollIntoView({ block: 'center' });
        return;
      }
      plan.list.scrollTop = plan.top;
      if (plan.sheet) plan.sheet.scrollTop = plan.sheetTop;
    });
  }

  function ensureCraftTabs() {
    if (paintedTabStation === craftStation) return;
    paintedTabStation = craftStation;
    const tabs = craftStation === 'loom'
      ? LOOM_TABS
      : craftStation === 'fletch'
        ? FLETCH_TABS
        : ANVIL_TABS;
    tabsEl.innerHTML = tabs.map((tab) => (
      `<button type="button" class="tab" data-tab="${tab.id}">${tab.label}</button>`
    )).join('');
    tabsEl.classList.toggle('has-tools', craftStation !== 'loom' && craftStation !== 'fletch');
  }

  function paintHerbRows(container) {
    if (!container) return;
    const patch = state.furniture?.patches?.[activePatchIndex];
    if (!patch) {
      container.innerHTML = '<p class="empty">That patch is gone.</p>';
      return;
    }
    const now = Date.now();
    const crop = patch.crop;
    const level = skillLevelOf(state, 'farming');
    container.innerHTML = GROW_RECIPES.map((recipe) => {
      const locked = level < recipe.level;
      const growing = crop?.id === recipe.id;
      const ready = growing && now >= crop.endsAt;
      const busy = Boolean(crop) && !growing;
      const full = materialIsFull(state, recipe.product);
      const left = growing && !ready ? Math.max(1, Math.ceil((crop.endsAt - now) / 1000)) : 0;
      const name = MATERIALS[recipe.product]?.name ?? recipe.name;
      const meta = locked
        ? `Requires level ${recipe.level} Farming`
        : ready
          ? `Ready · ${HERB_GROW_YIELD} ${name}`
          : growing
            ? 'Growing'
            : busy
              ? 'A crop is already growing'
              : `Level ${recipe.level} · ${recipe.seconds}s · ${HERB_GROW_YIELD} ${name}`;
      const disabled = locked || busy || (full && !growing);
      const phase = ready ? 'ready' : growing ? 'grow' : 'plant';
      const fullActions = full && !growing
        ? `<button type="button" class="sf-full" data-storage-full="${escCraft(recipe.product)}" title="Storage full">FULL</button><button type="button" class="sf-link" data-storage-upgrade>Upgrade chest</button>`
        : '';
      return `
        <article class="craft-row${locked || busy ? ' is-locked' : ''}${full && !growing ? ' is-full' : ''}" data-herb-row="${recipe.id}" data-craft-row="${escCraft(recipe.product)}">
          <button type="button" class="craft${ready ? ' is-ready' : ''}" data-herb="${recipe.id}" data-herb-phase="${phase}"${disabled ? ' disabled' : ''}${full && !growing ? ' title="Storage full"' : ''}>
            <strong>${escCraft(ready ? `Harvest ${recipe.name}` : recipe.name)}</strong>
            <span class="meta">${escCraft(meta)}</span>
            <span class="timer" data-herb-left="${recipe.id}">${left ? `${left}s` : ''}</span>
          </button>
          ${fullActions}
        </article>
      `;
    }).join('');
  }

  function paintHerbTimers() {
    const patch = state.furniture?.patches?.[activePatchIndex];
    if (!patch || !craftsEl) return;
    const now = Date.now();
    const crop = patch.crop;
    let repaint = false;
    for (const btn of craftsEl.querySelectorAll('[data-herb]')) {
      const id = btn.dataset.herb;
      const growing = crop?.id === id;
      const ready = growing && now >= crop.endsAt;
      const phase = ready ? 'ready' : growing ? 'grow' : 'plant';
      if (btn.dataset.herbPhase !== phase) repaint = true;
      const timer = craftsEl.querySelector(`[data-herb-left="${id}"]`);
      if (timer && growing && !ready) {
        timer.textContent = `${Math.max(1, Math.ceil((crop.endsAt - now) / 1000))}s`;
      }
    }
    if (repaint) paintHerbRows(craftsEl);
  }

  // Cooking range: shrink the list + materials strip until the sheet fits with no scrollbar.
  function fitCookSheet(on) {
    const sheet = craftModal.querySelector('.craft-sheet');
    const parts = [craftModal.querySelector('.craft-body'), matsEl].filter(Boolean);
    for (const el of parts) el.style.zoom = '';
    if (!on || !sheet || craftModal.hidden) return;
    for (let i = 0; i < 3; i++) {
      const over = sheet.scrollHeight - sheet.clientHeight;
      if (over <= 0) break;
      const total = parts.reduce((a, p) => a + p.getBoundingClientRect().height, 0) || 1;
      const k = 1 - (over + 2) / total;
      for (const el of parts) el.style.zoom = Math.max(0.55, (Number(el.style.zoom) || 1) * k).toFixed(3);
    }
  }
  addEventListener('resize', () => { if (!craftModal.hidden) fitCookSheet(craftStation === 'range'); });
  onLayoutChange(() => { if (!craftModal.hidden) fitCookSheet(craftStation === 'range'); });
  new MutationObserver(() => { if (!craftModal.hidden) fitCookSheet(craftStation === 'range'); })
    .observe(craftModal, { attributes: true, attributeFilter: ['hidden'] });
  // Narrow phone: station windows fit the band between HUD and button bar; drawer stays a tab.
  let stationWasOpen = false;
  function syncStationPhone() {
    const open = [craftModal, potionModal].some((m) => m && !m.hidden);
    for (const m of [craftModal, potionModal]) if (m) fitPhoneCraft(m);
    const phone = matchMedia(PHONE_QUERY).matches;
    document.body.classList.toggle('station-open', open && phone);
    if (open && phone && !stationWasOpen) setMaterialsOpen(false);
    stationWasOpen = open;
    syncMaterialsDrawerPlace();
  }
  let stationRaf = 0;
  const queueStationPhone = () => { if (stationRaf) return; stationRaf = requestAnimationFrame(() => { stationRaf = 0; syncStationPhone(); }); };
  onLayoutChange(queueStationPhone);
  addEventListener('resize', queueStationPhone);
  for (const m of [craftModal, potionModal]) if (m) {
    new MutationObserver(queueStationPhone).observe(m, { attributes: true, attributeFilter: ['hidden'] });
    const relist = new MutationObserver(() => { if (!m.hidden && matchMedia(PHONE_QUERY).matches) queueStationPhone(); });
    for (const el of m.querySelectorAll('#crafts, #potion-crafts, .tabs, [data-craft-note]')) relist.observe(el, el.matches('[data-craft-note], .tabs') ? { childList: true, attributes: true, attributeFilter: ['hidden'] } : { childList: true });
  }

  function paintCrafts() {
    const rangeMode = craftStation === 'range';
    const cauldronMode = craftStation === 'cauldron';
    const furnaceMode = craftStation === 'furnace';
    const wheelMode = craftStation === 'wheel';
    const loomMode = craftStation === 'loom';
    const fletchMode = craftStation === 'fletch';
    const potterMode = craftStation === 'potter';
    const sawmillMode = craftStation === 'sawmill';
    const patchMode = craftStation === 'farming_patch';
    const altarMode = typeof craftStation === 'string' && craftStation.startsWith('altar-');
    const altarMark = altarMode ? craftStation.slice('altar-'.length) : '';
    const simpleStation = rangeMode || cauldronMode || furnaceMode || wheelMode || potterMode || sawmillMode || patchMode || altarMode;
    // Cooking range = one compact level-sorted list (no side tabs, no scroll).
    craftModal.classList.toggle('is-cook', rangeMode);
    ensureCraftTabs();
    tabsEl.hidden = simpleStation || tabsEl.querySelectorAll('[data-tab]').length <= 1;
    subtabsEl.hidden = simpleStation || loomMode || fletchMode;
    const title = craftModal.querySelector('[data-craft-title]');
    const blurb = craftModal.querySelector('[data-craft-blurb]');
    if (title) {
      title.textContent = rangeMode
        ? 'Cooking Range'
        : cauldronMode
          ? 'Cauldron'
          : furnaceMode
            ? 'Furnace'
            : wheelMode
              ? 'Spinning Wheel'
              : loomMode
                ? 'Loom'
                : fletchMode
                  ? 'Fletching Bench'
                  : potterMode
                    ? 'Potter Wheel'
                    : sawmillMode
                      ? 'Sawmill'
                      : patchMode
                        ? 'Farming Patch'
                      : altarMode
                      ? `${altarMark.charAt(0).toUpperCase()}${altarMark.slice(1)} Altar`
                      : 'Anvil';
    }
    if (blurb) {
      blurb.textContent = rangeMode
        ? 'Bake food here. Finished plates land in the chest or on a wall shelf.'
        : cauldronMode
          ? 'Brew potions from herbs and water. Finished vials land in the chest and sit on wall shelves.'
          : furnaceMode
            ? 'Smelt ores into metal bars. Bronze starts unlocked; higher bars need enough smelts of the previous tier. Bars are used at the anvil — they are not restocked for free.'
            : wheelMode
              ? 'Spin flax into bow string. Bows and crossbows need bow string; it is not restocked for free.'
              : loomMode
                ? 'Weave flax into cloth, then ranged and magic armour. Cloth is not restocked for free.'
                : fletchMode
                  ? 'Fletch ranged weapons and ammo. Arrows still make 20 per craft action.'
                    : potterMode
                    ? 'Soften hard clay with a bucket of water. Finished soft clay stays in your materials.'
                    : sawmillMode
                      ? 'Saw logs into planks. Finished planks stay in your materials.'
                      : patchMode
                        ? 'Plant a herb. It keeps growing while you are away, then harvest it for Farming XP.'
                      : altarMode
                      ? 'Bind rune essence into this element. Finished runes land in the chest.'
                      : 'Work a ware here. 1× / 5× / Max are craft actions. Finished pieces land in the chest. Melee gear and tools use metal bars. Magic weapons stay here; ranged weapons go to the fletching bench, and cloth armour goes to the loom.';
    }
    if (!simpleStation) paintSubtabs();
    if (simpleStation || loomMode || fletchMode || subtabsEl.querySelectorAll('[data-subtab]').length <= 1) {
      subtabsEl.hidden = true;
    }
    for (const btn of tabsEl.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === craftTab);
    }
    for (const btn of subtabsEl.querySelectorAll('[data-subtab]')) {
      btn.classList.toggle('is-on', btn.dataset.subtab === craftSubtab);
    }
    if (patchMode) {
      paintSideTabs(new Map());
      holdCraftScroll(craftsEl);
      paintHerbRows(craftsEl);
      queueCraftScrollFlush();
      return;
    }
    const reveal = revealCraftFocus;
    revealCraftFocus = false;
    const groups = recipeGroups(currentRecipes());
    const sideBefore = craftSide;
    chooseCraftSide(groups);
    paintSideTabs(groups);
    const sideList = groups.size >= 2 ? (groups.get(craftSide) ?? []) : [...groups.values()].flat();
    holdCraftScroll(craftsEl, { reveal, focusId: craftFocusId });
    if (sideBefore !== craftSide && craftScrollPlan && !craftScrollPlan.focusId) craftScrollPlan.top = 0;
    paintRecipeButtons(craftsEl, sideList, { headings: false });
    // Cooking range: only show the materials its dishes use, so the sheet fits without scrolling.
    const cookMats = rangeMode ? new Set(sideList.flatMap((r) => Object.keys(r.cost?.materials ?? r.mats ?? {}))) : null;
    for (const el of matsEl?.querySelectorAll('[data-mat]') ?? []) el.hidden = !!cookMats && !cookMats.has(el.dataset.mat);
    fitCookSheet(rangeMode);
    restoreCraftScrollNow();
    syncQtyHint(craftFocusId);
    if (craftFocusId) showPreview(craftFocusId);
    queueCraftScrollFlush();
  }
  paintCrafts();

  function fillMats(container) {
    if (!container || container.dataset.ready) return;
    container.innerHTML = materialList().map((mat) => `
      <div class="mat${isCraftedMaterial(mat.id) ? ' is-crafted' : ''}" data-mat="${mat.id}">
        ${mat.tint && !mat.bar ? `<span class="mat-swatch" style="background:#${mat.tint.toString(16).padStart(6, '0')}" aria-hidden="true"></span>` : ''}
        <span class="mat-name">${mat.name}</span>
        <span class="mat-count" data-count="${mat.id}">0</span>
        ${isCraftedMaterial(mat.id)
          ? '<span class="mat-crafted">Crafted</span>'
          : isMinedMaterial(mat.id)
            ? '<span class="mat-crafted">Mined</span>'
            : mat.gathered
              ? '<span class="mat-crafted">Picked</span>'
              : mat.fished
                ? '<span class="mat-crafted">Caught</span>'
              : mat.drawn
                ? '<span class="mat-crafted">Fountain</span>'
                : mat.quest
                  ? '<span class="mat-crafted">Quest</span>'
                  : `<button type="button" class="restock" data-restock="${mat.id}">${formatGold(mat.restock)}g</button>`}
      </div>
    `).join('');
    container.dataset.ready = '1';
    container.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-restock]');
      if (btn) {
        if (intentBus.run({ type: 'restock', materialId: btn.dataset.restock })) render(performance.now() / 1000);
        return;
      }
      const matEl = event.target.closest('[data-mat]');
      if (matEl && isCraftOreId(matEl.dataset.mat) && !craftModal.hidden) {
        showPreview(matEl.dataset.mat);
      }
    });
  }
  fillMats(matsEl);

  function syncMats(container) {
    if (!container) return;
    for (const mat of materialList()) {
      const count = container.querySelector(`[data-count="${mat.id}"]`);
      if (count) count.textContent = `×${state.materials[mat.id] ?? 0}`;
      const btn = container.querySelector(`[data-restock="${mat.id}"]`);
      if (btn) btn.disabled = !canRestock(state, mat.id);
    }
  }

  tabsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    craftTab = btn.dataset.tab;
    craftSubtab = craftTab === 'tools' ? 'hatchet' : 'weapon';
    craftFocusId = null;
    setCraftNote('');
    paintCrafts();
    render(performance.now() / 1000);
  });

  document.querySelector('#craft-sidetabs')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-side]');
    if (!btn) return;
    craftSide = btn.dataset.side;
    rememberCraftSide(craftSide);
    craftFocusId = null;
    if (craftsEl) craftsEl.scrollTop = 0;
    setCraftNote('');
    paintCrafts();
    render(performance.now() / 1000);
  });
  document.querySelector('#craft-sidetabs')?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (window.matchMedia(PHONE_QUERY).matches) return;
    const buttons = [...event.currentTarget.querySelectorAll('[data-side]')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    next.focus();
    next.click();
  });
  craftModal.querySelector('.craft-info')?.addEventListener('click', (event) => {
    event.stopPropagation();
    craftModal.querySelector('.craft-head')?.classList.toggle('is-info');
  });

  subtabsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-subtab]');
    if (!btn) return;
    craftSubtab = btn.dataset.subtab;
    craftFocusId = null;
    setCraftNote('');
    paintCrafts();
    render(performance.now() / 1000);
  });

  function syncQtyHint(recipeId) {
    const recipe = recipeId ? RECIPES[recipeId] : null;
    const ammoHint = craftModal.querySelector('[data-ammo-hint]');
    if (!ammoHint) return;
    const showAmmo = isAmmoRecipe(recipe)
      || (!recipe && craftStation === 'anvil' && craftSubtab === 'ammo');
    ammoHint.hidden = !showAmmo;
  }

  function showPreview(recipeId) {
    const recipe = RECIPES[recipeId];
    if (craftPreview) craftPreview.show(recipeId);
    const label = recipe?.name ?? MATERIALS[recipeId]?.name ?? (phoneTapPreview() ? 'Tap a recipe to preview.' : 'Select or hover a recipe.');
    const craftName = craftModal.querySelector('[data-craft-preview-name]');
    if (craftName) {
      craftName.textContent = label;
      if (recipe) {
        const have = recipe.outputMaterial ? (state.materials?.[recipe.outputMaterial] ?? 0) : chestCount(state, recipeId);
        const line = document.createElement('span');
        line.className = 'craft-have';
        line.textContent = `In inventory: ${Math.max(0, Math.floor(have))}`;
        craftName.append(document.createElement('br'), line);
      }
    }
    syncQtyHint(recipeId);
  }

  function queueCraft(recipeId, want) {
    revealCraftFocus = true;
    craftFocusId = recipeId;
    showPreview(recipeId);
    const affordable = maxCraftActions(state, recipeId);
    if (affordable < 1) {
      const reason = craftBlockReason(state, recipeId) || 'Nothing left to craft.';
      setCraftNote(reason);
      const potionNote = potionModal.querySelector('[data-potion-note]');
      if (potionNote && craftStation === 'cauldron') {
        potionNote.hidden = false;
        potionNote.textContent = reason;
      }
      paintCrafts();
      render(performance.now() / 1000);
      return;
    }
    const n = intentBus.run({
      type: 'craft',
      recipeId,
      count: want === Infinity || want === 'max' ? 'max' : want,
    });
    if (!n) {
      revealCraftFocus = false;
      return;
    }
    playClick('craft');
    setCraftNote('');
    const potionNote = potionModal.querySelector('[data-potion-note]');
    if (potionNote) {
      potionNote.hidden = true;
      potionNote.textContent = '';
    }
    const recipe = RECIPES[recipeId];
    const batch = recipe?.outputMaterial && (recipe.outputCount ?? 1) > 1
      ? ` ×${n} (${n * recipe.outputCount} ${MATERIALS[recipe.outputMaterial]?.name ?? 'items'})`
      : recipe?.outputCount > 1 && !recipe.outputMaterial
        ? ` ×${n} (${n * recipe.outputCount} in the chest)`
        : n > 1 ? ` ×${n}` : '';
    pushLog(state, `Crafting ${recipe.name}${batch}…`);
    paintCrafts();
    render(performance.now() / 1000);
  }

  function onCraftClick(event) {
    const full = event.target.closest('[data-storage-full]');
    if (full) {
      openStoragePop(full, full.dataset.storageFull);
      return;
    }
    const upgrade = event.target.closest('[data-storage-upgrade]');
    if (upgrade) {
      closeStoragePop();
      openUpgrade();
      return;
    }
    const herbBtn = event.target.closest('[data-herb]');
    if (herbBtn) {
      const recipeId = herbBtn.dataset.herb;
      const recipe = GROW_BY_ID[recipeId];
      const index = activePatchIndex;
      const patch = state.furniture?.patches?.[index];
      if (!recipe || !patch) return;
      const now = Date.now();
      if (patch.crop?.id === recipeId && now >= patch.crop.endsAt) {
        const got = intentBus.run({ type: 'harvestHerb', index });
        const name = MATERIALS[recipe.product]?.name ?? recipe.name;
        if (got > 0) {
          pushLog(state, `Harvested ${got} ${name}.`);
          playClick('ui');
        } else if (state.furniture?.patches?.[index]?.crop) {
          pushLog(state, gatherFullMessage(recipe.product));
        }
        paintHerbRows(craftsEl);
        render(performance.now() / 1000);
        return;
      }
      if (patch.crop) return;
      if (skillLevelOf(state, 'farming') < recipe.level) {
        pushLog(state, `You need a Farming level of ${recipe.level} to grow ${recipe.name}.`);
        render(performance.now() / 1000);
        return;
      }
      if (intentBus.run({ type: 'plantHerb', index, recipeId })) {
        pushLog(state, `Planted ${recipe.name}.`);
        playClick('ui');
        paintHerbRows(craftsEl);
      }
      render(performance.now() / 1000);
      return;
    }
    const qty = event.target.closest('[data-craft-qty]');
    if (qty) {
      const recipeId = qty.dataset.craftFor;
      const want = qty.dataset.craftQty === 'max' ? Infinity : Number(qty.dataset.craftQty);
      queueCraft(recipeId, want);
      return;
    }
    const btn = event.target.closest('[data-craft]');
    if (!btn) return;
    if (phoneTapPreview()) {
      // Phone: tapping a recipe only previews it; 1x / 5x / Max do the crafting.
      craftFocusId = btn.dataset.craft;
      showPreview(craftFocusId);
      paintCrafts();
      return;
    }
    queueCraft(btn.dataset.craft, 1);
  }

  function phoneTapPreview() {
    return window.matchMedia(PHONE_QUERY).matches;
  }

  function onCraftHover(event) {
    const row = event.target.closest('[data-craft-row]');
    if (!row) return;
    showPreview(row.dataset.craftRow);
  }

  function onCancelCraft() {
    const recipeId = busyCraftId(state);
    const refunded = intentBus.run({ type: 'cancelCrafts' });
    if (!refunded) return;
    const name = RECIPES[recipeId]?.name ?? 'craft';
    const extra = refunded > 1 ? ` · ${refunded} actions returned` : '';
    pushLog(state, `Cancelled ${name}${extra}.`);
    playClick('ui');
    setCraftNote('');
    paintCrafts();
    render(performance.now() / 1000);
  }

  craftModal.querySelector('[data-craft-cancel]')?.addEventListener('click', onCancelCraft);
  potionModal.querySelector('[data-potion-cancel]')?.addEventListener('click', onCancelCraft);

  craftsEl.addEventListener('click', onCraftClick);
  potionCraftsEl?.addEventListener('click', onCraftClick);
  craftsEl.addEventListener('pointerover', onCraftHover);
  potionCraftsEl?.addEventListener('pointerover', onCraftHover);

  craftPreview = createCraftPreview(craftModal.querySelector('[data-craft-preview]'));
  potionPreview = createCraftPreview(potionModal.querySelector('[data-potion-preview]'));

  chestModal.querySelector('[data-chest-close]').addEventListener('click', closeChest);
  chestModal.addEventListener('click', (event) => {
    if (event.target === chestModal) closeChest();
  });
  chestItems.addEventListener('click', (event) => {
    const discardBtn = event.target.closest('[data-discard]');
    if (discardBtn) {
      pendingDiscardId = discardBtn.dataset.discard;
      const box = chestModal.querySelector('[data-discard-box]');
      const msg = chestModal.querySelector('[data-discard-msg]');
      const recipe = RECIPES[pendingDiscardId];
      if (msg) msg.textContent = `Throw away ${recipe?.name ?? 'this ware'}? It cannot be undone.`;
      if (box) box.hidden = false;
      return;
    }
    const btn = event.target.closest('[data-place]');
    if (!btn) return;
    if (intentBus.run({ type: 'placeFromChest', recipeId: btn.dataset.place })) {
      world.syncDisplays();
      paintChest();
      render(performance.now() / 1000);
    }
  });
  chestModal.querySelector('[data-discard-no]')?.addEventListener('click', () => {
    pendingDiscardId = null;
    const box = chestModal.querySelector('[data-discard-box]');
    if (box) box.hidden = true;
  });
  chestModal.querySelector('[data-discard-yes]')?.addEventListener('click', () => {
    if (pendingDiscardId && intentBus.run({ type: 'discard', recipeId: pendingDiscardId })) {
      pushLog(state, `Discarded ${RECIPES[pendingDiscardId]?.name ?? 'a ware'}.`);
    }
    pendingDiscardId = null;
    const box = chestModal.querySelector('[data-discard-box]');
    if (box) box.hidden = true;
    paintChest();
    render(performance.now() / 1000);
  });

  function setModalOpen() {
    const open = !chestModal.hidden || !tradeModal.hidden || !helpModal.hidden || !craftModal.hidden
      || !upgradeModal.hidden || !offerModal.hidden || !potionModal.hidden
      || (displayModal && !displayModal.hidden)
      || (fillModal && !fillModal.hidden)
      || (importModal && !importModal.hidden);
    document.body.classList.toggle('modal-open', open);
    if (open) closeMaterialsDrawer();
  }

  function hideInspect() {
    if (inspectPop) inspectPop.hidden = true;
    inspectTarget = null;
  }

  function hideFurnMenu() {
    furnMenu.hidden = true;
    furnTarget = null;
    hideInspect();
  }

  function showInspect(materialId, clientX, clientY, pose) {
    if (!inspectPop) return;
    furnMenu.hidden = true;
    furnTarget = null;
    const kind = pose?.kind === 'tree'
      ? 'tree'
      : pose?.kind === 'flax'
        ? 'flax'
        : pose?.kind === 'wheat'
          ? 'wheat'
          : pose?.kind === 'fishing_spot'
            ? 'fishing_spot'
            : 'boulder';
    inspectTarget = materialId
      ? { materialId, x: pose?.x, z: pose?.z, kind, plantId: pose?.plantId }
      : null;
    const info = kind === 'tree'
      ? treeInspect(materialId)
      : kind === 'flax'
        ? flaxInspect()
        : kind === 'wheat'
          ? wheatInspect()
          : kind === 'fishing_spot'
            ? fishingInspect(materialId)
            : boulderInspect(materialId);
    const nameEl = inspectPop.querySelector('[data-inspect-name]');
    const blurbEl = inspectPop.querySelector('[data-inspect-blurb]');
    const mineBtn = inspectPop.querySelector('[data-inspect-mine]');
    if (nameEl) nameEl.textContent = gatherInspectTitle(info.name, materialId);
    if (blurbEl) blurbEl.textContent = info.blurb;
    if (mineBtn) {
      mineBtn.textContent = kind === 'tree'
        ? 'Chop down'
        : kind === 'flax'
          ? 'Pick Flax'
          : kind === 'wheat'
            ? 'Pick Wheat'
            : kind === 'fishing_spot'
              ? 'Fish'
              : 'Mine';
    }
    const fillBtn = inspectPop.querySelector('[data-inspect-fill]');
    if (fillBtn) fillBtn.hidden = kind !== 'fishing_spot';
    inspectPop.hidden = false;
    const x = Math.min(window.innerWidth - 250, Math.max(8, clientX ?? 24));
    const y = Math.min(window.innerHeight - 180, Math.max(8, clientY ?? 80));
    inspectPop.style.left = `${x}px`;
    inspectPop.style.top = `${y}px`;
  }

  function closeMusicDock() {
    if (musicDock) musicDock.hidden = true;
  }

  function closeSettingsDock() {
    if (settingsDock) settingsDock.hidden = true;
  }

  function closeSkillsDock() {
    skillGuide?.close();
    skillsPanel?.close();
  }

  function closeHeroesDock() {
    heroesPanel?.close();
  }

  function openCraft(station = 'anvil', options = {}) {
    closeChest();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    closeSettingsDock();
    closeDisplayPicker();
    if (!helpModal.hidden) closeHelp();
    closeBuild();
    const recipe = options.focusId ? RECIPES[options.focusId] : null;
    craftStation = recipe ? stationForRecipe(recipe) : station;
    activePatchIndex = craftStation === 'farming_patch' ? (options.patchIndex ?? activePatchIndex) : null;
    craftFocusId = options.focusId ?? null;
    const ui = craftUiForStation(craftStation, { tab: craftTab, subtab: craftSubtab }, recipe);
    craftTab = ui.tab;
    craftSubtab = ui.subtab;
    potionModal.hidden = true;
    craftModal.hidden = false;
    const reason = craftFocusId ? craftBlockReason(state, craftFocusId) : '';
    setCraftNote(options.note || (options.autoStart ? reason : ''));
    revealCraftFocus = true;
    paintCrafts();
    setModalOpen();
    if (options.autoStart && craftFocusId && canCraft(state, craftFocusId)) {
      if (intentBus.run({ type: 'craft', recipeId: craftFocusId, count: 1 }) > 0) {
        playClick('craft');
        setCraftNote('');
        pushLog(state, `Crafting ${RECIPES[craftFocusId].name}…`);
      }
    } else if (options.autoStart && reason) {
      pushLog(state, reason);
    }
    render(performance.now() / 1000);
  }

  function closeCraft() {
    craftModal.hidden = true;
    craftFocusId = null;
    setCraftNote('');
    world.ignorePicks(280);
    setModalOpen();
  }

  function closeUpgrade() {
    upgradeModal.hidden = true;
    world.ignorePicks(280);
    setModalOpen();
  }

  function closePotion() {
    potionModal.hidden = true;
    world.ignorePicks(280);
    setModalOpen();
  }

  function openPotion(options = {}) {
    openCraft('cauldron', options);
  }

  function paintUpgrade() {
    const level = state.chestLevel ?? 1;
    const cap = chestSlots(level);
    upgradeModal.querySelector('[data-upgrade-now]').textContent = `Level ${level} · ${cap} slots · ${chestTotal(state)} stored.`;
    const nextEl = upgradeModal.querySelector('[data-upgrade-next]');
    const costEl = upgradeModal.querySelector('[data-upgrade-cost]');
    const buyBtn = upgradeModal.querySelector('[data-upgrade-buy]');
    if (level >= CHEST_MAX_LEVEL) {
      nextEl.textContent = 'The chest is at max level (1000 slots).';
      costEl.textContent = '';
      buyBtn.disabled = true;
      return;
    }
    const cost = chestUpgradeCost(level);
    nextEl.textContent = `Level ${level + 1} adds 100 slots (${chestSlots(level + 1)} total).`;
    costEl.textContent = `Cost: ${formatGold(cost)}g.`;
    buyBtn.disabled = !canUpgradeChest(state);
  }

  let storagePop = null;

  function closeStoragePop() {
    storagePop?.remove();
    storagePop = null;
  }

  function openStoragePop(anchor, materialId) {
    closeStoragePop();
    if (!anchor) return;
    const name = MATERIALS[materialId]?.name ?? 'Storage';
    const have = Math.max(0, Math.round(Number(state.materials?.[materialId]) || 0));
    const cap = storageCap(state);
    const pop = document.createElement('div');
    pop.className = 'sf-pop';
    pop.innerHTML = '<button type="button" class="ghost settings-x panel-x" data-storage-x aria-label="Close" title="Close">✕</button>'
      + `<p class="sf-pop-title"><b>${escCraft(name)}</b> <span>${formatGold(have)} / ${formatGold(cap)}</span></p>`
      + '<p>Storage is full. Upgrade the chest to hold more.</p>'
      + '<button type="button" class="sf-upgrade" data-storage-upgrade>Upgrade chest</button>'
      + '<p class="sf-pop-meta">250 per chest level, up to 2,500.</p>';
    pop.querySelector('[data-storage-x]').addEventListener('click', closeStoragePop);
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const width = pop.offsetWidth || 270;
    const height = pop.offsetHeight || 120;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2));
    const top = Math.max(8, rect.top - height - 12);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    const arrow = Math.min(width - 16, Math.max(16, rect.left + rect.width / 2 - left));
    pop.style.setProperty('--arrow-x', `${arrow}px`);
    storagePop = pop;
  }

  function openUpgrade() {
    closeStoragePop();
    closeChest();
    closeCraft();
    closeTrade();
    closePotion();
    closeDisplayPicker();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    paintUpgrade();
    upgradeModal.hidden = false;
    setModalOpen();
  }

  function openChest() {
    closeTrade();
    closeCraft();
    closePotion();
    closeDisplayPicker();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    paintChest();
    chestModal.hidden = false;
    world.setChestOpen(true);
    setModalOpen();
  }

  function closeChest() {
    chestModal.hidden = true;
    world.setChestOpen(false);
    world.ignorePicks(280);
    setModalOpen();
  }

  function paintChest() {
    const level = state.chestLevel ?? 1;
    const cap = chestCapacity(state);
    const n = chestTotal(state);
    if (chestCapEl) chestCapEl.textContent = `Level ${level} · ${n} / ${cap} slots`;
    const items = chestList(state);
    const discardBox = chestModal.querySelector('[data-discard-box]');
    if (discardBox && !pendingDiscardId) discardBox.hidden = true;
    if (!items.length) {
      chestItems.innerHTML = '<p class="empty">The chest is empty. Craft a ware and it will land here.</p>';
      return;
    }
    const standSelected = displayKind(state.selectedDisplay, state) === 'stand';
    chestItems.innerHTML = items.map(({ recipe, count }) => `
      <div class="chest-row">
        <div>
          <strong>${recipe.name}</strong>
          <span class="meta">×${count} · ${classLabel(recipe.combatClass, recipe.category)} · sells ${formatGold(recipe.price)}g</span>
        </div>
        <div class="chest-actions">
          ${standSelected && !isHandOrFootWare(recipe) ? `<button type="button" data-place="${recipe.id}">Place on Stand</button>` : ''}
          <button type="button" class="chest-bin" data-discard="${recipe.id}" title="Discard">🗑</button>
        </div>
      </div>
    `).join('');
  }

  function closeDisplayPicker() {
    if (!displayModal) return;
    const wasOpen = !displayModal.hidden;
    displayModal.hidden = true;
    selectedDisplayId = null;
    lastDisplayListKey = '';
    displayTarget = null;
    if (wasOpen) world.ignorePicks(280);
    setModalOpen();
  }

  function paintDisplayPicker() {
    if (!displayModal) return;
    const pickEl = displayModal.querySelector('[data-display-pick]');
    const slotEl = displayModal.querySelector('[data-display-slot]');
    const confirm = displayModal.querySelector('[data-display-confirm]');
    const slotGrid = displayModal.querySelector('[data-display-slots]');
    const index = displayTarget?.index ?? state.selectedDisplay;
    const kind = displayKind(index, state);
    const isShelf = kind === 'shelf';
    if (slotGrid) slotGrid.hidden = !isShelf;
    if (confirm) confirm.hidden = isShelf;
    if (isShelf) {
      slotEl.textContent = 'Pick a chest item, then a shelf slot. An occupied slot sends its ware back to the chest.';
    } else {
      slotEl.textContent = 'Placing on this table. The current item, if any, returns to the chest.';
    }
    const items = chestDisplayList(state, kind);
    if (!items.length) {
      lastDisplayListKey = 'empty';
      selectedDisplayId = null;
      const anyChest = chestList(state).length > 0;
      displayItems.innerHTML = anyChest
        ? '<p class="empty">Nothing in the chest can sit on this furniture. Runes and arrows go on tables and shelves.</p>'
        : '<p class="empty">The chest is empty. Craft a ware, then display it here.</p>';
      pickEl.textContent = anyChest ? 'No matching chest item for this furniture.' : 'No chest item to display.';
      if (confirm) confirm.disabled = true;
      paintShelfSlotButtons(index, false);
      return;
    }
    if (selectedDisplayId && !items.some((item) => item.recipeId === selectedDisplayId)) {
      selectedDisplayId = null;
    }
    const listKey = items.map((item) => `${item.recipeId}:${item.count}`).join('|');
    if (listKey !== lastDisplayListKey) {
      lastDisplayListKey = listKey;
      displayItems.innerHTML = items.map((item) => `
        <button type="button" class="offer-row${item.recipeId === selectedDisplayId ? ' is-on' : ''}" data-display-item="${item.recipeId}">
          <span>
            <strong>${item.recipe.name}</strong>
            <span class="meta">×${item.count} in chest</span>
          </span>
          <span class="offer-price">${formatGold(item.recipe.price)}g</span>
        </button>
      `).join('');
    } else {
      for (const btn of displayItems.querySelectorAll('[data-display-item]')) {
        btn.classList.toggle('is-on', btn.dataset.displayItem === selectedDisplayId);
      }
    }
    const selected = items.find((item) => item.recipeId === selectedDisplayId);
    if (selected) {
      pickEl.textContent = isShelf
        ? `Selected: ${selected.recipe.name}. Click Top Left, Top Right, Bottom Left, or Bottom Right.`
        : `Selected: ${selected.recipe.name}.`;
      if (confirm) confirm.disabled = false;
    } else {
      pickEl.textContent = isShelf
        ? 'No item selected yet. Click a chest item, then a shelf slot.'
        : 'No item selected yet. Click a chest item, then Place.';
      if (confirm) confirm.disabled = true;
    }
    paintShelfSlotButtons(index, Boolean(selectedDisplayId));
  }

  function paintShelfSlotButtons(index, canPlace) {
    const slotGrid = displayModal?.querySelector('[data-display-slots]');
    if (!slotGrid || slotGrid.hidden) return;
    const slots = state.displays[index]?.shelfSlots ?? [];
    for (const btn of slotGrid.querySelectorAll('[data-shelf-slot]')) {
      const slot = Number(btn.dataset.shelfSlot);
      const occ = btn.querySelector('[data-shelf-occ]');
      const occupying = slots[slot] ? RECIPES[slots[slot]] : null;
      if (occ) {
        occ.textContent = occupying
          ? (canPlace ? `Swap · ${occupying.name}` : occupying.name)
          : (canPlace ? 'Place here' : 'Empty');
      }
      btn.disabled = !canPlace;
    }
  }

  function selectDisplayItem(recipeId) {
    if (!recipeId || displayModal?.hidden) return false;
    if (!chestList(state).some((item) => item.recipeId === recipeId)) return false;
    selectedDisplayId = recipeId;
    paintDisplayPicker();
    return true;
  }

  function confirmDisplay(slotIndex = 0) {
    const recipeId = selectedDisplayId;
    const index = displayTarget?.index ?? state.selectedDisplay;
    if (!recipeId || !intentBus.run({ type: 'placeOnDisplay', recipeId, displayIndex: index, slotIndex })) {
      paintDisplayPicker();
      return false;
    }
    playClick('ui');
    const slotName = displayKind(index, state) === 'shelf' ? SHELF_SLOT_LABELS[slotIndex] : null;
    pushLog(state, slotName
      ? `Displayed ${RECIPES[recipeId].name} on ${slotName}.`
      : `Displayed ${RECIPES[recipeId].name}.`);
    world.syncDisplays();
    world.refreshSelection(true);
    closeDisplayPicker();
    render(performance.now() / 1000);
    return true;
  }

  function openDisplayPicker(target) {
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    if (!helpModal.hidden) closeHelp();
    displayTarget = target;
    state.selectedDisplay = target?.index ?? state.selectedDisplay;
    selectedDisplayId = null;
    lastDisplayListKey = '';
    paintDisplayPicker();
    displayModal.hidden = false;
    setModalOpen();
  }

  function closeOfferPicker() {
    offerModal.hidden = true;
    selectedOfferId = null;
    lastOfferListKey = '';
    if (tradeActor) tradeModal.hidden = false;
    setModalOpen();
  }

  function openTrade(actor) {
    if (!actor || actor.state === 'leave') return;
    closeChest();
    closeCraft();
    closeOfferPicker();
    closePotion();
    closeDisplayPicker();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    tradeActor = actor;
    world.setTrading(actor.id);
    paintTrade();
    tradeModal.hidden = false;
    setModalOpen();
  }

  function closeTrade() {
    tradeActor = null;
    closeOfferPicker();
    tradeModal.hidden = true;
    world.setTrading(null);
    world.ignorePicks(280);
    setModalOpen();
  }

  function paintTrade() {
    const actor = tradeActor;
    if (!actor) return;
    const recipe = RECIPES[actor.requestRecipeId];
    const have = hasStock(state, actor.requestRecipeId);
    const offer = actor.offer;
    const offerMat = offer ? MATERIALS[offer.materialId] : null;
    tradeModal.querySelector('[data-trade-title]').textContent = customerName(actor.typeId);
    tradeModal.querySelector('[data-trade-want]').textContent = `Wants ${recipe.name}.`;
    tradeModal.querySelector('[data-trade-offer]').textContent = `Offers ${formatGold(actor.offerGold)}g.`;
    const haveEl = tradeModal.querySelector('[data-trade-have]');
    haveEl.textContent = have
      ? `You have ${recipe.name} in the chest.`
      : `You do not have ${recipe.name} yet. Craft it, then sell.`;
    haveEl.classList.toggle('have', have);
    haveEl.classList.toggle('lack', !have);
    const buyLine = tradeModal.querySelector('[data-trade-buy]');
    if (offerMat) {
      buyLine.hidden = false;
      buyLine.textContent = `They will sell 1 ${offerMat.name} for ${formatGold(offer.price)}g.`;
    } else {
      buyLine.hidden = true;
    }
    const choices = offerChoices(state, actor.requestRecipeId);
    const offerLine = tradeModal.querySelector('[data-trade-offer-hint]');
    const offerBtn = tradeModal.querySelector('[data-trade-offer-btn]');
    if (choices.length) {
      offerLine.hidden = false;
      offerLine.textContent = `You can offer a matching ${offerClassLabel(offerClassOf(recipe))} chest item at a reduced price (${choices.length} available).`;
      offerBtn.disabled = false;
    } else {
      offerLine.hidden = false;
      offerLine.textContent = `No matching ${offerClassLabel(offerClassOf(recipe))} items to offer at a reduced price.`;
      offerBtn.disabled = true;
    }
    tradeModal.querySelector('[data-trade-sell]').disabled = !have;
    tradeModal.querySelector('[data-trade-buy-btn]').disabled = !offer || state.gold < offer.price;
    const craftNote = tradeModal.querySelector('[data-trade-craft-note]');
    if (craftNote && craftNote.dataset.sticky !== '1') craftNote.hidden = true;
  }

  function paintOfferPicker() {
    const actor = tradeActor;
    const pickEl = offerModal.querySelector('[data-offer-pick]');
    const confirm = offerModal.querySelector('[data-offer-confirm]');
    if (!actor) {
      lastOfferListKey = '';
      offerItems.innerHTML = '<p class="empty">No traveler is waiting.</p>';
      pickEl.textContent = 'No item selected yet.';
      confirm.disabled = true;
      return;
    }
    const choices = offerChoices(state, actor.requestRecipeId);
    const clsLabel = offerClassLabel(offerClassOf(RECIPES[actor.requestRecipeId]));
    if (!choices.length) {
      lastOfferListKey = 'empty';
      selectedOfferId = null;
      offerItems.innerHTML = `<p class="empty">No matching ${clsLabel} items.</p>`;
      pickEl.textContent = `No eligible ${clsLabel} chest item to offer.`;
      confirm.disabled = true;
      return;
    }
    if (selectedOfferId && !choices.some((choice) => choice.recipeId === selectedOfferId)) {
      selectedOfferId = null;
    }
    const listKey = choices.map((choice) => `${choice.recipeId}:${choice.count}:${choice.gold}`).join('|');
    if (listKey !== lastOfferListKey) {
      lastOfferListKey = listKey;
      offerItems.innerHTML = choices.map((choice) => `
        <button type="button" class="offer-row${choice.recipeId === selectedOfferId ? ' is-on' : ''}" data-offer-item="${choice.recipeId}">
          <span>
            <strong>${choice.name}</strong>
            <span class="meta">×${choice.count} in chest</span>
          </span>
          <span>
            <span class="offer-price">${formatGold(choice.gold)}g</span>
            <span class="offer-was">${formatGold(choice.listPrice)}g</span>
          </span>
        </button>
      `).join('');
    } else {
      for (const btn of offerItems.querySelectorAll('[data-offer-item]')) {
        btn.classList.toggle('is-on', btn.dataset.offerItem === selectedOfferId);
      }
    }
    const selected = choices.find((choice) => choice.recipeId === selectedOfferId);
    if (selected) {
      pickEl.textContent = `Selected: ${selected.name} for ${formatGold(selected.gold)}g (reduced from ${formatGold(selected.listPrice)}g).`;
      confirm.disabled = false;
    } else {
      pickEl.textContent = 'No item selected yet. Click a chest item, then Confirm.';
      confirm.disabled = true;
    }
  }

  function selectOfferItem(recipeId) {
    if (!recipeId || offerModal.hidden) return false;
    const actor = tradeActor;
    if (!actor || actor.state === 'leave') return false;
    const choices = offerChoices(state, actor.requestRecipeId);
    if (!choices.some((choice) => choice.recipeId === recipeId)) return false;
    selectedOfferId = recipeId;
    paintOfferPicker();
    return true;
  }

  function openOfferPicker() {
    const actor = tradeActor;
    if (!actor || actor.state === 'leave') {
      closeTrade();
      return;
    }
    selectedOfferId = null;
    lastOfferListKey = '';
    paintOfferPicker();
    tradeModal.hidden = true;
    offerModal.hidden = false;
    setModalOpen();
  }

  tradeModal.querySelector('[data-trade-sell]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (!actor) {
      closeTrade();
      return;
    }
    const recipeId = actor.requestRecipeId;
    const paid = intentBus.run({ type: 'sell', recipeId, gold: actor.offerGold, customerId: actor.id });
    if (!paid) {
      paintTrade();
      return;
    }
    playClick('trade');
    pushLog(state, `Sold ${RECIPES[recipeId].name} to ${customerName(actor.typeId)} for ${formatGold(paid)}g.`);
    world.sellToActor(actor);
    world.syncDisplays();
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-refuse]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (actor) {
      intentBus.run({ type: 'refuseCustomer', customerId: actor.id });
      pushLog(state, `You refuse ${customerName(actor.typeId)}.`);
      world.refuseActor(actor);
    }
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-buy-btn]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (!actor?.offer) return;
    if (intentBus.run({
      type: 'buyFromCustomer',
      materialId: actor.offer.materialId,
      price: actor.offer.price,
      customerId: actor.id,
    })) {
      playClick('trade');
      const mat = MATERIALS[actor.offer.materialId];
      pushLog(state, `Bought ${mat.name} from ${customerName(actor.typeId)} for ${formatGold(actor.offer.price)}g.`);
      world.buyFromActor(actor);
      closeTrade();
      render(performance.now() / 1000);
    }
  });

  tradeModal.querySelector('[data-trade-craft-btn]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (!actor || actor.state === 'leave') {
      closeTrade();
      return;
    }
    const recipe = RECIPES[actor.requestRecipeId];
    const craftNote = tradeModal.querySelector('[data-trade-craft-note]');
    if (recipe?.category === 'potion' && !ownsCauldron(state)) {
      const msg = 'Place a cauldron from Build to brew potions.';
      if (craftNote) {
        craftNote.hidden = false;
        craftNote.textContent = msg;
        craftNote.dataset.sticky = '1';
      }
      pushLog(state, msg);
      paintTrade();
      return;
    }
    if (craftNote) {
      craftNote.hidden = true;
      craftNote.dataset.sticky = '';
    }
    const already = Boolean(state.crafts[recipe.id]);
    openCraft(stationForRecipe(recipe), { focusId: recipe.id, autoStart: true });
    if (already || state.crafts[recipe.id]) {
      resumeTrade = { id: actor.id, recipeId: recipe.id };
    }
  });

  function onOfferClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const actor = tradeActor;
    if (!actor || actor.state === 'leave') {
      closeTrade();
      return;
    }
    const choices = offerChoices(state, actor.requestRecipeId);
    if (!choices.length) {
      paintTrade();
      return;
    }
    openOfferPicker();
  }
  tradeModal.querySelector('[data-trade-offer-btn]').addEventListener('click', onOfferClick);

  offerModal.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('[data-offer-item]');
    if (!btn || !offerModal.contains(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    selectOfferItem(btn.dataset.offerItem);
  });
  offerItems.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-offer-item]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    selectOfferItem(btn.dataset.offerItem);
  });

  offerModal.querySelector('[data-offer-cancel]').addEventListener('click', () => {
    closeOfferPicker();
    world.ignorePicks(280);
  });
  offerModal.querySelector('[data-offer-confirm]').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const actor = tradeActor;
    if (!actor || actor.state === 'leave') {
      closeTrade();
      return;
    }
    const choice = offerChoices(state, actor.requestRecipeId).find((item) => item.recipeId === selectedOfferId);
    if (!choice) {
      paintOfferPicker();
      return;
    }
    const wantClass = offerClassOf(RECIPES[actor.requestRecipeId]);
    if (offerClassOf(RECIPES[choice.recipeId]) !== wantClass) {
      selectedOfferId = null;
      paintOfferPicker();
      return;
    }
    const paid = intentBus.run({ type: 'sell', recipeId: choice.recipeId, gold: choice.gold, customerId: actor.id });
    if (!paid) {
      lastOfferListKey = '';
      paintOfferPicker();
      paintTrade();
      return;
    }
    playClick('trade');
    pushLog(state, `Offered ${RECIPES[choice.recipeId].name} to ${customerName(actor.typeId)} for ${formatGold(paid)}g (reduced from ${formatGold(choice.listPrice)}g).`);
    actor.requestRecipeId = choice.recipeId;
    world.sellToActor(actor);
    world.syncDisplays();
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-close]').addEventListener('click', closeTrade);

  displayModal?.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('[data-display-item]');
    if (!btn || !displayModal.contains(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    selectDisplayItem(btn.dataset.displayItem);
  });
  displayItems?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-display-item]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    selectDisplayItem(btn.dataset.displayItem);
  });
  displayModal?.querySelector('[data-display-cancel]')?.addEventListener('click', closeDisplayPicker);
  displayModal?.addEventListener('click', (event) => {
    if (event.target === displayModal) closeDisplayPicker();
  });
  displayModal?.querySelector('[data-display-confirm]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirmDisplay(0);
  });
  displayModal?.querySelector('[data-display-slots]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-shelf-slot]');
    if (!btn || btn.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    confirmDisplay(Number(btn.dataset.shelfSlot));
  });

  craftModal.querySelectorAll('[data-craft-close]').forEach((btn) => {
    btn.addEventListener('click', closeCraft);
  });
  craftModal.addEventListener('click', (event) => {
    if (event.target === craftModal) closeCraft();
  });

  function startMove(target) {
    if (!target) return;
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    closeSettingsDock();
    closeDisplayPicker();
    closeBuild();
    closePlace(true);
    if (target.id === 'farming_patch') {
      if (!world.beginMovePatch?.(target.index)) return;
      pendingPlace = { type: 'farming_patch', moving: true, index: target.index, cost: 0, note: '' };
      openPlaceDock();
      paintPlaceDock();
      render(performance.now() / 1000);
      return;
    }
    world.beginMoveFurniture(target);
    render(performance.now() / 1000);
  }

  function doRotate(target) {
    if (!target) return;
    world.rotateFurniture(target);
    render(performance.now() / 1000);
  }

  let fishPicker = null;
  const LAST_FISH_KEY = 'stallhaven.lastFish';
  function hideFishPicker() {
    if (fishPicker) fishPicker.hidden = true;
  }
  /** Pond click: every fish with its level; the pick walks over and keeps fishing it. */
  let fishPickerPoint = null;
  function showFishPicker(clientX, clientY, point = null) {
    fishPickerPoint = point && Number.isFinite(point.x) ? { x: point.x, z: point.z } : null;
    if (!fishPicker) {
      fishPicker = document.createElement('div');
      fishPicker.className = 'furn-menu fish-picker';
      fishPicker.setAttribute('role', 'menu');
      document.body.appendChild(fishPicker);
      fishPicker.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-fish-x]')) { hideFishPicker(); return; }
        if (ev.target.closest('[data-pond-fill]')) { hideFishPicker(); world.fillAtPond?.(fishPickerPoint); return; }
        const btn = ev.target.closest('[data-fish]');
        if (!btn || btn.disabled) return;
        try { localStorage.setItem(LAST_FISH_KEY, btn.dataset.fish); } catch { /* private mode */ }
        hideFishPicker();
        world.fishFor?.(btn.dataset.fish);
      });
      document.addEventListener('pointerdown', (ev) => {
        if (fishPicker && !fishPicker.hidden && !fishPicker.contains(ev.target)) hideFishPicker();
      }, true);
    }
    let last = null;
    try { last = localStorage.getItem(LAST_FISH_KEY); } catch { /* private mode */ }
    const level = skillLevelOf(state, 'fishing');
    fishPicker.innerHTML = `<button type="button" class="ghost settings-x panel-x" data-fish-x aria-label="Close" title="Close">✕</button><p>Fish for…</p><button type="button" data-pond-fill>🪣 Fill bucket</button>${FISHING_SPOTS.map((spot) => {
      const req = gatherLevelRequirement(spot.materialId);
      const need = req?.level ?? 1;
      const locked = level < need;
      const name = MATERIALS[spot.materialId]?.name ?? spot.name;
      return `<button type="button" data-fish="${spot.materialId}"${locked ? ' disabled' : ''}${spot.materialId === last ? ' class="is-last"' : ''}>${locked ? '🔒 ' : ''}${name} <small>Lv ${need}</small></button>`;
    }).join('')}`;
    fishPicker.hidden = false;
    const w = 200;
    fishPicker.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, clientX - w / 2))}px`;
    fishPicker.style.top = `${Math.max(8, Math.min(window.innerHeight - 280, clientY - 20))}px`;
  }

  function showFurnMenu(target, clientX, clientY) {
    furnTarget = target;
    const pieceRow = target.id === 'piece' ? constructionPiece(state.furniture?.placed?.[target.index]?.id) : null;
    furnMenu.querySelector('[data-furn-name]').textContent = (
      pieceRow ? pieceRow.name
      : target.id === 'chest' ? 'Chest'
        : target.id === 'anvil' ? 'Anvil'
          : target.id === 'range' ? 'Cooking Range'
            : target.id === 'cauldron' ? 'Cauldron'
              : target.id === 'furnace' ? 'Furnace'
                : target.id === 'wheel' ? 'Spinning Wheel'
                  : target.id === 'loom' ? 'Loom'
                  : target.id === 'fletch' ? 'Fletching Bench'
                  : target.id === 'potter' ? 'Potter Wheel'
                  : target.id === 'sawmill' ? 'Sawmill'
                  : target.id === 'portal' ? 'Portal'
                  : target.id === 'rug' ? 'Rug'
                  : target.id === 'counter' ? 'Counter'
                    : target.id === 'display' && displayKind(target.index, state) === 'stand' ? 'Mannequin'
                      : target.id === 'display' && displayKind(target.index, state) === 'shelf' ? 'Shelf'
                        : target.id === 'display' ? 'Table'
                        : target.id === 'farming_patch' ? 'Farming Patch'
                          : 'Display'
    );
    const useBtn = furnMenu.querySelector('[data-furn-use]');
    const upgradeBtn = furnMenu.querySelector('[data-furn-upgrade]');
    if (target.id === 'chest' || target.id === 'anvil' || target.id === 'range' || target.id === 'cauldron' || target.id === 'furnace' || target.id === 'wheel' || target.id === 'loom' || target.id === 'fletch' || target.id === 'potter' || target.id === 'sawmill' || target.id === 'portal' || target.id === 'farming_patch' || pieceRow?.id === 'bank_booth' || pieceRow?.id === 'lumbridge_fountain') {
      useBtn.hidden = false;
      useBtn.textContent = target.id === 'chest' ? 'Open Chest'
        : target.id === 'range' ? 'Cook'
          : target.id === 'cauldron' ? 'Potions'
            : target.id === 'furnace' ? 'Smelt'
              : target.id === 'wheel' ? 'Spin'
                : target.id === 'loom' ? 'Weave'
                  : target.id === 'fletch' ? 'Fletch'
                    : target.id === 'potter' ? 'Shape'
                      : target.id === 'sawmill' ? 'Saw'
                      : target.id === 'portal' ? 'Enter'
                      : target.id === 'farming_patch' ? 'Grow'
                      : pieceRow?.id === 'bank_booth' ? 'Bank'
                      : pieceRow?.id === 'lumbridge_fountain' ? 'Fill bucket'
                        : 'Craft';
    } else {
      useBtn.hidden = true;
    }
    const displayBtn = furnMenu.querySelector('[data-furn-display]');
    const fillBtn = furnMenu.querySelector('[data-furn-fill]');
    const canDisplay = target.id === 'display' && displayKind(target.index, state) !== 'stand';
    const canFill = target.id === 'display' && displayKind(target.index, state) === 'stand';
    if (displayBtn) displayBtn.hidden = !canDisplay;
    if (fillBtn) fillBtn.hidden = !canFill;
    if (upgradeBtn) upgradeBtn.hidden = target.id !== 'chest';
    const clearBtn = furnMenu.querySelector('[data-furn-clear]');
    const canClear = target.id === 'display'
      && (displayKind(target.index, state) === 'stand'
        || displayKind(target.index, state) === 'shelf'
        || displayKind(target.index, state) === 'table')
      && !state.displays[target.index]?.removed;
    if (clearBtn) clearBtn.hidden = !canClear;
    const deleteBtn = furnMenu.querySelector('[data-furn-delete]');
    const deleteKind = target.id === 'display' ? displayKind(target.index, state) : null;
    const canDelete = target.id === 'display'
      && (deleteKind === 'shelf' || deleteKind === 'table' || deleteKind === 'stand')
      && !state.displays[target.index]?.removed;
    if (deleteBtn) deleteBtn.hidden = !(canDelete || target.id === 'farming_patch' || pieceRow);
    const rotateBtn = furnMenu.querySelector('[data-furn-rotate]');
    if (rotateBtn) rotateBtn.hidden = target.id === 'farming_patch' || pieceRow?.mount === 'wall';
    const moveBtn = furnMenu.querySelector('[data-furn-move]');
    if (moveBtn) moveBtn.textContent = target.id === 'farming_patch' ? 'Move' : 'Move Furniture';
    furnMenu.hidden = false;
    const x = Math.min(window.innerWidth - 230, Math.max(8, clientX ?? 24));
    const y = Math.min(window.innerHeight - 220, Math.max(8, clientY ?? 80));
    furnMenu.style.left = `${x}px`;
    furnMenu.style.top = `${y}px`;
  }

  chestModal.querySelector('[data-chest-upgrade]')?.addEventListener('click', openUpgrade);

  potionModal.querySelectorAll('[data-potion-close]').forEach((btn) => {
    btn.addEventListener('click', closePotion);
  });
  potionModal.addEventListener('click', (event) => {
    if (event.target === potionModal) closePotion();
  });

  upgradeModal.querySelector('[data-upgrade-close]').addEventListener('click', closeUpgrade);
  upgradeModal.addEventListener('click', (event) => {
    if (event.target === upgradeModal) closeUpgrade();
  });
  upgradeModal.querySelector('[data-upgrade-buy]').addEventListener('click', () => {
    const level = state.chestLevel ?? 1;
    const cost = chestUpgradeCost(level);
    if (intentBus.run({ type: 'upgradeChest' })) {
      pushLog(state, `Chest upgraded to level ${state.chestLevel} (${chestSlots(state.chestLevel)} slots) for ${formatGold(cost)}g.`);
      paintUpgrade();
      paintChest();
      render(performance.now() / 1000);
    }
  });

  function paintExpand() {
    const cost = expansionCost((state.expansions ?? []).length);
    const owned = (state.expansions ?? []).length;
    expandModal.querySelector('[data-expand-cost]').textContent = owned >= 5
      ? 'Every expansion pad is in use.'
      : `Next room costs ${formatGold(cost)}g.`;
    const padId = world.getSelectedPad();
    const pickEl = expandModal.querySelector('[data-expand-pick]');
    const confirm = expandModal.querySelector('[data-expand-confirm]');
    if (owned >= 5) {
      pickEl.textContent = 'The shop already uses every expansion pad.';
      confirm.disabled = true;
      return;
    }
    if (!padId) {
      pickEl.textContent = 'Click a gold pad on the ground, then confirm.';
      confirm.disabled = true;
      return;
    }
    const pad = padById(padId);
    pickEl.textContent = `Selected: ${pad?.label ?? padId}.`;
    confirm.disabled = !canBuyExpansion(state, padId);
  }

  function closeExpand() {
    expandModal.hidden = true;
    world.setExpandMode(false);
    world.ignorePicks(280);
  }

  function openExpand() {
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    closeSettingsDock();
    if (!helpModal.hidden) closeHelp();
    closeBuild();
    closePlace(true);
    if ((state.expansions ?? []).length >= 5) {
      pushLog(state, 'The shop already uses every expansion pad.');
      render(performance.now() / 1000);
      return;
    }
    world.setExpandMode(true);
    paintExpand();
    expandModal.hidden = false;
  }

  function fadeShop(then) {
    shopFade.hidden = false;
    shopFade.classList.remove('is-on');
    void shopFade.offsetWidth;
    requestAnimationFrame(() => {
      shopFade.classList.add('is-on');
    });
    window.setTimeout(() => {
      then?.();
      requestAnimationFrame(() => shopFade.classList.remove('is-on'));
      window.setTimeout(() => {
        shopFade.hidden = true;
      }, 560);
    }, 720);
  }

  async function toggleFullscreen() {
    closeHeroesDock();
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      pushLog(state, 'Fullscreen is not available in this browser.');
    }
    syncFullscreenBtn();
    render(performance.now() / 1000);
  }

  function syncFullscreenBtn() {
    const on = Boolean(document.fullscreenElement);
    state.fullscreen = on;
    if (fullscreenBox) fullscreenBox.checked = on;
  }
  if (fullscreenRow && !shouldOfferFullscreen(fullscreenEnv())) {
    fullscreenRow.hidden = true;
  } else {
    document.addEventListener('fullscreenchange', syncFullscreenBtn);
    fullscreenBox?.addEventListener('change', () => {
      if (Boolean(document.fullscreenElement) === fullscreenBox.checked) return;
      toggleFullscreen();
    });
  }

  expandModal.querySelector('[data-expand-close]').addEventListener('click', closeExpand);
  expandModal.querySelector('[data-expand-confirm]').addEventListener('click', () => {
    const padId = world.getSelectedPad();
    if (!padId || !canBuyExpansion(state, padId)) {
      paintExpand();
      return;
    }
    const cost = expansionCost((state.expansions ?? []).length);
    fadeShop(() => {
      if (intentBus.run({ type: 'buyExpansion', padId })) {
        world.rebuildAfterExpansion();
        world.setExpandMode(false);
        pushLog(state, `Opened a new room (${padById(padId)?.label ?? padId}) for ${formatGold(cost)}g.`);
      }
      closeExpand();
      render(performance.now() / 1000);
    });
  });

  function paintBuild() {
    for (const button of buildModal.querySelectorAll('[data-build-tab]')) {
      button.classList.toggle('is-on', button.dataset.buildTab === buildTab);
    }
    for (const pane of buildModal.querySelectorAll('[data-build-pane]')) {
      pane.hidden = pane.dataset.buildPane !== buildTab;
    }
    const status = buildModal.querySelector('[data-cauldron-status]');
    const buyBtn = buildModal.querySelector('[data-cauldron-buy]');
    if (ownsCauldron(state)) {
      status.textContent = 'Placed in the shop. Click it to brew potions, or right-click to move.';
      buyBtn.disabled = true;
      buyBtn.textContent = 'Owned';
    } else {
      const needs = buildMaterialNeedLine(state, 'cauldron');
      status.textContent = [`Cost: ${formatGold(CAULDRON_COST)} gp`, needs].filter(Boolean).join('\n');
      buyBtn.disabled = !canBuyCauldron(state);
      buyBtn.textContent = `Buy · ${formatGold(CAULDRON_COST)} gp`;
    }
    for (const station of STATION_UNLOCKS) {
      const itemStatus = buildModal.querySelector(`[data-${station.id}-status]`);
      const itemBuy = buildModal.querySelector(`[data-${station.id}-buy]`);
      if (!itemStatus || !itemBuy) continue;
      if (ownsStation(state, station.id)) {
        itemStatus.hidden = false;
        itemStatus.textContent = `Placed in the shop. Click it to use, or right-click to move.`;
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = true;
        itemBuy.textContent = 'Owned';
      } else {
        const paid = station.cost > 0;
        const needs = paid ? buildMaterialNeedLine(state, station.id) : '';
        itemStatus.hidden = !paid;
        itemStatus.textContent = paid
          ? [`Cost: ${formatGold(station.cost)} gp`, needs].filter(Boolean).join('\n')
          : '';
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = !canBuyStation(state, station.id);
        itemBuy.textContent = paid
          ? `Buy · ${formatGold(station.cost)} gp`
          : 'Place · Free';
      }
    }
    const expandStatus = buildModal.querySelector('[data-expand-status]');
    const expandBuy = buildModal.querySelector('[data-expand-buy]');
    const owned = (state.expansions ?? []).length;
    if (expandStatus && expandBuy) {
      if (owned >= 5) {
        expandStatus.textContent = 'Every expansion pad is in use.';
        expandBuy.disabled = true;
        expandBuy.textContent = 'Owned';
      } else {
        const cost = expansionCost(owned);
        expandStatus.textContent = `Next room costs ${formatGold(cost)}g.`;
        expandBuy.disabled = state.gold < cost;
        expandBuy.textContent = `Place Room · ${formatGold(cost)}g`;
      }
    }
    for (const item of FURNITURE_SHOP) {
      const type = item.type;
      const itemStatus = buildModal.querySelector(`[data-${type}-status]`);
      const itemBuy = buildModal.querySelector(`[data-${type}-buy]`);
      if (!itemStatus || !itemBuy) continue;
      const cost = nextFurnitureCost(state, type);
      const label = furnitureLabelForType(type);
      const bought = state.boughtFurniture?.[type] ?? 0;
      if (type === 'farming_patch' && bought >= FARMING_PATCH_CAP) {
        itemStatus.textContent = 'You can own six farming patches.';
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = true;
        itemBuy.textContent = 'Owned';
        continue;
      }
      if (type === 'farming_patch') {
        const needs = cost > 0 ? buildMaterialNeedLine(state, type) : '';
        const costLine = cost === 0 ? 'Cost: Free' : `Cost: ${formatGold(cost)} gp`;
        itemStatus.textContent = ['You can own six farming patches.', costLine, needs].filter(Boolean).join('\n');
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = !canBuyFurniture(state, type);
        itemBuy.textContent = cost === 0 ? 'Place · Free' : `Buy · ${formatGold(cost)} gp`;
        continue;
      }
      const extra = type === 'shelf'
        ? (() => {
          const live = liveFurnitureCount(state, 'shelf');
          const included = includedFurnitureCount('shelf');
          if (live < included) {
            return `${live} of ${included} included shelves are placed. Replacement is free.`;
          }
          return bought === 0
            ? `No maximum. First ${included} shelves are included. The next costs ${formatGold(cost)}g.`
            : `No maximum. Next shelf costs ${formatGold(cost)}g (${bought} bought).`;
        })()
        : (() => {
          const free = state.freeFurnitureReplace?.[type] ?? 0;
          if (free > 0 || cost === 0) {
            return free > 0
              ? `${free} free replacement${free === 1 ? '' : 's'} left after deleting.`
              : `No maximum. First extra ${label.toLowerCase()} costs ${formatGold(cost)}g. Starting pieces do not count.`;
          }
          return bought === 0
            ? `No maximum. First extra ${label.toLowerCase()} costs ${formatGold(cost)}g. Starting pieces do not count.`
            : `No maximum. Next ${label.toLowerCase()} costs ${formatGold(cost)}g (${bought} bought).`;
        })();
      const needs = cost > 0 ? buildMaterialNeedLine(state, type) : '';
      const costLine = cost === 0 ? 'Cost: Free' : `Cost: ${formatGold(cost)} gp`;
      itemStatus.textContent = [extra, costLine, needs].filter(Boolean).join('\n');
      itemStatus.classList.remove('craft-note');
      itemBuy.disabled = !canBuyFurniture(state, type);
      itemBuy.textContent = cost === 0 ? 'Place · Free' : `Buy · ${formatGold(cost)} gp`;
    }
    paintConstructionCatalogue();
  }

  function materialName(id) {
    return MATERIALS[id]?.name ?? id;
  }

  function pieceNeedLine(row) {
    const gold = constructionBuildGold(row);
    const haveGold = Math.max(0, Math.floor(Number(state.gold) || 0));
    const goldPart = gold
      ? `<span class="is-${haveGold >= gold ? 'have' : 'missing'}">${formatGold(gold)} gp</span>`
      : '<span class="is-have">Free</span>';
    return [goldPart, ...Object.entries(row.materials).map(([id, need]) => {
      const have = Math.max(0, Math.floor(Number(state.materials?.[id]) || 0));
      const mark = have >= need ? 'have' : 'missing';
      return `<span class="is-${mark}">${materialName(id)} ${have}/${need}</span>`;
    })].join(' · ');
  }

  /** Long card blurbs are hidden by build-catalogue.css; show them as a hover tooltip instead. */
  function tooltipBuildBlurbs() {
    for (const article of buildModal.querySelectorAll('.build-item')) {
      if (article.title) continue;
      const blurb = article.querySelector(':scope > p:not(.meta):not(.build-detail)');
      if (blurb) article.title = blurb.textContent.trim();
    }
  }

  function paintConstructionCatalogue() {
    const root = buildModal.querySelector('[data-build-catalogue]');
    const side = buildModal.querySelector('[data-build-side]');
    const detail = buildModal.querySelector('[data-build-detail]');
    if (!root || !side) return;
    const categories = ['Shop', ...constructionCategories()];
    if (!categories.includes(buildCategory)) buildCategory = categories[0];
    tooltipBuildBlurbs();
    side.hidden = buildTab !== 'furniture';
    side.innerHTML = categories.map((name) => (
      `<button type="button" data-build-cat="${name}" class="${name === buildCategory ? 'is-on' : ''}">${name}</button>`
    )).join('');
    for (const article of buildModal.querySelectorAll('[data-shop-furniture]')) {
      article.hidden = buildTab !== 'furniture' || !shopFurnitureInCategory(article.dataset.shopFurniture, buildCategory);
    }
    if (buildCategory === 'Shop') {
      root.innerHTML = '';
      if (detail) detail.hidden = true;
      return;
    }
    const rows = constructionPiecesByLevel(buildCategory);
    root.innerHTML = rows.map((row) => {
      const blocked = constructionPlaceBlock(state, row.id);
      const level = state.skills?.getLevel?.('construction') ?? 1;
      const thumb = `${compassBase}thumbs/build/${(row.model ?? row.id).replace(/_/g, '-')}.png`;
      return `<article class="build-item" title="${row.name}. Level ${row.level} Construction.">
        <img class="build-thumb" src="${thumb}" alt="" loading="lazy">
        <h3>${row.name}</h3>
        <p class="meta">Level ${row.level} Construction${level < row.level ? ' · locked' : ''} · ${row.mount === 'wall' ? (row.wallFace === 'inside' ? 'Wall · inside' : row.wallFace === 'outside' ? 'Wall · outside' : 'Wall · inside or outside') : row.mount === 'outdoor' ? 'Indoor or outdoor' : 'Floor'}</p>
        <p class="build-detail">${pieceNeedLine(row)}</p>
        <button type="button" data-piece="${row.id}" ${blocked ? 'disabled' : ''}>Place</button>
      </article>`;
    }).join('');
    if (detail) detail.hidden = true;
  }

  function showPieceDetail(row) {
    const detail = buildModal.querySelector('[data-build-detail]');
    if (!detail || !row) return;
    const missing = missingMaterials(state, row);
    detail.hidden = false;
    const gold = constructionBuildGold(row);
    const short = gold > (Number(state.gold) || 0);
    detail.innerHTML = missing.length || short
      ? `Missing: ${[...(short ? [`Gold ${formatGold(Math.floor(Number(state.gold) || 0))}/${formatGold(gold)}`] : []), ...missing.map((item) => `${materialName(item.id)} ${item.have}/${item.need}`)].join(' · ')}`
      : `Have everything for ${row.name} (${formatGold(gold)} gp). Sell pays ${formatGold(Math.floor(row.gold / 2))} gp. Delete returns the materials and the build gold.`;
  }

  function paintPlaceDock() {
    if (!placeModal || !pendingPlace) return;
    const title = placeModal.querySelector('[data-place-title]');
    const blurb = placeModal.querySelector('[data-place-blurb]');
    const costEl = placeModal.querySelector('[data-place-cost]');
    const note = placeModal.querySelector('[data-place-note]');
    const label = pendingPlace.pieceId
      ? (constructionPiece(pendingPlace.pieceId)?.name ?? 'Furniture')
      : stationLabel(pendingPlace.type);
    const rotateBtn = placeModal.querySelector('[data-place-rotate]');
    const snapBtn = placeModal.querySelector('[data-place-snap]');
    const piecePlace = Boolean(pendingPlace.pieceId);
    if (rotateBtn) rotateBtn.hidden = !piecePlace;
    if (snapBtn) {
      snapBtn.hidden = !piecePlace;
      snapBtn.textContent = pieceSnap ? 'Snap on' : 'Snap off';
    }
    if (title) {
      title.textContent = pendingPlace.moving && pendingPlace.pieceId
        ? `Move ${label}`
        : pendingPlace.moving
          ? 'Move Farming Patch'
          : `Place ${label}`;
    }
    if (blurb) {
      blurb.textContent = pendingPlace.pieceId
        ? 'Move the ghost, rotate it, and snap it to the grid. Gold and materials are spent only when you confirm. Cancel spends nothing. Moving later is free.'
        : pendingPlace.moving
        ? 'Move the patch on open grass, clear of the path, buildings, and other patches. Nothing is spent. Cancel leaves the patch where it was.'
        : pendingPlace.type === 'farming_patch'
        ? 'Place the patch on open grass, clear of the path and flower beds. Gold is spent only when you confirm.'
        : pendingPlace.type === 'portal'
        ? 'Move it on the grass or the floor snap grid, then confirm. Gold is spent only when you confirm placement. Double-click a highlighted cell to confirm.'
        : STATION_UNLOCKS.some((item) => item.id === pendingPlace.type)
        ? 'Move it on the floor snap grid, then confirm. Gold is spent only when you confirm placement. Double-click a highlighted cell to confirm.'
        : pendingPlace.type === 'shelf'
          ? 'Move the shelf on the wall grid, then confirm. Gold is spent only when you confirm placement. Right-click to move or rotate it afterward.'
          : `Move the ${label.toLowerCase()} on the floor snap grid, then confirm. Gold is spent only when you confirm placement. Right-click to move or rotate it afterward.`;
    }
    if (costEl && pendingPlace.pieceId) {
      const row = constructionPiece(pendingPlace.pieceId);
      costEl.innerHTML = row ? pieceNeedLine(row) : '';
    } else if (costEl) {
      const needs = pendingPlace.cost > 0 ? buildMaterialNeedLine(state, pendingPlace.type) : '';
      const goldText = pendingPlace.cost > 0 ? `${formatGold(pendingPlace.cost)} gp` : 'Free';
      costEl.textContent = [`Cost: ${goldText}`, needs].filter(Boolean).join('\n');
    }
    if (note) {
      note.hidden = !pendingPlace.note;
      note.textContent = pendingPlace.note || '';
    }
  }

  function startFurniturePlace(type) {
    const cost = nextFurnitureCost(state, type);
    const need = furniturePlaceBlock(state, type);
    const status = buildModal.querySelector(`[data-${type}-status]`);
    if (!canBuyFurniture(state, type) || need) {
      if (status) {
        status.textContent = need || `Need ${formatGold(cost)}g. You have ${formatGold(state.gold)}g.`;
        status.classList.add('craft-note');
      }
      pushLog(state, status?.textContent ?? need);
      render(performance.now() / 1000);
      return;
    }
    pendingPlace = { type, cost, note: '' };
    if (type === 'farming_patch') world.beginPlacePatch();
    else world.beginPlaceFurniture(furnitureKindForType(type));
    openPlaceDock();
    paintPlaceDock();
    render(performance.now() / 1000);
  }

  function setBuildPressed(open) {
    buildBtn?.classList.toggle('is-on', open);
    buildBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeBuild() {
    if (!buildModal) return;
    buildModal.hidden = true;
    setBuildPressed(false);
  }

  function openBuild() {
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    closePotion();
    closeDisplayPicker();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    closeSettingsDock();
    if (!helpModal.hidden) closeHelp();
    closeExpand();
    closePlace(true);
    paintBuild();
    buildModal.hidden = false;
    setBuildPressed(true);
    if (matchMedia(TOUCH_HUD_QUERY).matches) setMaterialsOpen(false);
    fitBuildDock(buildModal);
  }
  if (buildModal) {
    onLayoutChange(() => { if (!buildModal.hidden) fitBuildDock(buildModal); });
    // Tab/category switches change content height: refit.
    buildModal.addEventListener('click', () => requestAnimationFrame(() => { if (!buildModal.hidden) fitBuildDock(buildModal); }));
  }

  function closePlace(cancelWorld = false) {
    if (!placeModal) return;
    placeModal.hidden = true;
    pendingPlace = null;
    if (cancelWorld && (world.isPlacingUnlock?.() || world.isMovingFurniture?.())) {
      world.cancelMoveFurniture();
    }
    world.ignorePicks(280);
  }

  function openPlaceDock() {
    closeBuild();
    placeModal.hidden = false;
  }

  function toggleBuild() {
    if (buildModal && !buildModal.hidden) {
      closeBuild();
      closePlace(true);
      return;
    }
    openBuild();
  }

  buildBtn?.addEventListener('click', toggleBuild);
  buildModal.querySelectorAll('[data-build-close]').forEach((button) => {
    button.addEventListener('click', closeBuild);
  });
  buildModal.querySelector('[data-expand-buy]')?.addEventListener('click', () => {
    closeBuild();
    openExpand();
  });
  function startStationPlace(id) {
    const cost = stationCost(id);
    const label = stationLabel(id).toLowerCase();
    const status = buildModal.querySelector(`[data-${id}-status]`);
    if (!canBuyStation(state, id)) {
      const msg = stationPlaceBlock(state, id) || (cost > 0
        ? `Need ${formatGold(cost)}g to buy a ${label}. You have ${formatGold(state.gold)}g.`
        : `A ${label} is already placed.`);
      if (status) {
        status.hidden = false;
        status.textContent = msg;
        status.classList.add('craft-note');
      }
      pushLog(state, msg);
      render(performance.now() / 1000);
      return;
    }
    pendingPlace = { type: id, cost, note: '' };
    world.beginPlaceUnlock(id);
    openPlaceDock();
    paintPlaceDock();
    render(performance.now() / 1000);
  }

  for (const station of STATION_UNLOCKS) {
    buildModal.querySelector(`[data-${station.id}-buy]`)?.addEventListener('click', () => {
      startStationPlace(station.id);
    });
  }
  buildModal.querySelector('[data-table-buy]')?.addEventListener('click', () => startFurniturePlace('table'));
  buildModal.querySelector('[data-mannequin-buy]')?.addEventListener('click', () => startFurniturePlace('mannequin'));
  buildModal.querySelector('[data-shelf-buy]')?.addEventListener('click', () => startFurniturePlace('shelf'));
  buildModal.querySelector('[data-farming_patch-buy]')?.addEventListener('click', () => startFurniturePlace('farming_patch'));
  function hostCannotBuild() {
    if (constructionHost) return false;
    pushLog(state, 'Only the host can build.');
    render(performance.now() / 1000);
    return true;
  }
  function startPiecePlace(pieceId) {
    if (hostCannotBuild()) return;
    const row = constructionPiece(pieceId);
    const block = constructionPlaceBlock(state, pieceId);
    showPieceDetail(row);
    if (block) {
      pushLog(state, block);
      render(performance.now() / 1000);
      return;
    }
    pendingPlace = { type: 'piece', pieceId, cost: 0, note: '', moving: false };
    world.beginPlacePiece?.(pieceId);
    world.setPieceSnap?.(pieceSnap);
    openPlaceDock();
    paintPlaceDock();
    render(performance.now() / 1000);
  }
  buildModal.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-build-tab]');
    if (tab) {
      buildTab = tab.dataset.buildTab;
      paintBuild();
      return;
    }
    const cat = event.target.closest('[data-build-cat]');
    if (cat) {
      buildCategory = cat.dataset.buildCat;
      paintConstructionCatalogue();
      return;
    }
    const pieceBtn = event.target.closest('[data-piece]');
    if (pieceBtn && !pieceBtn.disabled) startPiecePlace(pieceBtn.dataset.piece);
  });
  placeModal.querySelector('[data-place-rotate]')?.addEventListener('click', () => {
    world.rotateFurniture?.({
      id: 'piece',
      pieceId: pendingPlace?.pieceId,
      index: pendingPlace?.index ?? null,
    });
    render(performance.now() / 1000);
  });
  placeModal.querySelector('[data-place-snap]')?.addEventListener('click', () => {
    pieceSnap = !pieceSnap;
    world.setPieceSnap?.(pieceSnap);
    paintPlaceDock();
  });
  const placedBar = document.querySelector('#placed-bar');
  function closePlacedBar() {
    selectedPiece = null;
    if (placedBar) placedBar.hidden = true;
  }
  function openPlacedBar(index) {
    const row = state.furniture?.placed?.[index];
    const piece = row ? constructionPiece(row.id) : null;
    if (!piece || !placedBar) return;
    selectedPiece = index;
    placedBar.hidden = false;
    const name = placedBar.querySelector('[data-placed-name]');
    if (name) name.textContent = piece.name;
    const snap = placedBar.querySelector('[data-placed="snap"]');
    if (snap) snap.textContent = pieceSnap ? 'Snap on' : 'Snap off';
  }
  placedBar?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-placed]');
    if (!button) return;
    runPlacedAction(button.dataset.placed, button);
  });
  function runPlacedAction(action, button = null) {
    if (action === 'done') {
      closePlacedBar();
      return;
    }
    if (selectedPiece == null || hostCannotBuild()) return;
    const row = state.furniture?.placed?.[selectedPiece];
    const piece = row ? constructionPiece(row.id) : null;
    if (!row || !piece) {
      closePlacedBar();
      return;
    }
    if (action === 'snap') {
      pieceSnap = !pieceSnap;
      world.setPieceSnap?.(pieceSnap);
      if (button) button.textContent = pieceSnap ? 'Snap on' : 'Snap off';
      return;
    }
    if (action === 'rotate') {
      const rot = (row.rot ?? 0) + Math.PI / 2;
      if (intentBus.run({ type: 'movePiece', index: selectedPiece, pose: { x: row.x, z: row.z, rot } })) {
        world.refreshFurniture?.();
        pushLog(state, `Turned the ${piece.name}.`);
        render(performance.now() / 1000);
      }
      return;
    }
    if (action === 'move') {
      pendingPlace = { type: 'piece', pieceId: piece.id, index: selectedPiece, cost: 0, note: '', moving: true };
      world.beginMovePiece?.(selectedPiece);
      world.setPieceSnap?.(pieceSnap);
      closePlacedBar();
      openPlaceDock();
      paintPlaceDock();
      render(performance.now() / 1000);
      return;
    }
    if (action === 'pickup') {
      if (intentBus.run({ type: 'pickupPiece', index: selectedPiece })) {
        world.refreshFurniture?.();
        closePlacedBar();
        pushLog(state, `Picked up the ${piece.name}. Materials returned.`);
        render(performance.now() / 1000);
      }
      return;
    }
    if (action === 'sell') {
      const gold = intentBus.run({ type: 'sellPiece', index: selectedPiece });
      if (gold) {
        world.refreshFurniture?.();
        closePlacedBar();
        pushLog(state, `Sold the ${piece.name} for ${formatGold(gold)} gp.`);
        render(performance.now() / 1000);
      }
    }
  }
  /** Right-click menu on a placed Construction piece: Move, Rotate, Delete (pick up). */
  function runPieceMenu(target, action) {
    if (target?.id !== 'piece' || !state.furniture?.placed?.[target.index]) return false;
    selectedPiece = target.index;
    runPlacedAction(action);
    if (action !== 'move') closePlacedBar();
    return true;
  }
  function confirmPendingPlace() {
    if (!pendingPlace) return;
    const check = world.tryConfirmPlace?.() ?? { ok: Boolean(world.getPlacePose()), pose: world.getPlacePose() };
    if (!check?.ok) {
      pendingPlace.note = check?.reason ?? 'Cannot place there.';
      paintPlaceDock();
      pushLog(state, pendingPlace.note);
      render(performance.now() / 1000);
      return;
    }
    const pose = check.pose;
    const pending = pendingPlace;
    if (pending.pieceId) {
      const block = constructionPlaceBlock(state, pending.pieceId);
      if (!pending.moving && block) {
        pendingPlace.note = block;
        paintPlaceDock();
        pushLog(state, block);
        render(performance.now() / 1000);
        return;
      }
      const placed = pending.moving
        ? intentBus.run({ type: 'movePiece', index: pending.index, pose })
        : intentBus.run({ type: 'placePiece', pieceId: pending.pieceId, pose });
      if (!placed) {
        render(performance.now() / 1000);
        return;
      }
      world.confirmPlaceUnlock?.();
      world.refreshFurniture?.();
      closePlace();
      const name = constructionPiece(pending.pieceId)?.name ?? 'furniture';
      pushLog(state, pending.moving ? `Moved the ${name}.` : `Placed a ${name}.`);
      render(performance.now() / 1000);
      return;
    }
    if (pending.moving && pending.type === 'farming_patch') {
      if (!intentBus.run({ type: 'movePatch', index: pending.index, pose })) {
        render(performance.now() / 1000);
        return;
      }
      world.confirmPlaceUnlock();
      closePlace();
      pushLog(state, 'Moved the farming patch.');
      render(performance.now() / 1000);
      return;
    }
    if (STATION_UNLOCKS.some((item) => item.id === pending.type)) {
      const cost = stationCost(pending.type);
      const block = stationPlaceBlock(state, pending.type);
      if (block) {
        pendingPlace.note = block;
        paintPlaceDock();
        pushLog(state, pendingPlace.note);
        render(performance.now() / 1000);
        return;
      }
      if (!intentBus.run({ type: 'buyStation', stationId: pending.type, pose })) {
        render(performance.now() / 1000);
        return;
      }
      world.confirmPlaceUnlock();
      closePlace();
      const mats = cost > 0 ? buildMaterialLabel(pending.type) : '';
      const name = stationLabel(pending.type).toLowerCase();
      pushLog(state, cost > 0
        ? `Placed a ${name} for ${formatGold(cost)} gp${mats ? ` (${mats})` : ''}.`
        : `Placed a ${name}.`);
      render(performance.now() / 1000);
      return;
    }
    const cost = nextFurnitureCost(state, pending.type);
    const patchIndex = pending.type === 'farming_patch' ? (state.boughtFurniture?.farming_patch ?? 0) : 0;
    const mats = cost > 0 ? buildMaterialLabel(pending.type, patchIndex) : '';
    const need = furniturePlaceBlock(state, pending.type);
    if (need) {
      pendingPlace.note = need;
      paintPlaceDock();
      pushLog(state, need);
      render(performance.now() / 1000);
      return;
    }
    if (!intentBus.run({ type: 'buyFurniture', furnitureType: pending.type, pose })) {
      render(performance.now() / 1000);
      return;
    }
    world.confirmPlaceUnlock();
    world.syncDisplays();
    world.refreshSelection(true);
    closePlace();
    const label = furnitureLabelForType(pending.type);
    pushLog(state, cost > 0
      ? `Placed a ${label.toLowerCase()} for ${formatGold(cost)} gp${mats ? ` (${mats})` : ''}.`
      : `Placed a ${label.toLowerCase()}.`);
    render(performance.now() / 1000);
  }

  placeModal.querySelector('[data-place-cancel]').addEventListener('click', () => {
    closePlace(true);
    render(performance.now() / 1000);
  });
  placeModal.querySelector('[data-place-confirm]').addEventListener('click', () => {
    confirmPendingPlace();
  });

  inspectPop?.querySelector('[data-inspect-close]')?.addEventListener('click', hideInspect);
  inspectPop?.querySelector('[data-inspect-fill]')?.addEventListener('click', () => {
    const target = inspectTarget;
    hideInspect();
    world.fillAtPond?.(target && Number.isFinite(target.x) ? { x: target.x, z: target.z } : null);
  });
  inspectPop?.querySelector('[data-inspect-mine]')?.addEventListener('click', () => {
    const target = inspectTarget;
    hideInspect();
    if (target?.materialId) world.useBoulder?.(target);
  });
  inspectPop?.addEventListener('click', (event) => {
    if (event.target === inspectPop) hideInspect();
  });
  furnMenu.querySelector('[data-furn-close]').addEventListener('click', hideFurnMenu);
  furnMenu.querySelector('[data-furn-move]').addEventListener('click', () => {
    if (furnTarget?.id === 'piece') {
      const target = furnTarget;
      hideFurnMenu();
      runPieceMenu(target, 'move');
      return;
    }
    startMove(furnTarget);
  });
  furnMenu.querySelector('[data-furn-rotate]').addEventListener('click', () => {
    if (furnTarget?.id === 'piece') {
      const target = furnTarget;
      hideFurnMenu();
      runPieceMenu(target, 'rotate');
      return;
    }
    doRotate(furnTarget);
  });
  furnMenu.querySelector('[data-furn-upgrade]')?.addEventListener('click', () => {
    hideFurnMenu();
    openUpgrade();
  });
  furnMenu.querySelector('[data-furn-display]')?.addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'display') openDisplayPicker(target);
  });
  furnMenu.querySelector('[data-furn-fill]')?.addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'display') openFillPicker(target);
  });
  furnMenu.querySelector('[data-furn-clear]')?.addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id !== 'display') return;
    if (!intentBus.run({ type: 'clearDisplay', index: target.index })) return;
    playClick('ui');
    const kind = displayKind(target.index, state);
    pushLog(state, kind === 'stand'
      ? 'Cleared the mannequin.'
      : 'Cleared the display. Wares went back to the chest.');
    world.syncDisplays();
    render(performance.now() / 1000);
  });
  furnMenu.querySelector('[data-furn-delete]')?.addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'piece') {
      runPieceMenu(target, 'pickup');
      return;
    }
    if (target?.id === 'farming_patch') {
      const patch = state.furniture?.patches?.[target.index];
      if (!patch) return;
      const growing = patch.crop ? ' Anything growing is lost.' : '';
      const pay = patch.paid === false
        ? ' This free patch can be placed again at no cost.'
        : ' Gold, nails, and planks are refunded.';
      if (!window.confirm(`Delete this farming patch?${growing}${pay}`)) return;
      const before = state.gold;
      if (!intentBus.run({ type: 'removePatch', index: target.index })) return;
      playClick('ui');
      const refunded = state.gold - before;
      pushLog(state, patch.paid === false
        ? 'Removed the farming patch. It can be placed again for free.'
        : `Removed the farming patch. Refunded ${formatGold(refunded)} gp plus the nails and planks.`);
      world.refreshFurniture?.();
      paintBuild();
      render(performance.now() / 1000);
      return;
    }
    if (target?.id !== 'display') return;
    if (!intentBus.run({ type: 'removeFurniture', index: target.index })) return;
    playClick('ui');
    const removedKind = displayKind(target.index, state);
    const removedLabel = removedKind === 'shelf' ? 'wall shelf'
      : removedKind === 'stand' ? 'mannequin'
        : 'table';
    pushLog(state, `Removed the ${removedLabel}.`);
    world.refreshFurniture?.();
    world.refreshSelection?.(true);
    paintBuild();
    render(performance.now() / 1000);
  });
  furnMenu.querySelector('[data-furn-use]').addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'piece' && state.furniture?.placed?.[target.index]?.id === 'lumbridge_fountain') { world.fillAtFountainPiece?.(target.index); return; }
    if (target?.id === 'chest' || (target?.id === 'piece' && state.furniture?.placed?.[target.index]?.id === 'bank_booth')) openChest();
    if (target?.id === 'anvil') openCraft('anvil');
    if (target?.id === 'range') openCraft('range');
    if (target?.id === 'farming_patch') openCraft('farming_patch', { patchIndex: target.index });
    if (target?.id === 'cauldron') openCraft('cauldron');
    if (target?.id === 'furnace') openCraft('furnace');
    if (target?.id === 'wheel') openCraft('wheel');
    if (target?.id === 'loom') openCraft('loom');
    if (target?.id === 'fletch') openCraft('fletch');
    if (target?.id === 'potter') openCraft('potter');
    if (target?.id === 'sawmill') openCraft('sawmill');
    if (target?.id === 'portal') world.useFixture?.('portal');
  });

  function closeFillPicker() {
    if (!fillModal) return;
    const wasOpen = !fillModal.hidden;
    fillModal.hidden = true;
    selectedFillId = null;
    fillTarget = null;
    if (wasOpen) world.ignorePicks(280);
    setModalOpen();
  }

  function paintFillPicker() {
    if (!fillModal || !fillItems) return;
    const pickEl = fillModal.querySelector('[data-fill-pick]');
    const assignBtn = fillModal.querySelector('[data-fill-assign]');
    const setBtn = fillModal.querySelector('[data-fill-set]');
    for (const btn of fillModal.querySelectorAll('[data-fill-class]')) {
      btn.classList.toggle('is-on', btn.dataset.fillClass === fillClass);
    }
    const combat = fillClass === 'ranged' ? 'range' : fillClass;
    const items = chestList(state).filter((item) => (
      item.recipe?.category === 'armour'
      && item.recipe.combatClass === combat
      && !isHandOrFootWare(item.recipe)
    ));
    if (!items.length) {
      selectedFillId = null;
      fillItems.innerHTML = `<p class="empty">No matching ${offerClassLabel(fillClass)} armour in the chest.</p>`;
    } else {
      if (selectedFillId && !items.some((item) => item.recipeId === selectedFillId)) selectedFillId = null;
      fillItems.innerHTML = items.map((item) => `
        <button type="button" class="offer-row${item.recipeId === selectedFillId ? ' is-on' : ''}" data-fill-item="${item.recipeId}">
          <span>
            <strong>${item.recipe.name}</strong>
            <span class="meta">×${item.count} · ${item.recipe.slot}</span>
          </span>
        </button>
      `).join('');
    }
    const selected = items.find((item) => item.recipeId === selectedFillId);
    if (pickEl) {
      pickEl.textContent = selected
        ? `Selected: ${selected.recipe.name}. Assign that slot, or fill the matching set.`
        : 'No piece selected yet.';
    }
    if (assignBtn) assignBtn.disabled = !selected;
    if (setBtn) setBtn.disabled = !selected;
  }

  function openFillPicker(target) {
    closeChest();
    closeCraft();
    closeTrade();
    closeDisplayPicker();
    hideFurnMenu();
    fillTarget = target;
    selectedFillId = null;
    fillClass = 'melee';
    state.selectedDisplay = target?.index ?? state.selectedDisplay;
    paintFillPicker();
    if (fillModal) fillModal.hidden = false;
    setModalOpen();
  }

  fillModal?.querySelectorAll('[data-fill-class]').forEach((btn) => {
    btn.addEventListener('click', () => {
      fillClass = btn.dataset.fillClass;
      selectedFillId = null;
      paintFillPicker();
    });
  });
  fillItems?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-fill-item]');
    if (!btn) return;
    selectedFillId = btn.dataset.fillItem;
    paintFillPicker();
  });
  fillModal?.querySelector('[data-fill-cancel]')?.addEventListener('click', closeFillPicker);
  fillModal?.addEventListener('click', (event) => {
    if (event.target === fillModal) closeFillPicker();
  });
  fillModal?.querySelector('[data-fill-assign]')?.addEventListener('click', () => {
    const index = fillTarget?.index ?? state.selectedDisplay;
    if (!selectedFillId || !intentBus.run({ type: 'assignStand', index, recipeId: selectedFillId })) {
      paintFillPicker();
      return;
    }
    playClick('ui');
    pushLog(state, `Placed ${RECIPES[selectedFillId].name} on the mannequin.`);
    world.syncDisplays();
    world.refreshSelection(true);
    closeFillPicker();
    render(performance.now() / 1000);
  });
  fillModal?.querySelector('[data-fill-set]')?.addEventListener('click', () => {
    const index = fillTarget?.index ?? state.selectedDisplay;
    if (!selectedFillId || !intentBus.run({ type: 'fillStand', index, recipeId: selectedFillId })) {
      paintFillPicker();
      return;
    }
    playClick('ui');
    pushLog(state, `Filled the mannequin with a matching ${RECIPES[selectedFillId].name} set.`);
    world.syncDisplays();
    world.refreshSelection(true);
    closeFillPicker();
    render(performance.now() / 1000);
  });

  function paintMusic() {
    if (!musicDock) return;
    const nameEl = musicDock.querySelector('[data-music-name]');
    const vol = musicDock.querySelector('[data-music-volume]');
    const note = musicDock.querySelector('[data-music-note]');
    const list = musicDock.querySelector('[data-playlist]');
    const tracks = getPlaylist();
    const track = getMusicTrackName();
    const shuffleBtn = musicDock.querySelector('[data-music-shuffle]');
    const loopBtn = musicDock.querySelector('[data-music-loop]');
    if (nameEl) {
      nameEl.textContent = track
        ? `${isMusicPlaying() ? 'Playing' : 'Paused'}: ${track}`
        : 'No track loaded. Upload MP3, WAV, or OGG files.';
    }
    if (shuffleBtn) shuffleBtn.classList.toggle('is-on', isShuffle());
    if (loopBtn) {
      const on = isLooping();
      loopBtn.classList.toggle('is-on', on);
      loopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (vol) vol.value = String(Math.round((state.music?.volume ?? getMusicVolume()) * 100));
    if (list) {
      if (!tracks.length) {
        list.innerHTML = '<p class="empty">Playlist is empty.</p>';
      } else {
        list.innerHTML = tracks.map((item) => `
          <div class="playlist-row${item.current ? ' is-on' : ''}">
            <button type="button" class="ghost playlist-name" data-play-track="${item.index}">${item.name}</button>
            <button type="button" data-move-up="${item.index}" ${item.index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-move-down="${item.index}" ${item.index === tracks.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" data-remove-track="${item.index}">✕</button>
          </div>
        `).join('');
      }
    }
    if (note && note.dataset.sticky !== '1') note.hidden = true;
  }

  function showMusicNote(text) {
    const note = musicDock?.querySelector('[data-music-note]');
    if (!note) return;
    note.hidden = !text;
    note.textContent = text || '';
    note.dataset.sticky = text ? '1' : '';
  }

  function setMusicTab(tab) {
    musicDock?.querySelectorAll('[data-music-tab]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.dataset.musicTab === tab);
    });
    const playPane = musicDock?.querySelector('[data-music-pane="play"]');
    const listPane = musicDock?.querySelector('[data-music-pane="playlist"]');
    if (playPane) playPane.hidden = tab !== 'play';
    if (listPane) listPane.hidden = tab !== 'playlist';
  }

  function openMusic() {
    closeSkillsDock();
    closeHeroesDock();
    closeBuild();
    closeExpand();
    closeSettingsDock();
    hideFurnMenu();
    showMusicNote('');
    setMusicTab('play');
    paintMusic();
    if (musicDock) musicDock.hidden = false;
  }

  function persistMusic() {
    if (!state.music) state.music = { volume: DEFAULT_MUSIC_VOLUME, loop: false, track: '' };
    state.music.volume = getMusicVolume();
    state.music.loop = isLooping();
    state.music.track = getMusicTrackName() || state.music.track || '';
  }

  musicBtn?.addEventListener('click', () => {
    if (musicDock?.hidden === false) closeMusicDock();
    else openMusic();
  });
  musicDock?.querySelector('[data-music-close]')?.addEventListener('click', closeMusicDock);
  musicDock?.querySelectorAll('[data-music-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMusicTab(btn.dataset.musicTab);
      paintMusic();
    });
  });
  musicDock?.querySelector('[data-music-upload]')?.addEventListener('click', () => musicFile?.click());
  musicFile?.addEventListener('change', async () => {
    const files = [...(musicFile.files ?? [])];
    musicFile.value = '';
    if (!files.length) return;
    try {
      const { added, rejected } = await addMusicFiles(files);
      if (added.length) {
        pushLog(state, added.length === 1
          ? `Added ${added[0]} to the playlist.`
          : `Added ${added.length} tracks to the playlist.`);
        showMusicNote('');
      }
      if (rejected.length) {
        const msg = rejected[0];
        showMusicNote(msg);
        pushLog(state, msg);
      }
    } catch {
      const msg = 'Could not play that audio file.';
      showMusicNote(msg);
      pushLog(state, msg);
    }
    paintMusic();
    render(performance.now() / 1000);
  });
  musicDock?.querySelector('[data-music-play]')?.addEventListener('click', async () => {
    if (!getPlaylist().length) {
      musicFile?.click();
      return;
    }
    await playMusic();
    persistMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-pause]')?.addEventListener('click', () => {
    pauseMusic();
    persistMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-shuffle]')?.addEventListener('click', () => {
    toggleShuffle();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-loop]')?.addEventListener('click', () => {
    toggleLoop();
    persistMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-stop]')?.addEventListener('click', () => {
    stopMusic();
    persistMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-skip]')?.addEventListener('click', async () => {
    await skipTrack();
    persistMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-volume]')?.addEventListener('input', (event) => {
    const volume = Number(event.target.value) / 100;
    setMusicVolume(volume);
    if (!state.music) state.music = { volume: DEFAULT_MUSIC_VOLUME, loop: false, track: '' };
    state.music.volume = volume;
    persistMusic();
  });
  musicDock?.querySelector('[data-playlist]')?.addEventListener('click', async (event) => {
    const playBtn = event.target.closest('[data-play-track]');
    const up = event.target.closest('[data-move-up]');
    const down = event.target.closest('[data-move-down]');
    const remove = event.target.closest('[data-remove-track]');
    if (playBtn) await playTrackAt(Number(playBtn.dataset.playTrack));
    if (up) movePlaylistTrack(Number(up.dataset.moveUp), Number(up.dataset.moveUp) - 1);
    if (down) movePlaylistTrack(Number(down.dataset.moveDown), Number(down.dataset.moveDown) + 1);
    if (remove) removePlaylistTrack(Number(remove.dataset.removeTrack));
    persistMusic();
    paintMusic();
  });
  setMusicVolume(state.music?.volume ?? DEFAULT_MUSIC_VOLUME);
  setLoop(Boolean(state.music?.loop));

  const PLAYER_MODEL_ID = 'player-look';

  function playerNote(text) {
    const note = settingsDock?.querySelector('[data-player-model-note]');
    if (!note) return;
    note.textContent = text || '';
    note.hidden = !text;
  }

  function paintPlayerModel() {
    if (!settingsDock) return;
    const custom = Boolean(world.hasCustomPlayer?.());
    const yaw = Boolean(world.playerYaw180?.());
    const hint = world.playerOrientationHint?.();
    const yawBtn = settingsDock.querySelector('[data-player-model-yaw]');
    const hintEl = settingsDock.querySelector('[data-player-model-hint]');
    if (yawBtn) {
      yawBtn.hidden = !custom;
      yawBtn.setAttribute('aria-pressed', yaw ? 'true' : 'false');
      yawBtn.classList.toggle('is-on', yaw);
    }
    if (hintEl) hintEl.hidden = !(custom && hint?.suggestRotate);
  }

  function paintSettings() {
    if (!settingsDock) return;
    const current = state.skybox ?? 'blue';
    for (const btn of settingsDock.querySelectorAll('[data-skybox]')) {
      btn.classList.toggle('is-on', btn.dataset.skybox === current);
    }
    paintBrightness();
    paintPhotoMode();
    paintPlayerModel();
  }

  function openSettings() {
    closeBuild();
    closeExpand();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    hideFurnMenu();
    paintSettings();
    if (settingsDock) settingsDock.hidden = false;
  }

  async function rememberPlayerYaw(yaw180) {
    const records = await loadModels();
    const player = records.find((record) => record.id === PLAYER_MODEL_ID || record.kind === 'player');
    if (!player) return;
    player.id = PLAYER_MODEL_ID;
    player.kind = 'player';
    player.yaw180 = Boolean(yaw180);
    await saveModel(player);
  }

  async function receivePlayerModel(file) {
    const problem = validatePlayerModelFile(file);
    if (problem) {
      playerNote(problem);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const scene = await parseModelBuffer(buffer.slice(0), file.name);
      const result = world.setPlayerLook(scene, { yaw180: false, name: file.name });
      if (!result?.ok) {
        playerNote(result?.reason || 'Could not use that model. The current model is unchanged.');
        return;
      }
      try {
        await saveModel({
          id: PLAYER_MODEL_ID,
          name: file.name,
          kind: 'player',
          buffer,
          sidecars: {},
          yaw180: false,
        });
        playerNote(`Using ${file.name}.`);
      } catch {
        playerNote(`${file.name} is on for this visit, but it could not be saved in this browser.`);
      }
      paintPlayerModel();
      render(performance.now() / 1000);
    } catch {
      playerNote('Could not read that model. The current model is unchanged.');
    }
  }

  settingsBtn?.addEventListener('click', () => {
    if (settingsDock?.hidden === false) closeSettingsDock();
    else openSettings();
  });
  settingsDock?.querySelector('[data-settings-close]')?.addEventListener('click', closeSettingsDock);
  settingsDock?.querySelector('[data-settings-x]')?.addEventListener('click', closeSettingsDock);
  if (settingsDock) {
    // Roomy Settings: wide panel, fixed header, scrolling body capped between HUD and button bar.
    const fitSettings = () => fitScrollDock(settingsDock, { width: 560 });
    new MutationObserver(() => { if (!settingsDock.hidden) fitSettings(); }).observe(settingsDock, { attributes: true, attributeFilter: ['hidden'] });
    onLayoutChange(() => { if (!settingsDock.hidden) fitSettings(); });
    fitSettings();
  }
  settingsDock?.querySelector('[data-settings-unstuck]')?.addEventListener('click', () => {
    if (world.unstuck?.()) {
      pushLog(state, 'You shake yourself free.');
      closeSettingsDock();
      render(performance.now() / 1000);
    }
  });
  const playerFile = settingsDock?.querySelector('[data-player-model-file]');
  settingsDock?.querySelector('[data-player-model-upload]')?.addEventListener('click', () => playerFile?.click());
  playerFile?.addEventListener('change', () => {
    const file = playerFile.files?.[0];
    playerFile.value = '';
    if (file) receivePlayerModel(file);
  });
  settingsDock?.querySelector('[data-player-model-reset]')?.addEventListener('click', async () => {
    try {
      await deleteModel(PLAYER_MODEL_ID);
    } catch {
      // Still restore the rigged adventurer if the browser store is unavailable.
    }
    const result = world.setPlayerLook(null);
    if (!result?.ok) {
      playerNote(result?.reason || 'Could not restore the default adventurer.');
      return;
    }
    playerNote('Default adventurer restored.');
    paintPlayerModel();
    render(performance.now() / 1000);
  });
  settingsDock?.querySelector('[data-player-model-yaw]')?.addEventListener('click', async () => {
    const next = !world.playerYaw180?.();
    const result = world.setPlayerYaw180?.(next);
    if (!result?.ok) {
      playerNote(result?.reason || 'Could not turn that model. The current model is unchanged.');
      return;
    }
    try {
      await rememberPlayerYaw(next);
    } catch {
      playerNote('The turn is on for this visit, but it could not be saved in this browser.');
    }
    paintPlayerModel();
    render(performance.now() / 1000);
  });
  paintPlayerModel();
  settingsDock?.querySelector('[data-skybox-list]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-skybox]');
    if (!btn) return;
    const id = SKYBOXES.some((item) => item.id === btn.dataset.skybox) ? btn.dataset.skybox : 'blue';
    world.setSkybox(id);
    paintSettings();
  });

  function paintBrightness() {
    const slider = settingsDock?.querySelector('[data-brightness]');
    const label = settingsDock?.querySelector('[data-brightness-label]');
    const pct = brightnessPercent(state.brightness ?? DEFAULT_BRIGHTNESS);
    if (slider) {
      slider.value = String(pct);
      slider.setAttribute('aria-valuenow', String(pct));
    }
    if (label) label.textContent = `${pct}%`;
    const dungeonSlider = settingsDock?.querySelector('[data-dungeon-brightness]');
    const dungeonLabel = settingsDock?.querySelector('[data-dungeon-brightness-label]');
    const dungeonPct = dungeonBrightnessPercent(state.dungeonBrightness ?? DEFAULT_DUNGEON_BRIGHTNESS);
    if (dungeonSlider) {
      dungeonSlider.value = String(dungeonPct);
      dungeonSlider.setAttribute('aria-valuenow', String(dungeonPct));
    }
    if (dungeonLabel) dungeonLabel.textContent = `${dungeonPct}%`;
  }

  function applyBrightnessFromSlider(raw) {
    const next = clampBrightness(Number(raw) / 100);
    state.brightness = next;
    writeStoredBrightness(next);
    world.setBrightness?.(next);
    paintBrightness();
  }

  function applyDungeonBrightnessFromSlider(raw) {
    const next = clampDungeonBrightness(Number(raw) / 100);
    state.dungeonBrightness = next;
    writeStoredDungeonBrightness(next);
    world.setDungeonBrightness?.(next);
    paintBrightness();
  }

  settingsDock?.querySelector('[data-brightness]')?.addEventListener('input', (event) => {
    applyBrightnessFromSlider(event.target.value);
  });
  settingsDock?.querySelector('[data-dungeon-brightness]')?.addEventListener('input', (event) => {
    applyDungeonBrightnessFromSlider(event.target.value);
  });

  function paintPhotoMode() {
    const box = settingsDock?.querySelector('[data-photo-mode]');
    if (box) box.checked = Boolean(state.photoMode);
  }

  settingsDock?.querySelector('[data-photo-mode]')?.addEventListener('change', (event) => {
    const on = Boolean(event.target.checked);
    state.photoMode = on;
    writeStoredPhotoMode(on);
    world.setPhotoMode?.(on);
    render(performance.now() / 1000);
  });
  settingsDock?.querySelector('[data-cheat-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = settingsDock.querySelector('[data-cheat-code]');
    const note = settingsDock.querySelector('[data-cheat-note]');
    const result = intentBus.run({ type: 'cheat', code: String(input?.value ?? '') });
    if (input) input.value = '';
    if (!result) {
      if (note) {
        note.hidden = false;
        note.textContent = intentBus.coop ? 'Cheats are off in co-op.' : 'Unknown code.';
      }
      return;
    }
    if (result === 'freshstart' || result === 'noob') {
      world.applyLayout();
      world.syncDisplays();
      world.refreshSelection(true);
      paintCrafts();
      paintBuild();
    } else if (result === 'onesmallfavour') {
      world.setChefHat(true);
    } else if (result === 'maxcape' || result === 'maxresource') {
      paintCrafts();
      paintBuild();
    }
    const messages = {
      motherlode: 'Motherlode: +1,000,000 gp.',
      '-motherlode': state.gold <= 0
        ? '−Motherlode: −10,000 gp (clamped at 0).'
        : '−Motherlode: −10,000 gp.',
      noob: 'Noob: unlocks and money are back to a new shop.',
      freshstart: 'Fresh start. All progress reset.',
      maxcape: 'Maxcape: every craft line is unlocked.',
      onesmallfavour: 'A chef hat sits on your head.',
      maxresource: 'Maxresource: every material is filled to your storage cap.',
    };
    if (note) {
      note.hidden = false;
      note.textContent = messages[result] ?? 'Done.';
    }
    pushLog(state, messages[result] ?? 'Cheat applied.');
    render(performance.now() / 1000);
  });

  const hiddenCraft = (id) => isCraftHidden(RECIPES[id]);
  skillsPanel = bindSkillsPanel({
    skills,
    nextUnlock: (skillId, level) => nextUnlockLabel(skillId, level, hiddenCraft),
    onSkillClick: (id) => skillGuide?.open(id),
    onClose: () => skillGuide?.close(),
    onOpen: () => {
      closeBuild();
      closeExpand();
      closeMusicDock();
      closeHeroesDock();
      closeSettingsDock();
      hideFurnMenu();
    },
  });
  skillGuide = bindSkillGuide({ skills, panel: skillsPanel });
  createXpOrb({ skills, host: document.body });
  heroesPanel = bindHeroesPanel({
    state,
    offerFullscreen: shouldOfferFullscreen(fullscreenEnv()),
    onFullscreen: () => toggleFullscreen(),
    onOpen: () => {
      closeBuild();
      closeExpand();
      closeMusicDock();
      closeSkillsDock();
      closeSettingsDock();
      hideFurnMenu();
      if (!helpModal.hidden) closeHelp();
      closeCraft();
      closeTrade();
      closeChest();
      closeUpgrade();
      closePotion();
    },
    log: (line) => pushLog(state, line),
    toast: (line) => showGameToast(line),
    render: () => render(performance.now() / 1000),
  });
  heroesPanel.showAway?.();
  skills.onLevelUp((event) => {
    playSfx('levelup');
    const unlocked = unlockNamesBetween(event.skillId, event.from, event.level, hiddenCraft);
    const extra = unlocked.length
      ? ` New: ${unlocked.slice(0, 6).join(', ')}${unlocked.length > 6 ? '…' : ''}.`
      : '';
    pushLog(state, `Congratulations, your ${event.name} level is now ${event.level}.${extra}`);
    const unlockHtml = unlockListHtml(groupUnlocks(unlocksBetween(event.skillId, event.from, event.level, hiddenCraft), RECIPES));
    showLevelUpToast({ ...event, unlocked, unlockHtml }, { onClick: (id) => skillGuide?.open?.(id) });
  });

  world.onPick((event) => {
    if (event.type !== 'furn-menu') hideFurnMenu();
    if (event.type === 'boulder-inspect') {
      showInspect(event.materialId, event.clientX, event.clientY, event);
    }
    if (event.type === 'tree-inspect') {
      showInspect(event.materialId, event.clientX, event.clientY, { ...event, kind: 'tree' });
    }
    if (event.type === 'flax-inspect') {
      showInspect(event.materialId, event.clientX, event.clientY, { ...event, kind: 'flax' });
    }
    if (event.type === 'wheat-inspect') {
      showInspect(event.materialId, event.clientX, event.clientY, { ...event, kind: 'wheat' });
    }
    if (event.type === 'construction-select') {
      // Bank Booth opens the shared chest storage (same contents, not a separate bank).
      if (state.furniture?.placed?.[event.index]?.id === 'bank_booth') { openChest(); return; }
      openPlacedBar(event.index);
      return;
    }
    if (event.type === 'fish-picker') {
      showFishPicker(event.clientX, event.clientY, { x: event.x, z: event.z });
      return;
    }
    if (event.type === 'fishing-inspect') {
      showInspect(event.materialId, event.clientX, event.clientY, { ...event, kind: 'fishing_spot' });
    }
    if (event.type === 'player-move') closeHeroesDock();
    if (event.type === 'mined' || event.type === 'chopped' || event.type === 'picked' || event.type === 'caught') {
      if (activeCraftYield) {
        activeCraftYield.classList.add('is-grant');
        window.setTimeout(() => activeCraftYield.classList.remove('is-grant'), 280);
      }
    }
    if (event.type === 'chest') openChest();
    if (event.type === 'anvil') openCraft('anvil');
    if (event.type === 'range') openCraft('range');
    if (event.type === 'cauldron') openCraft('cauldron');
    if (event.type === 'furnace') openCraft('furnace');
    if (event.type === 'wheel') openCraft('wheel');
    if (event.type === 'loom') openCraft('loom');
    if (event.type === 'fletch') openCraft('fletch');
    if (event.type === 'potter') openCraft('potter');
    if (event.type === 'sawmill') openCraft('sawmill');
    if (event.type === 'farming_patch') openCraft('farming_patch', { patchIndex: event.patchIndex });
    if (event.type === 'gather-block') {
      showGameToast(event.text);
      render(performance.now() / 1000);
    }
    if (event.type === 'portal') {
      fadeShop(() => world.enterRuneField?.());
    }
    if (event.type === 'rune-portal') {
      fadeShop(() => world.exitRuneField?.());
    }
    if (event.type === 'altar') {
      const element = event.element;
      if ((state.materials.essence ?? 0) < 1) {
        pushLog(state, 'You need rune essence.');
        render(performance.now() / 1000);
      } else {
        openCraft(`altar-${element}`);
      }
    }
    if (event.type === 'display-select') render(performance.now() / 1000);
    if (event.type === 'chest-upgrade') openUpgrade();
    if (event.type === 'furn-menu') showFurnMenu(event.furniture, event.clientX, event.clientY);
    if (event.type === 'expand-pad') paintExpand();
    if (event.type === 'customer' && event.actor?.state === 'request') openTrade(event.actor);
    if (event.type === 'furniture-cancel') closePlace();
    if (event.type === 'furniture-place-confirm' && pendingPlace) confirmPendingPlace();
    if (event.type === 'furniture-place-blocked' && pendingPlace) {
      pendingPlace.note = event.reason || 'That spot overlaps other furniture.';
      paintPlaceDock();
      render(performance.now() / 1000);
    }
    if (event.type === 'trapdoor') {
      fadeShop(() => world.enterDungeon?.());
    }
    if (event.type === 'ladder') {
      fadeShop(() => world.exitDungeon?.());
    }
  });

  function closeHelp() {
    helpModal.hidden = true;
    localStorage.setItem('stallhaven-tip', '1');
    world.ignorePicks(280);
    setModalOpen();
  }

  function openHelp() {
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSkillsDock();
    closeHeroesDock();
    closeSettingsDock();
    closeDisplayPicker();
    closeBuild();
    closePlace(true);
    helpModal.hidden = false;
    setModalOpen();
  }

  if (!localStorage.getItem('stallhaven-tip')) {
    helpModal.hidden = false;
  }
  dismiss.addEventListener('click', closeHelp);
  helpModal.addEventListener('click', (event) => {
    if (event.target === helpModal) closeHelp();
  });
  document.querySelector('#help-btn')?.addEventListener('click', openHelp);

  /* Small top-right ✕ on panels that only had a bottom Close/Cancel. It clicks that existing button, so closing behaves exactly as before. */
  [
    ['#help-modal .sheet', '[data-dismiss]'],
    ['#music-dock', '[data-music-close]'],
    ['#chest-modal .sheet', '[data-chest-close]'],
    ['#trade-modal .sheet', '[data-trade-close]'],
    ['#offer-modal .sheet', '[data-offer-cancel]'],
    ['#import-modal .sheet', '[data-cancel]'],
    ['#chest-upgrade-modal .sheet', '[data-upgrade-close]'],
    ['#expand-dock', '[data-expand-close]'],
    ['#place-dock', '[data-place-cancel]'],
    ['#display-modal .sheet', '[data-display-cancel]'],
    ['#fill-modal .sheet', '[data-fill-cancel]'],
    ['#inspect-pop', '[data-inspect-close]'],
    ['#furn-menu', '[data-furn-close]'],
  ].forEach(([panelSel, closeSel]) => {
    const panel = document.querySelector(panelSel);
    const closer = panel?.querySelector(closeSel);
    if (!panel || !closer || panel.querySelector(':scope > .panel-x')) return;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'ghost settings-x panel-x';
    x.setAttribute('aria-label', 'Close');
    x.title = 'Close';
    x.textContent = '✕';
    x.addEventListener('click', (ev) => { ev.stopPropagation(); closer.click(); });
    panel.prepend(x);
  });
  setModalOpen();

  // Save/Load moved to the Saves panel and Settings → Save files (src/game/saveUi.js).
  // Like every HUD press (#156), opening Saves or the Settings save files closes Heroes/Quests.
  document.querySelector('#saves-btn')?.addEventListener('click', () => closeHeroesDock());
  document.querySelector('[data-settings-saves]')?.addEventListener('click', (event) => {
    if (event.target.closest('button')) closeHeroesDock();
  });

  function bumpMapZoom(factor) {
    mapZoom = clampMapZoom(mapZoom * factor);
  }

  function portraitTouch() {
    return portraitTouchMedia.matches;
  }

  function syncMinimapBuffer() {
    if (!minimap || minimap.hidden) return;
    const cssSize = minimap.clientWidth;
    if (!cssSize) return;
    const px = minimapBufferPixels(cssSize, window.devicePixelRatio || 1);
    const marked = String(cssSize);
    if (minimap.dataset.cssSize !== marked) minimap.dataset.cssSize = marked;
    if (minimap.width !== px) minimap.width = px;
    if (minimap.height !== px) minimap.height = px;
  }

  function setMapOpen(open) {
    const next = Boolean(open) && portraitTouch();
    minimapWrap?.classList.toggle('is-expanded', next);
    root.classList.toggle('is-map-open', next);
    if (mapToggle) mapToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    syncMinimapBuffer();
  }

  mapToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!portraitTouch() || minimapWrap?.hidden || minimap?.hidden) return;
    setMapOpen(true);
  });
  mapClose?.addEventListener('click', (event) => {
    event.stopPropagation();
    setMapOpen(false);
  });
  mapDismiss?.addEventListener('click', (event) => {
    event.stopPropagation();
    setMapOpen(false);
  });
  portraitTouchMedia.addEventListener('change', () => {
    if (!portraitTouch()) setMapOpen(false);
  });

  minimap?.addEventListener('click', (event) => {
    if (minimap.hidden) return;
    const snap = world.getMinimapSnapshot?.();
    if (!snap || snap.hidden) return;
    syncMinimapBuffer();
    const rect = minimap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const size = minimap.width;
    const px = (event.clientX - rect.left) * (size / rect.width);
    const py = (event.clientY - rect.top) * (size / rect.height);
    if (Math.hypot(px - size / 2, py - size / 2) > size / 2) return;
    const frame = minimapFrame(snap);
    const dest = mapToWorld(px, py, frame.bounds, size, frame.yaw, mapZoom, frame.focus);
    mapPing = { x: dest.x, z: dest.z, at: performance.now() / 1000 };
    world.walkTo?.(dest.x, dest.z);
  });
  minimap?.addEventListener('wheel', (event) => {
    if (minimap.hidden) return;
    event.preventDefault();
    bumpMapZoom(event.deltaY > 0 ? 1 / 1.12 : 1.12);
  }, { passive: false });
  mapNorth?.addEventListener('click', (event) => {
    event.stopPropagation();
    world.resetCamera?.();
    render(performance.now() / 1000);
  });
  mapZoomIn?.addEventListener('click', (event) => {
    event.stopPropagation();
    bumpMapZoom(1.16);
  });
  mapZoomOut?.addEventListener('click', (event) => {
    event.stopPropagation();
    bumpMapZoom(1 / 1.16);
  });

  document.addEventListener('click', (event) => {
    const popUpgrade = event.target.closest('.sf-pop [data-storage-upgrade]');
    if (popUpgrade) {
      closeStoragePop();
      openUpgrade();
      return;
    }
    if (storagePop && !event.target.closest('.sf-pop, [data-storage-full]')) closeStoragePop();
    const btn = event.target.closest('button');
    if (!btn) return;
    if (
      btn.dataset.craft
      || btn.dataset.craftQty
      || btn.dataset.offerItem
      || btn.dataset.displayItem
      || btn.hasAttribute('data-trade-sell')
      || btn.hasAttribute('data-trade-buy-btn')
      || btn.hasAttribute('data-trade-offer-btn')
      || btn.hasAttribute('data-offer-confirm')
    ) return;
    playClick('ui');
  });

  let lastUnlockKey = null;
  let lastChestKey = null;

  function paintBusy(container, recipes, now) {
    if (!container) return;
    for (const recipe of recipes) {
      const btn = container.querySelector(`[data-craft="${recipe.id}"]`);
      const timer = container.querySelector(`[data-timer="${recipe.id}"]`);
      const row = container.querySelector(`[data-craft-row="${recipe.id}"]`);
      if (!btn || !timer) continue;
      const progress = craftProgress(state, recipe.id, now);
      const locked = !isUnlocked(state, recipe.id);
      const affordable = maxCraftActions(state, recipe.id);
      const storageFull = !locked && Boolean(recipe.outputMaterial) && materialIsFull(state, recipe.outputMaterial);
      btn.classList.toggle('is-locked', locked);
      row?.classList.toggle('is-locked', locked);
      row?.classList.toggle('is-full', storageFull);
      if (storageFull) {
        btn.disabled = true;
        btn.title = 'Storage full';
      } else if (btn.title === 'Storage full') {
        btn.disabled = false;
        btn.removeAttribute('title');
      }
      if (row) syncStorageFullActions(row, recipe, storageFull);
      if (progress) {
        btn.classList.add('is-busy');
        const batch = progress.total > 1 ? `${progress.done + 1}/${progress.total} · ` : '';
        timer.textContent = `${batch}${Math.ceil(progress.left)}s`;
        btn.style.setProperty('--t', String(progress.t));
      } else {
        btn.classList.remove('is-busy');
        timer.textContent = '';
        btn.style.setProperty('--t', '0');
      }
      for (const qty of row?.querySelectorAll('[data-craft-qty]') ?? []) {
        qty.disabled = locked || affordable < 1;
        if (storageFull) qty.title = 'Storage full';
        else if (qty.title === 'Storage full') qty.removeAttribute('title');
      }
    }
  }

  function escapeLog(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function paintGameLog() {
    const el = document.querySelector('#game-log');
    if (!el) return;
    const lines = visibleLog(state);
    const next = lines.map((line) => `<li>${escapeLog(line)}</li>`).join('');
    if (el.innerHTML !== next) el.innerHTML = next;
  }

  function showGameToast(text) {
    if (!text) return;
    document.querySelectorAll('.game-toast').forEach((old) => old.remove());
    const toast = document.createElement('div');
    toast.className = 'game-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    document.body.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function render(now) {
    if (document.body.classList.contains('modal-open') && !document.querySelector('.modal:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
    const dt = lastPreviewAt ? Math.min(0.05, Math.max(0, now - lastPreviewAt)) : 0;
    lastPreviewAt = now;
    if (!craftModal.hidden) craftPreview?.tick(dt);
    if (!potionModal.hidden) potionPreview?.tick(dt);
    goldEl.textContent = `Coins: ${formatGold(state.gold)}`;
    paintGameLog();
    syncOwnedMaterials();
    const xp = shopProgress(state.shopXp ?? 0);
    const levelEl = document.querySelector('#shop-level');
    const xpBar = document.querySelector('[data-shop-xp-bar]');
    if (levelEl) levelEl.textContent = `Shop Level ${xp.level}`;
    if (xpBar) {
      const bar = xpBar.parentElement;
      if (bar) bar.style.setProperty('--t', String(xp.t));
    }
    if (resumeTrade && !state.crafts[resumeTrade.recipeId]) {
      const pending = resumeTrade;
      resumeTrade = null;
      const actor = world.getCustomer(pending.id);
      if (actor && actor.state === 'request') {
        closeCraft();
        closePotion();
        openTrade(actor);
      }
    }
    const chestN = chestTotal(state);
    if (chestCountEl) chestCountEl.textContent = `${chestN} piece${chestN === 1 ? '' : 's'} waiting`;
    if (!craftModal.hidden) syncMats(matsEl);
    if (!potionModal.hidden) syncMats(potionMatsEl);
    const unlockKey = Object.entries(state.craftCounts ?? {}).map(([id, n]) => `${id}:${n}`).join('|');
    if (unlockKey !== lastUnlockKey) {
      lastUnlockKey = unlockKey;
      if (!craftModal.hidden || !potionModal.hidden) paintCrafts();
    }
    if (!craftModal.hidden && craftStation === 'farming_patch') paintHerbTimers();
    if (!craftModal.hidden && craftStation !== 'farming_patch') paintBusy(craftsEl, currentRecipes(), now);
    if (!potionModal.hidden) paintBusy(potionCraftsEl, recipesForTab('potion'), now);
    const busyId = Object.keys(state.crafts ?? {})[0];
    const cancelBtns = [
      craftModal.querySelector('[data-craft-cancel]'),
      potionModal.querySelector('[data-potion-cancel]'),
    ];
    for (const btn of cancelBtns) {
      if (btn) btn.disabled = !busyId;
    }
    if (activeCraft) {
      const mining = world.getMining?.(now);
      if (mining) {
        activeCraft.hidden = false;
        if (activeCraftName) activeCraftName.textContent = `${mining.verb ?? 'Mining'} ${mining.name}`;
        activeCraft.style.setProperty('--t', String(mining.t ?? 0));
        if (activeCraftYield) activeCraftYield.hidden = true;
      } else if (busyId) {
        const progress = craftProgress(state, busyId, now);
        activeCraft.hidden = false;
        if (activeCraftName) {
          const batch = progress?.total > 1 ? ` (${progress.done + 1}/${progress.total})` : '';
          activeCraftName.textContent = `Crafting ${RECIPES[busyId].name}${batch}`;
        }
        activeCraft.style.setProperty('--t', String(progress?.t ?? 0));
        if (activeCraftYield) activeCraftYield.hidden = true;
      } else {
        activeCraft.hidden = true;
        activeCraft.style.setProperty('--t', '0');
        if (activeCraftYield) activeCraftYield.hidden = true;
      }
    }
    syncMaterialsDrawerPlace();
    const chestKey = chestList(state).map((item) => `${item.recipeId}:${item.count}`).join('|');
    if (chestKey !== lastChestKey) {
      lastChestKey = chestKey;
      if (!chestModal.hidden) paintChest();
      if (!offerModal.hidden) {
        lastOfferListKey = '';
        paintOfferPicker();
      }
      if (!displayModal?.hidden) {
        lastDisplayListKey = '';
        paintDisplayPicker();
      }
    }
    if (tradeActor) {
      const live = world.getCustomer(tradeActor.id);
      if (live) tradeActor = live;
      if (tradeActor.state === 'leave') closeTrade();
      else {
        if (!tradeModal.hidden) paintTrade();
        if (!offerModal.hidden) paintOfferPicker();
      }
    }
    const mapSnap = world.getMinimapSnapshot?.();
    if (minimap) {
      const hideMap = Boolean(mapSnap?.hidden);
      minimap.hidden = hideMap;
      if (minimapWrap) minimapWrap.hidden = hideMap;
      if (hideMap && root.classList.contains('is-map-open')) setMapOpen(false);
      if (mapSnap && !mapSnap.hidden) {
        syncMinimapBuffer();
        const ctx = minimap.getContext('2d');
        if (ctx) {
          const frame = minimapFrame(mapSnap);
          mapSnap.bounds = frame.bounds;
          mapSnap.focus = frame.focus;
          mapSnap.zoom = mapZoom;
          if (minimap.dataset.scene !== mapSnap.sceneMode) {
            minimap.dataset.scene = mapSnap.sceneMode;
            minimap.setAttribute(
              'aria-label',
              mapSnap.sceneMode === 'dungeon'
                ? 'Dungeon map. Click or tap to walk. Scroll or use +/− to zoom.'
                : 'Shop map. Click or tap to walk. Scroll or use +/− to zoom.',
            );
          }
          if (mapPing) {
            const age = (performance.now() / 1000) - mapPing.at;
            if (age < 1) mapSnap.ping = { x: mapPing.x, z: mapPing.z, age };
            else mapPing = null;
          }
          drawMinimap(ctx, mapSnap);
          if (minimapWrap) {
            const deg = compassNeedleDegrees(frame.yaw);
            const next = `${deg}deg`;
            if (minimapWrap.style.getPropertyValue('--map-yaw') !== next) {
              minimapWrap.style.setProperty('--map-yaw', next);
            }
          }
        }
      }
    }
  }

  async function tryStartMusic() {
    const savedVolume = state.music?.volume ?? DEFAULT_MUSIC_VOLUME;
    const savedTrack = state.music?.track ?? '';
    const result = await startMusicOnLoad({
      volume: savedVolume,
      muted: savedVolume <= 0,
      track: savedTrack,
      loop: Boolean(state.music?.loop),
    });
    persistMusic();
    paintMusic();
    return result;
  }

  function setMaterialsOpen(open) {
    if (!materialsDrawer) return;
    materialsDrawer.classList.toggle('is-open', open);
    materialsToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    materialsToggle?.setAttribute('aria-label', open ? 'Hide inventory' : 'Show inventory');
    if (materialsPanel) {
      materialsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      materialsPanel.inert = !open;
    }
  }

  function closeMaterialsDrawer() {
    if (!materialsDrawer?.classList.contains('is-open')) return;
    const mdBox = document.querySelector('[data-mat-discard-box]');
    if (mdBox) mdBox.hidden = true;
    setMaterialsOpen(false);
  }

  function syncOwnedMaterials() {
    if (!ownedMaterialsEl) return;
    const key = `${ownedMaterialsKey(state.materials)}@${storageCap(state)}`;
    if (key === ownedKey) return;
    ownedKey = key;
    ownedMaterialsEl.innerHTML = materialsDrawerHtml(state.materials, storageCap(state));
  }

  function syncStorageFullActions(row, recipe, storageFull) {
    const existing = row.querySelector('[data-storage-full]');
    const link = row.querySelector('.sf-link[data-storage-upgrade]');
    if (!storageFull) {
      existing?.remove();
      link?.remove();
      return;
    }
    if (existing) return;
    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.className = 'sf-full';
    fullBtn.dataset.storageFull = recipe.outputMaterial;
    fullBtn.title = 'Storage full';
    fullBtn.textContent = 'FULL';
    const upgradeBtn = document.createElement('button');
    upgradeBtn.type = 'button';
    upgradeBtn.className = 'sf-link';
    upgradeBtn.dataset.storageUpgrade = '';
    upgradeBtn.textContent = 'Upgrade chest';
    row.append(fullBtn, upgradeBtn);
  }

  const matDiscardBox = document.querySelector('[data-mat-discard-box]');
  let pendingMatDiscard = null;
  function closeMatDiscard() {
    pendingMatDiscard = null;
    if (matDiscardBox) matDiscardBox.hidden = true;
  }
  function openMatDiscard(id) {
    const have = Math.max(0, Math.floor(Number(state.materials?.[id]) || 0));
    if (!matDiscardBox || have < 1) return;
    pendingMatDiscard = id;
    const name = MATERIALS[id]?.name ?? 'this material';
    const msg = matDiscardBox.querySelector('[data-mat-discard-msg]');
    if (msg) msg.textContent = `Throw away ${name}? It cannot be undone.`;
    matDiscardBox.querySelectorAll('[data-mat-discard-amt]').forEach((b) => {
      const v = b.dataset.matDiscardAmt;
      b.hidden = v !== 'all' && Number(v) > have;
      if (v === 'all') b.textContent = `All (${have})`;
    });
    matDiscardBox.hidden = false;
    // The box sits at the top of the scrolling sheet: bring it into view, or the bin looks dead when the list is scrolled.
    try { matDiscardBox.scrollIntoView({ block: 'nearest' }); } catch { /* old browsers */ }
    matDiscardBox.querySelector('[data-mat-discard-amt]:not([hidden])')?.focus?.({ preventScroll: true });
  }
  matDiscardBox?.addEventListener('click', (event) => {
    if (event.target.closest('[data-mat-discard-no]')) { closeMatDiscard(); return; }
    const amtBtn = event.target.closest('[data-mat-discard-amt]');
    if (!amtBtn || !pendingMatDiscard) return;
    const id = pendingMatDiscard;
    const raw = amtBtn.dataset.matDiscardAmt;
    const have = Math.max(0, Math.floor(Number(state.materials?.[id]) || 0));
    const amount = raw === 'all' ? have : Math.min(have, Number(raw));
    if (amount > 0 && intentBus.run({ type: 'discardMaterial', materialId: id, amount })) {
      pushLog(state, `Discarded ${amount} ${MATERIALS[id]?.name ?? id}.`);
    }
    closeMatDiscard();
    syncOwnedMaterials();
    render(performance.now() / 1000);
  });

  ownedMaterialsEl?.addEventListener('click', (event) => {
    const bin = event.target.closest('[data-mat-discard]');
    if (bin) { openMatDiscard(bin.dataset.matDiscard); return; }
    const full = event.target.closest('[data-storage-full]');
    if (!full) return;
    openStoragePop(full, full.dataset.storageFull);
  });

  function materialsObstacles() {
    const nodes = [
      document.querySelector('#hud .ledger'),
      minimapWrap,
      activeCraft,
      document.querySelector('#save-bar'),
    ];
    const obstacles = [];
    for (const el of nodes) {
      if (!el || el.hidden) continue;
      const rect = el.getBoundingClientRect();
      obstacles.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    }
    return obstacles;
  }

  function syncMaterialsDrawerPlace() {
    if (!materialsDrawer) return;
    if (document.body.classList.contains('station-open')) {
      const m = [craftModal, potionModal].find((x) => x && !x.hidden);
      const head = m?.querySelector('.craft-sheet > h2')?.getBoundingClientRect();
      const close = [...(m?.querySelectorAll('.craft-sheet > [data-craft-close].ghost, .craft-sheet > button.ghost:last-of-type') ?? [])].pop()?.getBoundingClientRect();
      if (head && close) {
        const top = Math.round(head.bottom + 4), bottom = Math.round(window.innerHeight - close.top + 4);
        materialsPlaceKey = `st|${top}|${bottom}`;
        materialsDrawer.style.top = `${top}px`; materialsDrawer.style.bottom = `${bottom}px`;
        return;
      }
    }
    if (materialsPlaceKey.startsWith('st|')) materialsPlaceKey = '';
    if (!materialsSideMedia.matches) {
      if (materialsPlaceKey !== 'desk') {
        materialsPlaceKey = 'desk';
        materialsDrawer.style.top = '';
        materialsDrawer.style.bottom = '';
      }
      return;
    }
    const box = materialsDrawerSideBox({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      obstacles: materialsObstacles(),
    });
    const key = `${box.top ?? ''}|${box.bottom ?? ''}`;
    if (key === materialsPlaceKey) return;
    materialsPlaceKey = key;
    materialsDrawer.style.top = box.top == null ? '' : `${box.top}px`;
    materialsDrawer.style.bottom = box.bottom == null ? '' : `${box.bottom}px`;
  }

  let materialsPointerArmed = false;
  function onMaterialsPointer(event) {
    if (!materialsDrawer || !materialsToggle) return;
    const open = materialsDrawer.classList.contains('is-open');
    const plan = materialsDrawerPointerPlan({
      type: event.type,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      toggleRect: materialsToggle.getBoundingClientRect(),
      panelRect: open ? materialsPanel?.getBoundingClientRect() : null,
      open,
      armed: materialsPointerArmed,
      targetInDrawer: materialsDrawer.contains(event.target),
    });
    if (event.type === 'pointerdown') materialsPointerArmed = plan.arm;
    else materialsPointerArmed = false;
    if (plan.toggle) {
      setMaterialsOpen(!materialsDrawer.classList.contains('is-open'));
      playClick('ui');
    }
    if (!plan.swallow) return;
    event.preventDefault();
    event.stopPropagation();
  }
  document.addEventListener('pointerdown', onMaterialsPointer, true);
  document.addEventListener('pointerup', onMaterialsPointer, true);
  document.addEventListener('pointercancel', onMaterialsPointer, true);
  materialsSideMedia.addEventListener?.('change', syncMaterialsDrawerPlace);
  window.addEventListener('resize', syncMaterialsDrawerPlace);
  onLayoutChange(syncMaterialsDrawerPlace);
  if (materialsPanel) materialsPanel.inert = true;
  syncOwnedMaterials();
  syncMaterialsDrawerPlace();

  /** Redraw everything after the whole shop state was swapped (co-op join/leave, shared furniture). */
  function refreshAll({ layout = true } = {}) {
    if (layout) world.applyLayout();
    world.syncDisplays();
    world.refreshSelection(true);
    paintCrafts();
    paintChest();
    paintBuild();
    render(performance.now() / 1000);
  }

  return {
    render,
    openChest,
    openTrade,
    openCraft,
    openOfferPicker,
    selectOfferItem,
    tryStartMusic,
    refreshAll,
    paintCrafts,
    showQuestAway: () => heroesPanel?.showAway?.(),
    // UI-fit audit (scripts/ui-fit.mjs) opens every panel through these.
    debugOpen: { openPotion, openUpgrade, openExpand, openPlaceDock, openMusic, openHelp, showFishPicker, openDisplayPicker, openFillPicker, openStoragePop, openBuild },
  };
}

/** Phone portrait: tuck long paragraphs in sheets/docks behind an About toggle, and use tap wording. */
function setupPhoneAboutToggles(root) {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (!window.matchMedia(PHONE_QUERY).matches) return;
  const doc = root?.ownerDocument ?? document;
  doc.querySelectorAll('.modal .sheet > p, .expand-dock p').forEach((p) => {
    if (p.closest('details') || p.classList.contains('meta') || p.classList.contains('help-copy')) return;
    if ((p.textContent ?? '').trim().length < 120) return;
    const details = doc.createElement('details');
    details.className = 'phone-about';
    const summary = doc.createElement('summary');
    summary.textContent = 'About';
    p.replaceWith(details);
    details.append(summary, p);
  });
  doc.querySelectorAll('[data-craft-preview-name], [data-potion-preview-name]').forEach((el) => {
    el.textContent = el.textContent.replace('Select or hover a', 'Tap a').replace(/\.$/, ' to preview.');
  });
}
