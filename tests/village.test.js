import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, migrate, makePerson, shelterCapacity, inVillage, taskAvailable,
} from '../js/engine/state.js';
import {
  villageBlocker, groups, notablePeople, settlerChance, maybeSettlers,
} from '../js/engine/village.js';
import { councilTargets, villagePlan } from '../js/engine/assign.js';
import { queueBlocker } from '../js/engine/building.js';
import { fighterStrength } from '../js/engine/battle.js';
import { applyStandingOrders } from '../js/engine/orders.js';
import { describePending } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A camp that has reached the milestone, with a few extra people.
function readyCamp(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 6; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  s.buildings.storehouse = 1;
  s.buildings.palisade = 1;
  s.buildings.leanTo = 4;
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 200;
  s.resources.wood = 80;
  return s;
}

test('a camp can become a village only after the milestone, and only by choice', () => {
  const camp = newGame({ seed: 1 });
  assert.match(villageBlocker(camp), /16 people/);
  assert.match(applyAction(camp, { type: 'foundVillage' }).error, /16 people/);
  let s = readyCamp();
  assert.equal(villageBlocker(s), null);
  assert.ok(!inVillage(s), 'reaching the milestone does not make a village by itself');
  s = act(s, { type: 'foundVillage' });
  assert.ok(inVillage(s));
  assert.equal(s.era, 'village');
  assert.equal(s.orders.autoAssign, true);
  assert.match(applyAction(s, { type: 'foundVillage' }).error, /already/);
});

test('in a village the council assigns work, and the player sets priorities', () => {
  let s = act(readyCamp(), { type: 'foundVillage' });
  const p = living(s)[0];
  assert.match(applyAction(s, { type: 'assign', personId: p.id, task: 'wood' }).error, /council assigns/);
  assert.match(applyAction(s, { type: 'assignAll', fromTask: 'hunt', task: 'wood' }).error, /council assigns/);
  s = act(s, { type: 'setPriority', area: 'defense', level: 'high' });
  assert.equal(s.priorities.defense, 'high');
  assert.match(applyAction(s, { type: 'setPriority', area: 'defense', level: 'huge' }).error, /low, normal, or high/);
  assert.match(applyAction(newGame({ seed: 1 }), { type: 'setPriority', area: 'defense', level: 'high' }).error, /becomes a village/);
});

test('priorities change how many people the council puts on each task', () => {
  const s = act(readyCamp(), { type: 'foundVillage' });
  s.knowledge.current = 'spears';
  const workers = living(s);
  s.priorities = { building: 'normal', learning: 'low', defense: 'low', exploration: 'low' };
  const low = councilTargets(s, workers);
  s.priorities = { building: 'normal', learning: 'high', defense: 'high', exploration: 'high' };
  const high = councilTargets(s, workers);
  assert.equal(low.guard, 0);
  assert.ok(high.guard >= 2);
  assert.ok(high.study > low.study);
  const plan = villagePlan(s);
  assert.equal([...plan.values()].filter((t) => t === 'guard').length, high.guard);
});

test('the council keeps the fields and the fires covered first', () => {
  const s = act(readyCamp(), { type: 'foundVillage' });
  s.buildings.fields = 2;
  s.turn = 4; // Spring.
  s.resources.wood = 0;
  const plan = villagePlan(s);
  const count = (t) => [...plan.values()].filter((x) => x === t).length;
  assert.ok(count('farm') >= 6, 'enough farmers to plant 12 plots');
  assert.ok(count('wood') >= 1, 'someone gathers wood when the woodpile is empty');
});

test('each season the council sets everyone\'s work', () => {
  let s = act(readyCamp(), { type: 'foundVillage' });
  for (const p of living(s)) p.task = 'rest';
  const lines = applyStandingOrders(s);
  assert.ok(living(s).some((p) => p.task !== 'rest'));
  assert.ok(lines.orders.some((l) => /council set everyone's work/.test(l)));
});

test('huts and guards come with the village', () => {
  const camp = readyCamp();
  assert.match(queueBlocker(camp, 'hut'), /becomes a village/);
  assert.ok(!taskAvailable(camp, 'guard'));
  const s = act(camp, { type: 'foundVillage' });
  assert.equal(queueBlocker(s, 'hut'), null);
  assert.ok(taskAvailable(s, 'guard'));
  const before = shelterCapacity(s);
  s.buildings.hut = 1;
  assert.equal(shelterCapacity(s), before + 8);
  const p = living(s)[0];
  p.task = 'hunt';
  const hunter = fighterStrength(s, p);
  p.task = 'guard';
  assert.ok(fighterStrength(s, p) > hunter, 'guards fight harder');
});

test('a thriving village draws settlers, but not when food or shelter is short', () => {
  const s = act(readyCamp(), { type: 'foundVillage' });
  s.buildings.leanTo = 6;
  assert.ok(settlerChance(s) > 0);
  const before = living(s).length;
  let lines = [];
  for (let i = 0; i < 40 && !lines.length; i++) lines = maybeSettlers(s);
  assert.ok(living(s).length > before);
  assert.match(lines[0], /come to settle/);
  s.resources.food = 0;
  assert.equal(settlerChance(s), 0);
  assert.equal(settlerChance(readyCamp()), 0, 'camps do not draw settlers');
});

test('the village shows its people as groups, and keeps its notable people named', () => {
  const s = act(readyCamp(), { type: 'foundVillage' });
  const g = groups(s);
  assert.equal(g.reduce((sum, x) => sum + x.count, 0), living(s).length);
  assert.ok(g.every((x) => x.name && x.count > 0));
  const notable = notablePeople(s);
  assert.ok(notable.some((p) => p.id === s.advisors.steward));
  assert.ok(notable.some((p) => p.name === 'Brenna'), 'a master forager');
});

test('version 12 saves start as camps', () => {
  const old = newGame({ seed: 2 });
  old.version = 12;
  delete old.era;
  delete old.priorities;
  delete old.buildings.hut;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, 13);
  assert.equal(s.era, 'camp');
  assert.equal(s.priorities.defense, 'normal');
  assert.equal(s.buildings.hut, 0);
});

test('a village plays on season after season', () => {
  let s = act(readyCamp(3), { type: 'foundVillage' });
  for (let i = 0; i < 12 && !s.gameOver; i++) {
    if (s.pendingEvent && s.pendingEvent.type === 'story') s = act(s, { type: 'resolveEvent', choice: describePending(s).options[0].id });
    if (s.pendingEvent && s.pendingEvent.type === 'raid') s = act(s, { type: 'resolveRaid', plan: 'hide' });
    if (s.gameOver) break;
    s = act(s, { type: 'endTurn' });
  }
  assert.ok(living(s).length > 0);
  assert.equal(s.turn, 12, 'twelve seasons passed');
});
