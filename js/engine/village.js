// The Settlement era: a camp that chooses to become a village. Work is now
// assigned by the council; the player sets priorities. The village shows
// its people as groups by work, and draws settlers when it thrives.

import {
  TASKS, TASK_ORDER, SETTLER_NAMES, SETTLER_NOTES, SKILLS, PRIORITY_AREAS, PRIORITY_LEVELS,
} from './data.js';
import {
  living, inVillage, makePerson, foodNeeded, shelterNeeded, shelterCapacity, lifeStage, hasKnowledge,
} from './state.js';
import { bestWorkPlan } from './assign.js';
import { startNations } from './nations.js';
import { lawIs } from './laws.js';
import { refreshAdvisors } from './advisors.js';
import { hasTradition } from './legacy.js';
import { chance, randomInt, pick } from './rng.js';
import { clamp } from './util.js';

// Names for each group in the village, by task.
export const GROUP_NAMES = {
  hunt: 'Hunters',
  forage: 'Foragers',
  farm: 'Farmers',
  wood: 'Woodcutters',
  quarry: 'Quarriers',
  craft: 'Crafters',
  build: 'Builders',
  scout: 'Scouts',
  guard: 'Guards',
  heal: 'Healers',
  study: 'Scholars',
  rest: 'Resting',
};

// Why the camp cannot become a village yet, or null if it can.
// A large village frays: spirits settle 1 lower for every 10 people beyond
// 30, up to 5. A meeting hall, a shrine, comforts, and laws can make up for it.
export const CROWDING_FROM = 30;
export function crowdingSettle(state) {
  if (!inVillage(state)) return 0;
  return Math.min(5, Math.floor(Math.max(0, living(state).length - CROWDING_FROM) / 10));
}

export function villageBlocker(state) {
  if (inVillage(state)) return 'Your people already live in a village.';
  if (state.gameOver) return 'The game is over.';
  if (!state.milestoneReached) {
    return 'A village needs 16 people, a storehouse, a palisade, and farming.';
  }
  return null;
}

// The player chooses to become a village. Returns { error } or { message }.
export function foundVillage(state) {
  const why = villageBlocker(state);
  if (why) return { error: why };
  state.era = 'village';
  state.villageFounded = state.turn;
  startNations(state);
  state.orders.autoAssign = true;
  state.orders.comforts = true; // Once there are goods, share some out.
  for (const p of living(state)) p.morale = clamp(p.morale + 10);
  const plan = bestWorkPlan(state);
  for (const p of living(state)) {
    p.task = plan.get(p.id) || 'rest';
    p.orderReturn = null;
  }
  refreshAdvisors(state);
  const line = `${state.campName} is a village now. The elders gathered by the fire and agreed: from this season on, the council will set everyone's work, guided by the priorities you choose. Huts and guards are now possible. The peoples of the valley have noticed too: they are growing into nations, and will claim land of their own.`;
  state.log.push({ turn: state.turn, date: state.report.title, text: line });
  state.report.decisions = [...(state.report.decisions || []), line];
  return { message: `${state.campName} is a village now. The council will assign everyone's work each season. Set its priorities on the Village screen.` };
}

export function setPriority(state, area, level) {
  if (!inVillage(state)) return { error: 'Priorities are set once your camp becomes a village.' };
  if (!PRIORITY_AREAS[area]) return { error: 'Unknown priority.' };
  if (!PRIORITY_LEVELS.includes(level)) return { error: 'Choose low, normal, or high.' };
  state.priorities[area] = level;
  return { message: `${PRIORITY_AREAS[area].name} priority set to ${level}. The council will follow it from next season.` };
}

// The village's people as groups by work, largest first.
export function groups(state) {
  const people = living(state).filter((p) => lifeStage(p) !== 'infant');
  return TASK_ORDER
    .map((task) => {
      const members = people.filter((p) => p.task === task);
      const skill = TASKS[task].skill;
      const avg = skill && members.length
        ? members.reduce((sum, p) => sum + p.skills[skill], 0) / members.length
        : null;
      const hurt = members.filter((p) => p.health < 40 || p.sick).length;
      return { task, name: GROUP_NAMES[task], count: members.length, skill, avgSkill: avg, hurt };
    })
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
}

// Named people the village keeps track of: the council, and masters of a skill.
// The council, masters of a skill, and the village's heroes.
export function notablePeople(state) {
  const council = new Set(Object.values(state.advisors));
  const heroes = new Set((state.heroes || []).map((h) => h.id));
  return living(state).filter((p) => council.has(p.id) || heroes.has(p.id) || SKILLS.some((k) => p.skills[k] >= 5));
}

// ----- Settlers -----

export function settlerChance(state) {
  if (!inVillage(state) || lawIs(state, 'strangers', 'closed') || state.siege) return 0;
  const people = living(state);
  if (state.resources.food < foodNeeded(people) * 2) return 0;
  if (shelterNeeded(people) + 1 > shelterCapacity(state)) return 0;
  const spirits = people.reduce((sum, p) => sum + p.morale, 0) / Math.max(1, people.length);
  let p = 0.15;
  if (spirits >= 70) p += 0.1;
  if (hasTradition(state, 'hearth')) p += 0.1;
  if (hasKnowledge(state, 'elders')) p += 0.1; // Word of a fair council spreads.
  if (lawIs(state, 'strangers', 'open')) p += 0.1;
  return p;
}

function settlerName(state) {
  const taken = new Set(state.people.map((p) => p.name));
  const open = SETTLER_NAMES.filter((n) => !taken.has(n));
  if (open.length) return pick(state, open);
  return `${pick(state, SETTLER_NAMES)} the ${['Younger', 'Elder', 'Second'][randomInt(state, 0, 2)]}`;
}

// A newcomer to the village with one strong skill. Returns the person.
export function newcomer(state, note = null) {
  const main = pick(state, SKILLS);
  const skills = {};
  for (const k of SKILLS) skills[k] = k === main ? randomInt(state, 2, 4) : randomInt(state, 0, 2);
  const person = makePerson({
    name: settlerName(state), note: note || pick(state, SETTLER_NOTES), age: randomInt(state, 16, 34), skills,
  }, state.nextPersonId++, 'rest');
  person.morale = 60;
  person.isNew = true;
  state.people.push(person);
  return person;
}

function makeSettler(state) {
  const settler = newcomer(state);
  state.settlersMet = (state.settlersMet || 0) + 1;
  return settler;
}


// Each season a thriving village may draw settlers. Returns report lines.
export function maybeSettlers(state) {
  const events = [];
  if (!chance(state, settlerChance(state))) return events;
  const count = chance(state, lawIs(state, 'strangers', 'open') ? 0.4 : 0.2) ? 2 : 1;
  const arrived = [];
  for (let i = 0; i < count; i++) arrived.push(makeSettler(state));
  const names = arrived.map((p) => p.name).join(' and ');
  events.push(`Word of the village has spread. ${names} ${count === 1 ? 'has' : 'have'} come to settle: ${arrived.map((p) => p.note.charAt(0).toLowerCase() + p.note.slice(1).replace(/\.$/, '')).join('; ')}.`);
  return events;
}
