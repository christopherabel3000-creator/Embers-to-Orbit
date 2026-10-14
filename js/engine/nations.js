// The valley peoples as nations. Once the camp becomes a village, the
// Velari, Tellani, and Skarn grow each year: their people, their warriors,
// and the land they claim. Treaties bind them to you, and they remember
// whether you kept your word.

import { NEIGHBORS, NEIGHBOR_ORDER, NATIONS, TREATIES, PLACES } from './data.js';
import {
  living, inVillage, year, isKnown, placeName, seasonIndex, canFight, knownPlaces, taskAvailable,
} from './state.js';
import {
  expectedFood, expectedWood, expectedStone, siteFor,
} from './rules.js';
import { changeRelation, skarnAtPeace } from './neighbors.js';
import { chance, randomInt, randomBetween } from './rng.js';
import { fighterStrength, foeStrengthFor } from './battle.js';
import { clamp, listWords, capital } from './util.js';
import { lawIs } from './laws.js';
import { swordsHelp } from './goods.js';
import { skarnStrength, clanLosses, clansYear, clansMarching } from './clans.js';
import { skarnApproach } from './siege.js';
import { raidScale } from './difficulty.js';

const WORK_TASKS = ['hunt', 'forage', 'wood', 'quarry'];

export function nationsActive(state) {
  return inVillage(state) && Boolean(state.neighbors.skarn.nation);
}

export function nation(state, id) {
  return state.neighbors[id].nation || null;
}

// The share of a nation's people under arms. The Skarn keep more on harder
// difficulties (see difficulty.js).
export function underArms(state, id) {
  return NATIONS[id].warriors * (id === 'skarn' ? raidScale(state) : 1);
}

// When the difficulty changes, the Skarn and the hill clans with them grow
// or shrink at once by the ratio between the new and the old.
export function rescaleSkarn(state, ratio) {
  const nat = nation(state, 'skarn');
  if (nat) {
    nat.warriors = Math.max(0, Math.round(nat.warriors * ratio));
    nat.population = Math.max(nat.population, nat.warriors);
  }
  if (state.clans) state.clans.warriors = Math.max(0, Math.round(state.clans.warriors * ratio));
}

// Sets the nations up when the village is founded.
export function startNations(state) {
  const y = year(state);
  for (const id of NEIGHBOR_ORDER) {
    const def = NATIONS[id];
    const population = def.start(y);
    state.neighbors[id].nation = {
      population,
      warriors: Math.round(population * underArms(state, id)),
      wealth: population * 2,
      treaties: { trade: false, openLands: false, alliance: false },
      trust: 50,
      memory: [],
    };
    state.places[NEIGHBORS[id].home].owner = id;
  }
  state.places.camp.owner = 'player';
  state.valley = { ...VALLEY_START };
}

// ----- Relations between the nations themselves -----
// The Velari and Tellani start friendly; both are hostile to the Skarn.
// Relations drift back toward these slowly, and events push them about.
export const VALLEY_START = { 'tellani|velari': 30, 'skarn|velari': -40, 'skarn|tellani': -20 };

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

export function between(state, a, b) {
  const key = pairKey(a, b);
  if (!state.valley) state.valley = { ...VALLEY_START };
  return state.valley[key] ?? VALLEY_START[key] ?? 0;
}

export function shiftBetween(state, a, b, delta) {
  const key = pairKey(a, b);
  if (!state.valley) state.valley = { ...VALLEY_START };
  state.valley[key] = Math.max(-100, Math.min(100, Math.round(between(state, a, b) + delta)));
}

// Lines for the Neighbors screen, for the pairs the player knows.
export function valleyLines(state, word) {
  const pairs = [['velari', 'tellani'], ['velari', 'skarn'], ['tellani', 'skarn']];
  return pairs.filter(([a, b]) => state.neighbors[a].known && state.neighbors[b].known)
    .map(([a, b]) => `${capital(NEIGHBORS[a].name)} and ${NEIGHBORS[b].name}: ${word(between(state, a, b))} (${between(state, a, b)}).`);
}

// Each year: relations drift home, the Velari and Tellani trade, and two
// peoples who hate each other come to blows. Returns report lines.
function valleyRelationsYear(state) {
  const lines = [];
  for (const [key, base] of Object.entries(VALLEY_START)) {
    const [a, b] = key.split('|');
    const now = between(state, a, b);
    if (now > base) shiftBetween(state, a, b, -Math.min(3, now - base));
    else if (now < base) shiftBetween(state, a, b, Math.min(3, base - now));
  }
  if (between(state, 'velari', 'tellani') > 0) shiftBetween(state, 'velari', 'tellani', 2); // They trade.
  if (between(state, 'velari', 'tellani') <= -40) {
    for (const id of ['velari', 'tellani']) {
      const nat = nation(state, id);
      nat.warriors = Math.max(1, nat.warriors - randomInt(state, 1, 2));
    }
    if (state.neighbors.velari.known && state.neighbors.tellani.known) {
      lines.push('News from the valley: the Velari and the Tellani have come to blows along the river. Both lost warriors.');
    }
  }
  return lines;
}

// ----- Trust and memory -----

export function remember(state, id, text, trustChange = 0) {
  const nat = nation(state, id);
  if (!nat) return;
  nat.trust = clamp(nat.trust + trustChange);
  nat.memory.push({ turn: state.turn, year: year(state), text, kind: trustChange < 0 ? 'broken' : 'kept' });
  if (nat.memory.length > 12) nat.memory.shift();
}

export function trustWord(trust) {
  if (trust >= 80) return 'they trust you deeply';
  if (trust >= 60) return 'they trust you';
  if (trust >= 40) return 'they are wary of you';
  if (trust >= 20) return 'they distrust you';
  return 'they think you a liar';
}

// How trust and treaties shift the attitude a people drifts toward.
export function trustShift(state, id) {
  const nat = nation(state, id);
  if (!nat) return 0;
  return Math.round((nat.trust - 50) / 5) + (nat.treaties.trade ? 5 : 0);
}

// ----- Territory -----

export function owner(state, placeId) {
  return (state.places[placeId] && state.places[placeId].owner) || null;
}

export function landsOf(state, who) {
  return Object.keys(state.places).filter((id) => owner(state, id) === who);
}

// Places the village may hold besides its own camp.
export function claimLimit(state) {
  return 2 + Math.floor(living(state).length / 10) + 2 * (state.settlements || []).length;
}

// Who would have liked to claim a place for themselves.
function wantedBy(placeId) {
  return NEIGHBOR_ORDER.filter((id) => NATIONS[id].expansion.includes(placeId));
}

export function claimBlocker(state, placeId) {
  if (!nationsActive(state)) return 'Places can be claimed once your camp is a village.';
  if (!PLACES[placeId] || !isKnown(state, placeId)) return 'Your people have not found that place.';
  const who = owner(state, placeId);
  if (who === 'player') return 'It is already yours.';
  if (who) return `It belongs to ${NEIGHBORS[who].name}.`;
  const held = landsOf(state, 'player').length - 1; // Not counting the camp.
  if (held >= claimLimit(state)) return `Your village can hold ${claimLimit(state)} places besides its own; it needs more people to hold more.`;
  const touches = PLACES[placeId].neighbors.some((id) => owner(state, id) === 'player');
  if (!touches) return 'It must border land you already hold.';
  return null;
}

// Returns { error } or { message }.
export function claimPlace(state, placeId) {
  const why = claimBlocker(state, placeId);
  if (why) return { error: why };
  state.places[placeId].owner = 'player';
  const upset = wantedBy(placeId).filter((id) => state.neighbors[id].known);
  for (const id of upset) {
    changeRelation(state, id, -4);
    nation(state, id).trust = clamp(nation(state, id).trust - 3);
  }
  const note = upset.length ? ` ${capital(upset.map((id) => NEIGHBORS[id].name).join(' and '))} had their eye on it, and are not pleased.` : '';
  return { message: `${placeName(state, placeId)} is now yours.${note}` };
}

// Whether the village can work a place without angering anyone: its own
// land, unclaimed land, or the land of a people with an open lands pact.
export function freeToWork(state, placeId) {
  const who = owner(state, placeId);
  if (!who || who === 'player') return true;
  const nat = nation(state, who);
  return !nat || Boolean(nat.treaties.openLands);
}

// Working another people's land without their leave angers them.
export function borderFriction(state) {
  const lines = [];
  if (!nationsActive(state)) return lines;
  const people = living(state);
  const offended = new Map();
  for (const task of WORK_TASKS) {
    const site = state.workSites[task];
    if (freeToWork(state, site)) continue;
    if (!people.some((p) => p.task === task)) continue;
    const who = owner(state, site);
    offended.set(who, [...(offended.get(who) || []), site]);
  }
  for (const [who, sites] of offended) {
    changeRelation(state, who, -2);
    lines.push(`Your people worked ${[...new Set(sites)].map((id) => placeName(state, id)).join(' and ')}, land that belongs to ${NEIGHBORS[who].name}. They are angry. An open lands pact, or other work sites, would end it.`);
  }
  return lines;
}

const WORKERS = {
  hunt: 'hunters', forage: 'foragers', wood: 'woodcutters', quarry: 'quarriers',
};

// What a season's work at a place is worth, for comparing places. Uses the
// people on the task now (or anyone, if no one is), and a growing season
// for foraging, since nothing is foraged in winter.
function siteValue(state, task, placeId) {
  const people = living(state);
  const workers = people.filter((p) => p.task === task);
  const crew = workers.length ? workers : people.slice(0, 1);
  const was = state.workSites[task];
  state.workSites[task] = placeId;
  const s = task === 'forage' && seasonIndex(state) === 3 ? 1 : seasonIndex(state);
  let total = 0;
  for (const p of crew) {
    if (task === 'hunt' || task === 'forage') total += expectedFood(state, p, task, s);
    else if (task === 'wood') total += expectedWood(state, p, task, s);
    else total += expectedStone(state, p);
  }
  state.workSites[task] = was;
  return total;
}

// The best known place for a task that the village can work freely.
// The camp always qualifies, so there is always somewhere.
export function bestFreeSite(state, task) {
  const options = knownPlaces(state)
    .filter((id) => PLACES[id].tasks.includes(task) && freeToWork(state, id));
  let best = null;
  let bestValue = -Infinity;
  for (const id of options) {
    const value = siteValue(state, task, id) - PLACES[id].distance * 0.01; // Ties go to the nearer place.
    if (value > bestValue) {
      best = id;
      bestValue = value;
    }
  }
  return best;
}

// At the start of each season, the council moves work off land another
// people holds, unless the player chose that land for the work themselves.
// Returns a line for the speaker to report, or null.
export function moveOffForeignLand(state) {
  if (!nationsActive(state)) return null;
  const chosen = state.foreignWorkOk || {};
  const moves = [];
  for (const task of WORK_TASKS) {
    if (!taskAvailable(state, task)) continue;
    const site = siteFor(state, task);
    if (freeToWork(state, site) || chosen[task] === site) continue;
    const next = bestFreeSite(state, task);
    if (!next || next === site) continue;
    state.workSites[task] = next;
    moves.push({ task, from: site, to: next, who: owner(state, site) });
  }
  if (!moves.length) return null;
  const places = [...new Set(moves.map((m) => placeName(state, m.from)))];
  const owners = [...new Set(moves.map((m) => NEIGHBORS[m.who].name))];
  const moved = moves.map((m) => `the ${WORKERS[m.task]} to ${placeName(state, m.to)}`);
  return `${listWords(places)} ${places.length === 1 ? 'belongs' : 'belong'} to ${listWords(owners)} now, so the council moved ${listWords(moved)}. `
    + 'Working another people\'s land angers them every season. To go back, make an open lands pact, or choose the place yourself on the Map screen.';
}

// ----- Treaties -----

export function treatyBlocker(state, id, key) {
  const t = TREATIES[key];
  const n = state.neighbors[id];
  const nat = nation(state, id);
  if (!t || !nat) return 'That is not possible with them.';
  if (!t.with.includes(id)) return 'They would never agree to that.';
  if (nat.treaties[key]) return 'That treaty is already in force.';
  if (n.relation < t.relation) return `Relations must be at least ${t.relation}.`;
  if (nat.trust < t.trust) return `They do not trust you enough yet. ${capital(trustWord(nat.trust))}.`;
  return null;
}

export function makeTreaty(state, id, key) {
  const why = treatyBlocker(state, id, key);
  if (why) return { error: why };
  nation(state, id).treaties[key] = true;
  changeRelation(state, id, 3);
  remember(state, id, `agreed to ${TREATIES[key].phrase} in Year ${year(state)}`, 2);
  return { message: `${capital(NEIGHBORS[id].name)} agreed to ${TREATIES[key].phrase}. ${TREATIES[key].effect}` };
}

export function endTreaty(state, id, key) {
  const nat = nation(state, id);
  if (!nat || !nat.treaties[key]) return { error: 'There is no such treaty with them.' };
  nat.treaties[key] = false;
  changeRelation(state, id, -5);
  nat.trust = clamp(nat.trust - 5);
  return { message: `You ended ${TREATIES[key].phrase.replace(/^an? /, 'the ')} with ${NEIGHBORS[id].name}. They took it coldly.` };
}

export function allies(state) {
  return NEIGHBOR_ORDER.filter((id) => nation(state, id) && nation(state, id).treaties.alliance);
}

// ----- War -----

// The war band the Skarn send against the village: a share of their
// warriors, and of any hill clansmen marching with them.
export function skarnBand(state) {
  return Math.max(4, Math.round(skarnStrength(state) * (0.5 + 0.3 * (randomInt(state, 0, 100) / 100))));
}

// The Skarn learn war as a nation: forging better blades, copying your bows
// and shields, and training their young. Each year as a nation their warriors
// fight 6 percent better, up to twice as well as the old raiders: they strike
// harder and are harder to bring down.
export const SKARN_ARMS_PER_YEAR = 0.06;
export const SKARN_ARMS_MAX = 2.0;
export function skarnArms(state) {
  if (!nation(state, 'skarn') || state.villageFounded == null) return 1;
  const years = Math.max(0, state.turn - state.villageFounded) / 4;
  return Math.min(SKARN_ARMS_MAX, 1 + SKARN_ARMS_PER_YEAR * years);
}

export function skarnArmsWord(state) {
  const a = skarnArms(state);
  if (a >= 1.7) return 'as well armed and drilled as any people in the valley';
  if (a >= 1.3) return 'better armed and drilled than the old raiders';
  if (a > 1.05) return 'learning to fight as a nation';
  return 'armed like the old raiders';
}

// Allies send warriors when raiders come. Returns the number who come.
export function alliedHelpers(state) {
  return allies(state).reduce((sum, id) => sum + Math.round(nation(state, id).warriors * 0.3), 0) + swordsHelp(state);
}

// "Your allies, the Velari, and your sell-swords": who comes to help.
export function helpersText(state) {
  const parts = [];
  const al = allies(state);
  if (al.length) parts.push(`your allies, ${al.map((id) => NEIGHBORS[id].name).join(' and ')}`);
  if (swordsHelp(state)) parts.push('your sell-swords');
  return capital(parts.join(', and '));
}

// Skarn warriors who fall in battle are lost to their nation; hill
// clansmen marching with them fall in proportion. Returns the clansmen lost.
export function skarnLosses(state, fallen) {
  const nat = nation(state, 'skarn');
  if (!nat || fallen <= 0) return 0;
  const clansmen = clanLosses(state, fallen);
  const own = fallen - clansmen;
  nat.warriors = Math.max(0, nat.warriors - own);
  nat.population = Math.max(nat.warriors, nat.population - Math.ceil(own / 2)); // Many of the fallen are only wounded.
  return clansmen;
}

// How often the Skarn raid depends on how many warriors they have.
export function skarnRaidFactor(state) {
  const nat = nation(state, 'skarn');
  if (!nat) return 1;
  return Math.max(0.2, Math.min(1.5, skarnStrength(state) / 20));
}

// ----- Skirmishers -----
// The Skarn rarely storm a walled village. Instead their skirmishers fall on
// your people working out in the open. Guards on watch may drive them off.

export function harryChance(state) {
  if (!nationsActive(state) || skarnAtPeace(state) || !state.neighbors.skarn.known) return 0;
  const guards = living(state).filter((p) => p.task === 'guard' && p.health >= 40).length;
  const watched = lawIs(state, 'strangers', 'closed') ? 0.5 : 1; // Closed gates: strangers are watched.
  return Math.min(0.5, nation(state, 'skarn').warriors / (40 + 10 * guards)) * watched;
}

// Once the Skarn can spare a real band, some skirmishes become ambushes: a
// battle in the open with the workers at that place, which they can fight
// or flee (see battle.js and raid.js).
export const AMBUSH_WARRIORS = 20; // Skarn warriors needed before they ambush.
export const AMBUSH_SHARE = 0.5; // Share of skirmishes that are ambushes once they do.
export const AMBUSH_MAX_SHARE = 0.5; // A band is at most this share of their warriors.
// The Skarn watch your workers and bring a band worth about as much as they
// are, from AMBUSH_SIZE[0] to AMBUSH_SIZE[1] times. Guards who come running
// are more than they planned for.
export const AMBUSH_SIZE = [1.8, 3];

export function ambushBand(state, workers) {
  const prey = workers.reduce((sum, p) => sum + fighterStrength(state, p), 0);
  const foe = foeStrengthFor(state, { from: 'skarn' }, 'defend');
  const wanted = Math.round(prey * randomBetween(state, AMBUSH_SIZE[0], AMBUSH_SIZE[1]) * raidScale(state) / foe);
  return Math.max(4, Math.min(Math.round(nation(state, 'skarn').warriors * AMBUSH_MAX_SHARE), wanted));
}

// Runs at the start of a season. Returns report lines. An ambush leaves a
// raid waiting in state.pendingEvent, with ambush set.
export function maybeHarry(state) {
  state.harried = null;
  if (state.pendingEvent || !chance(state, harryChance(state))) return [];
  const people = living(state);
  const exposed = WORK_TASKS
    .map((task) => ({ task, place: state.workSites[task], workers: people.filter((p) => p.task === task) }))
    .filter((x) => x.place && x.place !== 'camp' && x.workers.length);
  if (!exposed.length) return [];
  const target = exposed[randomInt(state, 0, exposed.length - 1)];
  const where = placeName(state, target.place);
  const workerWord = { hunt: 'hunters', forage: 'foragers', wood: 'woodcutters', quarry: 'quarriers' }[target.task];
  const onWatch = people.filter((p) => p.task === 'guard' && p.health >= 40);
  const guards = onWatch.length;
  const fog = state.weather === 'fog'; // Harder to see them coming.
  if (chance(state, Math.min(0.75, 0.15 * guards) * (fog ? 0.5 : 1))) {
    const killed = randomInt(state, 1, 2);
    skarnLosses(state, killed);
    return [`Skarn skirmishers crept toward your ${workerWord} at ${where}, but your guards drove them off and killed ${killed}.`];
  }
  const sk = nation(state, 'skarn');
  const fighters = target.workers.filter(canFight);
  if (sk.warriors >= AMBUSH_WARRIORS && fighters.length && chance(state, AMBUSH_SHARE)) {
    const band = ambushBand(state, fighters);
    // Half the guards on watch, the strongest, come running.
    const running = [...onWatch].sort((a, b) => b.skills.hunting - a.skills.hunting).slice(0, Math.ceil(guards / 2));
    state.pendingEvent = {
      type: 'raid', raiders: band, warned: false, from: 'skarn',
      ambush: { place: target.place, task: target.task },
      eligible: [...fighters, ...running].map((p) => p.id),
      reinforcements: running.map((p) => p.id),
    };
    return [`Ambush! About ${band} Skarn warriors fell on your ${workerWord} at ${where}${fog ? ', out of the fog' : ''}. Only those working there can fight${running.length ? `, and ${running.length === 1 ? 'a guard on watch is' : `${running.length} guards on watch are`} running to join them` : ''}. Decide how to respond before anything else.`];
  }
  state.harried = target.place;
  const hurt = target.workers.slice(0, randomInt(state, 1, 2));
  for (const p of hurt) p.health = clamp(p.health - randomInt(state, 15, 30));
  return [`Skarn skirmishers fell on your ${workerWord} at ${where}. ${hurt.map((p) => p.name).join(' and ')} ${hurt.length === 1 ? 'was' : 'were'} hurt, and anyone still working there this season will bring back half as much. More guards would help, or work closer to home.`];
}

// ----- The year in the valley -----

// Runs each spring once the nations are active. Returns report lines.
export function valleyYear(state) {
  const lines = [];
  if (!nationsActive(state) || seasonIndex(state) !== 0) return lines;
  for (const id of NEIGHBOR_ORDER) {
    const def = NATIONS[id];
    const nat = nation(state, id);
    // Plunder and trade draw newcomers: every 60 in their stores feeds one more.
    const drawn = Math.floor(nat.wealth / 60);
    nat.wealth -= drawn * 60;
    nat.population += Math.max(1, Math.round(nat.population * def.growth)) + drawn;
    // Hill clans flock to the Skarn as the village grows rich and large.
    if (id === 'skarn') {
      const village = living(state).length;
      if (village * 1.2 > nat.population) nat.population += Math.round((village * 1.2 - nat.population) * 0.4);
    }
    // Losses are made good quickly: young people take up arms.
    const target = Math.round(nat.population * underArms(state, id));
    const step = Math.max(3, Math.round(target * 0.35));
    nat.warriors += Math.max(-step, Math.min(step, target - nat.warriors));
    nat.wealth += Math.round(nat.population / 2);
    // Treaties kept for another year build trust.
    const kept = Object.values(nat.treaties).filter(Boolean).length;
    if (kept) nat.trust = clamp(nat.trust + 2 * kept);
    // Expansion: a growing people claims more land.
    const held = landsOf(state, id).length - 1;
    if (held < Math.floor(nat.population / 15)) {
      const next = def.expansion.find((placeId) => !owner(state, placeId));
      if (next) {
        state.places[next].owner = id;
        if (state.neighbors[id].known && isKnown(state, next)) {
          const worked = WORK_TASKS.some((t) => state.workSites[t] === next && living(state).some((p) => p.task === t));
          lines.push(`${capital(NEIGHBORS[id].name)} have claimed ${placeName(state, next)}.${worked && !nat.treaties.openLands ? ' Your people work there, so the council will find them other land.' : ''}`);
        }
      }
    }
  }
  lines.push(...valleyRelationsYear(state));
  const sk = nation(state, 'skarn');
  if (state.neighbors.skarn.known) lines.push(`The Skarn now count about ${sk.warriors} warriors among ${sk.population} people.`);
  lines.push(...clansYear(state));
  // A strong Skarn gathers a great host against the village, giving warning.
  const strength = skarnStrength(state);
  // A host only gathers when it could storm the walls or hem the village in.
  if (state.neighbors.skarn.known && !skarnAtPeace(state) && !state.skarnHost
      && skarnApproach(state, Math.round(strength * 0.9)) !== 'wait' && chance(state, 0.5)) {
    state.skarnHost = state.turn + 1;
    const withClans = clansMarching(state) ? ', hill clansmen among them' : '';
    lines.push(`Scouts bring grim news: the Skarn are gathering a great host of about ${Math.round(strength * 0.9)} warriors${withClans}. They will march on ${state.campName} next season. Tribute, peace, allies, guards, walls, and gifts to the clans could all help.`);
  }
  lines.push(...skarnRaidsOthers(state));
  return lines;
}

// The Skarn raid the other peoples too. An ally will call on you for help.
function skarnRaidsOthers(state) {
  const lines = [];
  const sk = nation(state, 'skarn');
  if (sk.warriors < 8 || !chance(state, 0.35)) return lines;
  // The Skarn fall on whoever is weaker and whom they hate more.
  const score = (id) => nation(state, id).warriors + between(state, 'skarn', id) / 10;
  const target = ['velari', 'tellani'].sort((a, b) => score(a) - score(b))[0];
  shiftBetween(state, 'skarn', target, -10);
  const nat = nation(state, target);
  if (nat.treaties.alliance && !state.pendingEvent && living(state).filter(canFight).length >= 3) {
    state.pendingEvent = { type: 'story', id: 'allyCall', target };
    lines.push(`${capital(NEIGHBORS[target].name)} send word: the Skarn are attacking them, and they call on you as allies. A decision is waiting for you.`);
    return lines;
  }
  resolveSkarnRaid(state, target, false);
  if (state.neighbors[target].known) {
    lines.push(`News from the valley: the Skarn raided ${NEIGHBORS[target].name}, who lost people and stores.`);
  }
  return lines;
}

// What happens when the Skarn raid another people, with or without your help.
export function resolveSkarnRaid(state, target, helped) {
  const nat = nation(state, target);
  const sk = nation(state, 'skarn');
  const lost = helped ? randomInt(state, 0, 1) : randomInt(state, 2, 4);
  nat.population = Math.max(5, nat.population - lost);
  nat.warriors = Math.max(1, nat.warriors - (helped ? 0 : randomInt(state, 1, 2)));
  nat.wealth = Math.max(0, nat.wealth - (helped ? 5 : 30));
  sk.warriors = Math.max(0, sk.warriors - (helped ? randomInt(state, 2, 4) : 1));
  sk.wealth += helped ? 0 : 30;
}

// One-line summary of a nation for the Neighbors screen.
export function nationSummary(state, id) {
  const nat = nation(state, id);
  if (!nat) return '';
  const lands = landsOf(state, id).map((p) => placeName(state, p));
  return `About ${nat.population} people and ${nat.warriors} warriors. Their lands: ${lands.join(', ')}.`;
}

export { skarnAtPeace };
