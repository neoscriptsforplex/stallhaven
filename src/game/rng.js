/**
 * Seedable random numbers. Single-player keeps using Math.random; a co-op room
 * passes a seeded generator so its rolls can be replayed in tests.
 */
export function seededRng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng = () => Math.random();

/** Pick one item from a list with the given rng. */
export function pickOne(list, rng = defaultRng) {
  if (!list?.length) return undefined;
  return list[Math.floor(rng() * list.length)];
}
