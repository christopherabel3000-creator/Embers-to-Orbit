// Armies in the Nation era: companies of soldiers raised from the capital and
// the settlements, led by named commanders. An army marches across the
// regions, lives on the food it carries, and fights on the field
// (field.js). Wars, the enemy's hosts, sieges, and peace are in war.js; this
// file holds the armies themselves and what happens to them each season.

import {
  KINDS, COMPANY_SIZE, MIN_COMPANY, TRAITS, TRAINING, MAX_ARMIES, MAX_COMPANIES, KEEP_CAPITAL, KEEP_TOWN,
  TOWN_SHARE, LEVY_SHARE, IRON_PER_COMPANY, IRON_ARMS, STANDING_PAY, SUPPLY_SEASONS, ARMY_NAMES,
  STANCES, ARMY_ORDERS, FOES,
} from './armyData.js';
import { REGIONS } from './worldData.js';
import { placeRegion } from './data.js';
import {
  living, hasKnowledge, seasonIndex, eraAtLeast,
} from './state.js';
import { settlementById, hasRoad } from './realm.js';
import { isNotable } from './village.js';
import { refreshAdvisors } from './advisors.js';
import { travelRation, placeFound } from './world.js';
import { hasTradition } from './legacy.js';
import { SOLDIER } from './field.js';
import { pick } from './rng.js';
import {
  listWords, plural, shuffle, lowerFirst,
} from './util.js';

const TRAIT_ORDER = Object.keys(TRAITS);

export function armies(state) {
  return state.armies || [];
}

export function armyById(state, id) {
  return armies(state).find((a) => a.id === Number(id)) || null;
}

// Armies standing in a region (not on the march), optionally only those
// holding it.
export function armiesIn(state, region, { holding = false } = {}) {
  return armies(state).filter((a) => a.location === region && !a.march && (!holding || a.order === 'hold'));
}

export function companySoldiers(c) {
  return c.soldiers;
}

export function armySoldiers(army) {
  return army.companies.reduce((sum, c) => sum + c.soldiers, 0);
}

export function armyWounded(army) {
  return army.companies.reduce((sum, c) => sum + c.wounded, 0);
}

// Everyone in an army who must be fed: soldiers, wounded, and the commander.
export function armyMouths(army) {
  return armySoldiers(army) + armyWounded(army) + (army.commander ? 1 : 0);
}

// Everyone away with the armies, for counting the nation.
export function peopleInArmies(state) {
  return armies(state).reduce((sum, a) => sum + armyMouths(a), 0);
}

// ----- What soldiers are worth -----

// The nation's choice between levies and a standing army sets how new
// companies are trained.
export function trainingNow(state) {
  if (hasKnowledge(state, 'standingArmy')) return 'standing';
  if (hasKnowledge(state, 'levies')) return 'levies';
  return 'militia';
}

export const TRAINING_NAMES = { militia: 'militia', levies: 'levies', standing: 'standing army' };

// What a soldier of this company is worth, against an ordinary raider: more
// with spears, bows, and the warrior tradition, drill, iron arms, and the
// training of a standing army. A drilled soldier with spears and bows is
// worth 2.5.
export function soldierWorth(state, c) {
  // As a trained guard of the village would be: their skill, their weapons,
  // and their drill.
  let w = (7 + (hasKnowledge(state, 'spears') ? 1.5 : 0) + (hasKnowledge(state, 'bows') ? 1.5 : 0)
    + (hasTradition(state, 'warrior') ? 1.5 : 0)) / 6;
  w *= hasKnowledge(state, 'drill') ? 1.5 : 1.25;
  w *= TRAINING[c.training] || 1;
  if (c.iron) w *= IRON_ARMS;
  if (hasKnowledge(state, 'crown')) w *= 1.1; // Loyal to the crown.
  return w;
}

// The army's strength, for weighing it against an enemy: soldiers times
// what they are worth in melee and with arrows.
export function armyPower(state, army) {
  return army.companies.reduce((sum, c) => sum + c.soldiers * soldierWorth(state, c) * (KINDS[c.kind].melee + KINDS[c.kind].ranged), 0);
}

// What the armies standing in the valley add to the capital's defense, on
// the same scale as its fighters (an ordinary raider is worth SOLDIER).
export function valleyArmyStrength(state) {
  return armiesIn(state, 'valley').reduce((sum, a) => sum + a.companies.reduce((n, c) => n + c.soldiers * soldierWorth(state, c) * SOLDIER, 0), 0);
}

export function valleySoldiers(state) {
  return armiesIn(state, 'valley').reduce((sum, a) => sum + armySoldiers(a), 0);
}

// A company as a unit on the field.
export function companyUnit(state, c) {
  return {
    id: c.id, kind: c.kind, name: c.name, soldiers: c.soldiers, start: c.soldiers, power: SOLDIER * soldierWorth(state, c), ours: true, broken: false, zone: 'center',
  };
}

// ----- Commanders -----

// Each person has one trait as a commander, fixed by who they are.
export function commanderTrait(p) {
  if (p.commandTrait) return p.commandTrait;
  return TRAIT_ORDER[(p.id * 7 + p.name.length) % TRAIT_ORDER.length];
}

// A commander's skill: half their hunting to start, and one more for every
// two battles fought, up to 5.
export function commandLevel(p) {
  return Math.min(5, Math.floor((p.skills.hunting || 0) / 2) + Math.floor((p.command || 0) / 2));
}

export function commanderWords(p) {
  return `${p.name}, ${TRAITS[commanderTrait(p)].name}, skill ${commandLevel(p)}`;
}

// Who in the capital could command: healthy adults, but not the war chief,
// who commands at home.
export function commanderChoices(state) {
  return living(state).filter((p) => p.age >= 18 && p.age <= 60 && p.health >= 60 && !p.sick && p.id !== state.advisors.warChief)
    .sort((a, b) => commandLevel(b) - commandLevel(a) || b.skills.hunting - a.skills.hunting);
}

// The commander as field.js needs them.
export function fieldCommander(army) {
  const p = army.commander;
  return p ? { name: p.name, trait: commanderTrait(p), level: commandLevel(p) } : null;
}

// ----- Raising companies -----

function capitalSpare(state) {
  return living(state).filter((p) => p.age >= 16 && p.age <= 50 && p.health >= 60 && !p.sick && !isNotable(state, p));
}

// How many soldiers a source could still send.
export function sourceSpare(state, from) {
  if (from === 'capital') return Math.max(0, Math.min(capitalSpare(state).length, living(state).length - KEEP_CAPITAL));
  const t = settlementById(state, from);
  if (!t) return 0;
  const share = hasKnowledge(state, 'levies') ? LEVY_SHARE : TOWN_SHARE;
  const away = companiesFrom(state, t.id).reduce((sum, c) => sum + c.soldiers + c.wounded, 0);
  const total = t.population + away;
  return Math.max(0, Math.min(Math.floor(total * share) - away, t.population - KEEP_TOWN));
}

export function companiesFrom(state, townId) {
  return armies(state).flatMap((a) => a.companies).filter((c) => c.from === townId);
}

// Where a company could be raised now: [{ from, name, spare }].
export function raiseSources(state) {
  const out = [];
  if (sourceSpare(state, 'capital') >= MIN_COMPANY) out.push({ from: 'capital', name: state.campName, spare: sourceSpare(state, 'capital') });
  for (const t of state.settlements || []) {
    const spare = sourceSpare(state, t.id);
    if (spare >= MIN_COMPANY) out.push({ from: t.id, name: t.name, spare });
  }
  return out;
}

export function kindAvailable(state, kind) {
  const k = KINDS[kind];
  return Boolean(k) && (!k.needs || hasKnowledge(state, k.needs));
}

export function availableKinds(state) {
  return Object.keys(KINDS).filter((k) => kindAvailable(state, k));
}

// What raising a company costs: half with Levies, and iron arms with Iron
// weapons when there is iron.
export function raiseCost(state, kind) {
  const cost = {};
  const half = hasKnowledge(state, 'levies');
  for (const [res, n] of Object.entries(KINDS[kind].cost)) cost[res] = half && res !== 'horses' ? Math.ceil(n / 2) : n;
  return cost;
}

export function costWords(cost) {
  return listWords(Object.entries(cost).map(([k, n]) => `${n} ${k}`));
}

function ironArms(state) {
  return hasKnowledge(state, 'ironWeapons') && (state.resources.iron || 0) >= IRON_PER_COMPANY;
}

// Why a company of this kind cannot be raised from this source, or null.
export function raiseBlocker(state, kind, from) {
  if (!eraAtLeast(state, 'nation')) return 'Armies are raised in the Nation era.';
  if (state.siege) return 'No one can leave while the Skarn besiege the capital.';
  if (!KINDS[kind]) return 'Choose a kind of company.';
  if (!kindAvailable(state, kind)) return `Your people must learn ${KINDS[kind].needs === 'bows' ? 'Bows' : KINDS[kind].needs === 'drill' ? 'Shields and drill' : KINDS[kind].needs === 'cavalry' ? 'Cavalry' : 'Siege engines'} first.`;
  if (sourceSpare(state, from) < MIN_COMPANY) return from === 'capital' ? `${state.campName} cannot spare ${MIN_COMPANY} more soldiers; ${KEEP_CAPITAL} people must stay.` : 'That settlement cannot spare a company.';
  const short = Object.entries(raiseCost(state, kind)).filter(([res, n]) => (state.resources[res] || 0) < n);
  if (short.length) return `You need ${costWords(Object.fromEntries(short))}; you have ${listWords(short.map(([res]) => `${state.resources[res] || 0} ${res}`))}.`;
  return null;
}

function sourceName(state, from) {
  return from === 'capital' ? state.campName : (settlementById(state, from) || { name: 'the settlements' }).name;
}

function companyName(state, kind, from) {
  const base = `${KINDS[kind].name} of ${sourceName(state, from)}`;
  const same = armies(state).flatMap((a) => a.companies).filter((c) => c.baseName === base).length;
  return { baseName: base, name: same ? `${base} ${same + 1}` : base };
}

// Takes the soldiers from their home and pays for the company. Returns it.
function makeCompany(state, kind, from) {
  const cost = raiseCost(state, kind);
  for (const [res, n] of Object.entries(cost)) state.resources[res] -= n;
  const iron = ironArms(state);
  if (iron) state.resources.iron -= IRON_PER_COMPANY;
  const size = Math.min(COMPANY_SIZE, sourceSpare(state, from)); // A full company, or as many as can be spared.
  const c = {
    id: state.nextCompanyId++, kind, from, ...companyName(state, kind, from), soldiers: size, wounded: 0, training: trainingNow(state), iron, people: [],
  };
  if (from === 'capital') {
    // Those the capital can best spare: not the council, masters, or heroes,
    // and the least skilled first, so its work and its walls suffer least.
    const best = (p) => Math.max(...Object.values(p.skills));
    const chosen = capitalSpare(state).sort((a, b) => best(a) - best(b) || a.skills.hunting - b.skills.hunting).slice(0, size);
    const ids = new Set(chosen.map((p) => p.id));
    state.people = state.people.filter((p) => !ids.has(p.id));
    c.people = chosen.map((p) => ({ ...p, task: 'soldier' }));
  } else {
    settlementById(state, from).population -= size;
  }
  return c;
}

// The food an army can carry: two seasons for everyone in it, two more with
// Logistics and one more with carts. With Salting it lasts twice as long.
export function supplyCapacity(state, army) {
  return armyMouths(army) * 2 * supplySeasons(state);
}

export function supplySeasons(state) {
  return SUPPLY_SEASONS + (hasKnowledge(state, 'logistics') ? 2 : 0) + (carts(state) ? 1 : 0);
}

// Carts: with Horse breeding and 10 horses to pull them.
export function carts(state) {
  return hasKnowledge(state, 'horseBreeding') && (state.resources.horses || 0) >= 10;
}

export function armyRation(state, army) {
  return armyMouths(army) * travelRation(state);
}

// Fills an army's packs from the capital's stores, as far as they go.
// Returns the food taken.
function supply(state, army) {
  const want = Math.max(0, supplyCapacity(state, army) - army.food);
  const take = Math.min(want, Math.max(0, state.resources.food));
  army.food += take;
  state.resources.food -= take;
  return take;
}

export function armyBlocker(state) {
  if (!eraAtLeast(state, 'nation')) return 'Armies are raised in the Nation era.';
  if (armies(state).length >= MAX_ARMIES) return `You have ${MAX_ARMIES} armies already.`;
  return null;
}

// Raises a new army in the valley, with its commander and first company.
// Returns { error } or { message }.
export function raiseArmy(state, { commanderId, kind, from = 'capital' }) {
  const why = armyBlocker(state) || raiseBlocker(state, kind, from === 'capital' ? 'capital' : Number(from));
  if (why) return { error: why };
  const source = from === 'capital' ? 'capital' : Number(from);
  const p = commanderChoices(state).find((x) => x.id === Number(commanderId));
  if (!p) return { error: 'Choose a commander who is fit to lead.' };
  state.people = state.people.filter((x) => x.id !== p.id);
  const commander = { ...p, task: 'command', commandTrait: commanderTrait(p), command: p.command || 0 };
  refreshAdvisors(state);
  const used = new Set(armies(state).map((a) => a.name));
  const army = {
    id: state.nextArmyId++,
    name: ARMY_NAMES.find((n) => !used.has(n)) || `Army ${state.nextArmyId}`,
    commander,
    companies: [],
    location: 'valley',
    order: 'hold',
    march: null,
    stance: 'ask',
    food: 0,
    siege: null,
    raised: state.turn,
    hungry: false,
  };
  if (!state.armies) state.armies = [];
  state.armies.push(army);
  const c = makeCompany(state, kind, source);
  army.companies.push(c);
  const food = supply(state, army);
  return { message: `The ${army.name.toLowerCase()} is raised in the valley under ${commanderWords(commander)}, with the ${lowerFirst(c.name)}: ${c.soldiers} soldiers, carrying ${food} food.` };
}

// Where companies can join an army: at home in the valley, or in the region
// of the settlement they come from.
function canJoinHere(army, state, from) {
  if (army.march) return false;
  if (army.location === 'valley') return true;
  if (from === 'capital') return false;
  const t = settlementById(state, from);
  return Boolean(t) && placeRegion(t.place) === army.location;
}

export function raiseCompany(state, { armyId, kind, from = 'capital' }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  const source = from === 'capital' ? 'capital' : Number(from);
  if (army.companies.length >= MAX_COMPANIES) return { error: `An army can have at most ${MAX_COMPANIES} companies. Raise another army.` };
  if (!canJoinHere(army, state, source)) return { error: `New companies join the ${army.name.toLowerCase()} in the valley, or where they are raised.` };
  const why = raiseBlocker(state, kind, source);
  if (why) return { error: why };
  const c = makeCompany(state, kind, source);
  army.companies.push(c);
  const food = supply(state, army);
  return { message: `${c.name} joined the ${army.name.toLowerCase()}${c.iron ? ', armed with iron' : ''}. It now has ${plural(armySoldiers(army), 'soldier', 'soldiers')}${food ? `, and took ${food} food for them` : ''}.` };
}

// Soldiers go home: the capital's own rejoin it; a settlement's rejoin
// their settlement, or the capital if it is gone.
function sendHome(state, c) {
  if (c.from === 'capital' || !settlementById(state, c.from)) {
    const count = c.soldiers + c.wounded;
    const back = c.people.slice(0, count);
    for (const p of back) state.people.push({ ...p, task: 'rest', orderReturn: null });
    const counted = count - back.length;
    if (counted > 0 && c.from !== 'capital') {
      // A settlement's soldiers whose home is gone settle in the capital.
      for (let i = 0; i < counted; i++) state.people.push(veteran(state));
    }
  } else {
    settlementById(state, c.from).population += c.soldiers + c.wounded;
  }
}

function veteran(state) {
  const p = {
    id: state.nextPersonId++, name: pick(state, ['Brand', 'Hild', 'Orm', 'Sigga', 'Tove', 'Ulf', 'Ragna', 'Eyvind']), note: 'A soldier whose settlement is gone, who came to the capital.', age: 25, skills: { hunting: 2, foraging: 1, building: 1, healing: 0, scouting: 1, learning: 0 }, health: 80, morale: 50, alive: true, task: 'rest', orderReturn: null, sick: false, xp: {},
  };
  return p;
}

function homeAllowed(state, army, c) {
  if (army.march) return false;
  if (army.location === 'valley') return true;
  const t = c.from !== 'capital' && settlementById(state, c.from);
  return Boolean(t) && placeRegion(t.place) === army.location;
}

export function disbandCompany(state, { armyId, companyId }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  const c = army.companies.find((x) => x.id === Number(companyId));
  if (!c) return { error: 'There is no such company.' };
  if (!homeAllowed(state, army, c)) return { error: 'Companies go home from the valley, or from where they were raised.' };
  if (army.companies.length === 1) return disbandArmy(state, { armyId });
  sendHome(state, c);
  army.companies = army.companies.filter((x) => x !== c);
  refreshAdvisors(state);
  return { message: `${c.name} went home, ${plural(c.soldiers + c.wounded, 'soldier', 'soldiers')}.` };
}

export function disbandArmy(state, { armyId }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  if (army.location !== 'valley' || army.march) return { error: 'An army is disbanded at home, in the valley. March it home first.' };
  for (const c of army.companies) sendHome(state, c);
  if (army.commander) state.people.push({ ...army.commander, task: 'rest', orderReturn: null });
  state.resources.food += army.food;
  state.armies = armies(state).filter((a) => a !== army);
  refreshAdvisors(state);
  const n = army.companies.reduce((sum, c) => sum + c.soldiers + c.wounded, 0);
  return { message: `The ${army.name.toLowerCase()} is disbanded. ${plural(n, 'soldier', 'soldiers')} went home${army.commander ? `, and ${army.commander.name} with them` : ''}, with ${army.food} food left over.` };
}

export function appointCommander(state, { armyId, personId }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  const p = commanderChoices(state).find((x) => x.id === Number(personId));
  if (!p) return { error: 'Choose someone in the capital who is fit to lead.' };
  const old = army.commander;
  state.people = state.people.filter((x) => x.id !== p.id);
  if (old) state.people.push({ ...old, task: 'rest', orderReturn: null });
  army.commander = { ...p, task: 'command', commandTrait: commanderTrait(p), command: p.command || 0 };
  refreshAdvisors(state);
  return { message: `${commanderWords(army.commander)} now commands the ${army.name.toLowerCase()}.${old ? ` ${old.name} has come home.` : ''}` };
}

export function setStance(state, { armyId, stance }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  if (!STANCES[stance]) return { error: 'Choose a stance.' };
  army.stance = stance;
  return { message: `The ${army.name.toLowerCase()}: ${STANCES[stance].name.toLowerCase()}.` };
}

// ----- Marching -----

export function regionName(id) {
  return lowerFirst(REGIONS[id].name);
}

// Regions an army can march to: any your expeditions have explored.
export function marchTargets(state, army) {
  return Object.keys(REGIONS).filter((id) => id !== army.location && !REGIONS[id].sea && state.world && state.world.regions[id].status === 'explored');
}

// The shortest way through explored regions: the regions after `from`, in order.
export function pathTo(state, from, to) {
  const open = (id) => state.world && state.world.regions[id] && state.world.regions[id].status === 'explored' && !REGIONS[id].sea;
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) break;
    for (const n of REGIONS[id].neighbors) {
      if (prev[n] !== undefined || !open(n)) continue;
      prev[n] = id;
      queue.push(n);
    }
  }
  if (prev[to] === undefined) return null;
  const path = [];
  for (let id = to; id !== from; id = prev[id]) path.unshift(id);
  return path;
}

// A road joins two regions when each is the valley or holds a settlement of
// yours with a road to the capital.
function roaded(state, region) {
  return region === 'valley' || (state.settlements || []).some((t) => placeRegion(t.place) === region && hasRoad(state, t));
}

export function stepCost(state, a, b) {
  return roaded(state, a) && roaded(state, b) ? 0.5 : 1;
}

// How far an army marches this season, in regions: none in winter, half in
// the spring mud, and half again for an army all of riders and skirmishers.
export function marchSpeed(state, army, seasonIdx = seasonIndex(state)) {
  // Venn furs keep an army marching through the winter, at half pace.
  const furs = state.great && state.great.venn && state.great.venn.treaties.trade;
  const base = [0.5, 1, 1, furs ? 0.5 : 0][seasonIdx];
  const quick = army.companies.length && army.companies.every((c) => KINDS[c.kind].mounted || KINDS[c.kind].scouts);
  return base * (quick ? 1.5 : 1) * (hasKnowledge(state, 'bridges') ? 4 / 3 : 1);
}

// Seasons the march would take from now, roughly.
export function marchSeasons(state, army, to) {
  const path = pathTo(state, army.location, to);
  if (!path) return null;
  let at = army.location;
  let need = 0;
  for (const n of path) { need += stepCost(state, at, n); at = n; }
  let seasons = 0;
  let s = seasonIndex(state);
  let done = 0;
  while (done < need && seasons < 40) {
    done += marchSpeed(state, army, s);
    s = (s + 1) % 4;
    seasons += 1;
  }
  return seasons;
}

// Whether the capital's stores reach an army here: the valley, the regions
// next to it, and any region with a settlement of yours; with Logistics,
// the regions next to those as well. Not while the capital is besieged.
export function inSupply(state, region) {
  if (state.siege) return false; // The stores are behind the capital's walls.
  const base = new Set(['valley', ...REGIONS.valley.neighbors]);
  for (const t of state.settlements || []) base.add(placeRegion(t.place));
  if (base.has(region)) return true;
  if (!hasKnowledge(state, 'logistics')) return false;
  return [...base].some((r) => REGIONS[r].neighbors.includes(region));
}

// Orders an army: { order, to }. Returns { error } or { message }.
export function setArmyOrder(state, { armyId, order, to = null }) {
  const army = armyById(state, armyId);
  if (!army) return { error: 'There is no such army.' };
  if (!ARMY_ORDERS[order]) return { error: 'Choose an order.' };
  const here = regionName(army.location);
  if (order === 'march') {
    if (!to || !REGIONS[to]) return { error: 'Choose where to march.' };
    if (to === army.location && !army.march) return { error: `The ${army.name.toLowerCase()} is already in ${here}.` };
    const start = army.location;
    const path = pathTo(state, start, to);
    if (!path) return { error: 'Your people know no way there. Expeditions must explore it first.' };
    army.march = { to, path, progress: army.march ? army.march.progress : 0 };
    army.order = 'march';
    army.siege = null;
    const seasons = marchSeasons(state, { ...army, location: start }, to);
    return { message: `The ${army.name.toLowerCase()} marches for ${regionName(to)}: about ${plural(seasons, 'season', 'seasons')}${inSupply(state, to) ? '' : `. It will be beyond your supply there, living on the ${army.food} food it carries`}.` };
  }
  const why = orderBlocker(state, army, order);
  if (why) return { error: why };
  army.march = null;
  army.order = order;
  if (order === 'besiege') {
    const foe = foeHere(state, army.location);
    army.siege = { foe, started: state.turn, garrison: null };
    return { message: `The ${army.name.toLowerCase()} surrounds ${FOES[foe].homeName}. Each season the siege lasts, they go hungrier.` };
  }
  army.siege = null;
  if (order === 'raid') return { message: `The ${army.name.toLowerCase()} will raid ${FOES[foeHere(state, army.location)].name}'s land.` };
  if (order === 'holdPass') return { message: `The ${army.name.toLowerCase()} holds the high pass. The hill clans cannot come through, and Skarn skirmishers cannot reach the iron hills.` };
  return { message: `The ${army.name.toLowerCase()} holds ${here}.` };
}

// The people at war with you whose home is in this region, if any.
export function foeHere(state, region) {
  return Object.keys(state.wars || {}).find((id) => FOES[id] && FOES[id].home === region) || null;
}

// Why an army cannot take an order here, or null.
export function orderBlocker(state, army, order) {
  if (army.march && order !== 'hold') return 'Let the army reach its march\'s end, or order it to halt and hold first.';
  if (order === 'raid' || order === 'besiege') {
    const foe = foeHere(state, army.location);
    if (!foe) return 'There is no enemy land here: you must be at war with the people whose home this region is.';
  }
  if (order === 'holdPass' && (army.location !== 'hills' || !placeFound(state, 'highPass'))) return 'The high pass is in the iron hills, once an expedition has found it.';
  return null;
}

export { passHeld } from './warStatus.js';

// ----- Losses -----

// Takes soldiers out of a company: killed are gone for good (for the
// capital's soldiers, named people die), wounded rest until they heal.
// Returns the names of notable people killed.
export function companyLosses(state, c, killed, wounded) {
  const k = Math.min(c.soldiers, killed);
  const w = Math.min(c.soldiers - k, wounded);
  c.soldiers -= k + w;
  c.wounded += w;
  const names = [];
  if (c.from === 'capital' && k > 0) {
    const order = shuffle(state, c.people);
    const dead = order.slice(0, k);
    const ids = new Set(dead.map((p) => p.id));
    c.people = c.people.filter((p) => !ids.has(p.id));
    for (const p of dead) if ((state.heroes || []).some((h) => h.id === p.id)) names.push(p.name);
  }
  return names;
}

// Drops companies with no one left in them.
export function pruneArmy(state, army) {
  army.companies = army.companies.filter((c) => c.soldiers + c.wounded > 0);
}

// ----- Each season -----

// What happens to every army each season: they eat, forage, draw on the
// stores, heal, are paid, and march. Returns { urgent, events, routine, arrived }.
export function armiesUpkeep(state) {
  const out = { urgent: [], events: [], routine: [], arrived: [] };
  const s = seasonIndex(state);
  let drawn = 0;
  let pay = 0;
  let unpaid = 0;
  const standing = armies(state).flatMap((a) => a.companies).filter((c) => c.training === 'standing');
  const due = standing.length * STANDING_PAY;
  if (due > 0) {
    if ((state.resources.coin || 0) >= due) {
      state.resources.coin -= due;
      pay = due;
    } else {
      unpaid = due;
    }
  }
  for (const army of armies(state)) {
    const name = `The ${army.name.toLowerCase()}`;
    // They eat what they carry.
    const need = armyRation(state, army);
    const supplied = inSupply(state, army.location);
    if (army.food >= need) {
      army.food -= need;
      army.hungry = false;
    } else {
      army.food = 0;
      army.hungry = true;
      let lost = 0;
      for (const c of army.companies) {
        const n = Math.ceil(c.soldiers * 0.1);
        companyLosses(state, c, n, 0);
        lost += n;
      }
      pruneArmy(state, army);
      let turned = false;
      if (!supplied && army.location !== 'valley' && !(army.march && army.march.to === 'valley')) {
        const path = pathTo(state, army.location, 'valley');
        if (path) {
          army.march = { to: 'valley', path, progress: 0 };
          army.order = 'march';
          army.siege = null;
          turned = true;
        }
      }
      out.urgent.push(`The ${army.name.toLowerCase()} ran out of food in ${regionName(army.location)}. ${plural(lost, 'soldier', 'soldiers')} died or deserted${turned ? ', and it has turned for home' : ''}.`);
    }
    // In enemy land, it forages in summer and autumn.
    if (!supplied && (s === 1 || s === 2)) army.food += Math.round(need * (army.order === 'raid' ? 0.5 : 0.25));
    // Within reach of the stores, it fills its packs again.
    if (supplied) drawn += supply(state, army);
    // The wounded heal: half rejoin each season.
    for (const c of army.companies) {
      if (!c.wounded) continue;
      const healed = Math.ceil(c.wounded / 2);
      c.wounded -= healed;
      c.soldiers += healed;
    }
    // A standing army that is not paid melts away.
    if (unpaid) {
      let left = 0;
      for (const c of army.companies.filter((x) => x.training === 'standing')) {
        const n = Math.ceil(c.soldiers * 0.2);
        const gone = { ...c, soldiers: n, wounded: 0, people: c.people.slice(0, n) };
        sendHome(state, gone);
        c.soldiers -= n;
        c.people = c.people.slice(n);
        left += n;
      }
      pruneArmy(state, army);
      if (left) out.urgent.push(`The treasury could not pay the ${army.name.toLowerCase()}: ${plural(left, 'soldier', 'soldiers')} of the standing army went home. It costs ${STANDING_PAY} coin a season for each company.`);
    }
    // The march.
    if (army.march) {
      const speed = marchSpeed(state, army, s);
      if (speed === 0) {
        out.events.push(`${name}: snow has stopped the march. It camps in ${regionName(army.location)} until spring.`);
      } else {
        let budget = army.march.progress + speed;
        while (army.march.path.length) {
          const next = army.march.path[0];
          const cost = stepCost(state, army.location, next);
          if (budget < cost) break;
          budget -= cost;
          army.location = next;
          army.march.path.shift();
        }
        if (!army.march.path.length) {
          out.arrived.push(army);
          out.events.push(`${name} has reached ${regionName(army.location)}, and holds it.`);
          army.march = null;
          army.order = 'hold';
        } else {
          army.march.progress = budget;
          if (s === 0 && speed < 1) out.events.push(`${name} is slowed by the spring mud, in ${regionName(army.location)}.`);
        }
      }
    }
    if (!army.companies.length) {
      out.urgent.push(`The ${army.name.toLowerCase()} is no more: everyone in it is dead or gone.${army.commander ? ` ${army.commander.name} has come home.` : ''}`);
      if (army.commander) state.people.push({ ...army.commander, task: 'rest', orderReturn: null });
      army.gone = true;
    }
  }
  state.armies = armies(state).filter((a) => !a.gone);
  if (drawn) out.routine.push(`Your ${armies(state).length === 1 ? 'army' : 'armies'} drew ${drawn} food from the stores.`);
  if (pay) out.routine.push(`The standing army was paid ${pay} coin.`);
  return out;
}

// One line for the army, for lists.
export function armyWhere(army) {
  if (army.march) return `marching to ${regionName(army.march.to)}, now in ${regionName(army.location)}`;
  if (army.siege) return `besieging ${FOES[army.siege.foe].homeName}`;
  if (army.order === 'raid') return `raiding the enemy's land in ${regionName(army.location)}`;
  if (army.order === 'holdPass') return 'holding the high pass';
  return `holding ${regionName(army.location)}`;
}

export { lowerFirst };

export function armyLine(state, army, { named = true } = {}) {
  const where = armyWhere(army);
  const wounded = armyWounded(army);
  return `${named ? `${army.name}, under` : 'Under'} ${army.commander ? commanderWords(army.commander) : 'no commander'}: ${plural(army.companies.length, 'company', 'companies')}, ${plural(armySoldiers(army), 'soldier', 'soldiers')}${wounded ? ` and ${wounded} wounded` : ''}, ${where}.`;
}

export function supplyLine(state, army) {
  const need = armyRation(state, army);
  const seasons = need ? Math.floor(army.food / need) : 0;
  return `${army.food} food carried, enough for ${plural(seasons, 'season', 'seasons')}. ${inSupply(state, army.location) ? 'It is within reach of your stores, which fill its packs each season.' : 'It is beyond the reach of your stores, and lives on what it carries and forages.'}`;
}

export function companyLine(state, c) {
  const k = KINDS[c.kind];
  return `${c.name}: ${plural(c.soldiers, 'soldier', 'soldiers')}${c.wounded ? `, ${c.wounded} wounded` : ''}; ${TRAINING_NAMES[c.training]}${c.iron ? ', iron arms' : ''}; each worth ${soldierWorth(state, c).toFixed(1)}. ${k.about}`;
}

// The soldiers' homes, for a settlement's screen: soldiers it has sent.
export function soldiersFromTown(state, t) {
  return companiesFrom(state, t.id).reduce((sum, c) => sum + c.soldiers + c.wounded, 0);
}
