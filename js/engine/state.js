// Creating a new game, plus small read-only helpers about the game state.

import {
  FOUNDERS, SEASONS, STARTING_SHELTER, SHELTER_PER_LEAN_TO, BUILDING_ORDER,
} from './data.js';

export const SAVE_VERSION = 1;

const STARTING_TASKS = {
  Aric: 'hunt', Brenna: 'forage', Corvin: 'wood', Dalia: 'forage', Esker: 'scout',
  Fenna: 'forage', Garrow: 'hunt', Hesta: 'build', Iven: 'wood', Jora: 'hunt',
  Kael: 'wood', Lisbet: 'forage',
};

export function makePerson(template, id, task = 'forage') {
  return {
    id,
    name: template.name,
    note: template.note,
    skills: { ...template.skills },
    health: 100,
    morale: 60,
    alive: true,
    task,
  };
}

export function newGame({ seed = Date.now(), campName = 'Emberhold' } = {}) {
  const people = FOUNDERS.map((f, i) => makePerson(f, i + 1, STARTING_TASKS[f.name] || 'forage'));
  const buildings = {};
  for (const id of BUILDING_ORDER) buildings[id] = 0;
  const state = {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    rng: seed >>> 0,
    campName: campName.trim() || 'Emberhold',
    turn: 0,
    resources: { food: 50, wood: 30 },
    people,
    nextPersonId: people.length + 1,
    wanderersMet: 0,
    buildings,
    project: null,
    discoveries: [],
    advisors: { steward: 6, warChief: 7, healer: 4 }, // Fenna, Garrow, Dalia
    pendingEvent: null,
    report: null,
    log: [],
    gameOver: false,
    milestoneReached: false,
  };
  state.report = {
    title: `Spring, Year 1`,
    urgent: [],
    events: [
      `Twelve survivors have made camp at ${state.campName}, in a sheltered forest valley beside a river.`,
      'They have one tent, a little food, and each other. Assign everyone a task, choose a building project, then end the season.',
    ],
  };
  return state;
}

export function seasonIndex(state) {
  return state.turn % 4;
}

export function seasonName(state, offset = 0) {
  return SEASONS[(state.turn + offset) % 4];
}

export function year(state, offset = 0) {
  return Math.floor((state.turn + offset) / 4) + 1;
}

export function dateLabel(state, offset = 0) {
  return `${seasonName(state, offset)}, Year ${year(state, offset)}`;
}

export function living(state) {
  return state.people.filter((p) => p.alive);
}

export function personById(state, id) {
  return state.people.find((p) => p.id === id);
}

export function shelterCapacity(state) {
  return STARTING_SHELTER + state.buildings.leanTo * SHELTER_PER_LEAN_TO;
}

export function hasDiscovery(state, id) {
  return state.discoveries.includes(id);
}

export function foodNeeded(count) {
  return count * 2;
}

export function woodNeededForWarmth(seasonIdx, count) {
  if (seasonIdx === 3) return count;
  if (seasonIdx === 2) return Math.ceil(count / 2);
  return 0;
}

export function spoilageRate(state) {
  return state.buildings.storehouse > 0 ? 0.04 : 0.12;
}

export function healthWord(health) {
  if (health >= 75) return 'healthy';
  if (health >= 40) return 'hurt';
  return 'badly hurt';
}

export function moraleWord(morale) {
  if (morale >= 70) return 'high spirits';
  if (morale >= 45) return 'steady';
  if (morale >= 25) return 'low spirits';
  return 'despairing';
}

export function isBadlyHurt(person) {
  return person.alive && person.health < 40;
}
