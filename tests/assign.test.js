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
