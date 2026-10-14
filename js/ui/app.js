// The interface. It reads the game state and sends actions to the engine;
// it never changes the game state directly.

import { newGame, applyAction } from '../engine/game.js';
import {
  living, dateLabel, shelterCapacity, healthWord, moraleWord, seasonIndex,
  foodNeeded, personById, placeName, knownPlaces, unexploredNeighbors, abundanceWord,
  isKnown, wolvesAt, availableTasks, hasKnowledge, knowledgeBlocker, fieldPlots,
  allowedTasksFor, lifeStage, canFight, metNeighbors, relationWord, storageCapacity, leanTimesNow,
  inVillage, eraAtLeast, taskAvailable, knowledgeClosed,
} from '../engine/state.js';
import {
  TASKS, TASK_ORDER, BUILDINGS, BUILDING_ORDER, SKILLS, PLACES, KNOWLEDGE, KNOWLEDGE_ORDER, NEIGHBORS, LEAN_TIMES,
  PRIORITY_AREAS, PRIORITY_LEVELS, BRANCHES, TREATIES, TREATY_ORDER, ERA_NAMES, LAWS, LAW_ORDER,
} from '../engine/data.js';
import { getAdvice, ADVISOR_ROLES, advisorPerson, raidOdds } from '../engine/advisors.js';
import { expectedWork, siteFor, studyPoints, expectedHarvest } from '../engine/rules.js';
import { describePending } from '../engine/events.js';
import { diplomacyOptions } from '../engine/neighbors.js';
import {
  TRADITIONS, traditionProgress, reputationSummary, attitudeLines,
} from '../engine/legacy.js';
import {
  battleView, formationPlan, FORMATIONS, ORDER_NAMES,
} from '../engine/battle.js';
import {
  remainingQueueWork, queueBlocker, queuedCount, refundFor, refundWords, costWords, shortfall,
} from '../engine/building.js';
import { seasonsToNextLevel } from '../engine/skills.js';
import {
  feastBlocker, feastCost, feastGuests, FEAST_GUEST_FOOD,
} from '../engine/stores.js';
import {
  villageBlocker, groups, notablePeople, GROUP_NAMES,
} from '../engine/village.js';
import {
  nationsActive, owner, landsOf, claimLimit, claimBlocker, nationSummary, trustWord, valleyLines,
} from '../engine/nations.js';
import {
  settlementBlocker, settlementSites, settlerRange, governorChoices, settlementProduct, expectedShipment,
  POLICIES, costText, MIN_VILLAGE,
} from '../engine/settlements.js';
import {
  lawsAvailable, seasonsUntilChange,
} from '../engine/laws.js';
import {
  ransom, ransomGoods, sallyEvent,
} from '../engine/siege.js';
import { estimateBattle } from '../engine/battle.js';
import {
  hireBlocker, swordsBlocker, swordsActive, comfortsCost, HIRE_MASTER_COST, SWORDS_COST, SWORDS_COUNT,
} from '../engine/goods.js';
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
  ['map', 'Map'],
  ['build', 'Build'],
  ['knowledge', 'Knowledge'],
  ['neighbors', 'Neighbors'],
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

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function listWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// Moves focus to the first matching element, for after a screen redraw.
function refocus(...selectors) {
  for (const sel of selectors) {
    const el = $main.querySelector(sel);
    if (el) {
      if (!el.matches('button, select, input, a')) el.setAttribute('tabindex', '-1');
      el.focus();
      return;
    }
  }
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
    + `food ${state.resources.food} of ${storageCapacity(state)}, wood ${state.resources.wood}, `
    + `${taskAvailable(state, 'quarry') || state.resources.stone ? `stone ${state.resources.stone || 0}, ` : ''}`
    + `${taskAvailable(state, 'craft') || state.resources.goods ? `goods ${state.resources.goods || 0}, ` : ''}`
    + `shelter for ${shelterCapacity(state)}.${state.siege ? ' Under siege.' : ''}`;
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
    .map(([id, label]) => [id, id === 'people' && inVillage(state) ? 'Village' : label])
    .map(([id, label]) => `<li><button type="button" data-nav="${id}"${screen === id ? ' aria-current="page"' : ''}>${label}</button></li>`);
  if (!state.gameOver) items.push('<li><button type="button" class="primary" data-action="endTurn">End season</button></li>');
  $nav.innerHTML = `<ul>${items.join('')}</ul>`;
}

function render() {
  updateStatus();
  let html;
  if (screen === 'title') html = titleScreen();
  else if (screen === 'newGame') html = newGameScreen();
  else if (state.pendingEvent && !state.gameOver) {
    html = state.pendingEvent.type === 'raid' ? raidScreen() : storyScreen();
  }
  else html = ({
    foundVillage: foundVillageScreen,
    foundSettlement: foundSettlementScreen,
    report: reportScreen, people: () => (inVillage(state) ? villageScreen() : peopleScreen()), map: mapScreen, build: buildScreen, knowledge: knowledgeScreen, neighbors: neighborsScreen,
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
    <p>Twelve survivors in a forest valley, trying to last through their first winters. Grow strong enough and your camp can become a village, the start of the Settlement era.</p>`;
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
  if (r.decisions && r.decisions.length) {
    html += `<h2>Your decision</h2><ul>${r.decisions.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (r.events.length) {
    html += `<h2>${r.finished ? 'What happened' : 'Your story begins'}</h2><ul>${r.events.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (state.gameOver) {
    html += `<div class="actions"><button type="button" class="primary" data-action="showNewGame">Start a new game</button></div>`;
    return html;
  }
  if (r.orders && r.orders.length) {
    html += `<h2>Standing orders carried out</h2><ul>${r.orders.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  html += `<h2>Advisors</h2>${adviceList(getAdvice(state))}`;
  if (state.siege) {
    const chance = estimateBattle(state, sallyEvent(state), null, 12);
    const word = chance >= 0.75 ? 'likely to win' : chance >= 0.45 ? 'an even fight' : 'likely to lose';
    const cost = ransom(state);
    html += `<h2 id="siegeHeading">Siege</h2>
      <p>About ${state.siege.raiders} Skarn surround ${esc(state.campName)}. They have supplies for about ${plural(state.siege.supplies, 'more season', 'more seasons')}, and lose some to hunger each season. While they stay, no one can work outside the walls.</p>
      <p>Sallying out means fighting them in the open, with no walls, against besiegers dug in behind stakes and ditches. The war chief thinks that would be ${word}.</p>
      <div class="actions">
        <button type="button" data-action="sallyOut">Sally out and fight them</button>
        ${state.resources.food >= cost ? `<button type="button" data-action="payBesiegers">Pay them ${cost} food to leave</button>` : `<p>They would leave for ${cost} food, and you have ${state.resources.food}.</p>`}
        ${(state.resources.goods || 0) >= ransomGoods(state) ? `<button type="button" data-action="payBesiegers" data-goods="1">Pay them ${ransomGoods(state)} goods to leave</button>` : ''}
      </div>
      <p class="muted">Or wait: end the season, and the siege goes on.</p>`;
  }
  html += storesSection();
  if (inVillage(state) && !(state.settlements || []).length && living(state).length >= MIN_VILLAGE - 10) {
    const why = settlementBlocker(state);
    html += `<h2>A second settlement</h2>
      <p>Founding a second settlement on land your village holds will end the Settlement era and begin the Nation era.${why ? ` ${esc(why)}` : ' Your village is ready.'}</p>
      ${why ? '' : '<div class="actions"><button type="button" data-nav="foundSettlement">Plan a new settlement</button></div>'}`;
  }
  if (!villageBlocker(state)) {
    html += `<h2>Become a village</h2>
      <p>${esc(state.campName)} has grown into a true settlement. Your people could become a village whenever you choose. It is a big change, and it cannot be undone.</p>
      <div class="actions"><button type="button" data-nav="foundVillage">Consider becoming a village</button></div>`;
  }
  html += `<div class="actions"><button type="button" data-nav="people">${inVillage(state) ? 'Village and priorities' : 'Assign people'}</button><button type="button" data-nav="build">Build</button></div>`;
  return html;
}

// The food stores, lean times, and feasts.
function storesSection() {
  const people = living(state);
  const food = state.resources.food;
  const room = storageCapacity(state);
  const need = foodNeeded(people);
  const seasons = need ? Math.floor(food / need) : 0;
  let html = `<h2 id="storesHeading">Stores</h2>
    <p>Food: ${food}, with room for ${room}. That feeds everyone for ${plural(seasons, 'season', 'seasons')}. Food beyond the room rots quickly; each storehouse adds room for 150.</p>`;
  const extras = [];
  if (taskAvailable(state, 'quarry') || state.resources.stone) extras.push(`Stone: ${state.resources.stone || 0}, cut by quarriers.`);
  if (taskAvailable(state, 'craft') || state.resources.goods) extras.push(`Goods: ${state.resources.goods || 0}, made by crafters, for trade, fine gifts, and grand buildings.`);
  if (state.buildings.pasture) extras.push(`Pastures give ${state.buildings.pasture * 6} food every season.`);
  if (extras.length) html += `<p>${esc(extras.join(' '))}</p>`;
  const lean = leanTimesNow(state);
  if (lean.length) html += `<ul>${lean.map((c) => `<li>${esc(LEAN_TIMES[c.id].name)}: ${esc(LEAN_TIMES[c.id].effect)}</li>`).join('')}</ul>`;
  const cost = feastCost(state);
  const why = feastBlocker(state);
  html += `<h3>Feast</h3><p>A feast costs ${cost} food, 3 for each person. It lifts everyone's spirits, and people in high spirits work better. Families grow closer, so a child is more likely. You can hold one feast a year, and invite a neighboring people for ${FEAST_GUEST_FOOD} food more to win their goodwill.</p>`;
  if (why) {
    html += `<p id="feastStatus">${esc(why)}</p>`;
  } else {
    const guests = feastGuests(state).filter((id) => !feastBlocker(state, id));
    html += `<div class="actions"><button type="button" data-action="holdFeast">Hold a feast for ${cost} food</button>${guests.map((id) => `<button type="button" data-action="holdFeast" data-guest="${id}">Feast with ${esc(NEIGHBORS[id].name)} for ${feastCost(state, id)} food</button>`).join('')}</div>`;
  }
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

function taskOptions(selected, person = null) {
  const tasks = person ? allowedTasksFor(state, person) : availableTasks(state);
  return tasks.map((t) => `<option value="${t}"${t === selected ? ' selected' : ''}>${TASKS[t].name}</option>`).join('');
}

const ORDER_NOTES = {
  hurt: 'Resting until healed, by standing order.',
  winter: 'Hunting through the winter, by standing order.',
  healer: 'Tending the hurt, by standing order.',
};

function workSitesSentence() {
  return `Hunters work at ${placeName(state, siteFor(state, 'hunt'))}. `
    + `Foragers work at ${placeName(state, siteFor(state, 'forage'))}. `
    + `Woodcutters work at ${placeName(state, siteFor(state, 'wood'))}. `
    + (taskAvailable(state, 'quarry') ? `Quarriers work at ${placeName(state, siteFor(state, 'quarry'))}. ` : '')
    + `Scouts explore beyond ${placeName(state, siteFor(state, 'scout'))}.`;
}

function farmSentence() {
  const plots = fieldPlots(state);
  if (!plots) return 'You know how to farm but have no fields yet. Build one on the Build screen.';
  const s = seasonIndex(state);
  const f = state.farm;
  let now = '';
  if (s === 0) now = `It is planting season. ${f.planted} planted so far; each farmer plants 2.`;
  else if (s === 1) now = f.planted ? `${f.planted} plots are growing and need tending; each farmer tends 3.` : 'Nothing was planted this spring.';
  else if (s === 2) now = f.planted ? `${f.planted} plots are ready to harvest; each farmer harvests 3.` : 'Nothing was planted this year.';
  else now = 'The fields rest in winter.';
  const harvest = Math.round(expectedHarvest(state));
  return `Fields: room for ${plots} plots. ${now}${harvest ? ` Expected harvest this autumn: about ${harvest} food.` : ''}`;
}

function practiceLine(p) {
  const skill = TASKS[p.task] && TASKS[p.task].skill;
  if (!skill) return '';
  const left = seasonsToNextLevel(p, skill);
  if (left === null) return `<p>A master of ${skill}.</p>`;
  return `<p>Practicing ${skill}: about ${plural(left, 'more season', 'more seasons')} to reach ${p.skills[skill] + 1}.</p>`;
}

function personStatus(p) {
  const bits = [`age ${p.age}`, healthWord(p.health)];
  if (p.sick) bits.push('sick with fever');
  bits.push(moraleWord(p.morale));
  return bits.join(', ');
}

function personCard(p) {
  const role = advisorTitleFor(p);
  const skills = SKILLS.map((k) => `${k} ${p.skills[k]}`).join(', ');
  const infant = lifeStage(p) === 'infant';
  return `<li class="card">
    <h3>${esc(p.name)}${role ? `, ${esc(role)}` : ''}</h3>
    <p>${esc(capitalize(personStatus(p)))}.${infant ? '' : ` Skills: ${skills}.`}</p>
    <p class="muted">${esc(p.note)}</p>
    ${infant ? '<p>Too young to work, and looked after by everyone.</p>' : `
    ${practiceLine(p)}
    ${p.orderReturn ? `<p>${esc(ORDER_NOTES[p.orderReturn.reason] || 'Moved by a standing order.')}</p>` : ''}
    <p><label for="task-${p.id}">Task for ${esc(p.name)}</label>
      <select id="task-${p.id}" data-person="${p.id}">${taskOptions(p.task, p)}</select></p>`}
  </li>`;
}

// One line per person: fewer swipes when the camp is large.
function personRow(p) {
  const role = advisorTitleFor(p);
  const skill = TASKS[p.task] && TASKS[p.task].skill;
  const label = `${p.name}${role ? `, ${role}` : ''}, ${personStatus(p)}${skill ? `, ${skill} ${p.skills[skill]}` : ''}`;
  if (lifeStage(p) === 'infant') return `<li><p>${esc(label)}. Too young to work.</p></li>`;
  return `<li><p><label for="task-${p.id}">${esc(label)}</label>
    <select id="task-${p.id}" data-person="${p.id}">${taskOptions(p.task, p)}</select></p></li>`;
}

function peopleScreen() {
  const people = living(state);
  const s = seasonIndex(state);
  const compact = storage.getSetting('peopleView', 'detailed') === 'compact';
  const adults = people.filter((p) => p.age >= 16);
  const young = people.filter((p) => p.age < 16);
  let html = `<h1>People</h1>
    <p>${plural(people.length, 'person', 'people')} in camp${young.length ? `, ${plural(young.length, 'of them young', 'of them young')}` : ''}. Food needed this season: ${foodNeeded(people)}.</p>
    <p id="taskSummary">${esc(taskCounts())}.</p>
    <p>${esc(workSitesSentence())} Change work sites on the Map screen.</p>
    ${hasKnowledge(state, 'farming') ? `<p>${esc(farmSentence())}</p>` : ''}
    <p><label for="peopleView">List style</label>
      <select id="peopleView"><option value="detailed"${compact ? '' : ' selected'}>Detailed, with a heading for each person</option><option value="compact"${compact ? ' selected' : ''}>Compact, one line per person</option></select></p>
    <details>
      <summary>What each task does</summary>
      <ul>${availableTasks(state).map((t) => `<li><strong>${TASKS[t].name}:</strong> ${esc(TASKS[t].description)}</li>`).join('')}</ul>
      <p>Children from 5 to 11 can forage, farm, study, or rest, at half strength. From 12 they can do any work.</p>
    </details>
    <p><button type="button" class="primary" data-action="assignBest">Assign everyone to their best work</button></p>
    <p class="muted">Puts each person on the work they are most skilled at, as far as it makes sense this season. The hurt and sick rest. Check your steward's advice afterward; the best work is not always enough food.</p>
    <h2>Move a group</h2>
    <p><label for="bulkFrom">Move everyone doing</label>
      <select id="bulkFrom">${taskOptions(s === 3 ? 'forage' : 'rest')}</select></p>
    <p><label for="bulkTo">to</label>
      <select id="bulkTo">${taskOptions('hunt')}</select></p>
    <p><button type="button" data-action="bulkMove">Move them</button></p>`;
  const section = (title, list) => {
    if (!list.length) return '';
    return `<h2>${title} (${list.length})</h2><ul class="plain">${list.map(compact ? personRow : personCard).join('')}</ul>`;
  };
  html += section('Adults', adults) + section('Young people', young);
  return html;
}

const SITE_LABELS = {
  hunt: 'Hunters work at',
  forage: 'Foragers work at',
  wood: 'Woodcutters work at',
  quarry: 'Quarriers work at',
};

function siteOptionText(id, task) {
  const name = placeName(state, id);
  if (task === 'scout') {
    const n = unexploredNeighbors(state, id).length;
    return `${name} (${n ? `${n} unexplored ${n === 1 ? 'path' : 'paths'}` : 'all paths explored'})`;
  }
  const bits = [];
  const b = PLACES[id].bonus[task] || 0;
  const unit = { wood: 'wood', quarry: 'stone' }[task] || 'food';
  if (b) bits.push(`${b > 0 ? 'plus' : 'minus'} ${Math.abs(b)} ${unit} per worker`);
  if (task === 'hunt' || task === 'forage') bits.push(`${task === 'hunt' ? 'game' : 'wild food'} ${abundanceWord(state.places[id].abundance[task])}`);
  if (PLACES[id].distance >= 3) bits.push('far');
  if (task === 'hunt' && wolvesAt(state, id)) bits.push('wolves');
  return bits.length ? `${name} (${bits.join(', ')})` : name;
}

function mapScreen() {
  const known = knownPlaces(state);
  let html = `<h1>Map</h1>
    <p>You know ${plural(known.length, 'place', 'places')}, counting your camp, ${esc(state.campName)}. Scouts find more by exploring the unexplored paths.</p>
    <h2>Work sites</h2>
    <p>Everyone doing the same task works at the same place. Hunting and foraging wear a place down over time; it recovers when left alone.</p>`;
  for (const task of ['hunt', 'forage', 'wood', ...(taskAvailable(state, 'quarry') ? ['quarry'] : [])]) {
    const options = known.filter((id) => PLACES[id].tasks.includes(task));
    html += `<p><label for="site-${task}">${SITE_LABELS[task]}</label>
      <select id="site-${task}" data-site="${task}">${options.map((id) => `<option value="${id}"${siteFor(state, task) === id ? ' selected' : ''}>${esc(siteOptionText(id, task))}</option>`).join('')}</select></p>`;
  }
  html += `<p><label for="site-scout">Scouts explore beyond</label>
    <select id="site-scout" data-site="scout">${known.map((id) => `<option value="${id}"${siteFor(state, 'scout') === id ? ' selected' : ''}>${esc(siteOptionText(id, 'scout'))}</option>`).join('')}</select></p>`;
  if (nationsActive(state)) {
    const held = landsOf(state, 'player').filter((p) => p !== 'camp');
    html += `<h2 id="landsHeading">Your lands</h2>
      <p>Besides ${esc(state.campName)}, your village holds ${held.length ? esc(listWords(held.map((p) => placeName(state, p)))) : 'no other places'}: ${held.length} of the ${claimLimit(state)} it can hold. More people let you hold more. You can claim a place that borders your land and that no one else holds. Working on another people's land angers them, unless you have an open lands pact.</p>`;
  }
  html += '<h2>Places you know</h2><ul class="plain">';
  for (const id of known) {
    const place = PLACES[id];
    const links = place.neighbors.filter((n) => isKnown(state, n)).map((n) => placeName(state, n));
    const unexplored = unexploredNeighbors(state, id).length;
    const linkParts = [...links];
    if (unexplored) linkParts.push(unexplored === 1 ? 'one unexplored path' : `${unexplored} unexplored paths`);
    const conditions = [];
    if (wolvesAt(state, id)) conditions.push('A wolf pack roams here. Hunting is dangerous and poor.');
    if (place.tasks.includes('hunt')) conditions.push(`Game is ${abundanceWord(state.places[id].abundance.hunt)}.`);
    if (place.tasks.includes('forage')) conditions.push(`Wild food is ${abundanceWord(state.places[id].abundance.forage)}.`);
    const workingHere = [];
    if (siteFor(state, 'hunt') === id) workingHere.push('hunters');
    if (siteFor(state, 'forage') === id) workingHere.push('foragers');
    if (siteFor(state, 'wood') === id) workingHere.push('woodcutters');
    if (taskAvailable(state, 'quarry') && siteFor(state, 'quarry') === id) workingHere.push('quarriers');
    const who = nationsActive(state) ? owner(state, id) : null;
    const ownerLine = !nationsActive(state) ? ''
      : who === 'player' ? '<p>Yours.</p>'
        : who ? `<p>Belongs to ${esc(NEIGHBORS[who].name)}.</p>` : '<p>Unclaimed.</p>';
    const canClaim = nationsActive(state) && !who && !claimBlocker(state, id);
    html += `<li class="card"><h3 id="place-${id}">${esc(placeName(state, id))}</h3>
      ${ownerLine}
      <p>${esc(place.description)}${place.distance >= 3 ? ' It is far from camp, so work here goes a little slower.' : ''}</p>
      ${conditions.length ? `<p>${conditions.join(' ')}</p>` : ''}
      <p>Paths lead to ${esc(listWords(linkParts) || 'nowhere new')}.</p>
      ${workingHere.length ? `<p>Your ${esc(listWords(workingHere))} work here.</p>` : ''}
      ${siteFor(state, 'scout') === id ? '<p>Your scouts explore from here.</p>' : ''}
      ${(state.settlements || []).filter((t) => t.place === id).map((t) => `<p>Your settlement of ${esc(t.name)} stands here, with ${plural(t.population, 'person', 'people')}.</p>`).join('')}
      ${canClaim ? `<p><button type="button" data-action="claimPlace" data-place="${id}">Claim ${esc(placeName(state, id))}</button></p>` : ''}
    </li>`;
  }
  html += '</ul>';
  return html;
}

function knowledgeScreen() {
  const k = state.knowledge;
  const studiers = living(state).filter((p) => p.task === 'study');
  const rate = Math.round(studiers.reduce((sum, p) => sum + studyPoints(p, state), 0));
  let html = `<h1>Knowledge</h1>
    <p>${inVillage(state) ? 'Scholars make discoveries; the learning priority on the Village screen sets how many study.' : 'People set to Study on the People screen make discoveries.'} ${plural(studiers.length, 'person is', 'people are')} studying, for about ${rate} points a season. Points left over from one discovery go straight into the next one in the queue.</p>
    <h2>Current study</h2>`;
  if (k.current) {
    const item = KNOWLEDGE[k.current];
    const done = Math.floor(k.progress[k.current] || 0);
    const seasons = rate ? Math.ceil((item.cost - done) / rate) : null;
    html += `<p>${esc(item.name)}: ${done} of ${item.cost} points.${seasons ? ` About ${plural(seasons, 'more season', 'more seasons')}.` : ' No one is studying it.'}</p>`;
  } else {
    html += '<p>Nothing chosen. Pick a discovery below.</p>';
  }
  html += `<h2 id="studyQueueHeading">Study queue (${k.queue.length})</h2>`;
  if (!k.queue.length) {
    html += '<p>Empty. Discoveries in the queue start one after another, as soon as each is possible.</p>';
  } else {
    html += `<ol class="plain">${k.queue.map((id, i) => {
      const why = knowledgeBlocker(state, id);
      return `<li class="card"><p><strong>${i + 1}. ${esc(KNOWLEDGE[id].name)}.</strong> ${KNOWLEDGE[id].cost} points.${why ? ` Waiting: ${esc(why)}` : ''}</p>
        <p><button type="button" data-action="unqueueStudy" data-knowledge="${id}">Remove ${esc(KNOWLEDGE[id].name.toLowerCase())} from the queue</button></p></li>`;
    }).join('')}</ol>`;
  }
  const planned = (id) => k.current === id || k.queue.includes(id);
  const open = KNOWLEDGE_ORDER.filter((id) => !knowledgeBlocker(state, id) && !planned(id));
  const closed = KNOWLEDGE_ORDER.filter((id) => !hasKnowledge(state, id) && knowledgeClosed(state, id));
  const locked = KNOWLEDGE_ORDER.filter((id) => !hasKnowledge(state, id) && knowledgeBlocker(state, id) && !knowledgeClosed(state, id) && !planned(id));
  const known = KNOWLEDGE_ORDER.filter((id) => hasKnowledge(state, id));
  // Discoveries grouped by branch of the research tree, each under its own heading.
  const byBranch = (ids, card) => Object.entries(BRANCHES)
    .map(([branch, title]) => [title, ids.filter((id) => KNOWLEDGE[id].branch === branch)])
    .filter(([, list]) => list.length)
    .map(([title, list]) => `<h3>${esc(title)}</h3><ul class="plain">${list.map(card).join('')}</ul>`)
    .join('');
  html += '<h2>Ready to study</h2>';
  if (!open.length) html += '<p>Nothing else right now.</p>';
  html += byBranch(open, (id) => {
    const item = KNOWLEDGE[id];
    const done = Math.floor(k.progress[id] || 0);
    const name = item.name.toLowerCase();
    return `<li class="card"><h4>${esc(item.name)}</h4>
      <p>${esc(item.effect)}</p>
      <p>Costs ${item.cost} points.${done ? ` ${done} points already done.` : ''}</p>
      <div class="actions">
        <button type="button" data-action="setStudy" data-knowledge="${id}">Study ${esc(name)} now</button>
        <button type="button" data-action="queueStudy" data-knowledge="${id}">Add ${esc(name)} to the queue</button>
      </div>
    </li>`;
  });
  if (locked.length) {
    html += '<h2>Not yet possible</h2>';
    html += byBranch(locked, (id) => `<li class="card"><h4>${esc(KNOWLEDGE[id].name)}</h4>
      <p>${esc(KNOWLEDGE[id].effect)}</p>
      <p>${esc(knowledgeBlocker(state, id))} Costs ${KNOWLEDGE[id].cost} points.</p>
      <p><button type="button" data-action="queueStudy" data-knowledge="${id}">Add ${esc(KNOWLEDGE[id].name.toLowerCase())} to the queue, to start when possible</button></p></li>`);
  }
  if (known.length) {
    html += `<h2>Known (${known.length})</h2><ul>${known.map((id) => `<li>${esc(KNOWLEDGE[id].name)}, ${esc(BRANCHES[KNOWLEDGE[id].branch].toLowerCase())}: ${esc(KNOWLEDGE[id].effect)}</li>`).join('')}</ul>`;
  }
  if (closed.length) {
    html += `<h2>Closed off by your choices</h2><ul>${closed.map((id) => `<li>${esc(KNOWLEDGE[id].name)}: ${esc(knowledgeClosed(state, id))}</li>`).join('')}</ul>`;
  }
  return html;
}

function nationSection(id) {
  const nat = state.neighbors[id].nation;
  const treaties = TREATY_ORDER.filter((k) => nat.treaties[k]).map((k) => TREATIES[k].name.toLowerCase());
  const memory = [...nat.memory].reverse().slice(0, 5);
  return `<h3>Their nation</h3>
    <p>${esc(nationSummary(state, id))}</p>
    <p>Trust: ${esc(trustWord(nat.trust))} (${nat.trust}).${treaties.length ? ` Treaties in force: ${esc(listWords(treaties))}.` : ' No treaties.'}</p>
    ${memory.length ? `<p>They remember that you:</p><ul>${memory.map((m) => `<li>${esc(m.text)}${m.kind === 'broken' ? ' (a broken promise)' : ''}.</li>`).join('')}</ul>` : ''}`;
}

function neighborsScreen() {
  const met = metNeighbors(state);
  const speaker = advisorPerson(state, 'speaker');
  let html = `<h1>Neighbors</h1>`;
  if (!met.length) {
    return `${html}<p>Your people know of no one else yet. Scouts exploring far from camp may find other peoples, and others may find you.</p>`;
  }
  html += `<p>${esc(reputationSummary(state))}</p>`;
  html += `<p>Each season you can send envoys to each people once${speaker ? `, led by ${esc(speaker.name)}, your speaker` : ''}. Relations run from hostile to close friends, and slowly drift toward each people's nature, shifted by your reputation.</p>`;
  for (const id of met) {
    const def = NEIGHBORS[id];
    const n = state.neighbors[id];
    const opts = diplomacyOptions(state, id);
    const ready = opts.filter((o) => o.ok);
    const blocked = opts.filter((o) => !o.ok);
    let status = '';
    if (id === 'skarn' && n.peace) status = ' You are at peace with them.';
    else if (id === 'skarn' && n.truceUntil > state.turn) status = ` A truce holds for ${plural(n.truceUntil - state.turn, 'more season', 'more seasons')}.`;
    html += `<h2 id="neighbor-${id}">${esc(def.title)}</h2>
      <p>Relations: ${relationWord(n.relation)} (${n.relation}).${status}</p>
      ${attitudeLines(state, id).map((l) => `<p>${esc(l)}</p>`).join('')}
      <p>${esc(capitalize(def.temperament))}. ${esc(def.description)}</p>
      <p>Home: ${esc(placeName(state, def.home))}${isKnown(state, def.home) ? '' : ', a place your scouts have not found'}. They want ${esc(def.wants)}, and offer ${esc(def.offers)}.</p>
      ${n.nation ? nationSection(id) : ''}
      <h3>Envoys this season</h3>`;
    if (n.lastEnvoy === state.turn) html += '<p>Your envoys have already visited them this season.</p>';
    else if (!ready.length) html += '<p>Nothing you can offer them right now.</p>';
    if (ready.length) {
      html += `<div class="actions">${ready.map((o) => `<button type="button" data-action="diplomacy" data-neighbor="${id}" data-act="${o.key}">${esc(o.label)}</button>`).join('')}</div>`;
    }
    const notNow = blocked.filter((o) => n.lastEnvoy !== state.turn);
    if (notNow.length) {
      html += `<p>Not possible now:</p><ul>${notNow.map((o) => `<li>${esc(o.label)}. ${esc(o.why)}</li>`).join('')}</ul>`;
    }
  }
  const valley = state.neighbors.skarn.nation ? valleyLines(state, relationWord) : [];
  if (valley.length) {
    html += `<h2>Between the peoples</h2>
      <p>How the nations feel about each other. Skarn raids embitter their victims; quarrels can bring the Velari and Tellani to blows.</p>
      <ul>${valley.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  return html;
}

// "15 wood and 8 work", or "30 wood, 30 stone and 20 goods, and 20 work".
function costAndWork(id) {
  const words = costWords(id);
  return `${words}${words.includes(' and ') ? ',' : ''} and ${BUILDINGS[id].work} work`;
}

function buildScreen() {
  const people = living(state);
  const builders = people.filter((p) => p.task === 'build');
  const workRate = Math.round(builders.reduce((sum, p) => sum + expectedWork(p, state), 0));
  const remaining = Math.ceil(remainingQueueWork(state));
  const q = state.buildQueue;
  let html = `<h1>Build</h1>
    <p>Wood: ${state.resources.wood}.${taskAvailable(state, 'quarry') || state.resources.stone ? ` Stone: ${state.resources.stone || 0}.` : ''}${taskAvailable(state, 'craft') || state.resources.goods ? ` Goods: ${state.resources.goods || 0}.` : ''} Shelter for ${shelterCapacity(state)}, and ${plural(people.length, 'person', 'people')} in ${inVillage(state) ? 'the village' : 'camp'}.</p>
    <p>${plural(builders.length, 'builder', 'builders')}, about ${workRate} work per season.${q.length ? ` The queue needs ${remaining} more work${workRate ? `: about ${plural(Math.max(1, Math.ceil(remaining / workRate)), 'season', 'seasons')}` : ''}.` : ''} Work left over from one building goes straight into the next.</p>
    <h2 id="queueHeading">Build queue (${q.length})</h2>`;
  if (!q.length) {
    html += '<p>Empty. Add buildings below. Wood is paid when work on each one begins.</p>';
  } else {
    html += '<ol class="plain">';
    q.forEach((item, i) => {
      const b = BUILDINGS[item.id];
      const name = b.name.toLowerCase();
      const status = item.paid
        ? `${Math.floor(item.progress)} of ${b.work} work done.`
        : `Not started. Needs ${costAndWork(item.id)}.${i === 0 && shortfall(state, item.id).length ? ` Still short of ${shortfall(state, item.id).map((x) => `${x.short} ${x.kind}`).join(' and ')}.` : ''}`;
      html += `<li class="card"><p id="queue-item-${i}" tabindex="-1"><strong>${i + 1}. ${esc(b.name)}.</strong> ${esc(status)}</p>
        <div class="actions">
          ${i > 0 ? `<button type="button" data-action="moveBuilding" data-index="${i}" data-by="-1">Move ${esc(name)} up</button>` : ''}
          ${i < q.length - 1 ? `<button type="button" data-action="moveBuilding" data-index="${i}" data-by="1">Move ${esc(name)} down</button>` : ''}
          <button type="button" data-action="removeBuilding" data-index="${i}">Remove ${esc(name)}${item.paid && refundWords(refundFor(item)) ? `, recovering ${refundWords(refundFor(item))}` : ''}</button>
        </div></li>`;
    });
    html += '</ol>';
  }
  html += '<h2>Buildings</h2><ul class="plain">';
  for (const id of BUILDING_ORDER) {
    const b = BUILDINGS[id];
    if (b.requires && !hasKnowledge(state, b.requires)) continue;
    if (b.era && !eraAtLeast(state, b.era)) continue;
    const owned = state.buildings[id];
    const status = b.repeatable ? `You have ${owned}.` : owned ? 'Built.' : 'Not built.';
    const why = queueBlocker(state, id);
    html += `<li class="card"><h3>${esc(b.name)}</h3>
      <p>${esc(b.description)}</p>
      <p>${status} Costs ${costAndWork(id)}.</p>
      ${why ? (!b.max && (owned || queuedCount(state, id)) ? '' : `<p>${esc(why)}</p>`) : `<p><button type="button" data-action="queueBuilding" data-building="${id}">Add ${esc(b.name.toLowerCase())} to the queue</button></p>`}
      ${!b.repeatable && queuedCount(state, id) ? '<p>In the build queue.</p>' : ''}
    </li>`;
  }
  html += '</ul>';
  return html;
}

function checkbox(id, checked, label) {
  return `<label class="choice"><input type="checkbox" data-order="${id}"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
}

function ordersFor(role) {
  const o = state.orders;
  if (role === 'steward' && inVillage(state)) {
    const options = [0, 1, 2, 3, 4].map((n) => `<option value="${n}"${o.foodReserve === n ? ' selected' : ''}>${n === 0 ? 'No food order' : plural(n, 'season', 'seasons')}</option>`).join('');
    return `<p>In the village the council sets everyone's work each season, so it covers best work, the fields, winter work, and newcomers.</p>
      <p><label for="order-food">Make sure our food will last at least</label>
      <select id="order-food" data-order="foodReserve">${options}</select></p>
      ${checkbox('harvestFeast', o.harvestFeast, 'Hold a feast once the harvest is in, at the start of winter, if at least 3 seasons of food would be left')}
      ${checkbox('comforts', o.comforts, `Share out goods as comforts each season: 1 goods for every 6 people (${comfortsCost(state)} now). Spirits settle 4 higher. A village of 30 or more that can craft misses them.`)}`;
  }
  if (role === 'healer' && inVillage(state)) {
    return checkbox('autoShelter', o.autoShelter, 'Put a hut at the front of the build queue whenever the shelters are nearly full, behind any building already underway');
  }
  if (role === 'steward') {
    const options = [0, 1, 2, 3, 4].map((n) => `<option value="${n}"${o.foodReserve === n ? ' selected' : ''}>${n === 0 ? 'No food order' : plural(n, 'season', 'seasons')}</option>`).join('');
    return `<p><label for="order-food">Make sure our food will last at least</label>
      <select id="order-food" data-order="foodReserve">${options}</select></p>
      ${checkbox('autoAssign', o.autoAssign, 'At the start of each season, put everyone on their best work, as the button on the People screen does. This also rests the hurt and sick, staffs the fields, and handles winter work and newcomers.')}
      ${checkbox('staffFields', o.staffFields, 'Keep the fields staffed: send people to plant in spring, tend in summer, and harvest in autumn, then send them back to their other work')}
      ${checkbox('harvestFeast', o.harvestFeast, 'Hold a feast once the harvest is in, at the start of winter, if at least 3 seasons of food would be left')}
      ${checkbox('winterForagers', o.winterForagers, 'Foragers hunt during winter, then go back to foraging in spring')}
      ${checkbox('placeNewcomers', o.placeNewcomers, 'Put newcomers to work at what they do best')}`;
  }
  if (role === 'healer') {
    return `${o.autoAssign ? '<p>While the steward is putting everyone on their best work each season, that covers resting the hurt and tending the sick.</p>' : ''}${checkbox('restWhenHurt', o.restWhenHurt, 'Badly hurt people rest until healed, then go back to their work')}
      ${checkbox('autoShelter', o.autoShelter, 'Put a lean-to at the front of the build queue whenever the shelters are nearly full, behind any building already underway')}
      ${checkbox('keepHealer', o.keepHealer, 'Keep someone tending the hurt whenever anyone is hurt')}`;
  }
  if (role !== 'warChief') return '';
  const arms = inVillage(state) ? checkbox('armGuards', o.armGuards, 'Spend 1 goods per guard each season on arms and shields. Armed guards fight a fifth harder.') : '';
  const radio = (value, label) => `<label class="choice"><input type="radio" name="raidPolicy" data-order="raidPolicy" value="${value}"${o.raidPolicy === value ? ' checked' : ''}> ${esc(label)}</label>`;
  return `<fieldset><legend>When raiders come</legend>
    ${radio('ask', 'Ask me every time')}
    ${radio('fightIfLikely', 'Fight if we are likely to win; otherwise ask me')}
    ${radio('auto', 'Decide for me: fight when the odds are even or better, hide when they are not')}
  </fieldset>${arms}`;
}

function advisorsScreen() {
  const advice = getAdvice(state);
  let html = `<h1>Advisors</h1>
    <p>Your advisors always follow your orders, and they tell you when they think something is going wrong.</p>
    <p>Standing orders are carried out at the start of every season. You can still change anything yourself afterward.</p>`;
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    const person = advisorPerson(state, role);
    if (!person) continue;
    html += `<h2>${esc(info.title)}: ${esc(person.name)}</h2><p class="muted">Watches over ${esc(info.domain)}.</p>`;
    html += adviceList(advice.filter((a) => a.role === role));
    const orders = ordersFor(role);
    if (orders) html += `<h3>${esc(person.name)}'s standing orders</h3>${orders}`;
  }
  return html;
}

function chronicleScreen() {
  let html = '<h1>Chronicle</h1><p>Your people\'s story: the traditions they have grown into, how others see them, and what has happened.</p>';
  html += `<p>Your people live in ${esc(ERA_NAMES[state.era || 'camp'])}.</p>`;
  const earned = state.traditions || [];
  const heroes = state.heroes || [];
  if (heroes.length) {
    html += `<h2>Heroes</h2><ul>${heroes.map((h) => {
      const p = personById(state, h.id);
      return `<li>${esc(h.name)}, who ${esc(h.deed)}, in Year ${h.year}.${p && p.alive ? '' : ' Remembered.'}</li>`;
    }).join('')}</ul>`;
  }
  html += '<h2>Traditions</h2>';
  if (earned.length) {
    html += `<ul>${earned.map((id) => `<li><strong>${esc(TRADITIONS[id].name)}.</strong> ${esc(TRADITIONS[id].story)} ${esc(TRADITIONS[id].effect)}</li>`).join('')}</ul>`;
  } else {
    html += '<p>None yet. Traditions grow from what your people do again and again.</p>';
  }
  const forming = traditionProgress(state);
  if (forming.length) {
    html += `<h2>Taking shape</h2><ul>${forming.map((t) => `<li>${esc(t.name)}: ${t.have} of ${t.need} ${esc(t.deed)}.</li>`).join('')}</ul>`;
  }
  html += `<h2>Reputation</h2><p>${esc(reputationSummary(state))}</p>`;
  html += '<h2>Seasons past</h2>';
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
    html += `<h3>${esc(g.date)}</h3><ul>${[...g.lines].reverse().map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  return html;
}

function foundVillageScreen() {
  const why = villageBlocker(state);
  if (why) return `<h1>Become a village</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="report">Back to the report</button></div>`;
  return `<h1>Become a village?</h1>
    <p>${esc(state.campName)} has ${plural(living(state).length, 'person', 'people')}, fields of its own, and a palisade. The elders say it is time to live as a village. This begins the Settlement era.</p>
    <h2>What changes</h2>
    <ul>
      <li>Your advisors become the village council. Each season the council sets everyone's work, so you no longer assign people one by one.</li>
      <li>You guide the council with priorities: how hard to push building, learning, defense, and exploration. You still run the build and study queues, trade, feasts, and the food reserve.</li>
      <li>The People screen becomes the Village screen, showing your people as groups by their work. Your council and anyone who masters a skill stay named.</li>
      <li>New: guards, who train and stand watch; huts, which shelter 8; and settlers, who come to a village that is well fed and has room.</li>
    </ul>
    <p class="warning">This cannot be undone. You can also wait and keep playing as a camp for as long as you like.</p>
    <div class="actions">
      <button type="button" class="primary" data-action="foundVillage">Become a village</button>
      <button type="button" data-nav="report">Not yet</button>
    </div>`;
}

function foundSettlementScreen() {
  const why = settlementBlocker(state);
  if (why) return `<h1>A new settlement</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="report">Back to the report</button></div>`;
  const sites = settlementSites(state);
  const [lo, hi] = settlerRange(state);
  const governors = governorChoices(state);
  const productWord = { food: 'food', wood: 'wood', stone: 'stone' };
  const settlerOptions = [];
  for (let n = lo; n <= hi; n++) settlerOptions.push(`<option value="${n}"${n === lo ? ' selected' : ''}>${n} settlers</option>`);
  return `<h1>Found a new settlement</h1>
    <p>Some of your people will leave ${esc(state.campName)} to found a second settlement on land you hold. It will run itself under a governor, and send home food, wood, or stone each season. Founding it costs ${esc(costText())}, and begins the Nation era.</p>
    <p class="warning">This cannot be undone: the settlers leave the village for good.</p>
    <form id="settlementForm">
      <fieldset><legend>Where will it stand?</legend>
        ${sites.map((id, i) => `<label class="choice"><input type="radio" name="settlementPlace" value="${id}"${i === 0 ? ' checked' : ''}> ${esc(placeName(state, id))}: it would send home ${productWord[settlementProduct(id)]}. ${esc(PLACES[id].description)}</label>`).join('')}
      </fieldset>
      <p><label for="settlementName">Name the settlement</label>
        <input type="text" id="settlementName" maxlength="30" autocomplete="off" value="${esc(`New ${placeName(state, sites[0])}`)}"></p>
      <p><label for="settlementCount">How many people go</label>
        <select id="settlementCount">${settlerOptions.join('')}</select></p>
      <p class="muted">At least 30 must stay in ${esc(state.campName)}. The council chooses a fair mix of able adults, and stays at home itself unless one of them governs.</p>
      <p><label for="settlementGovernor">Governor</label>
        <select id="settlementGovernor">${governors.map((p) => `<option value="${p.id}">${esc(villagerRow(p))}</option>`).join('')}</select></p>
      <fieldset><legend>What should it do at first?</legend>
        ${Object.entries(POLICIES).map(([key, pol], i) => `<label class="choice"><input type="radio" name="settlementPolicy" value="${key}"${i === 0 ? ' checked' : ''}> ${esc(pol.name)}: ${esc(pol.about)}</label>`).join('')}
      </fieldset>
      <div class="actions">
        <button type="submit" class="primary">Found the settlement</button>
        <button type="button" data-nav="report">Not yet</button>
      </div>
    </form>`;
}

function settlementLines() {
  const list = state.settlements || [];
  if (!list.length) return '';
  return `<h2 id="settlementsHeading">Other settlements (${list.length})</h2>${list.map((t) => {
    const ship = expectedShipment(state, t);
    const options = Object.entries(POLICIES).map(([key, pol]) => `<option value="${key}"${t.policy === key ? ' selected' : ''}>${esc(pol.name)}</option>`).join('');
    return `<h3>${esc(t.name)}</h3>
      <p>At ${esc(placeName(state, t.place))}: ${plural(t.population, 'person', 'people')}, governed by ${esc(t.governor.name)}. It sends home about ${ship.amount} ${ship.kind} a season.</p>
      <p><label for="policy-${t.id}">Policy for ${esc(t.name)}</label>
        <select id="policy-${t.id}" data-settlement-policy="${t.id}" aria-describedby="policy-${t.id}-about">${options}</select>
        <span id="policy-${t.id}-about" class="muted"> ${esc(POLICIES[t.policy].about)}</span></p>`;
  }).join('')}`;
}

function priorityControl(area) {
  const info = PRIORITY_AREAS[area];
  const current = state.priorities[area] || 'normal';
  const options = PRIORITY_LEVELS.map((lvl) => `<option value="${lvl}"${lvl === current ? ' selected' : ''}>${capitalize(lvl)}</option>`).join('');
  return `<p><label for="priority-${area}">${esc(info.name)}</label>
    <select id="priority-${area}" data-priority="${area}" aria-describedby="priority-${area}-about">${options}</select>
    <span id="priority-${area}-about" class="muted"> ${esc(info.about)}</span></p>`;
}

function lawEffectText(law) {
  const option = state.laws[law];
  return option ? LAWS[law].options[option].effect : 'Keeping to custom: no special effect.';
}

function lawControl(law) {
  const def = LAWS[law];
  const current = state.laws[law] || '';
  const wait = seasonsUntilChange(state, law);
  const options = [['', 'Keep to custom'], ...Object.entries(def.options).map(([key, o]) => [key, o.name])]
    .map(([key, name]) => `<option value="${key}"${key === current ? ' selected' : ''}>${esc(name)}</option>`).join('');
  return `<p><label for="law-${law}">${esc(def.name)}</label>
    <select id="law-${law}" data-law="${law}" aria-describedby="law-${law}-about">${options}</select>
    <span id="law-${law}-about" class="muted"> ${esc(lawEffectText(law))}${wait ? ` It can change again in ${plural(wait, 'season', 'seasons')}.` : ''}</span></p>`;
}

const MASTER_NAMES = {
  hunting: 'A master hunter', foraging: 'A master forager', building: 'A master builder',
  healing: 'A master healer', scouting: 'A master scout', learning: 'A master scholar',
};

function hireSection() {
  const goods = state.resources.goods || 0;
  if (!taskAvailable(state, 'craft') && !goods) return '';
  const masterWhy = hireBlocker(state);
  const swordWhy = swordsBlocker(state);
  return `<h2 id="hireHeading">Hire</h2>
    <p>You have ${goods} goods. Goods buy help from beyond the hills.</p>
    <p><label for="hireSkill">Hire a master, for ${HIRE_MASTER_COST} goods, once a year</label>
      <select id="hireSkill">${SKILLS.map((k) => `<option value="${k}">${esc(MASTER_NAMES[k])}</option>`).join('')}</select></p>
    ${masterWhy ? `<p>${esc(masterWhy)}</p>` : '<p><button type="button" data-action="hireMaster">Hire this master</button></p>'}
    <p>${SWORDS_COUNT} sell-swords will guard the roads for a year for ${SWORDS_COST} goods, meeting raiders before they reach the village and harrying besiegers.</p>
    ${swordsActive(state) ? `<p>${esc(swordWhy)}</p>` : swordWhy ? `<p>${esc(swordWhy)}</p>` : '<p><button type="button" data-action="hireSwords">Hire the sell-swords</button></p>'}`;
}

function lawsSection() {
  if (!lawsAvailable(state)) {
    return '<h2>Laws</h2><p>Once your people learn Oral law, the village can make laws here.</p>';
  }
  const choices = LAW_ORDER.map((law) => {
    const opts = Object.values(LAWS[law].options);
    return `<li><strong>${esc(LAWS[law].name)}.</strong> ${opts.map((o) => `${esc(o.name)}: ${esc(o.effect)}`).join(' ')}</li>`;
  }).join('');
  return `<h2 id="lawsHeading">Laws</h2>
    <p>Each law can change once a year.${state.buildings.meetingHall > 0 ? ' Your meeting hall lets the village talk changes through, so no one grumbles.' : ' Without a meeting hall, every change makes people grumble, and spirits dip.'}</p>
    ${LAW_ORDER.map(lawControl).join('')}
    <details><summary>What each law does</summary><ul>${choices}</ul></details>`;
}

function groupLine(g) {
  const skill = g.skill && g.avgSkill !== null ? `, average ${g.skill} ${g.avgSkill.toFixed(1)}` : '';
  const hurt = g.hurt ? `, ${g.hurt} badly hurt or sick` : '';
  return `${g.name}: ${g.count}${skill}${hurt}.`;
}

function villagerRow(p) {
  const role = advisorTitleFor(p);
  const group = GROUP_NAMES[p.task] ? GROUP_NAMES[p.task].toLowerCase().replace(/s$/, '') : p.task;
  const work = lifeStage(p) === 'infant' ? 'too young to work' : p.task === 'rest' ? 'resting' : group;
  const best = SKILLS.filter((k) => p.skills[k] === Math.max(...SKILLS.map((x) => p.skills[x])) && p.skills[k] > 0);
  return `${p.name}${role ? `, ${role}` : ''}: ${work}, ${personStatus(p)}${best.length ? `, best at ${best.join(' and ')} (${p.skills[best[0]]})` : ''}.`;
}

function villageScreen() {
  const people = living(state);
  const young = people.filter((p) => p.age < 16);
  const g = groups(state);
  const notable = notablePeople(state);
  let html = `<h1>Village</h1>
    <p>${plural(people.length, 'person', 'people')} live in ${esc(state.campName)}${young.length ? `, ${young.length} of them young` : ''}. Food needed this season: ${foodNeeded(people)}. Shelter for ${shelterCapacity(state)}.</p>
    <p>${esc(workSitesSentence())} Change work sites on the Map screen.</p>
    ${hasKnowledge(state, 'farming') ? `<p>${esc(farmSentence())}</p>` : ''}
    <h2 id="prioritiesHeading">Council priorities</h2>
    <p>The council covers the essentials first: tending the hurt, the fields, and firewood for the fires. Then it follows these priorities, and puts everyone else on food and wood by their skill. The food reserve order on the Advisors screen keeps the stores safe.</p>
    ${Object.keys(PRIORITY_AREAS).map(priorityControl).join('')}
    <p><button type="button" data-action="assignBest">Have the council reassign everyone now</button></p>
    <p class="muted">Otherwise the council reassigns everyone at the start of each season.</p>
    ${lawsSection()}
    ${hireSection()}
    ${settlementLines()}
    <h2>Groups (${g.length})</h2>
    <ul>${g.map((x) => `<li>${esc(groupLine(x))}</li>`).join('')}</ul>
    <h2>Notable people (${notable.length})</h2>
    <p class="muted">The council, and anyone who has mastered a skill.</p>
    <ul>${notable.map((p) => `<li>${esc(villagerRow(p))}</li>`).join('')}</ul>
    <details>
      <summary>Everyone in the village (${people.length})</summary>
      <ul>${[...people].sort((a, b) => TASK_ORDER.indexOf(a.task) - TASK_ORDER.indexOf(b.task) || a.name.localeCompare(b.name)).map((p) => `<li>${esc(villagerRow(p))}</li>`).join('')}</ul>
    </details>`;
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
    <p>Each turn is one season. Assign every person a task on the People screen, add buildings to the queue on the Build screen, then choose End season. Builders work through the queue in order, and work left over from one building goes into the next.</p>
    <p>Everyone eats 2 food each season. Nothing grows in winter and hunting is poor, so store food during summer and autumn. Food also spoils in storage, and the stores only hold so much: food beyond the room rots quickly. Each storehouse adds room. Some years bring hard winters, droughts, or herds that wander off, so keep a reserve. Full stores also tempt raiders.</p>
    <p>When there is food to spare, hold a feast from the Report screen, once a year. Feasts lift spirits, and people in high spirits work better. You can invite a neighboring people to win their goodwill.</p>
    <p>Autumn and winter fires burn wood, and anyone without shelter suffers from the cold. The fires always get their wood first; builders only use what is left. Each lean-to shelters 4 more people.</p>
    <p>People get better at whatever they practice. Each season at a task builds that skill, up to 5. Early levels come quickly; mastery takes years. Fighting off raiders hardens defenders fast.</p>
    <p>A well-fed camp with room in its shelters and good spirits will have children. Young children eat half as much and take half a place in the shelters. From 5 they can help with light work, and from 12 they can do anything, including defending the camp. Everyone ages a year each spring, and the old grow weaker and eventually pass away. Young people learn faster, and anyone working beside a skilled mentor learns faster too.</p>
    <p>Hurt people work at half strength. Have them rest, and have a healer tend them.</p>
    <p>The Map screen shows the places you know. Choose where hunters, foragers, and woodcutters work, and where scouts explore from. Scouts can find better places and new people. Hunting and foraging grounds wear down with use, so move your workers when a place gets thin.</p>
    <p>Events happen as the seasons pass: storms, fevers, good fortune, and choices only you can make, like whether to take in a sick stranger. When a decision is waiting, it appears before anything else, and your advisors give their view. Fever spreads through a crowded camp; tending the sick helps them recover.</p>
    <p>Set people to Study and choose a discovery on the Knowledge screen. Discoveries improve hunting, building, storage, and health. Farming is the great one: build fields, plant in spring, tend in summer, and harvest in autumn.</p>
    <p>Other peoples live around the valley. Scouts may find their homes, and some will find you. On the Neighbors screen you can send gifts, trade, and make deals, once per people each season. The raiders who trouble your camp are a people too, and they can be bargained with.</p>
    <p>Your people grow traditions from what they do again and again: win battles, hunt, bring in harvests, welcome strangers, give gifts, trade, study, build, hold feasts, or slip away from raiders. Each tradition gives a lasting benefit. The Chronicle screen shows the traditions you have and the ones taking shape. What you do also earns a reputation, and each neighboring people likes some parts of it and dislikes others, which slowly shifts how they feel about you.</p>
    <p>Raiders may attack. Scouts and a watchtower help you see them coming, and a palisade helps you hold them off. You can let your war chief fight, hide, or command the battle yourself. The field has a left flank, a center, and a right flank, plus a reserve. Place your fighters, then each round give every group an order: hold (safer, especially behind a palisade or in the treeline), attack (hits harder, takes more harm), swing round to hit the enemy center, or fall back to the reserve. The reserve can join any zone. Any zone you leave empty lets raiders reach the stores. Groups that lose too much strength break and flee; the enemy gives up when enough of them have fallen. You can also march on Skarn hold from the Neighbors screen: break through two zones they leave empty, or beat them down, to win.</p>
    <p>Once your camp has 16 people, a storehouse, a palisade, and farming, it can become a village, whenever you choose. In a village your advisors form a council that sets everyone's work each season. You guide it with priorities on the Village screen, and keep running the build and study queues, trade, feasts, and the food reserve. Villages can train guards, build huts, and draw settlers when well fed and roomy.</p>
    <p>A village can make the discoveries of the Settlement era, in five branches on the Knowledge screen. Stonecutting lets quarriers cut stone for granaries, a stone wall, and other strong buildings; the Grey cliffs beyond the storm deadfall are the best place for it. Weaving lets crafters make goods, which the Tellani will trade for, and which make fine gifts. Some discoveries are choices: a council of elders or a chieftain, but not both.</p>
    <p>Once you are a village, the Velari, Tellani, and Skarn grow into nations. Each spring they grow, and they claim land outward from their homes. You can claim places too, on the Map screen. Working another people's land angers them unless you share it with an open lands pact. On the Neighbors screen you can propose treaties: a trade pact, open lands, or an alliance, whose warriors help you against raiders, and who will ask you for help in turn. Each nation remembers your promises, kept and broken, and trusts you accordingly. Skarn war bands come from the warriors they actually have, so every raider you defeat weakens them.</p>
    <p>A village has its own events: rivalries between groups, heroes whose deeds are remembered on the Chronicle, fires, sick herds, travelers, festivals, weddings and refugees from other peoples, herders on your land, and council members who disagree with your priorities. Most are choices.</p>
    <p>Goods are worth more than trade. Your steward can share them out as comforts each season, which a big village expects; your war chief can arm the guards with them. On the Village screen, goods hire a master of any skill once a year, or sell-swords who guard the roads for a year. A shrine costs goods too. The Tellani will take a caravan of goods for a bulk price, the Skarn accept tribute in goods, and besiegers can be paid off in goods.</p>
    <p>Once your village knows Oral law, it can make four laws on the Village screen: how food is shared, whether strangers may settle, how people serve, and how wrongs are judged. Each choice has a cost as well as a benefit, some please or offend your neighbors, and each law can change once a year.</p>
    <p>Once the Skarn are a nation, a quarter of their warriors are archers, whose arrows come over walls; archers are weak up close, so charge them. Your own people with hunting 3 or more shoot as archers once you know Bows. Warriors who charge an undermanned stretch of palisade or wall may break through it, and fighters there lose its cover. When the Skarn cannot storm your walls but can hem you in, they lay siege: no one can work outside, and you live on your stores. Wait for their supplies to run out, pay them, or sally out and fight them in the open.</p>
    <p>The nations act on their own, too. They have feelings about each other, shown on the Neighbors screen, and they come to you: offering treaties, demanding land they wanted, asking you to take sides in their quarrels or guard their caravans, and, in the Skarn's case, offering bargains at another people's expense.</p>
    <p>When your village has 40 people and holds land beyond its camp, it can found a second settlement there, which begins the Nation era. Choose where, its name, how many go, its governor, and whether it should grow or supply. It sends home food, wood, or stone each season, depending on its land.</p>
    <p>On the Advisors screen you can give standing orders, like resting the badly hurt or keeping enough food stored. Advisors carry them out at the start of each season and report what they did.</p>
    <p>Your advisors read the situation every season. Check the Report or Advisors screen for warnings.</p>`;
}

function storyScreen() {
  const view = describePending(state);
  let html = `<h1>${esc(view.title)}</h1><p>${esc(view.text)}</p>`;
  if (view.advice.length) {
    html += `<h2>Advice</h2><ul>${view.advice.map((a) => `<li>${esc(a.name)}, ${esc(a.title.toLowerCase())}: ${esc(a.text)}</li>`).join('')}</ul>`;
  }
  html += `<form id="storyForm"><fieldset><legend>What will you do?</legend>
    ${view.options.map((o) => `<label class="choice"><input type="radio" name="choice" value="${esc(o.id)}"> ${esc(o.label)}</label>`).join('')}
    </fieldset>
    <div class="actions"><button type="submit" class="primary">Confirm</button></div>
  </form>`;
  return html;
}

const POSITION_NAMES = {
  left: 'Left flank', center: 'Center', right: 'Right flank', reserve: 'Reserve', out: 'Stay behind',
};

function raidScreen() {
  const view = battleView(state);
  return view.phase === 'deploy' ? deployScreen(view) : battleRoundScreen(view);
}

function deployScreen(view) {
  const ev = state.pendingEvent;
  const attack = view.side === 'attack';
  const chief = advisorPerson(state, 'warChief');
  const chiefName = chief ? chief.name : 'your war chief';
  const odds = raidOdds(state, living(state).filter(canFight), ev.warned, ev.raiders);
  const total = view.enemyTotal;
  const sally = Boolean(ev.sally);
  let html = attack
    ? `<h1>March on Skarn hold</h1>
      <p>About ${total} Skarn warriors hold the walls. Choose who goes and where they stand.</p>`
    : sally ? `<h1>Sally out</h1>
      <p>About ${total} Skarn besiege ${esc(state.campName)}. Choose who goes out through the gate to fight them in the open, and where they stand.</p>`
    : `<h1>Raiders!</h1>
      <p class="urgent">${ev.warned
        ? `Scouts spotted ${total} ${esc(view.foe)} heading for ${esc(state.campName)}. There is time to prepare.`
        : `About ${total} ${esc(view.foe)} are at the edge of ${esc(state.campName)}, and they caught you by surprise.`}</p>`;
  html += `<h2>The enemy</h2><ul>${view.enemyLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  if (view.terrain.length) html += `<h2>The ground</h2><ul>${view.terrain.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  html += `<h2>War chief's advice</h2>
    <p>${chief ? `${esc(chief.name)} says: ` : ''}if everyone able fights, we are ${odds.word}. Best formation: ${esc(FORMATIONS[view.suggestedFormation].toLowerCase())}.</p>
    <h2>Quick choices</h2>
    <div class="actions">
      <button type="button" class="primary" data-action="battleAuto">Let ${esc(chiefName)} command the battle</button>
      <button type="button" data-action="${attack || sally ? 'callOff' : 'hide'}">${attack ? 'Call off the attack' : sally ? 'Stay behind the walls after all' : 'Hide what you can and flee into the trees. Nobody gets hurt, but the raiders take some food and wood.'}</button>
    </div>
    <h2>Command it yourself</h2>
    <form id="deployForm">
      <p><label for="formation">Formation</label>
        <select id="formation">${Object.entries(FORMATIONS).map(([id, label]) => `<option value="${id}"${id === view.suggestedFormation ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></p>
      <p><button type="button" data-action="applyFormation">Arrange fighters in this formation</button></p>
      <fieldset><legend>Positions</legend>`;
  for (const f of view.fighters) {
    const where = view.plan[f.id] || 'out';
    html += `<p><label for="pos-${f.id}">${esc(f.name)}${f.archer ? ', archer' : ''}, hunting ${f.hunting}, ${healthWord(f.health)}${f.sick ? ', sick' : ''}</label>
      <select id="pos-${f.id}" data-position="${f.id}">${Object.entries(POSITION_NAMES).map(([z, label]) => `<option value="${z}"${z === where ? ' selected' : ''}>${label}</option>`).join('')}</select></p>`;
  }
  html += `</fieldset>
      <p id="deploySummary" aria-live="polite">${esc(positionSummary(view.plan))}</p>
      <div class="actions"><button type="submit" class="primary">Take positions</button></div>
    </form>`;
  return html;
}

function positionSummary(plan) {
  const counts = { left: 0, center: 0, right: 0, reserve: 0 };
  for (const z of Object.values(plan)) if (z in counts) counts[z] += 1;
  return `Left flank ${counts.left}, center ${counts.center}, right flank ${counts.right}, reserve ${counts.reserve}.`;
}

function readPositions() {
  const plan = {};
  for (const sel of $main.querySelectorAll('select[data-position]')) plan[sel.dataset.position] = sel.value;
  return plan;
}

function battleRoundScreen(view) {
  const chief = advisorPerson(state, 'warChief');
  const chiefName = chief ? chief.name : 'your war chief';
  let html = `<h1>Battle, round ${view.round} of ${view.maxRounds}</h1>
    <p>${view.enemyTotal} ${esc(view.foe)} still on the field.${view.loot.food || view.loot.wood ? ` They have carried off ${view.loot.food} food and ${view.loot.wood} wood so far.` : ''}</p>`;
  if (view.lastRound.length) html += `<h2>Last round</h2><ul>${view.lastRound.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  html += '<h2>The field</h2>';
  for (const z of view.zones) {
    html += `<h3>${esc(capitalize(z.name))}</h3>
      <p>${z.people.length ? `Yours: ${esc(listWords(z.people))}, ${esc(z.odds)}.` : 'None of yours.'} Enemy: ${z.enemy || 'none'}${z.enemyArchers ? `, ${z.enemyArchers === 1 ? '1 of them an archer' : `${z.enemyArchers} of them archers`}` : ''}.${z.breached ? ' The defenses are broken here.' : ''}</p>`;
  }
  html += `<h3>Reserve</h3><p>${view.reserve.length ? esc(listWords(view.reserve)) : 'Empty.'}</p>`;
  if (view.terrain.length) html += `<details><summary>The ground</summary><ul>${view.terrain.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
  html += `<h2>War chief's advice</h2><p>${esc(chiefName)} suggests: ${esc(view.adviceText || 'hold steady')}.</p>
    <form id="ordersForm"><fieldset><legend>Orders for this round</legend>`;
  for (const z of view.zones.filter((x) => x.orders.length)) {
    html += `<p><label for="order-${z.zone}">${esc(capitalize(z.name))}, ${plural(z.people.length, 'fighter', 'fighters')}</label>
      <select id="order-${z.zone}" data-zone="${z.zone}">${z.orders.map((o) => `<option value="${o}"${view.advice[z.zone] === o ? ' selected' : ''}>${esc(ORDER_NAMES[o])}</option>`).join('')}</select></p>`;
  }
  if (view.reserve.length) {
    const opts = [['stay', 'Stay in reserve'], ...view.zones.map((z) => [z.zone, `Join the ${z.name}`])];
    html += `<p><label for="order-reserve">Reserve, ${plural(view.reserve.length, 'fighter', 'fighters')}</label>
      <select id="order-reserve" data-zone="reserve">${opts.map(([v, l]) => `<option value="${v}"${view.advice.reserve === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></p>`;
  }
  html += `</fieldset>
      <div class="actions">
        <button type="submit" class="primary">Give orders</button>
        <button type="button" data-action="battleAuto">Let ${esc(chiefName)} finish the battle</button>
        <button type="button" data-action="battleRetreat">Retreat and abandon the fight</button>
      </div>
    </form>`;
  return html;
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
    case 'queueBuilding': {
      const msg = act({ type: 'queueBuilding', buildingId: btn.dataset.building });
      if (msg) {
        show('build', { focus: false });
        refocus(`[data-action="queueBuilding"][data-building="${btn.dataset.building}"]`, '#queueHeading');
        announce(msg);
      }
      break;
    }
    case 'moveBuilding': {
      const index = Number(btn.dataset.index);
      const by = Number(btn.dataset.by);
      const msg = act({ type: 'moveBuilding', index, by });
      if (msg) {
        show('build', { focus: false });
        refocus(`#queue-item-${index + by}`);
        announce(msg);
      }
      break;
    }
    case 'removeBuilding': {
      const msg = act({ type: 'removeBuilding', index: Number(btn.dataset.index) });
      if (msg) {
        show('build', { focus: false });
        refocus('#queueHeading');
        announce(msg);
      }
      break;
    }
    case 'sallyOut': {
      const msg = act({ type: 'sallyOut' });
      if (msg) {
        show('report');
        announce(msg);
      }
      break;
    }
    case 'payBesiegers': {
      const msg = act({ type: 'payBesiegers', goods: Boolean(btn.dataset.goods) });
      if (msg) {
        show('report');
        announce(msg);
      }
      break;
    }
    case 'hireMaster':
    case 'hireSwords': {
      const msg = act(action === 'hireMaster' ? { type: 'hireMaster', skill: document.getElementById('hireSkill').value } : { type: 'hireSwords' });
      if (msg) {
        show('people', { focus: false });
        refocus('#hireHeading');
        announce(msg);
      }
      break;
    }
    case 'claimPlace': {
      const msg = act({ type: 'claimPlace', placeId: btn.dataset.place });
      if (msg) {
        show('map', { focus: false });
        refocus(`#place-${btn.dataset.place}`, '#landsHeading');
        announce(msg);
      }
      break;
    }
    case 'foundVillage': {
      const msg = act({ type: 'foundVillage' });
      if (msg) {
        show('people');
        announce(msg);
      }
      break;
    }
    case 'holdFeast': {
      const msg = act({ type: 'holdFeast', guest: btn.dataset.guest || null });
      if (msg) {
        show('report', { focus: false });
        refocus('#feastStatus', '#storesHeading');
        announce(msg);
      }
      break;
    }
    case 'diplomacy': {
      const id = btn.dataset.neighbor;
      const msg = act({ type: 'diplomacy', neighborId: id, act: btn.dataset.act });
      if (msg) {
        show('neighbors', { focus: false });
        refocus(`#neighbor-${id}`);
        announce(msg);
      }
      break;
    }
    case 'queueStudy':
    case 'unqueueStudy': {
      const msg = act({ type: action, knowledgeId: btn.dataset.knowledge });
      if (msg) {
        show('knowledge', { focus: false });
        refocus('#studyQueueHeading');
        announce(msg);
      }
      break;
    }
    case 'setStudy': {
      const msg = act({ type: 'setStudy', knowledgeId: btn.dataset.knowledge });
      if (msg) {
        show('knowledge', { focus: false });
        announce(msg);
        const h = $main.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      break;
    }
    case 'assignBest': {
      const msg = act({ type: 'assignBest' });
      if (msg) {
        show('people', { focus: false });
        const again = $main.querySelector('[data-action="assignBest"]');
        if (again) again.focus();
        announce(msg);
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
    case 'battleAuto': {
      const msg = act({ type: 'battleAuto' });
      if (msg) show('report');
      break;
    }
    case 'hide':
    case 'callOff': {
      const msg = act({ type: 'resolveRaid', plan: 'hide' });
      if (msg) show('report');
      break;
    }
    case 'battleRetreat': {
      if (!window.confirm('Abandon the fight? The raiders will take what they want.')) break;
      const msg = act({ type: 'battleRetreat' });
      if (msg) show('report');
      break;
    }
    case 'applyFormation': {
      const plan = formationPlan(state, state.pendingEvent.battle, document.getElementById('formation').value);
      for (const sel of $main.querySelectorAll('select[data-position]')) sel.value = plan[sel.dataset.position] || 'out';
      document.getElementById('deploySummary').textContent = positionSummary(readPositions());
      announce(`Fighters arranged. ${positionSummary(readPositions())}`);
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
  if (e.target.id === 'peopleView') {
    storage.setSetting('peopleView', e.target.value);
    render();
    const again = document.getElementById('peopleView');
    if (again) again.focus();
    announce(e.target.value === 'compact' ? 'Compact list.' : 'Detailed list.');
    return;
  }
  const site = e.target.closest('select[data-site]');
  if (site) {
    const msg = act({ type: 'setWorkSite', task: site.dataset.site, placeId: site.value });
    if (msg) announce(msg);
    return;
  }
  const policySel = e.target.closest('select[data-settlement-policy]');
  if (policySel) {
    const msg = act({ type: 'setSettlementPolicy', settlementId: Number(policySel.dataset.settlementPolicy), policy: policySel.value });
    if (msg) {
      const about = document.getElementById(`policy-${policySel.dataset.settlementPolicy}-about`);
      if (about) about.textContent = ` ${POLICIES[policySel.value].about}`;
      announce(msg);
    }
    return;
  }
  const lawSel = e.target.closest('select[data-law]');
  if (lawSel) {
    const law = lawSel.dataset.law;
    const msg = act({ type: 'setLaw', law, option: lawSel.value || null });
    if (msg) {
      show('people', { focus: false });
      refocus(`#law-${law}`, '#lawsHeading');
      announce(msg);
    } else {
      lawSel.value = state.laws[law] || '';
    }
    return;
  }
  const priority = e.target.closest('select[data-priority]');
  if (priority) {
    const msg = act({ type: 'setPriority', area: priority.dataset.priority, level: priority.value });
    if (msg) announce(msg);
    return;
  }
  const order = e.target.closest('[data-order]');
  if (order) {
    const value = order.type === 'checkbox' ? order.checked : order.value;
    act({ type: 'setOrder', id: order.dataset.order, value });
    return;
  }
  if (e.target.matches('select[data-position]')) {
    document.getElementById('deploySummary').textContent = positionSummary(readPositions());
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
  if (e.target.id === 'storyForm') {
    const picked = e.target.querySelector('input[name="choice"]:checked');
    if (!picked) {
      announce('Choose one of the options first.');
      return;
    }
    const msg = act({ type: 'resolveEvent', choice: picked.value });
    if (msg) show('report');
    return;
  }
  if (e.target.id === 'settlementForm') {
    const place = e.target.querySelector('input[name="settlementPlace"]:checked');
    const policy = e.target.querySelector('input[name="settlementPolicy"]:checked');
    const msg = act({
      type: 'foundSettlement',
      placeId: place ? place.value : null,
      name: document.getElementById('settlementName').value,
      settlers: Number(document.getElementById('settlementCount').value),
      governorId: Number(document.getElementById('settlementGovernor').value),
      policy: policy ? policy.value : 'grow',
    });
    if (msg) {
      show('people');
      announce(msg);
    }
    return;
  }
  if (e.target.id === 'deployForm') {
    const msg = act({ type: 'battleDeploy', assignments: readPositions() });
    if (msg) show('report');
    return;
  }
  if (e.target.id === 'ordersForm') {
    const orders = {};
    for (const sel of e.target.querySelectorAll('select[data-zone]')) orders[sel.dataset.zone] = sel.value;
    const msg = act({ type: 'battleOrders', orders });
    if (msg) show('report');
  }
});

// ---------- start ----------

show('title');
