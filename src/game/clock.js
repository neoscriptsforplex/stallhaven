/**
 * Injectable game clock, in seconds. Single-player reads performance.now();
 * tests and the co-op room server swap in their own source.
 */
function performanceSeconds() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now() / 1000;
  }
  return Date.now() / 1000;
}

export function createClock(source = performanceSeconds) {
  let read = source;
  return {
    now() {
      return read();
    },
    setSource(next) {
      read = typeof next === 'function' ? next : performanceSeconds;
    },
  };
}

/** Shared clock for the browser game. */
export const gameClock = createClock();

/** A clock a test can move by hand. */
export function manualClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    set(value) {
      t = value;
    },
    advance(dt) {
      t += dt;
      return t;
    },
  };
}
