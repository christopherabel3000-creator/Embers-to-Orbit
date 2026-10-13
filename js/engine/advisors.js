// Advisors: who holds each role, and the recommendations they make.
// Advisors never act on their own; they only warn and suggest.

import { BUILDINGS, SEASONS, PLACES, KNOWLEDGE, KNOWLEDGE_ORDER } from './data.js';
import {
  living, personById, seasonIndex, foodNeeded, woodNeededForWarmth,
  spoilageRate, shelterCapacity, isBadlyHurt, isKnown, placeName, shelterNeeded, canFight,
  unexploredNeighbors, knownPlaces, abundanceWord, wolvesAt, hasKnowledge,
  knowledgeBlocker, fieldPlots, metNeighbors,
} from './state.js';
import {
  expectedFood, expectedWood, defenseStrength, raidAttackStrength, siteFor,
  expectedHarvest, farmerCapacity, PLANT_PER_FARMER, TEND_PER_FARMER, HARVEST_PER_FARMER,
} from './rules.js';
import { birthOutlook, parents } from './population.js';
import { skarnAtPeace } from './neighbors.js';

export const ADVISOR_ROLES = {
  steward: { title: 'Steward', skill: 'foraging', domain: 'food and stores' },
  warChief: { title: 'War chief', skill: 'hunting', domain: 'defense' },
  healer: { title: 'Healer', skill: 'healing', domain: 'health and shelter' },
  scholar: { title: 'Scholar', skill: 'learning', domain: 'study and discovery' },
  speaker: { title: 'Speaker', skill: 'learning', domain: 'neighbors and diplomacy' },
};

// Replace any advisor who has died with the most skilled living person.
export function refreshAdvisors(state) {
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    const current = personById(state, state.advisors[role]);
    if (current && current.alive) continue;
    const candidates = living(state)
      .filter((p) => p.age >= 16)
      .filter((p) => !Object.values(state.advisors).includes(p.id) || p.id === state.advisors[role])
      .sort((a, b) => b.skills[info.skill] - a.skills[info.skill]);
    const successor = candidates[0] || living(state)[0];
    state.advisors[role] = successor ? successor.id : null;
  }
}

export function advisorPerson(state, role) {
  const p = personById(state, state.advisors[role]);
  return p && p.alive ? p : null;
}

// Projects food stores season by season with current assignments.
// Returns the number of seasons until food runs out (0 = this season),
// or null if it lasts through the next four seasons.
export function forecastFood(state) {
  const people = living(state);
  let stock = state.resources.food;
  const harvest = expectedHarvest(state);
  for (let i = 0; i < 4; i++) {
    const s = (seasonIndex(state) + i) % 4;
    for (const p of people) stock += expectedFood(state, p, p.task, s);
    if (s === 2 && i < 3) stock += harvest; // This year's harvest only.
    stock -= foodNeeded(people);
    if (stock < 0) return { emptyIn: i, season: SEASONS[s] };
    stock -= stock * spoilageRate(state);
  }
  return { emptyIn: null, endStock: Math.round(stock) };
}

export function raidOdds(state, defenders, warned, raiders) {
  const ratio = defenseStrength(state, defenders, warned) / raidAttackStrength(raiders);
  if (ratio >= 1.3) return { word: 'likely to win', ratio };
  if (ratio >= 0.95) return { word: 'an even fight', ratio };
  return { word: 'likely to lose', ratio };
}

function seasonsUntilWinter(state) {
  return (3 - seasonIndex(state) + 4) % 4;
}

export function getAdvice(state) {
  const advice = [];
  const add = (role, severity, text) => {
    const person = advisorPerson(state, role);
    if (!person) return;
    advice.push({ role, title: ADVISOR_ROLES[role].title, name: person.name, severity, text });
  };
  const people = living(state);
  if (people.length === 0) return advice;
  const s = seasonIndex(state);
  const count = (task) => people.filter((p) => p.task === task).length;

  // Steward: food, wood, and work.
  const forecast = forecastFood(state);
  if (forecast.emptyIn === 0) {
    add('steward', 'urgent', `We will run out of food this season. We eat ${foodNeeded(people)} food a season and have ${state.resources.food}. Put more people on hunting${s === 3 ? '' : ' and foraging'}.`);
  } else if (forecast.emptyIn !== null) {
    add('steward', 'warning', `At this pace, our food runs out in ${forecast.emptyIn} ${forecast.emptyIn === 1 ? 'season' : 'seasons'}, during ${forecast.season}. ${s === 2 || s === 3 || forecast.season === 'Winter' ? 'Winter hunting is poor and nothing grows, so we must store food before it comes.' : 'We should gather more while the land is generous.'}`);
  } else {
    add('steward', 'note', `Food should last through the coming year at this pace. We expect about ${forecast.endStock} food in store a year from now.`);
  }
  if (s === 3 && count('forage') > 0) {
    add('steward', 'warning', `${count('forage')} ${count('forage') === 1 ? 'person is' : 'people are'} set to forage, but nothing grows in winter. They would be more useful hunting or gathering wood.`);
  }
  const untilWinter = seasonsUntilWinter(state);
  if (untilWinter <= 2) {
    let woodNeed = 0;
    for (let i = 0; i <= untilWinter; i++) woodNeed += woodNeededForWarmth((s + i) % 4, people.length);
    let woodComing = 0;
    for (const p of people) woodComing += expectedWood(state, p, p.task, s) * (untilWinter + 1);
    if (state.resources.wood + woodComing < woodNeed) {
      add('steward', untilWinter === 0 ? 'urgent' : 'warning', `We need about ${woodNeed} wood to keep the fires burning ${untilWinter === 0 ? 'this winter' : 'through winter'}, and we have ${state.resources.wood}. Put more people on gathering wood.`);
    }
  }
  const next = state.buildQueue[0];
  if (count('build') > 0 && !next) {
    add('steward', 'warning', `${count('build')} ${count('build') === 1 ? 'person is' : 'people are'} set to build, but the build queue is empty. Add something on the Build screen.`);
  } else if (next && count('build') === 0) {
    add('steward', 'note', `${state.buildQueue.length === 1 ? `The ${BUILDINGS[next.id].name.toLowerCase()} is` : `${state.buildQueue.length} buildings are`} waiting in the build queue, but no one is set to build.`);
  } else if (next && !next.paid && state.resources.wood < BUILDINGS[next.id].cost) {
    add('steward', 'warning', `Next in the build queue is the ${BUILDINGS[next.id].name.toLowerCase()}, which needs ${BUILDINGS[next.id].cost} wood to start. We have ${state.resources.wood}.`);
  }

  // Steward: worn-out hunting and foraging grounds.
  for (const task of ['hunt', 'forage']) {
    if (count(task) === 0 || (task === 'forage' && s === 3)) continue;
    const site = siteFor(state, task);
    const level = state.places[site].abundance[task];
    if (level >= 40) continue;
    const better = knownPlaces(state).filter((id) => id !== site && PLACES[id].tasks.includes(task)
      && state.places[id].abundance[task] >= 70);
    const what = task === 'hunt' ? 'Game' : 'Wild food';
    add('steward', 'warning', `${what} is ${abundanceWord(level)} at ${placeName(state, site)}.${better.length ? ` ${better.map((id) => placeName(state, id)).join(' or ')} ${better.length === 1 ? 'is' : 'are'} still plentiful; you can move the work site on the Map screen.` : ' Letting it rest will help it recover.'}`);
  }
  if (count('scout') > 0 && unexploredNeighbors(state, siteFor(state, 'scout')).length === 0) {
    const fresh = knownPlaces(state).filter((id) => unexploredNeighbors(state, id).length > 0);
    if (fresh.length) {
      add('steward', 'note', `Every path from ${placeName(state, siteFor(state, 'scout'))} is explored. Scouts could explore beyond ${fresh.map((id) => placeName(state, id)).join(' or ')} instead.`);
    }
  }

  // Steward: the fields.
  if (hasKnowledge(state, 'farming')) {
    const farmers = count('farm');
    const plots = fieldPlots(state);
    if (farmers && plots === 0) {
      add('steward', 'warning', `${farmers} ${farmers === 1 ? 'person is' : 'people are'} set to farm, but we have no fields. Build a field on the Build screen.`);
    } else if (plots > 0) {
      const planted = state.farm.planted;
      if (s === 0) {
        const room = plots - planted;
        const can = Math.floor(farmerCapacity(people, PLANT_PER_FARMER));
        if (room > can) add('steward', farmers ? 'note' : 'warning', `It is planting season. Our fields have room for ${room} more ${room === 1 ? 'plot' : 'plots'}, and our farmers can plant ${can}. Each farmer plants 2 plots.`);
      } else if (s === 1 && planted) {
        const can = farmerCapacity(people, TEND_PER_FARMER);
        if (can < planted) add('steward', 'warning', `${planted} plots need tending this summer, and our farmers can tend about ${Math.floor(can)}. Each farmer tends 3. Untended grain yields less.`);
      } else if (s === 2 && planted) {
        const can = farmerCapacity(people, HARVEST_PER_FARMER);
        if (can < planted) add('steward', 'warning', `${planted} plots are ready to harvest, and our farmers can bring in about ${Math.floor(can)}. Each farmer harvests 3. Grain left in the fields rots.`);
      } else if (s === 3 && farmers) {
        add('steward', 'warning', `${farmers} ${farmers === 1 ? 'person is' : 'people are'} set to farm, but there is no farm work in winter.`);
      }
    }
  }

  // Scholar: study.
  const studying = count('study');
  const k = state.knowledge;
  if (studying && !k.current) {
    add('scholar', 'warning', `${studying} ${studying === 1 ? 'person is' : 'people are'} studying, but no discovery is chosen. Choose one on the Knowledge screen.`);
  } else if (k.current && !studying) {
    add('scholar', 'note', `No one is studying ${KNOWLEDGE[k.current].name.toLowerCase()}. Set someone to study on the People screen.`);
  } else if (!k.current && !studying && state.turn >= 1) {
    const open = KNOWLEDGE_ORDER.filter((id) => !knowledgeBlocker(state, id));
    if (open.length) add('scholar', 'note', `We could study ${open.map((id) => KNOWLEDGE[id].name.toLowerCase()).join(', ')}. Choose one on the Knowledge screen and set someone to study.`);
  }
  if (!hasKnowledge(state, 'farming') && k.current !== 'farming' && !knowledgeBlocker(state, 'farming')) {
    add('scholar', 'note', 'The wild grain in the North meadow could be planted. We are ready to study farming.');
  }

  // Healer: fever.
  const sick = people.filter((p) => p.sick);
  if (sick.length) {
    const tending = count('heal');
    add('healer', tending ? 'warning' : 'urgent', `${sick.map((p) => p.name).join(', ')} ${sick.length === 1 ? 'has' : 'have'} the fever. The sick work at half strength and can spread it.${tending ? '' : ' No one is tending them; assign someone to tend the hurt.'}`);
  }

  // Hunters working where wolves roam.
  const huntSite = siteFor(state, 'hunt');
  if (count('hunt') > 0 && wolvesAt(state, huntSite)) {
    add('warChief', 'warning', `Wolves roam ${placeName(state, huntSite)}, where our hunters work. Hunting there is dangerous and poor. Move the hunters on the Map screen.`);
  }

  // Healer: injuries and shelter.
  const badlyHurt = people.filter(isBadlyHurt);
  if (badlyHurt.length) {
    const resting = badlyHurt.filter((p) => p.task === 'rest');
    const working = badlyHurt.filter((p) => p.task !== 'rest');
    const healers = count('heal');
    let text = `${badlyHurt.map((p) => p.name).join(', ')} ${badlyHurt.length === 1 ? 'is' : 'are'} badly hurt.`;
    if (working.length) text += ` ${working.map((p) => p.name).join(', ')} should rest; hurt people work at half strength.`;
    if (healers === 0) text += ' No one is tending the hurt. Assign someone to heal.';
    add('healer', healers === 0 || resting.length < badlyHurt.length ? 'warning' : 'note', text);
  }
  const capacity = shelterCapacity(state);
  const needed = shelterNeeded(people);
  if (needed > capacity) {
    const exposed = Math.ceil(needed - capacity);
    const severity = s === 2 || s === 3 ? 'urgent' : s === 1 ? 'warning' : 'note';
    add('healer', severity, `Our shelter holds ${capacity} people and we need room for ${Math.ceil(needed)}${people.some((p) => p.age < 12) ? ', counting each young child as half' : ''}. ${exposed} will sleep in the open, which is deadly in autumn and winter. Each lean-to shelters 4 more.`);
  }

  // Steward: what is holding families back.
  if (state.turn >= 4 && parents(state).length >= 2) {
    const outlook = birthOutlook(state);
    if (outlook.reasons.length) {
      add('steward', 'note', `Few children will be born while ${outlook.reasons.join(' and ')}.`);
    }
  }

  // Speaker: neighbors.
  const met = metNeighbors(state);
  const sk = state.neighbors.skarn;
  if (!met.length && state.turn >= 4) {
    add('speaker', 'note', 'We have met no other peoples yet. Scouts exploring far from camp may find them.');
  }
  if (state.raidThreat) {
    add('warChief', 'urgent', 'The Skarn have promised to come for what we refused them. Expect raiders soon.');
  }
  if (sk.known && !skarnAtPeace(state) && sk.relation < -40) {
    add('speaker', 'warning', 'The Skarn are hostile, and raids will come often. Gifts, tribute, or a strong palisade would help.');
  }
  if (sk.known && !sk.peace && sk.truceUntil > state.turn && sk.truceUntil - state.turn <= 1) {
    add('speaker', 'note', 'Our truce with the Skarn ends after this season.');
  }
  if (sk.known && !sk.peace && sk.relation >= 10) {
    add('speaker', 'note', 'The Skarn respect us enough now that they might accept a lasting peace.');
  }
  const velari = state.neighbors.velari;
  if (velari.known && velari.relation >= 40 && !hasKnowledge(state, 'farming')) {
    add('speaker', 'note', 'The Velari would teach us farming now. Ask them on the Neighbors screen.');
  }

  // War chief: raids.
  if (state.pendingEvent && state.pendingEvent.type === 'raid') {
    const ev = state.pendingEvent;
    const fighters = people.filter(canFight);
    const odds = raidOdds(state, fighters, ev.warned, ev.raiders);
    add('warChief', 'urgent', `If everyone able stands and fights, we are ${odds.word}. Hiding the food costs us stores but nobody gets hurt.`);
  } else if (state.turn >= 1) {
    if (state.buildings.palisade === 0 && state.turn >= 4) {
      add('warChief', 'note', 'Raiders grow bolder each year. A palisade would make us far harder to attack.');
    }
    if (count('scout') === 0 && state.buildings.watchtower === 0 && !isKnown(state, 'raiderTrail')) {
      add('warChief', 'note', 'No one is scouting, so raiders could catch us by surprise. Surprised defenders fight poorly.');
    }
  }

  const order = { urgent: 0, warning: 1, note: 2 };
  advice.sort((a, b) => order[a.severity] - order[b.severity]);
  return advice;
}
