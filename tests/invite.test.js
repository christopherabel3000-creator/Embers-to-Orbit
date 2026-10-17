import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, shelterCapacity, shelterNeeded, foodNeeded,
} from '../js/engine/state.js';
import { governorChoices } from '../js/engine/settlements.js';
import { applyStandingOrders } from '../js/engine/orders.js';
import { getAdvice } from '../js/engine/advisors.js';
import {
  inviteBlocker, inviteRoom, inviteCost, inviteAffordable, inviteByOrder,
  INVITE_COIN, INVITE_COIN_OPEN, INVITE_MAX, INVITE_PER,
} from '../js/engine/invite.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era capital that knows Coinage, with room in its homes and food in store.
function inviteGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 40; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 30, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'irrigation', 'masonry');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 1500, wood: 600, stone: 300, goods: 300, coin: 0,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.knowledge.learned.push('writing', 'coinage');
  s.resources.coin = 300;
  s.turn = 8;
  return s;
}

test('settlers can be invited only in the Nation era, with Coinage, open to strangers, and not under siege', () => {
  const camp = newGame({ seed: 1 });
  assert.match(inviteBlocker(camp), /once your people are a nation/);
  const s = inviteGame();
  assert.equal(inviteBlocker(s), null);
  s.knowledge.learned = s.knowledge.learned.filter((k) => k !== 'coinage');
  assert.match(inviteBlocker(s), /Coinage/);
  s.knowledge.learned.push('coinage');
  s.laws.strangers = 'closed';
  assert.match(inviteBlocker(s), /closes the gates/);
  s.laws.strangers = null;
  s.siege = { supplies: 3 };
  assert.match(inviteBlocker(s), /siege/);
});

test('a party of settlers costs coin for each, joins the capital, and only one comes a season', () => {
  let s = inviteGame();
  const before = living(s).length;
  const each = inviteCost(s);
  s = act(s, { type: 'inviteSettlers', count: 3 });
  assert.equal(living(s).length, before + 3);
  assert.equal(s.resources.coin, 300 - 3 * each);
  assert.equal(s.invited, 3);
  assert.ok(living(s).slice(-3).every((p) => p.isNew && p.age >= 16 && /passage paid/.test(p.note)));
  const again = applyAction(s, { type: 'inviteSettlers', count: 1 });
  assert.match(again.error, /already on its way/);
  s.turn += 1;
  assert.equal(inviteBlocker(s), null);
});

test('the passage costs more as the capital grows, and less with open gates', () => {
  const s = inviteGame();
  const size = living(s).length;
  assert.equal(inviteCost(s), INVITE_COIN + Math.floor(size / INVITE_PER));
  s.laws.strangers = 'open';
  assert.equal(inviteCost(s), INVITE_COIN_OPEN + Math.floor(size / INVITE_PER));
  for (let i = 0; i < 2 * INVITE_PER; i++) s.people.push(makePerson({ name: `More${i}`, note: '', age: 25, skills: {} }, s.nextPersonId++, 'forage'));
  assert.equal(inviteCost(s), INVITE_COIN_OPEN + Math.floor(size / INVITE_PER) + 2);
});

test('a party is limited to five, to room in the homes, and to food for two seasons', () => {
  const s = inviteGame();
  assert.equal(inviteRoom(s), INVITE_MAX);
  const over = applyAction(s, { type: 'inviteSettlers', count: INVITE_MAX + 1 });
  assert.match(over.error, /can take 5 settlers/);
  // Homes with room for two more, keeping one place spare.
  const people = living(s);
  s.buildings.leanTo = 0;
  s.buildings.hut = 0;
  const spare = shelterCapacity(s) - shelterNeeded(people);
  s.buildings.leanTo = Math.ceil((3 - spare) / 4);
  const homes = Math.floor(shelterCapacity(s) - shelterNeeded(people) - 1);
  assert.equal(inviteRoom(s), Math.min(INVITE_MAX, homes));
  s.buildings.leanTo = 0;
  assert.match(inviteBlocker(s), /homes are full/);
  // Food for everyone for two seasons, newcomers included.
  s.buildings.leanTo = 30;
  s.resources.food = (foodNeeded(people) + 2 * 2) * 2;
  assert.equal(inviteRoom(s), 2);
  s.resources.food = foodNeeded(people) * 2;
  assert.match(inviteBlocker(s), /2 seasons of food/);
});

test('the treasury must cover the passage', () => {
  const s = inviteGame();
  const each = inviteCost(s);
  s.resources.coin = each - 1;
  assert.match(inviteBlocker(s), new RegExp(`costs ${each} coin`));
  s.resources.coin = each * 2;
  assert.equal(inviteAffordable(s), 2);
  const r = applyAction(s, { type: 'inviteSettlers', count: 3 });
  assert.match(r.error, new RegExp(`cost ${each * 3} coin`));
});

test('the steward invites settlers each season under a standing order, keeping the reserve', () => {
  let s = inviteGame();
  assert.equal(s.orders.inviteReserve, null);
  assert.equal(inviteByOrder(s), null);
  assert.match(applyAction(s, { type: 'setOrder', id: 'inviteReserve', value: 75 }).error, /reserve of/);
  s = act(s, { type: 'setOrder', id: 'inviteReserve', value: '250' });
  assert.equal(s.orders.inviteReserve, 250);
  const before = living(s).length;
  const each = inviteCost(s);
  const n = Math.floor(50 / each); // 300 coin, keeping 250.
  assert.ok(n >= 2);
  const out = applyStandingOrders(s);
  assert.equal(living(s).length, before + n);
  assert.equal(s.resources.coin, 300 - n * each);
  assert.ok(out.orders.some((l) => new RegExp(`invited ${n} settlers .* for ${n * each} coin, keeping 250`).test(l)));
  // Nothing more this season, and nothing once the reserve is reached.
  assert.equal(inviteByOrder(s), null);
  s.turn += 1;
  assert.equal(inviteByOrder(s), null);
  s = act(s, { type: 'setOrder', id: 'inviteReserve', value: 'off' });
  assert.equal(s.orders.inviteReserve, null);
});

test('the order runs at the end of a season', () => {
  let s = inviteGame();
  s = act(s, { type: 'setOrder', id: 'inviteReserve', value: 0 });
  s = act(s, { type: 'endTurn' });
  assert.ok(s.invited >= 1);
  assert.ok(s.report.orders.some((l) => /invited/.test(l)));
});

test('the steward points out coin that could bring settlers, until there is an order', () => {
  let s = inviteGame();
  const says = (st) => getAdvice(st).some((a) => a.role === 'steward' && /Settlers from beyond the valley would come/.test(a.text));
  assert.ok(says(s));
  s.resources.coin = inviteCost(s) * 10 - 1;
  assert.ok(!says(s));
  s.resources.coin = 300;
  s = act(s, { type: 'setOrder', id: 'inviteReserve', value: 100 });
  assert.ok(!says(s));
});

test('saves from version 33 gain the order to invite settlers', () => {
  const s = inviteGame();
  delete s.orders.inviteReserve;
  delete s.lastInvite;
  delete s.invited;
  s.version = 33;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.orders.inviteReserve, null);
  assert.equal(m.invited, 0);
});
