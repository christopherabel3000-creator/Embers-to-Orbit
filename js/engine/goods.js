// What a village does with its goods besides trade and building: comforts
// for its people, arms for its guards, and hiring masters and sell-swords.

import { SKILLS } from './data.js';
import {
  living, inVillage, taskAvailable,
} from './state.js';
import { newcomer } from './village.js';
import { randomInt } from './rng.js';

export const COMFORTS_PER = 6; // One goods a season for every this many people.
export const COMFORTS_SETTLE = 4; // How much higher spirits settle with comforts.
export const COMFORTS_EXPECTED_AT = 30; // A village this big misses them.
export const ARMS_BONUS = 1.2; // Armed guards fight this much harder.
export const HIRE_MASTER_COST = 25;
export const HIRE_GAP = 4; // Seasons between hiring masters.
export const SWORDS_COST = 20;
export const SWORDS_COUNT = 6;
export const SWORDS_SEASONS = 4;

export function comfortsCost(state) {
  return Math.ceil(living(state).length / COMFORTS_PER);
}

export function armsCost(state) {
  return living(state).filter((p) => p.task === 'guard').length;
}

// Runs each season, before spirits settle. Pays for comforts and arms under
// standing orders. Returns { settle, events, comforts, arms }: events are
// only for what went wrong; comforts and arms are the goods spent, which
// the season report lists with the rest of the upkeep.
export function spendGoods(state) {
  const out = {
    settle: 0, events: [], comforts: 0, arms: 0,
  };
  state.guardsArmed = false;
  if (!inVillage(state)) return out;
  const canCraft = taskAvailable(state, 'craft');
  const cost = comfortsCost(state);
  if (state.orders.comforts && (state.resources.goods || 0) >= cost && cost > 0) {
    state.resources.goods -= cost;
    out.settle += COMFORTS_SETTLE;
    out.comforts = cost;
  } else if (canCraft && living(state).length >= COMFORTS_EXPECTED_AT) {
    out.settle -= 3;
    out.events.push(`A village of ${living(state).length} expects some comforts, and there were none to share out this season. Spirits settle lower.`);
  }
  const arms = armsCost(state);
  if (state.orders.armGuards && arms > 0) {
    if ((state.resources.goods || 0) >= arms) {
      state.resources.goods -= arms;
      state.guardsArmed = true;
      out.arms = arms;
    } else {
      out.events.push(`There were not enough goods to arm the guards this season: ${arms} needed.`);
    }
  }
  return out;
}

// ----- Hiring -----

export function seasonsUntilHire(state) {
  return Math.max(0, (state.lastHire ?? -99) + HIRE_GAP - state.turn);
}

export function hireBlocker(state) {
  if (!inVillage(state)) return 'Only a village can hire from beyond the hills.';
  const wait = seasonsUntilHire(state);
  if (wait > 0) return `Word of your offer is still traveling. You can hire another master in ${wait} ${wait === 1 ? 'season' : 'seasons'}.`;
  if ((state.resources.goods || 0) < HIRE_MASTER_COST) return `Hiring a master takes ${HIRE_MASTER_COST} goods; you have ${state.resources.goods || 0}.`;
  return null;
}

const MASTER_WORDS = {
  hunting: 'hunter', foraging: 'forager', building: 'builder', healing: 'healer', scouting: 'scout', learning: 'scholar',
};

export function hireMaster(state, skill) {
  const why = hireBlocker(state);
  if (why) return { error: why };
  if (!SKILLS.includes(skill)) return { error: 'Choose a skill.' };
  state.resources.goods -= HIRE_MASTER_COST;
  state.lastHire = state.turn;
  const p = newcomer(state, `A master ${MASTER_WORDS[skill]}, hired from beyond the hills.`);
  for (const k of SKILLS) p.skills[k] = Math.min(p.skills[k], 2);
  p.skills[skill] = 4;
  p.age = randomInt(state, 25, 38);
  return { message: `${p.name}, a master ${MASTER_WORDS[skill]}, has come to the village for ${HIRE_MASTER_COST} goods.` };
}

export function swordsActive(state) {
  return (state.swordsUntil ?? -1) > state.turn;
}

export function swordsBlocker(state) {
  if (!inVillage(state)) return 'Only a village can hire sell-swords.';
  if (swordsActive(state)) return `Your sell-swords are already hired, for ${state.swordsUntil - state.turn} more ${state.swordsUntil - state.turn === 1 ? 'season' : 'seasons'}.`;
  if ((state.resources.goods || 0) < SWORDS_COST) return `Sell-swords want ${SWORDS_COST} goods; you have ${state.resources.goods || 0}.`;
  return null;
}

export function hireSwords(state) {
  const why = swordsBlocker(state);
  if (why) return { error: why };
  state.resources.goods -= SWORDS_COST;
  state.swordsUntil = state.turn + SWORDS_SEASONS;
  return { message: `${SWORDS_COUNT} sell-swords from the hills have taken your goods and will guard the roads for a year. They meet raiders before they reach the village, and harry any besiegers.` };
}

// Sell-swords fight alongside allies against raiders and besiegers.
export function swordsHelp(state) {
  return swordsActive(state) ? SWORDS_COUNT : 0;
}

