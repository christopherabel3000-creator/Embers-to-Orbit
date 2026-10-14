import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION } from '../js/engine/state.js';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, migrate } from '../js/engine/state.js';
import {
  checkTraditions, hasTradition, reputation, effectiveBaseline, traditionProgress, reputationSummary,
} from '../js/engine/legacy.js';
import { expectedFood, studyPoints, expectedWork } from '../js/engine/rules.js';
import { fighterStrength } from '../js/engine/battle.js';
import { driftRelations } from '../js/engine/neighbors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

test('a new camp has no traditions and no reputation', () => {
  const s = newGame({ seed: 1 });
  assert.deepEqual(s.traditions, []);
  assert.deepEqual(reputation(s), { fierce: 0, generous: 0, welcoming: 0, traders: 0 });
  assert.match(reputationSummary(s), /do not know much/);
});

test('repeated deeds become traditions, each with an effect', () => {
  const s = newGame({ seed: 1 });
  const aric = s.people[0];
  const before = {
    hunt: expectedFood(s, aric, 'hunt', 0),
    study: studyPoints(aric, s),
    work: expectedWork(aric, s),
    fight: fighterStrength(s, aric),
  };
  Object.assign(s.deeds, { battlesWon: 3, hunterSeasons: 80, discoveries: 4, built: 8 });
  const lines = checkTraditions(s);
  assert.equal(lines.length, 4);
  for (const id of ['warrior', 'hunting', 'learning', 'builders']) assert.ok(hasTradition(s, id), id);
  assert.ok(expectedFood(s, aric, 'hunt', 0) > before.hunt);
  assert.ok(studyPoints(aric, s) > before.study);
  assert.ok(expectedWork(aric, s) > before.work);
  assert.ok(fighterStrength(s, aric) > before.fight);
  assert.equal(checkTraditions(s).length, 0, 'traditions are earned only once');
});

test('deeds are recorded by ordinary play', () => {
  let s = newGame({ seed: 1 });
  s.neighbors.velari.known = true;
  s.neighbors.tellani.known = true;
  s = act(s, { type: 'diplomacy', neighborId: 'velari', act: 'giftFood' });
  s = act(s, { type: 'diplomacy', neighborId: 'tellani', act: 'woodForFood' });
  s = act(s, { type: 'endTurn' });
  assert.equal(s.deeds.gifts, 1);
  assert.equal(s.deeds.trades, 1);
  assert.ok(s.deeds.hunterSeasons >= 3);
});

test('progress toward traditions is visible', () => {
  const s = newGame({ seed: 1 });
  s.deeds.battlesWon = 2;
  const p = traditionProgress(s).find((x) => x.id === 'warrior');
  assert.equal(p.have, 2);
  assert.equal(p.need, 3);
});

test('reputation shifts how each people feels over time', () => {
  const s = newGame({ seed: 1 });
  s.deeds.battlesWon = 5;
  s.deeds.gifts = 8;
  assert.ok(effectiveBaseline(s, 'skarn') > -30, 'the Skarn respect fierce fighters');
  assert.ok(effectiveBaseline(s, 'velari') > 10, 'the Velari like generous friends');
  s.neighbors.skarn.relation = -30;
  driftRelations(s);
  assert.equal(s.neighbors.skarn.relation, -29);
  assert.match(reputationSummary(s), /fierce fighters/);
});

test('hiding ways halve losses when hiding from raiders', () => {
  const base = newGame({ seed: 1 });
  base.resources.food = 100;
  base.pendingEvent = { type: 'raid', raiders: 6, warned: true, from: 'skarn' };
  const plain = act(structuredClone(base), { type: 'resolveRaid', plan: 'hide' });
  base.traditions = ['hidden'];
  const hidden = act(base, { type: 'resolveRaid', plan: 'hide' });
  assert.ok(hidden.resources.food > plain.resources.food);
  assert.equal(hidden.deeds.hid, 1);
});

test('version 10 saves gain deeds from what was already done', () => {
  const old = newGame({ seed: 2 });
  old.version = 10;
  old.buildings.leanTo = 2;
  old.knowledge.learned = ['spears'];
  delete old.deeds;
  delete old.traditions;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.deeds.built, 2);
  assert.equal(s.deeds.discoveries, 1);
  assert.equal(living(s).length, 12);
});
