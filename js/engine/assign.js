// Picking everyone's best work: the "Assign best work" button.
// Each person goes to the task matching their strongest skill, skipping
// work that makes no sense right now, and the hurt and sick rest.

import { TASKS, WANDERERS } from './data.js';
import { remainingQueueWork } from './building.js';
import {
  living, seasonIndex, allowedTasksFor, unexploredNeighbors, knownPlaces, fieldPlots,
} from './state.js';
import {
  siteFor, farmersNeeded, workFactor, PLANT_PER_FARMER, TEND_PER_FARMER, HARVEST_PER_FARMER,
} from './rules.js';

// When two tasks use equally strong skills, prefer the earlier one. Farming
// comes before foraging (they use the same skill) because the fields need a
// set number of hands at the right time of year, while foraging takes anyone.
const PRIORITY = ['hunt', 'farm', 'forage', 'build', 'wood', 'heal', 'scout', 'study'];

// Who can be moved to the fields if they are still short of hands, in order.
const FIELD_HELPERS = ['forage', 'wood', 'scout', 'study', 'hunt'];

// How much farm work the fields need this season, in full-strength farmers.
function fieldWork(state) {
  const s = seasonIndex(state);
  const plots = fieldPlots(state);
  if (!plots || s === 3) return 0;
  if (s === 0) return (plots - state.farm.planted) / PLANT_PER_FARMER;
  if (s === 1) return state.farm.planted / TEND_PER_FARMER;
  return state.farm.planted / HARVEST_PER_FARMER;
}

function needsRest(p) {
  return p.health < 40 || p.sick;
}

// How many people each task can usefully take this season (Infinity = no limit).
function limits(state, people) {
  const s = seasonIndex(state);
  const hurt = people.filter((p) => p.health < 75 || p.sick).length;
  const scoutingLeft = unexploredNeighbors(state, siteFor(state, 'scout')).length > 0
    || knownPlaces(state).some((id) => unexploredNeighbors(state, id).length > 0)
    || state.wanderersMet < WANDERERS.length;
  const farmers = farmersNeeded(state);
  return {
    hunt: Infinity,
    forage: s === 3 ? 0 : Infinity,
    farm: farmers,
    wood: Infinity,
    // Enough builders to finish the project in about two seasons.
    build: state.buildQueue.length
      ? Math.min(6, Math.max(1, Math.ceil(remainingQueueWork(state) / 12)))
      : 0,
    heal: hurt === 0 ? 0 : hurt >= 4 ? 2 : 1,
    scout: scoutingLeft ? 2 : 0,
    study: state.knowledge.current ? Infinity : 0,
  };
}

// Returns a Map of person id to their best task.
export function bestWorkPlan(state) {
  const people = living(state);
  const room = limits(state, people);
  const plan = new Map();
  for (const p of people) if (needsRest(p) || p.age < 5) plan.set(p.id, 'rest');

  // Everyone else, strongest specialists first, so a scarce slot (like the
  // one healer) goes to the person best at it.
  const workers = people.filter((p) => !plan.has(p.id));
  const options = (p) => PRIORITY
    .filter((t) => allowedTasksFor(state, p).includes(t))
    .map((t) => [t, p.skills[TASKS[t].skill]])
    .sort((a, b) => b[1] - a[1] || PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]));
  workers.sort((a, b) => options(b)[0][1] - options(a)[0][1]);
  for (const p of workers) {
    const choice = options(p).find(([t]) => room[t] > 0);
    const task = choice ? choice[0] : 'rest';
    plan.set(p.id, task);
    if (task in room) room[task] -= 1;
  }

  // If the fields are still short of hands (children count for less), bring
  // in the best foragers, then others, from work that can spare them.
  const needed = fieldWork(state);
  const strength = () => people.filter((p) => plan.get(p.id) === 'farm').reduce((sum, p) => sum + workFactor(p), 0);
  if (strength() + 1e-9 < needed) {
    const helpers = people
      .filter((p) => FIELD_HELPERS.includes(plan.get(p.id)) && allowedTasksFor(state, p).includes('farm'))
      .sort((a, b) => FIELD_HELPERS.indexOf(plan.get(a.id)) - FIELD_HELPERS.indexOf(plan.get(b.id))
        || b.skills.foraging - a.skills.foraging);
    for (const p of helpers) {
      if (strength() + 1e-9 >= needed) break;
      plan.set(p.id, 'farm');
    }
  }
  return plan;
}
