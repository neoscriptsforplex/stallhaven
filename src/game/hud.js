import {
  CRAFT_TABS,
  CUSTOMERS,
  MATERIALS,
  RECIPES,
  SHOP,
  classLabel,
  costLabel,
  materialList,
  recipesForTab,
} from './catalog.js';
import {
  buyFromCustomer,
  canCraft,
  canRestock,
  chestList,
  chestTotal,
  craftProgress,
  hasStock,
  placeFromChest,
  pushLog,
  restock,
  sellToCustomer,
  startCraft,
} from './economy.js';

export function bindHud(root, state, world) {
  const goldEl = root.querySelector('#gold');
  const matsEl = root.querySelector('#materials');
  const craftsEl = document.querySelector('#crafts');
  const tabsEl = document.querySelector('#craft-tabs');
  const stockEl = root.querySelector('#stock');
  const logEl = root.querySelector('#log');
  const selectedEl = root.querySelector('#selected');
  const chestCountEl = root.querySelector('#chest-count');
  const tooltip = document.querySelector('#tooltip');
  const dismiss = tooltip.querySelector('[data-dismiss]');
  const chestModal = document.querySelector('#chest-modal');
  const chestItems = document.querySelector('#chest-items');
  const tradeModal = document.querySelector('#trade-modal');
  const craftModal = document.querySelector('#craft-modal');

  let craftTab = 'weapon';
  let tradeActor = null;

  tabsEl.innerHTML = CRAFT_TABS.map((tab) => (
    `<button type="button" class="tab" data-tab="${tab.id}">${tab.label}</button>`
  )).join('');

  function paintCrafts() {
    const recipes = recipesForTab(craftTab);
    const groups = new Map();
    for (const recipe of recipes) {
      const key = recipe.combatClass || 'road';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(recipe);
    }
    craftsEl.innerHTML = [...groups.entries()].map(([key, list]) => {
      const heading = craftTab === 'provision' ? '' : `<h3 class="group">${classLabel(key)}</h3>`;
      return heading + list.map((recipe) => `
        <button type="button" class="craft" data-craft="${recipe.id}">
          <strong>${recipe.name}</strong>
          <span class="meta">${costLabel(recipe)}</span>
          <span class="timer" data-timer="${recipe.id}"></span>
        </button>
      `).join('');
    }).join('');
    for (const btn of tabsEl.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-on', btn.dataset.tab === craftTab);
    }
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
      pushLog(state, `Crafting ${RECIPES[btn.dataset.craft].name}…`);
      render(performance.now() / 1000);
    }
  });

  matsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-restock]');
    if (!btn) return;
    if (restock(state, btn.dataset.restock)) render(performance.now() / 1000);
  });

  root.querySelector('#next-display').addEventListener('click', () => {
    state.selectedDisplay = (state.selectedDisplay + 1) % SHOP.displays.length;
    world.refreshSelection();
    render(performance.now() / 1000);
  });

  stockEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-stock]');
    if (!btn) return;
    if (placeFromChest(state, btn.dataset.stock)) {
      world.syncDisplays();
      render(performance.now() / 1000);
    }
  });

  root.querySelector('#open-anvil').addEventListener('click', () => openCraft());
  root.querySelector('#open-chest').addEventListener('click', () => openChest());
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
    const open = !chestModal.hidden || !tradeModal.hidden || !tooltip.hidden || !craftModal.hidden;
    document.body.classList.toggle('modal-open', open);
  }

  function openCraft() {
    closeChest();
    closeTrade();
    craftModal.hidden = false;
    setModalOpen();
    render(performance.now() / 1000);
  }

  function closeCraft() {
    craftModal.hidden = true;
    world.ignorePicks(280);
    setModalOpen();
  }

  function openChest() {
    closeTrade();
    closeCraft();
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
        <button type="button" data-place="${recipe.id}">Place on stall</button>
      </div>
    `).join('');
  }

  function openTrade(actor) {
    if (!actor || actor.state === 'leave') return;
    closeChest();
    closeCraft();
    tradeActor = actor;
    world.setTrading(actor.id);
    paintTrade();
    tradeModal.hidden = false;
    setModalOpen();
  }

  function closeTrade() {
    tradeModal.hidden = true;
    tradeActor = null;
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
    tradeModal.querySelector('[data-trade-sell]').disabled = !have;
    tradeModal.querySelector('[data-trade-buy-btn]').disabled = !offer || state.gold < offer.price;
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
      const mat = MATERIALS[actor.offer.materialId];
      pushLog(state, `Bought ${mat.name} from ${CUSTOMERS[actor.typeId].name} for ${actor.offer.price}g.`);
      world.buyFromActor(actor);
      closeTrade();
      render(performance.now() / 1000);
    }
  });

  tradeModal.querySelector('[data-trade-close]').addEventListener('click', closeTrade);
  tradeModal.addEventListener('click', (event) => {
    if (event.target === tradeModal) closeTrade();
  });

  craftModal.querySelector('[data-craft-close]').addEventListener('click', closeCraft);
  craftModal.addEventListener('click', (event) => {
    if (event.target === craftModal) closeCraft();
  });

  world.onPick((event) => {
    if (event.type === 'chest') openChest();
    if (event.type === 'anvil') openCraft();
    if (event.type === 'customer') openTrade(event.actor);
  });

  if (!localStorage.getItem('stallhaven-tip')) {
    tooltip.hidden = false;
  }
  dismiss.addEventListener('click', () => {
    tooltip.hidden = true;
    localStorage.setItem('stallhaven-tip', '1');
    world.ignorePicks(280);
    setModalOpen();
  });
  setModalOpen();

  let lastStockKey = null;
  let lastLogKey = null;

  function render(now) {
    goldEl.textContent = `${state.gold}g`;
    chestCountEl.textContent = String(chestTotal(state));
    for (const mat of materialList()) {
      const count = matsEl.querySelector(`[data-count="${mat.id}"]`);
      if (count) count.textContent = `×${state.materials[mat.id]}`;
      const btn = matsEl.querySelector(`[data-restock="${mat.id}"]`);
      if (btn) btn.disabled = !canRestock(state, mat.id);
    }
    for (const recipe of recipesForTab(craftTab)) {
      const btn = craftsEl.querySelector(`[data-craft="${recipe.id}"]`);
      const timer = craftsEl.querySelector(`[data-timer="${recipe.id}"]`);
      if (!btn || !timer) continue;
      const progress = craftProgress(state, recipe.id, now);
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
    const stockKey = chestList(state).map((item) => `${item.recipeId}:${item.count}`).join('|');
    if (stockKey !== lastStockKey) {
      lastStockKey = stockKey;
      const items = chestList(state);
      if (items.length) {
        stockEl.hidden = false;
        stockEl.innerHTML = '<p>Chest — click to show on the selected stall</p>' + items.map((item) => (
          `<button type="button" data-stock="${item.recipeId}">${item.recipe.name} ×${item.count}</button>`
        )).join('');
      } else {
        stockEl.hidden = true;
        stockEl.innerHTML = '';
      }
      if (!chestModal.hidden) paintChest();
    }
    selectedEl.querySelector('[data-selected-name]').textContent = `Selected: ${SHOP.displays[state.selectedDisplay].name}`;
    const logKey = state.log.join('|');
    if (logKey !== lastLogKey) {
      lastLogKey = logKey;
      logEl.innerHTML = state.log.map((line) => `<li>${line}</li>`).join('');
    }
    if (!tradeModal.hidden && tradeActor) {
      const live = world.getCustomer(tradeActor.id);
      if (!live || live.state === 'leave') closeTrade();
      else paintTrade();
    }
  }

  return { render, openChest, openTrade, openCraft };
}
