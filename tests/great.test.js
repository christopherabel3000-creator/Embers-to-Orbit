import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, independent, knowledgeBlocker,
} from '../js/engine/state.js';
import { governorChoices, settlementsSeason } from '../js/engine/settlements.js';
import {
  expectedShipment, townKind, loyaltyTarget, governorFactor,
} from '../js/engine/realm.js';
import {
  great, greatActs, tradeTerms, tradeFactor, orhaiRaidChance, orhaiSeason, routesIncome,
} from '../js/engine/great.js';
import { regionStatus } from '../js/engine/world.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';
import { lawSettle } from '../js/engine/laws.js';
import { settlerChance } from '../js/engine/village.js';
import { expectedGoods } from '../js/engine/rules.js';
import { nation, alliedHelpers } from '../js/engine/nations.js';
import { federationCandidates, vassalReady, vassalYear } from '../js/engine/union.js';
import { skarnAtPeace } from '../js/engine/neighbors.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A capital of 64 that has just begun the Nation era, with goods and coin.
function nationGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 52; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: i % 7 === 0 ? 4 : 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 2, palisade: 1, leanTo: 20, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 900, wood: 400, stone: 200, goods: 200, coin: 100,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.turn = 8;
  return s;
}

function meet(s, id) {
  great(s, id).contactPending = true;
  maybeStartEvent(s);
  assert.equal(s.pendingEvent.id, 'greatContact');
  return act(s, { type: 'resolveEvent', choice: 'greet' });
}

test('word of the great nations comes with the Nation era, and an expedition to their homeland meets them', () => {
  const s = nationGame();
  assert.ok(great(s, 'ostrani').heard && great(s, 'orhai').heard);
  assert.ok(s.report.decisions.some((l) => /Ostrani/.test(l) && /Orhai/.test(l)));
  assert.equal(regionStatus(s, 'steppe'), 'unknown');
  s.world.regions.plains.status = 'explored';
  s.world.regions.steppe.status = 'heard';
  const leader = living(s).sort((a, b) => b.skills.scouting - a.skills.scouting)[0];
  const next = act(s, { type: 'sendExpedition', region: 'steppe', leaderId: leader.id, size: 4, seasons: 1 });
  next.world.expeditions[0].stage = 'out';
  next.world.expeditions[0].left = 1;
  next.pendingEvent = null;
  const after = act(next, { type: 'endTurn' });
  assert.equal(after.pendingEvent && after.pendingEvent.id, 'greatContact', 'meeting them comes first');
  const view = describePending(after);
  assert.match(view.title, /Meeting the Orhai/);
  const met = act(after, { type: 'resolveEvent', choice: 'greet' });
  assert.ok(great(met, 'orhai').met);
});

test('envoys trade with the Ostrani for coin, once a season', () => {
  let s = meet(nationGame(), 'ostrani');
  const terms = tradeTerms(s, 'ostrani', 'sellFine');
  assert.equal(terms.give, 'goods');
  const coin = s.resources.coin;
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'sellGoods' });
  assert.ok(s.resources.coin > coin);
  assert.match(applyAction(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'buyIron' }).error, /already sent an envoy/);
  s.turn += 1;
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'buyIron' });
  assert.equal(s.resources.iron, 10);
  assert.ok(!greatActs(s, 'ostrani').some((a) => a.act === 'sellFine'), 'fine goods need Fine crafts');
});

test('better trade: relations, a trade pact, Weights and measures, free markets, and a harbor on the coast', () => {
  const s = meet(nationGame(), 'ostrani');
  const base = tradeFactor(s, 'ostrani');
  s.knowledge.learned.push('measures');
  assert.ok(Math.abs(tradeFactor(s, 'ostrani') - base * 1.25) < 1e-9);
  great(s, 'ostrani').treaties.trade = true;
  assert.ok(Math.abs(tradeFactor(s, 'ostrani') - base * 1.25 * 1.25) < 1e-9);
  s.knowledge.learned.push('freeMarkets');
  s.marketMood = 1.4;
  assert.ok(tradeFactor(s, 'ostrani') > base * 1.25 * 1.25 * 1.3);
});

test('embassies need Diplomacy; treaties and marriages need an embassy', () => {
  let s = meet(nationGame(), 'ostrani');
  const why = (a) => greatActs(s, 'ostrani').find((x) => x.act === a).why;
  assert.match(why('embassy'), /Diplomacy/);
  assert.match(why('treaty:trade'), /embassy/);
  assert.match(why('marry'), /embassy/);
  s.knowledge.learned.push('writing', 'diplomacy');
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'embassy' });
  assert.ok(great(s, 'ostrani').embassy);
  great(s, 'ostrani').relation = 45;
  great(s, 'ostrani').trust = 50;
  s.turn += 1;
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'treaty:trade' });
  s.turn += 1;
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'marry' });
  assert.ok(great(s, 'ostrani').married && great(s, 'ostrani').treaties.trade);
});

test('trade routes bring coin every season', () => {
  let s = meet(nationGame(), 'ostrani');
  great(s, 'ostrani').relation = 20;
  s.knowledge.learned.push('roads', 'mining', 'coinage', 'tradeRoutes');
  s = act(s, { type: 'greatDiplomacy', nationId: 'ostrani', act: 'route' });
  assert.equal(routesIncome(s), 3);
  const coin = s.resources.coin;
  const next = act(s, { type: 'endTurn' });
  assert.ok(next.resources.coin >= coin + 3 - 1, 'the route paid, less the governor\'s wage');
});

test('the Orhai raid settlements within their reach, unless kept away', () => {
  const s = nationGame();
  s.world.places.grassSea.known = true;
  let next = act(s, { type: 'foundSettlement', placeId: 'grassSea', name: 'Grassmere', settlers: 10, governorId: governorChoices(s)[0].id });
  next.nationFounded = 0;
  next.turn = 40;
  assert.ok(orhaiRaidChance(next) > 0, 'their riders find you in time, met or not');
  const lines = [];
  for (let i = 0; i < 80; i++) lines.push(...orhaiSeason(next, () => 0).urgent);
  assert.ok(lines.some((l) => /Riders out of the west/.test(l)), 'the first raid is how you meet them');
  assert.ok(great(next, 'orhai').contactPending);
  great(next, 'orhai').met = true;
  great(next, 'orhai').treaties.peace = true;
  assert.equal(orhaiRaidChance(next), 0);
  great(next, 'orhai').treaties.peace = false;
  next = act(next, { type: 'greatDiplomacy', nationId: 'orhai', act: 'tribute' });
  assert.equal(orhaiRaidChance(next), 0, 'tribute keeps them away for a year');
});

test('the Orhai demand tribute; the Ostrani send a fleet', () => {
  const base = meet(meet(nationGame(), 'orhai'), 'ostrani');
  base.turn = 20;
  base.pendingEvent = { type: 'story', id: 'orhaiDemand', coin: 15 };
  for (const option of describePending(base).options) assert.equal(applyAction(base, { type: 'resolveEvent', choice: option.id }).error, undefined);
  const refused = act(base, { type: 'resolveEvent', choice: 'refuse' });
  assert.ok(great(refused, 'orhai').angryUntil > refused.turn);
  base.pendingEvent = { type: 'story', id: 'ostraniFleet' };
  const sold = act(base, { type: 'resolveEvent', choice: 'sell' });
  assert.equal(sold.resources.goods, base.resources.goods - 40);
});

test('Coinage: silver for coin, governors paid from the treasury, and masters hired for coin', () => {
  let s = nationGame();
  s.world.places.silverBeck.known = true;
  s = act(s, { type: 'foundSettlement', placeId: 'silverBeck', name: 'Silverton', settlers: 10, governorId: governorChoices(s)[0].id });
  const town = s.settlements[1];
  assert.equal(townKind(s, town), 'stone');
  s.knowledge.learned.push('mining', 'coinage');
  assert.equal(townKind(s, town), 'coin');
  const next = act(s, { type: 'endTurn' });
  assert.equal(next.wagesPaid, s.turn);
  assert.ok(loyaltyTarget(next, next.settlements[0]).reasons.some(([text, n]) => /paid from the treasury/.test(text) && n === 5));
  next.pendingEvent = null;
  const hired = act(next, { type: 'hireMaster', skill: 'learning', pay: 'coin' });
  assert.equal(hired.resources.coin, next.resources.coin - 10);
});

test('taxes bring coin, at a cost in loyalty and spirits', () => {
  let s = nationGame();
  s.knowledge.learned.push('writing', 'lawCodes', 'mining', 'coinage', 'taxes');
  const settle = lawSettle(s);
  s = act(s, { type: 'setLaw', law: 'taxes', option: 'heavy' });
  assert.equal(lawSettle(s), settle - 5);
  assert.ok(loyaltyTarget(s, s.settlements[0]).reasons.some(([text, n]) => /heavy taxes/.test(text) && n === -12));
  const coin = s.resources.coin;
  const next = act(s, { type: 'endTurn' });
  assert.ok(next.resources.coin > coin + 3);
});

test('Law codes: inheritance and worship', () => {
  let s = nationGame();
  assert.match(applyAction(s, { type: 'setLaw', law: 'worship', option: 'manyGods' }).error, /needs Law codes/);
  s.knowledge.learned.push('writing', 'lawCodes');
  const t = s.settlements[0];
  const firm = governorFactor(t, s);
  s = act(s, { type: 'setLaw', law: 'inheritance', option: 'eldest' });
  assert.ok(Math.abs(governorFactor(s.settlements[0], s) - firm - 0.05) < 1e-9);
  const settlers = settlerChance(s);
  s = act(s, { type: 'setLaw', law: 'worship', option: 'manyGods' });
  assert.ok(settlerChance(s) >= settlers + 0.1 - 1e-9 || settlers === 0);
});

test('Guild charters and Free markets close each other off', () => {
  const s = nationGame();
  const p = living(s)[0];
  const goods = expectedGoods(s, p);
  s.knowledge.learned.push('guildCharters');
  assert.ok(expectedGoods(s, p) > goods);
  assert.match(knowledgeBlocker(s, 'freeMarkets'), /chose guild charters instead/);
});

test('after a long alliance, the Velari can join your nation as a settlement', () => {
  let s = nationGame();
  s.neighbors.velari.known = true;
  const nat = nation(s, 'velari');
  nat.treaties.alliance = true;
  nat.allianceSince = 0;
  s.turn = 40; // Ten years on.
  nat.trust = 80;
  s.neighbors.velari.relation = 70;
  assert.deepEqual(federationCandidates(s), [], 'they join under written law');
  s.knowledge.learned.push('writing', 'lawCodes');
  assert.deepEqual(federationCandidates(s), ['velari']);
  s.pendingEvent = { type: 'story', id: 'federation', people: 'velari' };
  s = act(s, { type: 'resolveEvent', choice: 'welcome' });
  assert.ok(s.neighbors.velari.joined);
  assert.ok(!independent(s, 'velari'));
  const town = s.settlements.find((t) => t.federated === 'velari');
  assert.ok(town && town.population >= 12);
  assert.equal(s.places.velariFields.owner, 'player');
  assert.match(applyAction(s, { type: 'setTownDemands', settlementId: town.id, demands: 'heavy' }).error, /free people/);
  assert.match(applyAction(s, { type: 'diplomacy', neighborId: 'velari', act: 'giftFood' }).error, /part of your nation/);
  settlementsSeason(s, { routine: [] });
  assert.ok(expectedShipment(s, town).amount >= 0);
});

test('a beaten Skarn can become your vassals, until they grow strong again', () => {
  let s = nationGame();
  s.neighbors.skarn.known = true;
  nation(s, 'skarn').warriors = 5;
  assert.ok(vassalReady(s));
  s.pendingEvent = { type: 'story', id: 'skarnVassal' };
  s = act(s, { type: 'resolveEvent', choice: 'accept' });
  assert.ok(s.neighbors.skarn.vassal && skarnAtPeace(s));
  const helpers = alliedHelpers(s);
  nation(s, 'skarn').warriors = 20;
  assert.ok(alliedHelpers(s) > helpers);
  const food = s.resources.food;
  assert.ok(vassalYear(s).events.some((l) => /tribute/.test(l)));
  assert.equal(s.resources.food, food + 20);
  nation(s, 'skarn').warriors = 500;
  assert.ok(vassalYear(s).urgent.some((l) => /thrown off your rule/.test(l)));
  assert.ok(!s.neighbors.skarn.vassal);
});

test('saves from version 30 gain coin, the great nations, and their homelands', () => {
  const s = nationGame();
  const old = JSON.parse(JSON.stringify(s));
  old.version = 30;
  delete old.great;
  delete old.resources.coin;
  delete old.world.regions.delta;
  delete old.world.places.silverBeck;
  delete old.nationFounded;
  const m = migrate(old);
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.resources.coin, 0);
  assert.ok(great(m, 'ostrani').heard);
  assert.equal(regionStatus(m, 'delta'), 'unknown');
  assert.equal(m.world.places.silverBeck.known, false);
  assert.equal(m.nationFounded, 0);
});
