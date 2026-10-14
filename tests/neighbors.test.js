import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION } from '../js/engine/state.js';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, migrate, hasKnowledge, metNeighbors } from '../js/engine/state.js';
import { diplomacyOptions, raidModifier, driftRelations } from '../js/engine/neighbors.js';
import { maybeStartEvent, describePending } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

test('no one is known at the start', () => {
  const s = newGame({ seed: 1 });
  assert.deepEqual(metNeighbors(s), []);
  assert.match(applyAction(s, { type: 'diplomacy', neighborId: 'velari', act: 'giftFood' }).error, /not met/);
});

test('scouts who find a people\'s home make first contact', () => {
  let s = newGame({ seed: 5 });
  s.places.meadow.known = true;
  s = act(s, { type: 'setWorkSite', task: 'scout', placeId: 'meadow' });
  for (const p of living(s)) s = act(s, { type: 'assign', personId: p.id, task: 'scout' });
  s.wanderersMet = 99;
  s.resources.food = 500;
  s.places.herbHillside.known = true;
  s.places.abandonedCamp.known = true;
  s = act(s, { type: 'endTurn' });
  assert.ok(s.neighbors.velari.known);
  assert.equal(s.pendingEvent.id, 'firstContact');
  const view = describePending(s);
  assert.match(view.title, /Velari/);
  s = act(s, { type: 'resolveEvent', choice: 'gift' });
  assert.equal(s.neighbors.velari.relation, 25);
  assert.equal(s.neighbors.velari.contactPending, false);
});

test('one envoy per neighbor per season, and gifts improve relations', () => {
  let s = newGame({ seed: 1 });
  s.neighbors.velari.known = true;
  s = act(s, { type: 'diplomacy', neighborId: 'velari', act: 'giftFood' });
  assert.equal(s.neighbors.velari.relation, 16);
  assert.equal(s.resources.food, 40);
  assert.match(applyAction(s, { type: 'diplomacy', neighborId: 'velari', act: 'giftWood' }).error, /already visited/);
});

test('trade rates improve with friendship', () => {
  const s = newGame({ seed: 1 });
  s.neighbors.tellani.known = true;
  const cold = diplomacyOptions(s, 'tellani').find((o) => o.key === 'woodForFood').label;
  s.neighbors.tellani.relation = 60;
  const warm = diplomacyOptions(s, 'tellani').find((o) => o.key === 'woodForFood').label;
  assert.notEqual(cold, warm);
  assert.match(warm, /22 food/);
});

test('close friends among the Velari will teach farming', () => {
  let s = newGame({ seed: 1 });
  s.neighbors.velari.known = true;
  assert.match(applyAction(s, { type: 'diplomacy', neighborId: 'velari', act: 'learnFarming' }).error, /at least 40/);
  s.neighbors.velari.relation = 45;
  s = act(s, { type: 'diplomacy', neighborId: 'velari', act: 'learnFarming' });
  assert.ok(hasKnowledge(s, 'farming'));
});

test('the Skarn shape raids: tribute and peace keep them away', () => {
  let s = newGame({ seed: 1 });
  s.neighbors.skarn.known = true;
  s.neighbors.skarn.relation = -50;
  assert.equal(raidModifier(s), 1.5);
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'tribute' });
  assert.equal(raidModifier(s), 0.3);
  s.turn += 4;
  assert.ok(raidModifier(s) > 1);
  s.neighbors.skarn.relation = 15;
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'peace' });
  assert.ok(s.neighbors.skarn.peace);
  assert.equal(raidModifier(s), 0.3);
});

test('fighting off a raid reveals the Skarn', () => {
  let s = newGame({ seed: 1 });
  s.pendingEvent = { type: 'raid', raiders: 2, warned: true, from: 'skarn' };
  s = act(s, { type: 'resolveRaid', plan: 'fight', defenderIds: living(s).map((p) => p.id) });
  assert.ok(s.neighbors.skarn.known);
  assert.ok(s.report.urgent.some((l) => /the Skarn/.test(l)));
});

test('relations drift back toward each people\'s nature', () => {
  const s = newGame({ seed: 1 });
  s.neighbors.skarn.relation = 0;
  driftRelations(s);
  assert.equal(s.neighbors.skarn.relation, -1);
});

test('defying the Skarn brings raiders soon', () => {
  let s = newGame({ seed: 1 });
  s.neighbors.skarn.known = true;
  s.pendingEvent = { type: 'story', id: 'skarnDemand' };
  s = act(s, { type: 'resolveEvent', choice: 'defy' });
  assert.ok(s.raidThreat);
  assert.ok(raidModifier(s) >= 2);
});

test('version 9 saves gain neighbors and a speaker', () => {
  const old = newGame({ seed: 2 });
  old.version = 9;
  delete old.neighbors;
  delete old.advisors.speaker;
  delete old.places.velariFields;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.ok(s.neighbors.velari && s.advisors.speaker && s.places.velariFields);
});
