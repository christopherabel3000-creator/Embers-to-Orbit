import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, foodNeeded, shelterNeeded, allowedTasksFor, lifeStage, migrate, makePerson,
} from '../js/engine/state.js';
import { advanceLife } from '../js/engine/life.js';
import { birthOutlook } from '../js/engine/population.js';
import { workFactor } from '../js/engine/rules.js';

function child(state, age) {
  const p = makePerson({ name: `Kid${age}`, note: '', age, skills: { hunting: 0, foraging: 0, building: 0, healing: 0, scouting: 0, learning: 0 } }, state.nextPersonId++, 'rest');
  state.people.push(p);
  return p;
}

test('children eat less and take half a place in the shelter', () => {
  const s = newGame({ seed: 1 });
  const before = foodNeeded(living(s));
  child(s, 3);
  assert.equal(foodNeeded(living(s)), before + 1);
  assert.equal(shelterNeeded(living(s)), 12.5);
});

test('work depends on age', () => {
  const s = newGame({ seed: 1 });
  const baby = child(s, 2);
  const kid = child(s, 8);
  assert.equal(lifeStage(baby), 'infant');
  assert.deepEqual(allowedTasksFor(s, baby), ['rest']);
  assert.ok(!allowedTasksFor(s, kid).includes('hunt'));
  assert.ok(allowedTasksFor(s, kid).includes('forage'));
  assert.equal(workFactor(baby), 0);
  assert.equal(workFactor(kid), 0.5);
  assert.match(applyAction(s, { type: 'assign', personId: kid.id, task: 'hunt' }).error, /too young/);
  assert.match(applyAction(s, { type: 'assign', personId: baby.id, task: 'forage' }).error, /too young to work/);
});

test('everyone ages in spring, and children grow into new roles', () => {
  const s = newGame({ seed: 1 });
  const kid = child(s, 4);
  s.turn = 4; // Spring, Year 2
  const lines = advanceLife(s);
  assert.equal(kid.age, 5);
  assert.equal(kid.task, 'forage');
  assert.ok(lines.events.some((l) => /old enough to help/.test(l)));
  assert.equal(s.people.find((p) => p.name === 'Aric').age, 35);
});

test('a well-fed, sheltered, happy camp has babies', () => {
  const s = newGame({ seed: 7 });
  s.resources.food = 500;
  s.buildings.leanTo = 10;
  for (const p of s.people) p.morale = 80;
  assert.ok(birthOutlook(s).chance > 0.1);
  let births = 0;
  for (let i = 0; i < 40; i++) {
    s.turn += 1;
    const before = s.people.length;
    advanceLife(s);
    births += s.people.length - before;
  }
  assert.ok(births >= 3, `expected several births, got ${births}`);
  const baby = s.people.find((p) => p.parent);
  assert.ok(baby.age < 12 && baby.task === 'rest' || baby.age >= 5);
});

test('hunger and crowding slow births', () => {
  const s = newGame({ seed: 7 });
  s.resources.food = 0;
  const outlook = birthOutlook(s);
  assert.ok(outlook.reasons.includes('food is short'));
  assert.ok(outlook.reasons.includes('the shelters are full'));
});

test('the old eventually die, and advisors are replaced', () => {
  const s = newGame({ seed: 3 });
  const dalia = s.people.find((p) => p.name === 'Dalia');
  dalia.age = 90;
  for (let y = 0; y < 30 && dalia.alive; y++) {
    s.turn += 4;
    advanceLife(s);
  }
  assert.ok(!dalia.alive);
  const healer = s.people.find((p) => p.id === s.advisors.healer);
  assert.ok(healer.alive && healer.age >= 16);
});

test('children cannot be sent to fight raiders', () => {
  let s = newGame({ seed: 1 });
  const kid = child(s, 9);
  s.pendingEvent = { type: 'raid', raiders: 1, warned: true };
  const r = applyAction(s, { type: 'resolveRaid', plan: 'fight', defenderIds: [kid.id] });
  assert.match(r.error, /at least one defender/);
});

test('version 5 saves are upgraded with ages', () => {
  const old = newGame({ seed: 2 });
  old.version = 5;
  for (const p of old.people) delete p.age;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, 9);
  assert.equal(s.people.find((p) => p.name === 'Dalia').age, 40);
});

test('version 6 saves give Dalia her new starting age', () => {
  const old = newGame({ seed: 2 });
  old.version = 6;
  old.people.find((p) => p.name === 'Dalia').age = 63; // Two years into an old save.
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.people.find((p) => p.name === 'Dalia').age, 42);
});
