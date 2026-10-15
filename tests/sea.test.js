import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, knowledgeCost, knowledgeBlocker,
} from '../js/engine/state.js';
import { governorChoices, settlementsSeason } from '../js/engine/settlements.js';
import {
  loyaltyTarget, homeRoom, hasHarbor, roleAvailable, expectedShipment,
} from '../js/engine/realm.js';
import {
  foodPerPlot, farmerCapacity, expectedFood, PLANT_PER_FARMER, healingPoints,
} from '../js/engine/rules.js';
import {
  great, greatActs, raidChance, greatRaidsSeason, routeIncome,
} from '../js/engine/great.js';
import { expeditionTargets, travelTime } from '../js/engine/world.js';
import { clansMarching } from '../js/engine/clans.js';
import { lawGap } from '../js/engine/laws.js';
import { warBlocker } from '../js/engine/war.js';
import { marchSpeed } from '../js/engine/armies.js';
import { voyageBlocker, voyageMissing, VOYAGE } from '../js/engine/voyage.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';
import { townDefense } from '../js/engine/settlements.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era capital of 84, with stores, and the world around the valley explored.
function seaGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 72; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: i % 7 === 0 ? 4 : 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 30, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'irrigation', 'masonry');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 1500, wood: 600, stone: 300, goods: 300, coin: 200, iron: 100,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.turn = 8;
  s.nationFounded = 4;
  for (const id of ['lakes', 'coast', 'hills', 'plains', 'woods', 'desert', 'ruins']) s.world.regions[id].status = 'explored';
  return s;
}

function meet(s, id) {
  great(s, id).contactPending = true;
  maybeStartEvent(s);
  assert.equal(s.pendingEvent.id, 'greatContact');
  return act(s, { type: 'resolveEvent', choice: 'greet' });
}

test('the harvest: crop rotation and mills, and the plough with horses to draw it', () => {
  const s = seaGame();
  const before = foodPerPlot(1, s);
  s.knowledge.learned.push('cropRotation');
  assert.equal(foodPerPlot(1, s), before + 2);
  s.knowledge.learned.push('mills');
  assert.ok(Math.abs(foodPerPlot(1, s) - (before + 2) * 1.2) < 1e-9);
  const farmers = living(s).slice(0, 4);
  for (const p of farmers) p.task = 'farm';
  const plain = farmerCapacity(living(s), PLANT_PER_FARMER, s);
  s.knowledge.learned.push('horseBreeding', 'ironWorking', 'plough');
  s.resources.horses = 5;
  assert.equal(farmerCapacity(living(s), PLANT_PER_FARMER, s), plain, 'no plough without horses to draw it');
  s.resources.horses = 10;
  assert.ok(Math.abs(farmerCapacity(living(s), PLANT_PER_FARMER, s) - plain * 1.5) < 1e-9);
});

test('fishing boats: foragers fish in winter', () => {
  const s = seaGame();
  const p = living(s)[20];
  assert.equal(expectedFood(s, p, 'forage', 3), 0);
  s.knowledge.learned.push('riverBoats', 'fishingBoats');
  assert.ok(expectedFood(s, p, 'forage', 3) > 3);
});

test('wells, bridges, temples, and medicine', () => {
  const s = seaGame();
  assert.equal(homeRoom(s), 8);
  s.knowledge.learned.push('wells');
  assert.equal(homeRoom(s), 10);
  const army = { companies: [{ kind: 'spearmen', soldiers: 10 }] };
  const pace = marchSpeed(s, army, 1);
  s.knowledge.learned.push('roads', 'mathematics', 'bridges');
  assert.ok(Math.abs(marchSpeed(s, army, 1) - pace * 4 / 3) < 1e-9);
  const t = s.settlements[0];
  const loyal = loyaltyTarget(s, t).target;
  s.knowledge.learned.push('writing', 'temples');
  assert.equal(loyaltyTarget(s, t).target, loyal + 3);
  const healer = living(s)[0];
  const heal = healingPoints(s, healer);
  s.knowledge.learned.push('medicine', 'physicians');
  assert.ok(healingPoints(s, healer) > heal * 1.4);
});

test('a temple\'s festival lifts the settlements when the capital feasts', () => {
  let s = seaGame();
  s.knowledge.learned.push('writing', 'temples');
  const before = s.settlements[0].loyalty;
  s = act(s, { type: 'holdFeast' });
  assert.equal(s.settlements[0].loyalty, before + 5);
});

test('a crown or an assembly: how fast laws change, wars, and loyalty', () => {
  let s = seaGame();
  s.knowledge.learned.push('writing', 'lawCodes');
  s.knowledge.learned.push('chieftain');
  assert.equal(knowledgeCost(s, 'crown'), 60, 'cheaper for a people led by a chieftain');
  assert.equal(knowledgeCost(s, 'assembly'), 90);
  s.knowledge.learned.push('assembly');
  assert.match(knowledgeBlocker(s, 'crown'), /closed off|An assembly/i);
  assert.equal(lawGap(s), 8);
  s.neighbors.skarn.known = true;
  assert.match(warBlocker(s, 'skarn'), /assembly/);
  s.lastHarm.skarn = s.turn;
  assert.equal(warBlocker(s, 'skarn'), null, 'with a reason, the assembly votes for war');
  const reasons = loyaltyTarget(s, s.settlements[0]).reasons.map(([text]) => text);
  assert.ok(reasons.some((r) => /assembly/.test(r)));
  s = seaGame();
  s.knowledge.learned.push('writing', 'lawCodes', 'crown');
  assert.equal(lawGap(s), 2);
});

test('word of a homeland comes with an expedition that hears of it; reaching it meets its people', () => {
  let s = seaGame();
  s.world.regions.highlands.status = 'unknown';
  s.world.regions.ruins.status = 'heard';
  const leader = living(s).sort((a, b) => b.skills.scouting - a.skills.scouting)[0];
  s = act(s, { type: 'sendExpedition', region: 'ruins', leaderId: leader.id, size: 4, seasons: 1 });
  const exp = s.world.expeditions[0];
  exp.stage = 'out';
  exp.left = 1;
  s = act(s, { type: 'endTurn' });
  assert.equal(s.world.regions.highlands.status, 'heard');
  assert.ok(great(s, 'keshari').heard);
  assert.ok(s.report.events.some((l) => /Keshari/.test(l)));
  s.pendingEvent = null;
  s.world.regions.ruins.status = 'explored';
  assert.ok(expeditionTargets(s).includes('highlands'));
  s = meet(s, 'keshari');
  assert.ok(great(s, 'keshari').met);
});

test('the Keshari sell what their scholars know', () => {
  let s = meet(seaGame(), 'keshari');
  s.knowledge.current = 'mathematics';
  s.knowledge.learned.push('writing');
  const acts = greatActs(s, 'keshari').map((a) => a.act);
  assert.ok(acts.includes('buyLearning'));
  s = act(s, { type: 'greatDiplomacy', nationId: 'keshari', act: 'buyLearning' });
  assert.equal(s.knowledge.progress.mathematics, 30);
});

test('the Dravan raid the iron hills, and a peace pact with them keeps the hill clans home', () => {
  let s = seaGame();
  s.world.places.redScar.known = true;
  s = act(s, { type: 'foundSettlement', placeId: 'redScar', name: 'Redgate', settlers: 10, governorId: governorChoices(s)[0].id });
  s.turn = 40;
  assert.ok(raidChance(s, 'dravan') > 0, 'they find you in time, met or not');
  let raided = 0;
  for (let i = 0; i < 60 && !raided; i++) {
    const out = greatRaidsSeason(s, townDefense);
    if (out.urgent.some((l) => /Redgate/.test(l))) raided += 1;
  }
  assert.ok(raided, 'their war bands come against it');
  assert.ok(great(s, 'dravan').met || great(s, 'dravan').contactPending);
  s.neighbors.skarn.known = true;
  s.clans.warriors = 12;
  assert.equal(clansMarching(s), 12);
  great(s, 'dravan').treaties.peace = true;
  assert.equal(clansMarching(s), 0);
  assert.equal(raidChance(s, 'dravan'), 0);
});

test('ships: the coast at once, the isles at all, and the Haldi\'s shipwrights', () => {
  const s = seaGame();
  s.world.regions.isles.status = 'heard';
  assert.ok(!expeditionTargets(s).includes('isles'), 'the isles are reached only by ship');
  s.knowledge.learned.push('riverBoats', 'ironWorking', 'shipbuilding');
  assert.ok(expeditionTargets(s).includes('isles'));
  assert.equal(travelTime(s, 'isles'), 0);
  const full = knowledgeCost(s, 'navigation');
  great(s, 'haldi').embassy = true;
  assert.equal(knowledgeCost(s, 'navigation'), Math.round(full * 2 / 3));
});

test('a port at the Grey headland sends home coin, and builds the harbor', () => {
  let s = seaGame();
  s.world.places.greyHeadland.known = true;
  s.world.places.shellStrand.known = true;
  assert.ok(!roleAvailable(s, 'port', 'greyHeadland'), 'a port needs Harbors');
  s.knowledge.learned.push('riverBoats', 'ironWorking', 'shipbuilding', 'harbors');
  assert.ok(roleAvailable(s, 'port', 'greyHeadland'));
  assert.ok(!roleAvailable(s, 'port', 'shellStrand'), 'only where a harbor can stand');
  assert.match(applyAction(s, { type: 'foundSettlement', placeId: 'shellStrand', name: 'Shells', settlers: 10, governorId: governorChoices(s)[0].id, role: 'port' }).error, /harbor/);
  s = act(s, { type: 'foundSettlement', placeId: 'greyHeadland', name: 'Greyhaven', settlers: 12, governorId: governorChoices(s)[0].id, role: 'port' });
  const port = s.settlements.find((t) => t.name === 'Greyhaven');
  assert.equal(expectedShipment(s, port).kind, 'coin');
  assert.ok(!hasHarbor(s));
  for (let i = 0; i < 12 && !hasHarbor(s); i++) {
    settlementsSeason(s);
    s.turn += 1;
  }
  assert.ok(hasHarbor(s), 'its governor builds the harbor');
});

test('the voyage across the open sea ends the Nation era', () => {
  let s = seaGame();
  assert.ok(voyageMissing(s).length >= 3);
  assert.match(voyageBlocker(s), /Navigation/);
  // Everything it needs.
  for (let i = living(s).length; i < VOYAGE.capital + 10; i++) s.people.push(makePerson({ name: `Sailor${i}`, note: '', age: 25, skills: { hunting: 1, foraging: 1, building: 1, healing: 0, scouting: 2, learning: 0 } }, s.nextPersonId++, 'forage'));
  for (let i = 0; i < 3; i++) s.settlements.push({ ...s.settlements[0], id: 10 + i, name: `Town${i}` });
  s.settlements.push({ ...s.settlements[0], id: 20, name: 'Greyhaven', role: 'port', place: 'greyHeadland', buildings: { ...s.settlements[0].buildings, works: { port: 1 } } });
  s.knowledge.learned.push('navigation');
  for (const id of ['ostrani', 'orhai', 'keshari']) great(s, id).met = true;
  assert.deepEqual(voyageMissing(s), []);
  assert.equal(voyageBlocker(s), null);
  const before = living(s).length;
  s = act(s, { type: 'sendVoyage' });
  assert.equal(s.era, 'discovery');
  assert.equal(living(s).length, before - VOYAGE.crew);
  assert.ok(s.report.decisions.some((l) => /Age of Discovery/.test(l)));
  assert.match(applyAction(s, { type: 'sendVoyage' }).error, /already sailed/);
  // The game goes on as in the Nation era.
  s = act(s, { type: 'endTurn' });
  assert.ok(s.settlements.length >= 4);
});

test('the Ashani\'s caravans are the richest route', () => {
  const s = seaGame();
  assert.equal(routeIncome(s, 'ashani'), 4);
  great(s, 'ashani').richRoute = true;
  assert.equal(routeIncome(s, 'ashani'), 8);
});

test('first contact with a new great nation is a choice', () => {
  const s = seaGame();
  great(s, 'venn').contactPending = true;
  maybeStartEvent(s);
  assert.equal(s.pendingEvent.id, 'greatContact');
  assert.match(describePending(s).title, /Venn/);
});

test('saves from version 32 gain the other five great nations and their homelands', () => {
  const s = seaGame();
  for (const id of ['keshari', 'dravan', 'ashani', 'haldi', 'venn']) delete s.great[id];
  for (const id of ['crags', 'highlands', 'north', 'southlands', 'isles']) delete s.world.regions[id];
  delete s.world.places.stonehelm;
  delete s.voyage;
  s.version = 32;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.ok(m.great.keshari && m.great.venn);
  assert.equal(m.world.regions.highlands.status, 'heard', 'next to the explored ruins');
  assert.ok(m.great.keshari.heard);
  assert.equal(m.world.regions.isles.status, 'heard');
  assert.equal(m.voyage, null);
});
