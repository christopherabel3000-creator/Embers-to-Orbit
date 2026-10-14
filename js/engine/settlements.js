// A second settlement: the end of the Settlement era and the start of the
// Nation era. Settlers leave the village with a governor, found a new
// settlement on land the village holds, and it runs itself, sending food,
// wood, or stone home each season.

import { PLACES } from './data.js';
import {
  living, inVillage, eraAtLeast, placeName, seasonIndex, isKnown,
} from './state.js';
import { refreshAdvisors, ADVISOR_ROLES } from './advisors.js';
import { notablePeople } from './village.js';
import { nationsActive, harryChance, skarnLosses } from './nations.js';
import { chance, randomInt } from './rng.js';
import { shuffle, listNames } from './util.js';

export const SETTLEMENT_COST = { food: 80, wood: 60, stone: 30 };
export const MIN_VILLAGE = 40; // People the village needs before it can found another.
export const KEEP_AT_HOME = 30; // People who must stay in the village.
export const SETTLERS = [10, 20]; // How many can go.

export const POLICIES = {
  grow: { name: 'Grow', about: 'Keeps most of what it makes, sends home a little, and grows quickly.' },
  supply: { name: 'Supply', about: 'Sends home as much as it can spare, and grows slowly.' },
};

// What a settlement at this place sends home: the kind of work its land is best for.
export function settlementProduct(placeId) {
  const b = PLACES[placeId].bonus || {};
  const best = [['stone', b.quarry || 0], ['wood', b.wood || 0], ['food', Math.max(b.hunt || 0, b.forage || 0)]]
    .sort((x, y) => y[1] - x[1])[0];
  return best[1] > 0 ? best[0] : 'food';
}

// Places where a settlement could be founded.
export function settlementSites(state) {
  const settled = new Set((state.settlements || []).map((t) => t.place));
  return Object.keys(state.places).filter((id) => id !== 'camp' && state.places[id].owner === 'player'
    && isKnown(state, id) && !settled.has(id));
}

export function settlerRange(state) {
  const pop = living(state).length;
  return [SETTLERS[0], Math.max(SETTLERS[0], Math.min(SETTLERS[1], pop - KEEP_AT_HOME))];
}

// Why the village cannot found a settlement yet, or null if it can.
export function settlementBlocker(state) {
  if (!inVillage(state)) return 'Only a village can found another settlement.';
  if ((state.settlements || []).length) return `You have already founded ${state.settlements[0].name}. More settlements will come with the Nation era.`;
  if (!nationsActive(state)) return 'Your village must see out a season first.';
  const pop = living(state).length;
  if (pop < MIN_VILLAGE) return `A village needs at least ${MIN_VILLAGE} people before some can leave to found another; you have ${pop}.`;
  if (!settlementSites(state).length) return 'Your village must hold a place beyond its camp to settle. Claim one on the Map screen.';
  const short = Object.entries(SETTLEMENT_COST).filter(([k, n]) => (state.resources[k] || 0) < n);
  if (short.length) return `Founding a settlement takes ${costText()}. You are short of ${short.map(([k, n]) => `${n - (state.resources[k] || 0)} ${k}`).join(' and ')}.`;
  return null;
}

export function costText() {
  return `${SETTLEMENT_COST.food} food, ${SETTLEMENT_COST.wood} wood, and ${SETTLEMENT_COST.stone} stone`;
}

// Who could govern: the village's notable people, if fit to travel.
export function governorChoices(state) {
  return notablePeople(state).filter((p) => p.age >= 16 && p.health >= 40 && !p.sick);
}

// Founds the settlement. Returns { error } or { message }.
export function foundSettlement(state, {
  placeId, name, settlers, governorId, policy = 'grow',
}) {
  const why = settlementBlocker(state);
  if (why) return { error: why };
  if (!settlementSites(state).includes(placeId)) return { error: 'Choose a place your village holds.' };
  const [lo, hi] = settlerRange(state);
  const count = Number(settlers);
  if (!Number.isInteger(count) || count < lo || count > hi) return { error: `Choose between ${lo} and ${hi} settlers.` };
  const governor = governorChoices(state).find((p) => p.id === Number(governorId));
  if (!governor) return { error: 'Choose a governor from your notable people.' };
  if (!POLICIES[policy]) return { error: 'Choose grow or supply.' };
  const title = String(name || '').trim().slice(0, 30) || `New ${placeName(state, placeId)}`;

  // The council keeps itself at home; the rest are a fair mix of able adults.
  const council = new Set(Object.values(state.advisors));
  const pool = shuffle(state, living(state).filter((p) => p !== governor && !council.has(p.id)
    && p.age >= 16 && p.age <= 50 && p.health >= 40 && !p.sick));
  const going = [governor, ...pool.slice(0, count - 1)];
  if (going.length < count) return { error: 'Not enough people are fit to make the journey.' };
  const roles = Object.entries(state.advisors).filter(([, id]) => id === governor.id).map(([r]) => ADVISOR_ROLES[r].title.toLowerCase());

  for (const [k, n] of Object.entries(SETTLEMENT_COST)) state.resources[k] -= n;
  const ids = new Set(going.map((p) => p.id));
  state.people = state.people.filter((p) => !ids.has(p.id));
  state.settlements = state.settlements || [];
  state.settlements.push({
    id: 1,
    name: title,
    place: placeId,
    population: count,
    governor: { id: governor.id, name: governor.name },
    people: going.map((p) => ({ ...p, task: 'settler' })),
    policy,
    founded: state.turn,
    lastShipment: null,
  });
  refreshAdvisors(state);
  state.era = 'nation';
  const names = count > 3 ? `${going.slice(0, 3).map((p) => p.name).join(', ')}, and ${count - 3} more` : listNames(going);
  const line = `${names} set out for ${placeName(state, placeId)} to found ${title}, with ${governor.name} as governor${roles.length ? `, leaving the post of ${roles.join(' and ')} to another` : ''}. Your people now live in two settlements: the Nation era has begun. Its own new ways will come in a future update; ${state.campName} and ${title} go on.`;
  state.log.push({ turn: state.turn, date: state.report.title, text: line });
  state.report.decisions = [...(state.report.decisions || []), line];
  return { message: `${title} is founded at ${placeName(state, placeId)}, with ${count} settlers and ${governor.name} as governor. The Nation era has begun.` };
}

export function setPolicy(state, { settlementId = 1, policy }) {
  const t = (state.settlements || []).find((x) => x.id === settlementId);
  if (!t) return { error: 'There is no such settlement.' };
  if (!POLICIES[policy]) return { error: 'Choose grow or supply.' };
  t.policy = policy;
  return { message: `${t.name} will ${policy === 'grow' ? 'keep more and grow' : 'send home all it can spare'}.` };
}

// What a settlement sends home this season.
export function expectedShipment(state, t) {
  const kind = settlementProduct(t.place);
  const rate = { food: 1, wood: 0.8, stone: 0.6 }[kind] * (t.policy === 'grow' ? 0.4 : 1);
  let amount = t.population * rate;
  if (kind === 'food' && seasonIndex(state) === 3) amount *= 0.5; // Lean winters there too.
  return { kind, amount: Math.round(amount) };
}

// Runs each season, after the village's own work. Returns report lines.
// Each season's shipments go into `routine` when it is given.
export function settlementsSeason(state, routine = null) {
  const lines = [];
  for (const t of state.settlements || []) {
    const ship = expectedShipment(state, t);
    if (ship.amount > 0) {
      state.resources[ship.kind] = (state.resources[ship.kind] || 0) + ship.amount;
      (routine || lines).push(`${t.name} sent home ${ship.amount} ${ship.kind}.`);
    }
    t.lastShipment = ship;
    // Each spring the settlement grows.
    if (seasonIndex(state) === 0) {
      const rate = t.policy === 'grow' ? 0.08 : 0.03;
      const grown = Math.max(1, Math.round(t.population * rate));
      t.population += grown;
      lines.push(`${t.name} has grown to ${t.population} people.`);
    }
  }
  return lines;
}

// Skarn skirmishers fall on the settlement too. Returns report lines.
export function harrySettlements(state) {
  const lines = [];
  for (const t of state.settlements || []) {
    if (!chance(state, harryChance(state) * 0.6)) continue;
    if (chance(state, Math.min(0.6, t.population / 50))) {
      skarnLosses(state, 1);
      lines.push(`Skarn skirmishers came against ${t.name}, and its settlers drove them off.`);
      continue;
    }
    const lost = randomInt(state, 1, 2);
    t.population = Math.max(3, t.population - lost);
    lines.push(`Skarn skirmishers fell on ${t.name}. ${lost === 1 ? 'One settler was' : `${lost} settlers were`} killed.`);
  }
  return lines;
}

export function inNationEra(state) {
  return eraAtLeast(state, 'nation');
}
