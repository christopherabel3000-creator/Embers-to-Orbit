// Inviting settlers: in the Nation era, coin pays the passage of settlers
// from beyond the valley to the capital, a party at most once a season,
// as many as the homes and stores can take. The steward can do it under a
// standing order, keeping a reserve in the treasury.

import {
  living, eraAtLeast, hasKnowledge, foodNeeded, shelterNeeded, shelterCapacity,
} from './state.js';
import { lawIs } from './laws.js';
import { newcomer } from './village.js';
import { plural } from './util.js';

export const INVITE_COIN = 10; // Coin for each settler's passage, before the capital's size.
export const INVITE_COIN_OPEN = 8; // With open gates, word travels and they come cheaper.
export const INVITE_PER = 5; // The passage costs 1 coin more for every this many people in the capital.
export const INVITE_MAX = 5; // Settlers in one season's party.
export const INVITE_FOOD_SEASONS = 2; // Food the stores must hold for everyone, newcomers included.
// Treasury reserves the steward can be told to keep while inviting settlers.
export const INVITE_RESERVES = [0, 50, 100, 250, 500];

// A growing capital must reach farther for settlers, and pay more for each.
export function inviteCost(state) {
  const base = lawIs(state, 'strangers', 'open') ? INVITE_COIN_OPEN : INVITE_COIN;
  return base + Math.floor(living(state).length / INVITE_PER);
}

// How many settlers the capital can take this season: room in the homes
// (keeping one place spare) and food for everyone for two seasons.
export function inviteRoom(state) {
  const people = living(state);
  const homes = Math.floor(shelterCapacity(state) - shelterNeeded(people) - 1);
  const food = Math.floor((state.resources.food / INVITE_FOOD_SEASONS - foodNeeded(people)) / foodNeeded(1));
  return Math.max(0, Math.min(INVITE_MAX, homes, food));
}

// Why no settlers can be invited now, or null if some can.
export function inviteBlocker(state) {
  if (!eraAtLeast(state, 'nation')) return 'Settlers can be invited once your people are a nation.';
  if (!hasKnowledge(state, 'coinage')) return 'Inviting settlers needs Coinage.';
  if (lawIs(state, 'strangers', 'closed')) return 'Your law closes the gates to strangers.';
  if (state.siege) return 'No one can reach the capital through a siege.';
  if (state.lastInvite === state.turn) return 'A party of settlers is already on its way this season.';
  const people = living(state);
  if (Math.floor(shelterCapacity(state) - shelterNeeded(people) - 1) < 1) return 'The homes are full. Build more huts first.';
  if (inviteRoom(state) < 1) return `The stores must hold ${INVITE_FOOD_SEASONS} seasons of food for everyone before more can come.`;
  const cost = inviteCost(state);
  if ((state.resources.coin || 0) < cost) return `Each settler's passage costs ${cost} coin; you have ${state.resources.coin || 0}.`;
  return null;
}

// The most settlers the treasury can pay for this season, keeping a reserve.
export function inviteAffordable(state, reserve = 0) {
  const spare = Math.max(0, (state.resources.coin || 0) - reserve);
  return Math.min(inviteRoom(state), Math.floor(spare / inviteCost(state)));
}

export function inviteSettlers(state, count) {
  const why = inviteBlocker(state);
  if (why) return { error: why };
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) return { error: 'Choose how many settlers to invite.' };
  const room = inviteRoom(state);
  if (n > room) return { error: `The capital can take ${plural(room, 'settler', 'settlers')} this season.` };
  const cost = n * inviteCost(state);
  if ((state.resources.coin || 0) < cost) return { error: `${plural(n, 'settler', 'settlers')} cost ${cost} coin; you have ${state.resources.coin || 0}.` };
  state.resources.coin -= cost;
  state.lastInvite = state.turn;
  state.invited = (state.invited || 0) + n;
  for (let i = 0; i < n; i++) newcomer(state, 'Came from beyond the valley, the passage paid by your treasury.');
  return { message: `${plural(n, 'settler has', 'settlers have')} come to ${state.campName} for ${cost} coin.`, count: n, cost };
}

// The steward's standing order: invite as many as the capital can take
// while the treasury stays above the reserve. Returns a line, or null.
export function inviteByOrder(state) {
  const reserve = state.orders.inviteReserve;
  if (reserve == null || reserve < 0 || inviteBlocker(state)) return null;
  const n = inviteAffordable(state, reserve);
  if (n < 1) return null;
  const r = inviteSettlers(state, n);
  if (r.error) return null;
  return `invited ${plural(n, 'settler', 'settlers')} to ${state.campName} for ${r.cost} coin, keeping ${reserve} in the treasury.`;
}
