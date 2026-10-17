import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { makePerson, living } from '../js/engine/state.js';
import { governorChoices } from '../js/engine/settlements.js';
import { great, greatRegard, neglected, despised } from '../js/engine/great.js';
import { pairKey } from '../js/engine/greatWorld.js';
import { envoyCrisis } from '../js/engine/greatEnvoys.js';
import { describePending } from '../js/engine/events.js';
import {
  declareThreshold, ultimatumReady, greatWarSeason, assaultCapital, warReason, warStatusLines, soldiersYouCouldField,
} from '../js/engine/war.js';
import { getAdvice } from '../js/engine/advisors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era game with one settlement, every great nation met, the Orhai
// strong and furious with you, and everyone else calm.
function warGame(seed = 1, difficulty = 'normal') {
  let s = newGame({ seed, difficulty });
  for (let i = 0; i < 48; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 30, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'irrigation', 'masonry', 'writing', 'diplomacy', 'coinage');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 1500, wood: 600, stone: 300, goods: 300, coin: 300, iron: 60,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.turn = 40;
  for (const id of Object.keys(s.great)) Object.assign(s.great[id], { heard: true, met: true, metAt: 30, relation: 0, trust: 50, lastEnvoy: 39 });
  for (const key of Object.keys(s.greatWorld.feelings)) s.greatWorld.feelings[key] = 0;
  s.greatWorld.nextEnvoy = 999;
  Object.assign(s.great.orhai, { relation: -60, strength: 120 });
  return s;
}

function ultimatum(s) {
  const ev = envoyCrisis(s);
  assert.ok(ev, 'an ultimatum should come');
  assert.equal(ev.kind, 'ultimatum');
  s.pendingEvent = ev;
  return describePending(s);
}

test('how far relations must fall: raiders are quick to it, the Keshari and Venn almost never, by difficulty', () => {
  const s = warGame();
  assert.equal(declareThreshold(s, 'orhai'), -40);
  assert.equal(declareThreshold(s, 'ostrani'), -50);
  assert.equal(declareThreshold(s, 'keshari'), -80);
  s.difficulty = 'easy';
  assert.equal(declareThreshold(s, 'orhai'), -55);
  s.difficulty = 'insane';
  assert.equal(declareThreshold(s, 'orhai'), -20);
});

test('an ultimatum needs bad blood, strength, and no peace pact, alliance, other war, or truce', () => {
  const s = warGame();
  assert.ok(soldiersYouCouldField(s) > 0);
  assert.ok(ultimatumReady(s, 'orhai'));
  s.great.orhai.relation = -35;
  assert.ok(!ultimatumReady(s, 'orhai'));
  s.great.orhai.relation = -60;
  s.great.orhai.treaties.peace = true;
  assert.ok(!ultimatumReady(s, 'orhai'));
  s.great.orhai.treaties = {};
  s.greatWorld.wars.push({ sideA: ['orhai'], sideB: ['ashani'], since: s.turn, score: 0 });
  assert.ok(!ultimatumReady(s, 'orhai'), 'busy with another war');
  s.greatWorld.wars = [];
  s.warEnded = { orhai: s.turn - 2 };
  assert.ok(!ultimatumReady(s, 'orhai'), 'under the truce after a war');
  s.warEnded = {};
  s.great.orhai.strength = 5;
  assert.ok(!ultimatumReady(s, 'orhai'), 'too weak to threaten you');
  s.great.orhai.strength = 120;
  s.wars = { dravan: { since: s.turn, score: 0 } };
  assert.ok(!ultimatumReady(s, 'orhai'), 'another great nation is already at war with you');
});

test('an ultimatum comes ahead of the envoy schedule, with terms you can meet', () => {
  let s = warGame();
  s.settlements[0].place = 'grassSea'; // On the plains, where Orhai hosts ride.
  Object.assign(s.great.ashani, { embassy: true, treaties: { alliance: true }, relation: 70, trust: 70 });
  s.greatWorld.feelings[pairKey('orhai', 'ashani')] = -60;
  const view = ultimatum(s);
  assert.match(view.title, /An ultimatum from the Orhai/);
  assert.match(view.text, /Their envoy brings terms: \d+ coin, or Thornfield, or an end to your alliance with the Ashani\./);
  assert.deepEqual(view.options.map((o) => o.id), ['pay', 'cede', 'breakAlliance', 'refuse']);
  const paid = act(s, { type: 'resolveEvent', choice: 'pay' });
  assert.ok(paid.great.orhai.relation >= declareThreshold(paid, 'orhai') + 20);
  const broke = act(s, { type: 'resolveEvent', choice: 'breakAlliance' });
  assert.ok(!broke.great.ashani.treaties.alliance);
  assert.equal(broke.great.ashani.trust, 50);
  s = act(s, { type: 'resolveEvent', choice: 'cede' });
  assert.equal(s.settlements.length, 0);
});

test('a refused ultimatum means war next season, with their allies beside them', () => {
  let s = warGame();
  Object.assign(s.great.orhai, { embassy: true, route: true });
  s.greatWorld.alliances.push(pairKey('orhai', 'dravan'));
  s.great.dravan.relation = -10;
  ultimatum(s);
  s = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.equal(s.great.orhai.warComing, s.turn + 1);
  assert.ok(getAdvice(s).some((a) => a.role === 'warChief' && /will declare war on us next season/.test(a.text)));
  s.turn += 1;
  const lines = greatWarSeason(s);
  assert.ok(s.wars.orhai && s.wars.orhai.byThem);
  assert.ok(s.wars.dravan && s.wars.dravan.byThem, 'their ally joins');
  assert.ok(!s.great.orhai.embassy && !s.great.orhai.route);
  assert.ok(lines.some((l) => /^The Orhai have declared war on you\./.test(l)));
  assert.ok(lines.some((l) => /^The Dravan have declared war on you, beside their allies the Orhai\./.test(l)));
  assert.ok(warReason(s, 'orhai'), 'you have a reason for war with them now');
  assert.match(warStatusLines(s).find((x) => x.id === 'orhai').line, /a war they declared/);
  assert.equal(s.greatWorld.declaredOnYou, 2);
});

test('a great host is seen coming, then meets your army in the valley or assaults the capital', () => {
  const s = warGame();
  s.wars = { orhai: { since: s.turn, score: 0, byThem: true } };
  s.greatHost = { foe: 'orhai', size: 40, arrives: s.turn + 2, seen: false };
  s.turn += 1;
  let lines = greatWarSeason(s);
  assert.ok(lines.some((l) => /is marching into the valley against .* It will be here next season\./.test(l)));
  assert.ok(getAdvice(s).some((a) => a.role === 'warChief' && /is marching on/.test(a.text)));
  s.turn += 1;
  const before = { people: living(s).length, coin: s.resources.coin };
  lines = greatWarSeason(s);
  assert.equal(s.greatHost, null);
  assert.equal(s.greatWorld.hostsArrived, 1);
  const held = lines.some((l) => /assaulted .* threw them back/.test(l));
  const broke = lines.some((l) => /broke into/.test(l));
  assert.ok(held || broke, lines.join(' | '));
  if (broke) assert.ok(living(s).length < before.people && s.resources.coin < before.coin);
});

test('the capital holds more often with more fighters behind stronger walls', () => {
  const count = (strong) => {
    let held = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = warGame(seed);
      s.wars = { orhai: { since: s.turn, score: 0, byThem: true } };
      if (strong) {
        s.buildings.stoneWall = 1;
        for (const p of living(s)) p.skills.hunting = 5;
      } else {
        s.buildings.palisade = 0;
      }
      if (assaultCapital(s, 'orhai', 40).some((l) => /threw them back/.test(l))) held++;
    }
    return held;
  };
  assert.ok(count(true) > count(false));
  const s = warGame();
  assert.match(assaultCapital(s, 'orhai', 3)[0], /turned back/);
});

test('with Signal beacons a host is seen as it gathers; peace sends it home', () => {
  let s = warGame();
  s.knowledge.learned.push('signalBeacons');
  s.wars = { orhai: { since: s.turn - 8, score: 60, byThem: true } };
  let lines = [];
  for (let i = 0; i < 200 && !s.greatHost; i++) { s.turn += 1; lines = greatWarSeason(s); }
  assert.ok(s.greatHost, 'a host should set out in time');
  assert.ok(s.greatHost.seen);
  assert.ok(lines.some((l) => /signal beacons have seen/.test(l)));
  s = act(s, { type: 'makePeace', foe: 'orhai', terms: 'white' });
  assert.equal(s.greatHost, null);
});

test('only wars they declared bring a great host, and only from the land peoples', () => {
  const s = warGame();
  s.wars = { orhai: { since: s.turn, score: 0, byThem: false }, haldi: { since: s.turn, score: 0, byThem: true } };
  for (let i = 0; i < 200; i++) { s.turn += 1; greatWarSeason(s); }
  assert.equal(s.greatHost ?? null, null);
});

test('settlements in their lands, neglect, and contempt for weakness lower their regard', () => {
  const s = warGame();
  s.great.orhai.relation = 0;
  s.settlements[0].place = 'grassSea';
  const has = (text) => greatRegard(s, 'orhai').find(([t]) => t === text);
  assert.deepEqual(has('your settlements in their lands'), ['your settlements in their lands', -5]);
  s.great.orhai.lastEnvoy = 10;
  s.great.orhai.metAt = 10;
  assert.ok(neglected(s, 'orhai'));
  assert.deepEqual(has('no word from you in years'), ['no word from you in years', -10]);
  s.great.orhai.strength = 500;
  assert.ok(despised(s, 'orhai'));
  assert.ok(!despised(s, 'keshari'), 'only warlike peoples despise the weak');
  s.great.orhai.embassy = true;
  assert.ok(!neglected(s, 'orhai') && !despised(s, 'orhai'), 'an embassy answers both');
});

test('the speaker warns as relations slide toward an ultimatum', () => {
  const s = warGame();
  s.great.orhai.relation = -30; // Above the line of -40 on Normal, but within 15 of it.
  assert.ok(getAdvice(s).some((a) => a.role === 'speaker' && /The Orhai think little of us \(relations -30\)\. Below -40/.test(a.text)));
});
