// Traditions and reputation. Nothing here is chosen from a menu: the camp
// keeps count of what it actually does (its deeds), repeated deeds become
// lasting traditions, and the neighbors judge the camp by its record.

import { NEIGHBORS } from './data.js';
import { lawAttitudeShift, lawAttitudes } from './laws.js';
import { listWords } from './util.js';

export const DEED_NAMES = {
  battlesWon: 'battles won',
  hunterSeasons: 'seasons of hunting',
  harvests: 'harvests brought in',
  welcomed: 'strangers taken in by your choice',
  turnedAway: 'strangers turned away',
  gifts: 'gifts and help given',
  trades: 'trades made',
  discoveries: 'discoveries made',
  built: 'buildings finished',
  hid: 'raids hidden from',
  attacks: 'attacks launched',
  feasts: 'feasts held',
};

export function emptyDeeds() {
  return Object.fromEntries(Object.keys(DEED_NAMES).map((k) => [k, 0]));
}

export function recordDeed(state, deed, amount = 1) {
  if (!state.deeds) state.deeds = emptyDeeds();
  state.deeds[deed] = (state.deeds[deed] || 0) + amount;
}

// Each tradition grows from one kind of deed.
export const TRADITIONS = {
  warrior: {
    name: 'Warrior tradition',
    deed: 'battlesWon',
    need: 3,
    effect: 'Your fighters are stronger in every battle.',
    story: 'Victory after victory has taught your people to stand and fight together.',
  },
  hunting: {
    name: 'Hunting lore',
    deed: 'hunterSeasons',
    need: 80,
    effect: 'Every hunter brings back 1 more food.',
    story: 'Generations of hunting knowledge are passed from hand to hand around the fire.',
  },
  seasons: {
    name: 'Rhythm of the seasons',
    deed: 'harvests',
    need: 3,
    effect: 'Every plot in the fields yields 1 more food.',
    story: 'Planting and harvest have become the heartbeat of the year.',
  },
  hearth: {
    name: 'Open hearth',
    deed: 'welcomed',
    need: 3,
    effect: 'Wanderers seek out your camp more often, and newcomers settle in happily.',
    story: 'Word has spread that strangers find a warm welcome at your fire.',
  },
  generous: {
    name: 'Generous hands',
    deed: 'gifts',
    need: 5,
    effect: 'Gifts to your neighbors win half again as much goodwill.',
    story: 'Your people give freely, and are known for it.',
  },
  trading: {
    name: 'Trading ways',
    deed: 'trades',
    need: 5,
    effect: 'Every trade with your neighbors brings 3 more food or wood.',
    story: 'Your people have learned to haggle with the best of them.',
  },
  learning: {
    name: 'Love of learning',
    deed: 'discoveries',
    need: 4,
    effect: 'Everyone who studies adds 1 more study point each season.',
    story: 'Questions are prized in your camp, and the young are taught to ask them.',
  },
  builders: {
    name: 'Master builders',
    deed: 'built',
    need: 8,
    effect: 'Every builder gets 1 more work done each season.',
    story: 'Your people take pride in raising things that last.',
  },
  feasting: {
    name: 'Feasting days',
    deed: 'feasts',
    need: 4,
    effect: 'Feasts lift spirits even higher, and guests leave twice as pleased.',
    story: 'The feast days have become the bright marks of the year, remembered and looked forward to.',
  },
  hidden: {
    name: 'Hidden ways',
    deed: 'hid',
    need: 3,
    effect: 'When you hide from raiders, they find only half as much.',
    story: 'Your people have learned to vanish into the trees, and to take their stores with them.',
  },
};

export const TRADITION_ORDER = Object.keys(TRADITIONS);

export function hasTradition(state, id) {
  return Boolean(state.traditions && state.traditions.includes(id));
}

// Adds any traditions the camp has now earned. Returns report lines.
export function checkTraditions(state) {
  if (!state.traditions) state.traditions = [];
  const lines = [];
  for (const id of TRADITION_ORDER) {
    const t = TRADITIONS[id];
    if (hasTradition(state, id)) continue;
    if ((state.deeds[t.deed] || 0) >= t.need) {
      state.traditions.push(id);
      lines.push(`A new tradition: ${t.name}. ${t.story} ${t.effect}`);
    }
  }
  return lines;
}

// Traditions not yet earned, with how close the camp is.
export function traditionProgress(state) {
  return TRADITION_ORDER
    .filter((id) => !hasTradition(state, id))
    .map((id) => {
      const t = TRADITIONS[id];
      const have = Math.min(t.need, state.deeds[t.deed] || 0);
      return { id, name: t.name, have, need: t.need, deed: DEED_NAMES[t.deed] };
    })
    .filter((p) => p.have > 0)
    .sort((a, b) => b.have / b.need - a.have / a.need);
}

// ----- Reputation -----

// Four things the peoples of the valley say about you, each from 0 to 30.
export function reputation(state) {
  const d = state.deeds || emptyDeeds();
  const cap = (v) => Math.max(0, Math.min(30, Math.round(v)));
  return {
    fierce: cap(d.battlesWon * 3 + d.attacks * 4),
    generous: cap(d.gifts * 2),
    welcoming: cap(d.welcomed * 3 - d.turnedAway * 3),
    traders: cap(d.trades * 2),
  };
}

export const REPUTATION_WORDS = {
  fierce: 'fierce fighters',
  generous: 'generous friends',
  welcoming: 'welcoming to strangers',
  traders: 'honest traders',
};

// How much each people cares about each part of your name.
const REGARD = {
  velari: { generous: 0.5, welcoming: 0.3, fierce: -0.2 },
  tellani: { traders: 0.5, generous: 0.2 },
  skarn: { fierce: 0.6, generous: -0.15 },
};

// How your name moves a people's attitude toward you, by part.
export function reputationEffects(state, neighborId) {
  const rep = reputation(state);
  const regard = REGARD[neighborId] || {};
  return Object.entries(regard)
    .map(([part, weight]) => ({ part, shift: Math.round(rep[part] * weight) }))
    .filter((e) => e.shift !== 0);
}

// The attitude a people drifts toward: their nature plus your reputation.
export function effectiveBaseline(state, neighborId) {
  // Once they are a nation, trust and a trade pact shift it too.
  const nat = state.neighbors && state.neighbors[neighborId] && state.neighbors[neighborId].nation;
  const trust = nat ? Math.round((nat.trust - 50) / 5) + (nat.treaties.trade ? 5 : 0) : 0;
  return NEIGHBORS[neighborId].baseline + trust + lawAttitudeShift(state, neighborId)
    + reputationEffects(state, neighborId).reduce((sum, e) => sum + e.shift, 0);
}

// Plain words for the Neighbors screen.
export function reputationSummary(state) {
  const rep = reputation(state);
  const parts = Object.entries(rep).filter(([, v]) => v >= 6).sort((a, b) => b[1] - a[1]);
  if (!parts.length) return 'The peoples of the valley do not know much about you yet.';
  const words = parts.map(([k, v]) => `${v >= 20 ? 'very ' : ''}${REPUTATION_WORDS[k]}`);
  return `Across the valley, your people are known as ${listWords(words)}.`;
}

export function attitudeLines(state, neighborId) {
  const name = NEIGHBORS[neighborId].title;
  return reputationEffects(state, neighborId).map(({ part, shift }) => (shift > 0
    ? `The ${name} think well of you for being ${REPUTATION_WORDS[part]} (plus ${shift}).`
    : `The ${name} think less of you for being ${REPUTATION_WORDS[part]} (minus ${-shift}).`))
    .concat(lawAttitudes(state, neighborId).map((a) => a.text));
}
