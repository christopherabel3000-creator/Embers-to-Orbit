// Events: things that happen to the camp. Instant events simply happen and
// are reported. Choice events stop the game and ask the player what to do.
// Ongoing conditions (fever, wolves) are handled here too.

import { WANDERERS, PLACES } from './data.js';
import {
  living, seasonIndex, shelterCapacity, placeName, knownPlaces, makePerson,
  personById, wolvesAt,
} from './state.js';
import { siteFor } from './rules.js';
import { refreshAdvisors, advisorPerson, ADVISOR_ROLES } from './advisors.js';
import { chance, pick, randomInt } from './rng.js';
import { shuffle, listNames, clamp } from './util.js';

const EVENT_CHANCE = 0.4;
const COOLDOWN = 6; // Seasons before the same event can happen again.
const WOLF_SEASONS = 4;

// ---------- conditions ----------

export function sickPeople(state) {
  return living(state).filter((p) => p.sick);
}

// Runs each season, after work and before healing. healersAtWork is the
// number of people tending the hurt. Returns report lines.
export function progressConditions(state, healersAtWork) {
  const lines = { urgent: [], events: [] };
  const people = living(state);

  // Fever: the sick weaken, may recover, and may spread it.
  const sick = people.filter((p) => p.sick);
  if (sick.length) {
    const recovered = [];
    for (const p of sick) {
      p.health = clamp(p.health - 10);
      let recover = 0.3;
      if (healersAtWork > 0) recover += 0.3;
      if (state.buildings.healersHut > 0) recover += 0.1;
      if (chance(state, recover)) {
        p.sick = false;
        recovered.push(p);
      }
    }
    const stillSick = people.filter((p) => p.sick).length;
    const crowded = people.length > shelterCapacity(state) ? 0.1 : 0;
    const hut = state.buildings.healersHut > 0 ? 0.03 : 0;
    const spread = Math.max(0, Math.min(0.4, 0.05 * stillSick + crowded - hut));
    const caught = [];
    for (const p of people.filter((x) => !x.sick)) {
      if (stillSick > 0 && chance(state, spread)) {
        p.sick = true;
        p.health = clamp(p.health - 15);
        caught.push(p);
      }
    }
    if (caught.length) lines.urgent.push(`The fever spread to ${listNames(caught)}.`);
    if (recovered.length) lines.events.push(`${listNames(recovered)} recovered from the fever.`);
    if (!people.some((p) => p.sick)) lines.events.push('The fever has passed.');
  }

  // Wolves move on after a while.
  for (const c of state.conditions) {
    if (c.id === 'wolves') c.seasonsLeft -= 1;
  }
  for (const c of state.conditions.filter((x) => x.id === 'wolves' && x.seasonsLeft <= 0)) {
    lines.events.push(`The wolves have left ${placeName(state, c.place)}.`);
  }
  state.conditions = state.conditions.filter((c) => !(c.id === 'wolves' && c.seasonsLeft <= 0));
  return lines;
}

// ---------- event definitions ----------

function avgHunting(people) {
  if (!people.length) return 0;
  return people.reduce((sum, p) => sum + p.skills.hunting, 0) / people.length;
}

function bestHunters(state, n) {
  return living(state).filter((p) => p.health >= 40 && !p.sick)
    .sort((a, b) => b.skills.hunting - a.skills.hunting).slice(0, n);
}

function wolfHuntChance(state) {
  return Math.min(0.9, 0.3 + avgHunting(bestHunters(state, 3)) * 0.12);
}

function oddsWord(p) {
  if (p >= 0.7) return 'good';
  if (p >= 0.45) return 'about even';
  return 'poor';
}

const QUARREL_REASONS = [
  'who does the most work', 'a share of the food', 'a grudge from before the camp',
  'a broken axe', 'where to sleep',
];

const TASK_GOING = { hunt: 'hunting', forage: 'foraging', scout: 'scouting' };

export const EVENTS = {
  // ----- Instant events -----
  storm: {
    weight: (state) => (seasonIndex(state) === 1 ? 0.5 : 1),
    apply(state) {
      if (state.buildings.leanTo > 0 && chance(state, 0.5)) {
        state.buildings.leanTo -= 1;
        return { urgent: ['A storm tore one of the lean-tos apart. You will need to build another.'] };
      }
      const lost = Math.floor(state.resources.wood * 0.25);
      state.resources.wood -= lost;
      return { urgent: [`A storm soaked the woodpile, and ${lost} wood rotted.`] };
    },
  },
  bumperCrop: {
    weight: (state) => ([1, 2].includes(seasonIndex(state)) && living(state).some((p) => p.task === 'forage') ? 1 : 0),
    apply(state) {
      const extra = randomInt(state, 10, 20);
      state.resources.food += extra;
      for (const p of living(state)) p.morale = clamp(p.morale + 3);
      return { events: [`Foragers at ${placeName(state, siteFor(state, 'forage'))} found a bumper crop and brought back ${extra} extra food.`] };
    },
  },
  feverOutbreak: {
    weight: (state) => (sickPeople(state).length ? 0 : (seasonIndex(state) === 3 ? 1.2 : 0.7)),
    apply(state) {
      const victim = pick(state, living(state));
      victim.sick = true;
      victim.health = clamp(victim.health - 15);
      return { urgent: [`${victim.name} has come down with a fever. It may spread through the camp. Tending the sick helps them recover.`] };
    },
  },
  pests: {
    weight: (state) => (state.buildings.storehouse === 0 && state.resources.food > 30 ? 0.8 : 0),
    apply(state) {
      const lost = Math.floor(state.resources.food * 0.2);
      state.resources.food -= lost;
      return { urgent: [`Mice got into the food stores and ruined ${lost} food. A storehouse would keep them out.`] };
    },
  },
  coldSnap: {
    weight: (state) => (seasonIndex(state) === 3 ? 1 : 0),
    apply(state) {
      const people = living(state);
      const need = Math.ceil(people.length / 2);
      if (state.resources.wood >= need) {
        state.resources.wood -= need;
        return { events: [`A bitter cold snap set in. The fires burned an extra ${need} wood.`] };
      }
      state.resources.wood = 0;
      const cold = shuffle(state, people).slice(0, Math.max(1, Math.ceil(people.length / 3)));
      for (const p of cold) {
        p.health = clamp(p.health - 8);
        p.morale = clamp(p.morale - 5);
      }
      return { urgent: [`A bitter cold snap set in, and the firewood ran out. ${listNames(cold)} suffered from the cold.`] };
    },
  },
  fireside: {
    weight: () => 0.6,
    apply(state) {
      const teller = [...living(state)].sort((a, b) => b.morale - a.morale)[0];
      for (const p of living(state)) p.morale = clamp(p.morale + 6);
      return { events: [`Around the fire one night, ${teller.name} told stories of the old days, and everyone's spirits lifted.`] };
    },
  },

  // ----- Choice events -----
  sickTraveler: {
    choice: true,
    weight: (state) => (state.wanderersMet < WANDERERS.length ? 0.8 : 0),
    start(state) {
      return { traveler: state.wanderersMet };
    },
    view(state, ev) {
      const t = WANDERERS[ev.traveler];
      return {
        title: 'A sick traveler',
        text: `A stranger named ${t.name} stumbles into camp, burning with fever. ${t.note} ${t.name} begs to stay.`,
        options: [
          { id: 'take', label: `Take ${t.name} in and nurse them. They join the camp, but the fever may spread.` },
          { id: 'feed', label: 'Give them some food and send them on their way. Costs 6 food.' },
          { id: 'refuse', label: 'Turn them away. Some of your people will think less of you.' },
        ],
        advice: [
          ['healer', `Fever spreads fastest in a crowded camp.${state.buildings.healersHut ? ' Our healer\'s hut will help.' : ''} If we take ${t.name} in, someone should tend the sick.`],
        ],
      };
    },
    resolve(state, ev, choice) {
      const t = WANDERERS[ev.traveler];
      state.wanderersMet += 1;
      const everyone = living(state);
      if (choice === 'take') {
        const p = makePerson(t, state.nextPersonId++, 'rest');
        p.health = 45;
        p.morale = 55;
        p.sick = true;
        state.people.push(p);
        for (const x of everyone) x.morale = clamp(x.morale + 2);
        return [`${t.name} joined the camp, still burning with fever, and is resting.`];
      }
      if (choice === 'feed') {
        state.resources.food = Math.max(0, state.resources.food - 6);
        for (const x of everyone) x.morale = clamp(x.morale + 3);
        return [`You gave ${t.name} food for the road. Your people were glad to help.`];
      }
      for (const x of everyone) x.morale = clamp(x.morale - 5);
      return [`You turned ${t.name} away. The camp was quiet that night.`];
    },
  },

  wolves: {
    choice: true,
    weight: (state) => (wolfPlaces(state).length ? 0.8 : 0),
    start(state) {
      const places = wolfPlaces(state);
      const huntSite = siteFor(state, 'hunt');
      return { place: places.includes(huntSite) ? huntSite : pick(state, places) };
    },
    view(state, ev) {
      const name = placeName(state, ev.place);
      const p = wolfHuntChance(state);
      const hunters = bestHunters(state, 3);
      return {
        title: 'Wolves',
        text: `A pack of wolves has moved into ${name}. Hunters have seen five or six of them, and they are bold.`,
        options: [
          { id: 'hunt', label: `Send ${hunters.length ? listNames(hunters) : 'your hunters'} to drive them off. Someone may get hurt, but wolf pelts and meat are valuable.` },
          { id: 'avoid', label: `Leave them be. Hunting at ${name} will be dangerous and poor for about a year.` },
        ],
        advice: [
          ['warChief', `With ${hunters.length ? listNames(hunters) : 'no one fit to fight'}, our chances of driving them off are ${oddsWord(p)}.`],
        ],
      };
    },
    resolve(state, ev, choice) {
      const name = placeName(state, ev.place);
      if (choice === 'hunt') {
        const hunters = bestHunters(state, 3);
        const won = hunters.length > 0 && chance(state, wolfHuntChance(state));
        const hurtOnes = hunters.filter(() => chance(state, won ? 0.2 : 0.5));
        for (const h of hurtOnes) h.health = clamp(h.health - randomInt(state, 20, 35));
        const lines = [];
        if (won) {
          state.resources.food += 8;
          for (const x of living(state)) x.morale = clamp(x.morale + 5);
          lines.push(`${listNames(hunters)} drove the wolves from ${name} and brought back 8 food and fine pelts.`);
        } else {
          state.conditions.push({ id: 'wolves', place: ev.place, seasonsLeft: WOLF_SEASONS });
          lines.push(`The wolves fought back and held ${name}. Hunting there will be dangerous for about a year.`);
        }
        if (hurtOnes.length) lines.push(`${listNames(hurtOnes)} ${hurtOnes.length === 1 ? 'was' : 'were'} bitten in the fight.`);
        return lines;
      }
      state.conditions.push({ id: 'wolves', place: ev.place, seasonsLeft: WOLF_SEASONS });
      return [`You left the wolves alone. Hunting at ${name} will be dangerous and poor for about a year.`];
    },
  },

  quarrel: {
    choice: true,
    weight: (state) => (living(state).length >= 4 ? 0.9 : 0),
    start(state) {
      const [a, b] = shuffle(state, living(state));
      return { a: a.id, b: b.id, reason: pick(state, QUARREL_REASONS) };
    },
    view(state, ev) {
      const a = personById(state, ev.a);
      const b = personById(state, ev.b);
      return {
        title: 'A quarrel',
        text: `${a.name} and ${b.name} have been quarreling for days over ${ev.reason}. The whole camp is on edge.`,
        options: [
          { id: 'a', label: `Side with ${a.name}. ${b.name} will be bitter.` },
          { id: 'b', label: `Side with ${b.name}. ${a.name} will be bitter.` },
          { id: 'mediate', label: 'Make them work it out together. It might heal the rift, or make it worse.' },
        ],
        advice: [['steward', 'A camp this small cannot afford a lasting feud. Whatever you choose, choose it soon.']],
      };
    },
    resolve(state, ev, choice) {
      const a = personById(state, ev.a);
      const b = personById(state, ev.b);
      if (!a.alive || !b.alive) return ['The quarrel ended on its own.'];
      if (choice === 'a' || choice === 'b') {
        const [win, lose] = choice === 'a' ? [a, b] : [b, a];
        win.morale = clamp(win.morale + 8);
        lose.morale = clamp(lose.morale - 20);
        for (const x of living(state)) x.morale = clamp(x.morale - 2);
        return [`You sided with ${win.name}. ${lose.name} has gone sullen and quiet.`];
      }
      if (chance(state, 0.55)) {
        a.morale = clamp(a.morale + 10);
        b.morale = clamp(b.morale + 10);
        for (const x of living(state)) x.morale = clamp(x.morale + 3);
        return [`${a.name} and ${b.name} talked it through and shook hands. The camp breathed easier.`];
      }
      a.morale = clamp(a.morale - 10);
      b.morale = clamp(b.morale - 10);
      for (const x of living(state)) x.morale = clamp(x.morale - 4);
      return [`Forced together, ${a.name} and ${b.name} only grew angrier. The mood in camp soured.`];
    },
  },

  lostWorker: {
    choice: true,
    weight: (state) => (living(state).some((p) => p.task in TASK_GOING) ? 0.7 : 0),
    start(state) {
      const p = pick(state, living(state).filter((x) => x.task in TASK_GOING));
      return { person: p.id, task: p.task };
    },
    view(state, ev) {
      const p = personById(state, ev.person);
      const tracker = [...living(state)].filter((x) => x.id !== p.id).sort((x, y) => y.skills.scouting - x.skills.scouting)[0];
      return {
        title: 'Missing',
        text: `${p.name} went out ${TASK_GOING[ev.task]} and has not come back. It has been two days.`,
        options: [
          { id: 'search', label: `Send a search party${tracker ? ` led by ${tracker.name}` : ''}. The lost work costs about 10 food, but the odds of finding ${p.name} are good.` },
          { id: 'wait', label: `Wait and hope ${p.name} finds the way home.` },
        ],
        advice: [['steward', `Every day ${p.name} is out there, the odds get worse.`]],
      };
    },
    resolve(state, ev, choice) {
      const p = personById(state, ev.person);
      if (!p.alive) return [`${p.name} is gone.`];
      let found;
      if (choice === 'search') {
        state.resources.food = Math.max(0, state.resources.food - 10);
        const tracking = Math.max(0, ...living(state).filter((x) => x.id !== p.id).map((x) => x.skills.scouting));
        found = chance(state, Math.min(0.95, 0.75 + tracking * 0.04));
        if (found) {
          p.health = clamp(p.health - 15);
          return [`The search party found ${p.name} with a twisted ankle, cold and hungry but alive.`];
        }
      } else if (chance(state, 0.4)) {
        p.health = clamp(p.health - 25);
        return [`${p.name} limped back into camp days later, weak but alive.`];
      }
      p.alive = false;
      for (const x of living(state)) x.morale = clamp(x.morale - 10);
      refreshAdvisors(state);
      if (living(state).length === 0) state.gameOver = true;
      return [`${p.name} never came back. The camp mourns.`];
    },
  },

  traders: {
    choice: true,
    weight: (state) => (state.turn >= 3 ? 0.7 : 0),
    start: () => ({}),
    view(state) {
      const options = [];
      if (state.resources.wood >= 20) options.push({ id: 'woodForFood', label: 'Trade 20 wood for 15 food.' });
      if (state.resources.food >= 15) options.push({ id: 'foodForWood', label: 'Trade 15 food for 20 wood.' });
      options.push({ id: 'decline', label: 'Send them on their way.' });
      return {
        title: 'Traders',
        text: 'A small boat of traders from downriver pulls up at the riverbank. They speak a strange tongue, but they understand trade.',
        options,
        advice: [['steward', `We have ${state.resources.food} food and ${state.resources.wood} wood.`]],
      };
    },
    resolve(state, ev, choice) {
      const r = state.resources;
      if (choice === 'woodForFood' && r.wood >= 20) {
        r.wood -= 20;
        r.food += 15;
        return ['You traded 20 wood for 15 food. The traders promised to return someday.'];
      }
      if (choice === 'foodForWood' && r.food >= 15) {
        r.food -= 15;
        r.wood += 20;
        return ['You traded 15 food for 20 wood. The traders promised to return someday.'];
      }
      return ['The traders shrugged and rowed on downriver.'];
    },
  },

  beehive: {
    choice: true,
    weight: (state) => ([1, 2].includes(seasonIndex(state)) && living(state).some((p) => p.task === 'forage') ? 0.6 : 0),
    start(state) {
      const p = pick(state, living(state).filter((x) => x.task === 'forage'));
      return { person: p.id };
    },
    view(state, ev) {
      const p = personById(state, ev.person);
      return {
        title: 'A wild beehive',
        text: `${p.name} found a wild beehive in a hollow tree, heavy with honey.`,
        options: [
          { id: 'take', label: `Take the honey. Someone will get stung, but it is about 12 food and a rare treat.` },
          { id: 'leave', label: 'Leave the bees alone.' },
        ],
        advice: [],
      };
    },
    resolve(state, ev, choice) {
      const p = personById(state, ev.person);
      if (choice !== 'take' || !p.alive) return ['You left the bees in peace.'];
      state.resources.food += 12;
      p.health = clamp(p.health - 10);
      for (const x of living(state)) x.morale = clamp(x.morale + 4);
      return [`${p.name} came back badly stung but carrying 12 food worth of honey. Everyone had a taste.`];
    },
  },
};

function wolfPlaces(state) {
  return knownPlaces(state).filter((id) => id !== 'camp' && PLACES[id].tasks.includes('hunt') && !wolvesAt(state, id));
}

// ---------- running events ----------

// Called at the start of each new season. Returns report lines.
export function maybeStartEvent(state) {
  const out = { urgent: [], events: [] };
  if (state.pendingEvent || state.gameOver || state.turn < 1) return out;
  if (!chance(state, EVENT_CHANCE)) return out;
  const history = state.eventHistory || (state.eventHistory = {});
  const options = Object.entries(EVENTS)
    .filter(([id]) => history[id] === undefined || state.turn - history[id] >= COOLDOWN)
    .map(([id, ev]) => [id, ev.weight(state)])
    .filter(([, w]) => w > 0);
  if (!options.length) return out;
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = randomInt(state, 0, 9999) / 10000 * total;
  let chosen = options[options.length - 1][0];
  for (const [id, w] of options) {
    if (roll < w) { chosen = id; break; }
    roll -= w;
  }
  history[chosen] = state.turn;
  const ev = EVENTS[chosen];
  if (ev.choice) {
    state.pendingEvent = { type: 'story', id: chosen, ...ev.start(state) };
    const view = ev.view(state, state.pendingEvent);
    out.urgent.push(`${view.title}: a decision is waiting for you.`);
    return out;
  }
  const lines = ev.apply(state);
  out.urgent.push(...(lines.urgent || []));
  out.events.push(...(lines.events || []));
  return out;
}

// What the player sees for the pending choice event.
export function describePending(state) {
  const ev = state.pendingEvent;
  if (!ev || ev.type !== 'story') return null;
  const view = EVENTS[ev.id].view(state, ev);
  view.advice = view.advice.map(([role, text]) => {
    const p = advisorPerson(state, role);
    return { role, title: ADVISOR_ROLES[role].title, name: p ? p.name : null, text };
  }).filter((a) => a.name);
  return view;
}

export function resolveStoryEvent(state, choice) {
  const ev = state.pendingEvent;
  if (!ev || ev.type !== 'story') return { error: 'There is no decision waiting.' };
  const view = EVENTS[ev.id].view(state, ev);
  if (!view.options.some((o) => o.id === choice)) return { error: 'Choose one of the options.' };
  const lines = EVENTS[ev.id].resolve(state, ev, choice);
  state.pendingEvent = null;
  return { lines, title: view.title };
}

