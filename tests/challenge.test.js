// The late Settlement era challenge: hill clans drawn by a large, rich
// village; Skarn who learn war as a nation; a crowded village that frays;
// and great hosts that strip a village that hides.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate } from '../js/engine/state.js';
import {
  clanTarget, clansYear, clansMarching, skarnStrength, clanGiftCost, clanGiftBlocker, CLANS_MAX, CLAN_GIFT_SEASONS,
} from '../js/engine/clans.js';
import {
  nation, skarnBand, skarnArms, skarnLosses, SKARN_ARMS_MAX,
} from '../js/engine/nations.js';
import { createBattle, foeStrength } from '../js/engine/battle.js';
import { crowdingSettle } from '../js/engine/village.js';
import { resolveRaidPlan } from '../js/engine/raid.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1, extra = 8) {
  const s = newGame({ seed });
  for (let i = 0; i < extra; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 20 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 200;
  s.resources.wood = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' });
}

function grow(s, n) {
  for (let i = 0; i < n; i++) {
    s.people.push(makePerson({ name: `More${i}`, note: '', age: 30, skills: { hunting: 1, foraging: 2, building: 1, healing: 0, scouting: 0, learning: 0 } }, s.nextPersonId++, 'forage'));
  }
}

test('a small, modest village draws no hill clans; size and full stores draw them', () => {
  const s = village();
  assert.equal(clanTarget(s), 0);
  grow(s, 30); // About 50 people.
  const bySize = clanTarget(s);
  assert.ok(bySize >= 5, `a large village draws some, got ${bySize}`);
  s.resources.food = 1300;
  assert.ok(clanTarget(s) > bySize + 8, 'full stores draw many more');
  s.resources.food = 99999;
  assert.equal(clanTarget(s), CLANS_MAX, 'there is a limit to how many come');
});

test('the clans come at once, announce themselves once, and drift home slowly', () => {
  const s = village();
  grow(s, 30);
  s.resources.food = 1300;
  const first = clansYear(s);
  assert.equal(s.clans.warriors, clanTarget(s));
  assert.ok(first.some((l) => /Hill clans from the east have come down/.test(l)));
  const second = clansYear(s);
  assert.ok(!second.some((l) => /have come down/.test(l)), 'the arrival is told only once');
  const before = s.clans.warriors;
  s.resources.food = 0;
  s.people = s.people.slice(0, 20);
  clansYear(s);
  assert.ok(s.clans.warriors < before && s.clans.warriors > 0, 'they leave slowly when there is less to take');
  for (let i = 0; i < 20; i++) clansYear(s);
  assert.equal(s.clans.warriors, 0);
});

test('clansmen march in Skarn war bands, unless the Skarn are at peace', () => {
  const s = village();
  nation(s, 'skarn').warriors = 20;
  s.clans.warriors = 20;
  assert.equal(skarnStrength(s), 40);
  const bands = Array.from({ length: 20 }, () => skarnBand(s));
  assert.ok(bands.every((b) => b >= 20 && b <= 32), 'a band is half to four fifths of everyone');
  s.neighbors.skarn.peace = true;
  assert.equal(clansMarching(s), 0);
  assert.equal(skarnStrength(s), 20);
});

test('fallen clansmen are shared out with the Skarn by their numbers', () => {
  const s = village();
  nation(s, 'skarn').warriors = 30;
  s.clans.warriors = 10;
  const clansmen = skarnLosses(s, 8);
  assert.equal(clansmen, 2);
  assert.equal(s.clans.warriors, 8);
  assert.equal(nation(s, 'skarn').warriors, 24);
});

test('gifts of goods send half the clans home and keep the rest out of the Skarn wars', () => {
  let s = village();
  s.clans.warriors = 2;
  assert.match(clanGiftBlocker(s), /Too few/);
  s.clans.warriors = 14;
  s.resources.goods = 5;
  assert.match(clanGiftBlocker(s), /want 28 goods/);
  s.resources.goods = 40;
  assert.equal(clanGiftCost(s), 28);
  s = act(s, { type: 'giftClans' });
  assert.equal(s.resources.goods, 12);
  assert.equal(s.clans.warriors, 7);
  assert.equal(clansMarching(s), 0, 'the rest keep to their hills');
  assert.match(clanGiftBlocker(s), /keeping to their hills/);
  s.turn += CLAN_GIFT_SEASONS;
  assert.equal(clansMarching(s), 7, 'and come back when the gift wears off');
});

test('the Skarn learn war as a nation: harder to beat each year, up to a limit', () => {
  const s = village();
  assert.equal(skarnArms(s), 1);
  const raid = { type: 'raid', raiders: 10, warned: true, from: 'skarn' };
  assert.equal(foeStrength(createBattle(s, raid)), 6, 'at first they fight like the old raiders');
  s.turn += 4 * 5;
  assert.ok(skarnArms(s) > 1.2 && skarnArms(s) < SKARN_ARMS_MAX);
  const later = foeStrength(createBattle(s, raid));
  assert.ok(later > 7, `five years on they strike harder, got ${later}`);
  s.clans.warriors = nation(s, 'skarn').warriors;
  const mixed = foeStrength(createBattle(s, raid));
  assert.ok(mixed > 6 && mixed < later, 'clansmen fight like the old raiders');
  assert.equal(foeStrength(createBattle(s, { ...raid, from: 'outlaws' })), 6);
  s.turn += 4 * 50;
  assert.equal(skarnArms(s), SKARN_ARMS_MAX);
});

test('a large village frays: spirits settle lower beyond 30 people, up to 5', () => {
  const s = village();
  assert.equal(crowdingSettle(s), 0);
  grow(s, 30 - living(s).length + 25);
  assert.equal(crowdingSettle(s), 2);
  grow(s, 200);
  assert.equal(crowdingSettle(s), 5);
  const camp = newGame({ seed: 1 });
  assert.equal(crowdingSettle(camp), 0, 'a camp is not a village');
});

test('hiding from a great host costs far more than hiding from a raid', () => {
  const hide = (host) => {
    const s = village();
    s.resources.food = 1000;
    s.resources.wood = 100;
    s.resources.goods = 100;
    s.pendingEvent = { type: 'raid', raiders: 30, warned: true, from: 'skarn', host };
    const r = resolveRaidPlan(s, 'hide');
    return { s, lines: r.lines };
  };
  const raid = hide(false);
  assert.equal(raid.s.resources.food, 800);
  assert.equal(raid.s.resources.goods, 100);
  const host = hide(true);
  assert.equal(host.s.resources.food, 600);
  assert.equal(host.s.resources.wood, 70);
  assert.equal(host.s.resources.goods, 70);
  assert.ok(host.lines.some((l) => /30 goods/.test(l)));
});

test('older saves gain hill clans', () => {
  const s = village();
  const old = structuredClone(s);
  old.version = 21;
  delete old.clans;
  const up = migrate(old);
  assert.deepEqual(up.clans, { warriors: 0, quietUntil: -1, arrived: false });
});
