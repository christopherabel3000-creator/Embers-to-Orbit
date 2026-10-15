// Plays many games with simple automatic strategies to check balance.
// Run with: node tools/simulate.mjs [games] [years] [strategies]. See BALANCE.md.

import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, shelterCapacity, seasonIndex, knownPlaces, unexploredNeighbors, hasKnowledge,
  knowledgeBlocker, fieldPlots, allowedTasksFor, storageCapacity, foodNeeded, canFight,
} from '../js/engine/state.js';
import { feastBlocker, feastCost } from '../js/engine/stores.js';
import { villageBlocker } from '../js/engine/village.js';
import { queueBlocker } from '../js/engine/building.js';
import { claimBlocker, freeToWork } from '../js/engine/nations.js';
import { sallyEvent, villageDefense, bandPower, coverWeight } from '../js/engine/siege.js';
import { skarnStrength, clanGiftCost } from '../js/engine/clans.js';
import { estimateBattle } from '../js/engine/battle.js';
import {
  settlementBlocker, settlementSites, settlerRange, governorChoices, settlerSources, aidBlocker,
} from '../js/engine/settlements.js';
import { bestRole, nationPopulation, governorSkill } from '../js/engine/realm.js';
import { BUILDINGS, PLACES } from '../js/engine/data.js';
import { raidOdds } from '../js/engine/advisors.js';
import { describePending } from '../js/engine/events.js';
import { VILLAGE_EVENTS } from '../js/engine/villageEvents.js';
import { DEFAULT_DIFFICULTY } from '../js/engine/difficulty.js';

const VILLAGE_EVENT_IDS = new Set(Object.keys(VILLAGE_EVENTS));
const GOODS_RESERVE = 40; // Kept for comforts and arms.
const MASTER_SKILLS = ['building', 'hunting', 'learning', 'healing', 'foraging'];

const GAMES = Number(process.argv[2] || 200);
const YEARS = Number(process.argv[3] || 5);

function act(state, action) {
  const r = applyAction(state, action);
  return r.state;
}

function sensiblePlan(state) {
  const people = living(state);
  const s = seasonIndex(state);
  const plan = new Map();
  const free = () => people.filter((p) => !plan.has(p.id));
  const take = (n, skill, task) => {
    free().filter((p) => allowedTasksFor(state, p).includes(task))
      .sort((a, b) => b.skills[skill] - a.skills[skill]).slice(0, n).forEach((p) => plan.set(p.id, task));
  };
  for (const p of people) if (p.health < 40) plan.set(p.id, 'rest');
  if (people.some((p) => p.health < 75)) take(1, 'healing', 'heal');
  const n = people.length;
  if (hasKnowledge(state, 'farming') && fieldPlots(state) && s !== 3) {
    const plots = fieldPlots(state);
    take(Math.ceil(s === 0 ? (plots - state.farm.planted) / 2 : state.farm.planted / 3), 'foraging', 'farm');
  }
  if (state.knowledge.current) take(2, 'learning', 'study');
  if (s === 3) take(Math.ceil(n * 0.55), 'hunting', 'hunt');
  else {
    take(Math.ceil(n * 0.25), 'hunting', 'hunt');
    take(Math.ceil(n * 0.25), 'foraging', 'forage');
  }
  take(1, 'scouting', 'scout');
  if (state.buildQueue.length) take(2, 'building', 'build');
  for (const p of free()) plan.set(p.id, allowedTasksFor(state, p).includes('wood') ? 'wood' : allowedTasksFor(state, p)[0]);
  return plan;
}

// Pick the known place with the best bonus and abundance for each task.
function chooseSites(state) {
  for (const task of ['hunt', 'forage', 'wood']) {
    const score = (id) => (PLACES[id].bonus[task] || 0) + (task === 'wood' ? 0 : state.places[id].abundance[task] / 25);
    // Like the council, a sensible player keeps work off other peoples' land.
    const best = knownPlaces(state).filter((id) => PLACES[id].tasks.includes(task) && freeToWork(state, id)).sort((a, b) => score(b) - score(a))[0];
    if (best && best !== state.workSites[task]) state = act(state, { type: 'setWorkSite', task, placeId: best });
  }
  const scoutFrom = knownPlaces(state).find((id) => unexploredNeighbors(state, id).length > 0);
  if (scoutFrom && scoutFrom !== state.workSites.scout) state = act(state, { type: 'setWorkSite', task: 'scout', placeId: scoutFrom });
  return state;
}

function chooseProject(state) {
  if (state.buildQueue.length) return null;
  const people = living(state).length;
  const wants = [];
  const village = state.era !== 'camp';
  if (people + 1 > shelterCapacity(state)) wants.push(village ? 'hut' : 'leanTo');
  if (hasKnowledge(state, 'farming') && state.buildings.fields < 3) wants.push('fields');
  wants.push('storehouse', 'palisade', 'watchtower', 'healersHut');
  // A village works through its new buildings once the basics are in place.
  if (village) wants.push('workshop', 'pasture', 'granary', 'meetingHall', 'market', 'stoneWall', 'road');
  if (village && state.buildings.fields < Math.ceil(people / 5)) wants.push('fields');
  wants.push(village ? 'hut' : 'leanTo');
  for (const id of wants) {
    const b = BUILDINGS[id];
    if (queueBlocker(state, id)) continue;
    if ((b.goods || 0) > (state.resources.goods || 0)) continue; // The council quarries stone once it is queued.
    if (!b.repeatable && state.buildings[id] > 0) continue;
    // Another storehouse only once the stores are getting full.
    if (id === 'storehouse' && state.buildings.storehouse > 0 && state.resources.food < storageCapacity(state) * 0.7) continue;
    if (b.max && state.buildings[id] >= b.max) continue;
    // Keep enough wood back for the winter fires.
    if (state.resources.wood >= b.cost + 10 + (seasonIndex(state) >= 1 ? people * 1.5 : 0)) return id;
  }
  return null;
}

const STUDY_ORDER = ['stoneTools', 'smoking', 'farming', 'spears', 'clothing', 'pottery', 'medicine',
  'stonecutting', 'weaving', 'husbandry', 'oralLaw', 'elders', 'masonry', 'bows', 'kilns', 'markets', 'irrigation', 'drill',
  'writing', 'roads', 'mathematics', 'schools', 'astronomy'];
function chooseStudy(state) {
  if (state.knowledge.current) return state;
  const next = STUDY_ORDER.find((id) => !knowledgeBlocker(state, id));
  return next ? act(state, { type: 'setStudy', knowledgeId: next }) : state;
}

let villages = 0;
let villageYears = [];
let nationYears = [];
let tally = {};

// Counts the outcome of a fight from report lines. Fights the simulated
// player starts itself (raids it answers, sallies) report into the season
// that is about to end, so their lines are read as soon as they happen.
const FIGHT_WON = /broke and fled\. .* is safe|routed the besiegers|fought off the ambush|Skarn hold has fallen/;
const FIGHT_LOST = /defenders were overwhelmed|abandoned the fight|fell back inside the walls|^At dusk the|were driven from|attack on Skarn hold failed|turned back from Skarn hold/;
function countFights(lines) {
  for (const l of lines) {
    if (FIGHT_WON.test(l)) tally.fightsWon++;
    if (FIGHT_LOST.test(l)) tally.lostFights++;
    if (/^Ambush!/.test(l)) tally.ambushes++;
    if (/scattered and ran for home/.test(l)) tally.scattered++;
  }
}
function actCounting(state, action) {
  const before = state.report.urgent.length;
  const next = act(state, action);
  countFights(next.report.urgent.slice(before));
  return next;
}
function play(seed, strategy) {
  let state = newGame({ seed, difficulty: process.env.DIFFICULTY });
  if (strategy.startsWith('orders') || strategy === 'village') {
    for (const [id, value] of [['keepHealer', true], ['foodReserve', 2], ['winterForagers', true], ['raidPolicy', 'auto'], ['autoAssign', true], ['harvestFeast', strategy !== 'ordersNoFeast'], ['autoShelter', strategy === 'village'], ['armGuards', strategy === 'village']]) {
      state = act(state, { type: 'setOrder', id, value });
    }
  }
  for (let t = 0; t < YEARS * 4 && !state.gameOver; t++) {
    if (state.pendingEvent && state.pendingEvent.type === 'story' && VILLAGE_EVENT_IDS.has(state.pendingEvent.id)) tally.villageEvents++;
    if (state.pendingEvent && state.pendingEvent.type === 'story') {
      // Simple players take the first option offered.
      state = act(state, { type: 'resolveEvent', choice: describePending(state).options[0].id });
      if (state.gameOver) break;
    }
    if (state.pendingEvent) {
      const fighters = living(state).filter((p) => p.health >= 40);
      const odds = raidOdds(state, fighters, state.pendingEvent.warned, state.pendingEvent.raiders);
      state = (strategy === 'sensible' || strategy === 'village') && odds.chance >= 0.5
        ? actCounting(state, { type: 'resolveRaid', plan: 'fight', defenderIds: fighters.map((p) => p.id) })
        : actCounting(state, { type: 'resolveRaid', plan: 'hide' });
      if (state.gameOver) break;
    }
    // Under siege: sally out when the war chief likes the odds, else wait.
    if (state.siege && !state.pendingEvent) {
      tally.siegeSeasons++;
      // Besiegers burn whatever is sown, so with a crop in the fields a
      // player will risk a fight at even odds rather than wait.
      if (estimateBattle(state, sallyEvent(state), null, 8) >= (state.farm.planted > 0 ? 0.5 : 0.6)) {
        state = act(state, { type: 'sallyOut' });
        state = actCounting(state, { type: 'battleAuto' });
        tally.sallies++;
      }
    }
    if (strategy === 'village' && state.era !== 'camp' && state.neighbors.skarn.nation) {
      // Claim any land that borders the village, best places first.
      for (const id of Object.keys(state.places)) {
        if (!claimBlocker(state, id)) state = act(state, { type: 'claimPlace', placeId: id });
      }
      // Found settlements where the land is richest, the first with heavy
      // demands as before, later ones with normal demands. MAXTOWNS caps them.
      const maxTowns = Number(process.env.MAXTOWNS || 4);
      if (!settlementBlocker(state) && state.settlements.length < maxTowns) {
        const sites = settlementSites(state);
        const from = settlerSources(state)[0].from;
        const first = !state.settlements.length;
        const r = applyAction(state, {
          type: 'foundSettlement', placeId: sites[0], name: `Town${state.settlements.length + 1}`, settlers: settlerRange(state, from)[0],
          governorId: [...governorChoices(state, from)].sort((a, b) => b.skills.learning - a.skills.learning)[0].id,
          demands: first ? 'heavy' : 'normal', role: bestRole(sites[0]), from,
        });
        if (!r.error) {
          state = r.state;
          if (first) nationYears.push(Math.ceil((state.turn + 1) / 4));
          tally.towns++;
        }
      }
      // Aid for a settlement whose loyalty slips, in goods if there are any
      // to spare. NOAID=1 never sends any.
      for (const t of process.env.NOAID ? [] : state.settlements) {
        if (t.loyalty >= 55) continue;
        for (const kind of ['goods', 'food']) {
          if (aidBlocker(state, t, kind)) continue;
          if (kind === 'food' && state.resources.food < foodNeeded(living(state)) * 4) continue;
          state = act(state, { type: 'sendAid', settlementId: t.id, kind });
          tally.aid++;
          break;
        }
      }
    }
    if (process.env.CLANGIFT && strategy === 'village') {
      const r = applyAction(state, { type: 'giftClans' });
      if (!r.error) { state = r.state; tally.clanGifts++; }
    }
    // A village spends its goods the way a player would, keeping enough in
    // hand for comforts and arms: sell-swords when the Skarn are strong,
    // caravans when food runs low, a master a year, and gifts to keep the
    // hill clans home when there is plenty to spare. NOSPEND=1 turns it off.
    if (strategy === 'village' && state.era !== 'camp' && !state.pendingEvent && !process.env.NOSPEND) {
      const tryAct = (a) => { const r = applyAction(state, a); if (!r.error) { state = r.state; return true; } return false; };
      const spare = () => (state.resources.goods || 0) - GOODS_RESERVE;
      const fighters = living(state).filter(canFight).length;
      if ((state.siege || skarnStrength(state) >= fighters) && spare() >= 20 && tryAct({ type: 'hireSwords' })) tally.swords++;
      if (state.resources.food < foodNeeded(living(state)) * 4 && spare() >= 30
          && tryAct({ type: 'diplomacy', neighborId: 'tellani', act: 'caravan' })) tally.caravans++;
      if (spare() >= 25 && tryAct({ type: 'hireMaster', skill: MASTER_SKILLS[Math.floor(state.turn / 4) % MASTER_SKILLS.length] })) tally.masters++;
      if (spare() >= clanGiftCost(state) + 150 && tryAct({ type: 'giftClans' })) tally.clanGifts++;
    }
    // PEACE=1 seeks a lasting peace with the Skarn: gifts until they will
    // agree, then peace. PEACE=honor also honors the peace when warned.
    if (process.env.PEACE && strategy === 'village' && state.neighbors.skarn.known && !state.pendingEvent) {
      const sk = state.neighbors.skarn;
      const tryAct = (a) => { const r = applyAction(state, a); if (!r.error) { state = r.state; return true; } return false; };
      if (!sk.peace) {
        if (!tryAct({ type: 'diplomacy', neighborId: 'skarn', act: 'peace' }) && state.resources.food >= 60) tryAct({ type: 'diplomacy', neighborId: 'skarn', act: 'giftFood' });
        if (sk.peace || state.neighbors.skarn.peace) tally.peacesMade++;
      } else if (process.env.PEACE === 'honor' && sk.peaceWarned) {
        if (tryAct({ type: 'diplomacy', neighborId: 'skarn', act: 'honorGoods' }) || tryAct({ type: 'diplomacy', neighborId: 'skarn', act: 'honorFood' })) tally.honors++;
      }
      if (state.neighbors.skarn.peace) tally.peaceSeasons++;
    }
    // LAWS="food=byWork,service=militia" tries a set of laws once possible.
    if (process.env.LAWS && strategy === 'village') {
      for (const pair of process.env.LAWS.split(',')) {
        const [law, option] = pair.split('=');
        if (state.laws && state.laws[law] !== option) {
          const r = applyAction(state, { type: 'setLaw', law, option });
          if (!r.error) state = r.state;
        }
      }
    }
    if (strategy === 'village' && !villageBlocker(state)) {
      state = act(state, { type: 'foundVillage' });
      // FOODSTORES=12 (or full) sets how much food the council keeps.
      if (process.env.FOODSTORES) state = act(state, { type: 'setFoodStores', choice: process.env.FOODSTORES });
      villages++;
      villageYears.push(Math.ceil((state.turn + 1) / 4));
    }
    if (strategy.startsWith('orders') || strategy === 'village') {
      state = chooseSites(state);
      state = chooseStudy(state);
      const project = chooseProject(state);
      if (project) state = act(state, { type: 'queueBuilding', buildingId: project });
    }
    if (strategy === 'sensible') {
      // Feast when the stores are getting full and food is to spare.
      if (!feastBlocker(state) && state.resources.food >= storageCapacity(state) * 0.75
          && state.resources.food - feastCost(state) >= foodNeeded(living(state)) * 3) {
        state = act(state, { type: 'holdFeast' });
      }
      state = chooseSites(state);
      state = chooseStudy(state);
      for (const [personId, task] of sensiblePlan(state)) state = act(state, { type: 'assign', personId, task });
      const project = chooseProject(state);
      if (project) state = act(state, { type: 'queueBuilding', buildingId: project });
    }
    state = act(state, { type: 'endTurn' });
    const lines = [...state.report.urgent, ...state.report.events, ...(state.report.routine || []), ...(state.report.decisions || [])];
    const alive = living(state).filter((p) => p.age >= 16 && p.task !== 'rest');
    if (alive.length) {
      tally.morale += alive.reduce((sum, p) => sum + p.morale, 0) / alive.length;
      tally.high += alive.filter((p) => p.morale >= 70).length / alive.length;
      tally.turns++;
    }
    if (process.env.TRACE && Number(process.env.TRACE) === seed) {
      const shown = lines.filter((l) => new RegExp(process.env.TRACE_MATCH || '.').test(l));
      if (shown.length) console.log(`${state.report.finished} (${living(state).length} people, ${state.resources.food} food): ${shown.join(' | ')}`);
    }
    countFights(lines);
    for (const l of lines) {
      const m = l.match(/(\d+) food rotted/);
      if (m && l.startsWith('The stores were overflowing')) tally.rotted += Number(m[1]);
      if (/not enough firewood/.test(l)) tally.cold++;
      if (/come to settle/.test(l)) tally.settlers += /(\d+) settlers have/.test(l) ? Number(l.match(/(\d+) settlers have/)[1]) : (l.match(/ and /) && /have come/.test(l)) ? 2 : 1;
      if (/defies you: a decision/.test(l)) tally.defiance++;
      if (/governor of .* died in old age/.test(l)) tally.governorsDied++;
      if (/^Skarn skirmishers fell/.test(l)) tally.harried++;
      if (/have surrounded/.test(l)) tally.sieges++;
      if (/^The Skarn host has come/.test(l)) tally.hosts++;
      if (/guards drove them off/.test(l)) tally.repelled++;
      if (/hard winter has come|^Drought|herds have moved/.test(l)) tally.lean++;
      if (/^Raiders are/.test(l)) tally.raids++;
      if (/^The Skarn have cast the peace aside|^You refused .* The peace is over|cast the peace aside\. Their raiders/.test(l)) tally.peaceLost = (tally.peaceLost || 0) + 1;
      if (/hill clansmen, come for your stores/.test(l)) tally.clanRaids = (tally.clanRaids || 0) + 1;
      if (/^Food ran out/.test(l)) tally.hungry++;
      if (/slipped into the trees|fled into the trees until|grabbed what they could/.test(l)) tally.hid++;
      if (/A great host has time/.test(l)) tally.hidHost++;
      if (/Skarn host has come/.test(l)) tally.hostsFought++;
      if (/ has died\.$/.test(l)) tally.deaths++;
      const killed = l.match(/Killed: ([^.]+)\./);
      if (killed) tally.killed += killed[1].split(/, | and /).length;
      if (/ was killed\.$/.test(l)) tally.killed++;
      if (/died peacefully|old age/.test(l)) tally.oldAge++;
    }
  }
  return state;
}

const STRATEGIES = (process.argv[4] || "sensible,orders,idle").split(",");
for (const strategy of STRATEGIES) {
  let wiped = 0;
  let pop = 0;
  let milestone = 0;
  let farmed = 0;
  let food = 0;
  let kids = 0;
  let palisades = 0;
  let born = 0;
  let firstWipeYear = [];
  let feastsHeld = 0;
  villages = 0; villageYears = []; nationYears = [];
  let clanSum = 0; let stoneSum = 0; let goodsSum = 0; let learnedSum = 0; let skarnW = 0; let skarnP = 0; let nations = 0;
  let nationPop = 0; let townCount = 0; let townPop = 0; let loyaltySum = 0; let roads = 0; let counted = 0; let capitalPop = 0; let nationGames = 0;
  const roleCount = {};
  const built = {};
  tally = { towns: 0, aid: 0, defiance: 0, governorsDied: 0, peacesMade: 0, honors: 0, peaceSeasons: 0, hungry: 0, rotted: 0, lean: 0, raids: 0, deaths: 0, oldAge: 0, killed: 0, lost: 0, cold: 0, settlers: 0, harried: 0, repelled: 0, hosts: 0, sieges: 0, siegeSeasons: 0, sallies: 0, clanGifts: 0, swords: 0, caravans: 0, masters: 0, lostFights: 0, fightsWon: 0, ambushes: 0, scattered: 0, hid: 0, hidHost: 0, hostsFought: 0, villageEvents: 0, morale: 0, high: 0, turns: 0 };
  for (let i = 0; i < GAMES; i++) {
    const end = play(1000 + i, strategy);
    if (end.gameOver) { wiped++; firstWipeYear.push(Math.ceil(end.turn / 4)); }
    pop += living(end).length;
    stoneSum += end.resources.stone || 0;
    clanSum += (end.clans && end.clans.warriors) || 0;
    // POWER=1 prints each village's defense against what the Skarn and clans could send.
    if (process.env.POWER && end.neighbors.skarn.nation) console.log(`defense ${villageDefense(end).toFixed(0)} x cover ${coverWeight(end)} | fighters ${living(end).filter((p) => p.health >= 40 && p.age >= 12).length} | skarn ${end.neighbors.skarn.nation.warriors}+clans ${end.clans.warriors} power ${bandPower(end, skarnStrength(end)).toFixed(0)}`);
    goodsSum += end.resources.goods || 0;
    learnedSum += end.knowledge.learned.length;
    if (end.neighbors.skarn.nation) { skarnW += end.neighbors.skarn.nation.warriors; skarnP += end.neighbors.skarn.nation.population; nations++; }
    if (process.env.BUILDINGS) for (const [k, n] of Object.entries(end.buildings)) built[k] = (built[k] || 0) + n;
    tally.lost += end.people.length - living(end).length;
    feastsHeld += end.deeds.feasts || 0;
    if (end.settlements && end.settlements.length) {
      nationGames++;
      capitalPop += living(end).length;
      nationPop += nationPopulation(end, living(end).length);
      townCount += end.settlements.length;
      for (const t of end.settlements) {
        townPop += t.population;
        loyaltySum += t.loyalty;
        roleCount[t.role] = (roleCount[t.role] || 0) + 1;
      }
      roads += end.buildings.road || 0;
      if (end.capitalCounted) counted++;
    }

    kids += living(end).filter((p) => p.age < 16).length;
    born += end.people.filter((p) => p.parent).length;
    food += end.resources.food;
    if (end.milestoneReached) milestone++;
    if (end.buildings.palisade) palisades++;
    if (hasKnowledge(end, 'farming')) farmed++;
  }
  if (process.env.BUILDINGS) console.log('buildings:', Object.entries(built).map(([k, n]) => `${k} ${(n / GAMES).toFixed(1)}`).join(', '));
  if (nationGames) {
    const ng = nationGames;
    console.log(`nation (${ng} games): capital ${(capitalPop / ng).toFixed(0)}, nation ${(nationPop / ng).toFixed(0)} | settlements ${(townCount / ng).toFixed(1)} of avg ${(townPop / Math.max(1, townCount)).toFixed(0)} people, loyalty ${(loyaltySum / Math.max(1, townCount)).toFixed(0)} | roles ${Object.entries(roleCount).map(([k, n]) => `${k} ${n}`).join(', ')} | roads ${(roads / ng).toFixed(1)} | founded ${(tally.towns / ng).toFixed(1)}, aid ${(tally.aid / ng).toFixed(1)}, defiance ${(tally.defiance / ng).toFixed(2)}, governors died ${(tally.governorsDied / ng).toFixed(2)} | capital counted by group ${counted}`);
  }
  const avgWipe = firstWipeYear.length ? (firstWipeYear.reduce((a, b) => a + b, 0) / firstWipeYear.length).toFixed(1) : '-';
  console.log(`${strategy}, ${process.env.DIFFICULTY || DEFAULT_DIFFICULTY}: ${GAMES} games, ${YEARS} years | wiped out ${wiped} (avg year ${avgWipe}) | avg survivors ${(pop / GAMES).toFixed(1)} | milestone ${milestone} (palisades ${palisades}) | farming ${farmed} | avg food ${(food / GAMES).toFixed(0)} | born ${(born / GAMES).toFixed(1)} | under 16 ${(kids / GAMES).toFixed(1)} | hungry seasons ${(tally.hungry / GAMES).toFixed(2)} | rotted ${(tally.rotted / GAMES).toFixed(0)} | feasts ${(feastsHeld / GAMES).toFixed(1)} | lean times ${(tally.lean / GAMES).toFixed(1)} | raids ${(tally.raids / GAMES).toFixed(1)} | firewood shortages ${(tally.cold / GAMES).toFixed(1)} | people lost ${(tally.lost / GAMES).toFixed(1)} (old age ${(tally.oldAge / GAMES).toFixed(1)}) | stone ${(stoneSum / GAMES).toFixed(0)}, goods ${(goodsSum / GAMES).toFixed(0)}, discoveries ${(learnedSum / GAMES).toFixed(1)} | skirmishes ${(tally.harried / GAMES).toFixed(1)} (driven off ${(tally.repelled / GAMES).toFixed(1)}) | sieges ${(tally.sieges / GAMES).toFixed(1)} (${(tally.siegeSeasons / GAMES).toFixed(1)} seasons, ${(tally.sallies / GAMES).toFixed(1)} sallies) | great hosts ${(tally.hosts / GAMES).toFixed(1)} | Skarn warriors ${nations ? (skarnW / nations).toFixed(0) : "-"} of ${nations ? (skarnP / nations).toFixed(0) : "-"} | hill clansmen ${(clanSum / GAMES).toFixed(1)} (gifts ${(tally.clanGifts / GAMES).toFixed(1)}) | spent goods on masters ${(tally.masters / GAMES).toFixed(1)}, sell-swords ${(tally.swords / GAMES).toFixed(1)}, caravans ${(tally.caravans / GAMES).toFixed(1)} | killed in battle ${(tally.killed / GAMES).toFixed(1)} | fights won ${(tally.fightsWon / GAMES).toFixed(1)}, not won ${(tally.lostFights / GAMES).toFixed(1)} (${Math.round(100 * tally.lostFights / Math.max(1, tally.fightsWon + tally.lostFights))}%) | ambushes ${(tally.ambushes / GAMES).toFixed(1)} (scattered ${(tally.scattered / GAMES).toFixed(1)}) | hosts that stormed ${(tally.hostsFought / GAMES).toFixed(1)} | hid ${(tally.hid / GAMES).toFixed(1)} (from hosts ${(tally.hidHost / GAMES).toFixed(1)}) | peace made ${(tally.peacesMade / GAMES).toFixed(1)}, seasons at peace ${(tally.peaceSeasons / GAMES).toFixed(1)}, honored ${(tally.honors / GAMES).toFixed(1)} | peace lost ${((tally.peaceLost || 0) / GAMES).toFixed(1)} | clan raids ${((tally.clanRaids || 0) / GAMES).toFixed(1)} | villages ${villages}${villageYears.length ? ` (avg year ${(villageYears.reduce((a, b) => a + b, 0) / villageYears.length).toFixed(1)})` : ''} | village decisions ${(tally.villageEvents / GAMES).toFixed(1)} | Nation era ${nationYears.length}${nationYears.length ? ` (avg year ${(nationYears.reduce((a, b) => a + b, 0) / nationYears.length).toFixed(1)})` : ''} | settlers ${(tally.settlers / GAMES).toFixed(1)} | workers' morale ${(tally.morale / Math.max(1, tally.turns)).toFixed(0)}, in high spirits ${Math.round(100 * tally.high / Math.max(1, tally.turns))}%`);
}
