/**
 * Stallhaven skill guide: OSRS-style "what unlocks at each level" window.
 *
 *   import { bindSkillGuide } from './skillGuide.js';
 *   const guide = bindSkillGuide({ skills: state.skills, panel: skillsPanel });
 *   bindSkillsPanel({ ..., onSkillClick: (id) => guide.open(id) });
 *
 * Desktop: centred window over the game, dim backdrop. Esc, ✕ or a click outside closes it.
 * Phone portrait: full-height bottom sheet with "‹ Skills" back (returns to the Skills sheet).
 * Content comes from SKILL_GUIDES (skillGuideData.js). Markup is template strings + data-* hooks,
 * like hud.js and skillsPanel.js.
 */
import { MAX_LEVEL, SKILLS } from './skills.js';
import { PORTRAIT_QUERY, SKILL_ICON_V, defaultIconBase, formatXp } from './skillsPanel.js';
import { SKILL_GUIDES } from './skillGuideData.js';
import GUIDE_THUMBS from './guideThumbs.js';
import { thumbUrl } from './guideRenders.js';

/* ---------- Glyphs (24×24, currentColor = tier tint) ---------- */
const P = (d) => `<path d="${d}"/>`;
export const ICONS = {
  sword: P('M19 3l2 2-10.5 10.5-2-2zM6.5 13.5l4 4-1.5 1.5-1.2-1.2L5 20.6 3.4 19l2.8-2.8L5 15z'),
  helm: P('M12 3c-4.4 0-7 3.3-7 7.5V18l3 2h8l3-2v-7.5C19 6.3 16.4 3 12 3zm-1 8H7.5v-1C7.5 7.6 9 6 11 5.6zm2 0V5.6c2 .4 3.5 2 3.5 4.4v1z'),
  vest: P('M8 3l-4 3 1.5 5L7 10v10h10V10l1.5 1L20 6l-4-3-1.5 2h-5z'),
  bar: P('M5 10h14l2 6H3zM6.5 9l1.5-3h8l1.5 3z'),
  pick: P('M3 7c4-4 10-4 15 0l-1.5 1.5c-2-1.5-4-2-6-2.2l7.5 13.2-1.7 1-7.6-13C8 7.3 6 7.8 4.5 8.5z'),
  cannon: P('M3 15l11-7 3 4-11 7zm13-8l3-1 1 3-2 1zM6 18a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0z'),
  ore: P('M4 17l3-8 5-4 6 3 2 7-4 4H8zM9 10l2 2m3-4l1 3'),
  log: '<path fill-rule="evenodd" d="M6 7h11a5 5 0 010 10H6a5 5 0 010-10zm11 2a3 3 0 100 6 3 3 0 100-6zm0 2a1 1 0 100 2 1 1 0 100-2z"/><path d="M7 10h6M5.5 13.5h6" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>',
  plank: P('M3 8h18v3H3zm0 5h18v3H3z'),
  rune: P('M12 2l8 4.5v11L12 22l-8-4.5v-11zm0 5l-3 5h2v5l4-7h-2.5z'),
  star: P('M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z'),
  sheaf: P('M11 21V10C9 8 8.5 5 9 3c2 1 3 3.5 2.5 6 .5-2.5 2-4.5 4-5.5.3 2.5-.8 5.3-3 6.5V21z'),
  leaf: P('M5 19C5 10 10 5 20 4c0 9-5 15-13 15zm0 0l8-8'),
  bow: P('M6 3c6 3 9 6 9 9s-3 6-9 9l-1-1.5c5-2.6 7.5-5 7.5-7.5S10 7.1 5 4.5zM6 4v16'),
  arrow: P('M4 20L17 7l-1-3 4 0 0 4-3-1L4 20zm-1-3l3 3'),
  crossbow: P('M12 3v18M4 8c3-2 13-2 16 0l-1 2c-3-1.5-11-1.5-14 0zM10 18h4'),
  axe: P('M14 3c4 1 6 4 6 8-2-1-4-1-6 0zm-1 3L4 20l1.5 1.5L15 8z'),
  ball: P('M12 5a7 7 0 100 14 7 7 0 100-14z'),
  potion: P('M10 3h4v2h-1v3.5c3 1 5 3.5 5 6.5a6 6 0 01-12 0c0-3 2-5.5 5-6.5V5h-1z'),
  food: P('M3 13h18c0 4-3 7-9 7s-9-3-9-7zm3-2c0-3 3-6 6-6s6 3 6 6z'),
  cloth: P('M6 3h12l2 4-3 1v13H7V8L4 7z'),
  pot: P('M8 4h8v2l-1 1c3 1 4 4 4 7 0 4-3 6-7 6s-7-2-7-6c0-3 1-6 4-7L8 6z'),
  string: P('M6 4c6 2 6 6 0 8s-6 6 0 8M18 4c-6 2-6 6 0 8s6 6 0 8'),
  staff: P('M16 2a3 3 0 110 6 3 3 0 110-6zM14.6 7.4L4 18l2 2 10.6-10.6z'),
  house: P('M3 11l9-7 9 7v9h-6v-6H9v6H3z'),
  window: P('M5 3h14v18H5zm2 2v6h4V5zm6 0v6h4V5zm-6 8v6h4v-6zm6 0v6h4v-6z'),
  lock: P('M7 10V8a5 5 0 0110 0v2h1v11H6V10zm2 0h6V8a3 3 0 00-6 0z'),
  check: P('M4 12.5l5 5L20 6.5l-1.8-1.8L9 14l-3.2-3.2z'),
};
const glyph = (id, cls = 'guide-glyph') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] ?? ICONS.star}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Templates ---------- */

export function skillGuideShellHtml() {
  return `
    <div class="guide-backdrop" data-guide-backdrop hidden></div>
    <section id="skill-guide" class="skill-guide panel" role="dialog" aria-modal="true" aria-labelledby="guide-title" hidden>
      <header class="guide-head">
        <button type="button" class="guide-back" data-guide-back aria-label="Back to skills">‹ Skills</button>
        <img class="guide-icon" data-guide-icon alt="" width="40" height="40" />
        <div class="guide-title-wrap">
          <h2 id="guide-title" data-guide-title>Skill</h2>
          <p class="guide-sub" data-guide-sub>Skill guide</p>
        </div>
        <p class="guide-level"><span>Level</span><b data-guide-level>1</b></p>
        <button type="button" class="guide-close skills-close" data-guide-close aria-label="Close guide">✕</button>
        <div class="guide-xp">
          <span class="xp-bar guide-bar" aria-hidden="true"><i data-guide-bar></i></span>
          <p class="guide-xp-text"><span data-guide-xp>0 XP</span><span data-guide-left>83 XP to level 2</span></p>
        </div>
      </header>
      <nav class="guide-tabs" role="tablist" data-guide-tabs></nav>
      <ol class="guide-list" data-guide-list tabindex="0"></ol>
      <p class="guide-foot" data-guide-foot hidden></p>
    </section>`;
}

function rowHtml(row, level, nextLv, skillId) {
  const renderKey = skillId ? GUIDE_THUMBS.rows[`${skillId}|${row.name}`] : null;
  const open = !row.soon && row.lv <= level;
  const isNext = !row.soon && row.lv === nextLv;
  const cls = ['guide-row', open ? 'is-open' : 'is-locked', row.perk && 'is-perk', row.soon && 'is-soon', isNext && 'is-next']
    .filter(Boolean).join(' ');
  const badge = row.soon
    ? '<span class="guide-badge is-soon">Coming soon</span>'
    : isNext ? '<span class="guide-badge is-next">Next unlock</span>'
      : row.perk ? '<span class="guide-badge is-perk">Perk</span>' : '';
  const state = open ? glyph('check', 'guide-state is-check') : glyph('lock', 'guide-state is-lock');
  const sr = open ? 'Unlocked' : row.soon ? 'Coming soon' : `Requires level ${row.lv}`;
  return `
    <li class="${cls}" ${isNext ? 'data-guide-next' : ''}>
      <span class="guide-lv">${row.lv}</span>
      ${renderKey
    ? `<span class="guide-item has-render"><img src="${esc(thumbUrl(renderKey))}" width="34" height="34" alt="" loading="lazy"></span>`
    : `<span class="guide-item" style="color:${esc(row.tint ?? '#e3b34a')}">${glyph(row.icon)}</span>`}
      <span class="guide-text">
        <span class="guide-name">${esc(row.name)}${badge}</span>
        ${row.desc ? `<span class="guide-desc">${esc(row.desc)}</span>` : ''}
      </span>
      ${state}
      <span class="skill-sr">${sr}</span>
    </li>`;
}

/* ---------- Data helpers ---------- */

export function sortedRows(tab) {
  return [...tab.rows].sort((a, b) => a.lv - b.lv || Number(Boolean(a.perk)) - Number(Boolean(b.perk)));
}

/** Lowest level above `level` that unlocks something real (not "soon") in this skill. */
export function nextUnlockLevel(guide, level) {
  const lvls = guide.tabs.flatMap((t) => t.rows).filter((r) => !r.soon && r.lv > level).map((r) => r.lv);
  return lvls.length ? Math.min(...lvls) : null;
}

/** Tab to open on: the one holding the next unlock, else the first. */
export function defaultTab(guide, level) {
  const next = nextUnlockLevel(guide, level);
  if (next == null) return guide.tabs[0].id;
  return (guide.tabs.find((t) => t.rows.some((r) => !r.soon && r.lv === next)) ?? guide.tabs[0]).id;
}

/* ---------- Wiring ---------- */

export function bindSkillGuide({
  skills,
  panel = null,
  host = document.body,
  iconBase = defaultIconBase(),
  guides = SKILL_GUIDES,
  portraitQuery = PORTRAIT_QUERY,
  onOpen = null,
  onClose = null,
} = {}) {
  if (!host.querySelector('#skill-guide')) host.insertAdjacentHTML('beforeend', skillGuideShellHtml());
  const el = host.querySelector('#skill-guide');
  const backdrop = host.querySelector('[data-guide-backdrop]');
  const list = el.querySelector('[data-guide-list]');
  const tabsEl = el.querySelector('[data-guide-tabs]');
  const foot = el.querySelector('[data-guide-foot]');
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia(portraitQuery) : null;
  const isPortrait = () => Boolean(mq?.matches);

  let skillId = null;
  let tabId = null;
  let returnFocus = null;

  function info() {
    return skills.list().find((r) => r.id === skillId);
  }

  function paintHead(row) {
    el.querySelector('[data-guide-icon]').src = `${iconBase}${skillId}.svg${SKILL_ICON_V}`;
    el.querySelector('[data-guide-title]').textContent = row.name;
    el.querySelector('[data-guide-sub]').textContent = SKILLS.find((s) => s.id === skillId)?.trainedBy ?? '';
    el.querySelector('[data-guide-level]').textContent = String(row.level);
    const maxed = row.level >= MAX_LEVEL || row.nextLevelXp == null;
    el.querySelector('[data-guide-xp]').textContent = `${formatXp(row.xp)} XP`;
    el.querySelector('[data-guide-left]').textContent = maxed
      ? 'Max level'
      : `${formatXp(row.toNext)} XP to level ${row.level + 1}`;
    el.querySelector('[data-guide-bar]').style.setProperty('--t', (maxed ? 1 : row.t).toFixed(4));
  }

  function paintTabs(guide) {
    tabsEl.hidden = guide.tabs.length < 2;
    tabsEl.innerHTML = guide.tabs.map((t) => `
      <button type="button" role="tab" class="guide-tab${t.id === tabId ? ' is-on' : ''}" data-guide-tab="${t.id}"
        aria-selected="${t.id === tabId}">${esc(t.label)}</button>`).join('');
  }

  function paintList({ scroll = false } = {}) {
    const guide = guides[skillId];
    const row = info();
    const tab = guide.tabs.find((t) => t.id === tabId) ?? guide.tabs[0];
    const nextLv = nextUnlockLevel(guide, row.level);
    list.innerHTML = sortedRows(tab).map((r) => rowHtml(r, row.level, nextLv, skillId)).join('');
    list.setAttribute('aria-label', `${row.name}: ${tab.label}`);
    foot.hidden = !tab.footer;
    foot.textContent = tab.footer ?? '';
    if (scroll) scrollToNext();
  }

  /** Put the next unlock near the top, with one unlocked row above it for context. */
  function scrollToNext() {
    const next = list.querySelector('[data-guide-next]') ?? list.querySelector('.is-locked:not(.is-soon)');
    if (!next) { list.scrollTop = list.scrollHeight; return; }
    const prev = next.previousElementSibling;
    const target = (prev ?? next).offsetTop - list.offsetTop - 4;
    list.scrollTop = Math.max(0, target);
  }

  function paint({ scroll = false } = {}) {
    if (!skillId) return;
    const guide = guides[skillId];
    paintHead(info());
    paintTabs(guide);
    paintList({ scroll });
  }

  function onKey(event) {
    if (event.key !== 'Escape' || el.hidden) return;
    // Capture phase: close only the guide, not the Skills panel underneath.
    event.stopPropagation();
    event.preventDefault();
    close();
  }

  function open(id, { tab = null } = {}) {
    if (!guides[id]) return;
    const wasClosed = el.hidden;
    if (wasClosed) returnFocus = document.activeElement;
    skillId = id;
    tabId = tab ?? defaultTab(guides[id], info().level);
    onOpen?.(id);
    el.hidden = false;
    backdrop.hidden = false;
    el.classList.toggle('is-sheet', isPortrait());
    document.documentElement.classList.add('guide-open');
    paint({ scroll: true });
    if (wasClosed) window.addEventListener('keydown', onKey, true);
    el.querySelector(isPortrait() ? '[data-guide-back]' : '[data-guide-close]').focus({ preventScroll: true });
  }

  function close() {
    if (el.hidden) return;
    el.hidden = true;
    backdrop.hidden = true;
    document.documentElement.classList.remove('guide-open');
    window.removeEventListener('keydown', onKey, true);
    onClose?.(skillId);
    skillId = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  el.querySelector('[data-guide-close]').addEventListener('click', close);
  el.querySelector('[data-guide-back]').addEventListener('click', () => {
    close();
    panel?.open?.(); // the Skills sheet is still open underneath; this is a no-op then
  });
  backdrop.addEventListener('click', close);
  tabsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-guide-tab]');
    if (!btn || btn.dataset.guideTab === tabId) return;
    tabId = btn.dataset.guideTab;
    paintTabs(guides[skillId]);
    paintList({ scroll: true });
  });
  tabsEl.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const tabs = guides[skillId].tabs;
    const i = tabs.findIndex((t) => t.id === tabId);
    tabId = tabs[(i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].id;
    paintTabs(guides[skillId]);
    paintList({ scroll: true });
    tabsEl.querySelector('.is-on')?.focus();
  });
  mq?.addEventListener?.('change', () => el.classList.toggle('is-sheet', isPortrait()));
  const off = skills.onChange(() => { if (!el.hidden) paint(); });

  return {
    open,
    close,
    isOpen: () => !el.hidden,
    current: () => skillId,
    destroy() { off(); close(); el.remove(); backdrop.remove(); },
  };
}
