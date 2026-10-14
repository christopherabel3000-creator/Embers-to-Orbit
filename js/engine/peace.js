// Keeping the peace with the Skarn. A lasting peace is not a switch flipped
// once: the Skarn respect strength, and a village that looks weak is warned
// one spring and abandoned the next. Gifts honor the peace for a year. And a
// peace is sworn by a chief: when the chief dies, the successor tests it.

import { SKARN_CHIEFS } from './data.js';
import {
  living, canFight, seasonIndex, year,
} from './state.js';
import { changeRelation } from './neighbors.js';
import {
  nation, nationsActive, remember, skarnArms,
} from './nations.js';
import { skarnApproach } from './siege.js';
import { fighterStrength, RAIDER_STRENGTH } from './battle.js';
import { raidGrowth } from './rules.js';
import { recordDeed } from './legacy.js';
import { chance, randomInt, pick } from './rng.js';
import { clamp } from './util.js';

export const CHIEF_YEARS = [8, 15]; // How long a Skarn chief rules.
export const HONOR_SEASONS = 4; // How long gifts to honor the peace satisfy them.

function skarn(state) {
  return state.neighbors.skarn;
}

export function chiefName(state) {
  return skarn(state).chief || SKARN_CHIEFS[0];
}

// Whether the Skarn think the village weak enough to take, peace or not.
// As a nation, they weigh what nine tenths of their warriors could do
// against its fighters and walls. Before that, they compare its fighters,
// behind any palisade, with the war band they would send.
export function skarnTempted(state) {
  const nat = nation(state, 'skarn');
  if (nat && nationsActive(state)) {
    return skarnApproach(state, Math.round(nat.warriors * 0.9)) !== 'wait';
  }
  const fighters = living(state).filter(canFight).length;
  const cover = state.buildings.palisade > 0 ? 1.5 : 1;
  return fighters * cover < 5.5 + raidGrowth(year(state));
}

// ----- Honoring the peace -----

// The Skarn chiefs expect a share of what the village has: a rich village
// cannot buy their respect cheaply. At least 20 food (10 goods), or their
// warriors' number in food, or a share of the stores, whichever is most.
// Paying year after year looks like weakness, so each year in a row costs
// more: a fifth of the stores, then 35 percent, then half, and so on.
export const HONOR_SHARE = 0.2;
export const HONOR_SHARE_STEP = 0.15;
export function honorCost(state) {
  const nat = nation(state, 'skarn');
  const times = skarn(state).honorsInARow || 0;
  const base = Math.max(20, nat ? nat.warriors : 0) * (1 + times);
  const share = Math.min(0.8, HONOR_SHARE + HONOR_SHARE_STEP * times);
  return {
    food: Math.max(base, Math.round((state.resources.food || 0) * share)),
    goods: Math.max(Math.ceil(base / 2), Math.round((state.resources.goods || 0) * share)),
  };
}

// Honored through the season the gifts run out, so a year's gifts cover the
// next spring's reckoning.
export function honored(state) {
  return (skarn(state).honoredUntil ?? -1) >= state.turn;
}

// Gifts to the Skarn chiefs: a year in which they hold to the peace whatever
// they think of the village's strength. Returns { error } or { message }.
export function honorPeace(state, kind) {
  const sk = skarn(state);
  if (!sk.peace) return { error: 'You are not at peace with the Skarn.' };
  if (honored(state)) return { error: 'The Skarn chiefs are content with your last gifts.' };
  const cost = honorCost(state)[kind];
  if (!cost) return { error: 'Choose food or goods.' };
  if ((state.resources[kind] || 0) < cost) return { error: `The Skarn chiefs expect ${cost} ${kind}, and you have ${state.resources[kind] || 0}.` };
  state.resources[kind] -= cost;
  sk.honoredUntil = state.turn + HONOR_SEASONS;
  sk.honorsInARow = (sk.honorsInARow || 0) + 1;
  sk.peaceWarned = false;
  changeRelation(state, 'skarn', 3);
  return { message: `You sent ${cost} ${kind} to ${chiefName(state)} and the Skarn chiefs. They will hold to the peace for a year, whatever they think of your strength.` };
}

// ----- Breaking the peace -----

export function endPeace(state, reason) {
  const sk = skarn(state);
  sk.peace = false;
  sk.peaceWarned = false;
  sk.honoredUntil = -1;
  sk.honorsInARow = 0;
  sk.truceUntil = Math.max(sk.truceUntil, state.turn + 1); // A season's grace, by custom.
  changeRelation(state, 'skarn', -10);
  if (nation(state, 'skarn')) remember(state, 'skarn', `lost their peace with you in Year ${year(state)}: ${reason}`);
}

// ----- The year: strength, and the chief -----

function nextChief(state) {
  const used = new Set(skarn(state).chiefsSeen || []);
  const fresh = SKARN_CHIEFS.filter((n) => !used.has(n));
  return fresh.length ? pick(state, fresh) : `${pick(state, SKARN_CHIEFS)} the Younger`;
}

// Runs each spring once the Skarn are known. Returns { urgent, events }.
export function peaceYear(state) {
  const out = { urgent: [], events: [] };
  const sk = skarn(state);
  if (!sk.known || seasonIndex(state) !== 0) return out;

  // The old chief dies, and a new one rises.
  if (sk.chiefUntil == null) sk.chiefUntil = state.turn + 4 * randomInt(state, CHIEF_YEARS[0], CHIEF_YEARS[1]);
  if (state.turn >= sk.chiefUntil && !(sk.peace && state.pendingEvent)) {
    const old = chiefName(state);
    const heir = nextChief(state);
    sk.chiefsSeen = [...(sk.chiefsSeen || [old]), heir];
    sk.chief = heir;
    sk.chiefUntil = state.turn + 4 * randomInt(state, CHIEF_YEARS[0], CHIEF_YEARS[1]);
    if (sk.peace) {
      state.pendingEvent = { type: 'story', id: 'skarnChief', old, heir };
      out.urgent.push(`${old}, chief of the Skarn, is dead. The new chief, ${heir}, sends word: the peace was ${old}'s, not theirs. A decision is waiting for you.`);
      return out;
    }
    out.events.push(`${old}, chief of the Skarn, is dead. The Skarn follow ${heir} now.`);
  }

  if (!sk.peace) return out;
  // The Skarn respect strength. A village that looks weak is warned once.
  if (!skarnTempted(state)) sk.honorsInARow = 0; // Strong again: their respect is earned, not bought.
  if (honored(state) || !skarnTempted(state)) {
    if (sk.peaceWarned) out.events.push(`The Skarn chiefs speak of ${state.campName} with respect again. The peace is safe, for now.`);
    sk.peaceWarned = false;
    return out;
  }
  if (!sk.peaceWarned) {
    sk.peaceWarned = true;
    out.urgent.push(`The Skarn chiefs have begun to mock ${state.campName} as weak. If they still think so next spring, they will cast the peace aside. More fighters, guards, or walls would change their minds, or gifts to honor the peace on the Neighbors screen.`);
    return out;
  }
  endPeace(state, 'they thought you weak');
  out.urgent.push(`The Skarn have cast the peace aside: ${chiefName(state)} says a people too weak to defend itself has no right to the Skarn's word. Their raiders may come after this season.`);
  return out;
}

// ----- The new chief's test -----

// Your best fighter, and the champion the Skarn would send.
export function contestants(state) {
  const best = living(state).filter((p) => canFight(p) && p.age >= 16)
    .sort((a, b) => fighterStrength(state, b) - fighterStrength(state, a))[0] || null;
  const champion = RAIDER_STRENGTH * 1.5 * (nation(state, 'skarn') ? skarnArms(state) : 1);
  return { best, champion };
}

export function contestOdds(state) {
  const { best, champion } = contestants(state);
  if (!best) return 0;
  const ours = fighterStrength(state, best) ** 2;
  return ours / (ours + champion ** 2);
}

// A new chief expects more: twice the warriors' number in food, or a
// quarter of the stores, whichever is more.
export const CHIEF_SHARE = 0.25;
export function chiefGiftCost(state) {
  const nat = nation(state, 'skarn');
  const base = Math.max(30, nat ? nat.warriors * 2 : 0);
  return {
    food: Math.max(base, Math.round((state.resources.food || 0) * CHIEF_SHARE)),
    goods: Math.max(Math.ceil(base / 2), Math.round((state.resources.goods || 0) * CHIEF_SHARE)),
  };
}

export const SKARN_CHIEF_EVENT = {
  skarnChief: {
    choice: true,
    weight: () => 0, // Only started by the Skarn chief's death.
    view(state, ev) {
      const cost = chiefGiftCost(state);
      const { best } = contestants(state);
      const odds = Math.round(contestOdds(state) * 100);
      const options = [];
      if (state.resources.food >= cost.food) options.push({ id: 'food', label: `Renew the peace with gifts: ${cost.food} food.` });
      if ((state.resources.goods || 0) >= cost.goods) options.push({ id: 'goods', label: `Renew the peace with gifts: ${cost.goods} goods.` });
      if (best) options.push({ id: 'contest', label: `Send ${best.name} to face their champion. About ${odds} in 100 to win.` });
      options.push({ id: 'refuse', label: 'Refuse. The Skarn can have peace or war, as they choose.' });
      return {
        title: 'A new Skarn chief',
        text: `${ev.heir} now leads the Skarn, and is not bound by ${ev.old}'s word. The young chief asks what the peace is worth to you: gifts, or a contest of champions, as the Skarn did in the old days.`,
        options,
        advice: [
          ['speaker', 'Gifts are the sure way. The Skarn will think us generous, or soft.'],
          ['warChief', best ? `${best.name} is our best. ${odds >= 60 ? 'I would back them.' : odds >= 40 ? 'It could go either way.' : 'Their champion is stronger. I would not risk it.'} A win would earn the Skarn's respect.` : 'We have no one fit to fight.'],
        ],
      };
    },
    resolve(state, ev, choice) {
      const sk = skarn(state);
      if (!sk.peace) return ['The matter settled itself.'];
      const cost = chiefGiftCost(state);
      if ((choice === 'food' || choice === 'goods') && (state.resources[choice] || 0) >= cost[choice]) {
        state.resources[choice] -= cost[choice];
        changeRelation(state, 'skarn', 5);
        sk.peaceWarned = false;
        return [`You sent ${cost[choice]} ${choice} to ${ev.heir}. The new chief swore to keep the peace.`];
      }
      if (choice === 'contest') {
        const { best } = contestants(state);
        if (best && chance(state, contestOdds(state))) {
          changeRelation(state, 'skarn', 10);
          recordDeed(state, 'battlesWon');
          sk.peaceWarned = false;
          sk.honoredUntil = state.turn + HONOR_SEASONS;
          return [`${best.name} faced the Skarn champion before both peoples, and won. ${ev.heir} swore to keep the peace, and the Skarn speak of ${best.name} with respect.`];
        }
        if (best) best.health = clamp(best.health - randomInt(state, 30, 50));
        endPeace(state, `their champion beat yours`);
        return [`${best ? `${best.name} fell to the Skarn champion and was carried home badly hurt.` : 'No one stood for you.'} ${ev.heir} laughed, and cast the peace aside. Their raiders may come after this season.`];
      }
      endPeace(state, 'you refused their new chief');
      return [`You refused ${ev.heir}. The peace is over. Their raiders may come after this season.`];
    },
  },
};

export function peaceStatus(state) {
  const sk = skarn(state);
  if (!sk.peace) return '';
  if (honored(state)) {
    const left = Math.max(1, sk.honoredUntil - state.turn);
    return `Your gifts keep ${chiefName(state)} content: the Skarn will hold to the peace for ${left} more ${left === 1 ? 'season' : 'seasons'}, whatever they think of your strength.`;
  }
  if (sk.peaceWarned) return `The Skarn mock you as weak. Unless they think better of you by spring, ${chiefName(state)} will cast the peace aside. More fighters, guards, or walls, or gifts to honor the peace, would help.`;
  return `${chiefName(state)} holds to the peace while the Skarn respect your strength.`;
}

