// The valley peoples as nations. Once the camp becomes a village, the
// Velari, Tellani, and Skarn grow each year: their people, their warriors,
// and the land they claim. Treaties bind them to you, and they remember
// whether you kept your word.

import { NEIGHBORS, NEIGHBOR_ORDER, NATIONS, TREATIES, PLACES } from './data.js';
import {
  living, inVillage, year, isKnown, placeName, seasonIndex, canFight,
} from './state.js';
import { changeRelation, skarnAtPeace } from './neighbors.js';
import { chance, randomInt } from './rng.js';
import { clamp } from './util.js';
import { lawIs } from './laws.js';
import { swordsHelp } from './goods.js';
import { skarnStrength, clanLosses, clansYear, clansMarching } from './clans.js';
import { skarnApproach } from './siege.js';

const WORK_TASKS = ['hunt', 'forage', 'wood', 'quarry'];

export function nationsActive(state) {
  return inVillage(state) && Boolean(state.neighbors.skarn.nation);
}

export function nation(state, id) {
  return state.neighbors[id].nation || null;
}

// Sets the nations up when the village is founded.
export function startNations(state) {
  const y = year(state);
  for (const id of NEIGHBOR_ORDER) {
    const def = NATIONS[id];
    const population = def.start(y);
    state.neighbors[id].nation = {
      population,
      warriors: Math.round(population * def.warriors),
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

// Working another people's land without their leave angers them.
export function borderFriction(state) {
  const lines = [];
  if (!nationsActive(state)) return lines;
  const people = living(state);
  const offended = new Map();
  for (const task of WORK_TASKS) {
    const site = state.workSites[task];
    const who = owner(state, site);
    if (!who || who === 'player') continue;
    if (!people.some((p) => p.task === task)) continue;
    if (nation(state, who).treaties.openLands) continue;
    offended.set(who, [...(offended.get(who) || []), site]);
  }
  for (const [who, sites] of offended) {
    changeRelation(state, who, -2);
    lines.push(`Your people worked ${[...new Set(sites)].map((id) => placeName(state, id)).join(' and ')}, land that belongs to ${NEIGHBORS[who].name}. They are angry. An open lands pact, or other work sites, would end it.`);
  }
  return lines;
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

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const text = parts.join(', and ');
  return text.charAt(0).toUpperCase() + text.slice(1);
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

// Runs at the start of a season. Returns report lines.
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
  const guards = people.filter((p) => p.task === 'guard' && p.health >= 40).length;
  if (chance(state, Math.min(0.75, 0.15 * guards))) {
    const killed = randomInt(state, 1, 2);
    skarnLosses(state, killed);
    return [`Skarn skirmishers crept toward your ${workerWord} at ${where}, but your guards drove them off and killed ${killed}.`];
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
    const target = Math.round(nat.population * def.warriors);
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
          lines.push(`${capital(NEIGHBORS[id].name)} have claimed ${placeName(state, next)}.${worked && !nat.treaties.openLands ? ' Your people work there; they will need their leave, or another place.' : ''}`);
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
