// Sieges. A Skarn nation too weak to storm a walled village, but strong
// enough to hem it in, surrounds it instead. While the siege lasts no one
// works outside the walls; the besiegers starve a little each season and
// leave when their supplies run out. The player can wait, pay them, or
// sally out and fight them in the open.

import { living, canFight, inVillage } from './state.js';
import { alliedHelpers, skarnLosses, helpersText } from './nations.js';
import { changeRelation } from './neighbors.js';
import { createBattle, fighterStrength, foeStrengthFor } from './battle.js';
import { randomInt } from './rng.js';

// Work that cannot be done while the village is besieged.
export const OUTSIDE_TASKS = ['hunt', 'forage', 'farm', 'wood', 'quarry', 'scout'];

export function besieged(state) {
  return Boolean(state.siege);
}

function hasWalls(state) {
  return state.buildings.palisade > 0 || state.buildings.stoneWall > 0;
}

// The Skarn size up the village by what its fighters are worth, not just
// how many there are, and by its walls. They storm a village they think they
// can take, lay siege to one whose walls they cannot, and otherwise wait and
// grow. Walls count for this much more when they weigh an assault.
export const COVER_WEIGHT = { none: 1, palisade: 1.5, wall: 1.9 };
export const STORM_RATIO = 0.85; // Storm when the band is worth this much of the walled defense.
export const SIEGE_RATIO = 0.9; // Besiege when it is worth this much of the fighters in the open.

export function villageDefense(state) {
  return living(state).filter(canFight).reduce((sum, p) => sum + fighterStrength(state, p), 0);
}

export function coverWeight(state) {
  if (state.buildings.stoneWall > 0) return COVER_WEIGHT.wall;
  if (state.buildings.palisade > 0) return COVER_WEIGHT.palisade;
  return COVER_WEIGHT.none;
}

// What a Skarn band of this size is worth in battle.
export function bandPower(state, band) {
  return band * foeStrengthFor(state, { from: 'skarn' }, 'defend');
}

// 'storm', 'siege', or 'wait'.
export function skarnApproach(state, band) {
  const power = bandPower(state, band);
  const defense = villageDefense(state);
  if (power >= defense * coverWeight(state) * STORM_RATIO) return 'storm';
  if (hasWalls(state) && inVillage(state) && power >= defense * SIEGE_RATIO) return 'siege';
  return 'wait';
}

export function startSiege(state, raiders) {
  state.siege = { raiders, supplies: randomInt(state, 3, 5), started: state.turn };
  return `The Skarn have surrounded ${state.campName} with about ${raiders} warriors. They will not storm the walls, but while they stay no one can hunt, forage, farm, cut wood or stone, or scout, and nothing comes home from your other settlements. You can wait them out, pay them to leave, or sally out and fight them in the open. See the Report screen.`;
}

export function ransom(state) {
  return state.siege ? state.siege.raiders * 3 : 0;
}

// The battle a sally would bring: in the open, with no walls to hide behind.
export function sallyEvent(state) {
  return { type: 'raid', raiders: state.siege.raiders, warned: true, from: 'skarn', sally: true };
}

// Returns { error } or { message }.
export function sallyOut(state) {
  if (!state.siege) return { error: 'There is no siege to break.' };
  if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
  if (!living(state).some(canFight)) return { error: 'No one is fit to fight.' };
  state.pendingEvent = sallyEvent(state);
  state.pendingEvent.battle = createBattle(state, state.pendingEvent);
  return { message: 'Your fighters are gathering at the gate to sally out. Choose who goes and where they stand.' };
}

export function ransomGoods(state) {
  return state.siege ? Math.ceil(state.siege.raiders * 1.5) : 0;
}

// Pays the besiegers to leave, in food or goods.
export function payBesiegers(state, { goods = false } = {}) {
  if (!state.siege) return { error: 'There is no siege.' };
  const cost = goods ? ransomGoods(state) : ransom(state);
  const kind = goods ? 'goods' : 'food';
  if ((state.resources[kind] || 0) < cost) return { error: `The Skarn want ${cost} ${kind} to leave, and you have ${state.resources[kind] || 0}.` };
  state.resources[kind] -= cost;
  state.siege = null;
  const sk = state.neighbors.skarn;
  sk.truceUntil = Math.max(sk.truceUntil, state.turn + 4);
  changeRelation(state, 'skarn', 3);
  return { message: `You paid the Skarn ${cost} ${kind}. They lifted the siege and promised a year without raids.` };
}

// Runs at the end of each besieged season. Returns report lines.
export function siegeSeason(state) {
  const s = state.siege;
  if (!s) return [];
  const lines = [];
  const hungry = Math.max(1, Math.ceil(s.raiders * 0.1));
  const harassed = Math.round(alliedHelpers(state) * 0.4);
  const lost = Math.min(s.raiders, hungry + harassed);
  s.raiders -= lost;
  skarnLosses(state, lost);
  s.supplies -= 1;
  if (harassed > 0) lines.push(`${helpersText(state)} harried the besiegers' camp.`);
  if (s.raiders < 4 || s.supplies <= 0) {
    state.siege = null;
    lines.push(`The Skarn ran short of food and lifted the siege. ${state.campName} is free.`);
    return lines;
  }
  lines.push(`The siege goes on: about ${s.raiders} Skarn remain outside the walls, and ${lost} ${lost === 1 ? 'has' : 'have'} fallen to hunger or harassment this season. No one could work outside.`);
  return lines;
}
