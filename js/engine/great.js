// The great nations beyond the valley: the Ostrani, merchant princes of the
// delta, and the Orhai, riders of the far steppe. Word of them comes when
// the Nation era begins; they are met when an expedition reaches their
// homeland (or, for the Orhai, when their riders find you first). Then
// there are envoys, trade for coin, embassies and treaties, marriages
// between ruling families, trade routes, and, with the Orhai, raids on the
// settlements nearest them and demands for tribute.

import {
  GREAT_NATIONS, GREAT_ORDER, TRADE_LOTS, TRADES_BY, GREAT_TREATIES, initialGreat,
} from './greatData.js';
import { REGIONS, WORLD_PLACES } from './worldData.js';
import { placeRegion } from './data.js';
import { hasKnowledge, year, seasonIndex } from './state.js';
import { recordDeed, reputation } from './legacy.js';
import { lawIs } from './laws.js';
import { raidScale } from './difficulty.js';
import { atWar, armyHolding, homeBesieged } from './warStatus.js';
import { chance, randomInt, randomBetween } from './rng.js';
import { clamp, capital, listWords } from './util.js';

export { initialGreat };

export function great(state, id) {
  return state.great ? state.great[id] : null;
}

export function greatMet(state, id) {
  const g = great(state, id);
  return Boolean(g && g.met);
}

export function metGreat(state) {
  return GREAT_ORDER.filter((id) => greatMet(state, id));
}

// When the Nation era begins, rumors of them reach the capital. Returns lines.
export function hearOfGreat(state) {
  if (!state.great) state.great = initialGreat();
  const lines = [];
  for (const id of GREAT_ORDER) {
    if (state.great[id].heard) continue;
    state.great[id].heard = true;
    lines.push(GREAT_NATIONS[id].rumor);
  }
  return lines;
}

// An expedition has reached their homeland, or their riders found you:
// first contact is a choice (greatEvents.js).
export function meetGreat(state, id) {
  const g = great(state, id);
  if (!g || g.met) return;
  g.heard = true;
  g.contactPending = true;
}

export function greatRemember(state, id, text, trustChange = 0) {
  const g = great(state, id);
  g.memory.push(text);
  if (g.memory.length > 6) g.memory.shift();
  g.trust = clamp(g.trust + trustChange);
}

export function changeGreat(state, id, delta) {
  const g = great(state, id);
  g.relation = Math.max(-100, Math.min(100, Math.round(g.relation + delta)));
}

// Where their attitude drifts, and why: [text, shift] pairs.
export function greatRegard(state, id) {
  const g = great(state, id);
  const def = GREAT_NATIONS[id];
  const rep = reputation(state);
  const reasons = [];
  const add = (text, n) => { if (n) reasons.push([text, Math.round(n)]); };
  if (def.likes.trader) add('your name as honest traders', rep.traders * def.likes.trader / 3);
  if (def.likes.fierce) add('your name as fierce fighters', rep.fierce * def.likes.fierce / 3);
  if (def.likes.generous) add('your name for generosity', rep.generous * def.likes.generous / 3);
  add('your embassy', g.embassy ? 10 : 0);
  add('the trade pact', g.treaties.trade ? 5 : 0);
  add('the peace pact', g.treaties.peace ? 5 : 0);
  add('the marriage between your ruling families', g.married ? 10 : 0);
  add('the trade route', g.route ? 5 : 0);
  add('your welcome to all gods', lawIs(state, 'worship', 'manyGods') ? 5 : 0);
  add('their trust in you', Math.round((g.trust - 50) / 5));
  return reasons;
}

export function greatTarget(state, id) {
  return GREAT_NATIONS[id].baseline + greatRegard(state, id).reduce((sum, [, n]) => sum + n, 0);
}

// Each season their relations drift toward their nature and your record;
// each year a treaty is kept adds to their trust.
export function greatSeason(state) {
  if (!state.great) return;
  if (seasonIndex(state) === 0 && state.nationFounded != null) {
    for (const id of GREAT_ORDER) {
      const g = great(state, id);
      const target = greatStrengthTarget(state, id);
      const now = g.strength ?? target;
      if (now < target) g.strength = Math.min(target, now + Math.max(4, Math.round((target - now) * 0.25)));
    }
  }
  for (const id of metGreat(state)) {
    const g = great(state, id);
    const target = greatTarget(state, id);
    if (g.relation < target) g.relation = Math.min(target, g.relation + 2);
    else if (g.relation > target) g.relation = Math.max(target, g.relation - 2);
    if (seasonIndex(state) === 0 && Object.values(g.treaties).some(Boolean)) g.trust = clamp(g.trust + 2);
  }
}

// The riders or soldiers they keep under arms, which they make good each
// spring: the Orhai grow in number, and the Ostrani hire more in a war.
export function greatStrengthTarget(state, id) {
  const years = Math.max(0, state.turn - (state.nationFounded ?? state.turn)) / 4;
  if (id === 'orhai') return Math.round(Math.min(100, 50 + 4 * years) * raidScale(state));
  return Math.round(Math.min(60, 30 + 2 * years) * (atWar(state, id) ? 1.5 : 1));
}

// ----- Trade -----

// Their galleys come to a settlement of yours on the coast.
export function coastHarbor(state) {
  return (state.settlements || []).some((t) => WORLD_PLACES[t.place] && WORLD_PLACES[t.place].region === 'coast');
}

// How good a trade with them is, as a multiplier on what you get.
export function tradeFactor(state, id) {
  const g = great(state, id);
  let f = 1 + g.relation / 200;
  if (g.treaties.trade) f *= 1.25;
  if (hasKnowledge(state, 'measures')) f *= 1.25;
  if (hasKnowledge(state, 'freeMarkets')) f *= (state.marketMood || 1);
  if (id === 'ostrani' && coastHarbor(state)) f *= 1.1;
  if (g.quay) f *= 1.2;
  return f;
}

// What a trade would give or cost, now: { give, giveAmount, get, getAmount }.
export function tradeTerms(state, id, lotId) {
  const lot = TRADE_LOTS[lotId];
  const f = tradeFactor(state, id);
  if (lot.give) {
    const fine = lotId === 'sellFine';
    return { give: lot.give, giveAmount: lot.amount, get: 'coin', getAmount: Math.max(1, Math.round(lot.coin * f)), fine };
  }
  return { give: 'coin', giveAmount: Math.max(1, Math.round(lot.coin / f)), get: lot.get, getAmount: lot.amount };
}

export function tradesWith(state, id) {
  const g = great(state, id);
  if (!g || !g.met || atWar(state, id)) return [];
  if (id === 'orhai' && !g.treaties.peace) return [];
  return TRADES_BY[id].filter((lotId) => !TRADE_LOTS[lotId].needs || hasKnowledge(state, TRADE_LOTS[lotId].needs))
    .filter((lotId) => !(lotId === 'sellGoods' && hasKnowledge(state, 'fineCrafts') && TRADES_BY[id].includes('sellFine')));
}

// ----- Envoys -----

export const EMBASSY_COST = { goods: 20, coin: 10 };
export const ROUTE_COST = { goods: 20, coin: 10 };
export const GIFT_GOODS = 10;

function short(state, cost) {
  return Object.entries(cost).filter(([k, n]) => (state.resources[k] || 0) < n).map(([k, n]) => `${n - (state.resources[k] || 0)} ${k}`);
}

function costWords(cost) {
  return listWords(Object.entries(cost).map(([k, n]) => `${n} ${k}`));
}

// What an envoy to them could do now: [{ act, label, why }] with why null when possible.
export function greatActs(state, id) {
  const g = great(state, id);
  if (!g || !g.met || atWar(state, id)) return [];
  const acts = [];
  for (const lotId of tradesWith(state, id)) {
    const t = tradeTerms(state, id, lotId);
    const label = `${TRADE_LOTS[lotId].label} for ${t.give === 'coin' ? t.giveAmount : t.getAmount} coin`;
    const have = state.resources[t.give] || 0;
    acts.push({ act: lotId, label, why: have < t.giveAmount ? `You have ${have} ${t.give}.` : null });
  }
  acts.push({ act: 'gift', label: `Send a gift of ${GIFT_GOODS} goods`, why: (state.resources.goods || 0) < GIFT_GOODS ? 'You need 10 goods.' : null });
  if (id === 'orhai' && !g.treaties.peace) {
    const cost = tributeCost(state);
    acts.push({ act: 'tribute', label: `Pay tribute of ${cost} coin, so their riders stay away for a year`, why: g.paidUntil > state.turn ? 'Your tribute already keeps them away.' : (state.resources.coin || 0) < cost ? `You have ${state.resources.coin || 0} coin.` : null });
  }
  if (!g.embassy) {
    acts.push({ act: 'embassy', label: `Open an embassy in their land, for ${costWords(EMBASSY_COST)}`, why: !hasKnowledge(state, 'diplomacy') ? 'Your people must learn Diplomacy first.' : short(state, EMBASSY_COST).length ? `You are short of ${listWords(short(state, EMBASSY_COST))}.` : null });
  }
  for (const [key, t] of Object.entries(GREAT_TREATIES)) {
    if (!t.with.includes(id) || g.treaties[key]) continue;
    const why = !g.embassy ? 'Treaties need an embassy.' : g.relation < t.relation ? `Relations must be at least ${t.relation}.` : g.trust < t.trust ? `They need to trust you more (${g.trust} of ${t.trust}).` : null;
    acts.push({ act: `treaty:${key}`, label: `Propose ${t.phrase}`, why });
  }
  if (!g.married) acts.push({ act: 'marry', label: 'Propose a marriage between your ruling families', why: !g.embassy ? 'That needs an embassy.' : g.relation < 40 ? 'Relations must be at least 40.' : null });
  if (!g.route) {
    acts.push({ act: 'route', label: `Set up a trade route to them, for ${costWords(ROUTE_COST)}`, why: !hasKnowledge(state, 'tradeRoutes') ? 'Your people must learn Trade routes first.' : id === 'orhai' && !g.treaties.peace ? 'The Orhai will only trade under a peace pact.' : g.relation < 10 ? 'Relations must be at least 10.' : short(state, ROUTE_COST).length ? `You are short of ${listWords(short(state, ROUTE_COST))}.` : null });
  }
  return acts;
}

function pay(state, cost) {
  for (const [k, n] of Object.entries(cost)) state.resources[k] = (state.resources[k] || 0) - n;
}

// Sends an envoy. Returns { error } or { message }.
export function greatDiplomacy(state, id, act) {
  const g = great(state, id);
  const def = GREAT_NATIONS[id];
  if (!g || !g.met) return { error: 'Your people have not met them.' };
  if (g.lastEnvoy === state.turn) return { error: `You have already sent an envoy to ${def.name} this season.` };
  const option = greatActs(state, id).find((a) => a.act === act);
  if (!option) return { error: 'That is not possible with them.' };
  if (option.why) return { error: option.why };
  g.lastEnvoy = state.turn;
  const who = capital(def.name);
  if (TRADE_LOTS[act]) {
    const t = tradeTerms(state, id, act);
    state.resources[t.give] -= t.giveAmount;
    state.resources[t.get] = (state.resources[t.get] || 0) + t.getAmount;
    recordDeed(state, 'trades');
    changeGreat(state, id, 1);
    return { message: `${who} took ${t.giveAmount} ${t.give}${t.fine ? ' of fine work' : ''} and gave ${t.getAmount} ${t.get}.` };
  }
  if (act === 'gift') {
    state.resources.goods -= GIFT_GOODS;
    changeGreat(state, id, id === 'orhai' ? 3 : 6);
    recordDeed(state, 'gifts');
    return { message: `${who} accepted your gift${id === 'orhai' ? ', and thought you soft for sending it' : ' graciously'}. Relations are now ${g.relation}.` };
  }
  if (act === 'tribute') {
    const cost = tributeCost(state);
    state.resources.coin -= cost;
    payTribute(state);
    return { message: `${who} took your tribute of ${cost} coin. Their riders will leave your settlements alone for a year.` };
  }
  if (act === 'embassy') {
    pay(state, EMBASSY_COST);
    g.embassy = true;
    changeGreat(state, id, 5);
    greatRemember(state, id, `opened an embassy in Year ${year(state)}`, 3);
    return { message: `Your embassy in ${REGIONS[def.homeland].name} is open. ${who} think better of you for it, and treaties are now possible.` };
  }
  if (act.startsWith('treaty:')) {
    const key = act.slice(7);
    g.treaties[key] = true;
    changeGreat(state, id, 3);
    greatRemember(state, id, `agreed to ${GREAT_TREATIES[key].phrase} in Year ${year(state)}`, 2);
    return { message: `${who} agreed to ${GREAT_TREATIES[key].phrase}. ${GREAT_TREATIES[key].effect}` };
  }
  if (act === 'marry') {
    g.married = true;
    changeGreat(state, id, 15);
    greatRemember(state, id, `married into their ruling family in Year ${year(state)}`, 15);
    return { message: `A marriage joins your ruling family to ${def.name}'s. They count you as kin now.` };
  }
  if (act === 'route') {
    pay(state, ROUTE_COST);
    g.route = true;
    greatRemember(state, id, `opened a trade route in Year ${year(state)}`, 2);
    return { message: `Caravans now run between ${state.campName} and ${def.name}, bringing about ${routeIncome(state, id)} coin a season.` };
  }
  return { error: 'That is not possible with them.' };
}

// ----- Trade routes -----

export function routeIncome(state, id) {
  const g = great(state, id);
  let coin = (id === 'ostrani' ? 3 : 2) + (g.treaties.trade ? 2 : 0);
  if (hasKnowledge(state, 'measures')) coin *= 1.25;
  return Math.round(coin);
}

export function routesIncome(state) {
  if (!state.great) return 0;
  return GREAT_ORDER.filter((id) => state.great[id].route && !atWar(state, id)).reduce((sum, id) => sum + routeIncome(state, id), 0);
}

// ----- The Orhai -----

// Settlements within reach of their riders: on the plains and the desert edge.
export const ORHAI_REACH = ['plains', 'desert', 'steppe'];

export function inOrhaiReach(t, state = null) {
  const reach = state && great(state, 'orhai') && great(state, 'orhai').pulledBack ? ['steppe'] : ORHAI_REACH;
  return reach.includes(placeRegion(t.place));
}

export function tributeCost(state) {
  const g = great(state, 'orhai');
  return Math.round(15 * 1.25 ** Math.min(4, g.tributeInARow));
}

export function payTribute(state) {
  const g = great(state, 'orhai');
  g.paidUntil = state.turn + 4;
  g.tributeInARow += 1;
  changeGreat(state, 'orhai', 5);
}

// The chance their riders fall on a settlement within reach this season.
export function orhaiRaidChance(state) {
  const g = great(state, 'orhai');
  // At war, their hosts ride instead (war.js).
  if (!g || g.treaties.peace || g.paidUntil > state.turn || atWar(state, 'orhai') || homeBesieged(state, 'orhai')) return 0;
  // Before they are met, their riders roam the plains only once the Nation
  // era is a few years old.
  if (!g.met && (state.turn - (state.nationFounded ?? state.turn)) < 16) return 0;
  let p = 0.06;
  if (g.relation < -20) p *= 1.5;
  if (g.relation >= 20) p *= 0.5;
  if (g.angryUntil > state.turn) p *= 2;
  return p;
}

// Runs each season. Raids settlements within reach, and the Orhai find you
// if they have not met you. Returns { urgent, events }. `defense` is the
// chance a settlement drives them off (settlements.js passes townDefense).
export function orhaiSeason(state, defense) {
  const out = { urgent: [], events: [] };
  const g = great(state, 'orhai');
  if (!g) return out;
  for (const t of (state.settlements || []).filter((x) => inOrhaiReach(x, state))) {
    if (!chance(state, orhaiRaidChance(state))) continue;
    if (armyHolding(state, placeRegion(t.place))) continue; // Your army there keeps them off.
    const first = !g.met && !g.contactPending;
    if (first) meetGreat(state, 'orhai');
    const who = first ? 'Riders out of the west, strangers on fast horses,' : 'Orhai riders';
    if (chance(state, defense(state, t) * 0.7)) {
      out.urgent.push(`${who} came against ${t.name}, and its guards drove them off.${first ? ' They call themselves the Orhai.' : ''}`);
      continue;
    }
    const lost = randomInt(state, 1, 3);
    t.population = Math.max(3, t.population - lost);
    t.loyalty = clamp(t.loyalty - 8);
    t.harriedAt = state.turn;
    if (!state.lastHarm) state.lastHarm = {};
    state.lastHarm.orhai = state.turn;
    out.urgent.push(`${who} raided ${t.name}, killed ${lost === 1 ? 'one settler' : `${lost} settlers`}, and drove off its herds.${first ? ' They call themselves the Orhai, and they will be back.' : ''} More guards or a fortress on the plains would help, or a peace pact with them.`);
  }
  return out;
}

// Free markets: what the great nations pay rises and falls each season.
export function drawMarket(state) {
  state.marketMood = hasKnowledge(state, 'freeMarkets') ? randomBetween(state, 0.9, 1.5) : 1;
}
