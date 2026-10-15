// Picking everyone's best work: the "Assign best work" button.
// Each person goes to the task matching their strongest skill, skipping
// work that makes no sense right now, and the hurt and sick rest.

import { TASKS, WANDERERS } from './data.js';
import { remainingQueueWork, shortfall } from './building.js';
import {
  living, seasonIndex, allowedTasksFor, unexploredNeighbors, knownPlaces, fieldPlots,
  inVillage, woodNeededForWarmth, hasCondition, taskAvailable, foodNeeded, foodStoreTarget, foodStocked, hasKnowledge,
} from './state.js';
import { BUILDINGS } from './data.js';
import {
  siteFor, farmersNeeded, workFactor, expectedWork, foodPerPlot, PLANT_PER_FARMER, TEND_PER_FARMER, HARVEST_PER_FARMER,
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

function scoutingLeft(state) {
  return unexploredNeighbors(state, siteFor(state, 'scout')).length > 0
    || knownPlaces(state).some((id) => unexploredNeighbors(state, id).length > 0)
    || state.wanderersMet < WANDERERS.length;
}

// How many people each task can usefully take this season (Infinity = no limit).
function limits(state, people) {
  const s = seasonIndex(state);
  const hurt = people.filter((p) => p.health < 75 || p.sick).length;
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
    scout: scoutingLeft(state) ? 2 : 0,
    study: state.knowledge.current ? Infinity : 0,
  };
}

// Returns a Map of person id to their best task.
export function bestWorkPlan(state) {
  if (inVillage(state)) return villagePlan(state);
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

// ---------- the village council ----------
// In a village the council assigns everyone each season. The player sets
// priorities; the council fills the essential work first (healing, the
// fields, firewood), then the priority work, then food and wood by skill.

const LEVEL = { low: 0, normal: 1, high: 2 };

// How many people the council puts on each priority task.
export function councilTargets(state, workers) {
  const pr = state.priorities || {};
  const level = (area) => LEVEL[pr[area] ?? 'normal'];
  const n = workers.length;
  const share = (lvl, normal, high) => (lvl === 0 ? 0 : lvl === 1 ? normal : high);
  const queueLeft = remainingQueueWork(state);
  const baseBuilders = state.buildQueue.length ? Math.max(1, Math.ceil(queueLeft / 12)) : 0;
  const schools = hasKnowledge(state, 'schools') ? 1.5 : 1;
  return {
    build: !baseBuilders ? 0 : [Math.min(2, baseBuilders), Math.min(6, baseBuilders), Math.min(10, Math.max(2, baseBuilders * 2))][level('building')],
    guard: share(level('defense'), Math.max(1, Math.round(n * 0.08)), Math.max(2, Math.round(n * 0.16))),
    // Schools let half again as many study.
    study: !state.knowledge.current ? 0 : [1, Math.max(1, Math.round(n * 0.08 * schools)), Math.max(2, Math.round(n * 0.16 * schools))][level('learning')],
    scout: !scoutingLeft(state) ? 0 : share(level('exploration'), 1, 2),
    craft: !taskAvailable(state, 'craft') ? 0 : share(level('crafts'), Math.max(1, Math.round(n * 0.06)), Math.max(2, Math.round(n * 0.12))),
  };
}

// Quarriers needed to cut the stone the build queue is waiting for, and to
// keep a little in hand. More when building is a high priority.
const STONE_IN_HAND = 20;
function quarriersNeeded(state, workers) {
  if (!taskAvailable(state, 'quarry')) return 0;
  const waiting = state.buildQueue.filter((item) => !item.paid).reduce((sum, item) => sum + (BUILDINGS[item.id].stone || 0), 0);
  const short = waiting + STONE_IN_HAND - (state.resources.stone || 0);
  if (short <= 0) return 0;
  const extra = (state.priorities || {}).building === 'high' ? 1 : 0;
  return Math.min(Math.ceil(workers.length / 4), Math.ceil(short / 12) + extra); // About 5 stone a season each.
}

// Woodcutters needed so the fires never go cold and the next building can start.
function woodcuttersNeeded(state, workers) {
  const s = seasonIndex(state);
  const count = living(state).length;
  let need = 0;
  for (let i = 0; i < 3; i++) need += woodNeededForWarmth((s + i) % 4, count, i === 0 && hasCondition(state, 'hardWinter'));
  const next = state.buildQueue.find((item) => !item.paid);
  if (next) need += BUILDINGS[next.id].cost;
  const short = need - state.resources.wood;
  if (short <= 0) return 0;
  return Math.min(Math.ceil(workers.length / 3), Math.ceil(short / 10)); // About 5 wood a season each, over two seasons.
}

// Plots the council sows this spring: enough that the harvest brings the
// stores up to what it aims to keep, after the village eats through spring,
// summer, and autumn. None if the stores will still be full.
export function plotsToSow(state) {
  const open = fieldPlots(state) - state.farm.planted;
  if (open <= 0) return 0;
  const before = state.resources.food - 3 * foodNeeded(living(state));
  const short = foodStoreTarget(state) - before;
  if (short <= 0) return 0;
  return Math.min(open, Math.ceil(short / foodPerPlot(1, state)));
}

// While the stores hold all the council aims to keep, spare hands build
// until the queue could be finished this season, then make goods. Before
// your people can craft, they cut wood instead. Returns the task, or null
// to send this person to food as usual.
function spareHandsTask(state, plan, p, allowed) {
  // Only while builders could work: something is under way, or the next
  // building is paid for in hand.
  const next = state.buildQueue.find((item) => !item.paid);
  const workable = state.buildQueue.some((item) => item.paid) || (next && !shortfall(state, next.id).length);
  if (allowed.includes('build') && workable) {
    const work = [...plan].filter(([, t]) => t === 'build')
      .reduce((sum, [id]) => sum + expectedWork(state.people.find((x) => x.id === id), state), 0);
    if (work < remainingQueueWork(state)) return 'build';
  }
  if (allowed.includes('craft')) return 'craft';
  if (allowed.includes('wood')) return 'wood';
  return null;
}

export function villagePlan(state) {
  const people = living(state);
  const s = seasonIndex(state);
  const plan = new Map();
  for (const p of people) if (needsRest(p) || p.age < 5) plan.set(p.id, 'rest');
  const workers = people.filter((p) => !plan.has(p.id));
  const free = (task) => workers.filter((p) => !plan.has(p.id) && allowedTasksFor(state, p).includes(task));
  const take = (task, n, skill = TASKS[task].skill) => {
    free(task).sort((a, b) => b.skills[skill] - a.skills[skill]).slice(0, Math.max(0, n)).forEach((p) => plan.set(p.id, task));
  };

  // Essentials first.
  const hurt = people.filter((p) => p.health < 75 || p.sick).length;
  take('heal', hurt === 0 ? 0 : hurt >= 8 ? 3 : hurt >= 4 ? 2 : 1);

  // Under siege, everyone works inside the walls: building, crafts, study,
  // and a strong watch on the walls.
  if (state.siege) {
    const targets = councilTargets(state, workers);
    take('build', targets.build);
    take('guard', Math.max(targets.guard, Math.round(workers.length * 0.25)));
    take('craft', targets.craft);
    take('study', targets.study);
    for (const p of workers.filter((x) => !plan.has(x.id))) {
      const allowed = allowedTasksFor(state, p);
      const inside = ['craft', 'study', 'build'].find((t) => allowed.includes(t) && (t !== 'study' || state.knowledge.current) && (t !== 'build' || state.buildQueue.length));
      plan.set(p.id, inside || 'rest');
    }
    return plan;
  }
  // In spring the council sows only what the food stores need.
  const needed = s === 0 ? plotsToSow(state) / PLANT_PER_FARMER : fieldWork(state);
  if (needed > 0) {
    let strength = 0;
    for (const p of free('farm').sort((a, b) => b.skills.foraging - a.skills.foraging)) {
      if (strength + 1e-9 >= needed) break;
      plan.set(p.id, 'farm');
      strength += workFactor(p);
    }
  }
  take('wood', woodcuttersNeeded(state, workers));

  // Then what the player asked the council to push.
  const targets = councilTargets(state, workers);
  take('build', targets.build);
  take('quarry', quarriersNeeded(state, workers));
  take('craft', targets.craft);
  take('guard', targets.guard);
  take('study', targets.study);
  take('scout', targets.scout);

  // Everyone else to food or wood, by skill. Ties go to food. While the
  // stores are full, spare hands go to building and crafts instead.
  const stocked = foodStocked(state);
  const rest = workers.filter((x) => !plan.has(x.id)).sort((a, b) => b.skills.building - a.skills.building);
  for (const p of rest) {
    const allowed = allowedTasksFor(state, p);
    const spare = stocked ? spareHandsTask(state, plan, p, allowed) : null;
    if (spare) {
      plan.set(p.id, spare);
      continue;
    }
    const options = [['hunt', p.skills.hunting], ['forage', p.skills.foraging], ['wood', p.skills.building - 0.5]]
      .filter(([t]) => allowed.includes(t) && !(t === 'forage' && s === 3)) // Nothing to forage in winter.
      .sort((a, b) => b[1] - a[1]);
    plan.set(p.id, options.length ? options[0][0] : (allowed.includes('study') && state.knowledge.current ? 'study' : 'rest'));
  }
  return plan;
}
