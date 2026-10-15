import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, inVillage, eraAtLeast, taskAvailable,
} from '../js/engine/state.js';
import {
  settlementBlocker, settlementSites, settlerRange, governorChoices, settlementProduct,
  settlementsSeason,
} from '../js/engine/settlements.js';
import { expectedShipment } from '../js/engine/realm.js';
import { claimLimit } from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A village of 44 that holds the North meadow and the Grey cliffs.
function readyVillage(seed = 1) {
  let s = newGame({ seed });
  for (let i = 0; i < 32; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 2, palisade: 1, leanTo: 12 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting');
  s.milestoneReached = true;
  for (const id of ['meadow', 'deadfall', 'greyCliffs']) s.places[id].known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  s = act(s, { type: 'claimPlace', placeId: 'oakWoods' });
  s = act(s, { type: 'claimPlace', placeId: 'deadfall' });
  s = act(s, { type: 'claimPlace', placeId: 'greyCliffs' });
  Object.assign(s.resources, { food: 300, wood: 200, stone: 60 });
  return s;
}

const found = (s, extra = {}) => applyAction(s, {
  type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 12, governorId: governorChoices(s)[0].id, policy: 'supply', ...extra,
});

test('a village needs people, land, and supplies before it can found another', () => {
  const camp = newGame({ seed: 1 });
  assert.match(settlementBlocker(camp), /Only a village/);
  const s = readyVillage();
  assert.equal(settlementBlocker(s), null);
  s.resources.stone = 0;
  assert.match(settlementBlocker(s), /short of 30 stone/);
  s.resources.stone = 60;
  s.people = s.people.slice(0, 30);
  assert.match(settlementBlocker(s), /at least 40 people/);
});

test('settlers leave the village, and the Nation era begins', () => {
  const s = readyVillage();
  const before = living(s).length;
  const governor = governorChoices(s)[0];
  const next = found(s).state;
  assert.equal(living(next).length, before - 12);
  assert.ok(!next.people.some((p) => p.id === governor.id), 'the governor goes with them');
  assert.equal(next.settlements.length, 1);
  const t = next.settlements[0];
  assert.equal(t.name, 'Thornfield');
  assert.equal(t.population, 12);
  assert.equal(t.governor.name, governor.name);
  assert.equal(next.era, 'nation');
  assert.ok(eraAtLeast(next, 'nation') && inVillage(next), 'village ways go on in the Nation era');
  assert.ok(taskAvailable(next, 'guard'));
  assert.equal(next.resources.food, 220);
  assert.ok(next.report.decisions.some((l) => /Nation era has begun/.test(l)));
  assert.match(settlementBlocker(next), /capital once it has 40 people \(it has 32\), or a settlement once it has 30/);
});

test('the council stays at home unless one of them governs', () => {
  const s = readyVillage();
  const council = Object.values(s.advisors);
  const governor = governorChoices(s).find((p) => !council.includes(p.id));
  const next = found(s, { governorId: governor.id }).state;
  for (const id of council) assert.ok(next.people.some((p) => p.id === id), 'council member stayed');
  const advisor = governorChoices(s).find((p) => p.id === s.advisors.steward);
  const led = found(s, { governorId: advisor.id }).state;
  assert.notEqual(led.advisors.steward, advisor.id, 'a new steward takes over');
  assert.ok(led.people.some((p) => p.id === led.advisors.steward));
});

test('founding checks the place, the number of settlers, and the governor', () => {
  const s = readyVillage();
  assert.match(found(s, { placeId: 'riverbank' }).error, /place your people hold/);
  const [lo, hi] = settlerRange(s);
  assert.equal(lo, 10);
  assert.equal(hi, 14, '44 people, and 30 must stay');
  assert.match(found(s, { settlers: 25 }).error, /between 10 and 14/);
  assert.match(found(s, { governorId: 9999 }).error, /governor/);
  assert.ok(settlementSites(s).includes('greyCliffs'));
});

test('a settlement sends home what its land is best for, and grows each spring', () => {
  assert.equal(settlementProduct('greyCliffs'), 'stone');
  assert.equal(settlementProduct('deadfall'), 'wood');
  assert.equal(settlementProduct('meadow'), 'food');
  const s = found(readyVillage()).state;
  const t = s.settlements[0];
  s.turn = 4; // Spring.
  t.population = 20;
  t.buildings.homes = 4;
  const food = s.resources.food;
  const routine = [];
  settlementsSeason(s, { routine });
  assert.ok(s.resources.food > food);
  assert.ok(routine.some((l) => /Thornfield sent home \d+ food/.test(l)));
  assert.equal(t.population, 21, 'grew in spring: 5 percent under heavy demands');
  assert.equal(t.demands, 'heavy', 'the supply policy asks for heavy demands');
  const supply = expectedShipment(s, t).amount;
  t.demands = 'light';
  assert.ok(expectedShipment(s, t).amount < supply, 'growing means sending less');
});

test('the player sets a settlement\'s policy, and it extends what the village can hold', () => {
  const s = readyVillage();
  const limit = claimLimit(s);
  let next = found(s).state;
  assert.ok(claimLimit(next) > limit - 2, 'settlers leaving cost little, the settlement adds room');
  next = act(next, { type: 'setSettlementPolicy', settlementId: 1, policy: 'grow' });
  assert.equal(next.settlements[0].demands, 'light', 'grow means light demands');
  assert.match(applyAction(next, { type: 'setSettlementPolicy', settlementId: 1, policy: 'party' }).error, /grow or supply/);
});

test('seasons go on with a settlement', () => {
  let s = found(readyVillage(3)).state;
  for (let i = 0; i < 8 && !s.gameOver; i++) {
    if (s.pendingEvent) break;
    s = act(s, { type: 'endTurn' });
  }
  assert.ok(s.settlements[0].population >= 10);
});

test('version 15 saves have no settlements yet', () => {
  const old = newGame({ seed: 2 });
  old.version = 15;
  delete old.settlements;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.settlements, []);
});
