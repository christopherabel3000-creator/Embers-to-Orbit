// Events the nations start themselves: offering treaties, demanding land,
// asking you to take sides, asking for help on the road, and the Skarn
// offering a bargain at another people's expense.

import {
  NEIGHBORS, NATIONS, TREATIES, TREATY_ORDER,
} from './data.js';
import {
  living, year, placeName, canFight, independent,
} from './state.js';
import { advisorPerson } from './advisors.js';
import { changeRelation, skarnAtPeace } from './neighbors.js';
import {
  nation, nationsActive, remember, owner, treatyBlocker, makeTreaty, between, shiftBetween,
  resolveSkarnRaid, skarnLosses,
} from './nations.js';
import { recordDeed } from './legacy.js';
import { chance, pick, randomInt } from './rng.js';
import { clamp, listNames, capital } from './util.js';

const FRIENDS = ['velari', 'tellani'];

// Treaties a nation would now offer on its own: ones it would accept, with
// relations comfortably above what it needs.
function offers(state) {
  if (!nationsActive(state)) return [];
  const out = [];
  for (const id of FRIENDS) {
    if (!independent(state, id)) continue;
    for (const key of TREATY_ORDER) {
      if (!TREATIES[key].with.includes(id)) continue;
      if (!treatyBlocker(state, id, key) && state.neighbors[id].relation >= TREATIES[key].relation + 10) out.push({ nation: id, key });
    }
  }
  return out;
}

// Places the village holds that a resentful nation wanted for itself.
function demands(state) {
  if (!nationsActive(state)) return [];
  const out = [];
  for (const id of FRIENDS) {
    if (!independent(state, id) || state.neighbors[id].relation >= 0) continue;
    for (const place of NATIONS[id].expansion) {
      if (owner(state, place) === 'player') out.push({ nation: id, place });
    }
  }
  return out;
}

function escorts(state) {
  return living(state).filter((p) => canFight(p) && p.age >= 16 && p.health >= 60)
    .sort((a, b) => b.skills.hunting - a.skills.hunting).slice(0, 3);
}

function canMediate(state) {
  const speaker = advisorPerson(state, 'speaker');
  return state.buildings.meetingHall > 0 || Boolean(speaker && speaker.skills.learning >= 3);
}

export const NATION_EVENTS = {
  treatyOffer: {
    choice: true,
    weight: (state) => (offers(state).length ? 0.5 : 0),
    start(state) {
      return pick(state, offers(state));
    },
    view(state, ev) {
      const who = NEIGHBORS[ev.nation];
      const t = TREATIES[ev.key];
      return {
        title: `${who.title} propose ${t.phrase}`,
        text: `Envoys from ${who.name} arrive with gifts and a proposal: ${t.phrase}. ${t.effect}`,
        options: [
          { id: 'accept', label: `Accept ${t.phrase}.` },
          { id: 'decline', label: 'Decline politely.' },
        ],
        advice: [['speaker', `They would not ask unless they trusted us. Refusing will disappoint them, a little.`]],
      };
    },
    resolve(state, ev, choice) {
      const who = NEIGHBORS[ev.nation];
      if (choice === 'accept') {
        const r = makeTreaty(state, ev.nation, ev.key);
        return [r.message || r.error];
      }
      changeRelation(state, ev.nation, -3);
      return [`You declined. ${capital(who.name)} went home disappointed.`];
    },
  },

  landDemand: {
    choice: true,
    weight: (state) => (demands(state).length ? 0.4 : 0),
    start(state) {
      return pick(state, demands(state));
    },
    view(state, ev) {
      const who = NEIGHBORS[ev.nation];
      const options = [
        { id: 'yield', label: `Give ${placeName(state, ev.place)} to ${who.name}.` },
        { id: 'refuse', label: 'Refuse. The land is yours.' },
      ];
      if ((state.resources.goods || 0) >= 15) options.push({ id: 'goods', label: 'Keep it, and send 15 goods to soothe them.' });
      return {
        title: `${who.title} demand land`,
        text: `${capital(who.name)} have long wanted ${placeName(state, ev.place)}, and they no longer think well of you. Their envoys demand that you give it up.`,
        options,
        advice: [['speaker', `Refusing will make enemies of ${who.name}. Giving in may teach them that we can be pushed.`]],
      };
    },
    resolve(state, ev, choice) {
      const who = NEIGHBORS[ev.nation];
      const name = placeName(state, ev.place);
      if (owner(state, ev.place) !== 'player') return ['The matter settled itself.'];
      if (choice === 'yield') {
        state.places[ev.place].owner = ev.nation;
        changeRelation(state, ev.nation, 10);
        remember(state, ev.nation, `gave up ${name} to them in Year ${year(state)}`, 3);
        return [`You gave ${name} to ${who.name}. They are mollified. Anyone working there now needs their leave.`];
      }
      if (choice === 'goods' && (state.resources.goods || 0) >= 15) {
        state.resources.goods -= 15;
        changeRelation(state, ev.nation, 2);
        return [`You kept ${name} and sent 15 goods. ${capital(who.name)} accepted them, grudgingly.`];
      }
      changeRelation(state, ev.nation, -8);
      remember(state, ev.nation, `refused to give up ${name} in Year ${year(state)}`, -5);
      return [`You refused. ${capital(who.name)} will not forget it.`];
    },
  },

  takeSides: {
    choice: true,
    weight: (state) => (nationsActive(state) && FRIENDS.every((id) => independent(state, id)) && between(state, 'velari', 'tellani') < 0 ? 0.5 : 0),
    start(state) {
      return { over: pick(state, ['fishing rights on the river', 'a stolen herd', 'a killing at the ford', 'where one people\'s land ends and the other\'s begins']) };
    },
    view(state, ev) {
      const options = [
        { id: 'velari', label: 'Back the Velari.' },
        { id: 'tellani', label: 'Back the Tellani.' },
        { id: 'stay', label: 'Stay out of it.' },
      ];
      if (canMediate(state)) options.push({ id: 'mediate', label: `Offer to judge between them${state.buildings.meetingHall > 0 ? ' in your meeting hall' : ''}.` });
      return {
        title: 'A quarrel between peoples',
        text: `The Velari and the Tellani have fallen out over ${ev.over}. Each has sent envoys asking for your support.`,
        options,
        advice: [['speaker', canMediate(state) ? 'If we judge fairly, both will respect us, and they may make peace.' : 'Whoever we back will be grateful; the other will not.']],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'velari' || choice === 'tellani') {
        const other = choice === 'velari' ? 'tellani' : 'velari';
        changeRelation(state, choice, 10);
        changeRelation(state, other, -12);
        shiftBetween(state, 'velari', 'tellani', -10);
        nation(state, choice).wealth += 20;
        nation(state, other).wealth = Math.max(0, nation(state, other).wealth - 20);
        remember(state, choice, `stood with them against ${NEIGHBORS[other].name} in Year ${year(state)}`, 5);
        remember(state, other, `stood against them with ${NEIGHBORS[choice].name} in Year ${year(state)}`, -5);
        return [`You backed ${NEIGHBORS[choice].name}. They won their quarrel, and ${NEIGHBORS[other].name} are bitter toward you.`];
      }
      if (choice === 'mediate' && canMediate(state)) {
        changeRelation(state, 'velari', 4);
        changeRelation(state, 'tellani', 4);
        shiftBetween(state, 'velari', 'tellani', 25);
        recordDeed(state, 'gifts');
        return ['You judged between them, and both peoples accepted your word. They are at peace again, and think well of you.'];
      }
      changeRelation(state, 'velari', -2);
      changeRelation(state, 'tellani', -2);
      return ['You stayed out of it. Both peoples had hoped for more from you.'];
    },
  },

  caravanEscort: {
    choice: true,
    weight: (state) => {
      if (!nationsActive(state) || !independent(state, 'tellani') || state.neighbors.tellani.relation < 0) return 0;
      const sk = nation(state, 'skarn');
      return sk && sk.warriors >= 8 && escorts(state).length >= 3 && !skarnAtPeace(state) ? 0.35 : 0;
    },
    start: () => ({}),
    view(state) {
      const guards = escorts(state);
      return {
        title: 'The Tellani ask for an escort',
        text: 'A Tellani caravan must pass the raider trail, and they fear the Skarn. They ask you to send fighters to guard it, and promise a share of the goods.',
        options: [
          { id: 'send', label: `Send ${listNames(guards)} to guard the caravan.` },
          { id: 'decline', label: 'Decline. Your fighters are needed at home.' },
        ],
        advice: [['warChief', 'The Skarn may fall on the caravan. Our people could be hurt, but they would teach the Skarn a lesson.']],
      };
    },
    resolve(state, ev, choice) {
      if (choice !== 'send') {
        changeRelation(state, 'tellani', -3);
        return ['You declined. The Tellani went another way, grumbling.'];
      }
      const guards = escorts(state);
      changeRelation(state, 'tellani', 6);
      changeRelation(state, 'skarn', -3);
      remember(state, 'tellani', `guarded one of their caravans in Year ${year(state)}`, 4);
      if (chance(state, 0.7)) {
        state.resources.goods = (state.resources.goods || 0) + 20;
        return [`${listNames(guards)} saw the caravan safely past the raider trail. The Tellani gave you 20 goods.`];
      }
      const hurt = guards.slice(0, randomInt(state, 1, 2));
      for (const p of hurt) p.health = clamp(p.health - randomInt(state, 20, 35));
      skarnLosses(state, randomInt(state, 1, 3));
      state.resources.goods = (state.resources.goods || 0) + 10;
      return [`Skarn raiders fell on the caravan, and your fighters drove them off. ${listNames(hurt)} ${hurt.length === 1 ? 'was' : 'were'} hurt. The Tellani gave you 10 goods.`];
    },
  },

  skarnEnvoy: {
    choice: true,
    weight: (state) => (nationsActive(state) && state.neighbors.skarn.known && independent(state, 'velari') && !skarnAtPeace(state) && state.neighbors.skarn.relation > -60 ? 0.35 : 0),
    start: () => ({}),
    view() {
      return {
        title: 'A Skarn bargain',
        text: 'A Skarn envoy comes under a branch of truce. They mean to raid the Velari this season. If you stand aside, and send no warning, they will leave your village alone for a year.',
        options: [
          { id: 'agree', label: 'Agree, and stand aside.' },
          { id: 'refuse', label: 'Refuse, and say nothing.' },
          { id: 'warn', label: 'Refuse, and send a runner to warn the Velari.' },
        ],
        advice: [['speaker', 'The Velari would never forgive us if they learned of it. And such things are usually learned.'], ['warChief', 'A year without raids would let us grow strong.']],
      };
    },
    resolve(state, ev, choice) {
      const sk = state.neighbors.skarn;
      if (choice === 'agree') {
        sk.truceUntil = Math.max(sk.truceUntil, state.turn + 4);
        changeRelation(state, 'skarn', 8);
        resolveSkarnRaid(state, 'velari', false);
        shiftBetween(state, 'skarn', 'velari', -10);
        if (chance(state, 0.5)) {
          changeRelation(state, 'velari', -15);
          remember(state, 'velari', `stood aside while the Skarn raided them, by bargain, in Year ${year(state)}`, -20);
          return ['You stood aside. The Skarn raided the Velari and kept their word to you. But the Velari learned of the bargain, and they are furious.'];
        }
        return ['You stood aside. The Skarn raided the Velari and kept their word to you. The Velari do not know.'];
      }
      if (choice === 'warn') {
        changeRelation(state, 'skarn', -12);
        changeRelation(state, 'velari', 8);
        remember(state, 'velari', `warned them of a Skarn raid in Year ${year(state)}`, 5);
        skarnLosses(state, 2);
        return ['Your runner reached the Velari in time. They met the Skarn ready, and the raid failed. The Skarn know who warned them.'];
      }
      changeRelation(state, 'skarn', -5);
      return ['You sent the Skarn envoy away with nothing.'];
    },
  },
};
