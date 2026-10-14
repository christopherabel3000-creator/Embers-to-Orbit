// The food stores and what to do with plenty: how much the camp can keep,
// what rots when the stores overflow, and feasts.

import { NEIGHBORS, NEIGHBOR_ORDER, OVERFLOW_ROT } from './data.js';
import { living, storageCapacity } from './state.js';
import { recordDeed, hasTradition } from './legacy.js';
import { changeRelation } from './neighbors.js';
import { clamp } from './util.js';

export const FEAST_FOOD_PER_PERSON = 3;
export const FEAST_GUEST_FOOD = 15;
export const FEAST_MORALE = 15;
export const FEAST_GOODWILL = 8;
export const FEAST_GAP = 4; // Seasons between feasts: one a year.

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
  state.resources.food -= cost;
  state.lastFeast = state.turn;
  state.feastThisSeason = true; // Families grow closer: births are likelier this season.
  const lift = FEAST_MORALE + (festive ? 10 : 0);
  for (const p of living(state)) p.morale = clamp(p.morale + lift);
  recordDeed(state, 'feasts');
  let message = `Your people feasted, eating ${cost} food. Spirits are high, and families have grown closer.`;
  if (guest) {
    const generous = hasTradition(state, 'generous') ? 1.5 : 1;
    changeRelation(state, guest, FEAST_GOODWILL * generous * (festive ? 2 : 1));
    recordDeed(state, 'gifts');
    message = `Your people feasted with ${NEIGHBORS[guest].name}, eating ${cost} food. Spirits are high, and your guests went home pleased.`;
  }
  return { message };
}
