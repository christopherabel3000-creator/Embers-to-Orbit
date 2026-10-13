import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living } from '../js/engine/state.js';
import {
  createBattle, formationPlan, battleView, estimateBattle, ZONES,
} from '../js/engine/battle.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function raidState(raiders = 10, extra = {}) {
  const s = newGame({ seed: 21 });
  s.pendingEvent = { type: 'raid', raiders, warned: true, from: 'skarn', ...extra };
  return s;
}

test('formations place every fighter somewhere sensible', () => {
  const s = raidState();
  const battle = createBattle(s, s.pendingEvent);
  for (const f of ['even', 'center', 'left', 'right', 'reserve', 'mirror']) {
    const plan = formationPlan(s, battle, f);
    assert.equal(Object.keys(plan).length, living(s).length, f);
  }
  const reserve = Object.values(formationPlan(s, battle, 'reserve')).filter((z) => z === 'reserve');
  assert.ok(reserve.length >= 2);
});

test('a battle fought round by round ends in an outcome', () => {
  let s = raidState(12);
  const view = battleView(s);
  assert.equal(view.phase, 'deploy');
  s = act(s, { type: 'battleDeploy', assignments: view.plan });
  assert.equal(s.pendingEvent.battle.phase, 'fight');
  let rounds = 0;
  while (s.pendingEvent && rounds < 6) {
    const v = battleView(s);
    assert.equal(v.zones.length, 3);
    s = act(s, { type: 'battleOrders', orders: v.advice });
    rounds += 1;
  }
  assert.equal(s.pendingEvent, null, 'the battle finished');
  assert.ok(s.report.urgent.some((l) => /lasted/.test(l)));
});

test('leaving a zone empty lets raiders reach the stores', () => {
  let s = raidState(12);
  s.resources.food = 100;
  const plan = {};
  for (const p of living(s)) plan[p.id] = 'center';
  s = act(s, { type: 'battleDeploy', assignments: plan });
  const before = s.resources.food;
  s = act(s, { type: 'battleOrders', orders: { center: 'hold' } });
  const battle = s.pendingEvent ? s.pendingEvent.battle : null;
  const looted = battle ? battle.loot.food : before - s.resources.food;
  assert.ok(looted > 0 || s.resources.food < before);
});

test('retreating ends the battle with a loss of stores', () => {
  let s = raidState(12);
  s = act(s, { type: 'battleDeploy', assignments: battleView(s).plan });
  const food = s.resources.food;
  s = act(s, { type: 'battleRetreat' });
  assert.equal(s.pendingEvent, null);
  assert.ok(s.resources.food < food);
});

test('the war chief can fight the whole battle', () => {
  let s = raidState(8);
  s = act(s, { type: 'battleAuto' });
  assert.equal(s.pendingEvent, null);
  assert.ok(s.report.urgent.some((l) => /lasted/.test(l)));
});

test('more raiders and no palisade mean worse odds', () => {
  const s = raidState(8);
  const easy = estimateBattle(s, s.pendingEvent, null, 12);
  const hard = estimateBattle(s, { ...s.pendingEvent, raiders: 22 }, null, 12);
  assert.ok(easy > hard);
  s.buildings.palisade = 1;
  const walled = estimateBattle(s, { ...s.pendingEvent, raiders: 22 }, null, 12);
  assert.ok(walled >= hard);
});

test('an attack on Skarn hold can be launched and called off', () => {
  let s = newGame({ seed: 3 });
  s.neighbors.skarn.known = true;
  s.places.skarnHold.known = true;
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'attack' });
  assert.equal(s.pendingEvent.side, 'attack');
  assert.equal(battleView(s).side, 'attack');
  s = act(s, { type: 'resolveRaid', plan: 'hide' });
  assert.equal(s.pendingEvent, null);
});

test('winning at Skarn hold brings a long truce', () => {
  let s = newGame({ seed: 3 });
  s.neighbors.skarn.known = true;
  s.places.skarnHold.known = true;
  s.knowledge.learned.push('spears');
  for (const p of s.people) p.skills.hunting = 5;
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'attack' });
  s = act(s, { type: 'battleAuto' });
  assert.ok(s.neighbors.skarn.truceUntil >= s.turn + 8);
  assert.ok(s.neighbors.skarn.relation >= 10);
});

test('zones are left, center, and right', () => {
  assert.deepEqual(ZONES, ['left', 'center', 'right']);
});
