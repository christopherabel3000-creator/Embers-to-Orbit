// The interface. It reads the game state and sends actions to the engine;
// it never changes the game state directly.

import { newGame, applyAction } from '../engine/game.js';
import {
  living, dateLabel, shelterCapacity, healthWord, moraleWord, seasonIndex,
  foodNeeded, personById,
} from '../engine/state.js';
import { TASKS, TASK_ORDER, BUILDINGS, BUILDING_ORDER, SKILLS, DISCOVERIES } from '../engine/data.js';
import { getAdvice, ADVISOR_ROLES, advisorPerson, raidOdds } from '../engine/advisors.js';
import { expectedWork } from '../engine/rules.js';
import { storage } from '../storage.js';

const $main = document.getElementById('main');
const $nav = document.getElementById('nav');
const $status = document.getElementById('status');
const $announcer = document.getElementById('announcer');

let state = null;
let screen = 'title';

const SCREENS = [
  ['report', 'Report'],
  ['people', 'People'],
  ['build', 'Build'],
  ['advisors', 'Advisors'],
  ['chronicle', 'Chronicle'],
  ['menu', 'Menu'],
];

// ---------- helpers ----------

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function announce(message) {
  $announcer.textContent = '';
  setTimeout(() => { $announcer.textContent = message; }, 60);
}

function act(action) {
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
    + `food ${state.resources.food}, wood ${state.resources.wood}, shelter for ${shelterCapacity(state)}.`;
}

function show(name, { focus = true } = {}) {
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
    .map(([id, label]) => `<li><button type="button" data-nav="${id}"${screen === id ? ' aria-current="page"' : ''}>${label}</button></li>`);
  if (!state.gameOver) items.push('<li><button type="button" class="primary" data-action="endTurn">End season</button></li>');
  $nav.innerHTML = `<ul>${items.join('')}</ul>`;
}

function render() {
  updateStatus();
  let html;
  if (screen === 'title') html = titleScreen();
  else if (screen === 'newGame') html = newGameScreen();
  else if (state.pendingEvent && !state.gameOver) html = raidScreen();
  else html = ({
    report: reportScreen, people: peopleScreen, build: buildScreen,
    advisors: advisorsScreen, chronicle: chronicleScreen, menu: menuScreen,
  }[screen] || reportScreen)();
  $main.innerHTML = html;
  renderNav();
}

// ---------- screens ----------

function titleScreen() {
  const saved = storage.load();
  return `
    <h1>Embers to Orbit</h1>
    <p>Lead a handful of survivors from a single campfire to a nation among the stars.</p>
    <div class="actions">
      ${saved ? `<button type="button" class="primary" data-action="continue">Continue: ${esc(saved.campName)}, ${esc(dateLabel(saved))}</button>` : ''}
      <button type="button" ${saved ? '' : 'class="primary"'} data-action="showNewGame">New game</button>
      <button type="button" data-action="importSave">Load a save file</button>
    </div>
    <input type="file" id="importInput" accept=".json,application/json" class="visually-hidden" tabindex="-1" aria-hidden="true">
    <h2>About this version</h2>
    <p>This is the first playable piece of the Survival era: twelve survivors in a forest valley, trying to last through their first winters.</p>`;
}

function newGameScreen() {
  const saved = storage.load();
  return `
    <h1>New game</h1>
    <form id="newGameForm">
      <p><label for="campName">Name your camp</label></p>
      <p><input type="text" id="campName" value="Emberhold" maxlength="30" autocomplete="off"></p>
      <p>Starting region: Forest valley. Mild seasons and plenty of food and timber. Harder regions will come in a later update.</p>
      ${saved ? '<p class="warning">Starting a new game replaces your current saved game.</p>' : ''}
      <div class="actions">
        <button type="submit" class="primary">Start</button>
        <button type="button" data-action="title">Back</button>
      </div>
    </form>`;
}

function adviceList(advice) {
  if (!advice.length) return '<p>No concerns right now.</p>';
  return `<ul>${advice.map((a) => {
    const label = a.severity === 'urgent' ? 'Urgent' : a.severity === 'warning' ? 'Warning' : 'Note';
    return `<li class="${a.severity === 'note' ? '' : a.severity}"><span>${label} from ${esc(a.name)}, ${esc(a.title.toLowerCase())}:</span> ${esc(a.text)}</li>`;
  }).join('')}</ul>`;
}

function reportScreen() {
  const r = state.report;
  const title = r.finished ? `${r.title}` : r.title;
  let html = `<h1>Report: ${esc(title)}</h1>`;
  if (r.finished) html += `<p class="muted">What happened during ${esc(r.finished)}.</p>`;
  if (r.urgent.length) {
    html += `<h2>Urgent</h2><ul>${r.urgent.map((t) => `<li class="urgent">${esc(t)}</li>`).join('')}</ul>`;
  }
  if (r.events.length) {
    html += `<h2>${r.finished ? 'What happened' : 'Your story begins'}</h2><ul>${r.events.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (state.gameOver) {
    html += `<div class="actions"><button type="button" class="primary" data-action="showNewGame">Start a new game</button></div>`;
    return html;
  }
  html += `<h2>Advisors</h2>${adviceList(getAdvice(state))}`;
  html += `<div class="actions"><button type="button" data-nav="people">Assign people</button><button type="button" data-nav="build">Build</button></div>`;
  return html;
}

function taskCounts() {
  const people = living(state);
  return TASK_ORDER
    .map((t) => [t, people.filter((p) => p.task === t).length])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${TASKS[t].name} ${n}`)
    .join(', ');
}

function advisorTitleFor(person) {
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    if (state.advisors[role] === person.id) return info.title.toLowerCase();
  }
  return '';
}

function taskOptions(selected) {
  return TASK_ORDER.map((t) => `<option value="${t}"${t === selected ? ' selected' : ''}>${TASKS[t].name}</option>`).join('');
}

function peopleScreen() {
  const people = living(state);
  const s = seasonIndex(state);
  let html = `<h1>People</h1>
    <p>${plural(people.length, 'person', 'people')} in camp. Food needed this season: ${foodNeeded(people.length)}.</p>
    <p id="taskSummary">${esc(taskCounts())}.</p>
    <details>
      <summary>What each task does</summary>
      <ul>${TASK_ORDER.map((t) => `<li><strong>${TASKS[t].name}:</strong> ${esc(TASKS[t].description)}</li>`).join('')}</ul>
    </details>
    <h2>Move a group</h2>
    <p><label for="bulkFrom">Move everyone doing</label>
      <select id="bulkFrom">${taskOptions(s === 3 ? 'forage' : 'rest')}</select></p>
    <p><label for="bulkTo">to</label>
      <select id="bulkTo">${taskOptions('hunt')}</select></p>
    <p><button type="button" data-action="bulkMove">Move them</button></p>
    <h2>Everyone</h2>
    <ul class="plain">`;
  for (const p of people) {
    const role = advisorTitleFor(p);
    const skills = SKILLS.map((k) => `${k} ${p.skills[k]}`).join(', ');
    html += `<li class="card">
      <h3>${esc(p.name)}${role ? `, ${esc(role)}` : ''}</h3>
      <p>${healthWord(p.health)}, ${moraleWord(p.morale)}. Skills: ${skills}.</p>
      <p class="muted">${esc(p.note)}</p>
      <p><label for="task-${p.id}">Task for ${esc(p.name)}</label>
        <select id="task-${p.id}" data-person="${p.id}">${taskOptions(p.task)}</select></p>
    </li>`;
  }
  html += '</ul>';
  return html;
}

function buildScreen() {
  const people = living(state);
  const builders = people.filter((p) => p.task === 'build');
  const workRate = Math.round(builders.reduce((sum, p) => sum + expectedWork(p), 0));
  let html = `<h1>Build</h1>
    <p>Wood: ${state.resources.wood}. Shelter for ${shelterCapacity(state)}, and ${plural(people.length, 'person', 'people')} in camp.</p>
    <h2>Current project</h2>`;
  if (state.project) {
    const b = BUILDINGS[state.project.id];
    const done = Math.floor(state.project.progress);
    html += `<p>${esc(b.name)}: ${done} of ${b.work} work done.</p>
      <p>${plural(builders.length, 'builder', 'builders')} assigned, about ${workRate} work per season.${builders.length ? ` About ${Math.max(1, Math.ceil((b.work - done) / Math.max(1, workRate)))} more ${Math.ceil((b.work - done) / Math.max(1, workRate)) === 1 ? 'season' : 'seasons'} to finish.` : ' Assign builders on the People screen.'}</p>
      <p><button type="button" data-action="cancelProject">Cancel the ${esc(b.name.toLowerCase())}</button></p>`;
  } else {
    html += `<p>None. Choose a building below. Its wood is paid when work begins.</p>`;
  }
  html += '<h2>Buildings</h2><ul class="plain">';
  for (const id of BUILDING_ORDER) {
    const b = BUILDINGS[id];
    const owned = state.buildings[id];
    const status = b.repeatable ? `You have ${owned}.` : owned ? 'Built.' : 'Not built.';
    html += `<li class="card"><h3>${esc(b.name)}</h3>
      <p>${esc(b.description)}</p>
      <p>${status} Costs ${b.cost} wood and ${b.work} work.</p>`;
    if (!state.project && (b.repeatable || !owned)) {
      html += `<p><button type="button" data-action="startProject" data-building="${id}">Build ${esc(b.name.toLowerCase())}</button></p>`;
    }
    html += '</li>';
  }
  html += '</ul>';
  return html;
}

function advisorsScreen() {
  const advice = getAdvice(state);
  let html = '<h1>Advisors</h1><p>Your advisors always follow your orders, but they will tell you when they think something is going wrong.</p>';
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    const person = advisorPerson(state, role);
    if (!person) continue;
    html += `<h2>${esc(info.title)}: ${esc(person.name)}</h2><p class="muted">Watches over ${esc(info.domain)}.</p>`;
    html += adviceList(advice.filter((a) => a.role === role));
  }
  if (state.discoveries.length) {
    html += `<h2>Places discovered</h2><ul>${state.discoveries.map((d) => `<li>${esc(DISCOVERIES[d].name)}</li>`).join('')}</ul>`;
  }
  return html;
}

function chronicleScreen() {
  let html = '<h1>Chronicle</h1>';
  if (!state.log.length) return `${html}<p>Nothing has happened yet. End your first season to begin the chronicle.</p>`;
  html += '<p>The most recent seasons come first.</p>';
  const groups = [];
  for (const entry of [...state.log].reverse()) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== entry.date) {
      if (groups.length >= 12) break;
      g = { date: entry.date, lines: [] };
      groups.push(g);
    }
    g.lines.push(entry.text);
  }
  for (const g of groups) {
    html += `<h2>${esc(g.date)}</h2><ul>${[...g.lines].reverse().map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  return html;
}

function menuScreen() {
  return `<h1>Menu</h1>
    <p>Your game saves automatically after every action.</p>
    <h2>Saves</h2>
    <p>Export your save to keep a backup or move your game to another device.</p>
    <div class="actions">
      <button type="button" data-action="exportSave">Export save file</button>
      <button type="button" data-action="importSave">Load a save file</button>
    </div>
    <input type="file" id="importInput" accept=".json,application/json" class="visually-hidden" tabindex="-1" aria-hidden="true">
    <h2>New game</h2>
    <div class="actions"><button type="button" data-action="showNewGame">Start a new game</button></div>
    <h2>How to play</h2>
    <p>Each turn is one season. Assign every person a task on the People screen, choose a building project on the Build screen, then choose End season.</p>
    <p>Everyone eats 2 food each season. Nothing grows in winter and hunting is poor, so store food during summer and autumn. Food also spoils in storage.</p>
    <p>Autumn and winter fires burn wood, and anyone without shelter suffers from the cold. Each lean-to shelters 4 more people.</p>
    <p>Hurt people work at half strength. Have them rest, and have a healer tend them.</p>
    <p>Scouts can find useful places and new people. Raiders may attack; scouts and a watchtower help you see them coming, and a palisade helps you hold them off.</p>
    <p>Your advisors read the situation every season. Check the Report or Advisors screen for warnings.</p>`;
}

function raidScreen() {
  const ev = state.pendingEvent;
  const people = living(state);
  const able = people.filter((p) => p.health >= 40);
  const odds = raidOdds(state, able, ev.warned, ev.raiders);
  const chief = advisorPerson(state, 'warChief');
  let html = `<h1>Raiders!</h1>
    <p class="urgent">${ev.warned
      ? `Scouts spotted about ${ev.raiders} armed raiders heading for ${esc(state.campName)}. There is time to prepare.`
      : `About ${ev.raiders} armed raiders are at the edge of ${esc(state.campName)}, and they caught you by surprise. Defenders will fight at a disadvantage.`}</p>
    ${state.buildings.palisade ? '<p>Your palisade will help the defenders.</p>' : ''}
    <form id="raidForm">
      <fieldset>
        <legend>Your response</legend>
        <label class="choice"><input type="radio" name="plan" value="fight" checked> Stand and fight</label>
        <label class="choice"><input type="radio" name="plan" value="hide"> Hide what you can and flee into the trees. Nobody gets hurt, but the raiders take some food and wood.</label>
      </fieldset>
      <fieldset id="defenders">
        <legend>Defenders, if you fight</legend>
        <div class="actions">
          <button type="button" data-action="selectAllDefenders">Select all able</button>
          <button type="button" data-action="clearDefenders">Clear</button>
        </div>`;
  for (const p of people) {
    const canFight = p.health >= 40;
    html += `<label class="choice"><input type="checkbox" name="defender" value="${p.id}"${canFight ? ' checked' : ''}>
      ${esc(p.name)}, hunting ${p.skills.hunting}, ${healthWord(p.health)}</label>`;
  }
  html += `</fieldset>
      <h2>War chief's estimate</h2>
      <p id="raidOdds" aria-live="polite">${chief ? `${esc(chief.name)} says: ` : ''}with ${plural(able.length, 'defender', 'defenders')}, we are ${odds.word}.</p>
      <div class="actions"><button type="submit" class="primary">Confirm</button></div>
    </form>`;
  return html;
}

function updateRaidOdds() {
  const form = document.getElementById('raidForm');
  if (!form || !state.pendingEvent) return;
  const ids = [...form.querySelectorAll('input[name="defender"]:checked')].map((i) => Number(i.value));
  const defenders = ids.map((id) => personById(state, id));
  const chief = advisorPerson(state, 'warChief');
  const prefix = chief ? `${chief.name} says: ` : '';
  const out = document.getElementById('raidOdds');
  if (!defenders.length) {
    out.textContent = `${prefix}with no defenders, we cannot fight.`;
    return;
  }
  const odds = raidOdds(state, defenders, state.pendingEvent.warned, state.pendingEvent.raiders);
  out.textContent = `${prefix}with ${plural(defenders.length, 'defender', 'defenders')}, we are ${odds.word}.`;
}

// ---------- events ----------

function startNewGame(campName) {
  state = newGame({ seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, campName });
  storage.save(state);
  show('report');
}

function triggerImport() {
  const input = document.getElementById('importInput');
  if (input) input.click();
}

$main.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    show(navBtn.dataset.nav);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  handleAction(btn.dataset.action, btn);
});

$nav.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    show(navBtn.dataset.nav);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (btn) handleAction(btn.dataset.action, btn);
});

function handleAction(action, btn) {
  switch (action) {
    case 'continue':
      state = storage.load();
      if (state) show('report');
      break;
    case 'showNewGame':
      show('newGame');
      break;
    case 'title':
      show(state ? 'menu' : 'title');
      break;
    case 'importSave':
      triggerImport();
      break;
    case 'exportSave':
      storage.exportFile(state);
      announce('Save file exported.');
      break;
    case 'endTurn': {
      const msg = act({ type: 'endTurn' });
      if (msg) show('report');
      break;
    }
    case 'startProject': {
      const msg = act({ type: 'startProject', buildingId: btn.dataset.building });
      if (msg) {
        show('build', { focus: false });
        announce(msg);
        const h = $main.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      break;
    }
    case 'cancelProject': {
      if (!window.confirm('Cancel this project? If work has started, only half the wood is recovered.')) break;
      const msg = act({ type: 'cancelProject' });
      if (msg) {
        show('build', { focus: false });
        announce(msg);
        const h = $main.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      break;
    }
    case 'bulkMove': {
      const from = document.getElementById('bulkFrom').value;
      const to = document.getElementById('bulkTo').value;
      const msg = act({ type: 'assignAll', fromTask: from, task: to });
      if (msg) {
        for (const sel of $main.querySelectorAll('select[data-person]')) {
          const p = personById(state, Number(sel.dataset.person));
          if (p) sel.value = p.task;
        }
        document.getElementById('taskSummary').textContent = `${taskCounts()}.`;
        announce(msg);
      }
      break;
    }
    case 'selectAllDefenders':
    case 'clearDefenders': {
      for (const box of $main.querySelectorAll('input[name="defender"]')) {
        const p = personById(state, Number(box.value));
        box.checked = action === 'selectAllDefenders' ? p.health >= 40 : false;
      }
      updateRaidOdds();
      break;
    }
    default:
      break;
  }
}

$main.addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-person]');
  if (sel) {
    const ok = act({ type: 'assign', personId: Number(sel.dataset.person), task: sel.value });
    if (ok) document.getElementById('taskSummary').textContent = `${taskCounts()}.`;
    return;
  }
  if (e.target.name === 'defender') {
    updateRaidOdds();
    return;
  }
  if (e.target.id === 'importInput' && e.target.files[0]) {
    storage.importFile(e.target.files[0])
      .then((data) => {
        state = data;
        storage.save(state);
        show('report');
        announce(`Loaded ${state.campName}, ${dateLabel(state)}.`);
      })
      .catch((err) => announce(err.message));
  }
});

$main.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'newGameForm') {
    startNewGame(document.getElementById('campName').value);
    return;
  }
  if (e.target.id === 'raidForm') {
    const plan = e.target.querySelector('input[name="plan"]:checked').value;
    const defenderIds = [...e.target.querySelectorAll('input[name="defender"]:checked')].map((i) => Number(i.value));
    const msg = act({ type: 'resolveRaid', plan, defenderIds });
    if (msg) show('report');
  }
});

// ---------- start ----------

show('title');
