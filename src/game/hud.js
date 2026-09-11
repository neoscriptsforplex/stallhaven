import {
  ANVIL_TABS,
  CUSTOMERS,
  MATERIALS,
  RECIPES,
  classLabel,
  costLabel,
  materialList,
  recipesForTab,
} from './catalog.js';
import { playClick } from './audio.js';
import {
  buyCauldron,
  buyExpansion,
  buyFromCustomer,
  canBuyCauldron,
  canBuyExpansion,
  canCraft,
  canRestock,
  canUpgradeChest,
  CAULDRON_COST,
  chestCapacity,
  chestList,
  chestTotal,
  craftProgress,
  hasStock,
  isUnlocked,
  ownsCauldron,
  placeFromChest,
  pushLog,
  restock,
  offerChoices,
  sellToCustomer,
  startCraft,
  unlockRemaining,
  upgradeChest,
} from './economy.js';
import {
  CHEST_MAX_LEVEL,
  chestSlots,
  chestUpgradeCost,
  expansionCost,
  padById,
} from './layout.js';
import { loadStateFromFile, saveStateToFile } from './savefile.js';

export function bindHud(root, state, world) {
  const goldEl = root.querySelector('#gold');
  const matsEl = document.querySelector('#materials');
  const craftsEl = document.querySelector('#crafts');
  const tabsEl = document.querySelector('#craft-tabs');
  const stockEl = root.querySelector('#stock');
  const chestCountEl = document.querySelector('#chest-count');
  const importModal = document.querySelector('#import-modal');
  const helpModal = document.querySelector('#help-modal');
  const dismiss = helpModal.querySelector('[data-dismiss]');
  const chestModal = document.querySelector('#chest-modal');
  const chestItems = document.querySelector('#chest-items');
  const tradeModal = document.querySelector('#trade-modal');
  const offerModal = document.querySelector('#offer-modal');
  const offerItems = document.querySelector('#offer-items');
  const craftModal = document.querySelector('#craft-modal');
  const upgradeModal = document.querySelector('#chest-upgrade-modal');
  const expandModal = document.querySelector('#expand-dock');
  const buildModal = document.querySelector('#build-dock');
  const placeModal = document.querySelector('#place-dock');
  const potionModal = document.querySelector('#potion-modal');
  const furnMenu = document.querySelector('#furn-menu');
  const shopFade = document.querySelector('#shop-fade');
  const activeCraft = root.querySelector('#active-craft');
  const activeCraftName = activeCraft?.querySelector('[data-active-craft-name]');
  const chestCapEl = document.querySelector('#chest-cap');

  let craftTab = 'melee';
  let craftStation = 'anvil';
  let tradeActor = null;
  let furnTarget = null;
  let selectedOfferId = null;

  tabsEl.innerHTML = ANVIL_TABS.map((tab) => (
    `<button type="button" class="tab" data-tab="${tab.id}">${tab.label}</button>`
  )).join('');

  function currentRecipes() {
    if (craftStation === 'range') return recipesForTab('food');
    return recipesForTab(craftTab);
  }

  function paintCrafts() {
    const rangeMode = craftStation === 'range';
    tabsEl.hidden = rangeMode;
    const title = craftModal.querySelector('[data-craft-title]');
    const blurb = craftModal.querySelector('[data-craft-blurb]');
    if (title) title.textContent = rangeMode ? 'Cooking Range' : 'Anvil';
    if (blurb) {
      blurb.textContent = rangeMode
        ? 'Bake food here. Finished plates land in the chest or on a wall shelf.'
        : 'Work a ware here. Finished pieces land in the chest. Higher tiers stay locked until you craft enough of the previous item in that line.';
    }
    for (const btn of tabsEl.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === craftTab);
    }
    if (!rangeMode && craftTab === 'potion') {
      craftsEl.innerHTML = '<p class="empty">Potion recipes are coming later.</p>';
      return;
    }
    const recipes = currentRecipes();
    const groups = new Map();
    for (const recipe of recipes) {
      const groupKey = recipe.category === 'armour' ? 'armour' : recipe.category === 'food' ? 'food' : 'weapon';
      if (!groups.has(groupKey)) groups.set(groupKey, new Map());
      const lines = groups.get(groupKey);
      const lineId = recipe.lineId || recipe.id;
      if (!lines.has(lineId)) lines.set(lineId, []);
      lines.get(lineId).push(recipe);
    }
    const groupTitle = { weapon: 'Weapons', armour: 'Armour', food: 'Kitchen' };
    craftsEl.innerHTML = [...groups.entries()].map(([key, lines]) => {
      const heading = groups.size > 1 ? `<h3 class="group">${groupTitle[key] ?? classLabel(key)}</h3>` : '';
      const blocks = [...lines.entries()].map(([, list]) => {
        list.sort((a, b) => a.lineIndex - b.lineIndex);
        const lineTitle = list[0]?.lineName ? `<h4 class="line">${list[0].lineName}</h4>` : '';
        return lineTitle + list.map((recipe) => {
          const locked = !isUnlocked(state, recipe.id);
          const prev = recipe.previousId ? RECIPES[recipe.previousId] : null;
          const remain = unlockRemaining(state, recipe.id);
          const lockText = locked
            ? `Locked · ${remain} more ${prev?.name ?? 'crafts'}`
            : costLabel(recipe);
          return `
            <button type="button" class="craft${locked ? ' is-locked' : ''}" data-craft="${recipe.id}">
              <strong>${recipe.name}</strong>
              <span class="meta">${lockText}</span>
              <span class="timer" data-timer="${recipe.id}"></span>
              <span class="craft-bar" aria-hidden="true"><i data-bar="${recipe.id}"></i></span>
            </button>
          `;
        }).join('');
      }).join('');
      return heading + blocks;
    }).join('');
  }
  paintCrafts();

  matsEl.innerHTML = materialList().map((mat) => `
    <div class="mat" data-mat="${mat.id}">
      <span class="mat-name">${mat.name}</span>
      <span class="mat-count" data-count="${mat.id}">0</span>
      <button type="button" class="restock" data-restock="${mat.id}">${mat.restock}g</button>
    </div>
  `).join('');

  tabsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    craftTab = btn.dataset.tab;
    paintCrafts();
    render(performance.now() / 1000);
  });

  craftsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-craft]');
    if (!btn) return;
    if (startCraft(state, btn.dataset.craft, performance.now() / 1000)) {
      playClick('craft');
      pushLog(state, `Crafting ${RECIPES[btn.dataset.craft].name}…`);
      render(performance.now() / 1000);
    }
  });

  matsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-restock]');
    if (!btn) return;
    if (restock(state, btn.dataset.restock)) render(performance.now() / 1000);
  });

  stockEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-stock]');
    if (!btn) return;
    if (placeFromChest(state, btn.dataset.stock)) {
      world.syncDisplays();
      render(performance.now() / 1000);
    }
  });

  chestModal.querySelector('[data-chest-close]').addEventListener('click', closeChest);
  chestModal.addEventListener('click', (event) => {
    if (event.target === chestModal) closeChest();
  });
  chestItems.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-place]');
    if (!btn) return;
    if (placeFromChest(state, btn.dataset.place)) {
      world.syncDisplays();
      paintChest();
      render(performance.now() / 1000);
    }
  });

  function setModalOpen() {
    const open = !chestModal.hidden || !tradeModal.hidden || !helpModal.hidden || !craftModal.hidden
      || !upgradeModal.hidden || !offerModal.hidden || !potionModal.hidden
      || (importModal && !importModal.hidden);
    document.body.classList.toggle('modal-open', open);
  }

  function hideFurnMenu() {
    furnMenu.hidden = true;
    furnTarget = null;
  }

  function openCraft(station = 'anvil') {
    closeChest();
    closeTrade();
    closeUpgrade();
    closePotion();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    closeBuild();
    craftStation = station;
    if (station === 'range') craftTab = 'food';
    else if (craftTab === 'food') craftTab = 'melee';
    paintCrafts();
    craftModal.hidden = false;
    setModalOpen();
    render(performance.now() / 1000);
  }

  function closeCraft() {
    craftModal.hidden = true;
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

  function openPotion() {
    closeChest();
    closeCraft();
    closeTrade();
    closeUpgrade();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    closeBuild();
    potionModal.hidden = false;
    setModalOpen();
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
    costEl.textContent = `Cost: ${cost}g.`;
    buyBtn.disabled = !canUpgradeChest(state);
  }

  function openUpgrade() {
    closeChest();
    closeCraft();
    closeTrade();
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    paintUpgrade();
    upgradeModal.hidden = false;
    setModalOpen();
  }

  function openChest() {
    closeTrade();
    closeCraft();
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
    if (!items.length) {
      chestItems.innerHTML = '<p class="empty">The chest is empty. Craft a ware and it will land here.</p>';
      return;
    }
    chestItems.innerHTML = items.map(({ recipe, count }) => `
      <div class="chest-row">
        <div>
          <strong>${recipe.name}</strong>
          <span class="meta">×${count} · ${classLabel(recipe.combatClass)} · sells ${recipe.price}g</span>
        </div>
        <button type="button" data-place="${recipe.id}">Place on Stall</button>
      </div>
    `).join('');
  }

  function closeOfferPicker() {
    offerModal.hidden = true;
    selectedOfferId = null;
    if (tradeActor) tradeModal.hidden = false;
    setModalOpen();
  }

  function openTrade(actor) {
    if (!actor || actor.state === 'leave') return;
    closeChest();
    closeCraft();
    closeOfferPicker();
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
    tradeModal.querySelector('[data-trade-offer]').textContent = `Offers ${actor.offerGold}g.`;
    const haveEl = tradeModal.querySelector('[data-trade-have]');
    haveEl.textContent = have
      ? `You have ${recipe.name} in the chest.`
      : `You do not have ${recipe.name} yet. Craft it, then sell.`;
    haveEl.classList.toggle('have', have);
    haveEl.classList.toggle('lack', !have);
    const buyLine = tradeModal.querySelector('[data-trade-buy]');
    if (offerMat) {
      buyLine.hidden = false;
      buyLine.textContent = `They will sell 1 ${offerMat.name} for ${offer.price}g.`;
    } else {
      buyLine.hidden = true;
    }
    const choices = offerChoices(state, actor.requestRecipeId);
    const offerLine = tradeModal.querySelector('[data-trade-offer-hint]');
    const offerBtn = tradeModal.querySelector('[data-trade-offer-btn]');
    if (choices.length) {
      offerLine.hidden = false;
      offerLine.textContent = `You can choose a chest item to sell at a reduced price (${choices.length} available).`;
      offerBtn.disabled = false;
    } else {
      offerLine.hidden = false;
      offerLine.textContent = 'No other chest item to trade at a reduced price.';
      offerBtn.disabled = true;
    }
    tradeModal.querySelector('[data-trade-sell]').disabled = !have;
    tradeModal.querySelector('[data-trade-buy-btn]').disabled = !offer || state.gold < offer.price;
  }

  function paintOfferPicker() {
    const actor = tradeActor;
    const pickEl = offerModal.querySelector('[data-offer-pick]');
    const confirm = offerModal.querySelector('[data-offer-confirm]');
    if (!actor) {
      offerItems.innerHTML = '<p class="empty">No traveler is waiting.</p>';
      pickEl.textContent = 'No item selected yet.';
      confirm.disabled = true;
      return;
    }
    const choices = offerChoices(state, actor.requestRecipeId);
    if (!choices.length) {
      offerItems.innerHTML = '<p class="empty">The chest has no other item to offer.</p>';
      selectedOfferId = null;
      pickEl.textContent = 'No item selected yet.';
      confirm.disabled = true;
      return;
    }
    if (selectedOfferId && !choices.some((choice) => choice.recipeId === selectedOfferId)) {
      selectedOfferId = null;
    }
    offerItems.innerHTML = choices.map((choice) => `
      <button type="button" class="offer-row${choice.recipeId === selectedOfferId ? ' is-on' : ''}" data-offer-item="${choice.recipeId}">
        <span>
          <strong>${choice.name}</strong>
          <span class="meta">×${choice.count} in chest</span>
        </span>
        <span>
          <span class="offer-price">${choice.gold}g</span>
          <span class="offer-was">${choice.listPrice}g</span>
        </span>
      </button>
    `).join('');
    const selected = choices.find((choice) => choice.recipeId === selectedOfferId);
    if (selected) {
      pickEl.textContent = `Selected: ${selected.name} for ${selected.gold}g (reduced from ${selected.listPrice}g).`;
      confirm.disabled = false;
    } else {
      pickEl.textContent = 'No item selected yet.';
      confirm.disabled = true;
    }
  }

  function openOfferPicker() {
    const actor = tradeActor;
    if (!actor || actor.state === 'leave') {
      closeTrade();
      return;
    }
    selectedOfferId = null;
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
    pushLog(state, `Sold ${RECIPES[recipeId].name} to ${CUSTOMERS[actor.typeId].name} for ${paid}g.`);
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
      pushLog(state, `Bought ${mat.name} from ${CUSTOMERS[actor.typeId].name} for ${actor.offer.price}g.`);
      world.buyFromActor(actor);
      closeTrade();
      render(performance.now() / 1000);
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

  offerItems.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-offer-item]');
    if (!btn) return;
    selectedOfferId = btn.dataset.offerItem;
    paintOfferPicker();
  });

  offerModal.querySelector('[data-offer-cancel]').addEventListener('click', () => {
    closeOfferPicker();
    world.ignorePicks(280);
  });
  offerModal.querySelector('[data-offer-confirm]').addEventListener('click', () => {
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
    const paid = sellToCustomer(state, choice.recipeId, choice.gold);
    if (!paid) {
      paintOfferPicker();
      paintTrade();
      return;
    }
    playClick('trade');
    pushLog(state, `Offered ${RECIPES[choice.recipeId].name} to ${CUSTOMERS[actor.typeId].name} for ${paid}g (reduced from ${choice.listPrice}g).`);
    actor.requestRecipeId = choice.recipeId;
    world.sellToActor(actor);
    world.syncDisplays();
    closeTrade();
    render(performance.now() / 1000);
  });

  tradeModal.querySelector('[data-trade-close]').addEventListener('click', closeTrade);

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
              : target.id === 'counter' ? 'Counter'
                : 'Display'
    );
    const useBtn = furnMenu.querySelector('[data-furn-use]');
    if (target.id === 'chest' || target.id === 'anvil' || target.id === 'range' || target.id === 'cauldron') {
      useBtn.hidden = false;
      useBtn.textContent = target.id === 'chest' ? 'Open Chest'
        : target.id === 'range' ? 'Cook'
          : target.id === 'cauldron' ? 'Potions'
            : 'Craft';
    } else {
      useBtn.hidden = true;
    }
    furnMenu.hidden = false;
    const x = Math.min(window.innerWidth - 230, Math.max(8, clientX ?? 24));
    const y = Math.min(window.innerHeight - 180, Math.max(8, clientY ?? 80));
    furnMenu.style.left = `${x}px`;
    furnMenu.style.top = `${y}px`;
  }

  chestModal.querySelector('[data-chest-move]')?.addEventListener('click', () => startMove({ id: 'chest' }));
  chestModal.querySelector('[data-chest-rotate]')?.addEventListener('click', () => doRotate({ id: 'chest' }));
  chestModal.querySelector('[data-chest-upgrade]')?.addEventListener('click', openUpgrade);
  craftModal.querySelector('[data-craft-move]')?.addEventListener('click', () => {
    startMove({ id: craftStation === 'range' ? 'range' : 'anvil' });
  });
  craftModal.querySelector('[data-craft-rotate]')?.addEventListener('click', () => {
    doRotate({ id: craftStation === 'range' ? 'range' : 'anvil' });
  });

  potionModal.querySelector('[data-potion-close]').addEventListener('click', closePotion);
  potionModal.addEventListener('click', (event) => {
    if (event.target === potionModal) closePotion();
  });
  potionModal.querySelector('[data-potion-move]').addEventListener('click', () => startMove({ id: 'cauldron' }));
  potionModal.querySelector('[data-potion-rotate]').addEventListener('click', () => doRotate({ id: 'cauldron' }));

  upgradeModal.querySelector('[data-upgrade-close]').addEventListener('click', closeUpgrade);
  upgradeModal.addEventListener('click', (event) => {
    if (event.target === upgradeModal) closeUpgrade();
  });
  upgradeModal.querySelector('[data-upgrade-buy]').addEventListener('click', () => {
    const level = state.chestLevel ?? 1;
    const cost = chestUpgradeCost(level);
    if (upgradeChest(state)) {
      pushLog(state, `Chest upgraded to level ${state.chestLevel} (${chestSlots(state.chestLevel)} slots) for ${cost}g.`);
      paintUpgrade();
      paintChest();
      render(performance.now() / 1000);
    }
  });

  function paintExpand() {
    const cost = expansionCost((state.expansions ?? []).length);
    expandModal.querySelector('[data-expand-cost]').textContent = `Next room costs ${cost}g.`;
    const padId = world.getSelectedPad();
    const pickEl = expandModal.querySelector('[data-expand-pick]');
    const confirm = expandModal.querySelector('[data-expand-confirm]');
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
    hideFurnMenu();
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
    requestAnimationFrame(() => shopFade.classList.add('is-on'));
    window.setTimeout(() => {
      then?.();
      shopFade.classList.remove('is-on');
      window.setTimeout(() => {
        shopFade.hidden = true;
      }, 450);
    }, 480);
  }

  document.querySelector('#expand-btn')?.addEventListener('click', openExpand);
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
        pushLog(state, `Opened a new room (${padById(padId)?.label ?? padId}) for ${cost}g.`);
      }
      closeExpand();
      render(performance.now() / 1000);
    });
  });

  function paintBuild() {
    const status = buildModal.querySelector('[data-cauldron-status]');
    const buyBtn = buildModal.querySelector('[data-cauldron-buy]');
    if (ownsCauldron(state)) {
      status.textContent = 'Placed in the shop. Click it to move or to open the potion note.';
      buyBtn.disabled = true;
      buyBtn.textContent = 'Owned';
      return;
    }
    status.textContent = `Costs ${CAULDRON_COST.toLocaleString()} gp.`;
    buyBtn.disabled = !canBuyCauldron(state);
    buyBtn.textContent = `Buy · ${CAULDRON_COST.toLocaleString()} gp`;
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
    hideFurnMenu();
    if (!helpModal.hidden) closeHelp();
    closeExpand();
    closePlace(true);
    paintBuild();
    buildModal.hidden = false;
  }

  function closePlace(cancelWorld = false) {
    if (!placeModal) return;
    placeModal.hidden = true;
    if (cancelWorld && world.isPlacingUnlock?.()) world.cancelMoveFurniture();
    world.ignorePicks(280);
  }

  function openPlaceDock() {
    closeBuild();
    placeModal.hidden = false;
  }

  document.querySelector('#build-btn')?.addEventListener('click', openBuild);
  buildModal.querySelector('[data-build-close]').addEventListener('click', closeBuild);
  buildModal.querySelector('[data-cauldron-buy]').addEventListener('click', () => {
    if (!canBuyCauldron(state)) {
      paintBuild();
      return;
    }
    world.beginPlaceUnlock('cauldron');
    openPlaceDock();
    render(performance.now() / 1000);
  });
  placeModal.querySelector('[data-place-cancel]').addEventListener('click', () => {
    closePlace(true);
    render(performance.now() / 1000);
  });
  placeModal.querySelector('[data-place-confirm]').addEventListener('click', () => {
    const pose = world.getPlacePose();
    if (!pose || state.gold < CAULDRON_COST) {
      render(performance.now() / 1000);
      return;
    }
    if (!buyCauldron(state, pose)) {
      render(performance.now() / 1000);
      return;
    }
    world.confirmPlaceUnlock();
    closePlace();
    pushLog(state, `Placed a cauldron for ${CAULDRON_COST.toLocaleString()} gp.`);
    render(performance.now() / 1000);
  });

  furnMenu.querySelector('[data-furn-close]').addEventListener('click', hideFurnMenu);
  furnMenu.querySelector('[data-furn-move]').addEventListener('click', () => startMove(furnTarget));
  furnMenu.querySelector('[data-furn-rotate]').addEventListener('click', () => doRotate(furnTarget));
  furnMenu.querySelector('[data-furn-use]').addEventListener('click', () => {
    const target = furnTarget;
    hideFurnMenu();
    if (target?.id === 'chest') openChest();
    if (target?.id === 'anvil') openCraft('anvil');
    if (target?.id === 'range') openCraft('range');
    if (target?.id === 'cauldron') openPotion();
  });

  world.onPick((event) => {
    if (event.type !== 'furn-menu' && event.type !== 'display' && event.type !== 'counter' && event.type !== 'expand-pad') {
      hideFurnMenu();
    }
    if (event.type === 'chest') openChest();
    if (event.type === 'anvil') openCraft('anvil');
    if (event.type === 'range') openCraft('range');
    if (event.type === 'cauldron') openPotion();
    if (event.type === 'counter') showFurnMenu(event.furniture, event.clientX, event.clientY);
    if (event.type === 'display') showFurnMenu(event.furniture, event.clientX, event.clientY);
    if (event.type === 'chest-upgrade') openUpgrade();
    if (event.type === 'furn-menu') showFurnMenu(event.furniture, event.clientX, event.clientY);
    if (event.type === 'expand-pad') paintExpand();
    if (event.type === 'customer' && event.actor?.state === 'request') openTrade(event.actor);
    if (event.type === 'furniture-cancel') closePlace();
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
        paintCrafts();
        lastStockKey = null;
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
    if (btn.dataset.craft || btn.hasAttribute('data-trade-sell') || btn.hasAttribute('data-trade-buy-btn') || btn.hasAttribute('data-trade-offer-btn') || btn.hasAttribute('data-offer-confirm')) return;
    playClick('ui');
  });

  let lastStockKey = null;
  let lastUnlockKey = null;

  function render(now) {
    goldEl.textContent = `Coins: ${state.gold}`;
    const chestN = chestTotal(state);
    chestCountEl.textContent = `${chestN} piece${chestN === 1 ? '' : 's'} waiting`;
    for (const mat of materialList()) {
      const count = matsEl.querySelector(`[data-count="${mat.id}"]`);
      if (count) count.textContent = `×${state.materials[mat.id] ?? 0}`;
      const btn = matsEl.querySelector(`[data-restock="${mat.id}"]`);
      if (btn) btn.disabled = !canRestock(state, mat.id);
    }
    const unlockKey = Object.entries(state.craftCounts ?? {}).map(([id, n]) => `${id}:${n}`).join('|');
    if (unlockKey !== lastUnlockKey) {
      lastUnlockKey = unlockKey;
      paintCrafts();
    }
    for (const recipe of currentRecipes()) {
      const btn = craftsEl.querySelector(`[data-craft="${recipe.id}"]`);
      const timer = craftsEl.querySelector(`[data-timer="${recipe.id}"]`);
      if (!btn || !timer) continue;
      const progress = craftProgress(state, recipe.id, now);
      const locked = !isUnlocked(state, recipe.id);
      btn.classList.toggle('is-locked', locked);
      if (progress) {
        btn.disabled = true;
        btn.classList.add('is-busy');
        timer.textContent = `${Math.ceil(progress.left)}s`;
        btn.style.setProperty('--t', String(progress.t));
      } else {
        btn.disabled = !canCraft(state, recipe.id);
        btn.classList.remove('is-busy');
        timer.textContent = '';
        btn.style.setProperty('--t', '0');
      }
    }
    const busyId = Object.keys(state.crafts ?? {})[0];
    if (activeCraft) {
      if (busyId) {
        const progress = craftProgress(state, busyId, now);
        activeCraft.hidden = false;
        if (activeCraftName) activeCraftName.textContent = `Crafting ${RECIPES[busyId].name}`;
        activeCraft.style.setProperty('--t', String(progress?.t ?? 0));
      } else {
        activeCraft.hidden = true;
        activeCraft.style.setProperty('--t', '0');
      }
    }
    const stockKey = chestList(state).map((item) => `${item.recipeId}:${item.count}`).join('|');
    if (stockKey !== lastStockKey) {
      lastStockKey = stockKey;
      const items = chestList(state);
      if (items.length) {
        stockEl.hidden = false;
        stockEl.innerHTML = '<p>Chest — Click to Show on the Selected Stall</p>' + items.map((item) => (
          `<button type="button" data-stock="${item.recipeId}">${item.recipe.name} ×${item.count}</button>`
        )).join('');
      } else {
        stockEl.hidden = true;
        stockEl.innerHTML = '';
      }
      if (!chestModal.hidden) paintChest();
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

  return { render, openChest, openTrade, openCraft, openOfferPicker };
}
