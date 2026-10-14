// Events: things that happen to the camp. Instant events simply happen and
// are reported. Choice events stop the game and ask the player what to do.
// Ongoing conditions (fever, wolves) are handled here too.

import { WANDERERS, PLACES, NEIGHBORS, NEIGHBOR_RECRUITS, NEIGHBOR_ORDER } from './data.js';
import {
  living, seasonIndex, shelterCapacity, placeName, knownPlaces, makePerson,
  personById, wolvesAt, hasKnowledge, shelterNeeded, isKnown, hasCondition, inVillage,
} from './state.js';
import { siteFor } from './rules.js';
import { refreshAdvisors, advisorPerson, ADVISOR_ROLES } from './advisors.js';
import { chance, pick, randomInt } from './rng.js';
import { shuffle, listNames, clamp } from './util.js';
import { meet, changeRelation, skarnAtPeace } from './neighbors.js';
import { remember, resolveSkarnRaid, nation } from './nations.js';
import { lawIs } from './laws.js';
import { VILLAGE_EVENTS } from './villageEvents.js';
import { NATION_EVENTS } from './nationEvents.js';
import { SKARN_CHIEF_EVENT } from './peace.js';
import { recordDeed, hasTradition } from './legacy.js';

const EVENT_CHANCE = 0.4;
const VILLAGE_EVENT_CHANCE = 0.55;
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
      if (hasKnowledge(state, 'medicine')) recover += 0.15;
      if (chance(state, recover)) {
        p.sick = false;
        recovered.push(p);
      }
    }
    const stillSick = people.filter((p) => p.sick).length;
    const crowded = shelterNeeded(people) > shelterCapacity(state) ? 0.1 : 0;
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
  return living(state).filter((p) => p.health >= 40 && !p.sick && p.age >= 16)
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
    // Open gates let fever in more easily.
    weight: (state) => (sickPeople(state).length ? 0 : (seasonIndex(state) === 3 ? 1.2 : 0.7) * (lawIs(state, 'strangers', 'open') ? 1.5 : lawIs(state, 'strangers', 'closed') ? 0.5 : 1) * (state.buildings.shrine > 0 ? 0.6 : 1)),
    apply(state) {
      const victim = pick(state, living(state));
      victim.sick = true;
      victim.health = clamp(victim.health - 15);
      return { urgent: [`${victim.name} has come down with a fever. It may spread through the camp. Tending the sick helps them recover.`] };
    },
  },
  pests: {
    weight: (state) => (state.buildings.storehouse === 0 && !hasKnowledge(state, 'pottery') && state.resources.food > 30 ? 0.8 : 0),
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
        p.health = clamp(p.health - (hasKnowledge(state, 'clothing') ? 4 : 8));
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
        recordDeed(state, 'welcomed');
        for (const x of everyone) x.morale = clamp(x.morale + 2);
        return [`${t.name} joined the camp, still burning with fever, and is resting.`];
      }
      if (choice === 'feed') {
        state.resources.food = Math.max(0, state.resources.food - 6);
        for (const x of everyone) x.morale = clamp(x.morale + 3);
        recordDeed(state, 'gifts');
        return [`You gave ${t.name} food for the road. Your people were glad to help.`];
      }
      for (const x of everyone) x.morale = clamp(x.morale - 5);
      recordDeed(state, 'turnedAway');
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
    weight: (state) => (living(state).filter((p) => p.age >= 16).length >= 4
      ? (state.buildings.meetingHall > 0 ? 0.35 : 0.9) * (lawIs(state, 'justice', 'harsh') ? 0.4 : 1) : 0),
    start(state) {
      const [a, b] = shuffle(state, living(state).filter((p) => p.age >= 16));
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
    weight: (state) => (living(state).some((p) => p.task in TASK_GOING && p.age >= 12) ? 0.7 : 0),
    start(state) {
      const p = pick(state, living(state).filter((x) => x.task in TASK_GOING && x.age >= 12));
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
    weight: (state) => (state.turn >= 3 && state.neighbors.tellani.relation > -40 ? 0.7 : 0),
    start: () => ({}),
    view(state) {
      const known = state.neighbors.tellani.known;
      const rel = state.neighbors.tellani.relation;
      const ways = hasTradition(state, 'trading') ? 3 : 0;
      const food = Math.max(8, Math.round(15 + rel / 10)) + ways;
      const wood = Math.max(8, Math.round(20 + rel / 10)) + ways;
      const options = [];
      if (state.resources.wood >= 20) options.push({ id: 'woodForFood', label: `Trade 20 wood for ${food} food.` });
      if (state.resources.food >= 15) options.push({ id: 'foodForWood', label: `Trade 15 food for ${wood} wood.` });
      options.push({ id: 'decline', label: 'Send them on their way.' });
      return {
        title: known ? 'Tellani traders' : 'Traders',
        text: known
          ? 'A Tellani trading boat pulls up at the riverbank, low in the water with goods.'
          : 'A small boat of traders from downriver pulls up at the riverbank. They speak a strange tongue, but they understand trade.',
        options,
        advice: [['steward', `We have ${state.resources.food} food and ${state.resources.wood} wood.`]],
        food,
        wood,
      };
    },
    resolve(state, ev, choice) {
      const r = state.resources;
      const view = EVENTS.traders.view(state);
      const lines = [];
      if (choice === 'woodForFood' && r.wood >= 20) {
        r.wood -= 20;
        r.food += view.food;
        changeRelation(state, 'tellani', 2);
        recordDeed(state, 'trades');
        lines.push(`You traded 20 wood for ${view.food} food.`);
      } else if (choice === 'foodForWood' && r.food >= 15) {
        r.food -= 15;
        r.wood += view.wood;
        changeRelation(state, 'tellani', 2);
        recordDeed(state, 'trades');
        lines.push(`You traded 15 food for ${view.wood} wood.`);
      } else {
        lines.push('The traders shrugged and rowed on downriver.');
      }
      if (meet(state, 'tellani', { contact: false })) {
        lines.push('Before they left, the traders told you who they were: the Tellani, from Teln landing far downriver. You can now deal with them on the Neighbors screen.');
      }
      return lines;
    },
  },

  // ----- Neighbor events -----
  firstContact: {
    choice: true,
    weight: () => 0, // Started directly when a people is first met.
    start(state) {
      return { neighbor: NEIGHBOR_ORDER.find((id) => state.neighbors[id].contactPending) };
    },
    view(state, ev) {
      const def = NEIGHBORS[ev.neighbor];
      const intro = {
        velari: isKnown(state, 'velariFields')
          ? 'At the edge of the Velari fields, a group of farmers with long staffs comes out to meet your scouts. They are wary, but they do not raise their staffs.'
          : 'A group of farmers with long staffs walks into camp from the eastern hills. They call themselves the Velari. They are wary, but they do not raise their staffs.',
        tellani: 'At Teln landing, a Tellani trader in a bright cloak looks your scouts up and down, clearly working out what they might be worth.',
        skarn: 'Skarn sentries spot your scouts near their hold and ride out to surround them, spears lowered.',
      }[ev.neighbor];
      const options = {
        velari: [
          { id: 'gift', label: 'Greet them warmly, with a gift of 10 food. They will remember the kindness.' },
          { id: 'greet', label: 'Greet them politely and share news.' },
          { id: 'withdraw', label: 'Withdraw quietly. They will think you strange.' },
        ],
        tellani: [
          { id: 'gift', label: 'Offer 10 wood as a gift, to start on good terms.' },
          { id: 'greet', label: 'Talk trade and see what they offer.' },
          { id: 'withdraw', label: 'Withdraw. They will not be offended, only uninterested.' },
        ],
        skarn: [
          { id: 'gift', label: 'Offer 10 food as a gift of peace.' },
          { id: 'greet', label: 'Stand firm and speak plainly. The Skarn respect boldness.' },
          { id: 'withdraw', label: 'Back away and run. They will take it as weakness.' },
        ],
      }[ev.neighbor];
      return {
        title: `First contact: ${def.title}`,
        text: `${intro} ${def.description}`,
        options,
        advice: [['speaker', ev.neighbor === 'skarn'
          ? 'These are the raiders. Whatever we do, they will judge us by it.'
          : `First impressions matter. ${def.title} could be good friends to have.`]],
      };
    },
    resolve(state, ev, choice) {
      const id = ev.neighbor;
      const n = state.neighbors[id];
      n.contactPending = false;
      const def = NEIGHBORS[id];
      if (choice === 'gift') {
        const what = id === 'tellani' ? 'wood' : 'food';
        state.resources[what] = Math.max(0, state.resources[what] - 10);
        recordDeed(state, 'gifts');
        changeRelation(state, id, id === 'skarn' ? 8 : 15);
        return [`You offered 10 ${what} to ${def.name}. ${id === 'skarn' ? 'The Skarn took it without thanks, but lowered their spears.' : 'They accepted it gladly.'} You can deal with them on the Neighbors screen.`];
      }
      if (choice === 'greet') {
        changeRelation(state, id, 5);
        if (id === 'skarn') for (const p of living(state)) p.morale = clamp(p.morale + 3);
        return [`Your scouts greeted ${def.name} and came home with news. You can deal with them on the Neighbors screen.`];
      }
      changeRelation(state, id, -5);
      return [`Your scouts withdrew from ${def.name}. You can still deal with them on the Neighbors screen.`];
    },
  },

  // If your scouts never find the Velari, they come to look at you.
  velariVisit: {
    weight: (state) => (!state.neighbors.velari.known && state.turn >= 6 ? 0.8 : 0),
    apply(state) {
      meet(state, 'velari');
      return { urgent: ['Strangers from the eastern hills came down through the North meadow to see who had settled in the valley. Your people will meet them soon.'] };
    },
  },

  // An ally under attack by the Skarn calls for help. Only started by the
  // nations' year, never at random.
  allyCall: {
    choice: true,
    weight: () => 0,
    view(state, ev) {
      const who = NEIGHBORS[ev.target];
      const fighters = allyCallFighters(state);
      const sk = nation(state, 'skarn');
      const options = [];
      if (fighters.length >= 3 && state.resources.food >= 10) {
        options.push({ id: 'send', label: `Send ${fighters.length} fighters (${listNames(fighters)}) and 10 food for the march. Some may come home hurt.` });
      }
      options.push({ id: 'refuse', label: 'Refuse. Your own village comes first. They will remember it.' });
      return {
        title: `${who.title} call for help`,
        text: `A runner arrives from ${who.name}, out of breath: about ${sk ? sk.warriors : 'many'} Skarn warriors are raiding them. As your allies, they ask you to send fighters at once.`,
        options,
        advice: [
          ['speaker', `We swore an alliance with ${who.name}. If we refuse, they may end it, and others will hear that our word is worth little.`],
          ['warChief', fighters.length >= 3 ? `I would send ${listNames(fighters)}. They are our best, and the rest can hold the village.` : 'We have too few fit fighters to send anyone.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      const id = ev.target;
      const who = NEIGHBORS[id];
      const fighters = allyCallFighters(state);
      if (choice === 'send' && fighters.length >= 3 && state.resources.food >= 10) {
        state.resources.food -= 10;
        const hurt = fighters.filter(() => chance(state, 0.3));
        for (const p of hurt) p.health = clamp(p.health - randomInt(state, 20, 35));
        resolveSkarnRaid(state, id, true);
        changeRelation(state, id, 10);
        changeRelation(state, 'skarn', -8);
        remember(state, id, `came to their aid against the Skarn in Year ${Math.floor(state.turn / 4) + 1}`, 12);
        recordDeed(state, 'gifts');
        return [`Your fighters marched to help ${who.name} and drove the Skarn off.${hurt.length ? ` ${listNames(hurt)} came home hurt.` : ' All came home whole.'} ${who.title} will not forget it.`];
      }
      resolveSkarnRaid(state, id, false);
      changeRelation(state, id, -15);
      remember(state, id, `refused to help when the Skarn attacked them in Year ${Math.floor(state.turn / 4) + 1}`, -25);
      const nat = nation(state, id);
      if (nat && nat.trust < 40 && nat.treaties.alliance) {
        nat.treaties.alliance = false;
        return [`You refused. ${who.title} fought the Skarn alone and suffered for it. They have ended the alliance.`];
      }
      return [`You refused. ${who.title} fought the Skarn alone and suffered for it. They will remember.`];
    },
  },

  velariHunger: {
    choice: true,
    weight: (state) => (state.neighbors.velari.known && state.neighbors.velari.relation > -20 ? 0.6 : 0),
    start: () => ({}),
    view(state) {
      const options = [];
      if (state.resources.food >= 20) options.push({ id: 'all', label: 'Send the 20 food they ask for.' });
      if (state.resources.food >= 10) options.push({ id: 'some', label: 'Send 10 food, what you can spare.' });
      options.push({ id: 'refuse', label: 'Refuse. Your own people come first.' });
      return {
        title: 'A Velari request',
        text: 'A Velari elder arrives, footsore and thin. Blight has struck their terraces, and the Velari ask for 20 food to see them through.',
        options,
        advice: [['speaker', 'The Velari remember who helped them in hard times.'], ['steward', `We have ${state.resources.food} food.`]],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'all' && state.resources.food >= 20) {
        state.resources.food -= 20;
        changeRelation(state, 'velari', 18);
        recordDeed(state, 'gifts', 2);
        return ['You sent 20 food to the Velari. Their elder wept with gratitude.'];
      }
      if (choice === 'some' && state.resources.food >= 10) {
        state.resources.food -= 10;
        changeRelation(state, 'velari', 8);
        recordDeed(state, 'gifts');
        return ['You sent 10 food to the Velari. They thanked you for what you could spare.'];
      }
      changeRelation(state, 'velari', -10);
      return ['You turned the Velari elder away. The walk home will be long.'];
    },
  },

  neighborRecruit: {
    choice: true,
    weight: (state) => (recruitSources(state).length ? 0.6 : 0),
    start(state) {
      const from = pick(state, recruitSources(state));
      return { from, recruit: state.neighbors[from].joined };
    },
    view(state, ev) {
      const t = NEIGHBOR_RECRUITS[ev.from][ev.recruit];
      return {
        title: `A ${NEIGHBORS[ev.from].title} newcomer`,
        text: `${t.name}, ${t.note.charAt(0).toLowerCase()}${t.note.slice(1)} asks to join your camp.`,
        options: [
          { id: 'accept', label: `Welcome ${t.name}.` },
          { id: 'decline', label: 'Politely decline.' },
        ],
        advice: [['speaker', `Taking in one of ${NEIGHBORS[ev.from].name} would bind our peoples closer.`]],
      };
    },
    resolve(state, ev, choice) {
      const t = NEIGHBOR_RECRUITS[ev.from][ev.recruit];
      state.neighbors[ev.from].joined += 1;
      if (choice !== 'accept') return [`${t.name} went home, a little disappointed.`];
      const p = makePerson({ ...t, age: 18 + randomInt(state, 0, 6) }, state.nextPersonId++, 'rest');
      p.isNew = true;
      state.people.push(p);
      changeRelation(state, ev.from, 5);
      recordDeed(state, 'welcomed');
      return [`${t.name} joined the camp.`];
    },
  },

  skarnDemand: {
    choice: true,
    weight: (state) => (state.neighbors.skarn.known && !skarnAtPeace(state) && state.neighbors.skarn.relation < 25 ? 0.8 : 0),
    start: () => ({}),
    view(state) {
      const options = [];
      if (state.resources.food >= 25) options.push({ id: 'pay', label: 'Pay 25 food. They promise a year without raids.' });
      options.push({ id: 'refuse', label: 'Refuse, politely. They may come for it themselves.' });
      options.push({ id: 'defy', label: 'Send them off with a warning. Your people will cheer, and the Skarn will be angry.' });
      return {
        title: 'Skarn riders',
        text: 'Three Skarn riders come to the edge of camp and demand 25 food in tribute.',
        options,
        advice: [['warChief', state.buildings.palisade ? 'Behind our palisade, we can hold them off.' : 'Without a palisade, a real attack would hurt us.'], ['steward', `We have ${state.resources.food} food.`]],
      };
    },
    resolve(state, ev, choice) {
      const sk = state.neighbors.skarn;
      if (choice === 'pay' && state.resources.food >= 25) {
        state.resources.food -= 25;
        sk.truceUntil = state.turn + 4;
        changeRelation(state, 'skarn', 5);
        return ['You paid the Skarn 25 food. They rode off satisfied, promising a year of peace.'];
      }
      if (choice === 'defy') {
        changeRelation(state, 'skarn', -20);
        state.raidThreat = true;
        for (const p of living(state)) p.morale = clamp(p.morale + 6);
        return ['You sent the Skarn riders off with a warning. Your people cheered. The riders promised to return in force.'];
      }
      changeRelation(state, 'skarn', -10);
      state.raidThreat = true;
      return ['You refused the Skarn. The riders left without a word. Expect them soon.'];
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

// The best fighters to send to an ally: up to 4, keeping some at home.
function allyCallFighters(state) {
  const able = living(state).filter((p) => p.age >= 16 && p.health >= 60 && !p.sick)
    .sort((a, b) => b.skills.hunting - a.skills.hunting);
  return able.slice(0, Math.min(4, Math.floor(able.length / 3)));
}

// Village events join the rest.
Object.assign(EVENTS, VILLAGE_EVENTS, NATION_EVENTS, SKARN_CHIEF_EVENT);

function recruitSources(state) {
  return Object.keys(NEIGHBOR_RECRUITS).filter((id) => {
    const n = state.neighbors[id];
    return n.known && n.relation >= 30 && n.joined < NEIGHBOR_RECRUITS[id].length;
  });
}

function wolfPlaces(state) {
  return knownPlaces(state).filter((id) => id !== 'camp' && PLACES[id].tasks.includes('hunt') && !wolvesAt(state, id));
}

// Lean times come on their own, apart from other events, so that keeping a
// reserve always matters. Each has a chance at the start of a season.
const HARD_WINTER_CHANCE = 0.25;
const DROUGHT_CHANCE = 0.2;
const HERDS_CHANCE = 0.05;

const LEAN_EVENTS = {
  hardWinter: {
    // Only at the start of winter, and not in the first winter.
    chance: (state) => (seasonIndex(state) === 3 && state.turn > 4 && !hasCondition(state, 'hardWinter') ? HARD_WINTER_CHANCE : 0),
    apply(state) {
      state.conditions.push({ id: 'hardWinter', seasonsLeft: 1 });
      return { urgent: [`A hard winter has come: deep snow and bitter cold. This winter the fires will burn about ${Math.ceil(living(state).length * 1.5)} wood instead of ${living(state).length}, and hunting will bring in less.`] };
    },
  },
  drought: {
    // At the start of summer, after the first year.
    chance: (state) => (seasonIndex(state) === 1 && state.turn > 4 && !hasCondition(state, 'drought') ? DROUGHT_CHANCE : 0),
    apply(state) {
      state.conditions.push({ id: 'drought', seasonsLeft: 2 });
      const fields = state.buildings.fields > 0 ? ' The grain in the fields is wilting, and the harvest will be smaller.' : '';
      return { urgent: [`Drought: no rain has fallen in weeks. Foraging will bring in less this summer and autumn.${fields}`] };
    },
  },
  herdsMove: {
    chance: (state) => (seasonIndex(state) !== 3 && state.turn > 4 ? HERDS_CHANCE : 0),
    apply(state) {
      for (const id of knownPlaces(state)) {
        const a = state.places[id].abundance;
        a.hunt = Math.max(0, a.hunt - 35);
      }
      return { urgent: ['The deer herds have moved away from the valley. Game is scarce everywhere for now, and will slowly return.'] };
    },
  },
};

function maybeLeanTimes(state, out) {
  for (const ev of Object.values(LEAN_EVENTS)) {
    if (!chance(state, ev.chance(state))) continue;
    const lines = ev.apply(state);
    out.urgent.push(...(lines.urgent || []));
    out.events.push(...(lines.events || []));
  }
}

// ---------- running events ----------

// Called at the start of each new season. Returns report lines.
export function maybeStartEvent(state) {
  const out = { urgent: [], events: [] };
  if (state.pendingEvent || state.gameOver || state.turn < 1) return out;
  maybeLeanTimes(state, out);
  // Meeting a new people comes before anything else.
  if (NEIGHBOR_ORDER.some((id) => state.neighbors[id].contactPending)) {
    const ev = EVENTS.firstContact;
    state.pendingEvent = { type: 'story', id: 'firstContact', ...ev.start(state) };
    out.urgent.push(`${ev.view(state, state.pendingEvent).title}: a decision is waiting for you.`);
    return out;
  }
  // A village is a busier place: events come a little more often.
  if (!chance(state, inVillage(state) ? VILLAGE_EVENT_CHANCE : EVENT_CHANCE)) return out;
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

