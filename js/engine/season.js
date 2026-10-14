// Resolving the end of a season: work, food, warmth, health, events.

import {
  BUILDINGS, PLACES, PLACE_ORDER, WANDERERS, MILESTONE_POPULATION, KNOWLEDGE, TASKS, LEAN_TIMES,
} from './data.js';
import {
  living, seasonIndex, dateLabel, shelterCapacity, isKnown, foodNeeded,
  woodNeededForWarmth, spoilageRate, makePerson, year, placeName, unexploredNeighbors,
  hasKnowledge, fieldPlots, shelterNeeded, hasCondition, storageCapacity,
} from './state.js';
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
  const urgent = [];
  const events = [];
  const ordersDone = [];
  const s = seasonIndex(state);
  const finishedLabel = dateLabel(state);
  const people = living(state);
  const startCount = people.length;

  // 1. Work.
  let food = 0;
  let wood = 0;
  let work = 0;
  let healPool = 0;
  let studyPool = 0;
  const injuredWhileHunting = [];
  const scouts = [];
  for (const p of people) {
    const variance = randomBetween(state, 0.7, 1.3);
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
  state.resources.food += food;
  state.resources.wood += wood;
  const hunters = people.filter((p) => p.task === 'hunt' || p.task === 'forage').length;
  recordDeed(state, 'hunterSeasons', people.filter((p) => p.task === 'hunt').length);
  if (hunters > 0 || food > 0) events.push(`Hunters and foragers brought in ${food} food.`);
  if (wood > 0) events.push(`Woodcutters gathered ${wood} wood.`);
  for (const p of injuredWhileHunting) {
    urgent.push(`${p.name} was injured while ${p.task === 'scout' ? 'scouting' : 'hunting'}.`);
  }

  // 2. Building.
  events.push(...applyBuildWork(state, work));

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
  const farmers = people.filter((p) => p.task === 'farm');
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

  // 3. Scouting: scouts explore the unknown paths leading from their place.
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
  const huntersOut = people.filter((p) => p.task === 'hunt').length;
  const foragersOut = s === 3 ? 0 : people.filter((p) => p.task === 'forage').length;
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

  // 4. Healing: the most hurt are treated first, up to 30 health each.
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

  // 5. Eating.
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

  // 6. Warmth and shelter.
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

  // 7. Recovery and morale.
  for (const p of people) {
    if (p.health <= 0) continue; // Too far gone to recover.
    if (!unfed.has(p.id) && !cold.has(p.id)) p.health = clamp(p.health + 5);
    if (p.task === 'rest') {
      p.health = clamp(p.health + 15);
      p.morale = clamp(p.morale + 12);
    }
    if (state.buildings.healersHut > 0 && p.health < 75) p.health = clamp(p.health + 5);
    // Spirits settle back toward steady: high spirits fade faster the higher they are.
    if (p.morale < 55) p.morale = clamp(p.morale + 3);
    else if (p.morale > 55) p.morale = clamp(p.morale - 3 - (p.morale - 55) * 0.2);
  }

  // 8. Spoilage.
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

  // 9. Deaths.
  const dead = people.filter((p) => p.health <= 0);
  for (const p of dead) {
    p.alive = false;
    urgent.unshift(`${p.name} has died.`);
  }
  if (dead.length) {
    for (const p of living(state)) p.morale = clamp(p.morale - 12 * dead.length);
  }

  // Hard winters and droughts pass.
  for (const c of state.conditions) {
    if (LEAN_TIMES[c.id]) c.seasonsLeft -= 1;
  }
  for (const c of state.conditions.filter((x) => LEAN_TIMES[x.id] && x.seasonsLeft <= 0)) {
    events.push(LEAN_TIMES[c.id].ends);
  }
  state.conditions = state.conditions.filter((c) => !(LEAN_TIMES[c.id] && c.seasonsLeft <= 0));

  // 10. Advance the calendar.
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
    if (living(state).length === 0) {
      state.gameOver = true;
      urgent.push(`The last of your people are gone. The fire at ${state.campName} has gone out.`);
    }
    maybeStartRaid(state, scouts.length > 0, urgent);
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
      urgent.push(`${state.campName} has grown into a true settlement of ${survivors.length} people: farming its own fields, safe behind its palisade. The Settlement era will arrive in a future update. You can keep playing.`);
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
  if (state.turn < 2) return;
  const y = year(state);
  let p = 0.1 + 0.02 * Math.min(y, 10);
  // Full stores draw raiders: word gets around.
  if (state.resources.food > 80) p += 0.05;
  p += Math.min(0.1, Math.max(0, state.resources.food - WEALTH_START) / 3000);
  p *= raidModifier(state);
  if (!chance(state, Math.min(state.raidThreat ? 0.8 : 0.35, p))) return;
  // With peace or a truce, the only raiders are small bands of outlaws.
  const from = skarnAtPeace(state) ? 'outlaws' : 'skarn';
  const lure = wealthLure(state);
  let raiders = randomInt(state, 4, 7) + raidGrowth(y) + lure;
  if (from === 'outlaws') raiders = Math.max(3, Math.ceil(raiders / 2));
  const warned = state.buildings.watchtower > 0 || isKnown(state, 'raiderTrail')
    || (scoutsOut && chance(state, 0.6));
  state.raidThreat = false;
  state.pendingEvent = { type: 'raid', raiders, warned, from };
  state.pendingEvent.battle = createBattle(state, state.pendingEvent);
  const who = from === 'outlaws' ? 'outlaws' : state.neighbors.skarn.known ? 'Skarn raiders' : 'armed strangers';
  const drawn = lure >= 2 ? ' Word of your full stores has drawn more of them.' : '';
  urgent.unshift(warned
    ? `Raiders are coming! Scouts spotted about ${raiders} ${who} heading for the camp.${drawn} Decide how to respond before anything else.`
    : `Raiders are at the edge of camp! About ${raiders} ${who} caught you by surprise.${drawn} Decide how to respond before anything else.`);
}

// Raiders grow bolder over the years: quickly at first, then more slowly.
// Two more raiders a year for five years, then one more every two years,
// leveling off at 16 more than the first raids.
export function raidGrowth(y) {
  if (y <= 6) return 2 * (y - 1);
  return Math.min(16, 10 + Math.floor((y - 6) / 2));
}

// Extra raiders drawn by a well-stocked camp.
// Stores beyond an ordinary reserve start to draw notice.
const WEALTH_START = 200;
export function wealthLure(state) {
  return Math.min(5, Math.floor(Math.max(0, state.resources.food - WEALTH_START) / 120));
}
