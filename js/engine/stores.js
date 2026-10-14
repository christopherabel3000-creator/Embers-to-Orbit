// The food stores and what to do with plenty: how much the camp can keep,
// what rots when the stores overflow, and feasts.

import { NEIGHBORS, NEIGHBOR_ORDER, OVERFLOW_ROT } from './data.js';
import { living, storageCapacity, inVillage } from './state.js';
import { recordDeed, hasTradition } from './legacy.js';
import { changeRelation } from './neighbors.js';
import { clamp } from './util.js';

export const FEAST_FOOD_PER_PERSON = 3;
export const FEAST_GUEST_FOOD = 15;
export const FEAST_MORALE = 15;
export const FEAST_GOODWILL = 8;
export const FEAST_GAP = 4; // Seasons between feasts: one a year.

// In a village, a yearly feast becomes a custom. Each feast held within
// FEAST_IN_A_ROW seasons of the last lifts spirits FEAST_CUSTOM_DROP less
// than the one before, down to FEAST_CUSTOM_FLOOR. Once people expect one
// (two feasts in a row), a year without a feast lowers spirits by
// FEAST_MISSED, and the next feast lifts them fully again.
export const FEAST_IN_A_ROW = 7;
export const FEAST_CUSTOM_DROP = 3;
export const FEAST_CUSTOM_FLOOR = 5;
export const FEAST_MISSED = 6;
export const FEAST_EXPECTED = 2; // Feasts in a row before one is expected.

// How many feasts in a row a feast held now would follow.
export function feastsInARow(state) {
  return state.turn - (state.lastFeast ?? -99) <= FEAST_IN_A_ROW ? (state.feastStreak || 0) : 0;
}

// How much a feast held now would lift everyone's spirits.
export function feastLift(state) {
  const full = FEAST_MORALE + (hasTradition(state, 'feasting') ? 10 : 0);
  if (!inVillage(state)) return full;
  return Math.max(FEAST_CUSTOM_FLOOR, full - FEAST_CUSTOM_DROP * feastsInARow(state));
}

// The lift a first feast would give, for comparison.
export function fullFeastLift(state) {
  return FEAST_MORALE + (hasTradition(state, 'feasting') ? 10 : 0);
}

// Whether the village expects a feast: it has kept the custom long enough.
export function feastExpected(state) {
  return inVillage(state) && feastsInARow(state) >= FEAST_EXPECTED;
}

// Runs each season after the calendar turns. When an expected feast has not
// come, spirits fall and the custom lapses. Returns report lines.
export function feastCustomSeason(state) {
  if (!inVillage(state) || (state.feastStreak || 0) < FEAST_EXPECTED) return [];
  if (state.turn - (state.lastFeast ?? -99) !== FEAST_IN_A_ROW + 1) return [];
  state.feastStreak = 0;
  for (const p of living(state)) p.morale = clamp(p.morale - FEAST_MISSED);
  return ['A year has passed without a feast, and your people had come to expect one. Spirits fell. The next feast will lift them fully again.'];
}

// Food beyond the room in the stores, half of which rots each season.
export function overflowRot(state) {
  const extra = state.resources.food - storageCapacity(state);
  return extra > 0 ? Math.ceil(extra * OVERFLOW_ROT) : 0;
}

export function feastCost(state, guest = null) {
  return living(state).length * FEAST_FOOD_PER_PERSON + (guest ? FEAST_GUEST_FOOD : 0);
}

// Seasons until another feast can be held (0 means now).
export function seasonsUntilFeast(state) {
  return Math.max(0, (state.lastFeast ?? -99) + FEAST_GAP - state.turn);
}

// Peoples who could be invited: known, and willing to come.
export function feastGuests(state) {
  return NEIGHBOR_ORDER.filter((id) => state.neighbors[id].known && state.neighbors[id].relation > -60);
}

// Why a feast cannot be held now, or null if it can.
export function feastBlocker(state, guest = null) {
  if (state.gameOver) return 'The game is over.';
  const wait = seasonsUntilFeast(state);
  if (wait > 0) return `Your people feasted recently. The next feast can be held in ${wait} ${wait === 1 ? 'season' : 'seasons'}.`;
  if (guest && !feastGuests(state).includes(guest)) return 'They would not come.';
  const cost = feastCost(state, guest);
  if (state.resources.food < cost) return `A feast needs ${cost} food, and you have ${state.resources.food}.`;
  return null;
}

// Holds a feast. Returns { error } or { message }.
export function holdFeast(state, guest = null) {
  const why = feastBlocker(state, guest);
  if (why) return { error: why };
  const cost = feastCost(state, guest);
  const festive = hasTradition(state, 'feasting');
  const lift = feastLift(state);
  state.feastStreak = feastsInARow(state) + 1;
  state.resources.food -= cost;
  state.lastFeast = state.turn;
  state.feastThisSeason = true; // Families grow closer: births are likelier this season.
  for (const p of living(state)) p.morale = clamp(p.morale + lift);
  recordDeed(state, 'feasts');
  let message = `Your people feasted, eating ${cost} food. Spirits are high, and families have grown closer.`;
  if (guest) {
    const generous = hasTradition(state, 'generous') ? 1.5 : 1;
    changeRelation(state, guest, FEAST_GOODWILL * generous * (festive ? 2 : 1));
    recordDeed(state, 'gifts');
    message = `Your people feasted with ${NEIGHBORS[guest].name}, eating ${cost} food. Spirits are high, and your guests went home pleased.`;
  }
  if (lift < fullFeastLift(state)) message += ` Feasting is a custom now: this feast lifted spirits by ${lift}, where a first feast lifts them by ${fullFeastLift(state)}.`;
  return { message };
}
