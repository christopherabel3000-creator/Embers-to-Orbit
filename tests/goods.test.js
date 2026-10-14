import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate, SAVE_VERSION } from '../js/engine/state.js';
import { spendGoods, comfortsCost, hireBlocker, swordsActive } from '../js/engine/goods.js';
import { fighterStrength } from '../js/engine/battle.js';
import { alliedHelpers } from '../js/engine/nations.js';
import { diplomacyOptions } from '../js/engine/neighbors.js';
import { startSiege, ransomGoods } from '../js/engine/siege.js';
import { EVENTS } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(extra = 14, seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < extra; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 10 });
  s.knowledge.learned.push('farming', 'weaving', 'oralLaw');
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.goods = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' });
}

test('comforts cost a goods for every six people and lift where spirits settle', () => {
  const s = village();
  assert.equal(s.orders.comforts, true, 'a new village shares out comforts');
  assert.equal(comfortsCost(s), 5);
  const out = spendGoods(s);
  assert.equal(s.resources.goods, 95);
  assert.equal(out.settle, 4);
});

test('a big village that can craft misses its comforts', () => {
  const s = village(20);
  s.orders.comforts = false;
  assert.equal(spendGoods(s).settle, -3);
  const small = village(4);
  small.orders.comforts = false;
  assert.equal(spendGoods(small).settle, 0, 'a small village does not expect them');
});

test('armed guards fight harder, at a goods each', () => {
  const s = village();
  const guard = living(s)[0];
  guard.task = 'guard';
  const plain = fighterStrength(s, guard);
  s.orders.armGuards = true;
  const goods = s.resources.goods;
  spendGoods(s);
  assert.ok(s.guardsArmed);
  assert.equal(s.resources.goods, goods - 5 - living(s).filter((p) => p.task === 'guard').length);
  assert.ok(fighterStrength(s, guard) > plain);
});

test('a master can be hired once a year', () => {
  let s = village();
  const before = living(s).length;
  s = act(s, { type: 'hireMaster', skill: 'healing' });
  assert.equal(living(s).length, before + 1);
  const master = living(s)[living(s).length - 1];
  assert.equal(master.skills.healing, 4);
  assert.match(master.note, /master healer/);
  assert.equal(s.resources.goods, 75);
  assert.match(hireBlocker(s), /in 4 seasons/);
  assert.match(applyAction(s, { type: 'hireMaster', skill: 'fishing' }).error, /hire another master/);
});

test('sell-swords stand with you against raiders and besiegers for a year', () => {
  let s = village();
  const help = alliedHelpers(s);
  s = act(s, { type: 'hireSwords' });
  assert.ok(swordsActive(s));
  assert.equal(alliedHelpers(s), help + 6);
  assert.match(applyAction(s, { type: 'hireSwords' }).error, /already hired/);
  s.turn += 4;
  assert.ok(!swordsActive(s));
});

test('a shrine eases grief and fever', () => {
  const s = village();
  s.turn = 7;
  const fever = EVENTS.feverOutbreak.weight(s);
  s.buildings.shrine = 1;
  assert.ok(EVENTS.feverOutbreak.weight(s) < fever);
});

test('the Skarn take tribute in goods, the Tellani take caravans, and besiegers take goods to leave', () => {
  let s = village();
  assert.ok(diplomacyOptions(s, 'skarn').some((o) => o.key === 'tributeGoods' && o.ok));
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'tributeGoods' });
  assert.ok(s.neighbors.skarn.truceUntil > s.turn);
  assert.equal(s.resources.goods, 85);
  assert.ok(!diplomacyOptions(s, 'tellani').some((o) => o.key === 'caravan'), 'a caravan needs a market or a trade pact');
  s.buildings.market = 1;
  const caravan = diplomacyOptions(s, 'tellani').find((o) => o.key === 'caravan');
  assert.ok(caravan && caravan.ok);
  const food = s.resources.food;
  s = act(s, { type: 'diplomacy', neighborId: 'tellani', act: 'caravan' });
  assert.equal(s.resources.goods, 55);
  assert.ok(s.resources.food > food + 60);
  startSiege(s, 12);
  assert.equal(ransomGoods(s), 18);
  s = act(s, { type: 'payBesiegers', goods: true });
  assert.equal(s.siege, null);
  assert.equal(s.resources.goods, 37);
});

test('version 19 saves gain the goods orders, off', () => {
  const old = newGame({ seed: 2 });
  old.version = 19;
  delete old.orders.comforts;
  delete old.orders.armGuards;
  delete old.buildings.shrine;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.orders.comforts, false);
  assert.equal(s.buildings.shrine, 0);
});
