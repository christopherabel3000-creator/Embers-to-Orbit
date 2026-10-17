// Moving people out of the capital: in the Nation era, ordinary people can
// leave the capital to settle in one of the nation's settlements, as far as
// its homes have room. The steward can do it under a standing order,
// keeping the capital at a size the player chooses.

import { living, eraAtLeast } from './state.js';
import { homeRoom, settlementById } from './realm.js';
import { isNotable } from './village.js';
import { KEEP_AT_HOME } from './settlements.js';
import { SKILLS } from './data.js';
import { plural, listWords } from './util.js';

export const MOVE_MAX = 10; // People who can move to one settlement in a season.
// Sizes the steward can be told to keep the capital at, sending the rest out.
export const SPREAD_LEVELS = [60, 80, 100, 120, 150, 200];

// Room left in a settlement's homes.
export function townRoom(state, t) {
  return Math.max(0, t.buildings.homes * homeRoom(state) - t.population);
}

// Everyone a waiting decision refers to stays until it is made: events keep
// people by id under many names, so every number in the event counts.
function heldByEvent(state) {
  const ids = new Set();
  const walk = (v) => {
    if (typeof v === 'number') ids.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(state.pendingEvent);
  return ids;
}

// Who may leave the capital: healthy adults under 55 who are not notable
// (the council, heroes, and masters stay), and no one a waiting decision is
// about. The least skilled go first, so the capital keeps its best hands.
export function movers(state) {
  const best = (p) => Math.max(...SKILLS.map((k) => p.skills[k] || 0));
  const held = heldByEvent(state);
  return living(state)
    .filter((p) => p.age >= 16 && p.age < 55 && p.health >= 40 && !p.sick && !isNotable(state, p) && !held.has(p.id))
    .sort((a, b) => best(a) - best(b) || a.id - b.id);
}

// How many can move to this settlement this season.
export function moveRoom(state, t) {
  return Math.max(0, Math.min(MOVE_MAX, townRoom(state, t), living(state).length - KEEP_AT_HOME, movers(state).length));
}

// Why no one can move to this settlement now, or null if some can.
export function moveBlocker(state, t) {
  if (!eraAtLeast(state, 'nation')) return 'People can move out of the capital once your people are a nation.';
  if (!t) return 'There is no such settlement.';
  if (state.siege) return 'No one can leave the capital through a siege.';
  if (t.lastSettlers === state.turn) return `People from ${state.campName} are already on the road to ${t.name} this season.`;
  if (townRoom(state, t) < 1) return `${t.name}'s homes are full. Its governor builds more as it grows.`;
  if (living(state).length <= KEEP_AT_HOME) return `${state.campName} must keep at least ${KEEP_AT_HOME} people.`;
  if (!movers(state).length) return `No one in ${state.campName} is free to leave: only healthy adults under 55 who are not notable can go.`;
  return null;
}

// Moves people out of the capital into a settlement. Returns { count } or
// { error }; the people leave the capital and join its count.
function move(state, t, n) {
  const going = movers(state).slice(0, n);
  const ids = new Set(going.map((p) => p.id));
  state.people = state.people.filter((p) => !ids.has(p.id));
  t.population += going.length;
  t.lastSettlers = state.turn;
  state.movedOut = (state.movedOut || 0) + going.length;
  return going.length;
}

export function moveSettlers(state, { settlementId, count }) {
  const t = settlementById(state, Number(settlementId));
  const why = moveBlocker(state, t);
  if (why) return { error: why };
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) return { error: 'Choose how many people should go.' };
  const room = moveRoom(state, t);
  if (n > room) return { error: `${plural(room, 'person', 'people')} can move to ${t.name} this season.` };
  const moved = move(state, t, n);
  return { message: `${plural(moved, 'person has', 'people have')} left ${state.campName} to settle in ${t.name}, which now has ${t.population} people.` };
}

// The steward's standing order: while the capital is larger than the size
// the player chose, send the rest to the settlements with the most room.
// Returns a line for the report, or null.
export function spreadByOrder(state) {
  const keep = state.orders.spreadAbove;
  if (keep == null || !eraAtLeast(state, 'nation') || state.siege) return null;
  const sent = [];
  const towns = [...(state.settlements || [])].sort((a, b) => townRoom(state, b) - townRoom(state, a) || a.id - b.id);
  for (const t of towns) {
    const excess = living(state).length - keep;
    if (excess < 1) break;
    if (moveBlocker(state, t)) continue;
    const n = Math.min(excess, moveRoom(state, t));
    if (n < 1) continue;
    sent.push(`${plural(n, 'person', 'people')} to ${t.name}`);
    move(state, t, n);
  }
  if (!sent.length) return null;
  return `sent ${listWords(sent)} from ${state.campName}, which you asked to keep at about ${keep} people.`;
}
