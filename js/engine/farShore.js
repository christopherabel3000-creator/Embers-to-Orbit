// The Age of Discovery, phase 1: the sea. The voyage that ended the Nation
// era lands on the far shore, and its crew holds a foothold there. Ports
// build merchant ships, which sail in fleets under a captain along the sea
// lanes: storms delay them and can sink them. Fleets chart the waters and
// the far shore's coasts, carry food and people to the foothold, and meet
// the far shore's peoples; the foothold's scouts explore inland.

import {
  WATERS, WATER_ORDER, SHORE_REGIONS, SHORE_ORDER, SHORE_PLACES, SHORE_PLACE_ORDER, SHORE_PEOPLES, SHORE_PEOPLE_ORDER,
  SHIP, STORM_SINKS, FOOTHOLD_FOOD_CAP, SCOUT_SEASONS, SCOUT_PARTY,
} from './farShoreData.js';
import { AGES } from './data.js';
import {
  living, seasonIndex, foodNeeded, eraAtLeast,
} from './state.js';
import { isNotable } from './village.js';
import { worksLevel } from './realm.js';
import { refreshAdvisors } from './advisors.js';
import { applyStudy } from './study.js';
import { recordDeed } from './legacy.js';
import { chance, randomInt } from './rng.js';
import {
  capital, listWords, plural, lowerFirst,
} from './util.js';

const bound = (n) => Math.max(-100, Math.min(100, Math.round(n)));

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
export const VOYAGE_CROSSING = 2; // Seasons the first ship takes to cross.
export const FOOTHOLD_START_FOOD = 150; // The voyage's stores, landed with the crew.

// ----- The state of the far shore -----

export function initialFarShore(state) {
  const waters = {};
  for (const id of WATER_ORDER) waters[id] = 'unknown';
  const regions = {};
  for (const id of SHORE_ORDER) regions[id] = 'unknown';
  const places = {};
  for (const id of SHORE_PLACE_ORDER) places[id] = false;
  const peoples = {};
  for (const id of SHORE_PEOPLE_ORDER) peoples[id] = { met: false, contactPending: false, relation: SHORE_PEOPLES[id].baseline };
  return {
    arrives: state.turn + VOYAGE_CROSSING,
    landed: false,
    shipHome: null, // The turn the voyage's ship comes home.
    waters,
    regions,
    places,
    peoples,
    foothold: null,
    yards: {}, // By port settlement: { done } while a ship is being built.
    ships: 0, // Ships in your home port.
    fleets: [],
    nextFleetId: 1,
    shipsLost: 0,
    shipsBuilt: 0,
  };
}

export function farShore(state) {
  return state.farShore || null;
}

export function atSea(state) {
  return Boolean(state.farShore);
}

function regionName(id) {
  return WATERS[id] ? WATERS[id].name : SHORE_REGIONS[id].name;
}

export function nodeName(id) {
  return regionName(id);
}

function known(fs, id) {
  return WATERS[id] ? fs.waters[id] !== 'unknown' : fs.regions[id] !== 'unknown';
}

function hear(fs, id, lines) {
  if (WATERS[id] && fs.waters[id] === 'unknown') {
    fs.waters[id] = 'heard';
    if (WATERS[id].heard) lines.push(WATERS[id].heard);
  } else if (SHORE_REGIONS[id] && fs.regions[id] === 'unknown') {
    fs.regions[id] = 'heard';
    if (SHORE_REGIONS[id].heard) lines.push(SHORE_REGIONS[id].heard);
  }
}

// ----- The landing and the foothold -----

// The places of a waters or region, in order.
export function placesIn(id) {
  return SHORE_PLACE_ORDER.filter((p) => SHORE_PLACES[p].at === id);
}

function revealPlace(state, id, lines, who) {
  const fs = state.farShore;
  if (fs.places[id]) return;
  fs.places[id] = true;
  const p = SHORE_PLACES[id];
  const words = {
    settle: 'a place a colony could one day stand', people: 'the home of a people', wonder: 'a wonder', ruins: 'ruins', danger: 'a danger', route: 'a way through',
  }[p.kind];
  lines.push(`${who} found ${p.name}, ${words}: ${p.description}`);
  if (p.kind === 'wonder') recordDeed(state, 'wonders');
  if (p.kind === 'ruins' && p.study) {
    const studied = applyStudy(state, p.study);
    lines.push(`Your scholars learned from it: ${p.study} points toward your studies.${studied.urgent.length ? ` ${studied.urgent.join(' ')}` : ''}`);
  }
  if (p.kind === 'people' && !fs.peoples[p.people].met) fs.peoples[p.people].contactPending = true;
  // A region whose places are all found is explored.
  if (SHORE_REGIONS[p.at] && placesIn(p.at).every((x) => fs.places[x])) fs.regions[p.at] = 'explored';
  if (WATERS[p.at] && placesIn(p.at).every((x) => fs.places[x])) fs.waters[p.at] = 'charted';
}

function foundFoothold(state, regionId, people, food, lines) {
  const fs = state.farShore;
  const place = placesIn(regionId).find((p) => SHORE_PLACES[p].kind === 'settle' && SHORE_PLACES[p].harbor) || placesIn(regionId)[0];
  revealPlace(state, place, [], 'Your sailors');
  fs.foothold = {
    place, region: regionId, people: people.map((p) => ({ ...p, task: 'foothold' })), food, founded: state.turn, scouting: null,
  };
  lines.push(`${plural(people.length, 'of your people has', 'of your people have')} made a foothold at ${SHORE_PLACES[place].name}, on ${lowerFirst(SHORE_REGIONS[regionId].name)}.`);
}

// The voyage reaches the far shore: its crew makes the first foothold.
function land(state, lines) {
  const fs = state.farShore;
  fs.landed = true;
  const crew = (state.voyage && state.voyage.crew) || [];
  for (const id of ['homeWaters', 'openSea', 'farWaters']) fs.waters[id] = 'charted';
  fs.regions.landfall = 'heard';
  lines.push(`Land! After ${VOYAGE_CROSSING} seasons on the open sea, your first ship has reached a shore no one in your world has seen${state.voyage && state.voyage.captain ? `, with ${state.voyage.captain} at the helm` : ''}.`);
  if (crew.length) foundFoothold(state, 'landfall', crew, FOOTHOLD_START_FOOD, lines);
  for (const id of ['westernIsles']) hear(fs, id, lines);
  for (const id of SHORE_REGIONS.landfall.neighbors) hear(fs, id, lines);
  fs.shipHome = state.turn + VOYAGE_CROSSING;
  lines.push(`The ship will sail home with word of it, and reach your harbor in ${plural(VOYAGE_CROSSING, 'season', 'seasons')}. Ports can build more ships, and the Fleets screen sends them out.`);
  if (state.voyage) state.voyage.landed = state.turn;
}

// How many seasons the foothold's food lasts at this pace, or null if it grows.
export function footholdLasts(state) {
  const f = state.farShore && state.farShore.foothold;
  if (!f) return null;
  const net = footholdGather(state) - foodNeeded(f.people);
  if (net >= 0) return null;
  return Math.floor(f.food / -net);
}

function footholdWorkers(f) {
  const away = new Set(f.scouting ? f.scouting.ids : []);
  return f.people.filter((p) => !away.has(p.id) && p.age >= 12 && p.health >= 40);
}

// Food the foothold gathers this season: its people hunt, fish, and forage,
// and friendly neighbors trade them food.
export function footholdGather(state) {
  const fs = state.farShore;
  const f = fs.foothold;
  if (!f) return 0;
  const winter = seasonIndex(state) === 3;
  let food = footholdWorkers(f).reduce((sum, p) => sum + 2 + Math.max(p.skills.hunting || 0, p.skills.foraging || 0), 0);
  if (winter) food = Math.floor(food / 2);
  for (const id of SHORE_PEOPLE_ORDER) {
    const pe = fs.peoples[id];
    const near = SHORE_PEOPLES[id].homeland === f.region || SHORE_REGIONS[f.region].neighbors.includes(SHORE_PEOPLES[id].homeland);
    if (pe.met && pe.relation >= 20 && near) food += 8;
  }
  return food;
}

function footholdSeason(state, out) {
  const fs = state.farShore;
  const f = fs.foothold;
  if (!f) return;
  const s = seasonIndex(state);
  // Scouts come home.
  if (f.scouting) {
    const sc = f.scouting;
    const party = f.people.filter((p) => sc.ids.includes(p.id));
    const pe = SHORE_REGIONS[sc.region].people ? fs.peoples[SHORE_REGIONS[sc.region].people] : null;
    const danger = pe && pe.met && pe.relation < 0 ? 0.25 : 0.1;
    if (party.length && chance(state, danger)) {
      const p = party[randomInt(state, 0, party.length - 1)];
      if (pe && pe.met && pe.relation <= -20 && chance(state, 0.4)) {
        p.alive = false;
        out.urgent.push(`${p.name} was killed scouting ${lowerFirst(SHORE_REGIONS[sc.region].name)}: ${SHORE_PEOPLES[SHORE_REGIONS[sc.region].people].name} want no strangers there.`);
      } else {
        p.health = Math.max(10, p.health - 40);
        out.events.push(`${p.name} was hurt scouting ${lowerFirst(SHORE_REGIONS[sc.region].name)}.`);
      }
    }
    if (state.turn >= sc.returns) {
      f.scouting = null;
      const found = [];
      for (const id of placesIn(sc.region)) revealPlace(state, id, found, 'Your scouts');
      fs.regions[sc.region] = 'explored';
      const heard = [];
      for (const n of SHORE_REGIONS[sc.region].neighbors) hear(fs, n, heard);
      out.events.push(`Your scouts came back to ${SHORE_PLACES[f.place].name} from ${lowerFirst(SHORE_REGIONS[sc.region].name)}.`, ...found, ...heard);
      const people = SHORE_REGIONS[sc.region].people;
      if (people && !fs.peoples[people].met) fs.peoples[people].contactPending = true;
    }
  }
  // Food.
  const gathered = footholdGather(state);
  const eaten = foodNeeded(f.people.filter((p) => p.alive));
  f.food += gathered - eaten;
  if (f.food < 0) {
    f.food = 0;
    for (const p of f.people) {
      p.health -= 15;
      if (p.health <= 0) p.alive = false;
    }
    out.urgent.push(`The foothold at ${SHORE_PLACES[f.place].name} ran out of food: its people went hungry. A fleet with food would save them.`);
  } else {
    for (const p of f.people) p.health = Math.min(100, p.health + 10);
    if (f.food > FOOTHOLD_FOOD_CAP) f.food = FOOTHOLD_FOOD_CAP;
  }
  // The years pass for them too.
  if (s === 0) {
    for (const p of f.people) {
      p.age += 1;
      if (p.age >= AGES.oldAgeDeaths && chance(state, (p.age - 55) * 0.02)) {
        p.alive = false;
        out.events.push(`${p.name} died peacefully in old age at the foothold, at ${p.age}.`);
      }
    }
  }
  const dead = f.people.filter((p) => !p.alive);
  if (dead.length) f.people = f.people.filter((p) => p.alive);
  if (!f.people.length) {
    out.urgent.push(`The foothold at ${SHORE_PLACES[f.place].name} is gone: none of its people are left. A fleet carrying people could make another.`);
    fs.foothold = null;
    return;
  }
  out.routine.push(`The foothold at ${SHORE_PLACES[f.place].name}: ${plural(f.people.length, 'person', 'people')}, ${f.food} food in store (gathered ${gathered}, ate ${eaten}).`);
}

// Where the foothold's scouts could go: regions next to the foothold or to
// an explored region, that are heard of and not yet explored.
export function scoutTargets(state) {
  const fs = state.farShore;
  if (!fs || !fs.foothold) return [];
  const from = new Set([fs.foothold.region, ...SHORE_ORDER.filter((id) => fs.regions[id] === 'explored')]);
  return SHORE_ORDER.filter((id) => fs.regions[id] !== 'explored' && fs.regions[id] !== 'unknown'
    && [...from].some((r) => SHORE_REGIONS[r].neighbors.includes(id) || r === id));
}

export function scoutParty(state) {
  const f = state.farShore && state.farShore.foothold;
  if (!f) return [];
  return [...f.people].filter((p) => p.age >= 16 && p.health >= 60)
    .sort((a, b) => (b.skills.scouting || 0) - (a.skills.scouting || 0)).slice(0, SCOUT_PARTY);
}

export function scoutBlocker(state, region = null) {
  const fs = state.farShore;
  if (!fs || !fs.foothold) return 'You have no foothold on the far shore.';
  if (fs.foothold.scouting) return `Your scouts are already out in ${lowerFirst(SHORE_REGIONS[fs.foothold.scouting.region].name)}.`;
  if (!scoutTargets(state).length) return 'There is nowhere new your scouts can reach from the foothold.';
  if (region && !scoutTargets(state).includes(region)) return 'Your scouts cannot reach there from the foothold.';
  if (fs.foothold.people.length < 2 || !scoutParty(state).length) return 'The foothold cannot spare anyone fit to scout.';
  return null;
}

export function sendScouts(state, { region }) {
  const why = scoutBlocker(state, region);
  if (why) return { error: why };
  const f = state.farShore.foothold;
  const party = scoutParty(state).slice(0, Math.min(SCOUT_PARTY, f.people.length - 1));
  f.scouting = { region, ids: party.map((p) => p.id), returns: state.turn + SCOUT_SEASONS };
  return { message: `${listWords(party.map((p) => p.name))} set out from the foothold to scout ${lowerFirst(SHORE_REGIONS[region].name)}. They will be back in ${plural(SCOUT_SEASONS, 'season', 'seasons')}.` };
}

// ----- Shipyards and ships -----

// Your ports with a harbor built: each is a shipyard.
export function shipyards(state) {
  return (state.settlements || []).filter((t) => t.role === 'port' && worksLevel(t) >= 1); // A port's works are its harbor.
}

export function shipCostWords() {
  return listWords(Object.entries(SHIP.cost).map(([k, n]) => `${n} ${k}`));
}

export function buildShipBlocker(state, t) {
  if (!atSea(state) || !state.farShore.landed) return 'Ships are built once your first ship has reached the far shore.';
  if (!t) return 'Choose one of your ports.';
  if (!shipyards(state).includes(t)) return `${t.name} has no harbor to build ships in.`;
  const yard = state.farShore.yards[t.id];
  if (yard && yard.done > state.turn) return `${t.name}'s shipyard is building a ship, ready in ${plural(yard.done - state.turn, 'season', 'seasons')}.`;
  const short = Object.entries(SHIP.cost).filter(([k, n]) => (state.resources[k] || 0) < n);
  if (short.length) return `A ship takes ${shipCostWords()}. You are short of ${listWords(short.map(([k, n]) => `${n - (state.resources[k] || 0)} ${k}`))}.`;
  return null;
}

export function buildShip(state, { settlementId }) {
  const t = (state.settlements || []).find((x) => x.id === Number(settlementId));
  const why = buildShipBlocker(state, t);
  if (why) return { error: why };
  for (const [k, n] of Object.entries(SHIP.cost)) state.resources[k] -= n;
  state.farShore.yards[t.id] = { done: state.turn + SHIP.seasons };
  return { message: `${t.name}'s shipyard has laid down a merchant ship. It will be ready in ${plural(SHIP.seasons, 'season', 'seasons')}.` };
}

export function shipsAfloat(state) {
  const fs = state.farShore;
  if (!fs) return 0;
  return fs.ships + fs.fleets.reduce((sum, f) => sum + f.ships, 0);
}

// ----- Fleets -----

export function captainChoices(state) {
  return living(state).filter((p) => p.age >= 18 && p.age <= 60 && p.health >= 60 && !p.sick && !Object.values(state.advisors).includes(p.id))
    .sort((a, b) => (b.skills.scouting || 0) - (a.skills.scouting || 0) || (b.skills.learning || 0) - (a.skills.learning || 0));
}

export function fleetById(state, id) {
  return state.farShore ? state.farShore.fleets.find((f) => f.id === Number(id)) : null;
}

export function formFleetBlocker(state) {
  const fs = state.farShore;
  if (!fs || !fs.landed) return 'Fleets sail once your first ship has reached the far shore.';
  if (fs.ships < 1) return 'There are no ships in your harbor.';
  if (!captainChoices(state).length) return 'No one in the capital is fit to captain a fleet.';
  return null;
}

export function formFleet(state, { captainId, ships }) {
  const why = formFleetBlocker(state);
  if (why) return { error: why };
  const fs = state.farShore;
  const n = Number(ships);
  if (!Number.isInteger(n) || n < 1 || n > fs.ships) return { error: `Choose from 1 to ${fs.ships} ships.` };
  const p = captainChoices(state).find((x) => x.id === Number(captainId));
  if (!p) return { error: 'Choose a captain from the capital.' };
  state.people = state.people.filter((x) => x.id !== p.id);
  refreshAdvisors(state);
  fs.ships -= n;
  const id = fs.nextFleetId++;
  const fleet = {
    id, name: `The ${ORDINALS[(id - 1) % ORDINALS.length]} fleet`, captain: { ...p, task: 'captain' }, ships: n, location: 'homeWaters', route: [], cargo: { food: 0, people: [] }, formed: state.turn,
  };
  fs.fleets.push(fleet);
  return { message: `${fleet.name} is formed: ${plural(n, 'ship', 'ships')} under ${p.name}, in your home waters.` };
}

// Where a fleet can go from a node: along the lanes, and from the far
// waters to the far shore's coasts and back.
export function seaNeighbors(id) {
  if (WATERS[id]) return [...WATERS[id].lanes, ...(WATERS[id].coasts || [])];
  if (SHORE_REGIONS[id] && SHORE_REGIONS[id].coastal) return WATER_ORDER.filter((w) => (WATERS[w].coasts || []).includes(id));
  return [];
}

// The shortest way through waters and coasts you know: the nodes after `from`.
export function seaPath(state, from, to) {
  const fs = state.farShore;
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const n of seaNeighbors(id)) {
      if (prev.has(n) || !known(fs, n)) continue;
      prev.set(n, id);
      if (n === to) {
        const path = [n];
        let back = id;
        while (back !== from) { path.unshift(back); back = prev.get(back); }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

// Where a fleet could be sent: every waters and coast you know of.
export function fleetTargets(state, fleet) {
  const fs = state.farShore;
  return [...WATER_ORDER, ...SHORE_ORDER.filter((id) => SHORE_REGIONS[id].coastal)]
    .filter((id) => id !== fleet.location && known(fs, id) && seaPath(state, fleet.location, id));
}

export function setCourse(state, { fleetId, to }) {
  const fleet = fleetById(state, fleetId);
  if (!fleet) return { error: 'There is no such fleet.' };
  if (!(WATERS[to] || (SHORE_REGIONS[to] && SHORE_REGIONS[to].coastal))) return { error: 'Choose waters or a coast to sail to.' };
  const path = seaPath(state, fleet.location, to);
  if (!path) return { error: 'Your captains know no way there.' };
  fleet.route = path;
  return { message: `${fleet.name} will sail for ${lowerFirst(regionName(to))}: ${plural(path.length, 'season', 'seasons')} at sea, if the weather holds.` };
}

export function loadBlocker(state, fleet) {
  if (!fleet) return 'There is no such fleet.';
  if (fleet.location !== 'homeWaters') return `${fleet.name} can only take on cargo in your home waters.`;
  if (fleet.route.length) return `${fleet.name} is already under sail.`;
  return null;
}

// People who could sail: as many as could move out to a settlement.
function sailors(state) {
  return living(state).filter((p) => p.age >= 16 && p.age < 55 && p.health >= 40 && !p.sick && !isNotable(state, p));
}

export function loadFleet(state, { fleetId, food = 0, people = 0 }) {
  const fleet = fleetById(state, fleetId);
  const why = loadBlocker(state, fleet);
  if (why) return { error: why };
  const f = Math.max(0, Math.floor(Number(food) || 0));
  const n = Math.max(0, Math.floor(Number(people) || 0));
  if (f + fleet.cargo.food > fleet.ships * SHIP.food) return { error: `${fleet.name} can carry ${fleet.ships * SHIP.food} food.` };
  if (n + fleet.cargo.people.length > fleet.ships * SHIP.people) return { error: `${fleet.name} can carry ${fleet.ships * SHIP.people} people.` };
  if (f > state.resources.food) return { error: `You have ${state.resources.food} food.` };
  if (n > Math.max(0, living(state).length - 30)) return { error: 'The capital must keep at least 30 people.' };
  const going = sailors(state).sort((a, b) => (b.skills.foraging || 0) + (b.skills.hunting || 0) - (a.skills.foraging || 0) - (a.skills.hunting || 0)).slice(0, n);
  if (going.length < n) return { error: `Only ${going.length} in the capital are free to sail.` };
  state.resources.food -= f;
  fleet.cargo.food += f;
  const ids = new Set(going.map((p) => p.id));
  state.people = state.people.filter((p) => !ids.has(p.id));
  fleet.cargo.people.push(...going.map((p) => ({ ...p, task: 'sailing' })));
  refreshAdvisors(state);
  return { message: `${fleet.name} has taken on ${[f ? `${f} food` : null, n ? plural(n, 'settler', 'settlers') : null].filter(Boolean).join(' and ') || 'nothing'}.` };
}

// A fleet in your home waters comes into port: its ships go back to the
// harbor, its captain and anyone aboard come home, and its cargo is landed.
export function disbandFleet(state, { fleetId }) {
  const fleet = fleetById(state, fleetId);
  if (!fleet) return { error: 'There is no such fleet.' };
  if (fleet.location !== 'homeWaters' || fleet.route.length) return { error: `${fleet.name} must be in your home waters, and not under sail.` };
  const fs = state.farShore;
  fs.ships += fleet.ships;
  state.resources.food += fleet.cargo.food;
  for (const p of [fleet.captain, ...fleet.cargo.people]) state.people.push({ ...p, task: 'rest', orderReturn: null });
  fs.fleets = fs.fleets.filter((f) => f !== fleet);
  refreshAdvisors(state);
  return { message: `${fleet.name} has come into port. Its ${plural(fleet.ships, 'ship is', 'ships are')} in the harbor, and ${fleet.captain.name} is home.` };
}

// The chance a storm finds a fleet in these waters this season.
export function stormChance(state, waterId, fleet) {
  const w = WATERS[waterId];
  if (!w || !w.storm) return 0;
  const winter = seasonIndex(state) === 3 ? 2 : 1;
  const skill = fleet && fleet.captain ? (fleet.captain.skills.scouting || 0) * 0.01 : 0;
  return Math.max(0.01, w.storm * winter - skill);
}

function unload(state, fleet, lines) {
  const fs = state.farShore;
  const f = fs.foothold;
  if (f && f.region === fleet.location) {
    if (!fleet.cargo.food && !fleet.cargo.people.length) return;
    f.food = Math.min(FOOTHOLD_FOOD_CAP, f.food + fleet.cargo.food);
    f.people.push(...fleet.cargo.people.map((p) => ({ ...p, task: 'foothold' })));
    lines.push(`${fleet.name} landed ${[fleet.cargo.food ? `${fleet.cargo.food} food` : null, fleet.cargo.people.length ? plural(fleet.cargo.people.length, 'settler', 'settlers') : null].filter(Boolean).join(' and ')} at the foothold, which now has ${plural(f.people.length, 'person', 'people')}.`);
    fleet.cargo = { food: 0, people: [] };
    return;
  }
  if (!f && SHORE_REGIONS[fleet.location] && fleet.cargo.people.length >= 4) {
    foundFoothold(state, fleet.location, fleet.cargo.people, fleet.cargo.food, lines);
    fleet.cargo = { food: 0, people: [] };
  }
}

// A fleet arrives at a node: it charts new waters, hears of what lies
// beyond, lands its cargo at the foothold, and may meet a people.
function arrive(state, fleet, lines) {
  const fs = state.farShore;
  const id = fleet.location;
  if (WATERS[id]) {
    if (fs.waters[id] !== 'charted' && !placesIn(id).length) {
      fs.waters[id] = 'charted';
      lines.push(`${fleet.name} has charted ${lowerFirst(WATERS[id].name)}.`);
    }
    for (const n of seaNeighbors(id)) hear(fs, n, lines);
  } else {
    if (fs.regions[id] === 'unknown') fs.regions[id] = 'heard';
    unload(state, fleet, lines);
    const people = SHORE_REGIONS[id].people;
    if (people && !fs.peoples[people].met) fs.peoples[people].contactPending = true;
    for (const n of SHORE_REGIONS[id].neighbors) hear(fs, n, lines);
  }
}

// A fleet at anchor charts the places of its waters or coast, one a season.
// Inland places are left to scouts.
function chart(state, fleet, lines) {
  const fs = state.farShore;
  const id = fleet.location;
  const left = placesIn(id).filter((p) => !fs.places[p]);
  if (!left.length) return;
  if (SHORE_REGIONS[id] && !SHORE_REGIONS[id].coastal) return;
  revealPlace(state, left[0], lines, fleet.name);
}

function lose(state, fleet, lines) {
  const fs = state.farShore;
  fs.fleets = fs.fleets.filter((f) => f !== fleet);
  lines.push(`${fleet.name} was lost in a storm on ${lowerFirst(regionName(fleet.location))}, with ${fleet.captain.name}${fleet.cargo.people.length ? ` and ${plural(fleet.cargo.people.length, 'settler', 'settlers')}` : ''} aboard.`);
}

function fleetsSeason(state, out) {
  const fs = state.farShore;
  for (const fleet of [...fs.fleets]) {
    if (fleet.route.length) {
      const next = fleet.route[0];
      const water = WATERS[next] ? next : WATERS[fleet.location] ? fleet.location : null;
      if (water && chance(state, stormChance(state, water, fleet))) {
        if (chance(state, STORM_SINKS)) {
          fleet.ships -= 1;
          fs.shipsLost += 1;
          if (fleet.ships <= 0) { lose(state, fleet, out.urgent); continue; }
          out.urgent.push(`A storm on ${lowerFirst(regionName(water))} sank one of ${lowerFirst(fleet.name)}'s ships. ${plural(fleet.ships, 'ship sails', 'ships sail')} on.`);
        } else {
          out.events.push(`A storm on ${lowerFirst(regionName(water))} held ${lowerFirst(fleet.name)} back a season.`);
        }
        continue;
      }
      fleet.location = fleet.route.shift();
      arrive(state, fleet, fleet.route.length ? out.routine : out.events);
      if (!fleet.route.length) out.events.push(`${fleet.name} has reached ${lowerFirst(regionName(fleet.location))}.`);
    } else {
      chart(state, fleet, out.events);
    }
  }
}

// Each ship costs coin to keep: if the treasury cannot pay, a ship in the
// harbor is sold off.
function upkeep(state, out) {
  const fs = state.farShore;
  const due = shipsAfloat(state) * SHIP.upkeep;
  if (!due) return;
  if ((state.resources.coin || 0) >= due) {
    state.resources.coin -= due;
    out.routine.push(`Your ${plural(shipsAfloat(state), 'ship', 'ships')} cost ${due} coin to keep.`);
  } else if (fs.ships > 0) {
    fs.ships -= 1;
    out.urgent.push(`The treasury could not pay your sailors (${due} coin): a ship in the harbor was sold off.`);
  } else {
    out.urgent.push(`The treasury could not pay your sailors (${due} coin). They sail on, grumbling.`);
  }
}

// The far shore's peoples find your foothold, or drift back toward their nature.
function peoplesSeason(state) {
  const fs = state.farShore;
  for (const id of SHORE_PEOPLE_ORDER) {
    const pe = fs.peoples[id];
    const def = SHORE_PEOPLES[id];
    if (pe.met) {
      if (pe.relation < def.baseline) pe.relation += 1;
      else if (pe.relation > def.baseline) pe.relation -= 1;
      continue;
    }
    const f = fs.foothold;
    if (f && !pe.contactPending && def.finds && (def.homeland === f.region || SHORE_REGIONS[f.region].neighbors.includes(def.homeland)) && chance(state, def.finds)) {
      pe.contactPending = true;
    }
  }
}

// Runs each season of the Age of Discovery. Returns { urgent, events, routine }.
export function farShoreSeason(state) {
  const out = { urgent: [], events: [], routine: [] };
  const fs = state.farShore;
  if (!fs || !eraAtLeast(state, 'discovery')) return out;
  if (!fs.landed) {
    if (state.turn >= fs.arrives) land(state, out.urgent);
    return out;
  }
  if (fs.shipHome != null && state.turn >= fs.shipHome) {
    fs.shipHome = null;
    fs.ships += 1;
    out.urgent.push('Your first ship is home from the far shore, its crew left behind at the foothold. It waits in your harbor; the Fleets screen can send it out again.');
  }
  for (const t of shipyards(state)) {
    const yard = fs.yards[t.id];
    if (yard && yard.done <= state.turn) {
      delete fs.yards[t.id];
      fs.ships += 1;
      fs.shipsBuilt += 1;
      out.events.push(`${t.name}'s shipyard has launched a merchant ship. It waits in your harbor.`);
    }
  }
  upkeep(state, out);
  fleetsSeason(state, out);
  footholdSeason(state, out);
  peoplesSeason(state);
  return out;
}

// ----- First contact -----

export function farContactCrisis(state) {
  const fs = state.farShore;
  if (!fs || !fs.landed) return null;
  const id = SHORE_PEOPLE_ORDER.find((x) => fs.peoples[x].contactPending);
  return id ? { id: 'farContact', people: id } : null;
}

export const GIFT_GOODS = 20;

export const FAR_SHORE_EVENTS = {
  farContact: {
    choice: true,
    weight: () => 0, // Comes when a people is met, not by chance.
    start: () => ({}),
    view(state, ev) {
      const def = SHORE_PEOPLES[ev.people];
      const options = [];
      if ((state.resources.goods || 0) >= GIFT_GOODS) options.push({ id: 'gifts', label: `Greet them with gifts: ${GIFT_GOODS} goods of cloth, iron, and fine work.` });
      options.push({ id: 'trade', label: 'Greet them as traders, and offer to trade.' });
      options.push({ id: 'wary', label: 'Keep your distance, and watch them warily.' });
      return {
        title: `The ${def.title}`,
        text: `Your people on the far shore have met ${def.name}, ${def.nature}. ${def.description} ${def.values}`,
        options,
        advice: [
          ['speaker', `${capital(def.name)} know this land as we never will. They can teach ${def.teaches}. A good first meeting is worth a great deal.`],
          ['warChief', 'We are few there, and far from home. We cannot afford enemies on that shore yet.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      const fs = state.farShore;
      const def = SHORE_PEOPLES[ev.people];
      const pe = fs.peoples[ev.people];
      pe.met = true;
      pe.contactPending = false;
      pe.metAt = state.turn;
      if (!fs.places[def.home]) revealPlace(state, def.home, [], 'Your people');
      if (fs.regions[def.homeland] === 'unknown') fs.regions[def.homeland] = 'heard';
      if (choice === 'gifts') {
        state.resources.goods -= GIFT_GOODS;
        pe.relation = bound(pe.relation + 20);
        recordDeed(state, 'gifts');
        return [`You greeted ${def.name} with gifts. They welcomed your people warmly (relations ${pe.relation}).`];
      }
      if (choice === 'trade') {
        pe.relation = bound(pe.relation + 5);
        recordDeed(state, 'trades');
        return [`You greeted ${def.name} as traders. They were curious, and a little cautious (relations ${pe.relation}).`];
      }
      pe.relation = bound(pe.relation - 5);
      return [`Your people kept their distance from ${def.name}, who did the same (relations ${pe.relation}).`];
    },
  },
};

// ----- Starting the era -----

// The voyage has sailed: the sea opens, and the crew will land in two seasons.
export function startFarShore(state) {
  state.farShore = initialFarShore(state);
}

// Lines for the steward and the speaker.
export function farShoreAdvice(state) {
  const out = [];
  const fs = state.farShore;
  if (!fs || !fs.landed) return out;
  const lasts = footholdLasts(state);
  if (fs.foothold && lasts != null && lasts <= 2) out.push(['steward', 'warning', `The foothold at ${SHORE_PLACES[fs.foothold.place].name} has food for ${lasts ? plural(lasts, 'more season', 'more seasons') : 'less than a season'} at this pace. A fleet carrying food would keep its people alive.`]);
  if (!fs.foothold) out.push(['steward', 'warning', 'We have no foothold on the far shore. A fleet carrying at least 4 settlers could make one on any coast we know.']);
  const heard = [...WATER_ORDER.filter((id) => fs.waters[id] === 'heard'), ...SHORE_ORDER.filter((id) => SHORE_REGIONS[id].coastal && fs.regions[id] === 'heard')];
  if (heard.length && !fs.fleets.some((f) => f.route.length)) out.push(['speaker', 'note', `Our sailors speak of ${listWords(heard.map((id) => lowerFirst(regionName(id))))}, not yet charted. A fleet could chart ${heard.length === 1 ? 'it' : 'them'}, from the Fleets screen.`]);
  if (fs.foothold && !fs.foothold.scouting && !scoutBlocker(state)) out.push(['speaker', 'note', `The foothold's scouts could explore ${listWords(scoutTargets(state).map((id) => lowerFirst(SHORE_REGIONS[id].name)))}, from the Fleets screen.`]);
  return out;
}

