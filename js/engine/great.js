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
import { applyStudy } from './study.js';
import { chance, randomInt, randomBetween } from './rng.js';
import { clamp, capital, listWords } from './util.js';
import {
  warTradeFactor, warRouteFactor, warOf, enemiesOf, shiftWar, mediateWar,
} from './greatWorld.js';

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

// When the Nation era begins, rumors of the first two reach the capital.
// Returns lines.
export function hearOfGreat(state) {
  if (!state.great) state.great = initialGreat();
  const lines = [];
  for (const id of GREAT_ORDER.filter((x) => GREAT_NATIONS[x].early)) {
    if (state.great[id].heard) continue;
    state.great[id].heard = true;
    lines.push(GREAT_NATIONS[id].rumor);
  }
  return lines;
}

// Word of a homeland's people comes with word of the region. Returns lines.
export function hearOfHomeland(state, regionId) {
  const id = REGIONS[regionId] && REGIONS[regionId].nation;
  const g = id && great(state, id);
  if (!g || g.heard) return [];
  g.heard = true;
  return [GREAT_NATIONS[id].rumor];
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
  if (def.likes.welcoming) add('your welcome to strangers', rep.welcoming * def.likes.welcoming / 3);
  if (def.likes.learned) add('your learning', Math.max(0, state.knowledge.learned.length - 30) * def.likes.learned);
  if (def.likes.temples) add('your temples', hasKnowledge(state, 'temples') ? def.likes.temples : 0);
  add('your embassy', g.embassy ? 10 : 0);
  add('the trade pact', g.treaties.trade ? 5 : 0);
  add('the peace pact', g.treaties.peace ? 5 : 0);
  add('your alliance', g.treaties.alliance ? 10 : 0);
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
    for (const id of GREAT_ORDER.filter((x) => great(state, x))) {
      const g = great(state, id);
      const target = greatStrengthTarget(state, id);
      const now = g.strength ?? target;
      if (now < target) g.strength = Math.min(target, now + Math.max(4, Math.round((target - now) * 0.25)));
    }
  }
  for (const id of metGreat(state)) {
    const g = great(state, id);
    const target = greatTarget(state, id);
    const drift = GREAT_NATIONS[id].drift || 2; // The wary Venn warm slowly.
    if (g.relation < target) g.relation = Math.min(target, g.relation + drift);
    else if (g.relation > target) g.relation = Math.max(target, g.relation - drift);
    if (seasonIndex(state) === 0 && Object.values(g.treaties).some(Boolean)) g.trust = clamp(g.trust + 2);
  }
}

// The riders or soldiers they keep under arms, which they make good each
// spring: the Orhai grow in number, and the Ostrani hire more in a war.
// (The Ostrani hire half again as many in a war.)
export function greatStrengthTarget(state, id) {
  const years = Math.max(0, state.turn - (state.nationFounded ?? state.turn)) / 4;
  const st = GREAT_NATIONS[id].strength;
  const base = Math.min(st.cap, st.base + st.per * years);
  return Math.round(base * (st.scaled ? raidScale(state) : 1) * (id === 'ostrani' && atWar(state, id) ? 1.5 : 1));
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
  return f * warTradeFactor(state, id); // A people beaten in a recent war pays less.
}

// What a trade would give or cost, now: { give, giveAmount, get, getAmount }.
export const WAR_GOODS = ['iron', 'horses', 'food'];
export const WAR_GOODS_FACTOR = 1.25;

export function tradeTerms(state, id, lotId) {
  const lot = TRADE_LOTS[lotId];
  const f = tradeFactor(state, id) * (lot.give && WAR_GOODS.includes(lot.give) && warOf(state, id) ? WAR_GOODS_FACTOR : 1);
  if (lot.give) {
    const fine = lotId === 'sellFine';
    return { give: lot.give, giveAmount: lot.amount, get: 'coin', getAmount: Math.max(1, Math.round(lot.coin * f)), fine };
  }
  return { give: 'coin', giveAmount: Math.max(1, Math.round(lot.coin / f)), get: lot.get, getAmount: lot.amount };
}

export function tradesWith(state, id) {
  const g = great(state, id);
  if (!g || !g.met || atWar(state, id)) return [];
  if (GREAT_NATIONS[id].needsPeace && !g.treaties.peace) return [];
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
export const WAR_AID = { coin: 30, goods: 30, iron: 15 };

// The chance mediation ends their war: better the more both trust you.
export function mediationChance(state, id) {
  const other = enemiesOf(state, id)[0];
  if (!other) return 0;
  return Math.min(0.85, 0.15 + 0.6 * Math.min(great(state, id).trust, great(state, other).trust) / 100);
}

export function greatActs(state, id) {
  const g = great(state, id);
  const def = GREAT_NATIONS[id];
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
  // Their war with another great nation: help them, or try to make peace.
  const war = warOf(state, id);
  if (war) {
    const enemies = enemiesOf(state, id);
    const names = listWords(enemies.map((x) => (great(state, x).met || great(state, x).heard ? GREAT_NATIONS[x].name : 'a people you have not met')));
    const wait = (g.lastWarAid ?? -99) + 4 - state.turn;
    for (const [res, n] of Object.entries(WAR_AID)) {
      acts.push({ act: `aid:${res}`, label: `Help them against ${names}: send ${n} ${res}`, why: wait > 0 ? `You helped them this past year; again in ${wait === 1 ? '1 season' : `${wait} seasons`}.` : (state.resources[res] || 0) < n ? `You have ${state.resources[res] || 0} ${res}.` : null });
    }
    const other = enemies[0];
    const og = great(state, other);
    const tried = (war.lastMediation ?? -99) + 4 - state.turn;
    acts.push({
      act: 'mediate',
      label: `Try to make peace between them and ${names}`,
      why: !hasKnowledge(state, 'diplomacy') ? 'Your people must learn Diplomacy first.'
        : !g.embassy || !og || !og.embassy ? `That needs an embassy with both ${def.name} and ${GREAT_NATIONS[other].name}.`
          : tried > 0 ? `Your envoys tried this past year; again in ${tried === 1 ? '1 season' : `${tried} seasons`}.` : null,
    });
  }
  if (!g.route) {
    acts.push({ act: 'route', label: `Set up a trade route to them, for ${costWords(ROUTE_COST)}`, why: !hasKnowledge(state, 'tradeRoutes') ? 'Your people must learn Trade routes first.' : GREAT_NATIONS[id].needsPeace && !g.treaties.peace ? `${capital(GREAT_NATIONS[id].name)} will only trade under a peace pact.` : g.relation < 10 ? 'Relations must be at least 10.' : short(state, ROUTE_COST).length ? `You are short of ${listWords(short(state, ROUTE_COST))}.` : null });
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
    recordDeed(state, 'trades');
    changeGreat(state, id, 1);
    // Selling the stuff of war to a people at war: their enemies trust you a little less.
    if (WAR_GOODS.includes(t.give) && warOf(state, id)) {
      for (const x of enemiesOf(state, id)) if (great(state, x).met) great(state, x).trust = clamp(great(state, x).trust - 2);
    }
    if (t.get === 'study') {
      // Their scholars teach yours: points toward the current discovery.
      const studied = applyStudy(state, t.getAmount);
      return { message: `${who} took ${t.giveAmount} coin, and their scholars taught yours: ${t.getAmount} points toward your studies.${studied.urgent.length ? ` ${studied.urgent.join(' ')}` : ''}` };
    }
    state.resources[t.get] = (state.resources[t.get] || 0) + t.getAmount;
    return { message: `${who} took ${t.giveAmount} ${t.give}${t.fine ? ' of fine work' : ''} and gave ${t.getAmount} ${t.get}.` };
  }
  if (act.startsWith('aid:')) {
    const res = act.slice(4);
    const n = WAR_AID[res];
    state.resources[res] -= n;
    g.lastWarAid = state.turn;
    changeGreat(state, id, 8);
    g.trust = clamp(g.trust + 3);
    shiftWar(state, id, 12);
    const enemies = enemiesOf(state, id);
    for (const x of enemies) if (great(state, x).met) changeGreat(state, x, -6);
    greatRemember(state, id, `helped them in their war in Year ${year(state)}`, 0);
    recordDeed(state, 'gifts');
    return { message: `${who} took your ${n} ${res} for their war, and think better of you. Their enemies have heard of it.` };
  }
  if (act === 'mediate') {
    const war = warOf(state, id);
    const other = enemiesOf(state, id)[0];
    const p = mediationChance(state, id);
    war.lastMediation = state.turn;
    if (chance(state, p)) {
      mediateWar(state, war);
      for (const x of metGreat(state)) changeGreat(state, x, 5);
      changeGreat(state, id, 5);
      changeGreat(state, other, 5);
      greatRemember(state, id, `made peace between them and ${GREAT_NATIONS[other].name} in Year ${year(state)}`, 5);
      greatRemember(state, other, `made peace between them and ${def.name} in Year ${year(state)}`, 5);
      return { message: `Your envoys brought ${def.name} and ${GREAT_NATIONS[other].name} to make peace. Every great nation thinks better of you for it.` };
    }
    changeGreat(state, id, -3);
    changeGreat(state, other, -3);
    return { message: `Your envoys could not bring ${def.name} and ${GREAT_NATIONS[other].name} to make peace, and both thought you meddling.` };
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
  let coin = ((GREAT_NATIONS[id].route || 2) + (g.treaties.trade ? 2 : 0)) * (g.richRoute ? 2 : 1);
  if (hasKnowledge(state, 'measures')) coin *= 1.25;
  coin *= warRouteFactor(state, id); // Less while they fight, and for years after a defeat.
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

// ----- The Dravan and the Haldi -----

// In peace, their war bands fall on your settlements within their reach: 5
// percent a season, half again as often while relations are below -20, half
// as often at 20 or more, and never under a peace pact or once a peace has
// pushed them back. Before they are met, they find you this way, once the
// Nation era is old enough.
export function raidChance(state, id) {
  const g = great(state, id);
  const def = GREAT_NATIONS[id];
  if (!g || !def.raids || g.treaties.peace || g.pulledBack || atWar(state, id) || homeBesieged(state, id)) return 0;
  if (g.paidUntil > state.turn) return 0; // Tribute keeps them home for a year.
  if (!g.met && (state.turn - (state.nationFounded ?? state.turn)) < def.raids.after) return 0;
  let p = 0.05;
  if (g.relation < -20) p *= 1.5;
  if (g.relation >= 20) p *= 0.5;
  if (g.angryUntil > state.turn) p *= 1.5; // A refused demand.
  return p;
}

export function inRaidReach(state, id, t) {
  const def = GREAT_NATIONS[id];
  return Boolean(def.raids) && def.raids.reach.includes(placeRegion(t.place));
}

// Runs each season, as the Orhai's raids do. Returns { urgent, events }.
export function greatRaidsSeason(state, defense) {
  const out = { urgent: [], events: [] };
  if (!state.great) return out;
  for (const id of GREAT_ORDER.filter((x) => GREAT_NATIONS[x].raids && great(state, x))) {
    const g = great(state, id);
    const def = GREAT_NATIONS[id];
    for (const t of (state.settlements || []).filter((x) => inRaidReach(state, id, x))) {
      if (!chance(state, raidChance(state, id))) continue;
      if (armyHolding(state, placeRegion(t.place))) continue; // Your army there keeps them off.
      const first = !g.met && !g.contactPending;
      if (first) meetGreat(state, id);
      const who = first ? def.raids.stranger : def.raids.who;
      if (chance(state, defense(state, t) * 0.7)) {
        out.urgent.push(`${who} came against ${t.name}, and its guards drove them off.${first ? ` They call themselves ${def.name}.` : ''}`);
        continue;
      }
      const lost = randomInt(state, 1, 3);
      t.population = Math.max(3, t.population - lost);
      t.loyalty = clamp(t.loyalty - 8);
      t.harriedAt = state.turn;
      if (!state.lastHarm) state.lastHarm = {};
      state.lastHarm[id] = state.turn;
      out.urgent.push(`${who} raided ${t.name}, killed ${lost === 1 ? 'one settler' : `${lost} settlers`}, and carried off what they could.${first ? ` They call themselves ${def.name}, and they will be back.` : ''} More guards there would help, or a peace pact with them.`);
    }
  }
  return out;
}

// Free markets: what the great nations pay rises and falls each season.
export function drawMarket(state) {
  state.marketMood = hasKnowledge(state, 'freeMarkets') ? randomBetween(state, 0.9, 1.5) : 1;
}
