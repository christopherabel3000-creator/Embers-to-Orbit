import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson, migrate, SAVE_VERSION } from '../js/engine/state.js';
import { lawsAvailable, lawBlocker, lawSettle } from '../js/engine/laws.js';
import { LAWS, LAW_ORDER } from '../js/engine/data.js';
import { expectedFood, expectedGoods, expectedWork } from '../js/engine/rules.js';
import { fighterStrength } from '../js/engine/battle.js';
import { settlerChance } from '../js/engine/village.js';
import { harryChance } from '../js/engine/nations.js';
import { effectiveBaseline, attitudeLines } from '../js/engine/legacy.js';
import { EVENTS } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 8; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming', 'weaving', 'oralLaw');
  s.milestoneReached = true;
  s.resources.food = 300;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' });
}

test('every law has two choices, each with an effect', () => {
  for (const law of LAW_ORDER) {
    assert.equal(Object.keys(LAWS[law].options).length, 2, law);
    for (const o of Object.values(LAWS[law].options)) assert.ok(o.name && o.effect);
  }
});

test('laws wait for a village that knows Oral law', () => {
  const camp = newGame({ seed: 1 });
  assert.ok(!lawsAvailable(camp));
  const s = village();
  s.knowledge.learned = s.knowledge.learned.filter((k) => k !== 'oralLaw');
  assert.match(lawBlocker(s, 'food', 'equal'), /Oral law/);
  assert.ok(lawsAvailable(village()));
});

test('a law can change once a year, and changing it without a hall makes people grumble', () => {
  let s = village();
  const spirits = living(s)[0].morale;
  s = act(s, { type: 'setLaw', law: 'food', option: 'equal' });
  assert.equal(s.laws.food, 'equal');
  assert.equal(living(s)[0].morale, spirits - 5);
  assert.match(applyAction(s, { type: 'setLaw', law: 'food', option: 'byWork' }).error, /changed recently/);
  s.turn += 4;
  s = act(s, { type: 'setLaw', law: 'food', option: null });
  assert.equal(s.laws.food, null, 'back to custom');
  const hall = village();
  hall.buildings.meetingHall = 1;
  const before = living(hall)[0].morale;
  assert.equal(living(act(hall, { type: 'setLaw', law: 'justice', option: 'harsh' }))[0].morale, before);
});

test('sharing food: equal shares lift spirits; by work lifts work and lowers spirits', () => {
  const s = village();
  const p = living(s)[0];
  const food = expectedFood(s, p, 'hunt', 0);
  s.laws.food = 'equal';
  assert.equal(lawSettle(s), 5);
  s.laws.food = 'byWork';
  assert.equal(lawSettle(s), -5);
  assert.ok(expectedFood(s, p, 'hunt', 0) > food);
});

test('strangers: open gates draw settlers and fever; closed gates keep both out', () => {
  const s = village();
  s.buildings.leanTo = 12;
  const usual = settlerChance(s);
  const fever = EVENTS.feverOutbreak.weight(s);
  s.laws.strangers = 'open';
  assert.ok(settlerChance(s) > usual);
  assert.ok(EVENTS.feverOutbreak.weight(s) > fever);
  assert.ok(effectiveBaseline(s, 'velari') > effectiveBaseline(village(), 'velari'));
  assert.ok(attitudeLines(s, 'velari').some((l) => /approve of your law: open gates/.test(l)));
  s.laws.strangers = 'closed';
  assert.equal(settlerChance(s), 0);
  assert.equal(lawSettle(s), 3);
  assert.ok(EVENTS.feverOutbreak.weight(s) < fever);
  s.neighbors.skarn.nation.warriors = 30;
  const watched = harryChance(s);
  s.laws.strangers = null;
  assert.ok(harryChance(s) > watched);
});

test('service: a militia fights harder; guilds work better and fight weaker', () => {
  const s = village();
  const p = living(s).find((x) => x.name === 'Hesta');
  p.task = 'hunt';
  const fight = fighterStrength(s, p);
  const goods = expectedGoods(s, p);
  const work = expectedWork(p, s);
  s.laws.service = 'militia';
  assert.ok(fighterStrength(s, p) > fight);
  assert.ok(expectedWork(p, s) < work, 'drilling takes some time from work');
  s.laws.service = 'guilds';
  assert.ok(fighterStrength(s, p) < fight);
  assert.ok(expectedGoods(s, p) > goods);
  assert.ok(expectedWork(p, s) > work);
  p.task = 'guard';
  s.laws.service = null;
  const guard = fighterStrength(s, p);
  s.laws.service = 'guilds';
  assert.equal(fighterStrength(s, p), guard, 'guards keep their edge under guilds');
});

test('justice: harsh law makes quarrels rarer and pleases the Skarn; mercy pleases the Velari', () => {
  const s = village();
  const quarrels = EVENTS.quarrel.weight(s);
  const skarn = effectiveBaseline(s, 'skarn');
  const velari = effectiveBaseline(s, 'velari');
  s.laws.justice = 'harsh';
  assert.ok(EVENTS.quarrel.weight(s) < quarrels);
  assert.ok(effectiveBaseline(s, 'skarn') > skarn);
  assert.ok(effectiveBaseline(s, 'velari') < velari);
  assert.equal(lawSettle(s), -3);
  s.laws.justice = 'mercy';
  assert.ok(effectiveBaseline(s, 'velari') > velari);
  assert.ok(effectiveBaseline(s, 'skarn') < skarn);
});

test('laws reject unknown choices', () => {
  const s = village();
  assert.match(applyAction(s, { type: 'setLaw', law: 'taxes', option: 'high' }).error, /Unknown law/);
  assert.match(applyAction(s, { type: 'setLaw', law: 'food', option: 'feast' }).error, /Unknown choice/);
  assert.match(applyAction(s, { type: 'setLaw', law: 'food', option: null }).error, /already the law/);
});

test('version 16 saves keep to custom', () => {
  const old = newGame({ seed: 2 });
  old.version = 16;
  delete old.laws;
  delete old.lawChanged;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.laws, { food: null, strangers: null, service: null, justice: null });
});
