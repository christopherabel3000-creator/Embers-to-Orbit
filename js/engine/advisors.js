// Advisors: who holds each role, and the recommendations they make.
// Advisors never act on their own; they only warn and suggest.

import { BUILDINGS, SEASONS } from './data.js';
import {
  living, personById, seasonIndex, foodNeeded, woodNeededForWarmth,
  spoilageRate, shelterCapacity, isBadlyHurt,
} from './state.js';
import {
  expectedFood, expectedWood, defenseStrength, raidAttackStrength,
} from './rules.js';

export const ADVISOR_ROLES = {
  steward: { title: 'Steward', skill: 'foraging', domain: 'food and stores' },
  warChief: { title: 'War chief', skill: 'hunting', domain: 'defense' },
  healer: { title: 'Healer', skill: 'healing', domain: 'health and shelter' },
};

// Replace any advisor who has died with the most skilled living person.
export function refreshAdvisors(state) {
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    const current = personById(state, state.advisors[role]);
    if (current && current.alive) continue;
    const candidates = living(state)
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
  for (let i = 0; i < 4; i++) {
    const s = (seasonIndex(state) + i) % 4;
    for (const p of people) stock += expectedFood(state, p, p.task, s);
    stock -= foodNeeded(people.length);
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
    add('steward', 'urgent', `We will run out of food this season. We eat ${foodNeeded(people.length)} food a season and have ${state.resources.food}. Put more people on hunting${s === 3 ? '' : ' and foraging'}.`);
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
  if (count('build') > 0 && !state.project) {
    add('steward', 'warning', `${count('build')} ${count('build') === 1 ? 'person is' : 'people are'} set to build, but no building project is chosen. Choose one on the Build screen.`);
  } else if (state.project && count('build') === 0) {
    add('steward', 'note', `No one is working on the ${BUILDINGS[state.project.id].name.toLowerCase()}.`);
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
  if (people.length > capacity) {
    const exposed = people.length - capacity;
    const severity = s === 2 || s === 3 ? 'urgent' : s === 1 ? 'warning' : 'note';
    add('healer', severity, `Our shelter holds ${capacity} people and we are ${people.length}. ${exposed} will sleep in the open, which is deadly in autumn and winter. Each lean-to shelters 4 more.`);
  }

  // War chief: raids.
  if (state.pendingEvent && state.pendingEvent.type === 'raid') {
    const ev = state.pendingEvent;
    const fighters = people.filter((p) => p.health >= 40);
    const odds = raidOdds(state, fighters, ev.warned, ev.raiders);
    add('warChief', 'urgent', `If everyone able stands and fights, we are ${odds.word}. Hiding the food costs us stores but nobody gets hurt.`);
  } else if (state.turn >= 1) {
    if (state.buildings.palisade === 0 && state.turn >= 4) {
      add('warChief', 'note', 'Raiders grow bolder each year. A palisade would make us far harder to attack.');
    }
    if (count('scout') === 0 && state.buildings.watchtower === 0 && !state.discoveries.includes('raiderTracks')) {
      add('warChief', 'note', 'No one is scouting, so raiders could catch us by surprise. Surprised defenders fight poorly.');
    }
  }

  const order = { urgent: 0, warning: 1, note: 2 };
  advice.sort((a, b) => order[a.severity] - order[b.severity]);
  return advice;
}
