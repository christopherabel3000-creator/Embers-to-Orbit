// The nation's settlements: their roles, groups, governors, loyalty, and
// what each brings in. This file only reckons; it changes nothing, and it
// imports little, so the season, the nations, and the advisors can all read
// it. The player's decisions about settlements, and each season's running of
// them, are in settlements.js.

import { PLACES } from './data.js';
import { hasKnowledge, seasonIndex } from './state.js';
import { hasTradition } from './legacy.js';
import { listWords } from './util.js';

// What each settlement can be. rate: what each worker at the role brings in
// a season, beyond feeding the settlement. skill: the governor's skill that
// matters. fit: the place's bonus that suits the role.
export const ROLES = {
  farming: {
    name: 'Farming town', kind: 'food', rate: 1.8, skill: 'foraging', works: 'fields and granaries',
    about: 'Sends home food: farmers and foragers who grow far more than the town eats. Half as much in winter.',
  },
  timber: {
    name: 'Timber town', kind: 'wood', rate: 1.45, skill: 'building', works: 'sawpits',
    about: 'Sends home wood, for the capital\'s fires and buildings.',
  },
  mining: {
    name: 'Mining town', kind: 'stone', rate: 1.1, skill: 'building', works: 'quarry works',
    about: 'Sends home stone, cut from the land around it.',
  },
  market: {
    name: 'Market town', kind: 'goods', rate: 0.55, skill: 'building', works: 'a market hall', requires: 'weaving',
    about: 'Sends home goods: cloth, pots, and tools made and traded there.',
  },
  fortress: {
    name: 'Fortress', kind: null, rate: 0, skill: 'hunting', works: 'barracks',
    about: 'Sends home nothing, but keeps a strong garrison. Its soldiers meet raiders on the road to the capital, and the Skarn skirmish your people less often.',
  },
};
export const ROLE_ORDER = Object.keys(ROLES);

// How much of what a settlement brings in is sent home, how fast it grows on
// what it keeps, and how its people feel about it.
// Growth is each spring: its own children, and newcomers drawn by what it keeps.
export const DEMANDS = {
  light: { name: 'Light', share: 0.4, growth: 0.12, loyalty: 10, about: 'Sends home 40 percent of what it brings in, and grows quickly on the rest. Its people like it.' },
  normal: { name: 'Normal', share: 0.7, growth: 0.09, loyalty: 0, about: 'Sends home 70 percent of what it brings in, and grows steadily.' },
  heavy: { name: 'Heavy', share: 1, growth: 0.05, loyalty: -10, about: 'Sends home all it brings in, and grows slowly. Its people resent it.' },
};
export const DEMAND_ORDER = Object.keys(DEMANDS);

// What the player can push a settlement's governor toward.
export const TOWN_PRIORITIES = {
  defense: { name: 'Defense', about: 'How many of its workers stand guard: 5, 10, or 20 percent.' },
  learning: { name: 'Learning', about: 'How many of its workers study for the nation: none, 4, or 8 percent.' },
};
const GUARD_SHARE = { low: 0.05, normal: 0.1, high: 0.2 };
const FORTRESS_GUARDS = 0.4;
const STUDY_SHARE = { low: 0, normal: 0.04, high: 0.08 };

export const WORKER_SHARE = 0.72; // The rest are children and elders.
export const HOME_ROOM = 8;
export const WORKS_BONUS = 0.15; // Each level of a role's works.
export const UNROADED_LOSS = 0.15; // Lost on the way from a settlement 2 or more places off.
export const LOYALTY_START = 70;
export const LOYALTY_BASE = 55; // Where loyalty settles with nothing to move it.

export function settlementById(state, id) {
  return (state.settlements || []).find((t) => t.id === Number(id)) || null;
}

// ----- The land -----

// How well a place suits a role: a tenth better for each point of the
// place's matching bonus. A timber or mining town with nothing to work
// brings in half, and a farming town on bare land four fifths.
export function landFit(role, placeId) {
  const p = PLACES[placeId];
  const b = p.bonus || {};
  if (role === 'farming') {
    const best = Math.max(b.hunt || 0, b.forage || 0);
    if (!p.tasks.includes('hunt') && !p.tasks.includes('forage')) return 0.8;
    return 1 + 0.1 * Math.max(0, best);
  }
  if (role === 'timber') return p.tasks.includes('wood') ? 1 + 0.1 * Math.max(0, b.wood || 0) : 0.5;
  if (role === 'mining') return p.tasks.includes('quarry') ? 1 + 0.1 * Math.max(0, b.quarry || 0) : 0.5;
  return 1;
}

// The role a place suits best: stone, wood, or food, whichever its land is
// richest in.
export function bestRole(placeId) {
  const b = PLACES[placeId].bonus || {};
  const best = [['mining', b.quarry || 0], ['timber', b.wood || 0], ['farming', Math.max(b.hunt || 0, b.forage || 0)]]
    .sort((x, y) => y[1] - x[1])[0];
  return best[1] > 0 ? best[0] : 'farming';
}

export function roleAvailable(state, role) {
  return Boolean(ROLES[role]) && (!ROLES[role].requires || hasKnowledge(state, ROLES[role].requires));
}

// ----- Roads -----

// Roads are built in the capital's queue and reach the settlements in the
// order they were founded.
export function hasRoad(state, t) {
  return (state.settlements || []).indexOf(t) < (state.buildings.road || 0);
}

export function nextUnroaded(state) {
  return (state.settlements || [])[state.buildings.road || 0] || null;
}

export function far(t) {
  return PLACES[t.place].distance >= 2;
}

// ----- Groups -----

// A settlement's people by what they do this season.
export function townGroups(state, t) {
  const pop = t.population;
  const workers = Math.round(pop * WORKER_SHARE);
  const pr = t.priorities || {};
  let guardShare = GUARD_SHARE[pr.defense || 'normal'];
  if (t.role === 'fortress') guardShare = Math.max(FORTRESS_GUARDS, guardShare);
  const guards = Math.min(workers, Math.round(workers * guardShare));
  const schools = hasKnowledge(state, 'schools') ? 1.5 : 1;
  const scholars = Math.min(workers - guards, Math.round(workers * STUDY_SHARE[pr.learning || 'normal'] * schools));
  const healers = pop >= 12 ? 1 + Math.floor(pop / 40) : 0;
  const builders = t.project ? Math.max(1, Math.round(workers * 0.1)) : 0;
  const makers = Math.max(0, workers - guards - scholars - healers - builders);
  return {
    young: pop - workers, workers, guards, scholars, healers, builders, makers,
  };
}

// "Farmers and foragers", "Woodcutters", ... for the workers at the role.
export const MAKER_NAMES = {
  farming: 'Farmers and foragers', timber: 'Woodcutters', mining: 'Quarriers', market: 'Crafters and traders', fortress: 'Farmers who feed the garrison',
};

// ----- Governors -----

export function governorSkill(t) {
  return ROLES[t.role].skill;
}

// A novice governor gets 85 percent from a settlement; a master of both the
// role's skill and learning gets 130.
export function governorFactor(t) {
  const g = t.governor;
  if (!g) return 0.85;
  return 0.85 + 0.06 * (g.skills[governorSkill(t)] || 0) + 0.03 * (g.skills.learning || 0);
}

// ----- Loyalty -----

export const LOYALTY_LEVELS = [
  [75, 'devoted', 1.1],
  [55, 'loyal', 1],
  [40, 'restless', 0.85],
  [20, 'discontent', 0.6],
  [0, 'defiant', 0.6],
];

export function loyaltyWord(loyalty) {
  return LOYALTY_LEVELS.find(([min]) => loyalty >= min)[1];
}

export function loyaltyFactor(loyalty) {
  return LOYALTY_LEVELS.find(([min]) => loyalty >= min)[2];
}

// Seasons a settlement goes without aid before its people feel neglected.
export const NEGLECT_AFTER = 8;

// The loyalty a settlement drifts toward, and why. Returns { target, reasons },
// where each reason is [text, change].
export function loyaltyTarget(state, t) {
  const reasons = [];
  const add = (text, change) => { if (change) reasons.push([text, change]); };
  const demands = DEMANDS[t.demands] || DEMANDS.normal;
  add(`${demands.name.toLowerCase()} demands`, demands.loyalty);
  const learning = t.governor ? t.governor.skills.learning : 0;
  add(`${t.governor ? t.governor.name : 'no governor'}'s ${learning > 2 ? 'wisdom' : 'inexperience'} as governor`, 2 * (learning - 2));
  add('their hall', t.buildings.hall ? 5 : 0);
  add('a road to the capital', hasRoad(state, t) ? 5 : 0);
  add('being far from the capital', PLACES[t.place].distance >= 3 ? -3 : 0);
  const without = state.turn - (t.lastAid ?? t.founded);
  if (without > NEGLECT_AFTER) add(`no aid from the capital in ${Math.floor(without / 4)} years`, -Math.min(15, 3 * Math.floor((without - NEGLECT_AFTER) / 4) + 3));
  if (t.harriedAt != null && state.turn - t.harriedAt < 4) add('settlers killed by Skarn skirmishers this past year', -5);
  const target = Math.max(0, Math.min(100, LOYALTY_BASE + reasons.reduce((sum, [, n]) => sum + n, 0)));
  return { target, reasons };
}

// "light demands (+10), a road to the capital (+5), ..."
export function loyaltyReasonsText(state, t, { against = false } = {}) {
  const reasons = loyaltyTarget(state, t).reasons.filter(([, n]) => !against || n < 0);
  if (!reasons.length) return 'nothing out of the ordinary';
  return listWords(reasons.map(([text, n]) => `${text} (${n > 0 ? 'plus' : 'minus'} ${Math.abs(n)})`));
}

// Whether a settlement is keeping everything for itself this year.
export function keepingAll(state, t) {
  return t.keepUntil != null && state.turn < t.keepUntil;
}

// ----- What a settlement brings in -----

// What a settlement brings in this season at its role, before any is kept.
export function townOutput(state, t) {
  const role = ROLES[t.role];
  if (!role.kind) return 0;
  const g = townGroups(state, t);
  let amount = g.makers * role.rate * landFit(t.role, t.place) * governorFactor(t)
    * loyaltyFactor(t.loyalty) * (1 + WORKS_BONUS * worksLevel(t));
  if (role.kind === 'food' && seasonIndex(state) === 3) amount *= 0.5; // Lean winters there too.
  if (t.role === 'farming' && hasKnowledge(state, 'astronomy')) amount *= 1.1;
  return amount;
}

// What it sends home this season: { kind, amount, lost }.
export function expectedShipment(state, t) {
  const kind = ROLES[t.role].kind;
  if (!kind || keepingAll(state, t)) return { kind, amount: 0, lost: 0 };
  const sent = townOutput(state, t) * (DEMANDS[t.demands] || DEMANDS.normal).share;
  const loss = !hasRoad(state, t) && far(t) ? UNROADED_LOSS : 0;
  return { kind, amount: Math.round(sent * (1 - loss)), lost: Math.round(sent * loss) };
}

export function worksLevel(t) {
  return (t.buildings.works && t.buildings.works[t.role]) || 0;
}

// Study points from every settlement's scholars, for the shared queue.
export function townStudy(state) {
  let points = 0;
  for (const t of state.settlements || []) {
    const per = 2 + 1.5 + (hasTradition(state, 'learning') ? 1 : 0) + (hasKnowledge(state, 'elders') ? 1 : 0);
    points += townGroups(state, t).scholars * per * (hasKnowledge(state, 'writing') ? 1.25 : 1);
  }
  return points;
}

// ----- Fortresses -----

export function fortresses(state) {
  return (state.settlements || []).filter((t) => t.role === 'fortress');
}

// Soldiers a fortress sends to meet raiders on the road to the capital:
// half its garrison, more with barracks.
export function garrisonHelp(state, t) {
  return t.role === 'fortress' ? Math.round(townGroups(state, t).guards * 0.5 * (1 + WORKS_BONUS * worksLevel(t))) : 0;
}

export function fortressHelp(state) {
  return fortresses(state).reduce((sum, t) => sum + garrisonHelp(state, t), 0);
}

// Skarn skirmishes on the capital's workers are 15 percent less likely for
// each fortress, down to 55 percent.
export function fortressWatch(state) {
  return Math.max(0.55, 1 - 0.15 * fortresses(state).length);
}

// The whole nation's people: the capital and every settlement.
export function nationPopulation(state, capitalCount) {
  return capitalCount + (state.settlements || []).reduce((sum, t) => sum + t.population, 0);
}
