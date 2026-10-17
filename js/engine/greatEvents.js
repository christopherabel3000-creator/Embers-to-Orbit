// Events of the great nations and of the valley peoples joining yours:
// first contact with a great nation, the Orhai demanding tribute, an
// Ostrani merchant fleet, a valley people asking to join your nation, and
// the Skarn suing to become your vassals.

import { NEIGHBORS } from './data.js';
import { GREAT_NATIONS, GREAT_ORDER } from './greatData.js';
import { REGIONS } from './worldData.js';
import { year, eraAtLeast } from './state.js';
import {
  great, changeGreat, greatRemember, tributeCost, payTribute, tradeFactor,
} from './great.js';
import {
  federationCandidates, joinNation, vassalReady, makeVassal, VASSAL_TRIBUTE,
} from './union.js';
import { changeRelation } from './neighbors.js';
import { nation, remember } from './nations.js';
import { fortresses } from './realm.js';
import { inOrhaiReach } from './great.js';
import { atWar, armyHolding } from './warStatus.js';
import { reputation, recordDeed } from './legacy.js';
import { pick } from './rng.js';
import { capital, lowerFirst } from './util.js';

const FLEET = { goods: 40 };

function fleetCoin(state) {
  return Math.round(20 * tradeFactor(state, 'ostrani'));
}

export const GREAT_EVENTS = {
  greatContact: {
    choice: true,
    weight: () => 0,
    start: () => ({}),
    view(state, ev) {
      const def = GREAT_NATIONS[ev.nation];
      const options = [];
      if ((state.resources.goods || 0) >= 10) options.push({ id: 'gifts', label: 'Greet them with gifts of 10 goods.' });
      options.push({ id: 'greet', label: 'Greet them as equals.' });
      options.push({ id: 'wary', label: 'Keep your distance, and watch them.' });
      return {
        title: `Meeting ${def.name}`,
        text: `${capital(def.name)}: ${def.description} ${def.values} They want ${def.wants}, and offer ${def.offers}.`,
        options,
        advice: [
          ['speaker', ev.nation === 'ostrani' ? 'Merchants remember a generous first meeting. So do their ledgers.' : 'Riders like these respect a straight back more than a full hand. Gifts may look like fear.'],
          ['warChief', ev.nation === 'orhai' ? 'They are many, and they are fast. We should know them before they know us.' : 'They have ships, not swords, as far as I can tell.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      const g = great(state, ev.nation);
      const def = GREAT_NATIONS[ev.nation];
      g.met = true;
      g.metAt = state.turn;
      g.contactPending = false;
      if (choice === 'gifts') {
        state.resources.goods -= 10;
        changeGreat(state, ev.nation, ev.nation === 'orhai' ? 2 : 10);
        greatRemember(state, ev.nation, `greeted them with gifts in Year ${year(state)}`, ev.nation === 'orhai' ? 0 : 5);
        recordDeed(state, 'gifts');
      } else if (choice === 'greet') {
        changeGreat(state, ev.nation, ev.nation === 'orhai' ? 8 : 3);
        greatRemember(state, ev.nation, `greeted them as equals in Year ${year(state)}`, 2);
      } else {
        changeGreat(state, ev.nation, -5);
      }
      return [`Your people have met ${def.name}, ${def.nature} of ${lowerFirst(REGIONS[def.homeland].name)}. Relations stand at ${g.relation}. Envoys can go to them from the Neighbors screen.`];
    },
  },

  orhaiDemand: {
    choice: true,
    weight: (state) => {
      const g = great(state, 'orhai');
      if (!g || !g.met || g.treaties.peace || atWar(state, 'orhai') || g.paidUntil > state.turn || state.turn - g.lastDemand < 8 || g.relation >= 30) return 0;
      return 0.5;
    },
    start(state) {
      great(state, 'orhai').lastDemand = state.turn;
      return { coin: tributeCost(state) };
    },
    view(state, ev) {
      const strong = fortresses(state).some((t) => inOrhaiReach(t, state)) || reputation(state).fierce >= 15 || ['plains', 'desert'].some((r) => armyHolding(state, r));
      const options = [];
      if ((state.resources.coin || 0) >= ev.coin) options.push({ id: 'pay', label: `Pay ${ev.coin} coin, and their riders stay away for a year.` });
      options.push({ id: 'refuse', label: 'Refuse. Their riders will come more often for a year.' });
      if (strong) options.push({ id: 'stand', label: 'Show them your walls and your warriors, and send them home with nothing.' });
      return {
        title: 'The Orhai demand tribute',
        text: `Orhai riders have come with a demand from their khan: ${ev.coin} coin a year, or their riders will take what they please from your settlements on the plains.`,
        options,
        advice: [
          ['speaker', 'They despise a people who pay, and each year they will ask for more. But their riders are fast, and our settlements out there are small.'],
          ['warChief', strong ? 'We have a fortress or an army on the plains, or a name they respect. They know what they would face.' : 'We have no fortress on the plains. If they come, the settlers there stand alone.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      const g = great(state, 'orhai');
      if (choice === 'pay') {
        state.resources.coin -= ev.coin;
        payTribute(state);
        return [`You paid the Orhai ${ev.coin} coin. Their riders will leave your settlements alone for a year; next year they will ask for more.`];
      }
      if (choice === 'stand') {
        changeGreat(state, 'orhai', 8);
        g.tributeInARow = 0;
        greatRemember(state, 'orhai', `would not pay them tribute, and showed them strength, in Year ${year(state)}`, 3);
        return ['The Orhai riders looked at your walls and your warriors, and rode home without a word. Their khan thinks better of you for it.'];
      }
      changeGreat(state, 'orhai', -10);
      g.angryUntil = state.turn + 4;
      g.tributeInARow = 0;
      greatRemember(state, 'orhai', `refused them tribute in Year ${year(state)}`, -3);
      return ['You refused the Orhai. Their riders will come more often for a year.'];
    },
  },

  ostraniFleet: {
    choice: true,
    weight: (state) => {
      const g = great(state, 'ostrani');
      return g && g.met && g.relation >= 0 && (state.resources.goods || 0) >= FLEET.goods ? 0.35 : 0;
    },
    start: () => ({}),
    view(state) {
      const coin = fleetCoin(state);
      return {
        title: 'An Ostrani merchant fleet',
        text: `An Ostrani merchant prince has sent word: a fleet is going home with room in its holds, and he will pay ${coin} coin for ${FLEET.goods} goods, more than they usually pay, if you can send them now.`,
        options: [
          { id: 'sell', label: `Sell ${FLEET.goods} goods for ${coin} coin.` },
          { id: 'decline', label: 'Decline politely.' },
        ],
        advice: [['steward', `We have ${state.resources.goods || 0} goods. Coin keeps better than cloth.`]],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'decline') return ['You declined the Ostrani fleet\'s offer. They sailed on.'];
      const coin = fleetCoin(state);
      state.resources.goods -= FLEET.goods;
      state.resources.coin = (state.resources.coin || 0) + coin;
      changeGreat(state, 'ostrani', 3);
      recordDeed(state, 'trades');
      return [`The Ostrani fleet took ${FLEET.goods} goods and paid ${coin} coin.`];
    },
  },

  federation: {
    choice: true,
    weight: (state) => (federationCandidates(state).length ? 0.5 : 0),
    start(state) {
      return { people: pick(state, federationCandidates(state)) };
    },
    view(state, ev) {
      const def = NEIGHBORS[ev.people];
      const nat = nation(state, ev.people);
      return {
        title: `${capital(def.name)} ask to join your nation`,
        text: `After years of alliance, the chiefs of ${def.name} have come to ${state.campName} with a proposal: that their ${nat.population} people join your nation, under your written law, keeping their own chief as their governor.`,
        options: [
          { id: 'welcome', label: 'Welcome them into your nation.' },
          { id: 'notYet', label: 'Not yet. Stay allies a while longer.' },
        ],
        advice: [
          ['speaker', `They would be a settlement of yours, and a loyal one, but they come as a free people: they will not bear heavy demands.`],
          ['steward', 'More hands, more land, and more to feed. They know how to feed themselves.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'notYet') {
        nation(state, ev.people).allianceSince = state.turn - 16; // They will ask again in two years.
        return [`You asked ${NEIGHBORS[ev.people].name} to wait. They will remain your allies, and may ask again.`];
      }
      remember(state, ev.people, `joined your nation in Year ${year(state)}`, 0);
      return [joinNation(state, ev.people)];
    },
  },

  skarnVassal: {
    choice: true,
    weight: (state) => (vassalReady(state) ? 0.6 : 0),
    start: () => ({}),
    view(state) {
      const nat = nation(state, 'skarn');
      return {
        title: 'The Skarn sue for peace',
        text: `Skarn chiefs have come under a white branch. With only ${nat.warriors} warriors left, they offer to become your vassals: to pay you tribute each spring, ${VASSAL_TRIBUTE.food} food and ${VASSAL_TRIBUTE.goods} goods, and keep the peace, if you leave them their hold.`,
        options: [
          { id: 'accept', label: 'Accept them as your vassals.' },
          { id: 'refuse', label: 'Refuse them.' },
        ],
        advice: [
          ['warChief', 'A beaten enemy who pays us is better than one who sulks. But if they grow strong again, they will throw it off.'],
          ['speaker', 'The hill clans are not theirs to command. A vassal\'s peace will not bind them.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'refuse') {
        changeRelation(state, 'skarn', -5);
        return ['You sent the Skarn chiefs away. They will not forget it.'];
      }
      makeVassal(state);
      return [`The Skarn are your vassals. They will pay tribute each spring and keep the peace, and a fifth of their warriors will stand with you when raiders come, for as long as they think you stronger.`];
    },
  },
};

// A great nation met for the first time comes before other events.
export function greatCrisis(state) {
  if (!state.great || !eraAtLeast(state, 'nation')) return null;
  const id = GREAT_ORDER.find((x) => state.great[x].contactPending);
  return id ? { id: 'greatContact', nation: id } : null;
}
