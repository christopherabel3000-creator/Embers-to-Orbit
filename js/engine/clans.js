// The hill clans. Warriors from the eastern hills who care nothing for the
// valley's quarrels, only for plunder. A large, rich village draws them,
// and they march with the Skarn: in their war bands, their sieges, and
// their great hosts. Full stores are a lure; gifts of goods keep the clans
// at home for a while.

import { living, year } from './state.js';
import { skarnAtPeace } from './neighbors.js';
import { raidScale } from './difficulty.js';
import { passHeld } from './warStatus.js';

export const CLANS_FROM_PEOPLE = 30; // People beyond this many draw the clans.
export const CLANS_PER_PERSON = 0.3; // Clansmen drawn by each person beyond that.
export const CLANS_WEALTH_START = 300; // Stores beyond this draw notice...
export const CLANS_WEALTH_PER = 80; // ...one more clansman for every this much food and goods.
export const CLANS_MAX = 40;
export const CLAN_GIFT_PER = 2; // Goods for each clansman, to keep them home.
export const CLAN_GIFT_MIN = 10;
export const CLAN_GIFT_SEASONS = 8; // How long a gift keeps them home.

export function clans(state) {
  if (!state.clans) state.clans = { warriors: 0, quietUntil: -1, arrived: false };
  return state.clans;
}

// How many clansmen the village's size and stores draw.
export function clanTarget(state) {
  const people = living(state).length;
  const wealth = (state.resources.food || 0) + (state.resources.goods || 0);
  const drawn = Math.max(0, people - CLANS_FROM_PEOPLE) * CLANS_PER_PERSON
    + Math.max(0, wealth - CLANS_WEALTH_START) / CLANS_WEALTH_PER;
  return Math.min(Math.round(CLANS_MAX * raidScale(state)), Math.round(drawn * raidScale(state)));
}

export function clansQuiet(state) {
  return clans(state).quietUntil > state.turn;
}

// Clansmen who would march with the Skarn now.
export function clansMarching(state) {
  if (!state.neighbors.skarn.nation || skarnAtPeace(state) || clansQuiet(state) || passHeld(state)) return 0;
  return clans(state).warriors;
}

// While the Skarn keep the peace, the clans answer to no one: they raid on
// their own. Returns how many could come, or 0.
export const CLAN_RAID_MIN = 5;
export function clansRaidingAlone(state) {
  if (!state.neighbors.skarn.nation || !state.neighbors.skarn.known || !skarnAtPeace(state) || clansQuiet(state) || passHeld(state)) return 0;
  return clans(state).warriors >= CLAN_RAID_MIN ? clans(state).warriors : 0;
}

// The chance each season that the clans raid on their own.
export function clanRaidChance(state) {
  return Math.min(0.3, clansRaidingAlone(state) / 80);
}

// Everyone the Skarn could send against the village.
export function skarnStrength(state) {
  const nat = state.neighbors.skarn.nation;
  return (nat ? nat.warriors : 0) + clansMarching(state);
}

// Each spring the clans gather toward what the village draws: they come
// quickly, and drift home more slowly when there is less to take.
// Returns report lines.
export function clansYear(state) {
  const c = clans(state);
  const target = clanTarget(state);
  const before = c.warriors;
  // There are always more in the hills: those who fell are replaced by spring.
  if (target > c.warriors) c.warriors = target;
  else if (target < c.warriors) c.warriors -= Math.max(1, Math.ceil((c.warriors - target) / 4));
  c.warriors = Math.max(0, Math.min(Math.round(CLANS_MAX * raidScale(state)), c.warriors));
  if (!state.neighbors.skarn.known) return [];
  if (c.warriors >= 3 && !c.arrived) {
    c.arrived = true;
    return [`Hill clans from the east have come down to the Skarn: about ${c.warriors} warriors, drawn by the size and stores of ${state.campName}. They will march with the Skarn. Gifts of goods could keep them home; see the Neighbors screen.`];
  }
  if (c.warriors >= 3 && !clansQuiet(state)) {
    return [`About ${c.warriors} hill clansmen would march with the Skarn${c.warriors > before ? ', more than last year' : ''}.`];
  }
  if (c.arrived && c.warriors < 3) {
    c.arrived = false;
    return ['The hill clans have gone home to the east. There is too little here to tempt them.'];
  }
  return [];
}

// When Skarn bands lose warriors, clansmen fall in proportion to their share.
// Returns how many of the fallen were clansmen.
export function clanLosses(state, fallen) {
  const c = clans(state);
  const marching = clansMarching(state);
  const nat = state.neighbors.skarn.nation;
  const total = marching + (nat ? nat.warriors : 0);
  if (!marching || !total || fallen <= 0) return 0;
  const lost = Math.min(c.warriors, Math.round(fallen * marching / total));
  c.warriors -= lost;
  return lost;
}

export function clanGiftCost(state) {
  return Math.max(CLAN_GIFT_MIN, clans(state).warriors * CLAN_GIFT_PER);
}

export function clanGiftBlocker(state) {
  const c = clans(state);
  if (!state.neighbors.skarn.nation || !state.neighbors.skarn.known) return 'No hill clans have come to the valley.';
  if (c.warriors < 3) return 'Too few hill clansmen have come to be worth a gift.';
  if (skarnAtPeace(state) && c.warriors < CLAN_RAID_MIN) return 'While the Skarn are at peace with you, the clans are too few to trouble you.';
  if (clansQuiet(state)) return `The clans are keeping to their hills for ${c.quietUntil - state.turn} more ${c.quietUntil - state.turn === 1 ? 'season' : 'seasons'}.`;
  const cost = clanGiftCost(state);
  if ((state.resources.goods || 0) < cost) return `The clan chiefs would want ${cost} goods, and you have ${state.resources.goods || 0}.`;
  return null;
}

// Gifts to the clan chiefs: half the clansmen go home, and the rest keep out
// of the Skarn's wars for two years. Returns { error } or { message }.
export function giftClans(state) {
  const why = clanGiftBlocker(state);
  if (why) return { error: why };
  const c = clans(state);
  const cost = clanGiftCost(state);
  state.resources.goods -= cost;
  c.warriors = Math.ceil(c.warriors / 2);
  c.quietUntil = state.turn + CLAN_GIFT_SEASONS;
  return { message: `You sent ${cost} goods to the hill clan chiefs. Half their warriors went home, and the rest will keep away from your village until Year ${year(state) + CLAN_GIFT_SEASONS / 4}.` };
}

// One line for the Neighbors screen and the war chief.
export function clansLine(state) {
  const c = clans(state);
  if (!state.neighbors.skarn.nation || !state.neighbors.skarn.known || c.warriors < 3) return '';
  if (clansQuiet(state)) return `About ${c.warriors} hill clansmen live among the Skarn, but your gifts keep them away from your village for ${c.quietUntil - state.turn} more ${c.quietUntil - state.turn === 1 ? 'season' : 'seasons'}.`;
  if (skarnAtPeace(state)) return `About ${c.warriors} hill clansmen have come to the valley, drawn by your village's size and stores. The Skarn's peace does not bind them: they raid on their own. Smaller stores would tempt fewer; gifts of goods would keep them home.`;
  return `About ${c.warriors} hill clansmen would march with the Skarn, drawn by your village's size and stores. Smaller stores would tempt fewer; gifts of goods would keep them home.`;
}
