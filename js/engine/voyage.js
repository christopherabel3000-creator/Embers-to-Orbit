// The end of the Nation era: the first ship sent across the open sea, which
// begins the Age of Discovery. Like becoming a village, the step is the
// player's to take once the nation is ready, and it cannot be undone.

import { living, hasKnowledge, eraAtLeast } from './state.js';
import { hasHarbor } from './realm.js';
import { metGreat } from './great.js';
import { refreshAdvisors } from './advisors.js';
import { isNotable } from './village.js';
import { recordDeed } from './legacy.js';
import { listWords, plural } from './util.js';
import { startFarShore, VOYAGE_CROSSING } from './farShore.js';

export const VOYAGE = {
  capital: 100, // People in the capital.
  settlements: 4,
  nations: 3, // Great nations met.
  crew: 12,
  cost: {
    wood: 120, goods: 60, iron: 30, food: 150,
  },
};

// What the voyage needs, and whether the nation has it: [{ text, done }].
export function voyageChecklist(state) {
  const people = living(state).length;
  const towns = (state.settlements || []).length;
  const met = metGreat(state).length;
  return [
    { text: `a capital of ${VOYAGE.capital} people (it has ${people})`, done: people >= VOYAGE.capital },
    { text: `at least ${VOYAGE.settlements} other settlements (you have ${towns})`, done: towns >= VOYAGE.settlements },
    { text: 'Navigation', done: hasKnowledge(state, 'navigation') },
    { text: 'a port on the coast with its harbor built', done: hasHarbor(state) },
    { text: `contact with ${VOYAGE.nations} great nations (you have met ${met})`, done: met >= VOYAGE.nations },
  ];
}

// What the nation still lacks for the voyage: a list of short phrases.
export function voyageMissing(state) {
  return voyageChecklist(state).filter((x) => !x.done).map((x) => x.text);
}

function costShort(state) {
  return Object.entries(VOYAGE.cost).filter(([k, n]) => (state.resources[k] || 0) < n)
    .map(([k, n]) => `${n - (state.resources[k] || 0)} more ${k}`);
}

export function voyageCostWords() {
  return listWords(Object.entries(VOYAGE.cost).map(([k, n]) => `${n} ${k}`));
}

// Why the voyage cannot be sent now, or null.
export function voyageBlocker(state) {
  if (!eraAtLeast(state, 'nation')) return 'The voyage across the sea comes at the end of the Nation era.';
  if (state.voyage) return 'Your first ship has already sailed.';
  if (state.pendingEvent) return 'Deal with what is happening first.';
  const missing = voyageMissing(state);
  if (missing.length) return `Your nation still needs ${listWords(missing)}.`;
  const short = costShort(state);
  if (short.length) return `Fitting out the ship needs ${listWords(short)}.`;
  return null;
}

// Whether the nation is ready but for the cost: for the milestone notice.
export function voyageReady(state) {
  return eraAtLeast(state, 'nation') && !state.voyage && voyageMissing(state).length === 0;
}

// Sends the first ship across the open sea. Returns { error } or { message }.
export function sendVoyage(state) {
  const why = voyageBlocker(state);
  if (why) return { error: why };
  for (const [k, n] of Object.entries(VOYAGE.cost)) state.resources[k] -= n;
  // The crew: the best scouts who can be spared, led by the best of them.
  const crew = living(state).filter((p) => p.age >= 16 && p.age <= 50 && p.health >= 60 && !p.sick
    && !Object.values(state.advisors).includes(p.id))
    .sort((a, b) => b.skills.scouting - a.skills.scouting).slice(0, VOYAGE.crew);
  const ids = new Set(crew.map((p) => p.id));
  state.people = state.people.filter((p) => !ids.has(p.id));
  refreshAdvisors(state);
  const captain = crew[0];
  state.voyage = {
    sent: state.turn, captain: captain ? captain.name : null, crew: crew.map((p) => ({ ...p, task: 'voyage' })),
  };
  state.era = 'discovery';
  startFarShore(state);
  recordDeed(state, 'wonders');
  const named = crew.filter((p) => isNotable(state, p)).map((p) => p.name);
  return {
    message: `The first ship of ${state.campName} has sailed from the harbor, out of sight of land, across the open sea${captain ? `, with ${captain.name} at the helm` : ''} and ${plural(crew.length - 1, 'more of the crew', 'more of the crew')}${named.length > 1 ? `, among them ${listWords(named.slice(1))}` : ''}. The Age of Discovery has begun. If the sea is kind, they will sight land in ${plural(VOYAGE_CROSSING, 'season', 'seasons')}.`,
  };
}
