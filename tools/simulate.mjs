// Plays many games with simple automatic strategies to check balance.
// Run with: node tools/simulate.mjs [games] [years]

import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, shelterCapacity, seasonIndex, knownPlaces, unexploredNeighbors, hasKnowledge,
  knowledgeBlocker, fieldPlots, allowedTasksFor,
} from '../js/engine/state.js';
import { BUILDINGS, PLACES } from '../js/engine/data.js';
import { raidOdds } from '../js/engine/advisors.js';
import { describePending } from '../js/engine/events.js';

const GAMES = Number(process.argv[2] || 200);
const YEARS = Number(process.argv[3] || 5);

function act(state, action) {
  const r = applyAction(state, action);
  return r.state;
}

function sensiblePlan(state) {
  const people = living(state);
  const s = seasonIndex(state);
  const plan = new Map();
  const free = () => people.filter((p) => !plan.has(p.id));
  const take = (n, skill, task) => {
    free().filter((p) => allowedTasksFor(state, p).includes(task))
      .sort((a, b) => b.skills[skill] - a.skills[skill]).slice(0, n).forEach((p) => plan.set(p.id, task));
  };
  for (const p of people) if (p.health < 40) plan.set(p.id, 'rest');
  if (people.some((p) => p.health < 75)) take(1, 'healing', 'heal');
  const n = people.length;
  if (hasKnowledge(state, 'farming') && fieldPlots(state) && s !== 3) {
    const plots = fieldPlots(state);
    take(Math.ceil(s === 0 ? (plots - state.farm.planted) / 2 : state.farm.planted / 3), 'foraging', 'farm');
  }
  if (state.knowledge.current) take(2, 'learning', 'study');
  if (s === 3) take(Math.ceil(n * 0.55), 'hunting', 'hunt');
  else {
    take(Math.ceil(n * 0.25), 'hunting', 'hunt');
    take(Math.ceil(n * 0.25), 'foraging', 'forage');
  }
  take(1, 'scouting', 'scout');
  if (state.project) take(2, 'building', 'build');
  for (const p of free()) plan.set(p.id, allowedTasksFor(state, p).includes('wood') ? 'wood' : allowedTasksFor(state, p)[0]);
  return plan;
}

// Pick the known place with the best bonus and abundance for each task.
function chooseSites(state) {
  for (const task of ['hunt', 'forage', 'wood']) {
    const score = (id) => (PLACES[id].bonus[task] || 0) + (task === 'wood' ? 0 : state.places[id].abundance[task] / 25);
    const best = knownPlaces(state).filter((id) => PLACES[id].tasks.includes(task)).sort((a, b) => score(b) - score(a))[0];
    if (best && best !== state.workSites[task]) state = act(state, { type: 'setWorkSite', task, placeId: best });
  }
  const scoutFrom = knownPlaces(state).find((id) => unexploredNeighbors(state, id).length > 0);
  if (scoutFrom && scoutFrom !== state.workSites.scout) state = act(state, { type: 'setWorkSite', task: 'scout', placeId: scoutFrom });
  return state;
}

function chooseProject(state) {
  if (state.project) return null;
  const people = living(state).length;
  const wants = [];
  if (people + 1 > shelterCapacity(state)) wants.push('leanTo');
  if (hasKnowledge(state, 'farming') && state.buildings.fields < 3) wants.push('fields');
  wants.push('storehouse', 'palisade', 'watchtower', 'healersHut', 'leanTo');
  for (const id of wants) {
    const b = BUILDINGS[id];
    if (!b.repeatable && state.buildings[id] > 0) continue;
    if (state.resources.wood >= b.cost + 10) return id;
  }
  return null;
}

const STUDY_ORDER = ['stoneTools', 'smoking', 'farming', 'spears', 'clothing', 'pottery', 'medicine'];
function chooseStudy(state) {
  if (state.knowledge.current) return state;
  const next = STUDY_ORDER.find((id) => !knowledgeBlocker(state, id));
  return next ? act(state, { type: 'setStudy', knowledgeId: next }) : state;
}

function play(seed, strategy) {
  let state = newGame({ seed });
  if (strategy === 'orders') {
    for (const [id, value] of [['keepHealer', true], ['foodReserve', 2], ['winterForagers', true], ['raidPolicy', 'auto'], ['autoAssign', true]]) {
      state = act(state, { type: 'setOrder', id, value });
    }
  }
  for (let t = 0; t < YEARS * 4 && !state.gameOver; t++) {
    if (state.pendingEvent && state.pendingEvent.type === 'story') {
      // Simple players take the first option offered.
      state = act(state, { type: 'resolveEvent', choice: describePending(state).options[0].id });
      if (state.gameOver) break;
    }
    if (state.pendingEvent) {
      const fighters = living(state).filter((p) => p.health >= 40);
      const odds = raidOdds(state, fighters, state.pendingEvent.warned, state.pendingEvent.raiders);
      state = strategy === 'sensible' && odds.ratio >= 1
        ? act(state, { type: 'resolveRaid', plan: 'fight', defenderIds: fighters.map((p) => p.id) })
        : act(state, { type: 'resolveRaid', plan: 'hide' });
      if (state.gameOver) break;
    }
    if (strategy === 'orders') {
      state = chooseSites(state);
      state = chooseStudy(state);
      const project = chooseProject(state);
      if (project) state = act(state, { type: 'startProject', buildingId: project });
    }
    if (strategy === 'sensible') {
      state = chooseSites(state);
      state = chooseStudy(state);
      for (const [personId, task] of sensiblePlan(state)) state = act(state, { type: 'assign', personId, task });
      const project = chooseProject(state);
      if (project) state = act(state, { type: 'startProject', buildingId: project });
    }
    state = act(state, { type: 'endTurn' });
  }
  return state;
}

const STRATEGIES = (process.argv[4] || "sensible,orders,idle").split(",");
for (const strategy of STRATEGIES) {
  let wiped = 0;
  let pop = 0;
  let milestone = 0;
  let farmed = 0;
  let food = 0;
  let kids = 0;
  let palisades = 0;
  let born = 0;
  let firstWipeYear = [];
  for (let i = 0; i < GAMES; i++) {
    const end = play(1000 + i, strategy);
    if (end.gameOver) { wiped++; firstWipeYear.push(Math.ceil(end.turn / 4)); }
    pop += living(end).length;
    kids += living(end).filter((p) => p.age < 16).length;
    born += end.people.filter((p) => p.parent).length;
    food += end.resources.food;
    if (end.milestoneReached) milestone++;
    if (end.buildings.palisade) palisades++;
    if (hasKnowledge(end, 'farming')) farmed++;
  }
  const avgWipe = firstWipeYear.length ? (firstWipeYear.reduce((a, b) => a + b, 0) / firstWipeYear.length).toFixed(1) : '-';
  console.log(`${strategy}: ${GAMES} games, ${YEARS} years | wiped out ${wiped} (avg year ${avgWipe}) | avg survivors ${(pop / GAMES).toFixed(1)} | milestone ${milestone} (palisades ${palisades}) | farming ${farmed} | avg food ${(food / GAMES).toFixed(0)} | born ${(born / GAMES).toFixed(1)} | under 16 ${(kids / GAMES).toFixed(1)}`);
}
