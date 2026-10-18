/**
 * Loom weaving animation for the bundled loom.obj, whose moving parts are separate OBJ
 * objects: loom_beater, loom_shuttle, loom_heddle_a, loom_heddle_b, loom_cloth_roll.
 *
 *   const fx = attachLoomFx(loomRoot);
 *   fx.setActive(true);   // weaving started
 *   fx.update(dt);        // every frame
 *
 * One weaving cycle = two passes. Each pass the shuttle slides across, the heddles swap
 * (a up / b down, then the reverse) and the beater swings in to beat the weft at the end
 * of the pass. The cloth roll turns slowly the whole time. Everything eases in and out
 * (smoothstep over easeTime) and returns to the rest pose when idle.
 * Pivots/offsets are in the OBJ's own OSRS units (see make_loom.py).
 */
import * as THREE from 'three';
import { mountPivot } from './stationSpin.js';

export const LOOM_FX_DEFAULTS = Object.freeze({
  pivots: {
    loom_beater: [0, 150, 13],      // hanger bar axis (X)
    loom_shuttle: [0, 106, 7],
    loom_heddle_a: [0, 161.5, -5],
    loom_heddle_b: [0, 132, 7],
    loom_cloth_roll: [0, 172, 6],   // roll axis (X)
  },
  cycle: 2.4,          // seconds per two passes
  shuttleTravel: 28,   // +/- x (model units); keeps the shuttle clear of the beater arms
  heddleLift: 6,       // +/- y (model units)
  beatAngle: 0.17,     // rad toward the cloth (-Z) at the beat
  backAngle: 0.10,     // rad away from the cloth between beats
  rollSpeed: 0.5,      // rad/s
  easeTime: 0.35,
});

function smooth(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }

export function attachLoomFx(root, opts = {}) {
  const o = { ...LOOM_FX_DEFAULTS, ...opts, pivots: { ...LOOM_FX_DEFAULTS.pivots, ...(opts.pivots ?? {}) } };
  const parts = {};
  for (const [name, p] of Object.entries(o.pivots)) {
    const m = mountPivot(root, name, new THREE.Vector3().fromArray(p));
    if (m) parts[name] = m;
  }
  if (!Object.keys(parts).length) return null;
  const X = new THREE.Vector3(1, 0, 0); const Y = new THREE.Vector3(0, 1, 0);
  const axisX = {}; const unitX = {}; const unitY = {};
  for (const [n, m] of Object.entries(parts)) {
    axisX[n] = m.toParent(X).normalize();
    unitX[n] = m.toParent(X); // one model unit along x, in parent space
    unitY[n] = m.toParent(Y);
  }
  let target = 0; let level = 0; let phase = 0; let roll = 0;
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();

  function pose(s) {
    const u = phase % 1;                 // 0..1 over one cycle (two passes)
    const pass = u < 0.5 ? 0 : 1;
    const w = (u % 0.5) / 0.5;           // 0..1 inside the pass
    // shuttle: eased slide from one side to the other, resting briefly at each end
    const slide = smooth((w - 0.08) / 0.62);
    const sx = (pass === 0 ? 1 - 2 * slide : -1 + 2 * slide) * o.shuttleTravel * s;
    // heddles: swap the shed at the start of each pass (a up / b down, then reverse)
    const e = smooth(w / 0.18);
    const h = pass === 0 ? 2 * e - 1 : 1 - 2 * e;
    // beater: rests back, swings in to beat after the shuttle lands, then returns
    const beatIn = smooth((w - 0.72) / 0.14);
    const beatOut = smooth((w - 0.88) / 0.12);
    const ang = (-o.backAngle + (o.backAngle + o.beatAngle) * (beatIn - beatOut)) * s;
    return { sx, h: h * o.heddleLift * s, ang };
  }

  function apply(s) {
    const p = pose(s);
    if (parts.loom_shuttle) parts.loom_shuttle.pivot.position.copy(parts.loom_shuttle.centre).addScaledVector(unitX.loom_shuttle, p.sx);
    if (parts.loom_heddle_a) parts.loom_heddle_a.pivot.position.copy(parts.loom_heddle_a.centre).addScaledVector(unitY.loom_heddle_a, p.h);
    if (parts.loom_heddle_b) parts.loom_heddle_b.pivot.position.copy(parts.loom_heddle_b.centre).addScaledVector(unitY.loom_heddle_b, -p.h);
    // +angle about +X swings the hanging batten toward -Z (the cloth)
    if (parts.loom_beater) parts.loom_beater.pivot.quaternion.copy(q.setFromAxisAngle(axisX.loom_beater, p.ang));
    if (parts.loom_cloth_roll) parts.loom_cloth_roll.pivot.quaternion.copy(q.setFromAxisAngle(axisX.loom_cloth_roll, roll));
  }

  return {
    parts,
    setActive(on) { target = on ? 1 : 0; },
    update(dt) {
      const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (!d) return;
      const was = level;
      level = target ? Math.min(1, level + d / o.easeTime) : Math.max(0, level - d / o.easeTime);
      if (level <= 0 && was <= 0) return;
      const s = smooth(level);
      phase += (d / o.cycle) * s;
      roll = (roll - o.rollSpeed * s * d) % (Math.PI * 2);   // winds the cloth up over the front
      apply(s);
    },
    level() { return smooth(level); },
    phase() { return phase; },
    dispose() { for (const m of Object.values(parts)) m.dispose(); },
  };
}
