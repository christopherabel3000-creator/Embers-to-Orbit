// Envoys the great nations send to you, about once a year across all seven:
// offers of treaties and marriage, requests for help in their wars (and an
// ally's call to arms), tribute demands from the raiding peoples, demands
// to stop trading with their enemy, and claims on a settlement in their
// lands. Each is a decision, like the valley peoples' offers. Ultimatums,
// which come before a war on you, are in greatWar.js.

import { GREAT_NATIONS, GREAT_TREATIES } from './greatData.js';
import { REGIONS } from './worldData.js';
import { placeRegion } from './data.js';
import { year, placeName } from './state.js';
import {
  great, changeGreat, greatRemember, metGreat, WAR_AID, inRaidReach, townsInTheirLands,
} from './great.js';
import { warOf, enemiesOf, shiftWar, feeling as feelingOf } from './greatWorld.js';
import { atWar, armyHolding } from './warStatus.js';
import { fortresses } from './realm.js';
import { reputation, recordDeed } from './legacy.js';
import { refreshAdvisors } from './advisors.js';
import { randomInt } from './rng.js';
import { capital, clamp } from './util.js';
import {
  declareWar, warBlocker, ultimatumReady, declareThreshold,
} from './war.js';

export const ENVOY_GAP = [2, 4]; // Seasons between envoys, from any of them.
const CLAIM_GAP = 12; // Seasons before the same people claims again.
const DEMAND_GAP = 8;

const WEIGHTS = {
  help: 3, offer: 2, tribute: 2, stopTrade: 2, claim: 1.5,
};

function nameOf(state, id) {
  const g = great(state, id);
  return g && (g.met || g.heard) ? GREAT_NATIONS[id].name : 'a people you have not met';
}

// What they would offer you: a treaty they would sign, or a marriage.
function offerFor(state, id) {
  const g = great(state, id);
  if (!g.embassy || g.relation < 25) return null;
  for (const key of ['trade', 'peace', 'alliance']) {
    const t = GREAT_TREATIES[key];
    if (!t.with.includes(id) || g.treaties[key]) continue;
    if (g.relation >= t.relation - 10 && g.trust >= t.trust - 10) return `treaty:${key}`;
  }
  if (!g.married && g.relation >= 35) return 'marry';
  return null;
}

export { townsInTheirLands };

function tributeFor(state, id) {
  const g = great(state, id);
  return Math.round(15 * 1.25 ** Math.min(4, g.tributeInARow || 0));
}

function strongAgainst(state, id) {
  const reach = GREAT_NATIONS[id].raids ? GREAT_NATIONS[id].raids.reach : [];
  return reputation(state).fierce >= 15 || reach.some((r) => armyHolding(state, r))
    || fortresses(state).some((t) => reach.includes(placeRegion(t.place)));
}

// Every envoy that could come now: [{ nation, kind, ...details, weight }].
export function possibleEnvoys(state) {
  const out = [];
  for (const id of metGreat(state)) {
    const g = great(state, id);
    if (atWar(state, id)) continue;
    const war = warOf(state, id);
    if (war) {
      const enemy = enemiesOf(state, id)[0];
      if (g.relation >= 20 || g.treaties.alliance) out.push({ nation: id, kind: 'help', enemy });
      const traded = enemiesOf(state, id).find((x) => great(state, x).met && (great(state, x).route || great(state, x).treaties.trade));
      if (traded && g.relation >= -20 && state.turn - (g.lastStopDemand ?? -99) >= DEMAND_GAP) out.push({ nation: id, kind: 'stopTrade', enemy: traded });
    }
    const offer = offerFor(state, id);
    if (offer) out.push({ nation: id, kind: 'offer', offer });
    const def = GREAT_NATIONS[id];
    if (def.raids && !g.treaties.peace && !g.pulledBack && g.relation < 0 && g.paidUntil <= state.turn
      && state.turn - (g.lastDemand ?? -99) >= DEMAND_GAP && (state.settlements || []).some((t) => inRaidReach(state, id, t))) {
      out.push({ nation: id, kind: 'tribute', coin: tributeFor(state, id) });
    }
    const claimed = townsInTheirLands(state, id);
    if (claimed.length && (g.strength || 0) >= 40 && g.relation < 10 && state.turn - (g.lastClaim ?? -99) >= CLAIM_GAP) {
      const t = claimed.sort((a, b) => b.population - a.population)[0];
      out.push({ nation: id, kind: 'claim', town: t.id, coin: 3 * t.population });
    }
  }
  return out.map((e) => ({ ...e, weight: WEIGHTS[e.kind] }));
}

// Called before ordinary events each season: an envoy, when one is due.
// Returns the pending event to start, or null.
// The terms of an ultimatum: coin, a settlement in their lands if they claim
// one, and an end to an alliance with a people they hate.
export function ultimatumTerms(state, id) {
  const g = great(state, id);
  const towns = townsInTheirLands(state, id).sort((a, b) => b.population - a.population);
  const ally = metGreat(state).find((x) => x !== id && great(state, x).treaties.alliance && (enemiesOf(state, id).includes(x) || feelingOf(state, id, x) <= -30));
  return { coin: Math.round(20 + (g.strength || 0) * 0.6), town: towns.length ? towns[0].id : null, ally: ally || null };
}

export function envoyCrisis(state) {
  if (!state.greatWorld || state.nationFounded == null) return null;
  const w = state.greatWorld;
  // An ultimatum comes before anything else, whatever the season.
  const angry = metGreat(state).find((id) => ultimatumReady(state, id));
  if (angry) {
    great(state, angry).lastUltimatum = state.turn;
    w.ultimatums = (w.ultimatums || 0) + 1;
    return {
      type: 'story', id: 'greatEnvoy', nation: angry, kind: 'ultimatum', ...ultimatumTerms(state, angry),
    };
  }
  if (w.nextEnvoy == null) w.nextEnvoy = state.turn + randomInt(state, ...ENVOY_GAP);
  if (state.turn < w.nextEnvoy) return null;
  const options = possibleEnvoys(state);
  if (!options.length) {
    w.nextEnvoy = state.turn + 1;
    return null;
  }
  const total = options.reduce((sum, e) => sum + e.weight, 0);
  let roll = randomInt(state, 0, 9999) / 10000 * total;
  let chosen = options[options.length - 1];
  for (const e of options) {
    roll -= e.weight;
    if (roll < 0) { chosen = e; break; }
  }
  w.nextEnvoy = state.turn + randomInt(state, ...ENVOY_GAP);
  w.envoys = (w.envoys || 0) + 1;
  const g = great(state, chosen.nation);
  if (chosen.kind === 'tribute') g.lastDemand = state.turn;
  if (chosen.kind === 'stopTrade') g.lastStopDemand = state.turn;
  if (chosen.kind === 'claim') g.lastClaim = state.turn;
  const { weight, ...ev } = chosen;
  return { type: 'story', id: 'greatEnvoy', ...ev };
}

// The best aid you can send: coin, else goods, else iron. [res, n] or null.
function aidYouCanSend(state) {
  return Object.entries(WAR_AID).find(([res, n]) => (state.resources[res] || 0) >= n) || null;
}

function give(state, t) {
  // The settlement is theirs now; its governor and notable people come home.
  state.settlements = state.settlements.filter((x) => x !== t);
  for (const p of [t.governor, ...(t.notables || [])].filter(Boolean)) state.people.push({ ...p, task: 'rest', orderReturn: null });
  refreshAdvisors(state);
}

export const GREAT_ENVOY_EVENT = {
  greatEnvoy: {
    choice: true,
    weight: () => 0, // Envoys come on their own schedule, not as chance events.
    start: () => ({}),
    view(state, ev) {
      const id = ev.nation;
      const def = GREAT_NATIONS[id];
      const g = great(state, id);
      const who = capital(def.name);
      const title = `An envoy from ${def.name}`;
      if (ev.kind === 'offer') {
        const treaty = ev.offer.startsWith('treaty:') ? GREAT_TREATIES[ev.offer.slice(7)] : null;
        return {
          title,
          text: treaty
            ? `${who} have sent an envoy to ${state.campName}, offering ${treaty.phrase}. ${treaty.effect}`
            : `${who} have sent an envoy to ${state.campName}, offering a marriage between your ruling families. They would count you as kin.`,
          options: [
            { id: 'accept', label: treaty ? `Agree to ${treaty.phrase}.` : 'Agree to the marriage.' },
            { id: 'decline', label: 'Decline politely. They will take it as a small slight.' },
          ],
          advice: [['speaker', `They think well of us (relations ${g.relation}, trust ${g.trust}). It costs us nothing to accept.`]],
        };
      }
      if (ev.kind === 'help') {
        const enemy = nameOf(state, ev.enemy);
        const aid = aidYouCanSend(state);
        const ally = Boolean(g.treaties.alliance);
        const options = [];
        if (aid) options.push({ id: 'aid', label: `Send them ${aid[1]} ${aid[0]} for their war.` });
        options.push({ id: 'stay', label: ally ? 'Stay out of it. They are your allies, and will not forget it.' : 'Stay out of it, politely.' });
        if (ally && great(state, ev.enemy) && great(state, ev.enemy).met && !atWar(state, ev.enemy)) options.push({ id: 'join', label: `Join their war on ${enemy}, as your alliance asks.` });
        return {
          title,
          text: `${who} are at war with ${enemy}, and ask ${ally ? 'you, their allies, to stand with them' : 'for your help'}.`,
          options,
          advice: [
            ['speaker', ally ? 'An ally who is refused remembers it. Helping them, or fighting beside them, keeps their trust.' : `Help would win their thanks, and cost us the goodwill of ${enemy}.`],
            ['warChief', 'Joining a war of the great nations means their hosts may come against our settlements in their reach.'],
          ],
        };
      }
      if (ev.kind === 'tribute') {
        const strong = strongAgainst(state, id);
        const options = [];
        if ((state.resources.coin || 0) >= ev.coin) options.push({ id: 'pay', label: `Pay ${ev.coin} coin, and their raiders stay away for a year.` });
        if (strong && (state.resources.coin || 0) >= Math.ceil(ev.coin / 2)) options.push({ id: 'bargain', label: `Show them your strength, and pay half, ${Math.ceil(ev.coin / 2)} coin.` });
        options.push({ id: 'refuse', label: 'Refuse. Their raiders will come more often for a year.' });
        return {
          title,
          text: `${who} demand tribute: ${ev.coin} coin, or their raiders will fall on your settlements within their reach.`,
          options,
          advice: [
            ['speaker', 'Tribute buys a year of quiet, and each year they will ask for more. A peace pact would end it.'],
            ['warChief', strong ? 'They know we can fight: we can bargain.' : 'Our settlements within their reach have little to stand behind.'],
          ],
        };
      }
      if (ev.kind === 'stopTrade') {
        const enemy = nameOf(state, ev.enemy);
        return {
          title,
          text: `${who}, at war with ${enemy}, demand that you stop trading with them: no trade route and no trade pact while they fight.`,
          options: [
            { id: 'refuse', label: `Refuse. ${who} will think less of you.` },
            { id: 'agree', label: `Agree. Your trade route and any trade pact with ${enemy} end, and ${enemy} will think less of you.` },
          ],
          advice: [['speaker', `Our trade with ${enemy} is worth coin every season. ${who} cannot make us, but they will remember.`]],
        };
      }
      if (ev.kind === 'claim') {
        const t = (state.settlements || []).find((x) => x.id === ev.town);
        const where = t ? placeName(state, t.place) : 'the settlement';
        const options = [];
        if ((state.resources.coin || 0) >= ev.coin) options.push({ id: 'pay', label: `Pay them ${ev.coin} coin to drop the claim.` });
        options.push({ id: 'refuse', label: 'Refuse. The land is yours. They will think much less of you.' });
        options.push({ id: 'cede', label: `Give ${t ? t.name : 'it'} up to them. Its ${t ? t.population : 'few'} people become theirs; its governor and notable people come home.` });
        return {
          title,
          text: `${who} claim ${t ? `${t.name}, at ${where} in ${REGIONS[placeRegion(t.place)].name.toLowerCase()},` : 'your settlement'} as their own land.`,
          options,
          advice: [
            ['speaker', `They are strong (about ${Math.round(g.strength || 0)} under arms) and think little of us (relations ${g.relation}). A refusal will push them toward war.`],
            ['warChief', 'If it comes to war, their hosts can reach that settlement.'],
          ],
        };
      }
      if (ev.kind === 'ultimatum') {
        const t = ev.town != null ? (state.settlements || []).find((x) => x.id === ev.town) : null;
        const options = [];
        if ((state.resources.coin || 0) >= ev.coin) options.push({ id: 'pay', label: `Pay them ${ev.coin} coin.` });
        if (t) options.push({ id: 'cede', label: `Give ${t.name} up to them. Its ${t.population} people become theirs; its governor and notable people come home.` });
        if (ev.ally && great(state, ev.ally).treaties.alliance) options.push({ id: 'breakAlliance', label: `End your alliance with ${GREAT_NATIONS[ev.ally].name}, who will not forgive it.` });
        options.push({ id: 'refuse', label: 'Refuse. They will declare war on you next season.' });
        return {
          title: `An ultimatum from ${def.name}`,
          text: `${who} have lost patience with you (relations ${g.relation}). Their envoy brings terms: ${ev.coin} coin${t ? `, or ${t.name}` : ''}${ev.ally ? `, or an end to your alliance with ${GREAT_NATIONS[ev.ally].name}` : ''}. Meet one, or they will declare war next season.`,
          options,
          advice: [
            ['speaker', `They have about ${Math.round(g.strength || 0)} under arms. Meeting their terms would turn them from war, for now; gifts and treaties would keep them from coming back.`],
            ['warChief', `${['orhai', 'dravan', 'ashani', 'venn'].includes(id) ? 'At war, they could march a great host into the valley, against the capital itself. ' : 'At war, their ships would raid our settlements on the coast and the lakes. '}Their hosts would strike our settlements within their reach.`],
          ],
        };
      }
      return { title, text: `${who} have sent an envoy.`, options: [{ id: 'decline', label: 'Send them home.' }], advice: [] };
    },
    resolve(state, ev, choice) {
      const id = ev.nation;
      const def = GREAT_NATIONS[id];
      const g = great(state, id);
      const who = capital(def.name);
      const when = `in Year ${year(state)}`;
      if (ev.kind === 'offer') {
        if (choice === 'decline') {
          changeGreat(state, id, -3);
          return [`You declined ${def.name}'s offer. They took it as a small slight.`];
        }
        if (ev.offer === 'marry') {
          g.married = true;
          changeGreat(state, id, 15);
          greatRemember(state, id, `married into their ruling family ${when}`, 15);
          return [`A marriage joins your ruling family to ${def.name}'s. They count you as kin now.`];
        }
        const key = ev.offer.slice(7);
        g.treaties[key] = true;
        changeGreat(state, id, 3);
        greatRemember(state, id, `agreed to ${GREAT_TREATIES[key].phrase} ${when}`, 2);
        return [`You agreed to ${GREAT_TREATIES[key].phrase} with ${def.name}. ${GREAT_TREATIES[key].effect}`];
      }
      if (ev.kind === 'help') {
        if (choice === 'aid') {
          const [res, n] = aidYouCanSend(state);
          state.resources[res] -= n;
          g.lastWarAid = state.turn;
          changeGreat(state, id, 8);
          g.trust = clamp(g.trust + 3);
          shiftWar(state, id, 12);
          for (const x of enemiesOf(state, id)) if (great(state, x).met) changeGreat(state, x, -6);
          greatRemember(state, id, `helped them in their war ${when}`, 0);
          recordDeed(state, 'gifts');
          return [`${who} took your ${n} ${res} for their war, and think better of you. Their enemies have heard of it.`];
        }
        if (choice === 'join') return [joinAllysWar(state, id, ev.enemy)];
        if (g.treaties.alliance) {
          changeGreat(state, id, -10);
          greatRemember(state, id, `would not stand with them in their war ${when}`, -15);
          return [`You stayed out of ${def.name}'s war. Your allies will not forget it: their trust in you has fallen.`];
        }
        changeGreat(state, id, -2);
        return [`You stayed out of ${def.name}'s war.`];
      }
      if (ev.kind === 'tribute') {
        if (choice === 'pay' || choice === 'bargain') {
          const coin = choice === 'pay' ? ev.coin : Math.ceil(ev.coin / 2);
          state.resources.coin -= coin;
          g.paidUntil = state.turn + 4;
          g.tributeInARow = (g.tributeInARow || 0) + 1;
          changeGreat(state, id, choice === 'pay' ? 5 : 2);
          return [`You paid ${def.name} ${coin} coin. Their raiders will leave your settlements alone for a year${choice === 'bargain' ? '; they took half, and respect you for it' : ''}.`];
        }
        changeGreat(state, id, -10);
        g.angryUntil = state.turn + 4;
        g.tributeInARow = 0;
        greatRemember(state, id, `refused them tribute ${when}`, -3);
        return [`You refused ${def.name}. Their raiders will come more often for a year.`];
      }
      if (ev.kind === 'stopTrade') {
        const other = great(state, ev.enemy);
        if (choice === 'agree') {
          other.route = false;
          other.treaties.trade = false;
          changeGreat(state, ev.enemy, -10);
          greatRemember(state, ev.enemy, `stopped trading with them at the word of ${def.name} ${when}`, -5);
          changeGreat(state, id, 10);
          return [`Your trade with ${GREAT_NATIONS[ev.enemy].name} has stopped. ${who} are pleased; ${GREAT_NATIONS[ev.enemy].name} are not.`];
        }
        changeGreat(state, id, -10);
        g.trust = clamp(g.trust - 5);
        return [`You told ${def.name} you will trade with whom you please. They will remember it.`];
      }
      if (ev.kind === 'claim') {
        const t = (state.settlements || []).find((x) => x.id === ev.town);
        if (choice === 'pay') {
          state.resources.coin -= ev.coin;
          changeGreat(state, id, 5);
          return [`You paid ${def.name} ${ev.coin} coin, and they dropped their claim on ${t ? t.name : 'the settlement'}.`];
        }
        if (choice === 'cede' && t) {
          give(state, t);
          changeGreat(state, id, 20);
          greatRemember(state, id, `gave them ${t.name} ${when}`, 5);
          return [`You gave ${t.name} up to ${def.name}. Its governor and notable people have come home to ${state.campName}. ${who} think you reasonable.`];
        }
        changeGreat(state, id, -15);
        greatRemember(state, id, `refused their claim to ${t ? t.name : 'a settlement'} ${when}`, -5);
        return [`You refused ${def.name}'s claim. They think much less of you now.`];
      }
      if (ev.kind === 'ultimatum') {
        const calm = declareThreshold(state, id) + 20;
        if (choice === 'pay') {
          state.resources.coin -= ev.coin;
          g.relation = Math.max(g.relation, calm);
          greatRemember(state, id, `bowed to their ultimatum ${when}`, 0);
          return [`You paid ${def.name} ${ev.coin} coin. They have turned from war, for now.`];
        }
        if (choice === 'cede') {
          const t = (state.settlements || []).find((x) => x.id === ev.town);
          if (t) give(state, t);
          g.relation = Math.max(g.relation, calm + 5);
          greatRemember(state, id, `gave them ${t ? t.name : 'a settlement'} ${when}`, 5);
          return [`You gave ${t ? t.name : 'the settlement'} up to ${def.name}. Its governor and notable people have come home. They have turned from war, for now.`];
        }
        if (choice === 'breakAlliance' && ev.ally) {
          const ag = great(state, ev.ally);
          ag.treaties.alliance = false;
          changeGreat(state, ev.ally, -20);
          ag.trust = clamp(ag.trust - 20);
          greatRemember(state, ev.ally, `broke their alliance with them at the word of ${def.name} ${when}`, 0);
          g.relation = Math.max(g.relation, calm);
          return [`You ended your alliance with ${GREAT_NATIONS[ev.ally].name}. ${who} have turned from war; ${GREAT_NATIONS[ev.ally].name} will not forget it.`];
        }
        g.warComing = state.turn + 1;
        changeGreat(state, id, -5);
        return [`You refused ${def.name}'s ultimatum. They will declare war next season: ready your armies and your walls.`];
      }
      return [`You sent ${def.name}'s envoy home.`];
    },
  },
};

// Answering an ally's call: war on their enemy, for your alliance. Returns a line.
function joinAllysWar(state, ally, enemy) {
  const why = warBlocker(state, enemy);
  if (why) return `You could not join ${GREAT_NATIONS[ally].name}'s war: ${why}`;
  const r = declareWar(state, { foe: enemy });
  if (r.error) return `You could not join ${GREAT_NATIONS[ally].name}'s war: ${r.error}`;
  changeGreat(state, ally, 10);
  greatRemember(state, ally, `stood with them in their war in Year ${year(state)}`, 10);
  return `${r.message} ${capital(GREAT_NATIONS[ally].name)}, your allies, are grateful.`;
}

// The speaker's openings among the great nations: a chance to mediate.
export function envoyAdvice(state) {
  const out = [];
  for (const id of metGreat(state)) {
    const war = warOf(state, id);
    if (!war || war.sideA[0] !== id) continue; // Once per war.
    const other = enemiesOf(state, id)[0];
    if (!great(state, other).met) continue;
    out.push(`${capital(GREAT_NATIONS[id].name)} and ${GREAT_NATIONS[other].name} are at war. ${great(state, id).embassy && great(state, other).embassy ? 'With embassies in both, our envoys could try to make peace between them, from the Neighbors screen.' : 'With embassies in both, our envoys could try to make peace between them.'} Iron, horses, and food fetch more from a people at war.`);
  }
  return out;
}

