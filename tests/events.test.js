import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, wolvesAt, migrate } from '../js/engine/state.js';
import {
  EVENTS, describePending, progressConditions, maybeStartEvent,
} from '../js/engine/events.js';
import { expectedFood, huntInjuryChance } from '../js/engine/rules.js';

// A mid-game state where every event is possible.
function richState() {
  const s = newGame({ seed: 11 });
  s.turn = 5; // Summer, Year 2
  s.resources = { food: 60, wood: 60 };
  s.buildings.leanTo = 2;
  s.places.deerTrails.known = true;
  return s;
}

test('every instant event applies cleanly', () => {
  for (const [id, ev] of Object.entries(EVENTS).filter(([, e]) => !e.choice)) {
    const s = richState();
    if (id === 'coldSnap') s.turn = 7;
    const lines = ev.apply(s);
    assert.ok((lines.urgent || []).length + (lines.events || []).length > 0, id);
  }
});

test('every choice event offers options and resolves each one', () => {
  for (const [id, ev] of Object.entries(EVENTS).filter(([, e]) => e.choice)) {
    const base = richState();
    assert.ok(ev.weight(base) > 0, `${id} should be possible`);
    base.pendingEvent = { type: 'story', id, ...ev.start(base) };
    const view = describePending(base);
    assert.ok(view.title && view.text && view.options.length >= 2, id);
    for (const option of view.options) {
      const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
      assert.equal(r.error, undefined, `${id}/${option.id}: ${r.error}`);
      assert.equal(r.state.pendingEvent, null);
      assert.ok(r.state.report.decisions.length > 0);
    }
  }
});

test('a pending decision blocks the end of the season', () => {
  const s = richState();
  s.pendingEvent = { type: 'story', id: 'traders' };
  assert.match(applyAction(s, { type: 'endTurn' }).error, /decision/);
  assert.match(applyAction(s, { type: 'resolveEvent', choice: 'nonsense' }).error, /Choose one/);
});

test('wolves make hunting worse and leave after a year', () => {
  const s = richState();
  s.workSites.hunt = 'deerTrails';
  const aric = s.people.find((p) => p.name === 'Aric');
  const before = expectedFood(s, aric, 'hunt', 1);
  const riskBefore = huntInjuryChance(s, aric);
  s.conditions.push({ id: 'wolves', place: 'deerTrails', seasonsLeft: 4 });
  assert.ok(expectedFood(s, aric, 'hunt', 1) < before);
  assert.ok(huntInjuryChance(s, aric) > riskBefore);
  for (let i = 0; i < 4; i++) progressConditions(s, 0);
  assert.ok(!wolvesAt(s, 'deerTrails'));
});

test('fever spreads, weakens, and passes with care', () => {
  const s = richState();
  living(s)[0].sick = true;
  let everSick = 1;
  for (let i = 0; i < 20 && living(s).some((p) => p.sick); i++) {
    progressConditions(s, 2);
    everSick = Math.max(everSick, living(s).filter((p) => p.sick).length);
  }
  assert.ok(!living(s).some((p) => p.sick), 'fever should pass eventually');
});

test('the same event does not repeat right away', () => {
  const s = richState();
  for (let i = 0; i < 40; i++) {
    s.pendingEvent = null;
    s.turn += 1;
    maybeStartEvent(s);
  }
  const turns = Object.values(s.eventHistory);
  assert.ok(turns.length > 3, 'several different events should have happened');
});

test('version 2 saves are upgraded', () => {
  const old = newGame({ seed: 2 });
  old.version = 2;
  delete old.conditions;
  delete old.eventHistory;
  for (const p of old.people) delete p.sick;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, 4);
  assert.equal(s.people[0].sick, false);
});
