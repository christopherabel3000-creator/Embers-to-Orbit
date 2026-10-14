import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, migrate, makePerson, knowledgeBlocker, knowledgeClosed, storageCapacity, SAVE_VERSION, taskAvailable,
} from '../js/engine/state.js';
import { KNOWLEDGE, BRANCHES } from '../js/engine/data.js';
import { queueBlocker, costWords, applyBuildWork } from '../js/engine/building.js';
import { expectedStone, expectedGoods, foodPerPlot, studyPoints } from '../js/engine/rules.js';
import { diplomacyOptions } from '../js/engine/neighbors.js';
import { fighterStrength, createBattle } from '../js/engine/battle.js';
import { villagePlan } from '../js/engine/assign.js';
import { applyStudy } from '../js/engine/study.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 6; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 5 });
  s.knowledge.learned.push('farming', 'stoneTools', 'clothing', 'pottery', 'spears');
  s.milestoneReached = true;
  s.resources.food = 200;
  s.resources.wood = 100;
  return act(s, { type: 'foundVillage' });
}

test('every discovery belongs to a branch, and village discoveries wait for a village', () => {
  for (const [id, k] of Object.entries(KNOWLEDGE)) assert.ok(BRANCHES[k.branch], id);
  const camp = newGame({ seed: 1 });
  camp.knowledge.learned.push('stoneTools');
  assert.match(knowledgeBlocker(camp, 'stonecutting'), /once your camp is a village/);
  assert.equal(knowledgeBlocker(village(), 'stonecutting'), null);
});

test('choosing a council of elders closes off a chieftain for good', () => {
  let s = village();
  s.knowledge.learned.push('oralLaw');
  s = act(s, { type: 'queueStudy', knowledgeId: 'chieftain' });
  s = act(s, { type: 'setStudy', knowledgeId: 'elders' });
  applyStudy(s, 100);
  assert.ok(s.knowledge.learned.includes('elders'));
  assert.ok(!s.knowledge.queue.includes('chieftain'), 'the other choice leaves the queue');
  assert.match(knowledgeClosed(s, 'chieftain'), /chose council of elders/);
  assert.match(applyAction(s, { type: 'queueStudy', knowledgeId: 'chieftain' }).error, /chose council of elders/);
  assert.match(applyAction(s, { type: 'setStudy', knowledgeId: 'chieftain' }).error, /chose/);
});

test('stonecutting brings quarrying; the Grey cliffs are the best place for it', () => {
  const s = village();
  assert.ok(!taskAvailable(s, 'quarry'));
  s.knowledge.learned.push('stonecutting');
  assert.ok(taskAvailable(s, 'quarry'));
  const p = living(s)[0];
  const atCamp = expectedStone(s, p);
  s.places.greyCliffs.known = true;
  s.workSites.quarry = 'greyCliffs';
  assert.ok(expectedStone(s, p) > atCamp);
});

test('scouts can find the Grey cliffs beyond the storm deadfall', () => {
  const s = newGame({ seed: 1 });
  s.places.deadfall.known = true;
  const r = applyAction(s, { type: 'setWorkSite', task: 'scout', placeId: 'deadfall' });
  assert.equal(r.error, undefined);
});

test('quarriers cut stone and crafters make goods each season', () => {
  let s = village();
  s.knowledge.learned.push('stonecutting', 'weaving');
  s.priorities.crafts = 'high';
  s.buildQueue.push({ id: 'workshop', progress: 0, paid: false });
  s.orders.comforts = false; // Keep the goods to count them.
  const plan = villagePlan(s);
  const count = (t) => [...plan.values()].filter((x) => x === t).length;
  assert.ok(count('quarry') >= 1, 'the council sends quarriers for the stone the queue needs');
  assert.ok(count('craft') >= 2, 'a high crafts priority puts people on crafts');
  s = act(s, { type: 'assignBest' });
  s = act(s, { type: 'endTurn' });
  assert.ok(s.resources.stone > 0);
  assert.ok(s.resources.goods > 0);
});

test('buildings can cost stone and goods, and wait until they are in the stores', () => {
  const s = village();
  s.knowledge.learned.push('markets', 'weaving', 'stonecutting', 'masonry');
  assert.equal(costWords('market'), '30 wood, 30 stone and 20 goods');
  assert.equal(queueBlocker(s, 'market'), null);
  s.buildQueue = [{ id: 'market', progress: 0, paid: false }];
  s.resources.stone = 10;
  s.resources.goods = 0;
  const lines = applyBuildWork(s, 10);
  assert.equal(s.buildQueue[0].paid, false);
  assert.match(lines.join(' '), /20 stone and 20 goods short/);
  s.resources.stone = 30;
  s.resources.goods = 20;
  applyBuildWork(s, 10);
  assert.equal(s.buildQueue[0].paid, true);
  assert.equal(s.resources.stone, 0);
  assert.equal(s.resources.goods, 0);
});

test('a stone wall needs the palisade first, and makes holding the walls safer', () => {
  const s = village();
  s.knowledge.learned.push('stonecutting', 'masonry');
  s.buildings.palisade = 0;
  assert.match(queueBlocker(s, 'stoneWall'), /needs a palisade first/);
  s.buildings.palisade = 1;
  s.buildings.stoneWall = 1;
  const battle = createBattle(s, { type: 'raid', raiders: 8, warned: true, from: 'skarn' });
  assert.equal(battle.terrain.wall, true);
});

test('granaries add room, pastures feed the village even in winter', () => {
  let s = village();
  const room = storageCapacity(s);
  s.buildings.granary = 1;
  assert.equal(storageCapacity(s), room + 450, '300 more, and half again with pottery');
  s.buildings.pasture = 2;
  s.turn = 7; // Winter.
  s = act(s, { type: 'endTurn' });
  assert.ok(s.report.routine.some((l) => /12 food from the herds/.test(l)), s.report.routine.join(' | '));
});

test('the Tellani buy goods once you can weave; a market brings everyone and better deals', () => {
  const s = village();
  s.neighbors.tellani.known = true;
  s.neighbors.velari.known = true;
  s.resources.goods = 30;
  assert.ok(!diplomacyOptions(s, 'tellani').some((o) => o.key === 'goodsForFood'));
  s.knowledge.learned.push('weaving');
  const tellani = diplomacyOptions(s, 'tellani');
  assert.ok(tellani.some((o) => o.key === 'goodsForFood' && o.ok));
  assert.ok(tellani.some((o) => o.key === 'giftGoods' && o.ok));
  assert.ok(!diplomacyOptions(s, 'velari').some((o) => o.key === 'goodsForFood'));
  const before = Number(tellani.find((o) => o.key === 'goodsForFood').label.match(/for (\d+) food/)[1]);
  s.buildings.market = 1;
  assert.ok(diplomacyOptions(s, 'velari').some((o) => o.key === 'goodsForFood'));
  const after = Number(diplomacyOptions(s, 'tellani').find((o) => o.key === 'goodsForFood').label.match(/for (\d+) food/)[1]);
  assert.ok(after > before);
  const done = act(s, { type: 'diplomacy', neighborId: 'tellani', act: 'goodsForFood' });
  assert.equal(done.resources.goods, 20);
  assert.equal(done.resources.food, 200 + after);
});

test('discoveries change what people do', () => {
  const s = village();
  const p = living(s).find((x) => x.name === 'Hesta');
  const goods = expectedGoods(s, p);
  s.knowledge.learned.push('kilns');
  assert.ok(expectedGoods(s, p) > goods);
  const plot = foodPerPlot(1, s);
  s.knowledge.learned.push('irrigation');
  assert.ok(Math.abs(foodPerPlot(1, s) - (plot + 2)) < 1e-9);
  const study = studyPoints(p, s);
  s.knowledge.learned.push('elders');
  assert.ok(studyPoints(p, s) > study);
  const fight = fighterStrength(s, p);
  s.knowledge.learned.push('bows');
  assert.ok(fighterStrength(s, p) > fight);
  p.task = 'guard';
  const guard = fighterStrength(s, p);
  s.knowledge.learned.push('drill');
  assert.ok(fighterStrength(s, p) > guard);
});

test('version 13 saves gain stone, goods, and a crafts priority', () => {
  const old = newGame({ seed: 2 });
  old.version = 13;
  delete old.resources.stone;
  delete old.resources.goods;
  delete old.workSites.quarry;
  delete old.priorities.crafts;
  delete old.places.greyCliffs;
  delete old.buildings.granary;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.resources.stone, 0);
  assert.equal(s.resources.goods, 0);
  assert.equal(s.workSites.quarry, 'camp');
  assert.equal(s.priorities.crafts, 'normal');
  assert.equal(s.places.greyCliffs.known, false);
  assert.equal(s.buildings.granary, 0);
});
