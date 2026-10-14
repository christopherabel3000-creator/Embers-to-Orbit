import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living } from '../js/engine/state.js';
import { applyBuildWork, refundFor } from '../js/engine/building.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

test('leftover work flows into the next building', () => {
  let s = newGame({ seed: 1 });
  s.knowledge.learned.push('farming');
  s.resources.wood = 200;
  for (let i = 0; i < 4; i++) s = act(s, { type: 'queueBuilding', buildingId: 'fields' }); // 10 work each
  const lines = applyBuildWork(s, 25);
  assert.equal(s.buildings.fields, 2, 'the first two are built');
  assert.equal(s.buildQueue.length, 2);
  assert.equal(s.buildQueue[0].progress, 5, 'the third is halfway');
  assert.equal(s.buildQueue[1].paid, false, 'the fourth has not started');
  assert.equal(s.resources.wood, 200 - 3 * 15);
  assert.ok(lines.some((l) => /5 of 10/.test(l)));
});

test('building pauses when the next one cannot be paid for', () => {
  let s = newGame({ seed: 1 });
  s.resources.wood = 20;
  s = act(s, { type: 'queueBuilding', buildingId: 'leanTo' }); // 15 wood, 8 work
  s = act(s, { type: 'queueBuilding', buildingId: 'storehouse' }); // 25 wood
  const lines = applyBuildWork(s, 20);
  assert.equal(s.buildings.leanTo, 1);
  assert.equal(s.buildQueue[0].id, 'storehouse');
  assert.equal(s.buildQueue[0].paid, false);
  assert.ok(lines.some((l) => /paused/.test(l)));
});

test('unused work is reported when the queue runs dry', () => {
  const s = newGame({ seed: 1 });
  const lines = applyBuildWork(s, 9);
  assert.ok(lines.some((l) => /9 work went unused/.test(l)));
});

test('removing a building refunds what it cost', () => {
  assert.equal(refundFor({ id: 'leanTo', progress: 0, paid: false }).wood, 0);
  assert.equal(refundFor({ id: 'leanTo', progress: 0, paid: true }).wood, 15);
  assert.equal(refundFor({ id: 'leanTo', progress: 3, paid: true }).wood, 7);
  assert.deepEqual(refundFor({ id: 'market', progress: 0, paid: true }), { wood: 30, stone: 30, goods: 20 });
  assert.deepEqual(refundFor({ id: 'market', progress: 5, paid: true }), { wood: 15, stone: 15, goods: 10 });
});

test('old saves turn their project into the first queued building', async () => {
  const { migrate } = await import('../js/engine/state.js');
  const old = newGame({ seed: 2 });
  old.version = 8;
  delete old.buildQueue;
  delete old.knowledge.queue;
  old.project = { id: 'palisade', progress: 7 };
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(s.buildQueue, [{ id: 'palisade', progress: 7, paid: true }]);
  assert.equal(s.project, undefined);
});

test('studies queue up, and leftover points carry into the next', () => {
  let s = newGame({ seed: 1 });
  s = act(s, { type: 'queueStudy', knowledgeId: 'spears' }); // 15
  s = act(s, { type: 'queueStudy', knowledgeId: 'smoking' }); // 15
  s = act(s, { type: 'queueStudy', knowledgeId: 'pottery' }); // needs smoking
  assert.equal(s.knowledge.current, 'spears');
  return import('../js/engine/study.js').then(({ applyStudy }) => {
    const out = applyStudy(s, 20);
    assert.ok(s.knowledge.learned.includes('spears'));
    assert.equal(s.knowledge.current, 'smoking');
    assert.equal(s.knowledge.progress.smoking, 5);
    applyStudy(s, 10);
    assert.equal(s.knowledge.current, 'pottery', 'pottery became ready once smoking was known');
    assert.ok(out.urgent.some((l) => /Fire-hardened spears/.test(l)));
  });
});

test('the fields order staffs the fields through the year', async () => {
  const { applyStandingOrders } = await import('../js/engine/orders.js');
  let s = newGame({ seed: 1 });
  s.knowledge.learned.push('farming');
  s.buildings.fields = 2; // 12 plots: 6 planters in spring
  s = act(s, { type: 'setOrder', id: 'staffFields', value: true });
  applyStandingOrders(s);
  assert.equal(s.people.filter((p) => p.task === 'farm').length, 6);
  s.turn = 1; // Summer: 12 planted plots need 4 tenders
  s.farm.planted = 12;
  applyStandingOrders(s);
  assert.equal(s.people.filter((p) => p.task === 'farm').length, 4);
  s.turn = 3; // Winter
  applyStandingOrders(s);
  assert.equal(s.people.filter((p) => p.task === 'farm').length, 0);
});

test('the shelter order queues a lean-to when room runs short', async () => {
  const { applyStandingOrders } = await import('../js/engine/orders.js');
  let s = newGame({ seed: 1 });
  s = act(s, { type: 'queueBuilding', buildingId: 'palisade' });
  s = act(s, { type: 'queueBuilding', buildingId: 'storehouse' });
  s.buildQueue[0].paid = true; // The palisade is already underway.
  s = act(s, { type: 'setOrder', id: 'autoShelter', value: true });
  applyStandingOrders(s);
  assert.deepEqual(s.buildQueue.map((b) => b.id), ['palisade', 'leanTo', 'storehouse']);
  applyStandingOrders(s);
  assert.equal(s.buildQueue.filter((b) => b.id === 'leanTo').length, 2, 'one more each season while still short');
});

test('the fires get their wood before any building starts', () => {
  let s = newGame({ seed: 2 });
  s.turn = 3; // Winter: 12 people need 12 wood.
  s.resources.wood = 20;
  s.resources.food = 100;
  for (const p of living(s)) p.task = 'rest';
  s.people[0].task = 'build';
  s = applyAction(s, { type: 'queueBuilding', buildingId: 'leanTo' }).state; // Costs 15.
  s = applyAction(s, { type: 'endTurn' }).state;
  assert.equal(s.resources.wood, 8, 'the fires burned 12, and the lean-to could not start');
  assert.equal(s.buildQueue[0].paid, false);
  assert.ok(!s.report.urgent.some((l) => /not enough firewood/.test(l)), 'no one went cold');
  assert.ok(s.report.events.some((l) => /short after keeping the fires burning/.test(l)));
});
