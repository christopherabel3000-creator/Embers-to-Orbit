// What every screen shares: the page's landmarks, the game being played,
// sending actions to the engine, announcements, and drawing the current
// screen. The screens themselves live in js/ui/screens/.

import { applyAction } from '../engine/game.js';
import {
  living, dateLabel, shelterCapacity, storageCapacity, inVillage, taskAvailable, eraAtLeast,
} from '../engine/state.js';
import { storage } from '../storage.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../engine/difficulty.js';
import { capital as capitalize, listWords, plural } from '../engine/util.js';

export { capitalize, listWords, plural };

export const $main = document.getElementById('main');
export const $nav = document.getElementById('nav');
const $status = document.getElementById('status');
const $announcer = document.getElementById('announcer');

// The game being played, and the screen showing. Other modules read these;
// only setState and show change them.
export let state = null;

export function setState(next) {
  state = next;
}

export let screen = 'title';

// The settlement the Settlement screen shows, and the region the Region
// screen shows.
export let townId = null;
export let regionId = null;

export function setTown(id) {
  townId = id;
}

export function setRegion(id) {
  regionId = id;
}

const SCREENS = [
  ['report', 'Report'],
  ['people', 'People'],
  ['nation', 'Nation'],
  ['map', 'Map'],
  ['world', 'World'],
  ['build', 'Build'],
  ['knowledge', 'Knowledge'],
  ['neighbors', 'Neighbors'],
  ['advisors', 'Advisors'],
  ['chronicle', 'Chronicle'],
  ['menu', 'Menu'],
];

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Moves focus to the first matching element, for after a screen redraw.
export function refocus(...selectors) {
  for (const sel of selectors) {
    const el = $main.querySelector(sel);
    if (el) {
      if (!el.matches('button, select, input, a')) el.setAttribute('tabindex', '-1');
      el.focus();
      return;
    }
  }
}

export function announce(message) {
  $announcer.textContent = '';
  setTimeout(() => { $announcer.textContent = message; }, 60);
}

export function act(action) {
  const result = applyAction(state, action);
  if (result.error) {
    announce(result.error);
    return false;
  }
  state = result.state;
  storage.save(state);
  updateStatus();
  return result.message || true;
}

function updateStatus() {
  if (!state) {
    $status.textContent = '';
    return;
  }
  const people = living(state).length;
  $status.textContent = `${state.campName}. ${dateLabel(state)}. ${plural(people, 'person', 'people')}, `
    + `food ${state.resources.food} of ${storageCapacity(state)}, wood ${state.resources.wood}, `
    + `${taskAvailable(state, 'quarry') || state.resources.stone ? `stone ${state.resources.stone || 0}, ` : ''}`
    + `${taskAvailable(state, 'craft') || state.resources.goods ? `goods ${state.resources.goods || 0}, ` : ''}`
    + `${state.resources.iron ? `iron ${state.resources.iron}, ` : ''}${state.resources.salt ? `salt ${state.resources.salt}, ` : ''}${state.resources.coin ? `coin ${state.resources.coin}, ` : ''}`
    + `shelter for ${shelterCapacity(state)}.${state.siege ? ' Under siege.' : ''}`
    + `${(state.settlements || []).length ? ` ${plural(state.settlements.length, 'other settlement', 'other settlements')}.` : ''}`;
}

export function show(name, { focus = true } = {}) {
  screen = name;
  render();
  if (focus) {
    const heading = $main.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }
  window.scrollTo(0, 0);
}

function renderNav() {
  const inGame = state && screen !== 'title' && screen !== 'newGame';
  const blockedByRaid = inGame && state.pendingEvent && !state.gameOver;
  $nav.hidden = !inGame || blockedByRaid;
  if ($nav.hidden) {
    $nav.innerHTML = '';
    return;
  }
  const items = SCREENS
    .filter(([id]) => !state.gameOver || ['report', 'chronicle', 'menu'].includes(id))
    .filter(([id]) => !['nation', 'world'].includes(id) || eraAtLeast(state, 'nation'))
    .map(([id, label]) => [id, id === 'people' && inVillage(state) ? 'Village' : label])
    .map(([id, label]) => `<li><button type="button" data-nav="${id}"${screen === id || (id === 'nation' && screen === 'settlement') || (id === 'world' && ['region', 'expedition'].includes(screen)) ? ' aria-current="page"' : ''}>${label}</button></li>`);
  if (!state.gameOver) items.push('<li><button type="button" class="primary" data-action="endTurn">End season</button></li>');
  $nav.innerHTML = `<ul>${items.join('')}</ul>`;
}

// The screens, registered by app.js: name to a function returning its HTML.
let screens = {};

export function registerScreens(map) {
  screens = map;
}

export function render() {
  updateStatus();
  let html;
  if (screen === 'title' || screen === 'newGame') html = screens[screen]();
  else if (state.pendingEvent && !state.gameOver) {
    html = state.pendingEvent.type === 'raid' ? screens.raid() : screens.story();
  }
  else html = (screens[screen] || screens.report)();
  $main.innerHTML = html;
  renderNav();
}

export function adviceList(advice) {
  if (!advice.length) return '<p>No concerns right now.</p>';
  return `<ul>${advice.map((a) => {
    const label = a.severity === 'urgent' ? 'Urgent' : a.severity === 'warning' ? 'Warning' : 'Note';
    return `<li class="${a.severity === 'note' ? '' : a.severity}"><span>${label} from ${esc(a.name)}, ${esc(a.title.toLowerCase())}:</span> ${esc(a.text)}</li>`;
  }).join('')}</ul>`;
}

// The four difficulties as a group of radio buttons named `name`.
export function difficultyChoices(name, selected) {
  return DIFFICULTY_ORDER.map((id) => `<p><input type="radio" name="${name}" id="${name}-${id}" value="${id}"${id === selected ? ' checked' : ''}>
    <label for="${name}-${id}">${esc(DIFFICULTIES[id].name)}: ${esc(DIFFICULTIES[id].about)}</label></p>`).join('');
}
