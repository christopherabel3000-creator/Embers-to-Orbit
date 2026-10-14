// Resolving the end of a season: work, food, warmth, health, events.

import {
  BUILDINGS, PLACES, PLACE_ORDER, WANDERERS, MILESTONE_POPULATION, KNOWLEDGE, TASKS, LEAN_TIMES,
} from './data.js';
import {
  living, seasonIndex, dateLabel, shelterCapacity, isKnown, foodNeeded,
  woodNeededForWarmth, spoilageRate, makePerson, year, placeName, unexploredNeighbors,
  hasKnowledge, fieldPlots, shelterNeeded, hasCondition, storageCapacity, inVillage,
} from './state.js';
import { maybeSettlers } from './village.js';
import { lawSettle } from './laws.js';
import { spendGoods } from './goods.js';
import {
  besieged, OUTSIDE_TASKS, siegeSeason, skarnApproach, startSiege,
} from './siege.js';
import { settlementsSeason, harrySettlements } from './settlements.js';
import { skarnStrength, clanRaidChance, clansRaidingAlone } from './clans.js';
import { peaceYear } from './peace.js';
import { raidGrowth } from './rules.js';
import { crowdingSettle } from './village.js';
import {
  nationsActive, startNations, valleyYear, borderFriction, skarnBand, alliedHelpers, allies, skarnRaidFactor, helpersText,
  maybeHarry,
} from './nations.js';
import { NEIGHBORS } from './data.js';
import { overflowRot } from './stores.js';
import { advanceLife } from './life.js';
import { applyBuildWork } from './building.js';
import { applyStudy } from './study.js';
import { createBattle } from './battle.js';
import {
  meet, driftRelations, raidModifier, skarnAtPeace,
} from './neighbors.js';
import {
  expectedFood, expectedWood, expectedWork, healingPoints, huntInjuryChance,
  scoutSuccessChance, siteFor, DEPLETION, RECOVERY, studyPoints, farmerCapacity,
  expectedStone, expectedGoods, FOOD_PER_PASTURE,
  foodPerPlot, PLANT_PER_FARMER, TEND_PER_FARMER, HARVEST_PER_FARMER,
} from './rules.js';
import { applyStandingOrders } from './orders.js';
import { recordDeed, checkTraditions, hasTradition } from './legacy.js';
import { gainExperience } from './skills.js';
import { progressConditions, maybeStartEvent } from './events.js';
import { nextRandom, randomBetween, randomInt, chance, pick } from './rng.js';
import { refreshAdvisors } from './advisors.js';

function shuffle(state, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function listNames(people) {
  const names = people.map((p) => p.name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function hurt(person, amount) {
  person.health = clamp(person.health - amount);
}

export function resolveSeason(state) {
  if (inVillage(state) && !state.neighbors.skarn.nation) startNations(state); // Older village saves.
  const urgent = [];
  const events = [];
  const ordersDone = [];
  const s = seasonIndex(state);
  const sieged = besieged(state); // No one works outside the walls.
  const finishedLabel = dateLabel(state);
  const people = living(state);
  const startCount = people.length;

  // 1. Work.
  let food = 0;
  let wood = 0;
  let stone = 0;
  let goods = 0;
  let work = 0;
  let healPool = 0;
  let studyPool = 0;
  const injuredWhileHunting = [];
  const scouts = [];
  // Skirmishers make work at a harried place worth half.
  const harriedTask = (task) => state.harried && state.workSites[task] === state.harried ? 0.5 : 1;
  for (const p of people) {
    if (sieged && OUTSIDE_TASKS.includes(p.task)) continue;
    const variance = randomBetween(state, 0.7, 1.3) * harriedTask(p.task);
    switch (p.task) {
      case 'hunt':
        food += expectedFood(state, p, 'hunt', s) * variance;
        if (chance(state, huntInjuryChance(state, p))) {
          hurt(p, randomInt(state, 25, 40));
          injuredWhileHunting.push(p);
        }
        break;
      case 'forage':
        food += expectedFood(state, p, 'forage', s) * variance;
        break;
      case 'wood':
        wood += expectedWood(state, p, 'wood', s) * variance;
        break;
      case 'build':
        work += expectedWork(p, state);
        break;
      case 'quarry':
        stone += expectedStone(state, p) * variance;
        break;
      case 'craft':
        goods += expectedGoods(state, p) * variance;
        break;
      case 'heal':
        healPool += healingPoints(state, p);
        break;
      case 'study':
        studyPool += studyPoints(p, state);
        break;
      case 'scout':
        scouts.push(p);
        if (chance(state, 0.05)) {
          hurt(p, randomInt(state, 20, 35));
          injuredWhileHunting.push(p);
        }
        break;
      default:
        break;
    }
  }
  food = Math.round(food);
  wood = Math.round(wood);
  stone = Math.round(stone);
  goods = Math.round(goods);
  state.resources.food += food;
  state.resources.wood += wood;
  state.resources.stone = (state.resources.stone || 0) + stone;
  state.resources.goods = (state.resources.goods || 0) + goods;
  const herds = Math.round((state.buildings.pasture || 0) * FOOD_PER_PASTURE * (sieged ? 0.5 : 1)); // Penned close in a siege.
  state.resources.food += herds;
  const hunters = people.filter((p) => p.task === 'hunt' || p.task === 'forage').length;
  recordDeed(state, 'hunterSeasons', people.filter((p) => p.task === 'hunt').length);
  if (hunters > 0 || food > 0) events.push(`Hunters and foragers brought in ${food} food.`);
  if (wood > 0) events.push(`Woodcutters gathered ${wood} wood.`);
  if (sieged && people.some((p) => OUTSIDE_TASKS.includes(p.task))) urgent.push('The Skarn siege kept everyone inside the walls: no one could hunt, forage, farm, cut wood or stone, or scout.');
  if (stone > 0) events.push(`Quarriers cut ${stone} stone.`);
  if (goods > 0) events.push(`Crafters made ${goods} goods.`);
  if (herds > 0) events.push(`The herds in the pastures gave ${herds} food.`);
  for (const p of injuredWhileHunting) {
    urgent.push(`${p.name} was injured while ${p.task === 'scout' ? 'scouting' : 'hunting'}.`);
  }

  // 2. Warmth comes before building: the fires get their wood first, and
  // builders can only use what is left.
  const cold = new Set();
  const woodNeed = woodNeededForWarmth(s, people.length, hasCondition(state, 'hardWinter'));
  if (woodNeed > 0) {
    if (state.resources.wood >= woodNeed) {
      state.resources.wood -= woodNeed;
      events.push(`The fires burned ${woodNeed} wood to keep everyone warm.`);
    } else {
      const shortfall = woodNeed - state.resources.wood;
      state.resources.wood = 0;
      const freezing = shuffle(state, people).slice(0, Math.min(people.length, s === 3 ? shortfall : shortfall * 2));
      for (const p of freezing) {
        cold.add(p.id);
        hurt(p, hasKnowledge(state, 'clothing') ? 7 : 12);
        p.morale = clamp(p.morale - 6);
      }
      urgent.push(`There was not enough firewood. ${freezing.length} ${freezing.length === 1 ? 'person' : 'people'} suffered from the cold.`);
    }
  }

  // Other settlements send home what they can spare, unless the road is cut.
  if (!sieged) events.push(...settlementsSeason(state));

  // 3. Building, with whatever wood the fires did not need.
  events.push(...applyBuildWork(state, work, { afterFires: woodNeed > 0 }));

  // Practice: everyone who worked gets a little better at it.
  // Badly hurt or sick people learn at half speed. Winter farmers have no
  // farm work to practice.
  // The young learn half again as fast, and anyone working beside a
  // skilled mentor (skill 4 or more) picks up extra.
  const improved = [];
  for (const p of people) {
    const skill = TASKS[p.task] && TASKS[p.task].skill;
    if (!skill || (p.task === 'farm' && s === 3) || (p.task === 'forage' && s === 3)) continue;
    let amount = p.health < 40 || p.sick ? 0.5 : 1;
    if (p.age < 16) amount *= 1.5;
    const mentor = people.some((m) => m !== p && m.task === p.task && m.skills[skill] >= 4 && m.skills[skill] > p.skills[skill]);
    if (mentor) amount += 0.5;
    const level = gainExperience(p, skill, amount);
    if (level) improved.push(`${p.name}'s ${skill} rose to ${level}`);
  }
  if (improved.length) events.push(`Practice paid off: ${improved.join('; ')}.`);

  // Study: points flow into the current discovery, then the next in the queue.
  if (studyPool > 0) {
    const studied = applyStudy(state, studyPool);
    urgent.push(...studied.urgent);
    events.push(...studied.events);
  }

  // Farming follows the year: plant in spring, tend in summer, harvest in autumn.
  const farmers = sieged ? [] : people.filter((p) => p.task === 'farm');
  if (farmers.length || state.farm.planted) {
    const plots = fieldPlots(state);
    if (s === 0 && farmers.length) {
      if (plots === 0) {
        events.push('Farmers had no fields to plant. Build a field first.');
      } else {
        const can = Math.floor(farmerCapacity(people, PLANT_PER_FARMER));
        const planted = Math.min(plots - state.farm.planted, can);
        state.farm.planted += planted;
        events.push(`Farmers planted ${planted} ${planted === 1 ? 'plot' : 'plots'} of grain. ${state.farm.planted} of ${plots} plots are sown.`);
      }
    } else if (s === 1 && state.farm.planted) {
      state.farm.tended = Math.min(state.farm.planted, farmerCapacity(people, TEND_PER_FARMER));
      const share = Math.round((state.farm.tended / state.farm.planted) * 100);
      events.push(share >= 100
        ? 'Farmers tended every plot. The grain is growing well.'
        : `Farmers tended ${share} percent of the plots. Untended grain will yield less.`);
    } else if (s === 2 && state.farm.planted) {
      const planted = state.farm.planted;
      const harvested = Math.min(planted, farmerCapacity(people, HARVEST_PER_FARMER));
      const perPlot = foodPerPlot(state.farm.tended / planted, state);
      const gained = Math.round(harvested * perPlot + (planted - harvested) * perPlot * 0.5);
      state.resources.food += gained;
      if (gained > 0) recordDeed(state, 'harvests');
      events.push(harvested >= planted
        ? `Harvest: ${gained} food from ${planted} plots.`
        : `Harvest: ${gained} food. There were too few hands, and some grain rotted in the fields.`);
      state.farm = { planted: 0, tended: 0 };
    } else if (s === 3 && farmers.length) {
      events.push('There was no farm work in winter.');
    }
  }

  // 4. Scouting: scouts explore the unknown paths leading from their place.
  const scoutBase = siteFor(state, 'scout');
  for (const scout of scouts) {
    if (!chance(state, scoutSuccessChance(scout))) {
      events.push(`${scout.name} scouted beyond ${placeName(state, scoutBase)} but found nothing new.`);
      continue;
    }
    const options = [...unexploredNeighbors(state, scoutBase)];
    if (state.wanderersMet < WANDERERS.length) {
      options.push('wanderer');
      if (hasTradition(state, 'hearth')) options.push('wanderer'); // Word of your welcome spreads.
    }
    if (options.length === 0) {
      events.push(`${scout.name} scouted beyond ${placeName(state, scoutBase)}, but every path from there is already explored. Send scouts out from another place.`);
      continue;
    }
    const found = pick(state, options);
    if (found === 'wanderer') {
      const template = WANDERERS[state.wanderersMet];
      state.wanderersMet += 1;
      const newcomer = makePerson(template, state.nextPersonId++, 'rest');
      newcomer.morale = hasTradition(state, 'hearth') ? 65 : 50;
      newcomer.isNew = true;
      state.people.push(newcomer);
      events.push(`${scout.name} met ${newcomer.name}, ${template.note.charAt(0).toLowerCase()}${template.note.slice(1)} ${newcomer.name} has joined the camp.`);
    } else {
      state.places[found].known = true;
      events.push(`${scout.name} explored beyond ${placeName(state, scoutBase)} and found ${PLACES[found].found}`);
      if (found === 'abandonedCamp') {
        state.resources.food += 15;
        state.resources.wood += 10;
      }
      if (PLACES[found].people) meet(state, PLACES[found].people);
    }
  }

  // Hunting and foraging use up a place; every place slowly recovers.
  const huntSite = siteFor(state, 'hunt');
  const forageSite = siteFor(state, 'forage');
  const huntersOut = sieged ? 0 : people.filter((p) => p.task === 'hunt').length;
  const foragersOut = s === 3 || sieged ? 0 : people.filter((p) => p.task === 'forage').length;
  for (const id of PLACE_ORDER) {
    const a = state.places[id].abundance;
    if (id === huntSite) a.hunt -= huntersOut * DEPLETION.hunt;
    if (id === forageSite) a.forage -= foragersOut * DEPLETION.forage;
    a.hunt = Math.max(0, Math.min(100, a.hunt + RECOVERY.hunt[s]));
    a.forage = Math.max(0, Math.min(100, a.forage + RECOVERY.forage[s]));
  }

  // Fever and other ongoing conditions.
  const conditionLines = progressConditions(state, people.filter((p) => p.task === 'heal').length);
  urgent.push(...conditionLines.urgent);
  events.push(...conditionLines.events);

  // 5. Healing: the most hurt are treated first, up to 30 health each.
  const patients = people.filter((p) => p.health < 100).sort((a, b) => a.health - b.health);
  const healed = [];
  for (const p of patients) {
    if (healPool <= 0) break;
    const amount = Math.min(30, 100 - p.health, healPool);
    p.health = clamp(p.health + amount);
    healPool -= amount;
    if (amount >= 10) healed.push(p);
  }
  if (healed.length) events.push(`${listNames(healed)} ${healed.length === 1 ? 'was' : 'were'} treated for injuries.`);

  // 6. Eating.
  const need = foodNeeded(people);
  const unfed = new Set();
  if (state.resources.food >= need) {
    state.resources.food -= need;
  } else {
    const hungry = [];
    for (const p of shuffle(state, people)) {
      const portion = foodNeeded([p]);
      if (state.resources.food >= portion) state.resources.food -= portion;
      else hungry.push(p);
    }
    for (const p of hungry) {
      unfed.add(p.id);
      hurt(p, 25);
      p.morale = clamp(p.morale - 15);
    }
    urgent.push(`Food ran out. ${hungry.length} ${hungry.length === 1 ? 'person' : 'people'} went hungry this season.`);
  }

  // 7. Shelter. (The fires were lit first, before any building.)
  const capacity = shelterCapacity(state);
  const excess = Math.ceil(shelterNeeded(people) - capacity);
  if (excess > 0 && (s === 2 || s === 3)) {
    const exposed = shuffle(state, people).slice(0, excess);
    for (const p of exposed) {
      cold.add(p.id);
      hurt(p, (s === 3 ? 30 : 10) * (hasKnowledge(state, 'clothing') ? 0.6 : 1));
      p.morale = clamp(p.morale - 8);
    }
    urgent.push(`${exposed.length} ${exposed.length === 1 ? 'person' : 'people'} slept without shelter in the ${s === 3 ? 'winter cold' : 'autumn chill'}.`);
  }

  // 8. Recovery and morale. Goods for comforts and arms are spent first.
  const spent = spendGoods(state);
  events.push(...spent.events);
  const crowding = crowdingSettle(state);
  for (const p of people) {
    if (p.health <= 0) continue; // Too far gone to recover.
    if (!unfed.has(p.id) && !cold.has(p.id)) p.health = clamp(p.health + 5);
    if (p.task === 'rest') {
      p.health = clamp(p.health + 15);
      p.morale = clamp(p.morale + 12);
    }
    if (state.buildings.healersHut > 0 && p.health < 75) p.health = clamp(p.health + 5);
    // Spirits settle back toward steady: high spirits fade faster the higher they are.
    const settle = (state.buildings.meetingHall > 0 ? 62 : 55) + lawSettle(state) + spent.settle
      + (state.buildings.shrine > 0 ? 2 : 0) // A meeting hall, the laws, comforts, and a shrine move where spirits settle.
      - crowding; // A large village frays.
    if (p.morale < settle) p.morale = clamp(Math.min(settle, p.morale + 3));
    else if (p.morale > settle) p.morale = clamp(p.morale - 3 - (p.morale - settle) * 0.2);
  }

  // 9. Spoilage.
  const spoiled = Math.floor(state.resources.food * spoilageRate(state));
  if (spoiled > 0) {
    state.resources.food -= spoiled;
    events.push(`${spoiled} food spoiled in storage.`);
  }
  // Food beyond the room in the stores rots quickly.
  const rotted = overflowRot(state);
  if (rotted > 0) {
    state.resources.food -= rotted;
    const line = `The stores were overflowing, and ${rotted} food rotted. They hold ${storageCapacity(state)}.`;
    if (rotted >= 15) urgent.push(`${line} A feast, gifts, trade, or another storehouse would put the extra to use.`);
    else events.push(line);
  }

  // 10. Deaths.
  const dead = people.filter((p) => p.health <= 0);
  for (const p of dead) {
    p.alive = false;
    const hero = (state.heroes || []).find((h) => h.id === p.id);
    urgent.unshift(hero ? `${p.name}, a hero of the village, has died. Everyone remembers how ${p.name} ${hero.deed}.` : `${p.name} has died.`);
  }
  if (dead.length) {
    const grief = state.buildings.shrine > 0 ? 6 : 12; // A shrine eases grief.
    for (const p of living(state)) p.morale = clamp(p.morale - grief * dead.length);
  }

  // Hard winters and droughts pass.
  for (const c of state.conditions) {
    if (LEAN_TIMES[c.id]) c.seasonsLeft -= 1;
  }
  for (const c of state.conditions.filter((x) => LEAN_TIMES[x.id] && x.seasonsLeft <= 0)) {
    events.push(LEAN_TIMES[c.id].ends);
  }
  state.conditions = state.conditions.filter((c) => !(LEAN_TIMES[c.id] && c.seasonsLeft <= 0));

  // 11. Advance the calendar.
  state.turn += 1;
  const survivors = living(state);
  refreshAdvisors(state);
  driftRelations(state);
  if (state.raidThreat && state.pendingEvent && state.pendingEvent.type === 'raid') state.raidThreat = false;

  if (survivors.length === 0) {
    state.gameOver = true;
    urgent.unshift(`The last of your people are gone. The fire at ${state.campName} has gone out.`);
  } else {
    // Plenty of food lifts spirits.
    // Plenty keeps spirits steady, but only a feast lifts them high.
    if (state.resources.food >= foodNeeded(survivors) * 2) {
      for (const p of survivors) if (p.morale < 62) p.morale = clamp(p.morale + 3);
    }
    const life = advanceLife(state);
    urgent.push(...life.urgent);
    events.push(...life.events);
    if (sieged) urgent.push(...siegeSeason(state));
    if (!state.siege) events.push(...maybeSettlers(state));
    if (!state.siege) events.push(...borderFriction(state));
    const valley = valleyYear(state);
    (state.pendingEvent && state.pendingEvent.id === 'allyCall' ? urgent : events).push(...valley);
    const peace = peaceYear(state); // The Skarn weigh the peace, and their chief.
    urgent.push(...peace.urgent);
    events.push(...peace.events);
    if (living(state).length === 0) {
      state.gameOver = true;
      urgent.push(`The last of your people are gone. The fire at ${state.campName} has gone out.`);
    }
    maybeStartRaid(state, scouts.length > 0, urgent);
    if (!state.siege) urgent.push(...maybeHarry(state));
    if (!state.siege) urgent.push(...harrySettlements(state));
    const happened = maybeStartEvent(state);
    urgent.push(...happened.urgent);
    events.push(...happened.events);
    const fromOrders = applyStandingOrders(state);
    urgent.push(...fromOrders.urgent);
    ordersDone.push(...fromOrders.orders);
    urgent.push(...checkTraditions(state));
    if (!state.milestoneReached && survivors.length >= MILESTONE_POPULATION
        && state.buildings.storehouse > 0 && state.buildings.palisade > 0 && hasKnowledge(state, 'farming')) {
      state.milestoneReached = true;
      urgent.push(`${state.campName} has grown into a true settlement of ${survivors.length} people: farming its own fields, safe behind its palisade. Your people could now become a village, whenever you choose. See the Report screen.`);
    }
  }
  if (survivors.length !== startCount && survivors.length > 0) {
    events.push(`${state.campName} now has ${survivors.length} people.`);
  }

  state.feastThisSeason = false;
  state.report = { title: dateLabel(state), finished: finishedLabel, urgent, events, orders: ordersDone };
  for (const line of [...urgent, ...events, ...ordersDone]) {
    state.log.push({ turn: state.turn - 1, date: finishedLabel, text: line });
  }
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

function maybeStartRaid(state, scoutsOut, urgent) {
  if (state.turn < 2 || state.pendingEvent || state.siege) return;
  // A great host gathered last season marches now, unless peace was made.
  if (state.skarnHost && state.turn >= state.skarnHost) {
    state.skarnHost = null;
    if (!skarnAtPeace(state) && state.neighbors.skarn.nation) {
      let raiders = Math.max(6, Math.round(skarnStrength(state) * 0.9));
      // Facing walls they cannot take, the host settles in for a siege.
      if (skarnApproach(state, raiders) === 'siege') {
        urgent.unshift(startSiege(state, raiders));
        return;
      }
      const helpers = alliedHelpers(state);
      const stopped = Math.min(helpers, raiders - 4);
      raiders -= Math.max(0, stopped);
      state.pendingEvent = { type: 'raid', raiders, warned: true, from: 'skarn', host: true };
      state.pendingEvent.battle = createBattle(state, state.pendingEvent);
      urgent.unshift(`The Skarn host has come: about ${raiders} warriors at the edge of ${state.campName}.${stopped > 0 ? ` ${helpersText(state)} turned back ${stopped} more.` : ''} Decide how to respond before anything else.`);
      return;
    }
    urgent.push('The Skarn host broke up and went home: they will not march against a people at peace with them.');
  }
  // The hill clans raid on their own while the Skarn keep the peace.
  const clanOdds = clanRaidChance(state); // Only roll when they could come, so other chances are untouched.
  if (clanOdds > 0 && chance(state, clanOdds * Math.max(0.6, 1 - 0.04 * guardsOnWatch(state)))) {
    const c = clansRaidingAlone(state);
    let raiders = Math.max(4, Math.round(c * (0.5 + 0.3 * (randomInt(state, 0, 100) / 100))));
    const helpers = alliedHelpers(state);
    const stopped = Math.min(helpers, raiders - 2);
    raiders -= Math.max(0, stopped);
    const warned = state.buildings.watchtower > 0 || guardsOnWatch(state) >= 2 || (scoutsOut && chance(state, 0.6));
    state.pendingEvent = { type: 'raid', raiders, warned, from: 'clans' };
    state.pendingEvent.battle = createBattle(state, state.pendingEvent);
    const ally = stopped > 0 ? ` ${helpersText(state)} turned back ${stopped} of them on the road.` : '';
    urgent.unshift(`${warned ? 'Raiders are coming! Scouts spotted' : 'Raiders are at the edge of the village! They caught you by surprise:'} about ${raiders} hill clansmen, come for your stores. The Skarn's peace does not bind them.${ally} Decide how to respond before anything else.`);
    return;
  }
  const y = year(state);
  let p = 0.1 + 0.02 * Math.min(y, 10);
  // Full stores draw raiders: word gets around.
  if (state.resources.food > 80) p += 0.05;
  p += Math.min(0.1, Math.max(0, state.resources.food - WEALTH_START) / 3000);
  p *= raidModifier(state);
  p *= Math.max(0.6, 1 - 0.04 * guardsOnWatch(state)); // Guards keep some raiders away.
  if (hasKnowledge(state, 'chieftain')) p *= 0.85; // A strong chief is feared.
  if (nationsActive(state) && !skarnAtPeace(state)) p *= skarnRaidFactor(state); // A weakened Skarn raids less.
  if (!chance(state, Math.min(state.raidThreat ? 0.8 : 0.35, p))) return;
  // With peace or a truce, the only raiders are small bands of outlaws.
  const from = skarnAtPeace(state) ? 'outlaws' : 'skarn';
  const lure = wealthLure(state);
  // Once the Skarn are a nation, their war band comes from their warriors.
  let raiders = nationsActive(state) && from === 'skarn'
    ? skarnBand(state) + lure
    : randomInt(state, 4, 7) + raidGrowth(y) + lure;
  // A Skarn nation only storms a village it thinks it can take. Facing walls
  // it cannot take, a strong enough band lays siege; otherwise it waits.
  if (nationsActive(state) && from === 'skarn') {
    const approach = skarnApproach(state, raiders);
    if (approach === 'siege') {
      urgent.unshift(startSiege(state, raiders));
      return;
    }
    if (approach === 'wait') return;
  }
  if (from === 'outlaws') raiders = Math.max(3, Math.ceil((randomInt(state, 4, 7) + raidGrowth(y)) / 2));
  // Allies send warriors, who meet some of the raiders on the way.
  let allyNote = '';
  const helpers = from === 'skarn' && nationsActive(state) ? alliedHelpers(state) : 0;
  if (helpers > 0) {
    const stopped = Math.min(helpers, raiders - 2);
    raiders -= stopped;
    allyNote = ` ${helpersText(state)} met them on the road with ${helpers} fighters, and turned back ${stopped} of them.`;
  }
  const warned = state.buildings.watchtower > 0 || isKnown(state, 'raiderTrail') || guardsOnWatch(state) >= 2
    || (scoutsOut && chance(state, 0.6));
  state.raidThreat = false;
  state.pendingEvent = { type: 'raid', raiders, warned, from };
  state.pendingEvent.battle = createBattle(state, state.pendingEvent);
  const who = from === 'outlaws' ? 'outlaws' : state.neighbors.skarn.known ? 'Skarn raiders' : 'armed strangers';
  const drawn = (lure >= 2 ? ' Word of your full stores has drawn more of them.' : '') + allyNote;
  urgent.unshift(warned
    ? `Raiders are coming! Scouts spotted about ${raiders} ${who} heading for the camp.${drawn} Decide how to respond before anything else.`
    : `Raiders are at the edge of camp! About ${raiders} ${who} caught you by surprise.${drawn} Decide how to respond before anything else.`);
}

export function guardsOnWatch(state) {
  return living(state).filter((p) => p.task === 'guard' && p.health >= 40).length;
}

export { raidGrowth };

// Extra raiders drawn by a well-stocked camp.
// Stores beyond an ordinary reserve start to draw notice.
const WEALTH_START = 200;
export function wealthLure(state) {
  return Math.min(5, Math.floor(Math.max(0, state.resources.food - WEALTH_START) / 120));
}
