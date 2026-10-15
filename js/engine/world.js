// The world beyond the valley, and the expeditions that find it. The player
// chooses where a party goes, who leads it, how many go, and how long they
// explore; the party then travels, explores a season at a time, and comes
// home with what it found. Choices on the way are events of their own
// (expeditionEvents.js).

import {
  REGIONS, REGION_ORDER, WORLD_PLACES, WORLD_PLACE_ORDER, HOPS, initialWorld,
} from './worldData.js';
import {
  living, seasonIndex, hasKnowledge, eraAtLeast, makePerson, knowledgeBlocker,
} from './state.js';
import { KNOWLEDGE } from './data.js';
import { recordDeed, hasTradition } from './legacy.js';
import { gainExperience } from './skills.js';
import { applyStudy, learnNow } from './study.js';
import { chance, pick, randomInt } from './rng.js';
import { refreshAdvisors } from './advisors.js';
import { listWords, clamp } from './util.js';

export const PARTY_SIZE = [3, 8];
export const EXPLORE_SEASONS = [1, 4];
export const MAX_EXPEDITIONS = 2;
export const KEEP_HOME = 20; // People who must stay in the capital.

export { initialWorld };

// When the Nation era begins, the regions around the valley are known by name.
export function openWorld(state) {
  if (!state.world) state.world = initialWorld();
  const heard = [];
  for (const id of REGIONS.valley.neighbors) {
    if (state.world.regions[id].status === 'unknown') {
      state.world.regions[id].status = 'heard';
      heard.push(id);
    }
  }
  return heard;
}

export function worldOpen(state) {
  return Boolean(state.world) && eraAtLeast(state, 'nation');
}

export function regionStatus(state, id) {
  return (state.world && state.world.regions[id] && state.world.regions[id].status) || 'unknown';
}

export function regionMapped(state, id) {
  return Boolean(state.world && state.world.regions[id] && state.world.regions[id].mapped);
}

export function regionPlaces(id) {
  return WORLD_PLACE_ORDER.filter((p) => WORLD_PLACES[p].region === id);
}

export function placeFound(state, id) {
  return Boolean(state.world && state.world.places[id] && state.world.places[id].known);
}

export function foundIn(state, regionId) {
  return regionPlaces(regionId).filter((p) => placeFound(state, p));
}

export function regionDone(state, regionId) {
  return foundIn(state, regionId).length >= regionPlaces(regionId).length;
}

// Regions an expedition could set out for: known by name or explored, with
// places still to find, next to the valley or to a region already explored.
export function expeditionTargets(state) {
  if (!worldOpen(state)) return [];
  return REGION_ORDER.filter((id) => id !== 'valley' && regionStatus(state, id) !== 'unknown' && !regionDone(state, id)
    && REGIONS[id].neighbors.some((n) => regionStatus(state, n) === 'explored'));
}

// Seasons of travel each way: one for each region between, none by river
// boat to the lake country and the coast, and one less through a mapped
// region.
export function travelTime(state, regionId) {
  let t = Math.max(0, HOPS[regionId] - 1);
  if (REGIONS[regionId].river && hasKnowledge(state, 'riverBoats')) t = 0;
  const between = REGIONS[regionId].neighbors.filter((n) => HOPS[n] === HOPS[regionId] - 1);
  if (t > 0 && (regionMapped(state, regionId) || between.some((n) => n !== 'valley' && regionMapped(state, n)))) t -= 1;
  return t;
}

// Food each member eats a season on the road: 2, or 1 with Salting.
export function travelRation(state) {
  return hasKnowledge(state, 'salting') && (state.resources.salt || 0) > 0 ? 1 : 2;
}

export function expeditionFood(state, regionId, size, seasons) {
  return size * travelRation(state) * (seasons + 2 * travelTime(state, regionId));
}

// Who can lead an expedition: healthy adults in the capital.
export function leaderChoices(state) {
  return living(state).filter((p) => p.age >= 16 && p.health >= 60 && !p.sick)
    .sort((a, b) => b.skills.scouting - a.skills.scouting || b.skills.hunting - a.skills.hunting);
}

// Why no expedition can set out now, or null.
export function expeditionBlocker(state) {
  if (!worldOpen(state)) return 'Expeditions beyond the valley begin in the Nation era.';
  if (state.siege) return 'No one can leave while the Skarn besiege the capital.';
  if ((state.world.expeditions || []).length >= MAX_EXPEDITIONS) return `${MAX_EXPEDITIONS} expeditions are out already. Wait for one to come home.`;
  if (!expeditionTargets(state).length) return 'There is nowhere left to explore that your people have heard of.';
  if (living(state).length < KEEP_HOME + PARTY_SIZE[0]) return `At least ${KEEP_HOME} people must stay in the capital.`;
  if (!leaderChoices(state).length) return 'No one in the capital is fit to lead an expedition.';
  return null;
}

export function expeditionById(state, id) {
  return (state.world.expeditions || []).find((x) => x.id === Number(id)) || null;
}

// Sends an expedition. Returns { error } or { message }.
export function sendExpedition(state, {
  region, leaderId, size, seasons,
}) {
  const why = expeditionBlocker(state);
  if (why) return { error: why };
  if (!expeditionTargets(state).includes(region)) return { error: 'Choose a region your people have heard of, next to one they know.' };
  const n = Number(size);
  const most = Math.min(PARTY_SIZE[1], living(state).length - KEEP_HOME);
  if (!Number.isInteger(n) || n < PARTY_SIZE[0] || n > most) return { error: `Choose between ${PARTY_SIZE[0]} and ${most} people.` };
  const stay = Number(seasons);
  if (!Number.isInteger(stay) || stay < EXPLORE_SEASONS[0] || stay > EXPLORE_SEASONS[1]) return { error: 'Choose 1 to 4 seasons of exploring.' };
  const leader = leaderChoices(state).find((p) => p.id === Number(leaderId));
  if (!leader) return { error: 'Choose a leader who is fit to travel.' };
  const food = expeditionFood(state, region, n, stay);
  if (state.resources.food < food) return { error: `The journey needs ${food} food; you have ${state.resources.food}.` };
  // The rest of the party: the best scouts and hunters who can be spared.
  const council = new Set(Object.values(state.advisors));
  const others = living(state).filter((p) => p !== leader && !council.has(p.id) && p.age >= 16 && p.age <= 50 && p.health >= 60 && !p.sick)
    .sort((a, b) => (b.skills.scouting + b.skills.hunting) - (a.skills.scouting + a.skills.hunting))
    .slice(0, n - 1);
  if (others.length < n - 1) return { error: 'Not enough people are fit to travel.' };
  const party = [leader, ...others];
  const ids = new Set(party.map((p) => p.id));
  state.people = state.people.filter((p) => !ids.has(p.id));
  state.resources.food -= food;
  refreshAdvisors(state);
  const travel = travelTime(state, region);
  const exp = {
    id: state.world.nextExpedition++,
    region,
    leader: leader.id,
    party: party.map((p) => ({ ...p, task: 'expedition' })),
    food,
    plan: stay,
    stage: travel > 0 ? 'out' : 'exploring',
    left: travel > 0 ? travel : stay,
    found: [],
    lost: [],
    sent: state.turn,
    skip: 0,
    pendingChoice: null,
  };
  state.world.expeditions.push(exp);
  if (travel === 0) arrive(state, exp);
  return { message: `${leader.name} leads ${n - 1} others toward ${REGIONS[region].name.toLowerCase()}, with ${food} food. ${travel ? `The journey there takes ${travel === 1 ? 'a season' : `${travel} seasons`}; then they` : 'They'} will explore for ${stay === 1 ? 'a season' : `${stay} seasons`} and come home.` };
}

// The party reaches its region: it is explored, and its neighbors heard of.
function arrive(state, exp) {
  const r = state.world.regions[exp.region];
  const first = r.status !== 'explored';
  r.status = 'explored';
  const heard = [];
  for (const n of REGIONS[exp.region].neighbors) {
    if (regionStatus(state, n) === 'unknown') {
      state.world.regions[n].status = 'heard';
      heard.push(n);
    }
  }
  return { first, heard };
}

export function recallExpedition(state, { id }) {
  const exp = expeditionById(state, id);
  if (!exp) return { error: 'There is no such expedition.' };
  if (exp.stage === 'home') return { error: 'They are already on their way home.' };
  turnHome(state, exp);
  return { message: `A runner has gone to call ${leaderName(exp)}'s party home from ${REGIONS[exp.region].name.toLowerCase()}.` };
}

// Turns a party for home: the way back is as long as they have come.
export function turnHome(state, exp) {
  const travel = travelTime(state, exp.region);
  exp.left = exp.stage === 'out' ? Math.max(0, travel - exp.left) : travel;
  exp.stage = 'home';
}

export function leaderName(exp) {
  const leader = exp.party.find((p) => p.id === exp.leader) || exp.party[0];
  return leader ? leader.name : 'the';
}

function leaderOf(exp) {
  return exp.party.find((p) => p.id === exp.leader) || null;
}

// The chance of finding a new place in a season of exploring.
export function findChance(state, exp) {
  const leader = leaderOf(exp);
  let p = 0.35 + 0.07 * (leader ? leader.skills.scouting : 0) + 0.04 * Math.max(0, exp.party.length - 3);
  if (regionMapped(state, exp.region)) p += 0.15;
  if (hasTradition(state, 'horizons')) p += 0.1;
  return Math.min(0.9, p);
}

// The chance that someone in the party comes to harm in a season.
export function riskChance(state, exp) {
  const region = REGIONS[exp.region];
  let p = 0.05;
  if (seasonIndex(state) === 3) p += region.hardWinter ? 0.2 : 0.1;
  for (const id of foundIn(state, exp.region)) p += WORLD_PLACES[id].risk || 0;
  if (exp.party.length >= 6) p *= 0.8;
  const leader = leaderOf(exp);
  if (leader && Math.max(leader.skills.scouting, leader.skills.hunting) >= 4) p *= 0.8;
  if (regionMapped(state, exp.region)) p *= 0.5;
  if (hasTradition(state, 'horizons')) p *= 0.8;
  return p;
}

// Applies what finding a place brings. Returns the words for it.
export function findPlace(state, exp, placeId) {
  const place = WORLD_PLACES[placeId];
  state.world.places[placeId].known = true;
  exp.found.push(placeId);
  const bits = [];
  if (place.kind === 'wonder') {
    recordDeed(state, 'wonders');
    for (const p of living(state)) p.morale = clamp(p.morale + 6);
    bits.push('Everyone at home was lifted by the telling of it.');
  }
  if (place.study) {
    const studied = applyStudy(state, place.study);
    bits.push(`What they learned there gave ${place.study} points toward your studies.`, ...studied.urgent);
  }
  if (place.reveals) {
    const k = state.knowledge;
    const ready = [k.current, ...k.queue, ...Object.keys(KNOWLEDGE)].filter((id) => id && !knowledgeBlocker(state, id));
    if (ready.length) bits.push(`The tablets held lost knowledge. ${learnNow(state, ready[0])}`);
    else {
      applyStudy(state, 60);
      bits.push('The tablets were worth 60 points toward your studies.');
    }
  }
  if (place.kind === 'people') exp.pendingChoice = { id: 'smallPeople', place: placeId };
  return `${place.name}: ${place.description}${bits.length ? ` ${bits.join(' ')}` : ''}`;
}

// What befell someone in the party.
function harm(state, exp) {
  const region = REGIONS[exp.region];
  const winter = seasonIndex(state) === 3;
  const victim = pick(state, exp.party);
  const dangers = foundIn(state, exp.region).filter((id) => WORLD_PLACES[id].kind === 'danger');
  const cause = winter ? (region.hardWinter ? 'in the deep cold' : 'in a winter storm')
    : dangers.includes('wolfCountry') ? 'by wolves'
      : dangers.includes('burnedCamp') ? 'by riders on the plains'
        : pick(state, ['in a fall', 'crossing a river', 'by a wild beast']);
  if (chance(state, 0.35)) {
    exp.party = exp.party.filter((p) => p !== victim);
    exp.lost.push(victim.name);
    if (victim.id === exp.leader && exp.party.length) exp.leader = [...exp.party].sort((a, b) => b.skills.scouting - a.skills.scouting)[0].id;
    return `${victim.name} was killed ${cause}.`;
  }
  victim.health = clamp(victim.health - randomInt(state, 25, 40));
  return `${victim.name} was hurt ${cause}.`;
}

// Brings an expedition home. Returns the report line.
function comeHome(state, exp) {
  const leader = leaderName(exp);
  for (const p of exp.party) state.people.push({ ...p, task: 'rest', orderReturn: null });
  state.world.expeditions = state.world.expeditions.filter((x) => x !== exp);
  refreshAdvisors(state);
  const region = REGIONS[exp.region].name.toLowerCase();
  let mapped = '';
  if (hasKnowledge(state, 'mapmaking') && !state.world.regions[exp.region].mapped && regionStatus(state, exp.region) === 'explored') {
    state.world.regions[exp.region].mapped = true;
    mapped = ` They drew a map of ${region}: it is a season closer now, safer, and its places easier to find.`;
  }
  const found = exp.found.length ? `They found ${listWords(exp.found.map((id) => WORLD_PLACES[id].name))}.` : 'They found nothing new.';
  const lost = exp.lost.length ? ` ${listWords(exp.lost)} did not come back.` : '';
  const left = exp.food > 0 ? ` ${exp.food} food came back with them.` : '';
  state.resources.food += exp.food;
  const back = exp.party.length;
  if (!back) return `None of the expedition to ${region} came home.${lost}`;
  return `${leader}'s expedition is home from ${region}, ${back === 1 ? 'one of them' : `${back} of them`}. ${found}${lost}${left}${mapped}`;
}

// Runs each season. Returns { urgent, events }.
export function expeditionsSeason(state) {
  const out = { urgent: [], events: [] };
  if (!state.world) return out;
  const s = seasonIndex(state);
  for (const exp of [...state.world.expeditions]) {
    const region = REGIONS[exp.region];
    const where = region.name.toLowerCase();
    const word = (text) => out.events.push(`Word from ${leaderName(exp)}'s expedition to ${where}: ${text}`);
    // They eat what they carry.
    const need = exp.party.length * travelRation(state);
    if (exp.food >= need) exp.food -= need;
    else {
      exp.food = 0;
      for (const p of exp.party) p.health = clamp(p.health - 20);
      const starved = exp.party.filter((p) => p.health <= 0);
      if (starved.length) {
        exp.party = exp.party.filter((p) => p.health > 0);
        exp.lost.push(...starved.map((p) => p.name));
      }
      if (exp.stage !== 'home') turnHome(state, exp);
      out.urgent.push(`${leaderName(exp)}'s expedition to ${where} has run out of food, and is coming home hungry.${starved.length ? ` ${listWords(starved.map((p) => p.name))} did not survive it.` : ''}`);
    }
    // Practice: the road teaches scouting.
    for (const p of exp.party) gainExperience(p, 'scouting', p.id === exp.leader ? 1.5 : 1);
    // Snow closes the passes of the iron hills in winter.
    if (region.winterPasses && s === 3) {
      word('Snow has closed the passes. They are sheltering until spring.');
      continue;
    }
    if (exp.stage !== 'home' && chance(state, riskChance(state, exp))) word(harm(state, exp));
    if (!exp.party.length) {
      out.urgent.push(comeHome(state, exp));
      continue;
    }
    if (exp.stage === 'out') {
      exp.left -= 1;
      if (exp.left <= 0) {
        const { first, heard } = arrive(state, exp);
        exp.stage = 'exploring';
        exp.left = exp.plan;
        word(`They have reached it${first ? '' : ' again'}.${heard.length ? ` Beyond it, they hear, lies ${listWords(heard.map((n) => REGIONS[n].name.toLowerCase()))}.` : ''}`);
      }
      continue;
    }
    if (exp.stage === 'exploring') {
      if (exp.skip > 0) exp.skip -= 1;
      else if (chance(state, findChance(state, exp))) {
        const options = regionPlaces(exp.region).filter((id) => !placeFound(state, id));
        if (options.length) word(`They found ${findPlace(state, exp, pick(state, options))}`);
      }
      if (!exp.pendingChoice && chance(state, 0.25)) exp.pendingChoice = { id: pickEvent(state, exp) };
      exp.left -= 1;
      if (exp.left <= 0 || regionDone(state, exp.region)) {
        exp.stage = 'home';
        exp.left = travelTime(state, exp.region);
        if (regionDone(state, exp.region) && exp.left >= 0) word(`They have found all there is to find in ${where}, and are turning for home.`);
      }
      if (exp.stage === 'home' && exp.left <= 0) out.events.push(comeHome(state, exp));
      continue;
    }
    // On the way home.
    exp.left -= 1;
    if (exp.left <= 0) out.events.push(comeHome(state, exp));
  }
  return out;
}

// A choice that comes up on the way, fitting where they are.
function pickEvent(state, exp) {
  const options = ['expFord', 'expStrangers', 'expFever'];
  if (['ruins', 'hills', 'coast', 'desert'].includes(exp.region)) options.push('expDig');
  return pick(state, options);
}

// An expedition with a choice waiting, if any (it comes before other events).
export function expeditionCrisis(state) {
  if (!state.world) return null;
  const exp = (state.world.expeditions || []).find((x) => x.pendingChoice);
  return exp ? { exp, id: exp.pendingChoice.id } : null;
}

// Everyone away on expeditions, for counting the nation.
export function peopleAway(state) {
  return state.world ? state.world.expeditions.reduce((sum, x) => sum + x.party.length, 0) : 0;
}

// Newcomers from a small people, who come home with the expedition.
export function joiners(state, exp, count, people) {
  for (let i = 0; i < count; i++) {
    const skills = { hunting: randomInt(state, 0, 2), foraging: randomInt(state, 1, 3), building: randomInt(state, 0, 2), healing: randomInt(state, 0, 1), scouting: randomInt(state, 1, 3), learning: randomInt(state, 0, 2) };
    const p = makePerson({ name: `${people.title === 'Reed folk' ? pick(state, ['Ossa', 'Teal', 'Wenna', 'Corra', 'Linnet', 'Ebb']) : pick(state, ['Bran', 'Hulda', 'Grim', 'Sigrun', 'Tor', 'Ketla'])} of the ${people.title}`, note: `One of ${people.name}, who came home with your expedition.`, age: randomInt(state, 16, 32), skills }, state.nextPersonId++, 'expedition');
    exp.party.push(p);
  }
}
