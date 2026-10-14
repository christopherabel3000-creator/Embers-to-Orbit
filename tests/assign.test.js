import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson } from '../js/engine/state.js';

const task = (s, name) => s.people.find((p) => p.name === name).task;

test('everyone goes to what they do best, and the hurt rest', () => {
  let s = newGame({ seed: 1 });
  s.people.find((p) => p.name === 'Jora').health = 30;
  s.people.find((p) => p.name === 'Kael').sick = true;
  const r = applyAction(s, { type: 'assignBest' });
  assert.equal(r.error, undefined);
  s = r.state;
  assert.equal(task(s, 'Aric'), 'hunt');
  assert.equal(task(s, 'Brenna'), 'forage');
  assert.equal(task(s, 'Jora'), 'rest');
  assert.equal(task(s, 'Kael'), 'rest');
  assert.equal(task(s, 'Dalia'), 'heal', 'someone is hurt, so the best healer tends them');
  assert.equal(task(s, 'Hesta'), 'wood', 'no project, so builders gather wood');
  assert.match(r.message, /best work/);
});

test('it respects the season, projects, studies, and limits', () => {
  let s = newGame({ seed: 1 });
  s.turn = 3; // Winter
  s = applyAction(s, { type: 'startProject', buildingId: 'leanTo' }).state;
  s = applyAction(s, { type: 'setStudy', knowledgeId: 'spears' }).state;
  s = applyAction(s, { type: 'assignBest' }).state;
  assert.notEqual(task(s, 'Brenna'), 'forage', 'nothing to forage in winter');
  assert.equal(task(s, 'Hesta'), 'build');
  assert.equal(living(s).filter((p) => p.task === 'heal').length, 0, 'no one is hurt');
  assert.ok(living(s).filter((p) => p.task === 'scout').length <= 2);
});

test('children only get work they can do, and infants rest', () => {
  let s = newGame({ seed: 1 });
  const kid = makePerson({ name: 'Alder', note: '', age: 7, skills: { hunting: 5, foraging: 0, building: 0, healing: 0, scouting: 0, learning: 0 } }, 50, 'rest');
  const baby = makePerson({ name: 'Wren', note: '', age: 1, skills: { hunting: 0, foraging: 0, building: 0, healing: 0, scouting: 0, learning: 0 } }, 51, 'rest');
  s.people.push(kid, baby);
  s = applyAction(s, { type: 'assignBest' }).state;
  assert.equal(task(s, 'Alder'), 'forage');
  assert.equal(task(s, 'Wren'), 'rest');
});

test('the best-work standing order reassigns everyone each season', async () => {
  const { applyStandingOrders } = await import('../js/engine/orders.js');
  let s = newGame({ seed: 1 });
  for (const p of living(s)) s = applyAction(s, { type: 'assign', personId: p.id, task: 'rest' }).state;
  s = applyAction(s, { type: 'setOrder', id: 'autoAssign', value: true }).state;
  s.people.find((p) => p.name === 'Jora').health = 30;
  const { orders } = applyStandingOrders(s);
  assert.equal(task(s, 'Aric'), 'hunt');
  assert.equal(task(s, 'Jora'), 'rest');
  assert.ok(orders.some((line) => /best work/.test(line)));
});

const farmingCamp = (turn) => {
  const s = newGame({ seed: 1 });
  s.knowledge.learned.push('farming');
  s.buildings.fields = 2; // 12 plots.
  s.turn = turn;
  return s;
};
const farmers = (s) => living(s).filter((p) => p.task === 'farm');

test('best work sends enough people to plant the fields in spring', () => {
  const s = applyAction(farmingCamp(4), { type: 'assignBest' }).state;
  assert.equal(farmers(s).length, 6, '12 plots, 2 planted per farmer');
  assert.ok(farmers(s).some((p) => p.name === 'Brenna'), 'the best forager farms');
});

test('best work sends people to tend and to harvest what was planted', () => {
  const summer = farmingCamp(5);
  summer.farm.planted = 12;
  assert.equal(farmers(applyAction(summer, { type: 'assignBest' }).state).length, 4);
  const autumn = farmingCamp(6);
  autumn.farm.planted = 12;
  autumn.farm.tended = 12;
  assert.equal(farmers(applyAction(autumn, { type: 'assignBest' }).state).length, 4);
});

test('best work sends no one to the fields in winter or when nothing is planted', () => {
  assert.equal(farmers(applyAction(farmingCamp(7), { type: 'assignBest' }).state).length, 0);
  assert.equal(farmers(applyAction(farmingCamp(5), { type: 'assignBest' }).state).length, 0);
});

test('the best-work order staffs the fields each season, and the harvest comes in', () => {
  let s = farmingCamp(4);
  s.orders.autoAssign = true;
  s.orders.staffFields = true;
  s.resources.food = 300;
  s.resources.wood = 100;
  s = applyAction(s, { type: 'assignBest' }).state;
  for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'endTurn' }).state;
  assert.ok(s.log.some((l) => /Harvest: \d+ food from 12 plots/.test(l.text)), 'all 12 plots were planted and harvested');
});
