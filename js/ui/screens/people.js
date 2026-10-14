// The People screen of a camp: everyone by name, with their tasks.

import { ADVISOR_ROLES } from '../../engine/advisors.js';
import { TASKS, TASK_ORDER, SKILLS } from '../../engine/data.js';
import { siteFor, expectedHarvest } from '../../engine/rules.js';
import { seasonsToNextLevel } from '../../engine/skills.js';
import {
  living, healthWord, moraleWord, seasonIndex, foodNeeded, placeName, availableTasks, hasKnowledge, fieldPlots, allowedTasksFor, lifeStage, taskAvailable,
} from '../../engine/state.js';
import { storage } from '../../storage.js';
import { state, esc, capitalize, plural } from '../core.js';

export function taskCounts() {
  const people = living(state);
  return TASK_ORDER
    .map((t) => [t, people.filter((p) => p.task === t).length])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${TASKS[t].name} ${n}`)
    .join(', ');
}

export function advisorTitleFor(person) {
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

export function workSitesSentence() {
  return `Hunters work at ${placeName(state, siteFor(state, 'hunt'))}. `
    + `Foragers work at ${placeName(state, siteFor(state, 'forage'))}. `
    + `Woodcutters work at ${placeName(state, siteFor(state, 'wood'))}. `
    + (taskAvailable(state, 'quarry') ? `Quarriers work at ${placeName(state, siteFor(state, 'quarry'))}. ` : '')
    + `Scouts explore beyond ${placeName(state, siteFor(state, 'scout'))}.`;
}

export function farmSentence() {
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

export function personStatus(p) {
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

export function peopleScreen() {
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
