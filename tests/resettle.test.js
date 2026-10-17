import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION,
} from '../js/engine/state.js';
import { governorChoices, KEEP_AT_HOME } from '../js/engine/settlements.js';
import { homeRoom } from '../js/engine/realm.js';
import { isNotable } from '../js/engine/village.js';
import { applyStandingOrders } from '../js/engine/orders.js';
import {
  moveBlocker, moveRoom, townRoom, movers, spreadByOrder, MOVE_MAX,
} from '../js/engine/resettle.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era capital of about 60 with one settlement, Thornfield, which
// has room in its homes.
function moveGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 58; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 1 + (i % 3), foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 30, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'irrigation', 'masonry');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 1500, wood: 600, stone: 300, goods: 300,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.settlements[0].buildings.homes = 4;
  s.turn = 8;
  return s;
}

const town = (s) => s.settlements[0];

test('people can move out only in the Nation era, not through a siege, and once a season to each settlement', () => {
  const camp = newGame({ seed: 1 });
  assert.match(moveBlocker(camp, { name: 'Nowhere' }), /once your people are a nation/);
  let s = moveGame();
  assert.equal(moveBlocker(s, town(s)), null);
  s.siege = { supplies: 3 };
  assert.match(moveBlocker(s, town(s)), /siege/);
  s.siege = null;
  s = act(s, { type: 'moveSettlers', settlementId: town(s).id, count: 2 });
  assert.match(moveBlocker(s, town(s)), /already on the road/);
  s.turn += 1;
  assert.equal(moveBlocker(s, town(s)), null);
});

test('moving people takes the least skilled ordinary adults from the capital into the settlement', () => {
  let s = moveGame();
  const capital = living(s).length;
  const before = town(s).population;
  const expected = movers(s).slice(0, 4).map((p) => p.id);
  s = act(s, { type: 'moveSettlers', settlementId: town(s).id, count: 4 });
  assert.equal(living(s).length, capital - 4);
  assert.equal(town(s).population, before + 4);
  assert.equal(s.movedOut, 4);
  assert.ok(expected.every((id) => !s.people.some((p) => p.id === id)));
  assert.ok(movers(s).every((p) => !isNotable(s, p) && p.age >= 16 && p.age < 55));
  // The council stays.
  for (const id of Object.values(s.advisors)) assert.ok(s.people.some((p) => p.id === id && p.alive));
});

test('a move is limited to the room in the homes, to 10, and to what the capital must keep', () => {
  const s = moveGame();
  const t = town(s);
  assert.equal(townRoom(s, t), 4 * homeRoom(s) - t.population);
  assert.equal(moveRoom(s, t), Math.min(MOVE_MAX, townRoom(s, t)));
  t.buildings.homes = 10;
  assert.equal(moveRoom(s, t), MOVE_MAX);
  const over = applyAction(s, { type: 'moveSettlers', settlementId: t.id, count: MOVE_MAX + 1 });
  assert.match(over.error, /10 people can move/);
  // A capital near its floor can spare only the people above it.
  const spare = 3;
  s.people = [...living(s).slice(0, KEEP_AT_HOME + spare)];
  assert.ok(moveRoom(s, t) <= spare);
  t.population = t.buildings.homes * homeRoom(s);
  assert.match(moveBlocker(s, t), /homes are full/);
  t.population = 5;
  s.people = living(s).slice(0, KEEP_AT_HOME);
  assert.match(moveBlocker(s, t), /must keep at least 30/);
});

test('the steward sends people out each season under a standing order, keeping the capital at the chosen size', () => {
  let s = moveGame();
  s.settlements[0].buildings.homes = 10;
  for (let i = 0; i < 15; i++) s.people.push(makePerson({ name: `Newcomer${i}`, note: '', age: 25, skills: { hunting: 1, foraging: 1, building: 1, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  assert.ok(living(s).length > 70);
  assert.equal(spreadByOrder(s), null);
  assert.match(applyAction(s, { type: 'setOrder', id: 'spreadAbove', value: 55 }).error, /capital of/);
  s = act(s, { type: 'setOrder', id: 'spreadAbove', value: '60' });
  assert.equal(s.orders.spreadAbove, 60);
  const capital = living(s).length;
  const out = applyStandingOrders(s);
  const sent = Math.min(capital - 60, MOVE_MAX);
  assert.equal(living(s).length, capital - sent);
  assert.ok(out.orders.some((l) => new RegExp(`sent ${sent} people to Thornfield .* keep at about 60`).test(l)));
  s = act(s, { type: 'setOrder', id: 'spreadAbove', value: 'off' });
  assert.equal(s.orders.spreadAbove, null);
});

test('the order runs at the end of a season', () => {
  let s = moveGame();
  s.settlements[0].buildings.homes = 10;
  s = act(s, { type: 'setOrder', id: 'spreadAbove', value: 60 });
  s = act(s, { type: 'endTurn' });
  assert.ok(s.movedOut >= 1);
  assert.ok(s.report.orders.some((l) => /to Thornfield/.test(l)));
});

test('saves from version 34 gain the order to send people out', () => {
  const s = moveGame();
  delete s.orders.spreadAbove;
  delete s.movedOut;
  s.version = 34;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.orders.spreadAbove, null);
  assert.equal(m.movedOut, 0);
});

test('no one a waiting decision is about leaves the capital', () => {
  const s = moveGame();
  const first = movers(s)[0];
  s.pendingEvent = { type: 'story', id: 'lostWorker', person: first.id, task: 'hunt' };
  assert.ok(!movers(s).some((p) => p.id === first.id));
  s.pendingEvent = null;
  assert.equal(movers(s)[0].id, first.id);
});

test('while a decision about someone waits, nothing takes people out of the capital', () => {
  let s = moveGame();
  s.settlements[0].buildings.homes = 10;
  s.knowledge.learned.push('writing', 'mapmaking');
  const person = movers(s)[0];
  s.pendingEvent = { type: 'story', id: 'lostWorker', person: person.id, task: 'hunt' };
  const refused = [
    { type: 'foundSettlement', placeId: 'meadow', name: 'Elsewhere', settlers: 10, governorId: person.id },
    { type: 'appointGovernor', settlementId: s.settlements[0].id, personId: person.id },
    { type: 'sendExpedition', region: 'lakes', leaderId: person.id, size: 5, seasons: 3 },
    { type: 'raiseArmy', commanderId: person.id, kind: 'spearmen' },
    { type: 'sendVoyage' },
  ];
  for (const action of refused) {
    const r = applyAction(s, action);
    assert.ok(r.error, `${action.type} should wait for the decision`);
    assert.match(r.error, /Deal with what is happening first|A decision is waiting/, `${action.type}: ${r.error}`);
  }
  // Moving out by hand or by order passes over the person the decision is about.
  s = act(s, { type: 'moveSettlers', settlementId: s.settlements[0].id, count: 3 });
  s.turn += 1;
  s = act(s, { type: 'setOrder', id: 'spreadAbove', value: 60 });
  applyStandingOrders(s);
  assert.ok(s.people.some((p) => p.id === person.id && p.alive));
});
