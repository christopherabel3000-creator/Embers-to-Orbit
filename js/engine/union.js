// The valley peoples joining your nation. After a long alliance, the Velari
// or the Tellani can become a federated part of it, a settlement of their
// own that keeps its chief. A beaten Skarn can become your vassal: they
// pay tribute each spring and keep the peace, until they think themselves
// strong enough to throw it off.

import { NEIGHBORS, SKILLS } from './data.js';
import {
  living, year, hasKnowledge, eraAtLeast, makePerson, canFight, placeName, independent,
} from './state.js';
import { nation, remember } from './nations.js';
import { newName } from './village.js';
import { recordDeed } from './legacy.js';
import { randomInt } from './rng.js';

export const FEDERATION_YEARS = 6; // Years of alliance before they ask.

// Peoples ready to ask to join your nation.
export function federationCandidates(state) {
  if (!eraAtLeast(state, 'nation') || !hasKnowledge(state, 'lawCodes')) return [];
  return ['velari', 'tellani'].filter((id) => {
    const n = state.neighbors[id];
    const nat = nation(state, id);
    return independent(state, id) && nat && nat.treaties.alliance
      && state.turn - (nat.allianceSince ?? 0) >= FEDERATION_YEARS * 4
      && n.relation >= 60 && nat.trust >= 75;
  });
}

// A valley people joins your nation as a settlement of its own.
export function joinNation(state, id) {
  const n = state.neighbors[id];
  const nat = nation(state, id);
  const home = NEIGHBORS[id].home;
  n.joined = true;
  n.joinedTurn = state.turn;
  nat.treaties = {};
  for (const placeId of Object.keys(state.places)) if (state.places[placeId].owner === id) state.places[placeId].owner = 'player';
  const skills = {};
  for (const k of SKILLS) skills[k] = randomInt(state, 0, 2);
  skills.learning = 3;
  skills[id === 'velari' ? 'foraging' : 'building'] = 4;
  const chief = makePerson({ name: newName(state), note: `Chief of ${NEIGHBORS[id].name}, who led them into your nation.`, age: randomInt(state, 35, 50), skills }, state.nextPersonId++, 'govern');
  const role = id === 'tellani' && hasKnowledge(state, 'weaving') ? 'market' : 'farming';
  const pop = Math.max(12, nat.population);
  const tid = (state.settlements || []).reduce((max, t) => Math.max(max, t.id), 0) + 1;
  state.settlements.push({
    id: tid,
    name: placeName(state, home),
    place: home,
    founded: state.turn,
    population: pop,
    role,
    demands: 'light',
    priorities: { defense: 'high', learning: 'normal' },
    loyalty: 75,
    governor: chief,
    governorSince: state.turn,
    notables: [],
    buildings: { homes: Math.ceil((pop + 8) / 8), palisade: 1, stoneWall: 0, hall: 1, works: { [role]: 1 } },
    project: null,
    lastAid: state.turn,
    harriedAt: null,
    keepUntil: null,
    lastShipment: null,
    federated: id,
  });
  recordDeed(state, 'welcomed', 3);
  return `${NEIGHBORS[id].name[0].toUpperCase()}${NEIGHBORS[id].name.slice(1)} have joined your nation. ${placeName(state, home)} is a settlement of yours now, of ${pop} people under their chief, ${chief.name}, who governs it. They joined as a free people: they will not bear heavy demands.`;
}

// ----- The Skarn as vassals -----

// The Skarn sue to become your vassals once they are beaten: their warriors
// fewer than two fifths of your fighters.
export function vassalReady(state) {
  const sk = state.neighbors.skarn;
  const nat = nation(state, 'skarn');
  if (!eraAtLeast(state, 'nation') || !sk.known || sk.vassal || !nat) return false;
  const fighters = living(state).filter(canFight).length;
  return nat.warriors < fighters * 0.4;
}

export const VASSAL_TRIBUTE = { food: 20, goods: 10 };

export function makeVassal(state) {
  const sk = state.neighbors.skarn;
  sk.vassal = true;
  sk.vassalSince = state.turn;
  sk.peace = false;
  sk.peaceWarned = false;
  remember(state, 'skarn', `became your vassals in Year ${year(state)}`, 0);
}

// Each spring: tribute, or rebellion if they have grown strong. Returns lines.
export function vassalYear(state) {
  const out = { urgent: [], events: [] };
  const sk = state.neighbors.skarn;
  const nat = nation(state, 'skarn');
  if (!sk.vassal || !nat) return out;
  const fighters = living(state).filter(canFight).length;
  if (nat.warriors > fighters * 0.8) {
    sk.vassal = false;
    sk.relation = Math.max(-100, sk.relation - 20);
    out.urgent.push(`The Skarn have thrown off your rule. With ${nat.warriors} warriors again, their chiefs say they owe ${state.campName} nothing. They are free, and angry.`);
    return out;
  }
  state.resources.food += VASSAL_TRIBUTE.food;
  state.resources.goods = (state.resources.goods || 0) + VASSAL_TRIBUTE.goods;
  sk.relation = Math.min(100, sk.relation + 2);
  out.events.push(`The Skarn, your vassals, sent their yearly tribute: ${VASSAL_TRIBUTE.food} food and ${VASSAL_TRIBUTE.goods} goods.`);
  return out;
}
