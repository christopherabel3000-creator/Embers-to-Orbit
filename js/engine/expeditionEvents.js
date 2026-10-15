// Choices that come up on an expedition: a river in flood, smoke ahead,
// fever, something buried, and meeting a small people. Each waits on the
// expedition until the season begins, then comes before other events.

import { REGIONS, WORLD_PLACES, SMALL_PEOPLES } from './worldData.js';
import {
  expeditionById, leaderName, turnHome, findPlace, regionPlaces, placeFound, joiners,
} from './world.js';
import { applyStudy } from './study.js';
import { chance, pick, randomInt } from './rng.js';
import { clamp, lowerFirst } from './util.js';

function partyOf(state, ev) {
  return expeditionById(state, ev.exp);
}

function where(exp) {
  return lowerFirst(REGIONS[exp.region].name);
}

function hurtOne(state, exp, amount) {
  const p = pick(state, exp.party);
  p.health = clamp(p.health - amount);
  return p;
}

function done(exp) {
  exp.pendingChoice = null;
}

export const EXPEDITION_EVENTS = {
  expFord: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const exp = partyOf(state, ev);
      return {
        title: 'A river in flood',
        text: `Word from ${leaderName(exp)}'s expedition in ${where(exp)}: a river in flood blocks their way, brown and fast. The far bank is where they meant to explore.`,
        options: [
          { id: 'cross', label: 'Cross now. Someone may be hurt.' },
          { id: 'around', label: 'Go around. It costs them a season of exploring.' },
        ],
        advice: [['warChief', 'Floods drown the careless. But a season is a season.']],
      };
    },
    resolve(state, ev, choice) {
      const exp = partyOf(state, ev);
      done(exp);
      if (choice === 'around') {
        exp.skip = 1;
        return [`${leaderName(exp)}'s party went around the flood, and lost a season doing it.`];
      }
      if (chance(state, 0.5)) {
        const p = hurtOne(state, exp, randomInt(state, 20, 35));
        return [`${leaderName(exp)}'s party crossed the flood. ${p.name} was swept against the rocks and hurt.`];
      }
      return [`${leaderName(exp)}'s party crossed the flood safely.`];
    },
  },

  expStrangers: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const exp = partyOf(state, ev);
      const gift = Math.min(exp.food, exp.party.length * 2);
      const options = [];
      if (gift > 0) options.push({ id: 'approach', label: `Approach with gifts of ${gift} food, and ask what lies ahead.` });
      options.push({ id: 'avoid', label: 'Avoid them.' });
      return {
        title: 'Smoke ahead',
        text: `Word from ${leaderName(exp)}'s expedition in ${where(exp)}: they have seen the smoke of strangers' fires. Strangers know the land, but not all strangers are friendly.`,
        options,
        advice: [['speaker', 'Most people will talk to travelers who come with gifts.'], ['steward', 'Food given away there is food they will not eat on the way home.']],
      };
    },
    resolve(state, ev, choice) {
      const exp = partyOf(state, ev);
      done(exp);
      if (choice === 'avoid') return [`${leaderName(exp)}'s party kept clear of the strangers.`];
      exp.food -= Math.min(exp.food, exp.party.length * 2);
      const danger = regionPlaces(exp.region).some((id) => WORLD_PLACES[id].kind === 'danger');
      if (danger && chance(state, 0.25)) {
        const p = hurtOne(state, exp, randomInt(state, 25, 40));
        return [`The strangers in ${where(exp)} were bandits. They took the gifts and fell on the party; ${p.name} was hurt before they got away.`];
      }
      const unfound = regionPlaces(exp.region).filter((id) => !placeFound(state, id));
      if (!unfound.length) return ['The strangers were friendly, but could tell the party nothing new.'];
      return [`The strangers were friendly, and pointed the way. ${leaderName(exp)}'s party found ${findPlace(state, exp, pick(state, unfound))}`];
    },
  },

  expFever: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const exp = partyOf(state, ev);
      return {
        title: 'Fever on the road',
        text: `Word from ${leaderName(exp)}'s expedition in ${where(exp)}: one of the party has a fever, and is too weak to walk far.`,
        options: [
          { id: 'home', label: 'Turn for home now.' },
          { id: 'press', label: 'Press on, and hope it breaks.' },
        ],
        advice: [['healer', 'Rest and warmth would save them. On the road, it could go either way.']],
      };
    },
    resolve(state, ev, choice) {
      const exp = partyOf(state, ev);
      done(exp);
      if (choice === 'home') {
        if (exp.stage !== 'home') turnHome(state, exp);
        return [`${leaderName(exp)}'s party has turned for home with their sick companion.`];
      }
      if (exp.party.length > 1 && chance(state, 0.4)) {
        const others = exp.party.filter((p) => p.id !== exp.leader);
        const p = pick(state, others.length ? others : exp.party);
        exp.party = exp.party.filter((x) => x !== p);
        exp.lost.push(p.name);
        return [`The fever did not break. ${p.name} died on the road in ${where(exp)}, and the party went on.`];
      }
      return ['The fever broke, and the party went on.'];
    },
  },

  expDig: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const exp = partyOf(state, ev);
      return {
        title: 'Something buried',
        text: `Word from ${leaderName(exp)}'s expedition in ${where(exp)}: they have found worked stone under the ground, the corner of something old and buried.`,
        options: [
          { id: 'dig', label: 'Dig it out. Old walls can fall.' },
          { id: 'leave', label: 'Leave it, and keep exploring.' },
        ],
        advice: [['scholar', 'Whatever is down there, someone made it, and made it to last. I would give a great deal to see it.']],
      };
    },
    resolve(state, ev, choice) {
      const exp = partyOf(state, ev);
      done(exp);
      if (choice === 'leave') return [`${leaderName(exp)}'s party left the buried stones where they lay.`];
      const lines = [];
      if (chance(state, 0.2)) {
        const p = hurtOne(state, exp, randomInt(state, 25, 40));
        lines.push(`A wall gave way as they dug, and ${p.name} was hurt.`);
      }
      const studied = applyStudy(state, 20);
      lines.push(`They uncovered a carved hall, and sent home drawings of its signs: 20 points toward your studies.`, ...studied.urgent);
      return [lines.join(' ')];
    },
  },

  smallPeople: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const exp = partyOf(state, ev);
      const place = WORLD_PLACES[exp.pendingChoice.place];
      const folk = SMALL_PEOPLES[place.people];
      const options = [];
      if ((state.resources.goods || 0) >= 10) options.push({ id: 'gifts', label: `Send 10 goods as gifts, and ask them to guide your people through ${where(exp)}.` });
      options.push({ id: 'invite', label: `Invite any who wish to come home with the expedition and join your people.` });
      options.push({ id: 'leave', label: 'Greet them, and go on your way.' });
      return {
        title: `Meeting ${folk.name}`,
        text: `Word from ${leaderName(exp)}'s expedition in ${where(exp)}: at ${place.name} they have met ${folk.name}. ${place.description}`,
        options,
        advice: [['speaker', `A friendly people who know ${where(exp)} would make every journey there safer.`], ['steward', 'New hands are always welcome, if we can feed them.']],
      };
    },
    resolve(state, ev, choice) {
      const exp = partyOf(state, ev);
      const place = WORLD_PLACES[exp.pendingChoice.place];
      const folk = SMALL_PEOPLES[place.people];
      done(exp);
      state.world.peoples[place.people] = choice === 'gifts' ? 'friends' : 'met';
      if (choice === 'gifts') {
        state.resources.goods -= 10;
        state.world.regions[exp.region].mapped = true;
        return [`${folk.name[0].toUpperCase()}${folk.name.slice(1)} took your gifts gladly, and showed your people every path through ${where(exp)}. It is as good as mapped: a season closer, safer, and its places easier to find.`];
      }
      if (choice === 'invite') {
        const count = randomInt(state, 2, 4);
        joiners(state, exp, count, folk);
        return [`${count} of ${folk.name} chose to come home with the expedition and join your people.`];
      }
      return [`Your people greeted ${folk.name}, and went on their way.`];
    },
  },
};
