import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate, SAVE_VERSION } from '../js/engine/state.js';
import {
  createBattle, deploy, resolveRound, isArcher, coverAt, battleView, formationPlan, warChiefFormation,
} from '../js/engine/battle.js';
import {
  skarnApproach, startSiege, siegeSeason, ransom, OUTSIDE_TASKS,
  villageDefense, bandPower, coverWeight, STORM_RATIO, SIEGE_RATIO,
} from '../js/engine/siege.js';
import { villagePlan } from '../js/engine/assign.js';
import { nation } from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 10; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2 + (i % 3), foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.wood = 100;
  s.neighbors.skarn.known = true;
  return act(s, { type: 'foundVillage' });
}

test('a Skarn nation brings archers; your good hunters shoot once you know bows', () => {
  const s = village();
  const battle = createBattle(s, { type: 'raid', raiders: 20, warned: true, from: 'skarn' });
  const archers = Object.values(battle.archers).reduce((a, b) => a + b, 0);
  assert.ok(archers >= 4 && archers <= 6, `about a quarter are archers, got ${archers}`);
  const camp = newGame({ seed: 1 });
  const early = createBattle(camp, { type: 'raid', raiders: 20, warned: true, from: 'skarn' });
  assert.equal(Object.values(early.archers).reduce((a, b) => a + b, 0), 0, 'raiders in the camp years have no archers');
  const aric = living(s).find((p) => p.name === 'Aric');
  aric.task = 'hunt';
  assert.ok(!isArcher(s, aric), 'no bows yet');
  s.knowledge.learned.push('bows');
  assert.ok(isArcher(s, aric));
  aric.task = 'guard';
  assert.ok(!isArcher(s, aric), 'guards stand in the line');
  assert.ok(battleView({ ...s, pendingEvent: { type: 'raid', raiders: 20, warned: true, from: 'skarn', battle } }).enemyLines.some((l) => /archers/.test(l)));
});

test('warriors charging an undermanned palisade can break through it', () => {
  const s = village();
  let broke = false;
  for (let seed = 0; seed < 30 && !broke; seed++) {
    const copy = structuredClone(s);
    copy.rng = 1000 + seed;
    const battle = createBattle(copy, { type: 'raid', raiders: 30, warned: true, from: 'skarn' });
    battle.enemy = { left: 20, center: 5, right: 5 };
    battle.archers = { left: 0, center: 0, right: 0 };
    battle.enemyZoneStart = { ...battle.enemy };
    const fighters = living(copy).filter((p) => p.health >= 40).slice(0, 4);
    deploy(copy, battle, Object.fromEntries(fighters.map((p, i) => [p.id, i === 0 ? 'left' : 'center'])));
    assert.equal(coverAt(battle, 'left'), 'palisade');
    resolveRound(copy, battle, { left: 'hold', center: 'hold', reserve: 'stay' });
    if (battle.breached.left) {
      broke = true;
      assert.equal(coverAt(battle, 'left'), null);
      assert.ok(battle.lastRound.some((l) => /broke through the palisade/.test(l)));
    }
  }
  assert.ok(broke, 'twenty warriors against one defender breach the palisade at least once');
});

test('the Skarn storm what they can take, besiege walls they cannot, and wait otherwise', () => {
  const s = village();
  // They weigh what the village's fighters are worth, and its walls.
  const defense = villageDefense(s);
  const per = bandPower(s, 1);
  const stormAt = Math.ceil(defense * coverWeight(s) * STORM_RATIO / per);
  const siegeAt = Math.ceil(defense * SIEGE_RATIO / per);
  assert.equal(skarnApproach(s, stormAt), 'storm');
  assert.equal(skarnApproach(s, stormAt - 1), 'siege');
  assert.equal(skarnApproach(s, siegeAt), 'siege');
  assert.equal(skarnApproach(s, siegeAt - 1), 'wait');
  assert.equal(skarnApproach(s, 2), 'wait');
  s.buildings.palisade = 0;
  const openStorm = Math.ceil(defense * STORM_RATIO / per);
  assert.equal(skarnApproach(s, openStorm), 'storm', 'without walls they storm sooner');
  assert.equal(skarnApproach(s, openStorm - 1), 'wait', 'no walls: no siege');
});

test('under siege no one works outside the walls, and the council keeps everyone inside', () => {
  let s = village();
  s.buildQueue.push({ id: 'hut', progress: 0, paid: false });
  startSiege(s, 12);
  const plan = villagePlan(s);
  assert.ok(![...plan.values()].some((t) => OUTSIDE_TASKS.includes(t)));
  for (const p of living(s)) p.task = 'hunt';
  const food = s.resources.food;
  s = act(s, { type: 'endTurn' });
  assert.ok(s.log.some((l) => /siege kept everyone inside/.test(l.text)));
  assert.ok(s.resources.food < food, 'the village lives on its stores');
});

test('besiegers starve and leave when their supplies run out', () => {
  const s = village();
  startSiege(s, 12);
  s.siege.supplies = 2;
  const warriors = nation(s, 'skarn').warriors;
  siegeSeason(s);
  assert.ok(s.siege.raiders < 12);
  assert.ok(nation(s, 'skarn').warriors < warriors, 'the hungry are lost to the Skarn');
  const lines = siegeSeason(s);
  assert.equal(s.siege, null);
  assert.match(lines.join(' '), /lifted the siege/);
});

test('paying the besiegers lifts the siege and buys a truce', () => {
  const s = village();
  startSiege(s, 12);
  assert.equal(ransom(s), 36);
  const paid = act(s, { type: 'payBesiegers' });
  assert.equal(paid.siege, null);
  assert.equal(paid.resources.food, 300 - 36);
  assert.ok(paid.neighbors.skarn.truceUntil > paid.turn);
});

test('sallying out is a battle in the open; winning breaks the siege', () => {
  let s = village();
  startSiege(s, 6);
  s = act(s, { type: 'sallyOut' });
  const battle = s.pendingEvent.battle;
  assert.equal(battle.sally, true);
  assert.equal(battle.terrain.palisade, false, 'no walls to hide behind out there');
  s = act(s, { type: 'battleAuto' });
  assert.equal(s.siege, null, 'six hungry Skarn are no match for the village');
  assert.ok(s.report.urgent.some((l) => /siege of .* is broken/.test(l)));
});

test('a sally can be called off before it starts', () => {
  let s = village();
  startSiege(s, 12);
  s = act(s, { type: 'sallyOut' });
  s = act(s, { type: 'resolveRaid', plan: 'hide' });
  assert.equal(s.pendingEvent, null);
  assert.ok(s.siege, 'the siege goes on');
  assert.equal(s.resources.food, 300, 'nothing was lost');
});

test('the war chief\'s formation still places everyone', () => {
  const s = village();
  const battle = createBattle(s, { type: 'raid', raiders: 10, warned: true, from: 'skarn' });
  const plan = formationPlan(s, battle, warChiefFormation(battle));
  assert.ok(Object.keys(plan).length > 0);
});

test('version 17 saves are not under siege', () => {
  const old = newGame({ seed: 2 });
  old.version = 17;
  delete old.siege;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.siege, null);
});
