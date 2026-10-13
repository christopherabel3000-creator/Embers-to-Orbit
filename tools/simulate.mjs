// Plays many games with simple automatic strategies to check balance.
// Run with: node tools/simulate.mjs [games] [years]

import { newGame, applyAction } from '../js/engine/game.js';
import { living, shelterCapacity, seasonIndex } from '../js/engine/state.js';
import { BUILDINGS } from '../js/engine/data.js';
import { raidOdds } from '../js/engine/advisors.js';

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
    free().sort((a, b) => b.skills[skill] - a.skills[skill]).slice(0, n).forEach((p) => plan.set(p.id, task));
  };
  for (const p of people) if (p.health < 40) plan.set(p.id, 'rest');
  if (people.some((p) => p.health < 75)) take(1, 'healing', 'heal');
  const n = people.length;
  if (s === 3) take(Math.ceil(n * 0.55), 'hunting', 'hunt');
  else {
    take(Math.ceil(n * 0.25), 'hunting', 'hunt');
    take(Math.ceil(n * 0.25), 'foraging', 'forage');
  }
  take(1, 'scouting', 'scout');
  if (state.project) take(2, 'building', 'build');
  for (const p of free()) plan.set(p.id, 'wood');
  return plan;
}

function chooseProject(state) {
  if (state.project) return null;
  const people = living(state).length;
  const wants = [];
  if (people + 1 > shelterCapacity(state)) wants.push('leanTo');
  wants.push('storehouse', 'palisade', 'watchtower', 'healersHut', 'leanTo');
  for (const id of wants) {
    const b = BUILDINGS[id];
    if (!b.repeatable && state.buildings[id] > 0) continue;
    if (state.resources.wood >= b.cost + 10) return id;
  }
  return null;
}

function play(seed, strategy) {
  let state = newGame({ seed });
  for (let t = 0; t < YEARS * 4 && !state.gameOver; t++) {
    if (state.pendingEvent) {
      const fighters = living(state).filter((p) => p.health >= 40);
      const odds = raidOdds(state, fighters, state.pendingEvent.warned, state.pendingEvent.raiders);
      state = strategy === 'sensible' && odds.ratio >= 1
        ? act(state, { type: 'resolveRaid', plan: 'fight', defenderIds: fighters.map((p) => p.id) })
        : act(state, { type: 'resolveRaid', plan: 'hide' });
      if (state.gameOver) break;
    }
    if (strategy === 'sensible') {
      for (const [personId, task] of sensiblePlan(state)) state = act(state, { type: 'assign', personId, task });
      const project = chooseProject(state);
      if (project) state = act(state, { type: 'startProject', buildingId: project });
    }
    state = act(state, { type: 'endTurn' });
  }
  return state;
}

for (const strategy of ['sensible', 'idle']) {
  let wiped = 0;
  let pop = 0;
  let milestone = 0;
  let firstWipeYear = [];
  for (let i = 0; i < GAMES; i++) {
    const end = play(1000 + i, strategy);
    if (end.gameOver) { wiped++; firstWipeYear.push(Math.ceil(end.turn / 4)); }
    pop += living(end).length;
    if (end.milestoneReached) milestone++;
  }
  const avgWipe = firstWipeYear.length ? (firstWipeYear.reduce((a, b) => a + b, 0) / firstWipeYear.length).toFixed(1) : '-';
  console.log(`${strategy}: ${GAMES} games, ${YEARS} years | wiped out ${wiped} (avg year ${avgWipe}) | avg survivors ${(pop / GAMES).toFixed(1)} | milestone ${milestone}`);
}
