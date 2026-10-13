// Picking everyone's best work: the "Assign best work" button.
// Each person goes to the task matching their strongest skill, skipping
// work that makes no sense right now, and the hurt and sick rest.

import { TASKS, WANDERERS } from './data.js';
import { remainingQueueWork } from './building.js';
import {
  living, seasonIndex, allowedTasksFor, unexploredNeighbors, knownPlaces,
} from './state.js';
import { siteFor, farmersNeeded } from './rules.js';

// When two tasks use equally strong skills, prefer the earlier one.
const PRIORITY = ['hunt', 'forage', 'farm', 'build', 'wood', 'heal', 'scout', 'study'];

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
  return plan;
}
