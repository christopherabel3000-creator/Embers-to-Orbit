// The council's food stores: it keeps some seasons of food, sows only what
// the stores need, and sends spare hands to building and crafts once they
// are full.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, foodNeeded, storageCapacity, foodStoreTarget, foodStocked, fieldPlots,
} from '../js/engine/state.js';
import { villagePlan, plotsToSow } from '../js/engine/assign.js';
import { foodPerPlot } from '../js/engine/rules.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 10; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 8, fields: 4 });
  s.knowledge.learned.push('farming', 'weaving', 'pottery');
  s.knowledge.current = null;
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.wood = 200;
  const v = act(s, { type: 'foundVillage' });
  for (const p of living(v)) { p.health = 100; p.sick = false; }
  v.turn = 4; // Spring.
  v.farm = { planted: 0, tended: 0 };
  return v;
}

const tasks = (plan) => [...plan.values()];
const count = (plan, task) => tasks(plan).filter((t) => t === task).length;

test('the council keeps about 8 seasons of food by default, never more than the stores hold', () => {
  const s = village();
  assert.equal(s.foodStores, 8);
  const need = foodNeeded(living(s));
  assert.equal(foodStoreTarget(s), Math.min(storageCapacity(s), 8 * need));
  s.foodStores = 'full';
  assert.equal(foodStoreTarget(s), storageCapacity(s));
  s.foodStores = 4;
  assert.equal(foodStoreTarget(s), 4 * need);
  s.buildings.storehouse = 0;
  s.knowledge.learned = s.knowledge.learned.filter((k) => k !== 'pottery');
  s.foodStores = 12;
  assert.equal(foodStoreTarget(s), storageCapacity(s), 'a target beyond the stores is only what they hold');
});

test('the player chooses how much food to keep, once the camp is a village', () => {
  let s = village();
  s = act(s, { type: 'setFoodStores', choice: '12' });
  assert.equal(s.foodStores, 12);
  s = act(s, { type: 'setFoodStores', choice: 'full' });
  assert.equal(s.foodStores, 'full');
  assert.match(applyAction(s, { type: 'setFoodStores', choice: '7' }).error, /Choose/);
  const camp = newGame({ seed: 1 });
  assert.match(applyAction(camp, { type: 'setFoodStores', choice: '8' }).error, /village/);
});

test('in spring the council sows only what the stores need', () => {
  const s = village();
  const plots = fieldPlots(s);
  s.resources.food = 0;
  assert.equal(plotsToSow(s), plots, 'empty stores: sow every plot');
  s.resources.food = foodStoreTarget(s) + 3 * foodNeeded(living(s));
  assert.equal(plotsToSow(s), 0, 'full stores: sow nothing');
  assert.equal(count(villagePlan(s), 'farm'), 0);
  s.resources.food -= Math.round(foodPerPlot(1, s) * 4);
  assert.equal(plotsToSow(s), 4, 'a little short: sow just enough');
  assert.equal(count(villagePlan(s), 'farm'), 2, 'two farmers sow four plots');
});

test('what was sown is still tended and harvested, however full the stores', () => {
  const s = village();
  s.turn = 5; // Summer.
  s.farm.planted = 12;
  s.resources.food = storageCapacity(s);
  assert.ok(count(villagePlan(s), 'farm') >= 4);
});

test('with the stores full, spare hands build and make goods instead of gathering food', () => {
  const s = village();
  s.turn = 5; // Summer: no sowing to do.
  s.resources.food = foodStoreTarget(s);
  assert.ok(foodStocked(s));
  for (let i = 0; i < 4; i++) s.buildQueue.push({ id: 'hut', progress: 0, paid: false });
  const plan = villagePlan(s);
  assert.equal(count(plan, 'hunt') + count(plan, 'forage'), 0, 'no one gathers food');
  assert.ok(count(plan, 'build') >= 3, 'more builders than usual');
  assert.ok(count(plan, 'craft') >= 3, 'the rest make goods');

  // Below the target, spare hands go back to food.
  s.resources.food = foodStoreTarget(s) - 1;
  const short = villagePlan(s);
  assert.ok(count(short, 'hunt') + count(short, 'forage') >= 4);
});

test('spare builders are not sent to a queue that is waiting for stone', () => {
  const s = village();
  s.turn = 5;
  s.resources.food = foodStoreTarget(s);
  s.resources.stone = 0;
  s.buildQueue.push({ id: 'granary', progress: 0, paid: false });
  const plan = villagePlan(s);
  assert.ok(count(plan, 'build') <= 2, 'no crowd of builders standing idle');
  assert.ok(count(plan, 'craft') >= 3);
});

test('older saves keep 8 seasons of food', () => {
  const s = village();
  const old = structuredClone(s);
  old.version = 22;
  delete old.foodStores;
  assert.equal(migrate(old).foodStores, 8);
});
