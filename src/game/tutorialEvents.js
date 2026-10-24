/**
 * Game -> new-player tutorial events (walked, enteredDungeon, mined:<materialId>, arrivedShop,
 * placed:<station>, crafted:<recipeId>, sold). Safe to call when no tutorial is running.
 */
const seen = [];
export function tutorialEmit(type) {
  if (!type) return;
  seen.push(type);
  if (seen.length > 50) seen.shift();
  try {
    globalThis.Tutorial?.emit?.(type);
  } catch {
    /* the tutorial must never break the game */
  }
}
/** Recent events (tests / debugging). */
export function tutorialEventLog() {
  return seen.slice();
}
