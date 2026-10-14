import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate, SAVE_VERSION } from '../js/engine/state.js';
import { NATION_EVENTS } from '../js/engine/nationEvents.js';
import { describePending, EVENTS } from '../js/engine/events.js';
import {
  nation, between, shiftBetween, valleyYear, owner, valleyLines,
} from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A village where every nation event can happen.
function village(seed = 1) {
  let s = newGame({ seed });
  for (let i = 0; i < 12; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'weaving');
  s.milestoneReached = true;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  s.places.meadow.known = true;
  s.places.herbHillside.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  s = act(s, { type: 'claimPlace', placeId: 'herbHillside' });
  Object.assign(s.resources, { food: 300, goods: 40 });
  nation(s, 'skarn').warriors = 20;
  return s;
}

// Sets each event up so it can happen, then returns the state.
const SETUPS = {
  treatyOffer: (s) => { s.neighbors.tellani.relation = 40; },
  landDemand: (s) => { s.neighbors.velari.relation = -10; },
  takeSides: (s) => { shiftBetween(s, 'velari', 'tellani', -40); },
  caravanEscort: (s) => { s.neighbors.tellani.relation = 10; },
  skarnEnvoy: () => {},
};

test('every nation event can happen, offers choices, and resolves each one', () => {
  for (const [id, ev] of Object.entries(NATION_EVENTS)) {
    const base = village();
    SETUPS[id](base);
    assert.ok(ev.weight(base) > 0, `${id} should be possible`);
    base.pendingEvent = { type: 'story', id, ...ev.start(base) };
    const view = describePending(base);
    assert.ok(view.title && view.text && view.options.length >= 2, id);
    for (const option of view.options) {
      const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
      assert.equal(r.error, undefined, `${id}/${option.id}: ${r.error}`);
      assert.equal(r.state.pendingEvent, null);
      assert.ok(r.state.report.decisions.length > 0, `${id}/${option.id}`);
    }
  }
  assert.ok(Object.keys(NATION_EVENTS).every((id) => id in EVENTS));
});

test('nation events need the nations', () => {
  const camp = newGame({ seed: 1 });
  for (const [id, ev] of Object.entries(NATION_EVENTS)) assert.equal(ev.weight(camp), 0, id);
});

test('the nations start with feelings about each other, which drift and can turn to blows', () => {
  const s = village();
  assert.equal(between(s, 'velari', 'tellani'), 30);
  assert.equal(between(s, 'tellani', 'velari'), 30, 'the same either way round');
  assert.ok(between(s, 'velari', 'skarn') < 0);
  assert.equal(valleyLines(s, (v) => String(v)).length, 3);
  shiftBetween(s, 'velari', 'tellani', -80);
  s.turn = 8;
  const warriors = nation(s, 'velari').warriors;
  const lines = valleyYear(s);
  assert.ok(lines.some((l) => /come to blows/.test(l)));
  assert.ok(nation(s, 'velari').warriors < warriors);
  assert.ok(between(s, 'velari', 'tellani') > -50, 'and drifts back a little');
});

test('accepting a treaty offer makes the treaty', () => {
  let s = village();
  s.neighbors.tellani.relation = 40;
  s.pendingEvent = { type: 'story', id: 'treatyOffer', ...NATION_EVENTS.treatyOffer.start(s) };
  const { nation: who, key } = s.pendingEvent;
  s = act(s, { type: 'resolveEvent', choice: 'accept' });
  assert.equal(nation(s, who).treaties[key], true);
});

test('yielding land to a demand hands it over; refusing is remembered', () => {
  const s = village();
  s.neighbors.velari.relation = -10;
  s.pendingEvent = { type: 'story', id: 'landDemand', ...NATION_EVENTS.landDemand.start(s) };
  const place = s.pendingEvent.place;
  const yielded = act(s, { type: 'resolveEvent', choice: 'yield' });
  assert.equal(owner(yielded, place), 'velari');
  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.equal(owner(refused, place), 'player');
  assert.ok(nation(refused, 'velari').memory.some((m) => /refused to give up/.test(m.text)));
});

test('mediating a quarrel brings the two peoples back toward peace', () => {
  const s = village();
  shiftBetween(s, 'velari', 'tellani', -40);
  const before = between(s, 'velari', 'tellani');
  NATION_EVENTS.takeSides.resolve(s, { over: 'a stolen herd' }, 'mediate');
  assert.ok(between(s, 'velari', 'tellani') >= before + 25);
});

test('standing aside for the Skarn buys a truce, but the Velari may learn of it', () => {
  let learned = false;
  for (let seed = 0; seed < 12 && !learned; seed++) {
    const s = village(seed + 2);
    const trust = nation(s, 'velari').trust;
    NATION_EVENTS.skarnEnvoy.resolve(s, {}, 'agree');
    assert.ok(s.neighbors.skarn.truceUntil > s.turn);
    if (nation(s, 'velari').trust < trust) learned = true;
  }
  assert.ok(learned, 'sometimes the Velari find out');
  const warned = village();
  const relation = warned.neighbors.velari.relation;
  NATION_EVENTS.skarnEnvoy.resolve(warned, {}, 'warn');
  assert.ok(warned.neighbors.velari.relation > relation);
});

test('version 20 village saves gain relations between the nations', () => {
  const old = village();
  old.version = 20;
  delete old.valley;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(between(s, 'velari', 'skarn'), -40);
  assert.ok(living(s).length > 0);
});
