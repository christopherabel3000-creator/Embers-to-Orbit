// Laws a village adopts once it knows Oral law. Each law has two options
// with real trade-offs; until one is chosen, the village keeps to custom.
// The rest of the engine asks this module how the laws shift its rules.

import { LAWS, LAW_CHANGE_GAP, NEIGHBORS } from './data.js';
import { inVillage, hasKnowledge, living } from './state.js';
import { clamp } from './util.js';

export function lawsAvailable(state) {
  return inVillage(state) && hasKnowledge(state, 'oralLaw');
}

// The chosen option for a law, or null for custom.
export function lawIs(state, law, option) {
  return Boolean(state.laws && state.laws[law] === option);
}

export function seasonsUntilChange(state, law) {
  const last = state.lawChanged && state.lawChanged[law];
  if (last === undefined || last === null) return 0;
  return Math.max(0, last + LAW_CHANGE_GAP - state.turn);
}

export function lawBlocker(state, law, option) {
  if (!lawsAvailable(state)) return 'A village must know Oral law before it can make laws.';
  if (!LAWS[law]) return 'Unknown law.';
  if (option !== null && !LAWS[law].options[option]) return 'Unknown choice for that law.';
  if ((state.laws[law] || null) === option) return 'That is already the law.';
  const wait = seasonsUntilChange(state, law);
  if (wait > 0) return `The law on ${LAWS[law].name.toLowerCase()} changed recently. It can change again in ${wait} ${wait === 1 ? 'season' : 'seasons'}.`;
  return null;
}

// Returns { error } or { message }. option null returns to custom.
export function setLaw(state, law, option) {
  const why = lawBlocker(state, law, option);
  if (why) return { error: why };
  state.laws[law] = option;
  state.lawChanged = state.lawChanged || {};
  state.lawChanged[law] = state.turn;
  const hall = state.buildings.meetingHall > 0;
  if (!hall) for (const p of living(state)) p.morale = clamp(p.morale - 5);
  const what = option ? `${LAWS[law].options[option].name}. ${LAWS[law].options[option].effect}` : 'back to custom.';
  return { message: `New law on ${LAWS[law].name.toLowerCase()}: ${what}${hall ? '' : ' Without a meeting hall to talk it through, people grumbled at the change.'}` };
}

// ----- How the laws shift the rules -----

// Where spirits settle, relative to usual.
export function lawSettle(state) {
  return (lawIs(state, 'food', 'equal') ? 5 : 0) - (lawIs(state, 'food', 'byWork') ? 5 : 0) - (lawIs(state, 'justice', 'harsh') ? 3 : 0)
    + (lawIs(state, 'strangers', 'closed') ? 3 : 0);
}

// A multiplier on everyone's work.
export function lawWork(state) {
  if (!state) return 1;
  return (lawIs(state, 'food', 'byWork') ? 1.05 : 1) * (lawIs(state, 'service', 'militia') ? 0.97 : 1);
}

// A multiplier on a fighter's strength.
export function lawFight(state, person) {
  if (lawIs(state, 'service', 'militia')) return 1.15;
  if (lawIs(state, 'service', 'guilds') && person.task !== 'guard') return 0.9;
  return 1;
}

export function lawGuilds(state) {
  return state ? lawIs(state, 'service', 'guilds') : false;
}

// How each people's attitude shifts with your laws.
const LAW_REGARD = {
  velari: { 'strangers.open': 5, 'strangers.closed': -3, 'justice.mercy': 3, 'justice.harsh': -3 },
  tellani: { 'strangers.closed': -3 },
  skarn: { 'justice.mercy': -3, 'justice.harsh': 5 },
};

export function lawAttitudes(state, neighborId) {
  const regard = LAW_REGARD[neighborId] || {};
  return Object.entries(regard)
    .filter(([key]) => {
      const [law, option] = key.split('.');
      return lawIs(state, law, option);
    })
    .map(([key, shift]) => {
      const [law, option] = key.split('.');
      return { law, option, shift, text: shift > 0
        ? `The ${NEIGHBORS[neighborId].title} approve of your law: ${LAWS[law].options[option].name.toLowerCase()} (plus ${shift}).`
        : `The ${NEIGHBORS[neighborId].title} dislike your law: ${LAWS[law].options[option].name.toLowerCase()} (minus ${-shift}).` };
    });
}

export function lawAttitudeShift(state, neighborId) {
  return lawAttitudes(state, neighborId).reduce((sum, a) => sum + a.shift, 0);
}
