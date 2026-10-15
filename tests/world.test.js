import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, knowledgeBlocker, spoilageRate, saltNeeded,
} from '../js/engine/state.js';
import { governorChoices, settlementSites, harrySettlements } from '../js/engine/settlements.js';
import { expectedShipment, townKind } from '../js/engine/realm.js';
import {
  expeditionTargets, travelTime, expeditionFood, expeditionsSeason, regionStatus, findPlace, riskChance, findChance,
  expeditionCrisis, leaderChoices, foundIn,
} from '../js/engine/world.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';
import { expectedWork, toolWear } from '../js/engine/rules.js';
import { nation } from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A capital of 64 that has just begun the Nation era.
function nationGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 52; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: i % 7 === 0 ? 4 : 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 2, palisade: 1, leanTo: 20 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, { food: 900, wood: 400, stone: 200, goods: 100 });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  return s;
}

function send(s, extra = {}) {
  return act(s, {
    type: 'sendExpedition', region: 'lakes', leaderId: leaderChoices(s)[0].id, size: 4, seasons: 2, ...extra,
  });
}

// Plays seasons of expeditions alone, answering any choice with its first option.
function run(s, seasons) {
  const lines = [];
  for (let i = 0; i < seasons; i++) {
    const out = expeditionsSeason(s);
    lines.push(...out.urgent, ...out.events);
    s.turn += 1;
    const trip = expeditionCrisis(s);
    if (trip) {
      s.pendingEvent = { type: 'story', id: trip.id, exp: trip.exp.id };
      const r = applyAction(s, { type: 'resolveEvent', choice: describePending(s).options[0].id });
      Object.assign(s, r.state);
    }
  }
  return lines;
}

test('a new game knows only the valley; the Nation era brings word of its neighbors', () => {
  const camp = newGame({ seed: 1 });
  assert.equal(regionStatus(camp, 'valley'), 'explored');
  assert.equal(regionStatus(camp, 'lakes'), 'unknown');
  assert.deepEqual(expeditionTargets(camp), []);
  const s = nationGame();
  for (const id of ['lakes', 'hills', 'plains', 'woods']) assert.equal(regionStatus(s, id), 'heard');
  assert.equal(regionStatus(s, 'coast'), 'unknown');
  assert.deepEqual(expeditionTargets(s).sort(), ['hills', 'lakes', 'plains', 'woods']);
  assert.ok(s.report.decisions.some((l) => /Travelers speak of lands beyond the valley/.test(l)));
});

test('an expedition takes its party and food from the capital', () => {
  const s = nationGame();
  const before = living(s).length;
  const food = s.resources.food;
  const next = send(s);
  assert.equal(living(next).length, before - 4);
  assert.equal(next.resources.food, food - expeditionFood(s, 'lakes', 4, 2));
  assert.equal(expeditionFood(s, 'lakes', 4, 2), 16, 'next door: 4 people, 2 food each, 2 seasons');
  const exp = next.world.expeditions[0];
  assert.equal(exp.stage, 'exploring', 'no travel to a neighboring region');
  assert.equal(regionStatus(next, 'lakes'), 'explored');
  assert.equal(regionStatus(next, 'coast'), 'heard', 'they hear of what lies beyond');
  assert.match(applyAction(s, { type: 'sendExpedition', region: 'coast', leaderId: leaderChoices(s)[0].id, size: 4, seasons: 2 }).error, /heard of, next to one they know/);
  assert.match(applyAction(s, { type: 'sendExpedition', region: 'lakes', leaderId: leaderChoices(s)[0].id, size: 9, seasons: 2 }).error, /between 3 and 8/);
});

test('expeditions explore, find places, and come home', () => {
  const home = living(nationGame(3)).length;
  const s = send(nationGame(3), { seasons: 4, size: 6 });
  const lines = run(s, 6);
  assert.equal(s.world.expeditions.length, 0, lines.join(' | '));
  assert.ok(lines.some((l) => /expedition is home from the lake country/.test(l)), lines.join(' | '));
  assert.ok(foundIn(s, 'lakes').length >= 1);
  const lost = lines.filter((l) => /was killed|died on the road/.test(l)).length;
  assert.equal(living(s).length, home - lost, 'the party came home');
});

test('travel: a season for each region between, less by river or through a mapped region', () => {
  const s = nationGame();
  s.world.regions.lakes.status = 'explored';
  s.world.regions.coast.status = 'heard';
  assert.equal(travelTime(s, 'coast'), 1);
  s.world.regions.lakes.mapped = true;
  assert.equal(travelTime(s, 'coast'), 0, 'through a mapped region');
  s.world.regions.lakes.mapped = false;
  s.knowledge.learned.push('riverBoats');
  assert.equal(travelTime(s, 'coast'), 0, 'by river boat');
  s.world.regions.plains.status = 'explored';
  s.world.regions.desert.status = 'heard';
  assert.equal(travelTime(s, 'desert'), 1);
});

test('wonders lift spirits, ruins teach, and a sealed vault reveals a discovery', () => {
  const s = send(nationGame());
  const exp = s.world.expeditions[0];
  const spirits = living(s)[0].morale;
  findPlace(s, exp, 'willowIsle');
  assert.ok(living(s)[0].morale > spirits);
  assert.equal(s.deeds.wonders, 1);
  s.knowledge.current = 'writing';
  findPlace(s, exp, 'brokenCity');
  assert.equal(s.knowledge.progress.writing, 40);
  findPlace(s, exp, 'sealedVault');
  assert.ok(s.knowledge.learned.includes('writing'), 'the vault reveals what they were studying');
  findPlace(s, exp, 'frozenFalls');
  assert.ok(s.traditions.includes('horizons') || s.deeds.wonders === 2);
});

test('winter is dangerous in the northern woods, and closes the passes of the iron hills', () => {
  const s = nationGame();
  let next = send(s, { region: 'woods' });
  const exp = next.world.expeditions[0];
  next.turn = 5;
  const summer = riskChance(next, exp);
  next.turn = 7;
  assert.ok(riskChance(next, exp) > summer * 3);
  next = send(s, { region: 'hills', seasons: 1 });
  next.turn = 7;
  const hills = next.world.expeditions[0];
  const lines = run(next, 1);
  assert.ok(lines.some((l) => /Snow has closed the passes/.test(l)));
  assert.equal(hills.left, 1, 'no exploring while snowed in');
});

test('each choice on the road can be answered', () => {
  for (const id of ['expFord', 'expStrangers', 'expFever', 'expDig']) {
    const base = send(nationGame(5));
    base.turn = 4;
    const exp = base.world.expeditions[0];
    exp.pendingChoice = { id };
    maybeStartEvent(base);
    assert.equal(base.pendingEvent.id, id);
    for (const option of describePending(base).options) {
      const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
      assert.equal(r.error, undefined, `${id}/${option.id}`);
      assert.ok(r.state.report.decisions.length > 0);
      assert.equal(r.state.world.expeditions[0].pendingChoice, null);
    }
  }
});

test('meeting a small people: gifts make guides, and some may come home with you', () => {
  const base = send(nationGame());
  base.turn = 4;
  const exp = base.world.expeditions[0];
  findPlace(base, exp, 'stiltVillage');
  assert.deepEqual(exp.pendingChoice, { id: 'smallPeople', place: 'stiltVillage' });
  maybeStartEvent(base);
  assert.match(describePending(base).title, /Reed folk/);
  const gifts = act(base, { type: 'resolveEvent', choice: 'gifts' });
  assert.equal(gifts.world.peoples.reedFolk, 'friends');
  assert.ok(gifts.world.regions.lakes.mapped);
  const invite = act(base, { type: 'resolveEvent', choice: 'invite' });
  assert.ok(invite.world.expeditions[0].party.length >= 6);
});

test('Mapmaking maps a region when its expedition comes home', () => {
  const s = send(nationGame(), { seasons: 1 });
  s.knowledge.learned.push('writing', 'mapmaking');
  const exp = s.world.expeditions[0];
  const unmapped = findChance(s, exp);
  run(s, 2);
  assert.ok(s.world.regions.lakes.mapped);
  assert.ok(findChance(s, { ...exp }) > unmapped);
});

test('settling beyond the valley: places found become sites, and salt and iron come home', () => {
  let s = nationGame();
  s.world.regions.coast.status = 'explored';
  s.world.places.saltFlats.known = true;
  s.world.regions.hills.status = 'explored';
  s.world.places.redScar.known = true;
  assert.ok(settlementSites(s).includes('saltFlats'));
  assert.ok(settlementSites(s).includes('redScar'));
  s = act(s, { type: 'foundSettlement', placeId: 'saltFlats', name: 'Saltby', settlers: 10, governorId: governorChoices(s)[0].id });
  const salt = s.settlements[1];
  assert.equal(salt.role, 'mining');
  assert.equal(townKind(s, salt), 'salt');
  s.turn = 5;
  salt.population = 40;
  const unroaded = expectedShipment(s, salt);
  assert.ok(unroaded.lost > 0);
  s.knowledge.learned.push('riverBoats');
  assert.equal(expectedShipment(s, salt).lost, 0, 'by river boat nothing is lost');
  assert.equal(s.world.places.saltFlats.owner, 'player');
  assert.ok(!settlementSites(s).includes('saltFlats'));
  s = act(s, { type: 'foundSettlement', placeId: 'redScar', name: 'Redforge', settlers: 10, governorId: governorChoices(s)[0].id });
  const mine = s.settlements[2];
  assert.equal(townKind(s, mine), 'stone', 'stone until they know Mining');
  s.knowledge.learned.push('mining');
  assert.equal(townKind(s, mine), 'iron');
  // The Skarn reach the hills, but not the coast.
  s.neighbors.skarn.known = true;
  nation(s, 'skarn').warriors = 300;
  for (const t of s.settlements) t.priorities.defense = 'low';
  const lines = [];
  for (let i = 0; i < 30; i++) lines.push(...harrySettlements(s));
  assert.ok(!lines.some((l) => /Saltby/.test(l)));
  assert.ok(lines.some((l) => /Redforge|Thornfield/.test(l)));
});

test('Mining needs ore found; Salting needs salt in store', () => {
  const s = nationGame();
  assert.match(knowledgeBlocker(s, 'mining'), /find iron ore/);
  s.world.places.oldDiggings.known = true;
  assert.equal(knowledgeBlocker(s, 'mining'), null);
  assert.match(knowledgeBlocker(s, 'salting'), /salt in store/);
  s.resources.salt = 5;
  assert.equal(knowledgeBlocker(s, 'salting'), null);
});

test('iron tools help while there is iron, and wear out', () => {
  const s = nationGame();
  const p = living(s)[0];
  p.task = 'build';
  const work = expectedWork(p, s);
  s.knowledge.learned.push('mining', 'ironWorking');
  assert.equal(expectedWork(p, s), work, 'no iron, no iron tools');
  s.resources.iron = 10;
  assert.ok(expectedWork(p, s) > work);
  for (const x of living(s).slice(0, 8)) x.task = 'wood';
  assert.equal(toolWear(s, living(s)), 3, '9 users, 1 iron for every 4');
  s.pendingEvent = null;
  const next = act(s, { type: 'endTurn' });
  assert.ok(next.resources.iron < 10);
});

test('salt keeps the food, and is used up doing it', () => {
  const s = nationGame();
  const plain = spoilageRate(s);
  s.knowledge.learned.push('salting');
  s.resources.salt = 50;
  assert.equal(spoilageRate(s), plain / 2);
  assert.equal(saltNeeded(s), Math.ceil(s.resources.food / 100));
  assert.equal(expeditionFood(s, 'lakes', 4, 2), 8, 'salted food lasts twice as long');
});

test('a party can be called home', () => {
  const s = send(nationGame(), { seasons: 4 });
  const next = act(s, { type: 'recallExpedition', id: 1 });
  assert.equal(next.world.expeditions[0].stage, 'home');
  assert.match(applyAction(next, { type: 'recallExpedition', id: 1 }).error, /already on their way home/);
});

test('saves from version 29 gain the world, with word of the valley\'s neighbors in the Nation era', () => {
  const s = nationGame();
  const old = JSON.parse(JSON.stringify(s));
  old.version = 29;
  delete old.world;
  delete old.resources.iron;
  delete old.resources.salt;
  const m = migrate(old);
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(regionStatus(m, 'lakes'), 'heard');
  assert.equal(m.resources.iron, 0);
  assert.deepEqual(m.world.expeditions, []);
});
