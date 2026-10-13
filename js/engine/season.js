// Resolving the end of a season: work, food, warmth, health, events.

import { BUILDINGS, PLACES, PLACE_ORDER, WANDERERS, MILESTONE_POPULATION } from './data.js';
import {
  living, seasonIndex, dateLabel, shelterCapacity, isKnown, foodNeeded,
  woodNeededForWarmth, spoilageRate, makePerson, year, placeName, unexploredNeighbors,
} from './state.js';
import {
  expectedFood, expectedWood, expectedWork, healingPoints, huntInjuryChance,
  scoutSuccessChance, siteFor, DEPLETION, RECOVERY,
} from './rules.js';
import { applyStandingOrders } from './orders.js';
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
        work += expectedWork(p);
        break;
      case 'heal':
        healPool += healingPoints(state, p);
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
  if (hunters > 0 || food > 0) events.push(`Hunters and foragers brought in ${food} food.`);
  if (wood > 0) events.push(`Woodcutters gathered ${wood} wood.`);
  for (const p of injuredWhileHunting) {
    urgent.push(`${p.name} was injured while ${p.task === 'scout' ? 'scouting' : 'hunting'}.`);
  }

  // 2. Building.
  if (state.project) {
    state.project.progress += work;
    const b = BUILDINGS[state.project.id];
    if (state.project.progress >= b.work) {
      state.buildings[state.project.id] += 1;
      events.push(`The ${b.name.toLowerCase()} is finished. ${b.description}`);
      state.project = null;
    } else if (work > 0) {
      const left = Math.ceil(b.work - state.project.progress);
      events.push(`Builders worked on the ${b.name.toLowerCase()}. ${left} work remaining.`);
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
    if (state.wanderersMet < WANDERERS.length) options.push('wanderer');
    if (options.length === 0) {
      events.push(`${scout.name} scouted beyond ${placeName(state, scoutBase)}, but every path from there is already explored. Send scouts out from another place.`);
      continue;
    }
    const found = pick(state, options);
    if (found === 'wanderer') {
      const template = WANDERERS[state.wanderersMet];
      state.wanderersMet += 1;
      const newcomer = makePerson(template, state.nextPersonId++, 'rest');
      newcomer.morale = 50;
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
  const need = foodNeeded(people.length);
  const unfed = new Set();
  if (state.resources.food >= need) {
    state.resources.food -= need;
  } else {
    const canFeed = Math.floor(state.resources.food / 2);
    state.resources.food -= canFeed * 2;
    const hungry = shuffle(state, people).slice(canFeed);
    for (const p of hungry) {
      unfed.add(p.id);
      hurt(p, 25);
      p.morale = clamp(p.morale - 15);
    }
    urgent.push(`Food ran out. ${hungry.length} ${hungry.length === 1 ? 'person' : 'people'} went hungry this season.`);
  }

  // 6. Warmth and shelter.
  const cold = new Set();
  const woodNeed = woodNeededForWarmth(s, people.length);
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
        hurt(p, 12);
        p.morale = clamp(p.morale - 6);
      }
      urgent.push(`There was not enough firewood. ${freezing.length} ${freezing.length === 1 ? 'person' : 'people'} suffered from the cold.`);
    }
  }
  const capacity = shelterCapacity(state);
  if (people.length > capacity && (s === 2 || s === 3)) {
    const exposed = shuffle(state, people).slice(0, people.length - capacity);
    for (const p of exposed) {
      cold.add(p.id);
      hurt(p, s === 3 ? 30 : 10);
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
    if (p.morale < 55) p.morale = clamp(p.morale + 3);
    else if (p.morale > 55) p.morale = clamp(p.morale - 3);
  }

  // 8. Spoilage.
  const spoiled = Math.floor(state.resources.food * spoilageRate(state));
  if (spoiled > 0) {
    state.resources.food -= spoiled;
    events.push(`${spoiled} food spoiled in storage.`);
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

  // 10. Advance the calendar.
  state.turn += 1;
  const survivors = living(state);
  refreshAdvisors(state);

  if (survivors.length === 0) {
    state.gameOver = true;
    urgent.unshift(`The last of your people are gone. The fire at ${state.campName} has gone out.`);
  } else {
    // Plenty of food lifts spirits.
    if (state.resources.food >= foodNeeded(survivors.length) * 2) {
      for (const p of survivors) p.morale = clamp(p.morale + 3);
    }
    maybeStartRaid(state, scouts.length > 0, urgent);
    const fromOrders = applyStandingOrders(state);
    urgent.push(...fromOrders.urgent);
    ordersDone.push(...fromOrders.orders);
    if (!state.milestoneReached && survivors.length >= MILESTONE_POPULATION
        && state.buildings.storehouse > 0 && state.buildings.palisade > 0) {
      state.milestoneReached = true;
      urgent.push(`${state.campName} has grown into a true settlement of ${survivors.length} people, safe behind its palisade. The Settlement era will arrive in a future update. You can keep playing.`);
    }
  }
  if (survivors.length !== startCount && survivors.length > 0) {
    events.push(`${state.campName} now has ${survivors.length} people.`);
  }

  state.report = { title: dateLabel(state), finished: finishedLabel, urgent, events, orders: ordersDone };
  for (const line of [...urgent, ...events, ...ordersDone]) {
    state.log.push({ turn: state.turn - 1, date: finishedLabel, text: line });
  }
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

function maybeStartRaid(state, scoutsOut, urgent) {
  if (state.turn < 2) return;
  const y = year(state);
  let p = 0.1 + 0.02 * y;
  if (state.resources.food > 80) p += 0.05;
  if (!chance(state, Math.min(0.35, p))) return;
  const raiders = randomInt(state, 4, 7) + 2 * (y - 1);
  const warned = state.buildings.watchtower > 0 || isKnown(state, 'raiderTrail')
    || (scoutsOut && chance(state, 0.6));
  state.pendingEvent = { type: 'raid', raiders, warned };
  urgent.unshift(warned
    ? `Raiders are coming! Scouts spotted about ${raiders} armed strangers heading for the camp. Decide how to respond before anything else.`
    : `Raiders are at the edge of camp! About ${raiders} armed strangers caught you by surprise. Decide how to respond before anything else.`);
}
