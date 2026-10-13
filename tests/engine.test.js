import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, dateLabel, shelterCapacity } from '../js/engine/state.js';
import { getAdvice, forecastFood } from '../js/engine/advisors.js';
import { describePending } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// Answers any raid or decision with a simple default.
const settle = (state) => {
  if (state.pendingEvent && state.pendingEvent.type === 'raid') return act(state, { type: 'resolveRaid', plan: 'hide' });
  if (state.pendingEvent) return act(state, { type: 'resolveEvent', choice: describePending(state).options[0].id });
  return state;
};

test('a new game starts in spring with twelve survivors', () => {
  const s = newGame({ seed: 1 });
  assert.equal(dateLabel(s), 'Spring, Year 1');
  assert.equal(living(s).length, 12);
  assert.equal(shelterCapacity(s), 4);
});

test('actions do not change the previous state', () => {
  const s = newGame({ seed: 1 });
  const next = act(s, { type: 'assign', personId: 1, task: 'rest' });
  assert.equal(s.people[0].task, 'hunt');
  assert.equal(next.people[0].task, 'rest');
});

test('starting a project costs wood and needs enough of it', () => {
  let s = newGame({ seed: 1 });
  s = act(s, { type: 'startProject', buildingId: 'leanTo' });
  assert.equal(s.resources.wood, 15);
  const r = applyAction(s, { type: 'startProject', buildingId: 'storehouse' });
  assert.match(r.error, /already underway/);
  s = act(s, { type: 'cancelProject' });
  assert.equal(s.resources.wood, 30);
  const poor = applyAction(s, { type: 'startProject', buildingId: 'palisade' });
  assert.match(poor.error, /Not enough wood/);
});

test('ending a season advances the calendar and finishes buildings', () => {
  let s = newGame({ seed: 3 });
  s = act(s, { type: 'startProject', buildingId: 'leanTo' });
  for (const id of [3, 8, 11]) s = act(s, { type: 'assign', personId: id, task: 'build' });
  s = act(s, { type: 'endTurn' });
  assert.equal(dateLabel(s), 'Summer, Year 1');
  assert.equal(s.buildings.leanTo, 1);
  assert.equal(shelterCapacity(s), 8);
});

test('the same seed and actions give the same result', () => {
  const run = () => {
    let s = newGame({ seed: 42 });
    for (let i = 0; i < 8; i++) {
      s = settle(s);
      s = act(s, { type: 'endTurn' });
    }
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
});

test('a pending raid blocks ending the season until resolved', () => {
  let s = newGame({ seed: 1 });
  s.pendingEvent = { type: 'raid', raiders: 5, warned: true };
  assert.match(applyAction(s, { type: 'endTurn' }).error, /raiders/);
  assert.match(applyAction(s, { type: 'resolveRaid', plan: 'fight', defenderIds: [] }).error, /at least one defender/);
  s = act(s, { type: 'resolveRaid', plan: 'fight', defenderIds: living(s).map((p) => p.id) });
  assert.equal(s.pendingEvent, null);
  s = act(s, { type: 'endTurn' });
});

test('saves survive a JSON round trip', () => {
  let s = newGame({ seed: 9, campName: 'Test Camp' });
  s = act(s, { type: 'endTurn' });
  s = settle(s);
  const loaded = JSON.parse(JSON.stringify(s));
  const a = act(s, { type: 'endTurn' });
  const b = act(loaded, { type: 'endTurn' });
  assert.deepEqual(a, b);
});

test('advisors warn about missing projects and shelter', () => {
  const s = newGame({ seed: 1 });
  const advice = getAdvice(s);
  assert.ok(advice.some((a) => a.role === 'steward' && /no building project/.test(a.text)));
  assert.ok(advice.some((a) => a.role === 'healer' && /shelter holds 4/.test(a.text)));
  assert.ok(forecastFood(s));
});

test('the steward warns when food will run out', () => {
  let s = newGame({ seed: 1 });
  for (const p of s.people) s = act(s, { type: 'assign', personId: p.id, task: 'rest' });
  const advice = getAdvice(s);
  assert.ok(advice.some((a) => a.role === 'steward' && a.severity !== 'note' && /food/.test(a.text)));
});

test('a dead advisor is replaced', () => {
  let s = newGame({ seed: 1 });
  s.people.find((p) => p.name === 'Fenna').health = 1;
  for (const p of s.people) s = act(s, { type: 'assign', personId: p.id, task: 'rest' });
  s.resources.food = 0;
  s = act(s, { type: 'endTurn' });
  const steward = s.people.find((p) => p.id === s.advisors.steward);
  assert.ok(steward.alive);
  assert.notEqual(steward.name, 'Fenna');
});
