// Laws a village adopts once it knows Oral law. Each law has two options
// with real trade-offs; until one is chosen, the village keeps to custom.
// The rest of the engine asks this module how the laws shift its rules.

import {
  LAWS, LAW_CHANGE_GAP, NEIGHBORS, KNOWLEDGE,
} from './data.js';
import { inVillage, hasKnowledge, living } from './state.js';
import { clamp } from './util.js';

export function lawsAvailable(state) {
  return inVillage(state) && hasKnowledge(state, 'oralLaw');
}

// Whether this law can be made yet: some need a later discovery.
export function lawAvailable(state, law) {
  return lawsAvailable(state) && Boolean(LAWS[law]) && (!LAWS[law].requires || hasKnowledge(state, LAWS[law].requires));
}

// The chosen option for a law, or null for custom.
export function lawIs(state, law, option) {
  return Boolean(state.laws && state.laws[law] === option);
}

export function seasonsUntilChange(state, law) {
  const last = state.lawChanged && state.lawChanged[law];
  if (last === undefined || last === null) return 0;
  return Math.max(0, last + lawGap(state) - state.turn);
}

// Seasons before a law can change again: a year, two seasons under a crown,
// two years under an assembly.
export function lawGap(state) {
  if (hasKnowledge(state, 'crown')) return 2;
  if (hasKnowledge(state, 'assembly')) return 8;
  return LAW_CHANGE_GAP;
}

export function lawBlocker(state, law, option) {
  if (!lawsAvailable(state)) return 'A village must know Oral law before it can make laws.';
  if (!LAWS[law]) return 'Unknown law.';
  if (!lawAvailable(state, law)) return `A law on ${LAWS[law].name.toLowerCase()} needs ${KNOWLEDGE[LAWS[law].requires].name} first.`;
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
    + (lawIs(state, 'strangers', 'closed') ? 3 : 0)
    - (lawIs(state, 'inheritance', 'eldest') ? 2 : 0) + (lawIs(state, 'inheritance', 'shared') ? 3 : 0)
    + (lawIs(state, 'worship', 'oneFaith') ? 2 : 0)
    - (lawIs(state, 'taxes', 'light') ? 2 : 0) - (lawIs(state, 'taxes', 'heavy') ? 5 : 0);
}

// What the laws do to a settlement's loyalty: [text, change] pairs.
export function lawLoyalty(state) {
  const out = [];
  if (lawIs(state, 'taxes', 'light')) out.push(['light taxes', -5]);
  if (lawIs(state, 'taxes', 'heavy')) out.push(['heavy taxes', -12]);
  if (lawIs(state, 'worship', 'oneFaith')) out.push(['one faith for the whole nation', 5]);
  if (lawIs(state, 'inheritance', 'shared')) out.push(['inheritance shared among all', 3]);
  return out;
}

// People for each coin of tax a season: 20 under light taxes, 10 under heavy.
export function taxRate(state) {
  if (lawIs(state, 'taxes', 'heavy')) return 10;
  if (lawIs(state, 'taxes', 'light')) return 20;
  return 0;
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
