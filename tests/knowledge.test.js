import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, migrate, hasKnowledge, knowledgeBlocker, spoilageRate, fieldPlots,
} from '../js/engine/state.js';
import { expectedFood, expectedHarvest } from '../js/engine/rules.js';
import { describePending } from '../js/engine/events.js';
import { getAdvice } from '../js/engine/advisors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

const settle = (state) => {
  if (state.pendingEvent && state.pendingEvent.type === 'raid') return act(state, { type: 'resolveRaid', plan: 'hide' });
  if (state.pendingEvent) return act(state, { type: 'resolveEvent', choice: describePending(state).options[0].id });
  return state;
};

const everyone = (state, task) => {
  for (const p of living(state)) state = act(state, { type: 'assign', personId: p.id, task });
  return state;
};

test('studying makes a discovery', () => {
  let s = newGame({ seed: 4 });
  s = act(s, { type: 'setStudy', knowledgeId: 'spears' });
  s.resources.food = 500;
  s = everyone(s, 'study');
  s = act(s, { type: 'endTurn' });
  assert.ok(hasKnowledge(s, 'spears'));
  assert.equal(s.knowledge.current, null);
  assert.ok(s.report.urgent.some((line) => /Discovery: Fire-hardened spears/.test(line)));
});

test('discoveries need their prerequisites and places', () => {
  const s = newGame({ seed: 4 });
  assert.match(knowledgeBlocker(s, 'pottery'), /Smoking and drying/);
  assert.match(knowledgeBlocker(s, 'medicine'), /Herb hillside/);
  assert.match(applyAction(s, { type: 'setStudy', knowledgeId: 'farming' }).error, /Stone tools/);
  s.knowledge.learned.push('stoneTools');
  assert.match(knowledgeBlocker(s, 'farming'), /North meadow/);
  s.places.meadow.known = true;
  assert.equal(knowledgeBlocker(s, 'farming'), null);
});

test('spears improve hunting; smoking and pottery cut spoilage', () => {
  const s = newGame({ seed: 4 });
  const aric = s.people[0];
  const before = expectedFood(s, aric, 'hunt', 0);
  const spoilBefore = spoilageRate(s);
  s.knowledge.learned.push('spears', 'smoking', 'pottery');
  assert.ok(expectedFood(s, aric, 'hunt', 0) > before);
  assert.ok(Math.abs(spoilageRate(s) - spoilBefore / 3) < 1e-9);
});

test('farming and fields are locked until farming is known', () => {
  const s = newGame({ seed: 4 });
  assert.match(applyAction(s, { type: 'assign', personId: 1, task: 'farm' }).error, /do not know/);
  s.resources.wood = 100;
  assert.match(applyAction(s, { type: 'startProject', buildingId: 'fields' }).error, /Farming/);
});

test('a year of farming: plant, tend, harvest', () => {
  let s = newGame({ seed: 4 });
  s.knowledge.learned.push('farming');
  s.buildings.fields = 2; // 12 plots
  s.resources.food = 500;
  s.resources.wood = 500;
  s.buildings.leanTo = 5;
  s = everyone(s, 'rest');
  const farmers = living(s).filter((p) => p.age < 55).slice(0, 6).map((p) => p.id);
  for (const id of farmers) s = act(s, { type: 'assign', personId: id, task: 'farm' });
  assert.ok(expectedHarvest(s) > 100, 'the steward should expect a good harvest');
  s = act(s, { type: 'endTurn' }); // spring: plant
  s = settle(s);
  assert.equal(s.farm.planted, 12);
  s = act(s, { type: 'endTurn' }); // summer: tend
  s = settle(s);
  assert.equal(s.farm.tended, 12);
  const foodBefore = s.resources.food;
  s = act(s, { type: 'endTurn' }); // autumn: harvest
  assert.ok(s.report.events.some((line) => /Harvest: 120 food/.test(line)), s.report.events.join(' | '));
  assert.equal(s.farm.planted, 0);
  assert.ok(s.resources.food > foodBefore - 40);
  assert.equal(fieldPlots(s), 12);
});

test('the scholar asks for a study goal', () => {
  let s = newGame({ seed: 4 });
  s = act(s, { type: 'assign', personId: 4, task: 'study' });
  assert.ok(getAdvice(s).some((a) => a.role === 'scholar' && /no discovery is chosen/.test(a.text)));
});

test('version 3 saves are upgraded with learning skills and a scholar', () => {
  const old = newGame({ seed: 2 });
  old.version = 3;
  delete old.knowledge;
  delete old.farm;
  delete old.buildings.fields;
  delete old.advisors.scholar;
  for (const p of old.people) delete p.skills.learning;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, 11);
  assert.equal(s.people.find((p) => p.name === 'Dalia').skills.learning, 4);
  assert.ok(s.advisors.scholar);
  assert.deepEqual(s.knowledge, { learned: [], progress: {}, current: null, queue: [] });
});

test('skills improve with practice, faster at first', async () => {
  const { gainExperience, experienceNeeded, seasonsToNextLevel } = await import('../js/engine/skills.js');
  const p = { skills: { hunting: 0 }, xp: {} };
  let seasons = 0;
  while (p.skills.hunting < 2) { gainExperience(p, 'hunting'); seasons += 1; }
  assert.equal(seasons, experienceNeeded(0) + experienceNeeded(1));
  p.skills.hunting = 5;
  assert.equal(gainExperience(p, 'hunting'), null);
  assert.equal(seasonsToNextLevel(p, 'hunting'), null);
});

test('a season of hunting is practice', () => {
  let s = newGame({ seed: 4 });
  s.resources.food = 500;
  const kael = s.people.find((p) => p.name === 'Kael');
  s = act(s, { type: 'assign', personId: kael.id, task: 'hunt' });
  s = act(s, { type: 'endTurn' });
  // One season of practice, plus a little more for hunting beside Aric, a skilled mentor.
  assert.equal(s.people.find((p) => p.name === 'Kael').xp.hunting, 1.5);
});
