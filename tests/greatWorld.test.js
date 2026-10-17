import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../js/engine/game.js';
import { migrate, SAVE_VERSION } from '../js/engine/state.js';
import { routeIncome, tradeFactor } from '../js/engine/great.js';
import { getAdvice } from '../js/engine/advisors.js';
import {
  greatWorldSeason, feeling, pairKey, homelandDistance, warOf, enemiesOf, alliesOf, allied, defeatedNow,
  standingLine, worldLines, initialGreatWorld, pairsOf, WAR_REACH, BITTER,
} from '../js/engine/greatWorld.js';

// A game in the Nation era, with the great nations' world at its start.
function worldGame(seed = 1) {
  const s = newGame({ seed, difficulty: 'normal' });
  s.era = 'nation';
  s.nationFounded = 0;
  s.turn = 4;
  return s;
}

// Every feeling set to the same value, so a test controls who could fight.
function calm(s, n = 0) {
  for (const key of Object.keys(s.greatWorld.feelings)) s.greatWorld.feelings[key] = n;
}

// Runs whole years (four seasons each).
function years(s, n) {
  const lines = [];
  for (let i = 0; i < n * 4; i++) {
    lines.push(...greatWorldSeason(s));
    s.turn += 1;
  }
  return lines;
}

test('feelings start from old rivalries, friendships, and their natures', () => {
  const s = worldGame();
  assert.equal(Object.keys(s.greatWorld.feelings).length, 21);
  assert.ok(feeling(s, 'orhai', 'ashani') <= -45);
  assert.ok(feeling(s, 'haldi', 'ostrani') <= -45);
  assert.equal(feeling(s, 'ostrani', 'ashani'), 40); // Old friends, and both traders.
  assert.equal(pairKey('ashani', 'orhai'), pairKey('orhai', 'ashani'));
});

test('distances between homelands decide who could fight', () => {
  assert.equal(homelandDistance('ostrani', 'haldi'), 1);
  assert.equal(homelandDistance('orhai', 'ashani'), 2);
  assert.equal(homelandDistance('keshari', 'dravan'), 3);
  assert.ok(homelandDistance('venn', 'ashani') > WAR_REACH);
});

test('nothing moves before the Nation era', () => {
  const s = newGame({ seed: 1 });
  const before = JSON.stringify(s.greatWorld);
  for (let i = 0; i < 8; i++) { assert.deepEqual(greatWorldSeason(s), []); s.turn += 1; }
  assert.equal(JSON.stringify(s.greatWorld), before);
});

test('two peoples who hate each other go to war, but never peoples too far apart', () => {
  const s = worldGame();
  // Hold every feeling in place, year by year, so only the pair under test could fight.
  const hold = (setup) => { for (let y = 0; y < 20; y++) { calm(s); setup(); years(s, 1); } };
  hold(() => { s.greatWorld.feelings[pairKey('venn', 'ashani')] = -90; });
  assert.equal(s.greatWorld.warsBegun, 0);
  hold(() => { s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -90; });
  assert.ok(s.greatWorld.warsBegun >= 1);
  assert.ok(!s.greatWorld.wars.some((w) => [...w.sideA, ...w.sideB].includes('venn')));
});

test('a war costs both sides strength and ends with a beaten loser, then a truce', () => {
  const s = worldGame();
  calm(s);
  s.great.orhai.strength = 90;
  s.great.ashani.strength = 30;
  s.greatWorld.wars.push({ sideA: ['orhai'], sideB: ['ashani'], since: s.turn, score: 0 });
  assert.deepEqual(enemiesOf(s, 'ashani'), ['orhai']);
  const before = s.great.ashani.strength;
  greatWorldSeason(s);
  assert.ok(s.great.ashani.strength < before);
  let guard = 0;
  while (warOf(s, 'orhai') && guard++ < 40) { s.turn += 1; greatWorldSeason(s); }
  assert.equal(warOf(s, 'orhai'), null);
  assert.ok(defeatedNow(s, 'ashani'));
  assert.ok(!defeatedNow(s, 'orhai'));
  assert.ok(s.greatWorld.bitter[pairKey('orhai', 'ashani')] > s.turn);
  // No new war between them during the truce, however they feel.
  s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -100;
  for (let i = 0; i < BITTER - 1; i++) { s.turn += 1; greatWorldSeason(s); }
  assert.ok(!s.greatWorld.wars.some((w) => w.sideA.includes('orhai') && w.sideB.includes('ashani')));
});

test('their wars cut what their trade routes bring, and a beaten people pays less', () => {
  const s = worldGame();
  s.great.ashani.met = true;
  s.great.ashani.route = true;
  const full = routeIncome(s, 'ashani');
  const fair = tradeFactor(s, 'ashani');
  s.greatWorld.wars.push({ sideA: ['orhai'], sideB: ['ashani'], since: s.turn, score: 0 });
  assert.equal(routeIncome(s, 'ashani'), Math.round(full * 0.5));
  s.greatWorld.wars = [];
  s.greatWorld.defeated.ashani = s.turn + 8;
  assert.ok(tradeFactor(s, 'ashani') < fair);
  assert.equal(routeIncome(s, 'ashani'), Math.round(full * 0.75));
});

test('friends make alliances, allies join each other\'s wars, and alliances break when feelings cool', () => {
  const s = worldGame();
  calm(s);
  s.greatWorld.feelings[pairKey('ostrani', 'ashani')] = 80;
  let guard = 0;
  while (!allied(s, 'ostrani', 'ashani') && guard++ < 40) years(s, 1);
  assert.ok(allied(s, 'ostrani', 'ashani'));
  assert.deepEqual(alliesOf(s, 'ashani'), ['ostrani']);
  s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -95;
  guard = 0;
  while (!warOf(s, 'orhai') && guard++ < 40) years(s, 1);
  const w = warOf(s, 'orhai');
  assert.ok(w);
  const ashaniSide = w.sideA.includes('ashani') ? w.sideA : w.sideB;
  assert.ok(ashaniSide.includes('ostrani'));
  s.greatWorld.wars = [];
  s.greatWorld.feelings[pairKey('ostrani', 'ashani')] = 0;
  s.turn += 4 - (s.turn % 4);
  greatWorldSeason(s);
  assert.ok(!allied(s, 'ostrani', 'ashani'));
});

test('the player hears news only of peoples they have heard of', () => {
  const s = worldGame();
  calm(s);
  s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -95;
  let lines = [];
  let guard = 0;
  while (!s.greatWorld.warsBegun && guard++ < 40) lines.push(...years(s, 1));
  assert.ok(s.greatWorld.warsBegun >= 1);
  assert.deepEqual(lines.filter((l) => /beyond the valley/.test(l)), []);
  s.great.orhai.heard = true;
  s.greatWorld.wars = [];
  s.greatWorld.bitter = {};
  s.greatWorld.lastWarStart = -99;
  s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -95;
  lines = [];
  guard = 0;
  const begun = s.greatWorld.warsBegun;
  while (s.greatWorld.warsBegun === begun && guard++ < 40) lines.push(...years(s, 1));
  assert.ok(lines.some((l) => /^News from beyond the valley: the Orhai have gone to war with a people you have not met\./.test(l)));
});

test('the Neighbors screen lines say who is at war and allied', () => {
  const s = worldGame();
  for (const id of ['orhai', 'ashani', 'ostrani']) s.great[id].heard = true;
  s.greatWorld.alliances.push(pairKey('ostrani', 'ashani'));
  s.greatWorld.wars.push({ sideA: ['orhai'], sideB: ['ashani', 'ostrani'], since: s.turn, score: -40 });
  assert.match(standingLine(s, 'orhai'), /At war with the Ashani and the Ostrani since Year \d+, and losing\./);
  assert.match(standingLine(s, 'ashani'), /Allied with the Ostrani\./);
  assert.equal(standingLine(s, 'venn'), null);
  const lines = worldLines(s);
  assert.ok(lines.some((l) => /^The Orhai at war with the Ashani and the Ostrani/.test(l)));
  assert.ok(lines.some((l) => /^The Ostrani allied with the Ashani\./.test(l)));
});

test('the speaker points out a trade route cut by their war', () => {
  const s = worldGame();
  s.great.ashani.met = true;
  s.great.ashani.heard = true;
  s.great.ashani.route = true;
  s.greatWorld.wars.push({ sideA: ['orhai'], sideB: ['ashani'], since: s.turn, score: 0 });
  assert.ok(getAdvice(s).some((a) => a.role === 'speaker' && /The Ashani are at war with a people we have not met\. Our trade route to them brings half/.test(a.text)));
});

test('saves from version 35 gain the great nations\' world', () => {
  const s = worldGame();
  delete s.greatWorld;
  s.version = 35;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.greatWorld, initialGreatWorld());
  assert.equal(pairsOf().length, 21);
});
