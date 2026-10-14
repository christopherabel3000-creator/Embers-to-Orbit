import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION,
} from '../js/engine/state.js';
import {
  feastLift, feastsInARow, feastExpected, feastCustomSeason,
  FEAST_MORALE, FEAST_CUSTOM_DROP, FEAST_CUSTOM_FLOOR, FEAST_MISSED,
} from '../js/engine/stores.js';
import { getAdvice } from '../js/engine/advisors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r;
};

function village() {
  const s = newGame({ seed: 3 });
  for (let i = 0; i < 18; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.wood = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' }).state;
}

// Holds a feast now, with spirits low enough to see the whole lift.
function feast(s) {
  s.resources.food = 1000;
  for (const p of living(s)) p.morale = 40;
  const r = act(s, { type: 'holdFeast' });
  return { state: r.state, lift: living(r.state)[0].morale - 40, message: r.message };
}

test('a camp\'s feasts lift spirits fully every year', () => {
  let s = newGame({ seed: 1 });
  for (let year = 0; year < 3; year++) {
    const f = feast(s);
    assert.equal(f.lift, FEAST_MORALE);
    s = f.state;
    s.turn += 4;
  }
});

test('in a village, each feast in a year in a row lifts spirits less, down to a floor', () => {
  let s = village();
  const lifts = [];
  for (let year = 0; year < 6; year++) {
    const f = feast(s);
    lifts.push(f.lift);
    s = f.state;
    s.turn += 4;
  }
  assert.deepEqual(lifts.slice(0, 3), [FEAST_MORALE, FEAST_MORALE - FEAST_CUSTOM_DROP, FEAST_MORALE - 2 * FEAST_CUSTOM_DROP]);
  assert.equal(lifts[5], FEAST_CUSTOM_FLOOR);
  assert.equal(feastsInARow(s), 6);
});

test('the message says when a feast lifted spirits less', () => {
  let s = village();
  s = feast(s).state;
  s.turn += 4;
  const f = feast(s);
  assert.match(f.message, /Feasting is a custom now: this feast lifted spirits by 12, where a first feast lifts them by 15\./);
});

test('once a feast is expected, a year without one lowers spirits, and the next feast lifts them fully', () => {
  let s = village();
  s = feast(s).state;
  s.turn += 4;
  s = feast(s).state;
  assert.ok(feastExpected(s));
  // The last season to keep the custom: the steward warns.
  s.turn = s.lastFeast + 7;
  assert.ok(getAdvice(s).some((a) => a.role === 'steward' && /expect their yearly feast/.test(a.text)));
  assert.deepEqual(feastCustomSeason(s), [], 'not yet');
  s.turn += 1;
  for (const p of living(s)) p.morale = 60;
  const lines = feastCustomSeason(s);
  assert.match(lines[0], /had come to expect one/);
  assert.equal(living(s)[0].morale, 60 - FEAST_MISSED);
  assert.equal(feastsInARow(s), 0);
  assert.deepEqual(feastCustomSeason(s), [], 'only once');
  assert.equal(feastLift(s), FEAST_MORALE, 'the next feast lifts spirits fully');
});

test('a single feast is not yet a custom: skipping a year costs nothing', () => {
  let s = village();
  s = feast(s).state;
  s.turn = s.lastFeast + 8;
  assert.deepEqual(feastCustomSeason(s), []);
});

test('the season end lowers spirits when an expected feast does not come', () => {
  let s = village();
  s = feast(s).state;
  s.turn += 4;
  s = feast(s).state;
  s.turn = s.lastFeast + 7;
  s.orders.harvestFeast = false;
  s.resources.food = 500;
  s = act(s, { type: 'endTurn' }).state;
  assert.ok(s.report.events.some((l) => /had come to expect one/.test(l)), s.report.events.join(' | '));
});

test('version 25 saves start with no feasts in a row', () => {
  const old = JSON.parse(JSON.stringify(newGame({ seed: 2 })));
  old.version = 25;
  delete old.feastStreak;
  const s = migrate(old);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.feastStreak, 0);
});
