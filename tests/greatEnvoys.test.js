import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { makePerson } from '../js/engine/state.js';
import { governorChoices } from '../js/engine/settlements.js';
import {
  great, greatActs, tradeTerms, raidChance, greatRegard, WAR_AID, WAR_GOODS_FACTOR,
} from '../js/engine/great.js';
import { pairKey, warOf } from '../js/engine/greatWorld.js';
import { possibleEnvoys, envoyCrisis, townsInTheirLands } from '../js/engine/greatEnvoys.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';
import { warReason } from '../js/engine/war.js';
import { getAdvice } from '../js/engine/advisors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era game with one settlement, every great nation met, and no
// one's feelings stirring: tests set up what they need.
function envoyGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'normal' });
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
  s.turn = 20;
  for (const id of Object.keys(s.great)) Object.assign(s.great[id], { heard: true, met: true, relation: 0, trust: 50 });
  for (const key of Object.keys(s.greatWorld.feelings)) s.greatWorld.feelings[key] = 0;
  s.greatWorld.nextEnvoy = 999;
  return s;
}

// Starts an envoy of this kind from this nation, and returns its view.
function envoy(s, nation, kind) {
  const e = possibleEnvoys(s).find((x) => x.nation === nation && x.kind === kind);
  assert.ok(e, `${nation} ${kind} should be possible`);
  const { weight, ...ev } = e;
  s.pendingEvent = { type: 'story', id: 'greatEnvoy', ...ev };
  return describePending(s);
}

const atWarAmong = (s, a, b) => s.greatWorld.wars.push({ sideA: [a], sideB: [b], since: s.turn, score: 0 });

test('an envoy comes on its own schedule, about once a year, only when one has reason to', () => {
  const s = envoyGame();
  s.greatWorld.nextEnvoy = s.turn;
  assert.equal(possibleEnvoys(s).length, 0);
  assert.equal(envoyCrisis(s), null);
  assert.equal(s.greatWorld.nextEnvoy, s.turn + 1); // Looks again next season.
  s.great.ostrani.embassy = true;
  s.great.ostrani.relation = 40;
  s.turn += 1;
  maybeStartEvent(s);
  assert.equal(s.pendingEvent.id, 'greatEnvoy');
  assert.equal(s.pendingEvent.nation, 'ostrani');
  assert.ok(s.greatWorld.nextEnvoy >= s.turn + 3 && s.greatWorld.nextEnvoy <= s.turn + 5);
});

test('an offer of a treaty can be accepted or declined', () => {
  let s = envoyGame();
  Object.assign(s.great.ostrani, { embassy: true, relation: 40, trust: 50 });
  const view = envoy(s, 'ostrani', 'offer');
  assert.match(view.text, /offering a trade pact/);
  const declined = act(s, { type: 'resolveEvent', choice: 'decline' });
  assert.equal(declined.great.ostrani.relation, 37);
  s = act(s, { type: 'resolveEvent', choice: 'accept' });
  assert.ok(s.great.ostrani.treaties.trade);
});

test('the alliance pact is a treaty for a people who regard you very well', () => {
  const s = envoyGame();
  Object.assign(s.great.keshari, { embassy: true, relation: 65, trust: 65, treaties: { trade: true } });
  const acts = greatActs(s, 'keshari');
  const alliance = acts.find((a) => a.act === 'treaty:alliance');
  assert.ok(alliance && !alliance.why, 'proposing an alliance should be possible');
  s.great.keshari.treaties.alliance = true;
  assert.ok(greatRegard(s, 'keshari').some(([text, n]) => text === 'your alliance' && n === 10));
});

test('a people at war asks for help: aid wins their thanks and their enemy\'s anger', () => {
  let s = envoyGame();
  s.great.ashani.relation = 30;
  atWarAmong(s, 'orhai', 'ashani');
  const view = envoy(s, 'ashani', 'help');
  assert.ok(view.options.some((o) => o.id === 'aid'));
  assert.ok(!view.options.some((o) => o.id === 'join'), 'only an ally can be asked to join');
  const score = warOf(s, 'ashani').score;
  s = act(s, { type: 'resolveEvent', choice: 'aid' });
  assert.equal(s.resources.coin, 300 - WAR_AID.coin);
  assert.equal(s.great.ashani.relation, 38);
  assert.equal(s.great.orhai.relation, -6);
  assert.ok(warOf(s, 'ashani').score < score, 'the war turns toward the Ashani (side B)');
});

test('an ally refused remembers it; an ally answered goes to war beside you', () => {
  let s = envoyGame();
  Object.assign(s.great.ashani, { relation: 70, trust: 70, embassy: true, treaties: { alliance: true } });
  atWarAmong(s, 'orhai', 'ashani');
  const view = envoy(s, 'ashani', 'help');
  assert.ok(view.options.some((o) => o.id === 'join'));
  const refused = act(s, { type: 'resolveEvent', choice: 'stay' });
  assert.equal(refused.great.ashani.trust, 55);
  assert.equal(warReason(s, 'orhai'), 'your alliance with the Ashani');
  s = act(s, { type: 'resolveEvent', choice: 'join' });
  assert.ok(s.wars.orhai);
  assert.equal(s.wars.orhai.reason, 'your alliance with the Ashani');
  assert.ok(!s.unjustWarUntil || s.unjustWarUntil <= s.turn, 'an ally\'s war is a just war');
});

test('allies fight beside you in your wars, unless allied to your enemy', () => {
  let s = envoyGame();
  Object.assign(s.great.ashani, { relation: 70, trust: 70, embassy: true, treaties: { alliance: true } });
  Object.assign(s.great.keshari, { relation: 70, trust: 70, embassy: true, treaties: { alliance: true } });
  s.greatWorld.alliances.push(pairKey('keshari', 'orhai'));
  s.lastHarm = { orhai: s.turn };
  s = act(s, { type: 'declareWar', foe: 'orhai' });
  const strength = s.great.orhai.strength;
  s = act(s, { type: 'endTurn' });
  const answers = s.wars.orhai.allyAnswers;
  assert.ok('ashani' in answers);
  assert.ok(!('keshari' in answers), 'an ally of the Orhai stays out');
  if (answers.ashani) assert.ok(s.great.orhai.strength < strength + 10);
  assert.ok(s.report.urgent.some((l) => /the Ashani, your allies, (have joined|will not join) your war/i.test(l)));
});

test('war goods fetch more from a people at war, and their enemy trusts you less', () => {
  let s = envoyGame();
  const before = tradeTerms(s, 'ostrani', 'sellIron').getAmount;
  atWarAmong(s, 'ostrani', 'haldi');
  assert.equal(tradeTerms(s, 'ostrani', 'sellIron').getAmount, Math.max(1, Math.round(before * WAR_GOODS_FACTOR)));
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'sellIron' });
  assert.equal(s.great.haldi.trust, 48);
});

test('help and mediation from the Neighbors screen', () => {
  let s = envoyGame();
  atWarAmong(s, 'ostrani', 'haldi');
  let acts = greatActs(s, 'ostrani');
  assert.ok(!acts.find((a) => a.act === 'aid:coin').why);
  assert.match(acts.find((a) => a.act === 'mediate').why, /embassy with both/);
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'aid:goods' });
  assert.equal(s.great.ostrani.lastWarAid, s.turn);
  s.turn += 1;
  acts = greatActs(s, 'ostrani');
  assert.match(acts.find((a) => a.act === 'aid:coin').why, /this past year/);
  s.great.ostrani.embassy = true;
  s.great.haldi.embassy = true;
  s.great.ostrani.trust = 100;
  s.great.haldi.trust = 100;
  let made = false;
  for (let i = 0; i < 20 && !made; i++) {
    const r = applyAction(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'mediate' });
    assert.equal(r.error, undefined, r.error);
    made = /make peace\. Every great nation/.test(r.message);
    s = r.state;
    s.turn += 4;
    if (!made) warOf(s, 'ostrani').lastMediation = -99;
  }
  assert.ok(made, 'mediation with full trust should work within a few tries');
  assert.equal(warOf(s, 'ostrani'), null);
});

test('raiding peoples demand tribute; paying keeps them home a year, refusing angers them', () => {
  let s = envoyGame();
  s.settlements[0].place = 'redScar'; // In the iron hills, within Dravan reach.
  s.great.dravan.relation = -20;
  const view = envoy(s, 'dravan', 'tribute');
  assert.match(view.text, /demand tribute: 15 coin/);
  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.ok(raidChance(refused, 'dravan') > raidChance(s, 'dravan'));
  s = act(s, { type: 'resolveEvent', choice: 'pay' });
  assert.equal(raidChance(s, 'dravan'), 0);
  assert.equal(s.great.dravan.tributeInARow, 1);
});

test('a people at war demands you stop trading with their enemy', () => {
  let s = envoyGame();
  Object.assign(s.great.haldi, { route: true });
  atWarAmong(s, 'ostrani', 'haldi');
  envoy(s, 'ostrani', 'stopTrade');
  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.equal(refused.great.ostrani.relation, -10);
  assert.ok(refused.great.haldi.route);
  s = act(s, { type: 'resolveEvent', choice: 'agree' });
  assert.ok(!s.great.haldi.route);
  assert.equal(s.great.ostrani.relation, 10);
});

test('a strong people claims a settlement in its lands: pay, refuse, or give it up', () => {
  let s = envoyGame();
  const t = s.settlements[0];
  t.place = 'greyHeadland'; // On the coast, where Haldi longships reach.
  Object.assign(s.great.haldi, { strength: 60, relation: -10 });
  assert.deepEqual(townsInTheirLands(s, 'haldi').map((x) => x.id), [t.id]);
  const view = envoy(s, 'haldi', 'claim');
  assert.match(view.text, /claim Thornfield, at .* in the coast, as their own land/);
  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.equal(refused.great.haldi.relation, -25);
  const people = s.people.length;
  s = act(s, { type: 'resolveEvent', choice: 'cede' });
  assert.equal(s.settlements.length, 0);
  assert.equal(s.people.length, people + 1 + t.notables.length); // The governor comes home.
  assert.equal(s.great.haldi.relation, 10);
});

test('the speaker points out a chance to mediate', () => {
  const s = envoyGame();
  atWarAmong(s, 'ostrani', 'haldi');
  s.great.ostrani.embassy = true;
  s.great.haldi.embassy = true;
  assert.ok(getAdvice(s).some((a) => a.role === 'speaker' && /The Ostrani and the Haldi are at war\. With embassies in both, our envoys could try to make peace/.test(a.text)));
});

test('every envoy offers options and resolves each one', () => {
  const setups = [
    ['ostrani', 'offer', (s) => Object.assign(s.great.ostrani, { embassy: true, relation: 40 })],
    ['ashani', 'help', (s) => { Object.assign(s.great.ashani, { relation: 70, trust: 70, embassy: true, treaties: { alliance: true } }); atWarAmong(s, 'orhai', 'ashani'); }],
    ['dravan', 'tribute', (s) => { s.settlements[0].place = 'redScar'; s.great.dravan.relation = -20; }],
    ['ostrani', 'stopTrade', (s) => { s.great.haldi.route = true; atWarAmong(s, 'ostrani', 'haldi'); }],
    ['haldi', 'claim', (s) => { s.settlements[0].place = 'greyHeadland'; Object.assign(s.great.haldi, { strength: 60, relation: -10 }); }],
  ];
  for (const [nation, kind, setup] of setups) {
    const base = envoyGame();
    setup(base);
    const view = envoy(base, nation, kind);
    assert.ok(view.title && view.text && view.options.length >= 2, `${nation} ${kind}`);
    for (const option of view.options) {
      const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
      assert.equal(r.error, undefined, `${nation} ${kind}/${option.id}: ${r.error}`);
      assert.equal(r.state.pendingEvent, null);
    }
  }
});
