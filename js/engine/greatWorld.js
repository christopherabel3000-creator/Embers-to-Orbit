// The great nations among themselves: every pair has feelings for each
// other, which drift from their natures, old rivalries and friendships,
// alliances, and the wars between them. Now and then two go to war, or make
// an alliance. Wars cost both sides strength and end with a winner, who is
// stronger for it, and a loser, weaker and poorer to trade with for years.
// Homelands never change hands. The player hears of it when something
// changes; envoys and taking sides are in greatEnvoys.js.

import { GREAT_NATIONS, GREAT_ORDER } from './greatData.js';
import { REGIONS } from './worldData.js';
import { seasonIndex, year } from './state.js';
import { chance, randomInt } from './rng.js';
import { capital } from './util.js';

// Old rivalries and friendships, by pair (names in GREAT_ORDER order).
export const PAIR_SEEDS = {
  'orhai|ashani': -45, // Riders and caravans meet on the desert edge.
  'ostrani|haldi': -45, // Merchant galleys and the sea rovers who take them.
  'keshari|dravan': -35, // The old ruins and the iron hills lie between them.
  'ostrani|orhai': -10, // Wary neighbors across the desert.
  'ostrani|ashani': 30, // The galleys and the caravans trade at the delta.
  'ostrani|keshari': 15,
  'keshari|ashani': 10,
  'keshari|venn': 15, // Patient peoples of the high north.
};
const WARLIKE = ['orhai', 'dravan', 'haldi'];
const TRADING = ['ostrani', 'ashani'];
export const MAX_WARS = 2; // Wars among them at once.
export const WAR_GAP = 8; // Seasons between one war's start and the next.
export const WAR_CHANCE = 0.25; // Each spring, when a war could start.
export const WAR_REACH = 3; // Regions apart: farther than this, they cannot fight.
export const ALLIANCE_AT = 40; // Feelings at which two may ally.
export const ALLIANCE_ENDS = 15;
export const ALLIANCE_CHANCE = 0.2;
export const MAX_ALLIES = 2;
export const BITTER = 16; // Seasons a war's bitterness, and the truce after it, last.
export const DEFEATED = 16; // Seasons a loser stays weak and poor.
export const WAR_YEARS = 4; // The longest a war lasts.

export function pairKey(a, b) {
  return GREAT_ORDER.indexOf(a) < GREAT_ORDER.indexOf(b) ? `${a}|${b}` : `${b}|${a}`;
}

export function pairsOf() {
  const out = [];
  for (let i = 0; i < GREAT_ORDER.length; i++) {
    for (let j = i + 1; j < GREAT_ORDER.length; j++) out.push([GREAT_ORDER[i], GREAT_ORDER[j]]);
  }
  return out;
}

// Regions between two homelands, by the shortest way.
const distances = {};
export function homelandDistance(a, b) {
  const key = pairKey(a, b);
  if (key in distances) return distances[key];
  const from = GREAT_NATIONS[a].homeland;
  const to = GREAT_NATIONS[b].homeland;
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const r = queue.shift();
    for (const n of REGIONS[r].neighbors || []) {
      if (seen.has(n)) continue;
      seen.set(n, seen.get(r) + 1);
      queue.push(n);
    }
  }
  distances[key] = seen.get(to) ?? 99;
  return distances[key];
}

export function initialGreatWorld() {
  const feelings = {};
  for (const [a, b] of pairsOf()) feelings[pairKey(a, b)] = baseFeeling(a, b);
  return {
    feelings, wars: [], alliances: [], lastWarStart: -99, defeated: {}, bitter: {}, warsBegun: 0, alliancesMade: 0,
  };
}

function world(state) {
  if (!state.greatWorld) state.greatWorld = initialGreatWorld();
  return state.greatWorld;
}

// Where two peoples' feelings start: old rivalries and friendships, a
// warlike people's neighbors' fear of it, and trade between traders.
function baseFeeling(a, b) {
  let n = PAIR_SEEDS[pairKey(a, b)] || 0;
  const near = homelandDistance(a, b) <= 2;
  if (near && WARLIKE.includes(a) !== WARLIKE.includes(b)) n -= 10;
  if (TRADING.includes(a) && TRADING.includes(b)) n += 10;
  return n;
}

export function feeling(state, a, b) {
  return world(state).feelings[pairKey(a, b)] ?? 0;
}

export function allied(state, a, b) {
  return world(state).alliances.includes(pairKey(a, b));
}

export function alliesOf(state, id) {
  return world(state).alliances.map((k) => k.split('|')).filter((p) => p.includes(id)).map((p) => (p[0] === id ? p[1] : p[0]));
}

// The war a great nation is fighting with another, if any.
export function warOf(state, id) {
  return world(state).wars.find((w) => w.sideA.includes(id) || w.sideB.includes(id)) || null;
}

// Who they are fighting: the other side of their war.
export function enemiesOf(state, id) {
  const w = warOf(state, id);
  if (!w) return [];
  return w.sideA.includes(id) ? w.sideB : w.sideA;
}

export function atWarWith(state, a, b) {
  return enemiesOf(state, a).includes(b);
}

export function defeatedNow(state, id) {
  return (world(state).defeated[id] ?? -1) > state.turn;
}

// Where their feelings drift: the old seed, an alliance, a shared enemy,
// and the bitterness of a recent war between them.
export function feelingTarget(state, a, b) {
  const w = world(state);
  const key = pairKey(a, b);
  let n = baseFeeling(a, b);
  if (allied(state, a, b)) n += 20;
  const shared = GREAT_ORDER.some((c) => c !== a && c !== b && feeling(state, a, c) <= -30 && feeling(state, b, c) <= -30);
  if (shared) n += 10;
  if ((w.bitter[key] ?? -1) > state.turn) n -= 25;
  return n;
}

// The strength one side of a war brings: its own, and half its allies'.
function sideStrength(state, side) {
  return side.reduce((sum, id, i) => sum + (state.great[id].strength || 0) * (i === 0 ? 1 : 0.5), 0);
}

function known(state, id) {
  return Boolean(state.great[id] && (state.great[id].heard || state.great[id].met));
}

function nameFor(state, id) {
  return known(state, id) ? GREAT_NATIONS[id].name : 'a people you have not met';
}

// A line of news, if the player has heard of at least one of them.
function news(state, ids, text) {
  return ids.some((id) => known(state, id)) ? `News from beyond the valley: ${text}` : null;
}

function startWar(state, a, b, lines) {
  const w = world(state);
  const joinA = alliesOf(state, a).filter((x) => x !== b && !warOf(state, x));
  const joinB = alliesOf(state, b).filter((x) => x !== a && !warOf(state, x) && !joinA.includes(x));
  w.wars.push({
    sideA: [a, ...joinA], sideB: [b, ...joinB], since: state.turn, score: 0,
  });
  w.lastWarStart = state.turn;
  w.warsBegun += 1;
  const allies = [...joinA.map((x) => `${nameFor(state, x)} beside ${nameFor(state, a)}`), ...joinB.map((x) => `${nameFor(state, x)} beside ${nameFor(state, b)}`)];
  const line = news(state, [a, b, ...joinA, ...joinB], `${nameFor(state, a)} have gone to war with ${nameFor(state, b)}.${allies.length ? ` Their allies stand with them: ${allies.join('; ')}.` : ''}`);
  if (line) lines.push(line);
}

function endWar(state, war, lines) {
  const w = world(state);
  w.wars = w.wars.filter((x) => x !== war);
  const a = war.sideA[0];
  const b = war.sideB[0];
  const close = Math.abs(war.score) < 20;
  const [winners, losers] = war.score >= 0 ? [war.sideA, war.sideB] : [war.sideB, war.sideA];
  for (const x of [...war.sideA, ...war.sideB]) {
    for (const y of [...war.sideA, ...war.sideB]) {
      if (x < y && war.sideA.includes(x) !== war.sideA.includes(y)) {
        const key = pairKey(x, y);
        w.feelings[key] = Math.max(w.feelings[key], -15); // Peace eases them a little.
        w.bitter[key] = state.turn + BITTER; // A truce: no war between them until then.
      }
    }
  }
  let text;
  if (close) {
    text = `the war between ${nameFor(state, a)} and ${nameFor(state, b)} is over, and neither side won.`;
  } else {
    for (const id of losers) {
      const g = state.great[id];
      g.strength = Math.round((g.strength || 0) * 0.8);
      w.defeated[id] = state.turn + DEFEATED;
    }
    for (const id of winners) {
      const g = state.great[id];
      g.strength = Math.round((g.strength || 0) * 1.1);
    }
    text = `the war between ${nameFor(state, a)} and ${nameFor(state, b)} is over: ${nameFor(state, winners[0])} won, and ${nameFor(state, losers[0])} will be weaker and poorer for years.`;
  }
  const line = news(state, [...war.sideA, ...war.sideB], text);
  if (line) lines.push(line);
}

// One season of a war: both sides lose strength, and the war turns toward
// the stronger side, with chance.
function warSeasonFor(state, war, lines) {
  const sa = sideStrength(state, war.sideA);
  const sb = sideStrength(state, war.sideB);
  for (const [side, enemy] of [[war.sideA, sb], [war.sideB, sa]]) {
    side.forEach((id, i) => {
      const g = state.great[id];
      const own = g.strength || 0;
      const loss = Math.round((0.02 * own + 0.01 * enemy / side.length) * (i === 0 ? 1 : 0.5));
      g.strength = Math.max(5, own - loss);
    });
  }
  const tilt = sa + sb > 0 ? (sa - sb) / (sa + sb) : 0;
  war.score = Math.max(-100, Math.min(100, war.score + Math.round(30 * tilt) + randomInt(state, -10, 10)));
  const seasons = state.turn - war.since;
  const decided = Math.abs(war.score) >= 60 && seasons >= 4;
  const tired = seasons >= 4 && Math.abs(war.score) >= 30 && chance(state, 0.1);
  if (decided || tired || seasons >= WAR_YEARS * 4) endWar(state, war, lines);
}

// Each spring: alliances made and broken, and perhaps a new war.
function springFor(state, lines) {
  const w = world(state);
  for (const key of [...w.alliances]) {
    if (w.feelings[key] < ALLIANCE_ENDS) {
      w.alliances = w.alliances.filter((k) => k !== key);
      const [a, b] = key.split('|');
      const line = news(state, [a, b], `${nameFor(state, a)} and ${nameFor(state, b)} have broken off their alliance.`);
      if (line) lines.push(line);
    }
  }
  for (const [a, b] of pairsOf()) {
    const key = pairKey(a, b);
    if (w.alliances.includes(key) || atWarWith(state, a, b) || w.feelings[key] < ALLIANCE_AT) continue;
    if (alliesOf(state, a).length >= MAX_ALLIES || alliesOf(state, b).length >= MAX_ALLIES) continue;
    if (!chance(state, ALLIANCE_CHANCE)) continue;
    w.alliances.push(key);
    w.alliancesMade += 1;
    const line = news(state, [a, b], `${nameFor(state, a)} and ${nameFor(state, b)} have made an alliance: each will join the other's wars.`);
    if (line) lines.push(line);
  }
  if (w.wars.length >= MAX_WARS || state.turn - w.lastWarStart < WAR_GAP) return;
  const candidates = pairsOf().filter(([a, b]) => !warOf(state, a) && !warOf(state, b) && !allied(state, a, b)
    && homelandDistance(a, b) <= WAR_REACH && feeling(state, a, b) <= -30 && (w.bitter[pairKey(a, b)] ?? -1) <= state.turn);
  if (!candidates.length || !chance(state, WAR_CHANCE)) return;
  const total = candidates.reduce((sum, [a, b]) => sum - feeling(state, a, b), 0);
  let roll = randomInt(state, 0, 9999) / 10000 * total;
  let chosen = candidates[candidates.length - 1];
  for (const pair of candidates) {
    roll -= -feeling(state, pair[0], pair[1]);
    if (roll < 0) { chosen = pair; break; }
  }
  // The more warlike, or else the stronger, makes the war.
  const [x, y] = chosen;
  const first = WARLIKE.includes(x) !== WARLIKE.includes(y)
    ? (WARLIKE.includes(x) ? x : y)
    : ((state.great[x].strength || 0) >= (state.great[y].strength || 0) ? x : y);
  startWar(state, first, first === x ? y : x, lines);
}

// Runs each season of the Nation era: feelings drift, wars go on, and each
// spring alliances and wars may begin. Returns lines of news.
export function greatWorldSeason(state) {
  const lines = [];
  if (!state.great || state.nationFounded == null) return lines;
  const w = world(state);
  for (const [a, b] of pairsOf()) {
    const key = pairKey(a, b);
    const target = feelingTarget(state, a, b) + (atWarWith(state, a, b) ? -30 : 0);
    const now = w.feelings[key];
    if (now < target) w.feelings[key] = Math.min(target, now + 2);
    else if (now > target) w.feelings[key] = Math.max(target, now - 2);
  }
  if (seasonIndex(state) === 0) {
    for (const key of Object.keys(w.feelings)) w.feelings[key] = Math.max(-100, Math.min(100, w.feelings[key] + randomInt(state, -3, 3)));
  }
  for (const war of [...w.wars]) warSeasonFor(state, war, lines);
  if (seasonIndex(state) === 0) springFor(state, lines);
  return lines;
}

// Help from you turns their war their way.
export function shiftWar(state, id, n) {
  const war = warOf(state, id);
  if (!war) return;
  const sign = war.sideA.includes(id) ? 1 : -1;
  war.score = Math.max(-100, Math.min(100, war.score + sign * n));
}

// Your envoys bring them to peace: the war ends, and neither side won.
export function mediateWar(state, war) {
  war.score = 0;
  const lines = [];
  endWar(state, war, lines);
  return lines;
}

// How a great nation stands among the others, in one line for the
// Neighbors screen, or null if nothing stands out.
export function standingLine(state, id) {
  const parts = [];
  const war = warOf(state, id);
  if (war) {
    const ours = war.sideA.includes(id) ? 1 : -1;
    const score = war.score * ours;
    const enemies = enemiesOf(state, id).map((x) => nameFor(state, x));
    const how = score >= 30 ? ', and winning' : score <= -30 ? ', and losing' : '';
    parts.push(`At war with ${enemies.join(' and ')} since Year ${year(state, war.since - state.turn)}${how}.`);
  }
  const allies = alliesOf(state, id);
  if (allies.length) parts.push(`Allied with ${allies.map((x) => nameFor(state, x)).join(' and ')}.`);
  if (defeatedNow(state, id)) parts.push('Beaten in a recent war: weaker, and poorer to trade with.');
  return parts.length ? parts.join(' ') : null;
}

// The wars and alliances among the peoples the player has heard of.
export function worldLines(state) {
  const w = world(state);
  const out = [];
  for (const war of w.wars) {
    if (![...war.sideA, ...war.sideB].some((id) => known(state, id))) continue;
    out.push(`${capital(war.sideA.map((x) => nameFor(state, x)).join(' and '))} at war with ${war.sideB.map((x) => nameFor(state, x)).join(' and ')}, since Year ${year(state, war.since - state.turn)}.`);
  }
  for (const key of w.alliances) {
    const [a, b] = key.split('|');
    if (!known(state, a) && !known(state, b)) continue;
    out.push(`${capital(nameFor(state, a))} allied with ${nameFor(state, b)}.`);
  }
  return out;
}

// What a war or a recent defeat does to their trade with you.
export function warTradeFactor(state, id) {
  return defeatedNow(state, id) ? 0.85 : 1;
}

export function warRouteFactor(state, id) {
  if (warOf(state, id)) return 0.5;
  return defeatedNow(state, id) ? 0.75 : 1;
}
