// Keeping the peace with the Skarn: it holds only while they respect your
// strength, gifts can honor it, a new chief tests it, and the hill clans
// are not bound by it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate } from '../js/engine/state.js';
import { nation } from '../js/engine/nations.js';
import {
  skarnTempted, peaceYear, honorCost, contestOdds, chiefGiftCost, SKARN_CHIEF_EVENT,
} from '../js/engine/peace.js';
import { clanRaidChance, clansRaidingAlone } from '../js/engine/clans.js';
import { createBattle, finishBattle, foeName } from '../js/engine/battle.js';
import { describePending } from '../js/engine/events.js';
import { skarnAtPeace } from '../js/engine/neighbors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 10; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming', 'weaving');
  s.milestoneReached = true;
  s.resources.food = 400;
  s.resources.wood = 100;
  s.resources.goods = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  const v = act(s, { type: 'foundVillage' });
  v.pendingEvent = null;
  for (const p of living(v)) { p.health = 100; p.sick = false; }
  v.neighbors.skarn.peace = true;
  v.neighbors.skarn.chief = 'Harrak';
  v.neighbors.skarn.chiefUntil = v.turn + 400; // Not dying in these tests unless asked.
  v.turn += 4 - (v.turn % 4); // Spring.
  return v;
}

test('the Skarn hold to the peace while they respect your strength', () => {
  const s = village();
  nation(s, 'skarn').warriors = 5;
  assert.equal(skarnTempted(s), false);
  const out = peaceYear(s);
  assert.equal(s.neighbors.skarn.peace, true);
  assert.equal(out.urgent.length, 0);
});

test('a village that looks weak is warned one spring and abandoned the next', () => {
  const s = village();
  nation(s, 'skarn').warriors = 200;
  assert.equal(skarnTempted(s), true);
  const first = peaceYear(s);
  assert.equal(s.neighbors.skarn.peace, true);
  assert.equal(s.neighbors.skarn.peaceWarned, true);
  assert.ok(first.urgent.some((l) => /mock/.test(l)));
  s.turn += 4;
  const second = peaceYear(s);
  assert.equal(s.neighbors.skarn.peace, false);
  assert.ok(second.urgent.some((l) => /cast the peace aside/.test(l)));
  assert.ok(skarnAtPeace(s), 'a season of grace, by custom');
  s.turn += 1;
  assert.equal(skarnAtPeace(s), false);
});

test('growing strong again clears the warning', () => {
  const s = village();
  nation(s, 'skarn').warriors = 200;
  peaceYear(s);
  nation(s, 'skarn').warriors = 5;
  s.turn += 4;
  const out = peaceYear(s);
  assert.equal(s.neighbors.skarn.peace, true);
  assert.equal(s.neighbors.skarn.peaceWarned, false);
  assert.ok(out.events.some((l) => /respect again/.test(l)));
});

test('gifts honor the peace for a year, whatever the Skarn think of your strength', () => {
  let s = village();
  nation(s, 'skarn').warriors = 200;
  peaceYear(s);
  const cost = honorCost(s);
  assert.equal(cost.food, 200);
  s.resources.food = 250;
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'honorFood' });
  assert.equal(s.resources.food, 50);
  assert.equal(s.neighbors.skarn.peaceWarned, false);
  s.turn += 4 - (s.turn % 4);
  peaceYear(s);
  assert.equal(s.neighbors.skarn.peace, true, 'honored: no warning this spring');
  s.turn += 4;
  peaceYear(s);
  assert.equal(s.neighbors.skarn.peaceWarned, true, 'a year later, the gifts are spent');
  assert.match(applyAction(village(), { type: 'diplomacy', neighborId: 'velari', act: 'honorFood' }).error, /not possible/);
});

test('when the chief dies, the new chief tests a peace', () => {
  const s = village();
  s.neighbors.skarn.chiefUntil = s.turn;
  const out = peaceYear(s);
  assert.notEqual(s.neighbors.skarn.chief, 'Harrak');
  assert.equal(s.pendingEvent.id, 'skarnChief');
  assert.ok(out.urgent.some((l) => /Harrak, chief of the Skarn, is dead/.test(l)));
  assert.ok(s.neighbors.skarn.chiefUntil >= s.turn + 32 && s.neighbors.skarn.chiefUntil <= s.turn + 60);
  const view = describePending(s);
  assert.deepEqual(view.options.map((o) => o.id), ['food', 'goods', 'contest', 'refuse']);

  const gifts = act(s, { type: 'resolveEvent', choice: 'goods' });
  assert.equal(gifts.neighbors.skarn.peace, true);
  assert.equal(gifts.resources.goods, 100 - chiefGiftCost(s).goods);

  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.equal(refused.neighbors.skarn.peace, false);
});

test('a contest of champions turns on your best fighter', () => {
  const s = village();
  s.neighbors.skarn.chiefUntil = s.turn;
  peaceYear(s);
  const weak = structuredClone(s);
  for (const p of living(weak)) p.skills.hunting = 0;
  assert.ok(contestOdds(weak) < contestOdds(s));
  // A champion of legend always wins; a hopeless one always loses.
  const strong = structuredClone(s);
  for (const p of living(strong)) p.skills.hunting = 60;
  const won = act(strong, { type: 'resolveEvent', choice: 'contest' });
  assert.equal(won.neighbors.skarn.peace, true);
  assert.ok(won.neighbors.skarn.honoredUntil >= won.turn + 4);
  for (const p of living(weak)) p.health = 45;
  const lost = act(weak, { type: 'resolveEvent', choice: 'contest' });
  assert.equal(lost.neighbors.skarn.peace, false);
});

test('without a peace, a chief\'s death is only news', () => {
  const s = village();
  s.neighbors.skarn.peace = false;
  s.neighbors.skarn.chiefUntil = s.turn;
  const out = peaceYear(s);
  assert.equal(s.pendingEvent, null);
  assert.ok(out.events.some((l) => /The Skarn follow/.test(l)));
});

test('the Skarn peace does not bind the hill clans', () => {
  const s = village();
  s.clans.warriors = 20;
  assert.equal(clansRaidingAlone(s), 20);
  assert.ok(clanRaidChance(s) > 0.2);
  s.clans.quietUntil = s.turn + 8;
  assert.equal(clansRaidingAlone(s), 0, 'gifts still keep them home');
  s.clans.quietUntil = -1;
  s.neighbors.skarn.peace = false;
  assert.equal(clansRaidingAlone(s), 0, 'without a peace they march with the Skarn instead');

  s.neighbors.skarn.peace = true;
  const ev = { type: 'raid', raiders: 10, warned: true, from: 'clans' };
  const battle = createBattle(s, ev);
  assert.equal(foeName(battle), 'hill clansmen');
  assert.equal(battle.foeStrength, 6, 'clansmen fight like the old raiders');
  battle.enemy = { left: 1, center: 1, right: 0 };
  battle.fought = [];
  s.pendingEvent = { ...ev, battle };
  const skarnBefore = nation(s, 'skarn').warriors;
  const lines = finishBattle(s, battle, 'victory');
  assert.equal(s.clans.warriors, 12);
  assert.equal(nation(s, 'skarn').warriors, skarnBefore, 'the Skarn lose no one');
  assert.equal(s.neighbors.skarn.peace, true, 'and the peace holds');
  assert.ok(lines.some((l) => /hill clans lost 8/.test(l)));
});

test('older saves gain the Skarn chief and the peace\'s new rules', () => {
  const s = village();
  const old = structuredClone(s);
  old.version = 23;
  for (const n of Object.values(old.neighbors)) {
    delete n.peaceWarned; delete n.honoredUntil; delete n.chief; delete n.chiefUntil;
  }
  const up = migrate(old);
  assert.equal(up.neighbors.skarn.peaceWarned, false);
  assert.equal(up.neighbors.skarn.chiefUntil, null);
  peaceYear(up);
  assert.ok(up.neighbors.skarn.chiefUntil > up.turn, 'the chief is given a span at the next spring');
});

test('the chief event is only ever started by the year', () => {
  assert.equal(SKARN_CHIEF_EVENT.skarnChief.weight(newGame({ seed: 1 })), 0);
});
