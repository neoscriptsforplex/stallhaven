import {
  ANVIL_SUBTABS,
  ANVIL_TABS,
  CUSTOMERS,
  FACE_HAIR,
  HAIR_STYLES,
  MATERIALS,
  PLAYER_COLORS,
  RECIPES,
  SKYBOXES,
  anvilSubtabForRecipe,
  anvilTabForRecipe,
  classLabel,
  costLabel,
  defaultAppearance,
  displayKind,
  formatGold,
  isCraftedMaterial,
  materialList,
  normalizeAppearance,
  offerClassLabel,
  offerClassOf,
  recipeMatsLabel,
  recipesForTab,
  SHELF_SLOT_LABELS,
  stationForRecipe,
} from './catalog.js';
import {
  addMusicFiles,
  getMusicTrackName,
  getMusicVolume,
  getPlaylist,
  isMusicPlaying,
  isShuffle,
  movePlaylistTrack,
  pauseMusic,
  playClick,
  playMusic,
  playTrackAt,
  removePlaylistTrack,
  setMusicVolume,
  skipTrack,
  stopMusic,
  toggleShuffle,
} from './audio.js';
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
  chestList,
  chestTotal,
  craftBlockReason,
  craftDuration,
  craftProgress,
  DEFAULT_MUSIC_VOLUME,
  discardFromChest,
  fillStandFromRecipe,
  furnitureNeedGold,
  hasStock,
  isMastered,
  isUnlocked,
  nextFurnitureCost,
  ownsCauldron,
  ownsStation,
  placeFromChest,
  pushLog,
  restock,
  offerChoices,
  placeOnDisplay,
  sellToCustomer,
  shopProgress,
  maxCraftActions,
  startCraft,
  startCraftBatch,
  stationCost,
  unlockRemaining,
  upgradeChest,
} from './economy.js';
import {
  CHEST_MAX_LEVEL,
  chestSlots,
  chestUpgradeCost,
  expansionCost,
  furnitureKindForType,
  furnitureLabelForType,
  padById,
  stationLabel,
  STATION_UNLOCKS,
} from './layout.js';
import { loadStateFromFile, saveStateToFile } from './savefile.js';
import { createCraftPreview } from './craftpreview.js';

export function bindHud(root, state, world) {
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
  const furnMenu = document.querySelector('#furn-menu');
  const shopFade = document.querySelector('#shop-fade');
  const activeCraft = root.querySelector('#active-craft');
  const activeCraftName = activeCraft?.querySelector('[data-active-craft-name]');
  const chestCapEl = document.querySelector('#chest-cap');
  const expandBtn = document.querySelector('#expand-btn');
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
  let craftStation = 'anvil';
  let craftFocusId = null;
  let tradeActor = null;
  let furnTarget = null;
  let selectedOfferId = null;
  let lastOfferListKey = '';
  let selectedDisplayId = null;
  let lastDisplayListKey = '';
  let displayTarget = null;
  let pendingPlace = null;
  let resumeTrade = null;

  tabsEl.innerHTML = ANVIL_TABS.map((tab) => (
    `<button type="button" class="tab" data-tab="${tab.id}">${tab.label}</button>`
  )).join('');
  subtabsEl.innerHTML = ANVIL_SUBTABS.map((tab) => (
    `<button type="button" class="tab" data-subtab="${tab.id}">${tab.label}</button>`
  )).join('');

  function currentRecipes() {
    if (craftStation === 'range') return recipesForTab('food');
    if (craftStation === 'cauldron') return recipesForTab('potion');
    if (craftStation === 'furnace') return recipesForTab('smelt');
    if (craftStation === 'wheel') return recipesForTab('spin');
    return recipesForTab(craftTab, craftSubtab);
  }

  function setCraftNote(text) {
    const note = craftModal.querySelector('[data-craft-note]');
    if (!note) return;
    note.hidden = !text;
    note.textContent = text || '';
  }

  function paintRecipeButtons(container, recipes) {
    if (!container) return;
    const lines = new Map();
    for (const recipe of recipes) {
      const lineId = recipe.lineId || recipe.id;
      if (!lines.has(lineId)) lines.set(lineId, []);
      lines.get(lineId).push(recipe);
    }
    container.innerHTML = [...lines.values()].map((list) => {
      list.sort((a, b) => a.lineIndex - b.lineIndex);
      const lineTitle = list[0]?.lineName ? `<h4 class="line">${list[0].lineName}</h4>` : '';
      return lineTitle + list.map((recipe) => {
        const locked = !isUnlocked(state, recipe.id);
        const mastered = isMastered(state, recipe.id);
        const prev = recipe.previousId ? RECIPES[recipe.previousId] : null;
        const remain = unlockRemaining(state, recipe.id);
        const duration = craftDuration(state, recipe.id);
        const lockText = locked
          ? `Locked · ${remain} more ${prev?.name ?? 'crafts'}`
          : costLabel(recipe, duration);
        const mats = recipeMatsLabel(recipe);
        const focus = recipe.id === craftFocusId ? ' is-focus' : '';
        const star = mastered ? '<span class="mastery-star" title="Mastered">★</span>' : '';
        const affordable = locked ? 0 : maxCraftActions(state, recipe.id);
        return `
          <article class="craft-row${locked ? ' is-locked' : ''}${focus}" data-craft-row="${recipe.id}">
            <button type="button" class="craft${locked ? ' is-locked' : ''}${mastered ? ' is-mastered' : ''}${focus}" data-craft="${recipe.id}">
              <strong>${star}${recipe.name}</strong>
              <span class="meta">${lockText}</span>
              ${mats ? `<span class="craft-mats-line">${mats}</span>` : ''}
              <span class="timer" data-timer="${recipe.id}"></span>
              <span class="craft-bar" aria-hidden="true"><i data-bar="${recipe.id}"></i></span>
            </button>
            <div class="craft-qty">
              <button type="button" data-craft-qty="1" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}>1×</button>
              <button type="button" data-craft-qty="5" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}>5×</button>
              <button type="button" data-craft-qty="max" data-craft-for="${recipe.id}"${locked || affordable < 1 ? ' disabled' : ''}>Max</button>
            </div>
          </article>
        `;
      }).join('');
    }).join('');
  }

  function paintCrafts() {
    const rangeMode = craftStation === 'range';
    const cauldronMode = craftStation === 'cauldron';
    const furnaceMode = craftStation === 'furnace';
    const wheelMode = craftStation === 'wheel';
    const simpleStation = rangeMode || cauldronMode || furnaceMode || wheelMode;
    tabsEl.hidden = simpleStation;
    subtabsEl.hidden = simpleStation;
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
              : 'Work a ware here. 1× / 5× / Max are craft actions (ammo makes 20 per action). Finished pieces land in the chest. Weapons, armour, and ammo use metal bars. Bows and crossbows also need bow string. Magic Runes use Essence.';
    }
    for (const btn of tabsEl.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === craftTab);
    }
    const showAmmo = !simpleStation && craftTab === 'ranged';
    const showRunes = !simpleStation && craftTab === 'magic';
    subtabsEl.classList.toggle('has-extra', showAmmo || showRunes);
    for (const btn of subtabsEl.querySelectorAll('[data-subtab]')) {
      if (btn.dataset.subtab === 'ammo') btn.hidden = !showAmmo;
      if (btn.dataset.subtab === 'rune') btn.hidden = !showRunes;
      btn.classList.toggle('is-on', btn.dataset.subtab === craftSubtab);
    }
    paintRecipeButtons(craftsEl, currentRecipes());
    if (potionCraftsEl) paintRecipeButtons(potionCraftsEl, recipesForTab('potion'));
    if (craftFocusId) {
      showPreview(craftFocusId);
      requestAnimationFrame(() => {
        const el = (cauldronMode ? potionCraftsEl : craftsEl)?.querySelector(`[data-craft-row="${craftFocusId}"]`)
          ?? craftsEl.querySelector(`[data-craft-row="${craftFocusId}"]`);
        el?.scrollIntoView({ block: 'center' });
      });
    }
  }
  paintCrafts();

  function fillMats(container) {
    if (!container || container.dataset.ready) return;
    container.innerHTML = materialList().map((mat) => `
      <div class="mat${isCraftedMaterial(mat.id) ? ' is-crafted' : ''}" data-mat="${mat.id}">
        <span class="mat-name">${mat.name}</span>
        <span class="mat-count" data-count="${mat.id}">0</span>
        ${isCraftedMaterial(mat.id)
          ? '<span class="mat-crafted">Crafted</span>'
          : `<button type="button" class="restock" data-restock="${mat.id}">${formatGold(mat.restock)}g</button>`}
      </div>
    `).join('');
    container.dataset.ready = '1';
    container.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-restock]');
      if (!btn) return;
      if (restock(state, btn.dataset.restock)) render(performance.now() / 1000);
    });
  }
  fillMats(matsEl);
  fillMats(potionMatsEl);

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
    craftSubtab = 'weapon';
    craftFocusId = null;
    setCraftNote('');
    paintCrafts();
    render(performance.now() / 1000);
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

  function showPreview(recipeId) {
    const recipe = RECIPES[recipeId];
    if (craftPreview) craftPreview.show(recipeId);
    if (potionPreview) potionPreview.show(recipeId);
    const label = recipe?.name ?? 'Select or hover a recipe.';
    const craftName = craftModal.querySelector('[data-craft-preview-name]');
    const potionName = potionModal.querySelector('[data-potion-preview-name]');
    if (craftName) craftName.textContent = label;
    if (potionName) potionName.textContent = label;
  }

  function queueCraft(recipeId, want) {
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
    const n = startCraftBatch(state, recipeId, want, performance.now() / 1000);
    if (!n) return;
    playClick('craft');
    setCraftNote('');
    const potionNote = potionModal.querySelector('[data-potion-note]');
    if (potionNote) {
      potionNote.hidden = true;
      potionNote.textContent = '';
    }
    const recipe = RECIPES[recipeId];
    const batch = recipe?.outputCount > 1 && !recipe.outputMaterial
      ? ` ×${n} (${n * recipe.outputCount} in the chest)`
      : n > 1 ? ` ×${n}` : '';
    pushLog(state, `Crafting ${recipe.name}${batch}…`);
    paintCrafts();
    render(performance.now() / 1000);
  }

  function onCraftClick(event) {
    const qty = event.target.closest('[data-craft-qty]');
    if (qty) {
      const recipeId = qty.dataset.craftFor;
      const want = qty.dataset.craftQty === 'max' ? Infinity : Number(qty.dataset.craftQty);
      queueCraft(recipeId, want);
      return;
    }
    const btn = event.target.closest('[data-craft]');
    if (!btn) return;
    queueCraft(btn.dataset.craft, 1);
  }

  function onCraftHover(event) {
    const row = event.target.closest('[data-craft-row]');
    if (!row) return;
    showPreview(row.dataset.craftRow);
  }

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
    if (placeFromChest(state, btn.dataset.place)) {
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
    if (pendingDiscardId && discardFromChest(state, pendingDiscardId)) {
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
  }

  function hideFurnMenu() {
    furnMenu.hidden = true;
    furnTarget = null;
  }

  function closeMusicDock() {
    if (musicDock) musicDock.hidden = true;
  }

  function closeSettingsDock() {
    if (settingsDock) settingsDock.hidden = true;
  }

  function openCraft(station = 'anvil', options = {}) {
    closeChest();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    closeMusicDock();
    closeSettingsDock();
    closeDisplayPicker();
    if (!helpModal.hidden) closeHelp();
    closeBuild();
    const recipe = options.focusId ? RECIPES[options.focusId] : null;
    craftStation = recipe ? stationForRecipe(recipe) : station;
    craftFocusId = options.focusId ?? null;
    if (craftStation === 'range') craftTab = 'food';
    else if (craftStation === 'cauldron') craftTab = 'potion';
    else if (craftStation === 'furnace') craftTab = 'smelt';
    else if (craftStation === 'wheel') craftTab = 'spin';
    else {
      craftTab = recipe ? anvilTabForRecipe(recipe) : (craftTab === 'food' || craftTab === 'potion' ? 'melee' : craftTab);
      craftSubtab = recipe
        ? anvilSubtabForRecipe(recipe)
        : (craftSubtab === 'armour' || craftSubtab === 'ammo' || craftSubtab === 'rune' ? craftSubtab : 'weapon');
      if (craftTab !== 'ranged' && craftSubtab === 'ammo') craftSubtab = 'weapon';
      if (craftTab !== 'magic' && craftSubtab === 'rune') craftSubtab = 'weapon';
    }
    if (craftStation === 'cauldron') {
      craftModal.hidden = true;
      potionModal.hidden = false;
    } else {
      potionModal.hidden = true;
      craftModal.hidden = false;
    }
    const reason = craftFocusId ? craftBlockReason(state, craftFocusId) : '';
    setCraftNote(options.note || (options.autoStart ? reason : ''));
    const potionNote = potionModal.querySelector('[data-potion-note]');
    if (potionNote) {
      potionNote.hidden = !((craftStation === 'cauldron') && (options.note || (options.autoStart && reason)));
      potionNote.textContent = options.note || reason || '';
    }
    paintCrafts();
    setModalOpen();
    if (options.autoStart && craftFocusId && canCraft(state, craftFocusId)) {
      if (startCraft(state, craftFocusId, performance.now() / 1000)) {
        playClick('craft');
        setCraftNote('');
        if (potionNote) {
          potionNote.hidden = true;
          potionNote.textContent = '';
        }
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

  function openUpgrade() {
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
          ${standSelected ? `<button type="button" data-place="${recipe.id}">Place on Stand</button>` : ''}
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
    const items = chestList(state);
    if (!items.length) {
      lastDisplayListKey = 'empty';
      selectedDisplayId = null;
      displayItems.innerHTML = '<p class="empty">The chest is empty. Craft a ware, then display it here.</p>';
      pickEl.textContent = 'No chest item to display.';
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
    if (!recipeId || !placeOnDisplay(state, recipeId, index, slotIndex)) {
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
    tradeModal.querySelector('[data-trade-title]').textContent = CUSTOMERS[actor.typeId].name;
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
    const paid = sellToCustomer(state, recipeId, actor.offerGold);
    if (!paid) {
      paintTrade();
      return;
    }
    playClick('trade');
    pushLog(state, `Sold ${RECIPES[recipeId].name} to ${CUSTOMERS[actor.typeId].name} for ${formatGold(paid)}g.`);
    world.sellToActor(actor);
    world.syncDisplays();
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-refuse]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (actor) {
      pushLog(state, `You refuse ${CUSTOMERS[actor.typeId].name}.`);
      world.refuseActor(actor);
    }
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-buy-btn]').addEventListener('click', () => {
    const actor = tradeActor && world.getCustomer(tradeActor.id);
    if (!actor?.offer) return;
    if (buyFromCustomer(state, actor.offer.materialId, actor.offer.price)) {
      playClick('trade');
      const mat = MATERIALS[actor.offer.materialId];
      pushLog(state, `Bought ${mat.name} from ${CUSTOMERS[actor.typeId].name} for ${formatGold(actor.offer.price)}g.`);
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
      const msg = 'Place a cauldron from Upgrade to brew potions.';
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
    const paid = sellToCustomer(state, choice.recipeId, choice.gold);
    if (!paid) {
      lastOfferListKey = '';
      paintOfferPicker();
      paintTrade();
      return;
    }
    playClick('trade');
    pushLog(state, `Offered ${RECIPES[choice.recipeId].name} to ${CUSTOMERS[actor.typeId].name} for ${formatGold(paid)}g (reduced from ${formatGold(choice.listPrice)}g).`);
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

  craftModal.querySelector('[data-craft-close]').addEventListener('click', closeCraft);
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
    closeSettingsDock();
    closeDisplayPicker();
    closeBuild();
    closePlace(true);
    world.beginMoveFurniture(target);
    render(performance.now() / 1000);
  }

  function doRotate(target) {
    if (!target) return;
    world.rotateFurniture(target);
    render(performance.now() / 1000);
  }

  function showFurnMenu(target, clientX, clientY) {
    furnTarget = target;
    furnMenu.querySelector('[data-furn-name]').textContent = (
      target.id === 'chest' ? 'Chest'
        : target.id === 'anvil' ? 'Anvil'
          : target.id === 'range' ? 'Cooking Range'
            : target.id === 'cauldron' ? 'Cauldron'
              : target.id === 'furnace' ? 'Furnace'
                : target.id === 'wheel' ? 'Spinning Wheel'
                  : target.id === 'counter' ? 'Counter'
                    : target.id === 'display' && displayKind(target.index, state) === 'stand' ? 'Mannequin'
                      : target.id === 'display' && displayKind(target.index, state) === 'shelf' ? 'Shelf'
                        : target.id === 'display' ? 'Table'
                          : 'Display'
    );
    const useBtn = furnMenu.querySelector('[data-furn-use]');
    const upgradeBtn = furnMenu.querySelector('[data-furn-upgrade]');
    if (target.id === 'chest' || target.id === 'anvil' || target.id === 'range' || target.id === 'cauldron' || target.id === 'furnace' || target.id === 'wheel') {
      useBtn.hidden = false;
      useBtn.textContent = target.id === 'chest' ? 'Open Chest'
        : target.id === 'range' ? 'Cook'
          : target.id === 'cauldron' ? 'Potions'
            : target.id === 'furnace' ? 'Smelt'
              : target.id === 'wheel' ? 'Spin'
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
    furnMenu.hidden = false;
    const x = Math.min(window.innerWidth - 230, Math.max(8, clientX ?? 24));
    const y = Math.min(window.innerHeight - 220, Math.max(8, clientY ?? 80));
    furnMenu.style.left = `${x}px`;
    furnMenu.style.top = `${y}px`;
  }

  chestModal.querySelector('[data-chest-upgrade]')?.addEventListener('click', openUpgrade);

  potionModal.querySelector('[data-potion-close]').addEventListener('click', closePotion);
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
    if (upgradeChest(state)) {
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
    if (!expandBtn) return;
    expandBtn.classList.toggle('is-on', on);
    expandBtn.title = on ? 'Exit fullscreen' : 'Toggle fullscreen';
    expandBtn.setAttribute('aria-label', expandBtn.title);
  }
  document.addEventListener('fullscreenchange', syncFullscreenBtn);
  expandBtn?.addEventListener('click', toggleFullscreen);

  expandModal.querySelector('[data-expand-close]').addEventListener('click', closeExpand);
  expandModal.querySelector('[data-expand-confirm]').addEventListener('click', () => {
    const padId = world.getSelectedPad();
    if (!padId || !canBuyExpansion(state, padId)) {
      paintExpand();
      return;
    }
    const cost = expansionCost((state.expansions ?? []).length);
    fadeShop(() => {
      if (buyExpansion(state, padId)) {
        world.rebuildAfterExpansion();
        world.setExpandMode(false);
        pushLog(state, `Opened a new room (${padById(padId)?.label ?? padId}) for ${formatGold(cost)}g.`);
      }
      closeExpand();
      render(performance.now() / 1000);
    });
  });

  function paintBuild() {
    const status = buildModal.querySelector('[data-cauldron-status]');
    const buyBtn = buildModal.querySelector('[data-cauldron-buy]');
    if (ownsCauldron(state)) {
      status.textContent = 'Placed in the shop. Click it to brew potions, or right-click to move.';
      buyBtn.disabled = true;
      buyBtn.textContent = 'Owned';
    } else {
      status.textContent = `Costs ${formatGold(CAULDRON_COST)} gp.`;
      buyBtn.disabled = !canBuyCauldron(state);
      buyBtn.textContent = `Buy · ${formatGold(CAULDRON_COST)} gp`;
    }
    for (const station of STATION_UNLOCKS) {
      const itemStatus = buildModal.querySelector(`[data-${station.id}-status]`);
      const itemBuy = buildModal.querySelector(`[data-${station.id}-buy]`);
      if (!itemStatus || !itemBuy) continue;
      if (ownsStation(state, station.id)) {
        itemStatus.textContent = `Placed in the shop. Click it to use, or right-click to move.`;
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = true;
        itemBuy.textContent = 'Owned';
      } else {
        itemStatus.textContent = `Costs ${formatGold(station.cost)} gp.`;
        itemStatus.classList.remove('craft-note');
        itemBuy.disabled = !canBuyStation(state, station.id);
        itemBuy.textContent = `Buy · ${formatGold(station.cost)} gp`;
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
    for (const type of ['table', 'mannequin']) {
      const itemStatus = buildModal.querySelector(`[data-${type}-status]`);
      const itemBuy = buildModal.querySelector(`[data-${type}-buy]`);
      if (!itemStatus || !itemBuy) continue;
      const cost = nextFurnitureCost(state, type);
      const label = furnitureLabelForType(type);
      const bought = state.boughtFurniture?.[type] ?? 0;
      const extra = bought === 0
        ? `First extra ${label.toLowerCase()} costs ${formatGold(cost)}g. Starting pieces do not count.`
        : `Next ${label.toLowerCase()} costs ${formatGold(cost)}g (${bought} bought).`;
      itemStatus.textContent = extra;
      itemStatus.classList.remove('craft-note');
      itemBuy.disabled = false;
      itemBuy.textContent = `Buy · ${formatGold(cost)} gp`;
    }
  }

  function paintPlaceDock() {
    if (!placeModal || !pendingPlace) return;
    const title = placeModal.querySelector('[data-place-title]');
    const blurb = placeModal.querySelector('[data-place-blurb]');
    const costEl = placeModal.querySelector('[data-place-cost]');
    const note = placeModal.querySelector('[data-place-note]');
    const label = stationLabel(pendingPlace.type);
    if (title) title.textContent = `Place ${label}`;
    if (blurb) {
      blurb.textContent = STATION_UNLOCKS.some((item) => item.id === pendingPlace.type)
        ? 'Move it on the floor snap grid, then confirm. Gold is spent only when you confirm placement. Double-click a highlighted cell to confirm.'
        : `Move the ${label.toLowerCase()} on the floor snap grid, then confirm. Gold is spent only when you confirm placement. Right-click to move or rotate it afterward.`;
    }
    if (costEl) costEl.textContent = `Cost: ${formatGold(pendingPlace.cost)} gp.`;
    if (note) {
      note.hidden = !pendingPlace.note;
      note.textContent = pendingPlace.note || '';
    }
  }

  function startFurniturePlace(type) {
    const cost = nextFurnitureCost(state, type);
    const need = furnitureNeedGold(state, type);
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
    world.beginPlaceFurniture(furnitureKindForType(type));
    openPlaceDock();
    paintPlaceDock();
    render(performance.now() / 1000);
  }

  function closeBuild() {
    if (!buildModal) return;
    buildModal.hidden = true;
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
    closeSettingsDock();
    if (!helpModal.hidden) closeHelp();
    closeExpand();
    closePlace(true);
    paintBuild();
    buildModal.hidden = false;
  }

  function closePlace(cancelWorld = false) {
    if (!placeModal) return;
    placeModal.hidden = true;
    pendingPlace = null;
    if (cancelWorld && world.isPlacingUnlock?.()) world.cancelMoveFurniture();
    world.ignorePicks(280);
  }

  function openPlaceDock() {
    closeBuild();
    placeModal.hidden = false;
  }

  document.querySelector('#build-btn')?.addEventListener('click', openBuild);
  buildModal.querySelector('[data-build-close]').addEventListener('click', closeBuild);
  buildModal.querySelector('[data-expand-buy]')?.addEventListener('click', () => {
    closeBuild();
    openExpand();
  });
  function startStationPlace(id) {
    const cost = stationCost(id);
    const label = stationLabel(id).toLowerCase();
    const status = buildModal.querySelector(`[data-${id}-status]`);
    if (!canBuyStation(state, id)) {
      const msg = `Need ${formatGold(cost)}g to buy a ${label}. You have ${formatGold(state.gold)}g.`;
      if (status) {
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
    if (STATION_UNLOCKS.some((item) => item.id === pending.type)) {
      const cost = stationCost(pending.type);
      if (state.gold < cost) {
        pendingPlace.note = `Need ${formatGold(cost)}g. You have ${formatGold(state.gold)}g.`;
        paintPlaceDock();
        pushLog(state, pendingPlace.note);
        render(performance.now() / 1000);
        return;
      }
      if (!buyStation(state, pending.type, pose)) {
        render(performance.now() / 1000);
        return;
      }
      world.confirmPlaceUnlock();
      closePlace();
      pushLog(state, `Placed a ${stationLabel(pending.type).toLowerCase()} for ${formatGold(cost)} gp.`);
      render(performance.now() / 1000);
      return;
    }
    const cost = nextFurnitureCost(state, pending.type);
    const need = furnitureNeedGold(state, pending.type);
    if (need) {
      pendingPlace.note = need;
      paintPlaceDock();
      pushLog(state, need);
      render(performance.now() / 1000);
      return;
    }
    if (!buyFurniture(state, pending.type, pose)) {
      render(performance.now() / 1000);
      return;
    }
    world.confirmPlaceUnlock();
    world.syncDisplays();
    world.refreshSelection(true);
    closePlace();
    const label = furnitureLabelForType(pending.type);
    pushLog(state, `Placed a ${label.toLowerCase()} for ${formatGold(cost)} gp.`);
    render(performance.now() / 1000);
  }

  placeModal.querySelector('[data-place-cancel]').addEventListener('click', () => {
    closePlace(true);
    render(performance.now() / 1000);
  });
  placeModal.querySelector('[data-place-confirm]').addEventListener('click', () => {
    confirmPendingPlace();
  });

  furnMenu.querySelector('[data-furn-close]').addEventListener('click', hideFurnMenu);
  furnMenu.querySelector('[data-furn-move]').addEventListener('click', () => startMove(furnTarget));
  furnMenu.querySelector('[data-furn-rotate]').addEventListener('click', () => doRotate(furnTarget));
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
  furnMenu.querySelector('[data-furn-use]').addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'chest') openChest();
    if (target?.id === 'anvil') openCraft('anvil');
    if (target?.id === 'range') openCraft('range');
    if (target?.id === 'cauldron') openPotion();
    if (target?.id === 'furnace') openCraft('furnace');
    if (target?.id === 'wheel') openCraft('wheel');
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
      item.recipe?.category === 'armour' && item.recipe.combatClass === combat
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
    if (!selectedFillId || !assignStandPiece(state, index, selectedFillId)) {
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
    if (!selectedFillId || !fillStandFromRecipe(state, index, selectedFillId)) {
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
    if (nameEl) {
      nameEl.textContent = track
        ? `${isMusicPlaying() ? 'Playing' : 'Paused'}: ${track}`
        : 'No track loaded. Upload MP3, WAV, or OGG files.';
    }
    if (shuffleBtn) shuffleBtn.classList.toggle('is-on', isShuffle());
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
    closeBuild();
    closeExpand();
    closeSettingsDock();
    hideFurnMenu();
    showMusicNote('');
    setMusicTab('play');
    paintMusic();
    if (musicDock) musicDock.hidden = false;
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
    paintMusic();
  });
  musicDock?.querySelector('[data-music-pause]')?.addEventListener('click', () => {
    pauseMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-shuffle]')?.addEventListener('click', () => {
    toggleShuffle();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-stop]')?.addEventListener('click', () => {
    stopMusic();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-skip]')?.addEventListener('click', async () => {
    await skipTrack();
    paintMusic();
  });
  musicDock?.querySelector('[data-music-volume]')?.addEventListener('input', (event) => {
    const volume = Number(event.target.value) / 100;
    setMusicVolume(volume);
    if (!state.music) state.music = { volume: DEFAULT_MUSIC_VOLUME };
    state.music.volume = volume;
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
    paintMusic();
  });
  setMusicVolume(state.music?.volume ?? DEFAULT_MUSIC_VOLUME);

  function lookOptions(slot) {
    if (slot === 'hair') return HAIR_STYLES;
    if (slot === 'faceHair') return FACE_HAIR;
    return PLAYER_COLORS[slot] ?? [];
  }

  function fillLookGrids() {
    if (!settingsDock) return;
    for (const slot of ['hair', 'shirt', 'legs', 'boots', 'faceHair']) {
      const row = settingsDock.querySelector(`[data-look="${slot}"]`);
      if (!row || row.dataset.ready) continue;
      row.innerHTML = lookOptions(slot).map((item) => (
        `<button type="button" data-look-id="${item.id}">${item.label}</button>`
      )).join('');
      row.dataset.ready = '1';
      row.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-look-id]');
        if (!btn) return;
        const next = normalizeAppearance({
          ...(state.appearance ?? defaultAppearance()),
          [slot]: btn.dataset.lookId,
        });
        const applied = world.setAppearance?.(next);
        if (applied === false) {
          state.appearance = next;
        }
        paintSettings();
        render(performance.now() / 1000);
      });
    }
  }

  function paintSettings() {
    if (!settingsDock) return;
    fillLookGrids();
    const current = state.skybox ?? 'blue';
    for (const btn of settingsDock.querySelectorAll('[data-skybox]')) {
      btn.classList.toggle('is-on', btn.dataset.skybox === current);
    }
    const look = normalizeAppearance(state.appearance);
    for (const slot of ['hair', 'shirt', 'legs', 'boots', 'faceHair']) {
      const row = settingsDock.querySelector(`[data-look="${slot}"]`);
      if (!row) continue;
      for (const btn of row.querySelectorAll('[data-look-id]')) {
        btn.classList.toggle('is-on', btn.dataset.lookId === look[slot]);
      }
    }
    const note = settingsDock.querySelector('[data-look-note]');
    if (note) {
      note.textContent = world.hasCustomPlayer?.()
        ? 'A custom player mesh is active. Walking still works; hair and colour customizer may not apply until you clear the upload.'
        : 'Hair, shirt, legs, boots, and face hair save with the shop.';
    }
  }

  function openSettings() {
    closeBuild();
    closeExpand();
    closeMusicDock();
    hideFurnMenu();
    paintSettings();
    if (settingsDock) settingsDock.hidden = false;
  }

  settingsBtn?.addEventListener('click', () => {
    if (settingsDock?.hidden === false) closeSettingsDock();
    else openSettings();
  });
  settingsDock?.querySelector('[data-settings-close]')?.addEventListener('click', closeSettingsDock);
  settingsDock?.querySelector('[data-skybox-list]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-skybox]');
    if (!btn) return;
    const id = SKYBOXES.some((item) => item.id === btn.dataset.skybox) ? btn.dataset.skybox : 'blue';
    world.setSkybox(id);
    paintSettings();
  });
  settingsDock?.querySelector('[data-cheat-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = settingsDock.querySelector('[data-cheat-code]');
    const note = settingsDock.querySelector('[data-cheat-note]');
    const result = applyCheat(state, input?.value ?? '');
    if (input) input.value = '';
    if (!result) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Unknown code.';
      }
      return;
    }
    if (result === 'freshstart') {
      world.applyLayout();
      world.syncDisplays();
      world.refreshSelection(true);
      paintCrafts();
      paintBuild();
    } else if (result === 'onesmallfavour') {
      world.setChefHat(true);
    } else if (result === 'maxcape') {
      paintCrafts();
    }
    const messages = {
      motherlode: 'Motherlode: +10,000 gp.',
      '-motherlode': state.gold <= 0
        ? '−Motherlode: −10,000 gp (clamped at 0).'
        : '−Motherlode: −10,000 gp.',
      freshstart: 'Fresh start. All progress reset.',
      maxcape: 'Maxcape: every craft line is unlocked.',
      onesmallfavour: 'A chef hat sits on your head.',
    };
    if (note) {
      note.hidden = false;
      note.textContent = messages[result] ?? 'Done.';
    }
    pushLog(state, messages[result] ?? 'Cheat applied.');
    render(performance.now() / 1000);
  });

  world.onPick((event) => {
    if (event.type !== 'furn-menu') hideFurnMenu();
    if (event.type === 'chest') openChest();
    if (event.type === 'anvil') openCraft('anvil');
    if (event.type === 'range') openCraft('range');
    if (event.type === 'cauldron') openPotion();
    if (event.type === 'furnace') openCraft('furnace');
    if (event.type === 'wheel') openCraft('wheel');
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
  setModalOpen();

  const saveBtn = document.querySelector('#save-btn');
  const loadBtn = document.querySelector('#load-btn');
  saveBtn?.addEventListener('click', async () => {
    try {
      if (await saveStateToFile(state)) pushLog(state, 'Shop saved to a file.');
    } catch {
      pushLog(state, 'Could not save that file.');
    }
    render(performance.now() / 1000);
  });
  loadBtn?.addEventListener('click', async () => {
    try {
      if (await loadStateFromFile(state)) {
        world.applyLayout();
        world.syncDisplays();
        world.refreshSelection(true);
        setMusicVolume(state.music?.volume ?? DEFAULT_MUSIC_VOLUME);
        paintCrafts();
        paintMusic();
        paintSettings();
        pushLog(state, 'Shop loaded from a file.');
      }
    } catch {
      pushLog(state, 'Could not read that save file.');
    }
    render(performance.now() / 1000);
  });

  document.addEventListener('click', (event) => {
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
      btn.classList.toggle('is-locked', locked);
      row?.classList.toggle('is-locked', locked);
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
      }
    }
  }

  function render(now) {
    const dt = lastPreviewAt ? Math.min(0.05, Math.max(0, now - lastPreviewAt)) : 0;
    lastPreviewAt = now;
    if (!craftModal.hidden) craftPreview?.tick(dt);
    if (!potionModal.hidden) potionPreview?.tick(dt);
    goldEl.textContent = `Coins: ${formatGold(state.gold)}`;
    const xp = shopProgress(state.shopXp ?? 0);
    const levelEl = document.querySelector('#shop-level');
    const xpBar = document.querySelector('[data-shop-xp-bar]');
    if (levelEl) levelEl.textContent = `Lv ${xp.level}`;
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
    if (!craftModal.hidden) paintBusy(craftsEl, currentRecipes(), now);
    if (!potionModal.hidden) paintBusy(potionCraftsEl, recipesForTab('potion'), now);
    const busyId = Object.keys(state.crafts ?? {})[0];
    if (activeCraft) {
      if (busyId) {
        const progress = craftProgress(state, busyId, now);
        activeCraft.hidden = false;
        if (activeCraftName) {
          const batch = progress?.total > 1 ? ` (${progress.done + 1}/${progress.total})` : '';
          activeCraftName.textContent = `Crafting ${RECIPES[busyId].name}${batch}`;
        }
        activeCraft.style.setProperty('--t', String(progress?.t ?? 0));
      } else {
        activeCraft.hidden = true;
        activeCraft.style.setProperty('--t', '0');
      }
    }
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
  }

  return { render, openChest, openTrade, openCraft, openOfferPicker, selectOfferItem };
}
