// The nation's settlements. The village founds a second settlement, which
// begins the Nation era, and more after it. Each settlement runs itself
// under a governor, guided by the role and priorities the player sets, and
// its people are counted by groups; only its governor and notable people
// have names. What a settlement brings in, and how loyal it is, is reckoned
// in realm.js; this file holds the player's decisions and each season's
// running of the settlements.

import { SKILLS, placeRegion, placeData } from './data.js';
import { armyHolding, passHeld } from './warStatus.js';
import { REGIONS, WORLD_PLACES, WORLD_PLACE_ORDER } from './worldData.js';
import { openWorld } from './world.js';
import { hearOfGreat } from './great.js';
import {
  living, inVillage, eraAtLeast, placeName, seasonIndex, isKnown, makePerson, hasKnowledge,
} from './state.js';
import { refreshAdvisors, ADVISOR_ROLES } from './advisors.js';
import { notablePeople, newName } from './village.js';
import { nationsActive, harryChance, skarnLosses } from './nations.js';
import {
  ROLES, DEMANDS, TOWN_PRIORITIES, LOYALTY_START, HOME_ROOM, bestRole, roleAvailable, settlementById,
  townGroups, expectedShipment, governorSkill, loyaltyTarget, loyaltyWord, keepingAll, hasRoad, worksLevel,
} from './realm.js';
import { gainExperience } from './skills.js';
import { chance, randomInt, pick } from './rng.js';
import {
  shuffle, listNames, listWords, clamp, lowerFirst,
} from './util.js';

export const SETTLEMENT_COST = { food: 80, wood: 60, stone: 30 };
export const MIN_VILLAGE = 40; // People the capital needs before it can found another.
export const KEEP_AT_HOME = 30; // People who must stay in the capital.
export const MIN_TOWN = 30; // People a settlement needs before it can found another.
export const KEEP_IN_TOWN = 20; // People who must stay in it.
export const SETTLERS = [10, 20]; // How many can go.
export const AID_GAP = 4; // Seasons between gifts of aid to the same settlement.

// Settlements from before roles had a policy instead.
export const POLICY_TO_DEMANDS = { grow: 'light', supply: 'heavy' };

// What a settlement at this place would send home: the kind of work its land
// is best for.
export function settlementProduct(placeId) {
  return ROLES[bestRole(placeId)].kind;
}

// Places where a settlement could be founded: in the valley, a place the
// nation holds; beyond it, a place expeditions have found that no one holds.
export function settlementSites(state) {
  const settled = new Set((state.settlements || []).map((t) => t.place));
  const valley = Object.keys(state.places).filter((id) => id !== 'camp' && state.places[id].owner === 'player'
    && isKnown(state, id) && !settled.has(id));
  const world = state.world ? WORLD_PLACE_ORDER.filter((id) => WORLD_PLACES[id].kind === 'settle'
    && state.world.places[id].known && !state.world.places[id].owner && !settled.has(id)) : [];
  return [...valley, ...world];
}

// How many settlers can go from the capital ('capital') or a settlement (its id).
export function settlerRange(state, from = 'capital') {
  if (from === 'capital') {
    const pop = living(state).length;
    return [SETTLERS[0], Math.max(SETTLERS[0], Math.min(SETTLERS[1], pop - KEEP_AT_HOME))];
  }
  const t = settlementById(state, from);
  const pop = t ? t.population : 0;
  return [SETTLERS[0], Math.max(SETTLERS[0], Math.min(SETTLERS[1], pop - KEEP_IN_TOWN))];
}

// Where settlers could come from now: the capital, and any settlement large
// enough. Returns [{ from, name }].
export function settlerSources(state) {
  const out = [];
  if (living(state).length >= MIN_VILLAGE) out.push({ from: 'capital', name: state.campName });
  for (const t of state.settlements || []) {
    if (t.population >= MIN_TOWN && !keepingAll(state, t)) out.push({ from: t.id, name: t.name });
  }
  return out;
}

// Why the nation cannot found a settlement yet, or null if it can.
export function settlementBlocker(state) {
  if (!inVillage(state)) return 'Only a village can found another settlement.';
  if (!nationsActive(state)) return 'Your village must see out a season first.';
  if (!settlerSources(state).length) {
    const pop = living(state).length;
    return (state.settlements || []).length
      ? `Settlers can leave the capital once it has ${MIN_VILLAGE} people (it has ${pop}), or a settlement once it has ${MIN_TOWN}.`
      : `A village needs at least ${MIN_VILLAGE} people before some can leave to found another; you have ${pop}.`;
  }
  if (!settlementSites(state).length) {
    return (state.settlements || []).length
      ? 'Every place your nation holds already has a settlement. Claim more land on the Map screen.'
      : 'Your village must hold a place beyond its camp to settle. Claim one on the Map screen.';
  }
  const short = Object.entries(SETTLEMENT_COST).filter(([k, n]) => (state.resources[k] || 0) < n);
  if (short.length) return `Founding a settlement takes ${costText()}. You are short of ${short.map(([k, n]) => `${n - (state.resources[k] || 0)} ${k}`).join(' and ')}.`;
  return null;
}

export function costText() {
  return `${SETTLEMENT_COST.food} food, ${SETTLEMENT_COST.wood} wood, and ${SETTLEMENT_COST.stone} stone`;
}

function fitToGovern(p) {
  return p.age >= 16 && p.health >= 40 && !p.sick;
}

// Who could govern a new settlement: the capital's notable people, and the
// notable people of the settlement the settlers come from.
export function governorChoices(state, from = 'capital') {
  const home = notablePeople(state).filter(fitToGovern);
  const t = from === 'capital' ? null : settlementById(state, from);
  return [...home, ...(t ? t.notables.filter(fitToGovern) : [])];
}

// Who could take over a settlement as governor: the capital's notable
// people, and the settlement's own.
export function governorCandidates(state, t) {
  return [...notablePeople(state).filter(fitToGovern), ...t.notables.filter(fitToGovern)];
}

function isNotable(state, p) {
  return SKILLS.some((k) => p.skills[k] >= 5) || (state.heroes || []).some((h) => h.id === p.id);
}

function newTown(state, { name, placeId, count, governor, notables, role, demands }) {
  const id = (state.settlements || []).reduce((max, t) => Math.max(max, t.id), 0) + 1;
  return {
    id,
    name,
    place: placeId,
    founded: state.turn,
    population: count,
    role,
    demands,
    priorities: { defense: 'normal', learning: 'normal' },
    loyalty: LOYALTY_START,
    governor: { ...governor, task: 'govern' },
    governorSince: state.turn,
    notables: notables.map((p) => ({ ...p, task: 'settler' })),
    buildings: {
      homes: Math.ceil((count + 2) / HOME_ROOM), palisade: 0, stoneWall: 0, hall: 0, keep: 0, works: {},
    },
    project: null,
    lastAid: state.turn,
    harriedAt: null,
    keepUntil: null,
    lastShipment: null,
  };
}

// Founds a settlement. Returns { error } or { message }.
export function foundSettlement(state, {
  placeId, name, settlers, governorId, policy = null, role = null, demands = null, from = 'capital',
}) {
  const why = settlementBlocker(state);
  if (why) return { error: why };
  const source = from === 'capital' || from == null ? 'capital' : Number(from);
  if (!settlerSources(state).some((s) => s.from === source)) {
    return { error: source === 'capital' ? `Settlers can leave the capital once it has ${MIN_VILLAGE} people.` : `A settlement needs ${MIN_TOWN} people before some can leave it.` };
  }
  if (!settlementSites(state).includes(placeId)) return { error: 'Choose a place your people hold.' };
  const [lo, hi] = settlerRange(state, source);
  const count = Number(settlers);
  if (!Number.isInteger(count) || count < lo || count > hi) return { error: `Choose between ${lo} and ${hi} settlers.` };
  const governor = governorChoices(state, source).find((p) => p.id === Number(governorId));
  if (!governor) return { error: 'Choose a governor from your notable people.' };
  const chosenDemands = demands || POLICY_TO_DEMANDS[policy] || (policy ? null : 'normal');
  if (!DEMANDS[chosenDemands]) return { error: 'Choose light, normal, or heavy demands.' };
  const chosenRole = role || bestRole(placeId);
  if (!roleAvailable(state, chosenRole)) return { error: 'Choose a role your people can fill.' };
  const title = String(name || '').trim().slice(0, 30) || `New ${placeName(state, placeId)}`;
  const fromTown = source === 'capital' ? null : settlementById(state, source);
  const fromCapital = state.people.some((p) => p.id === governor.id);

  let going = [];
  let roles = [];
  if (!fromTown) {
    // The council keeps itself at home; the rest are a fair mix of able adults.
    const council = new Set(Object.values(state.advisors));
    const pool = shuffle(state, living(state).filter((p) => p !== governor && !council.has(p.id)
      && p.age >= 16 && p.age <= 50 && p.health >= 40 && !p.sick));
    going = [governor, ...pool.slice(0, count - 1)];
    if (going.length < count) return { error: 'Not enough people are fit to make the journey.' };
  }
  if (fromCapital) roles = Object.entries(state.advisors).filter(([, id]) => id === governor.id).map(([r]) => ADVISOR_ROLES[r].title.toLowerCase());

  for (const [k, n] of Object.entries(SETTLEMENT_COST)) state.resources[k] -= n;
  let notables = [];
  if (fromTown) {
    if (fromCapital) {
      // The governor comes from the capital; the rest from the settlement.
      state.people = state.people.filter((p) => p.id !== governor.id);
      fromTown.population -= count - 1;
    } else {
      fromTown.notables = fromTown.notables.filter((p) => p.id !== governor.id);
      fromTown.population -= count;
    }
  } else {
    const ids = new Set(going.map((p) => p.id));
    state.people = state.people.filter((p) => !ids.has(p.id));
    notables = going.filter((p) => p !== governor && isNotable(state, p));
  }
  state.settlements = state.settlements || [];
  if (WORLD_PLACES[placeId]) state.world.places[placeId].owner = 'player';
  const town = newTown(state, {
    name: title, placeId, count, governor, notables, role: chosenRole, demands: chosenDemands,
  });
  state.settlements.push(town);
  refreshAdvisors(state);
  const firstSettlement = state.era !== 'nation';
  state.era = 'nation';
  const heard = firstSettlement ? openWorld(state) : [];
  const rumors = firstSettlement ? hearOfGreat(state) : [];
  if (firstSettlement) state.nationFounded = state.turn;
  const whence = fromTown ? fromTown.name : state.campName;
  const names = fromTown ? `${count} settlers from ${whence}` : count > 3 ? `${going.slice(0, 3).map((p) => p.name).join(', ')}, and ${count - 3} more` : listNames(going);
  const leaving = roles.length ? `, leaving the post of ${roles.join(' and ')} to another` : '';
  const line = firstSettlement
    ? `${names} set out for ${placeName(state, placeId)} to found ${title}, a ${ROLES[chosenRole].name.toLowerCase()}, with ${governor.name} as governor${leaving}. Your people now live in two settlements: the Nation era has begun. ${state.campName} is your capital, and the Nation screen shows every settlement.${heard.length ? ` Travelers speak of lands beyond the valley: ${listWords(heard.map((id) => lowerFirst(REGIONS[id].name)))}. Expeditions can set out for them from the World screen.` : ''}${rumors.length ? ` ${rumors.join(' ')}` : ''}`
    : `${names} set out for ${placeName(state, placeId)} to found ${title}, a ${ROLES[chosenRole].name.toLowerCase()}, with ${governor.name} as governor${leaving}. Your nation now has ${state.settlements.length + 1} settlements.`;
  state.log.push({ turn: state.turn, date: state.report.title, text: line });
  state.report.decisions = [...(state.report.decisions || []), line];
  return { message: `${title} is founded at ${placeName(state, placeId)}, with ${count} settlers and ${governor.name} as governor.${firstSettlement ? ' The Nation era has begun.' : ''}` };
}

// ----- The player's decisions about a settlement -----

function townOr(state, id) {
  const t = settlementById(state, id ?? 1);
  return t ? { t } : { error: 'There is no such settlement.' };
}

export function setTownRole(state, { settlementId, role }) {
  const { t, error } = townOr(state, settlementId);
  if (error) return { error };
  if (!ROLES[role]) return { error: 'Unknown role.' };
  if (!roleAvailable(state, role)) return { error: `A ${ROLES[role].name.toLowerCase()} needs weaving first.` };
  if (t.role === role) return { message: `${t.name} is already a ${ROLES[role].name.toLowerCase()}.` };
  t.role = role;
  if (t.project && t.project.id === 'works') t.project = null; // The old works stand idle.
  const level = worksLevel(t);
  return { message: `${t.name} is now a ${ROLES[role].name.toLowerCase()}. ${ROLES[role].about}${level ? '' : ` Its governor will build ${ROLES[role].works} as it grows.`}` };
}

export function setTownDemands(state, { settlementId, demands }) {
  const { t, error } = townOr(state, settlementId);
  if (error) return { error };
  if (!DEMANDS[demands]) return { error: 'Choose light, normal, or heavy demands.' };
  if (keepingAll(state, t)) return { error: `${t.name} is keeping all it makes until next year, as you allowed.` };
  if (t.federated && demands === 'heavy') return { error: `${t.name} joined your nation as a free people, and will not bear heavy demands.` };
  t.demands = demands;
  return { message: `${DEMANDS[demands].name} demands on ${t.name}. ${DEMANDS[demands].about}` };
}

// Older saves and tests: grow or supply.
export function setPolicy(state, { settlementId = 1, policy }) {
  if (!POLICY_TO_DEMANDS[policy]) return { error: 'Choose grow or supply.' };
  return setTownDemands(state, { settlementId, demands: POLICY_TO_DEMANDS[policy] });
}

export function setTownPriority(state, { settlementId, area, level }) {
  const { t, error } = townOr(state, settlementId);
  if (error) return { error };
  if (!TOWN_PRIORITIES[area]) return { error: 'Unknown priority.' };
  if (!['low', 'normal', 'high'].includes(level)) return { error: 'Choose low, normal, or high.' };
  t.priorities[area] = level;
  return { message: `${TOWN_PRIORITIES[area].name} in ${t.name} set to ${level}.` };
}

// What aid to a settlement costs: a season of food, or a goods for every 2 people.
export function aidCost(t, kind) {
  return kind === 'goods' ? Math.ceil(t.population / 2) : t.population * 2;
}

export function aidBlocker(state, t, kind) {
  const wait = AID_GAP - (state.turn - (t.lastAid ?? -99));
  if (wait > 0) return `${t.name} had aid from the capital this past year. More can go in ${wait === 1 ? '1 season' : `${wait} seasons`}.`;
  const cost = aidCost(t, kind);
  if ((state.resources[kind] || 0) < cost) return `Aid of ${kind} to ${t.name} takes ${cost} ${kind}; you have ${state.resources[kind] || 0}.`;
  return null;
}

export function sendAid(state, { settlementId, kind }) {
  const { t, error } = townOr(state, settlementId);
  if (error) return { error };
  if (!['food', 'goods'].includes(kind)) return { error: 'Send food or goods.' };
  const why = aidBlocker(state, t, kind);
  if (why) return { error: why };
  const cost = aidCost(t, kind);
  state.resources[kind] -= cost;
  t.lastAid = state.turn;
  t.loyalty = clamp(t.loyalty + 10);
  return { message: `Sent ${cost} ${kind} to ${t.name}. Its people are grateful: loyalty is now ${t.loyalty}, ${loyaltyWord(t.loyalty)}.` };
}

// The old governor comes home to the capital.
function bringHome(state, person) {
  if (!person) return;
  state.people.push({ ...person, task: 'rest', orderReturn: null });
}

export function appointGovernor(state, { settlementId, personId }) {
  const { t, error } = townOr(state, settlementId);
  if (error) return { error };
  const id = Number(personId);
  if (t.governor && t.governor.id === id) return { error: `${t.governor.name} already governs ${t.name}.` };
  const person = governorCandidates(state, t).find((p) => p.id === id);
  if (!person) return { error: 'Choose one of your notable people.' };
  const old = t.governor;
  const local = t.notables.some((p) => p.id === id);
  if (local) {
    t.notables = t.notables.filter((p) => p.id !== id);
  } else {
    state.people = state.people.filter((p) => p.id !== id);
    t.population += 1;
  }
  t.governor = { ...person, task: 'govern' };
  t.governorSince = state.turn;
  if (old) {
    bringHome(state, old);
    t.population = Math.max(3, t.population - 1);
  }
  let feeling = '';
  if (t.loyalty >= 50 && old) {
    t.loyalty = clamp(t.loyalty - 5);
    feeling = ` Its people miss ${old.name}.`;
  } else if (t.loyalty < 40) {
    t.loyalty = clamp(t.loyalty + 10);
    feeling = ' Its people welcome the change.';
  }
  refreshAdvisors(state);
  return { message: `${person.name} now governs ${t.name}.${old ? ` ${old.name} has come home to ${state.campName}.` : ''}${feeling}` };
}

// ----- Each season -----

// What a settlement's governor builds next, or null.
export function nextProject(state, t) {
  const b = t.buildings;
  const room = b.homes * HOME_ROOM;
  const pop = t.population;
  const fortress = t.role === 'fortress';
  const level = worksLevel(t);
  if (pop + 3 > room) return 'homes';
  if (!b.palisade && (pop >= 15 || fortress)) return 'palisade';
  if (fortress && b.palisade && !b.stoneWall && hasKnowledge(state, 'masonry')) return 'stoneWall';
  if (fortress && b.stoneWall && !b.keep && hasKnowledge(state, 'fortresses')) return 'keep';
  if (level < 3 && pop >= 10 * (level + 1)) return 'works';
  if (!b.hall && pop >= 25 && hasKnowledge(state, 'oralLaw')) return 'hall';
  if (b.palisade && !b.stoneWall && pop >= 30 && hasKnowledge(state, 'masonry')) return 'stoneWall';
  if (pop + HOME_ROOM > room) return 'homes';
  return null;
}

export function projectWork(t, id) {
  if (id === 'works') return 16 * (worksLevel(t) + 1);
  return { homes: 14, palisade: 20, hall: 24, stoneWall: 30, keep: 40 }[id];
}

export function projectName(t, id) {
  if (id === 'works') return `${ROLES[t.role].works}${worksLevel(t) ? ` (level ${worksLevel(t) + 1})` : ''}`;
  return { homes: 'homes', palisade: 'a palisade', hall: 'a hall', stoneWall: 'a stone wall', keep: 'a stone keep' }[id];
}

function finishProject(t, id) {
  const b = t.buildings;
  if (id === 'homes') b.homes += 1;
  else if (id === 'works') b.works = { ...(b.works || {}), [t.role]: worksLevel(t) + 1 };
  else b[id] = 1;
}

// Builders' work in a settlement this season. Returns a line when something is finished.
function buildInTown(state, t) {
  if (!t.project) {
    const next = nextProject(state, t);
    if (next) t.project = { id: next, progress: 0 };
  }
  if (!t.project) return null;
  const builders = townGroups(state, t).builders;
  const per = 4 + (hasKnowledge(state, 'mathematics') ? 1 : 0);
  t.project.progress += builders * per;
  const need = projectWork(t, t.project.id);
  if (t.project.progress < need) return null;
  const name = projectName(t, t.project.id);
  finishProject(t, t.project.id);
  t.project = null;
  return `${t.name} finished ${name}.`;
}

// A local person who masters a skill, or takes up the governor's post.
function local(state, { age, skill, level, learning }) {
  const skills = {};
  for (const k of SKILLS) skills[k] = randomInt(state, 0, 2);
  skills[skill] = level;
  if (learning != null) skills.learning = learning;
  const p = makePerson({ name: newName(state), note: 'Born and raised in the settlements.', age, skills }, state.nextPersonId++, 'settler');
  return p;
}

// Once a year: governors and notable people grow older, and some die;
// masters rise in large settlements. Returns { urgent, events }.
function townYear(state, t) {
  const out = { urgent: [], events: [] };
  const old = (p) => p.age >= 60 && chance(state, (p.age - 55) * 0.02);
  for (const p of [t.governor, ...t.notables].filter(Boolean)) p.age += 1;
  const departed = t.notables.filter(old);
  if (departed.length) {
    t.notables = t.notables.filter((p) => !departed.includes(p));
    t.population = Math.max(3, t.population - departed.length);
    out.events.push(`${listNames(departed)} of ${t.name} died in old age.`);
  }
  if (t.governor && old(t.governor)) {
    const g = t.governor;
    const skill = governorSkill(t);
    const heir = [...t.notables].sort((a, b) => (b.skills[skill] + b.skills.learning) - (a.skills[skill] + a.skills.learning))[0];
    let next;
    if (heir) {
      t.notables = t.notables.filter((p) => p !== heir);
      next = heir;
    } else {
      // One of their own, already counted among them, now named.
      next = local(state, { age: randomInt(state, 30, 50), skill, level: randomInt(state, 2, 3), learning: randomInt(state, 1, 3) });
    }
    t.population = Math.max(3, t.population - 1); // The governor who died.
    t.governor = { ...next, task: 'govern' };
    t.governorSince = state.turn;
    out.urgent.push(`${g.name}, governor of ${t.name}, died in old age, at ${g.age}. ${heir ? `${next.name}, ${t.name}'s best ${skill === 'hunting' ? 'fighter' : 'hand'}, now governs.` : `Its people chose ${next.name}, one of their own, to govern.`} You can choose another governor on its screen.`);
  }
  if (t.population >= 30 && chance(state, 0.1)) {
    const skill = pick(state, SKILLS);
    const master = local(state, { age: randomInt(state, 22, 40), skill, level: 5 });
    t.notables.push(master);
    out.events.push(`A master has risen in ${t.name}: ${master.name}, whose ${skill} is the best in the settlement. A possible governor.`);
  }
  return out;
}

// Runs each season, after the capital's own work. Shipments are cut while
// the capital is under siege. Returns { urgent, events }; each season's
// routine (shipments, growth) goes into `routine`.
export function settlementsSeason(state, { routine = null, cutOff = false } = {}) {
  const out = { urgent: [], events: [] };
  const quiet = routine || out.events;
  for (const t of state.settlements || []) {
    // The governor practices governing.
    if (t.governor) {
      gainExperience(t.governor, governorSkill(t), 1);
      gainExperience(t.governor, 'learning', 0.5);
    }
    const built = buildInTown(state, t);
    if (built) out.events.push(built);

    const ship = expectedShipment(state, t);
    if (!cutOff && ship.amount > 0) {
      state.resources[ship.kind] = (state.resources[ship.kind] || 0) + ship.amount;
      quiet.push(`${t.name} sent home ${ship.amount} ${ship.kind}${ship.lost ? `; ${ship.lost} more was lost on the way, with no road` : ''}.`);
    }
    t.lastShipment = cutOff ? { kind: ship.kind, amount: 0, lost: 0 } : ship;
    // Horses from the wild horse grounds, once your people breed them.
    if (!cutOff && t.role === 'farming' && placeData(t.place).horses && hasKnowledge(state, 'horseBreeding') && seasonIndex(state) !== 3) {
      const foals = Math.max(1, Math.floor(townGroups(state, t).makers / 6));
      state.resources.horses = (state.resources.horses || 0) + foals;
      quiet.push(`${t.name} sent home ${foals} ${foals === 1 ? 'horse' : 'horses'}.`);
    }

    // Loyalty drifts a quarter of the way toward where it would settle.
    const before = t.loyalty;
    const { target } = loyaltyTarget(state, t);
    const step = (target - t.loyalty) / 4;
    t.loyalty = clamp(t.loyalty + (Math.abs(step) < 1 ? Math.sign(step) : step) + (keepingAll(state, t) ? 3 : 0));
    const was = loyaltyWord(before);
    const now = loyaltyWord(t.loyalty);
    if (was !== now && now !== 'defiant') {
      const worse = t.loyalty < before;
      out.events.push(worse
        ? `${t.name} is ${now} now (loyalty ${t.loyalty}). ${now === 'restless' || now === 'discontent' ? 'It sends home less. Lighter demands, aid, or a wiser governor would help; its screen says why.' : ''}`.trim()
        : `${t.name} is ${now} now (loyalty ${t.loyalty}).`);
    }
    if (keepingAll(state, t) && state.turn + 1 >= t.keepUntil) out.events.push(`${t.name}'s year of keeping all it makes is over. It sends home what its demands ask from next season.`);

    // Each spring the settlement grows on what it keeps, as far as its homes allow.
    if (seasonIndex(state) === 0) {
      const life = townYear(state, t);
      out.urgent.push(...life.urgent);
      out.events.push(...life.events);
      const rate = (DEMANDS[t.demands] || DEMANDS.normal).growth * (t.loyalty < 40 ? 0.5 : 1);
      const room = t.buildings.homes * HOME_ROOM - t.population;
      const expected = t.population * rate;
      const grown = Math.min(Math.max(0, room), Math.floor(expected) + (chance(state, expected % 1) ? 1 : 0));
      if (grown > 0) {
        t.population += grown;
        quiet.push(`${t.name} has grown to ${t.population} people.`);
      } else if (room <= 0) {
        out.events.push(`${t.name} has no room to grow until its governor builds more homes.`);
      }
    }
  }
  return out;
}

// The chance a settlement drives off skirmishers: 10 percent, plus 1 for
// each of its people, plus 10 for each guard (half again behind a palisade,
// twice behind a stone wall), up to 90.
export function townDefense(state, t) {
  const walls = 1 + (t.buildings.stoneWall ? 1 : t.buildings.palisade ? 0.5 : 0);
  const beacons = hasKnowledge(state, 'signalBeacons') ? 0.15 : 0; // Seen coming.
  return Math.min(0.9, 0.1 + beacons + t.population / 100 + 0.1 * townGroups(state, t).guards * walls);
}

// Skarn skirmishers fall on the settlements too. Returns report lines.
export function harrySettlements(state) {
  const lines = [];
  for (const t of state.settlements || []) {
    const region = placeRegion(t.place);
    if (!REGIONS[region].skarn) continue; // Beyond the Skarn's reach.
    if (region === 'hills' && passHeld(state)) continue; // The pass is held against them.
    if (armyHolding(state, region) && region !== 'valley') continue; // Your army there keeps them off.
    if (!chance(state, harryChance(state) * 0.5 * (hasRoad(state, t) ? 0.7 : 1))) continue;
    if (chance(state, townDefense(state, t))) {
      skarnLosses(state, 1);
      lines.push(`Skarn skirmishers came against ${t.name}, and its guards drove them off.`);
      continue;
    }
    const lost = t.population >= 20 ? randomInt(state, 1, 2) : 1;
    t.population = Math.max(3, t.population - lost);
    t.harriedAt = state.turn;
    t.loyalty = clamp(t.loyalty - 5);
    if (!state.lastHarm) state.lastHarm = {};
    state.lastHarm.skarn = state.turn;
    lines.push(`Skarn skirmishers fell on ${t.name}. ${lost === 1 ? 'One settler was' : `${lost} settlers were`} killed, and its people feel unprotected. More guards there would help.`);
  }
  return lines;
}

export function inNationEra(state) {
  return eraAtLeast(state, 'nation');
}

// A settlement that has turned defiant, if any.
export function defiantTown(state) {
  return (state.settlements || []).find((t) => t.loyalty < 20 && !keepingAll(state, t)) || null;
}

// The best person in the capital to send to govern a settlement, or null.
export function bestGovernorFor(state, t) {
  const skill = governorSkill(t);
  const options = notablePeople(state).filter(fitToGovern);
  return options.sort((a, b) => (b.skills[skill] + b.skills.learning) - (a.skills[skill] + a.skills.learning))[0] || null;
}
