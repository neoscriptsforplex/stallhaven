import { CUSTOMERS, MATERIALS, RECIPES, recipeList, materialList, SHOP } from './catalog.js';
import {
  canCraft,
  canRestock,
  craftProgress,
  restock,
  startCraft,
  stockSelected,
} from './economy.js';

export function bindHud(root, state, world) {
  const goldEl = root.querySelector('#gold');
  const matsEl = root.querySelector('#materials');
  const craftsEl = root.querySelector('#crafts');
  const stockEl = root.querySelector('#stock');
  const logEl = root.querySelector('#log');
  const selectedEl = root.querySelector('#selected');
  const tooltip = document.querySelector('#tooltip');
  const dismiss = tooltip.querySelector('[data-dismiss]');

  craftsEl.innerHTML = recipeList().map((recipe) => {
    const mat = MATERIALS[recipe.material];
    const buyers = recipe.buyers.map((id) => CUSTOMERS[id].name).join(', ');
    return `<button type="button" class="craft" data-craft="${recipe.id}">
      <strong>${recipe.name}</strong>
      <span class="meta">1 ${mat.name} · ${recipe.time}s · sells ${recipe.price}g · ${buyers}</span>
      <span class="timer" data-timer="${recipe.id}"></span>
    </button>`;
  }).join('');

  matsEl.innerHTML = materialList().map((mat) => `
    <div class="mat" data-mat="${mat.id}">
      <span class="mat-name">${mat.name}</span>
      <span class="mat-count" data-count="${mat.id}">0</span>
      <button type="button" class="restock" data-restock="${mat.id}">Restock ${mat.restock}g</button>
    </div>
  `).join('');

  craftsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-craft]');
    if (!btn) return;
    if (startCraft(state, btn.dataset.craft, performance.now() / 1000)) {
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
    if (stockSelected(state, btn.dataset.stock)) {
      world.syncDisplays();
      render(performance.now() / 1000);
    }
  });

  if (!localStorage.getItem('stallhaven-tip')) {
    tooltip.hidden = false;
  }
  dismiss.addEventListener('click', () => {
    tooltip.hidden = true;
    localStorage.setItem('stallhaven-tip', '1');
  });

  let lastStockKey = null;
  let lastLogKey = null;

  function render(now) {
    goldEl.textContent = `${state.gold}g`;
    for (const mat of materialList()) {
      const count = matsEl.querySelector(`[data-count="${mat.id}"]`);
      if (count) count.textContent = `×${state.materials[mat.id]}`;
      const btn = matsEl.querySelector(`[data-restock="${mat.id}"]`);
      if (btn) btn.disabled = !canRestock(state, mat.id);
    }
    for (const recipe of recipeList()) {
      const btn = craftsEl.querySelector(`[data-craft="${recipe.id}"]`);
      const timer = craftsEl.querySelector(`[data-timer="${recipe.id}"]`);
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
    const stockKey = state.ready.join('|');
    if (stockKey !== lastStockKey) {
      lastStockKey = stockKey;
      if (state.ready.length) {
        stockEl.hidden = false;
        stockEl.innerHTML = `<p>Ready in the crate — click to put on the selected stall</p>` + state.ready.map((id) => (
          `<button type="button" data-stock="${id}">${RECIPES[id].name}</button>`
        )).join('');
      } else {
        stockEl.hidden = true;
        stockEl.innerHTML = '';
      }
    }
    selectedEl.textContent = `Selected: ${SHOP.displays[state.selectedDisplay].name}`;
    const logKey = state.log.join('|');
    if (logKey !== lastLogKey) {
      lastLogKey = logKey;
      logEl.innerHTML = state.log.map((line) => `<li>${line}</li>`).join('');
    }
  }

  return { render };
}
