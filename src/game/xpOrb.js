// XP orb + XP drops (OSRS style). Mounted once from hud.js.
import { SKILLS, progressForXp, levelForXp, MAX_LEVEL } from './skills.js';
const NAME = Object.fromEntries(SKILLS.map((s) => [s.id, s.name]));
const fmt = (n) => Math.round(n).toLocaleString();

export function createXpOrb({ skills, host = document.body, iconBase = `${import.meta.env?.BASE_URL ?? '/'}icons/skills/`, idleMs = 6000 }) {
  const wrap = document.createElement('div');
  wrap.className = 'xp-orb-wrap'; wrap.dataset.idle = '';
  wrap.innerHTML = `<button type="button" class="xp-orb" aria-label="XP orb"><img alt="" /></button>
    <span class="xp-orb-total" data-total>0</span>
    <div class="xp-orb-tip" role="tooltip" hidden></div>
    <div class="xp-drops" aria-hidden="true"></div>`;
  host.appendChild(wrap);
  const orb = wrap.querySelector('.xp-orb'), img = orb.querySelector('img'), tip = wrap.querySelector('.xp-orb-tip'),
    drops = wrap.querySelector('.xp-drops'), total = wrap.querySelector('[data-total]');
  let current = null, idleTimer = 0;

  function paint() {
    if (!current) return;
    const xp = skills.getXp(current), lv = levelForXp(xp), p = progressForXp(xp);
    const frac = Math.max(0, Math.min(1, p.t));
    orb.style.setProperty('--p', frac.toFixed(4));
    img.src = `${iconBase}${current}.svg`;
    total.textContent = fmt(xp);
    tip.innerHTML = `<div><b>${NAME[current]}</b> · Level ${lv}</div>
      <div class="row"><span>Current XP</span><span>${fmt(xp)}</span></div>
      ${lv >= MAX_LEVEL ? '' : `<div class="row"><span>XP to level ${lv + 1}</span><span>${fmt(p.toNext)}</span></div>`}`;
  }
  function wake() { delete wrap.dataset.idle; clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (tip.hidden) wrap.dataset.idle = ''; }, idleMs); }
  function drop(skillId, added) {
    const d = document.createElement('div'); d.className = 'xp-drop';
    d.innerHTML = `<img src="${iconBase}${skillId}.svg" alt="" />+${fmt(added)}`;
    drops.appendChild(d); d.addEventListener('animationend', () => d.remove());
  }
  skills.onChange(({ skillId, added }) => {
    if (!skillId || !NAME[skillId] || !(added > 0)) return;
    current = skillId; paint(); drop(skillId, added); wake();
  });
  const show = (on) => { tip.hidden = !on; if (on) { paint(); wake(); } };
  orb.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(true));
  orb.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && show(false));
  orb.addEventListener('click', () => show(tip.hidden));
  return { setSkill(id) { current = id; paint(); wake(); }, destroy() { wrap.remove(); } };
}
