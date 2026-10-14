import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION } from '../js/engine/state.js';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, migrate, storageCapacity, woodNeededForWarmth, hasCondition,
} from '../js/engine/state.js';
import {
  feastCost, feastBlocker, overflowRot, seasonsUntilFeast,
} from '../js/engine/stores.js';
import { workFactor, foodPerPlot, expectedFood } from '../js/engine/rules.js';
import { raidGrowth, wealthLure } from '../js/engine/season.js';
import { birthOutlook } from '../js/engine/population.js';
import { applyStandingOrders } from '../js/engine/orders.js';
import { queueBlocker } from '../js/engine/building.js';
import { getAdvice } from '../js/engine/advisors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

test('the stores hold more with each storehouse, and more again with pottery', () => {
  const s = newGame({ seed: 1 });
  assert.equal(storageCapacity(s), 100);
  s.buildings.storehouse = 2;
  assert.equal(storageCapacity(s), 400);
  s.knowledge.learned.push('pottery');
  assert.equal(storageCapacity(s), 600);
});

test('a camp can build up to three storehouses', () => {
  const s = newGame({ seed: 1 });
  s.buildings.storehouse = 2;
  assert.equal(queueBlocker(s, 'storehouse'), null);
  s.buildQueue.push({ id: 'storehouse', progress: 0, paid: false });
  assert.match(queueBlocker(s, 'storehouse'), /3 at most/);
});

test('food beyond the room in the stores rots, half of it each season', () => {
  let s = newGame({ seed: 4 });
  s.resources.food = 300;
  assert.equal(overflowRot(s), 100);
  for (const p of living(s)) p.task = 'rest';
  s = act(s, { type: 'endTurn' });
  // 300 less 24 eaten, 12 percent spoiled, then half of what is left over 100.
  const afterSpoil = Math.ceil((300 - 24) * 0.88);
  assert.ok(Math.abs(s.resources.food - (afterSpoil - Math.ceil((afterSpoil - 100) / 2))) <= 1, `food was ${s.resources.food}`);
  assert.ok(s.report.urgent.some((l) => /stores were overflowing/.test(l)));
});

test('a feast costs 3 food a person, lifts spirits, and can be held once a year', () => {
  let s = newGame({ seed: 2 });
  s.resources.food = 90;
  assert.equal(feastCost(s), 36);
  const before = s.people[0].morale;
  s = act(s, { type: 'holdFeast' });
  assert.equal(s.resources.food, 54);
  assert.equal(s.people[0].morale, before + 15);
  assert.equal(s.deeds.feasts, 1);
  assert.ok(workFactor(s.people[0]) > 1, 'people in high spirits work better');
  assert.ok(birthOutlook(s).chance > 0);
  assert.match(applyAction(s, { type: 'holdFeast' }).error, /feasted recently/);
  assert.equal(seasonsUntilFeast(s), 4);
});

test('a feast needs enough food, and guests must be a people you know', () => {
  const s = newGame({ seed: 2 });
  s.resources.food = 20;
  assert.match(feastBlocker(s), /needs 36 food/);
  s.resources.food = 100;
  assert.match(applyAction(s, { type: 'holdFeast', guest: 'velari' }).error, /would not come/);
});

test('feasting with a neighbor wins their goodwill', () => {
  let s = newGame({ seed: 3 });
  s.neighbors.velari.known = true;
  s.resources.food = 100;
  const before = s.neighbors.velari.relation;
  s = act(s, { type: 'holdFeast', guest: 'velari' });
  assert.equal(s.resources.food, 100 - 36 - 15);
  assert.equal(s.neighbors.velari.relation, before + 8);
  assert.equal(s.deeds.gifts, 1);
});

test('a feast makes a birth likelier that season', () => {
  const s = newGame({ seed: 5 });
  s.resources.food = 200;
  const plain = birthOutlook(s).chance;
  s.feastThisSeason = true;
  assert.ok(birthOutlook(s).chance > plain);
});

test('four feasts grow the Feasting days tradition', () => {
  let s = newGame({ seed: 6 });
  s.deeds.feasts = 3;
  s.resources.food = 200;
  s = act(s, { type: 'holdFeast' });
  for (const p of living(s)) p.task = 'rest';
  s = act(s, { type: 'endTurn' });
  assert.ok(s.traditions.includes('feasting'));
});

test('the steward holds a harvest feast at the start of winter when food is to spare', () => {
  const s = newGame({ seed: 7 });
  s.orders.harvestFeast = true;
  s.turn = 3; // Winter.
  s.resources.food = 200;
  s.buildings.storehouse = 1;
  const lines = applyStandingOrders(s);
  assert.equal(s.lastFeast, 3);
  assert.equal(s.resources.food, 164);
  assert.ok(lines.orders.some((l) => /held a feast/.test(l)));

  const lean = newGame({ seed: 7 });
  lean.orders.harvestFeast = true;
  lean.turn = 3;
  lean.resources.food = 90; // Not 3 seasons of food after a feast.
  applyStandingOrders(lean);
  assert.equal(lean.lastFeast, -99);
});

test('a hard winter burns more wood and spoils the hunting, then passes', () => {
  let s = newGame({ seed: 8 });
  s.turn = 3;
  const aric = s.people[0];
  const normal = expectedFood(s, aric, 'hunt', 3);
  s.conditions.push({ id: 'hardWinter', seasonsLeft: 1 });
  assert.ok(hasCondition(s, 'hardWinter'));
  assert.ok(expectedFood(s, aric, 'hunt', 3) < normal);
  assert.equal(woodNeededForWarmth(3, 12, true), 18);
  s.resources.wood = 100;
  s.resources.food = 80;
  for (const p of living(s)) p.task = 'rest';
  s = act(s, { type: 'endTurn' });
  assert.ok(s.report.events.some((l) => /burned 18 wood/.test(l)));
  assert.ok(!hasCondition(s, 'hardWinter'));
  assert.ok(s.report.events.some((l) => /hard winter has broken/.test(l)));
});

test('a drought shrinks the harvest', () => {
  const s = newGame({ seed: 9 });
  const normal = foodPerPlot(1, s);
  s.conditions.push({ id: 'drought', seasonsLeft: 2 });
  assert.ok(foodPerPlot(1, s) < normal);
});

test('raids grow quickly at first, then level off', () => {
  assert.equal(raidGrowth(1), 0);
  assert.equal(raidGrowth(6), 10);
  assert.equal(raidGrowth(10), 12);
  assert.equal(raidGrowth(40), 16);
});

test('full stores draw more raiders', () => {
  const s = newGame({ seed: 1 });
  s.resources.food = 200;
  assert.equal(wealthLure(s), 0);
  s.resources.food = 500;
  assert.equal(wealthLure(s), 2);
  s.resources.food = 5000;
  assert.equal(wealthLure(s), 5);
});

test('the steward warns when the stores are nearly full', () => {
  const s = newGame({ seed: 1 });
  s.resources.food = 95;
  assert.ok(getAdvice(s).some((a) => a.role === 'steward' && /nearly full/.test(a.text)));
  s.resources.food = 150;
  assert.ok(getAdvice(s).some((a) => a.severity === 'urgent' && /overflowing/.test(a.text)));
});

test('version 11 saves can feast', () => {
  const old = newGame({ seed: 2 });
  old.version = 11;
  delete old.lastFeast;
  delete old.orders.harvestFeast;
  delete old.deeds.feasts;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.lastFeast, -99);
  assert.equal(s.orders.harvestFeast, false);
  assert.equal(s.deeds.feasts, 0);
});
