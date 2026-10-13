import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, migrate, isKnown, seasonIndex } from '../js/engine/state.js';
import { expectedFood } from '../js/engine/rules.js';
import { applyStandingOrders } from '../js/engine/orders.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

const byName = (state, name) => state.people.find((p) => p.name === name);

test('only nearby places are known at the start', () => {
  const s = newGame({ seed: 1 });
  assert.ok(isKnown(s, 'camp') && isKnown(s, 'riverbank') && isKnown(s, 'oakWoods'));
  assert.ok(!isKnown(s, 'deerTrails'));
});

test('work sites must be known and suited to the work', () => {
  let s = newGame({ seed: 1 });
  assert.match(applyAction(s, { type: 'setWorkSite', task: 'hunt', placeId: 'deerTrails' }).error, /not found/);
  assert.match(applyAction(s, { type: 'setWorkSite', task: 'wood', placeId: 'riverbank' }).error, /no place/);
  s = act(s, { type: 'setWorkSite', task: 'hunt', placeId: 'riverbank' });
  assert.equal(s.workSites.hunt, 'riverbank');
});

test('a better site yields more, and overuse wears it down', () => {
  let s = newGame({ seed: 1 });
  const aric = byName(s, 'Aric');
  const atCamp = expectedFood(s, aric, 'hunt', 0);
  s.places.deerTrails.known = true;
  s = act(s, { type: 'setWorkSite', task: 'hunt', placeId: 'deerTrails' });
  assert.ok(expectedFood(s, byName(s, 'Aric'), 'hunt', 0) > atCamp);
  for (const p of living(s)) s = act(s, { type: 'assign', personId: p.id, task: 'hunt' });
  s = act(s, { type: 'endTurn' });
  assert.ok(s.places.deerTrails.abundance.hunt < 50);
  assert.equal(s.places.camp.abundance.hunt, 100);
});

test('scouts explore paths leading from their chosen place', () => {
  let s = newGame({ seed: 5 });
  s = act(s, { type: 'setWorkSite', task: 'scout', placeId: 'oakWoods' });
  for (const p of living(s)) s = act(s, { type: 'assign', personId: p.id, task: 'scout' });
  s.wanderersMet = 99; // No wanderers, so every success is a place.
  s = act(s, { type: 'endTurn' });
  assert.ok(isKnown(s, 'deerTrails') && isKnown(s, 'deadfall'));
  assert.ok(!isKnown(s, 'raiderTrail'));
});

test('version 1 saves are upgraded', () => {
  const old = newGame({ seed: 2 });
  old.version = 1;
  delete old.places;
  delete old.workSites;
  delete old.orders;
  old.discoveries = ['huntingGrounds', 'raiderTracks'];
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, 11);
  assert.deepEqual(s.conditions, []);
  assert.ok(isKnown(s, 'deerTrails') && isKnown(s, 'raiderTrail'));
  assert.equal(s.orders.raidPolicy, 'ask');
  assert.equal(migrate({ hello: 'world' }), null);
});

test('the badly hurt rest, then return to their task when healed', () => {
  const s = newGame({ seed: 1 });
  const jora = byName(s, 'Jora');
  jora.health = 30;
  applyStandingOrders(s);
  assert.equal(jora.task, 'rest');
  jora.health = 80;
  applyStandingOrders(s);
  assert.equal(jora.task, 'hunt');
});

test('a player override cancels an order’s plan to move someone back', () => {
  let s = newGame({ seed: 1 });
  byName(s, 'Jora').health = 30;
  applyStandingOrders(s);
  s = act(s, { type: 'assign', personId: byName(s, 'Jora').id, task: 'rest' });
  byName(s, 'Jora').health = 80;
  applyStandingOrders(s);
  assert.equal(byName(s, 'Jora').task, 'rest');
});

test('foragers hunt in winter and forage again in spring', () => {
  let s = newGame({ seed: 1 });
  s = act(s, { type: 'setOrder', id: 'winterForagers', value: true });
  s.turn = 3;
  assert.equal(seasonIndex(s), 3);
  applyStandingOrders(s);
  assert.equal(byName(s, 'Brenna').task, 'hunt');
  s.turn = 4;
  applyStandingOrders(s);
  assert.equal(byName(s, 'Brenna').task, 'forage');
});

test('the food reserve order moves people to gathering food', () => {
  let s = newGame({ seed: 1 });
  for (const p of living(s)) s = act(s, { type: 'assign', personId: p.id, task: 'wood' });
  s = act(s, { type: 'setOrder', id: 'foodReserve', value: 2 });
  const { orders } = applyStandingOrders(s);
  const gatherers = living(s).filter((p) => p.task === 'hunt' || p.task === 'forage');
  assert.ok(gatherers.length > 0);
  assert.ok(living(s).some((p) => p.task === 'wood'), 'keeps at least one woodcutter');
  assert.ok(orders.some((line) => /moved/.test(line)));
});

test('a raid policy can resolve raids automatically', () => {
  let s = newGame({ seed: 1 });
  s = act(s, { type: 'setOrder', id: 'raidPolicy', value: 'auto' });
  s.pendingEvent = { type: 'raid', raiders: 30, warned: true };
  const { urgent } = applyStandingOrders(s);
  assert.equal(s.pendingEvent, null);
  assert.ok(urgent.some((line) => /hide/.test(line)));
});

test('orders reject bad values', () => {
  const s = newGame({ seed: 1 });
  assert.ok(applyAction(s, { type: 'setOrder', id: 'foodReserve', value: 9 }).error);
  assert.ok(applyAction(s, { type: 'setOrder', id: 'raidPolicy', value: 'panic' }).error);
  assert.ok(applyAction(s, { type: 'setOrder', id: 'nonsense', value: true }).error);
});
