import { PHONE_QUERY } from './layoutQuery.js';
/**
 * Stallhaven Skills panel: markup (template strings + data-* hooks) and wiring.
 *
 * Markup follows hud.js: plain template strings, data-* attributes for hooks,
 * `hidden` to show and hide. The panel is an `.expand-dock` like Music and Settings.
 *
 *   import { bindSkillsPanel } from './skillsPanel.js';
 *   const panel = bindSkillsPanel({ skills: state.skills, onOpen: closeOtherDocks });
 *   panel.close(); // from hud.js when another dock opens
 */
import { MAX_LEVEL, SKILLS } from './skills.js';

/** Same query the portrait CSS uses, so JS and CSS agree on "phone portrait". */
export const PORTRAIT_QUERY = PHONE_QUERY;

/**
 * Icons live in public/icons/skills/.
 * Vite serves that folder at BASE_URL. A raw repo-root load (GitHub Pages)
 * still has the public/ prefix, same as minimap and shop textures.
 */
export const SKILL_ICON_V = "?v=2";
export function defaultIconBase() {
  let base = './public/';
  try {
    const raw = import.meta.env.BASE_URL;
    if (raw) base = raw.endsWith('/') ? raw : `${raw}/`;
  } catch {
    base = './public/';
  }
  return `${base}icons/skills/`;
}

const fmt = new Intl.NumberFormat('en-AU');
export function formatXp(n) {
  return fmt.format(Math.max(0, Math.floor(Number(n) || 0)));
}

/* ---------- Templates ---------- */

/** Top-bar button. Sits in #save-bar after Quests and before #build-btn. */
export function skillsButtonHtml() {
  return `<button type="button" id="skills-btn" title="Skills" aria-label="Skills" aria-controls="skills-dock" aria-expanded="false">Skills</button>`;
}

/** Empty dock shell for index.html. bindSkillsPanel fills it. */
export function skillsDockShellHtml() {
  return `<aside id="skills-dock" class="expand-dock skills-dock" role="dialog" aria-label="Skills" hidden></aside>`;
}

function tileHtml(skill, iconBase) {
  return `
    <button type="button" class="skill-tile" data-skill="${skill.id}" aria-pressed="false" aria-describedby="skills-tip">
      <img class="skill-icon" src="${iconBase}${skill.id}.svg${SKILL_ICON_V}" alt="" width="32" height="32" draggable="false" />
      <span class="skill-lv" aria-hidden="true" data-skill-lv>1</span>
      <span class="skill-sr" data-skill-sr>${skill.name} level 1</span>
    </button>`;
}

/** Inner markup of #skills-dock. */
export function skillsDockHtml({ iconBase = defaultIconBase(), hint = 'Tap a skill to see its XP.' } = {}) {
  return `
    <header class="skills-head">
      <span class="skills-grip" aria-hidden="true"></span>
      <h2>Skills</h2>
      <button type="button" class="skills-close" data-skills-close aria-label="Close skills">✕</button>
    </header>
    <div class="skills-grid" data-skills-grid>
      ${SKILLS.map((skill) => tileHtml(skill, iconBase)).join('')}
      <p class="skills-total" data-skills-total>Total level: 10</p>
    </div>
    <div class="skill-tip" id="skills-tip" data-skill-tip role="status" aria-live="polite">
      <p class="skill-tip-hint" data-tip-hint>${hint}</p>
      <div class="skill-tip-body" data-tip-body hidden>
        <p class="skill-tip-name"><img data-tip-icon alt="" width="20" height="20" /><span data-tip-name>Skill</span><span class="skill-tip-level" data-tip-level>Lv 1</span></p>
        <dl class="skill-tip-rows">
          <dt>XP</dt><dd data-tip-xp>0</dd>
          <dt data-tip-next-label>Next level at</dt><dd data-tip-next>83</dd>
          <dt data-tip-left-label>XP left</dt><dd data-tip-left>83</dd>
        </dl>
        <span class="xp-bar skill-tip-bar" aria-hidden="true"><i data-tip-bar></i></span>
        <p class="skill-tip-train" data-tip-train></p>
        <p class="skill-tip-train" data-tip-next-unlock hidden></p>
      </div>
    </div>`;
}

/** Level-up banner. Put the returned element anywhere; it removes itself. */
export function levelUpToastHtml({ skillId, name, level, unlocked = [], unlockHtml = '' }, iconBase = defaultIconBase()) {
  const max = level >= MAX_LEVEL;
  const names = (unlocked ?? []).filter(Boolean);
  const extra = names.length && !unlockHtml
    ? ` New: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}.`
    : '';
  return `
    <div class="skill-toast${unlockHtml ? ' has-unlocks' : ''}" role="status" data-skill-toast="${skillId}">
      <img src="${iconBase}${skillId}.svg${SKILL_ICON_V}" alt="" width="32" height="32" />
      <p><strong>${max ? 'Maxed!' : 'Level up!'}</strong>
      <span>Your ${name} level is now ${level}.${extra}</span></p>${unlockHtml}
    </div>`;
}

export function showLevelUpToast(event, { host = document.body, iconBase = defaultIconBase(), ms = event?.unlockHtml ? 5000 : 3200, onClick = null } = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = levelUpToastHtml(event, iconBase).trim();
  const toast = wrap.firstElementChild;
  if (onClick && event?.unlockHtml) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => { onClick(event.skillId); toast.remove(); });
  }
  host.querySelectorAll('.skill-toast').forEach((old) => old.remove());
  host.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-leaving'), ms);
  window.setTimeout(() => toast.remove(), ms + 400);
  return toast;
}

/* ---------- Wiring ---------- */

export function bindSkillsPanel({
  skills,
  dock = document.querySelector('#skills-dock'),
  button = document.querySelector('#skills-btn'),
  iconBase = defaultIconBase(),
  onOpen = null,
  onClose = null,
  nextUnlock = null,
  onSkillClick = null,
  portraitQuery = PORTRAIT_QUERY,
} = {}) {
  if (!dock || !skills) throw new Error('bindSkillsPanel needs a #skills-dock element and a skills tracker');
  dock.innerHTML = skillsDockHtml({
    iconBase,
    hint: onSkillClick ? 'Tap a skill to open its guide.' : undefined,
  });
  dock.classList.toggle('has-guide', Boolean(onSkillClick));

  const tip = dock.querySelector('[data-skill-tip]');
  const tipHint = tip.querySelector('[data-tip-hint]');
  const tipBody = tip.querySelector('[data-tip-body]');
  const totalEl = dock.querySelector('[data-skills-total]');
  const tiles = new Map([...dock.querySelectorAll('[data-skill]')].map((el) => [el.dataset.skill, el]));
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia(portraitQuery) : null;
  const isPortrait = () => Boolean(mq?.matches);

  let pinned = null; // tapped / clicked skill
  let hovered = null; // mouse hover (desktop)
  let dirty = true;

  function paint() {
    dirty = false;
    for (const row of skills.list()) {
      const el = tiles.get(row.id);
      if (!el) continue;
      // Single level only (no boosts in Stallhaven).
      el.querySelector('[data-skill-lv]').textContent = String(row.level);
      el.querySelector('[data-skill-sr]').textContent = `${row.name} level ${row.level}`;
      el.classList.toggle('is-max', row.level >= MAX_LEVEL);
    }
    totalEl.textContent = `Total level: ${skills.getTotalLevel()}`;
    paintTip();
  }

  function paintTip() {
    const id = hovered ?? pinned;
    for (const [skillId, el] of tiles) {
      el.setAttribute('aria-pressed', String(skillId === pinned));
      el.classList.toggle('is-on', skillId === id);
    }
    dock.classList.toggle('has-tip', Boolean(id));
    tipHint.hidden = Boolean(id);
    tipBody.hidden = !id;
    if (!id) {
      tip.style.left = '';
      tip.style.top = '';
      return;
    }
    const row = skills.list().find((item) => item.id === id);
    const maxed = row.nextLevelXp == null;
    tip.querySelector('[data-tip-icon]').src = `${iconBase}${id}.svg${SKILL_ICON_V}`;
    tip.querySelector('[data-tip-name]').textContent = row.name;
    tip.querySelector('[data-tip-level]').textContent = `Lv ${row.level}`;
    tip.querySelector('[data-tip-xp]').textContent = formatXp(row.xp);
    tip.querySelector('[data-tip-next-label]').textContent = maxed ? 'Next level' : `Lv ${row.level + 1} at`;
    tip.querySelector('[data-tip-next]').textContent = maxed ? 'Maxed' : formatXp(row.nextLevelXp);
    tip.querySelector('[data-tip-left-label]').textContent = maxed ? 'XP left' : 'XP left';
    tip.querySelector('[data-tip-left]').textContent = maxed ? '0' : formatXp(row.toNext);
    tip.querySelector('[data-tip-bar]').style.setProperty('--t', row.t.toFixed(4));
    tip.querySelector('[data-tip-train]').textContent = row.trainedBy;
    const nextEl = tip.querySelector('[data-tip-next-unlock]');
    if (nextEl) {
      const text = typeof nextUnlock === 'function' ? nextUnlock(id, row.level) : '';
      nextEl.hidden = !text;
      nextEl.textContent = text;
    }
    placeTip(tiles.get(id));
  }

  /** Desktop: float next to the tile. Phone portrait: CSS keeps it in the sheet. */
  function placeTip(tile) {
    if (isPortrait() || !tile) {
      tip.style.left = '';
      tip.style.top = '';
      return;
    }
    const dockBox = dock.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    let left = tileBox.left - dockBox.left + tileBox.width / 2 - tipW / 2;
    left = Math.max(6, Math.min(dockBox.width - tipW - 6, left));
    // Below the tile, unless that runs past the window; then above it.
    let top = tileBox.bottom - dockBox.top + 6;
    if (dockBox.top + top + tipH > window.innerHeight - 8) top = tileBox.top - dockBox.top - tipH - 6;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function select(skillId) {
    pinned = pinned === skillId ? null : skillId;
    paintTip();
  }

  function onKey(event) {
    if (event.key === 'Escape' && !dock.hidden) {
      if (pinned || hovered) {
        pinned = null;
        hovered = null;
        paintTip();
      } else {
        close();
      }
    }
  }

  function open() {
    if (!dock.hidden) return;
    onOpen?.();
    dock.hidden = false;
    button?.classList.add('is-on');
    button?.setAttribute('aria-expanded', 'true');
    if (dirty) paint();
    else paintTip();
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (dock.hidden) return;
    dock.hidden = true;
    pinned = null;
    hovered = null;
    button?.classList.remove('is-on');
    button?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }

  function toggle() {
    if (dock.hidden) open();
    else close();
  }

  button?.addEventListener('click', toggle);
  dock.querySelector('[data-skills-close]').addEventListener('click', close);

  dock.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-skill]');
    if (!tile) return;
    if (onSkillClick) {
      // Hover keeps the tooltip; click opens the guide instead of pinning it.
      pinned = null;
      onSkillClick(tile.dataset.skill, tile);
    } else {
      select(tile.dataset.skill);
    }
  });

  // Mouse hover only. Touch uses tap (click) so a tap never flashes two states.
  dock.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const tile = event.target.closest('[data-skill]');
    const id = tile?.dataset.skill ?? null;
    if (id === hovered) return;
    hovered = id;
    paintTip();
  });
  dock.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse' || hovered == null) return;
    hovered = null;
    paintTip();
  });
  dock.addEventListener('focusin', (event) => {
    const tile = event.target.closest('[data-skill]');
    if (!tile || tile.matches(':hover')) return;
    hovered = tile.dataset.skill;
    paintTip();
  });
  dock.addEventListener('focusout', (event) => {
    if (event.target.closest('[data-skill]') && !dock.contains(event.relatedTarget)) {
      hovered = null;
      paintTip();
    }
  });
  mq?.addEventListener?.('change', () => paintTip());

  const offChange = skills.onChange(() => {
    if (dock.hidden) dirty = true;
    else paint();
  });

  function flash(skillId) {
    const tile = tiles.get(skillId);
    if (!tile) return;
    tile.classList.remove('is-levelup');
    void tile.offsetWidth;
    tile.classList.add('is-levelup');
  }
  const offLevel = skills.onLevelUp((event) => flash(event.skillId));

  paint();

  return {
    open,
    close,
    toggle,
    paint,
    select,
    isOpen: () => !dock.hidden,
    destroy() {
      offChange();
      offLevel();
      close();
      button?.removeEventListener('click', toggle);
    },
  };
}
