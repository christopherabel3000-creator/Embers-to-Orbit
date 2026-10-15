import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION,
} from '../js/engine/state.js';
import { governorChoices } from '../js/engine/settlements.js';
import { loyaltyTarget } from '../js/engine/realm.js';
import {
  createField, estimateField, autoField, SOLDIER, WALL_COVER,
} from '../js/engine/field.js';
import {
  armySoldiers, commanderChoices, raiseSources, marchSeasons, inSupply, supplyCapacity, soldierWorth,
  pathTo, armiesUpkeep,
} from '../js/engine/armies.js';
import {
  warReason, peaceOptions, foeForce, meetOnRoad, warSeason, foeUnits,
} from '../js/engine/war.js';
import { passHeld, homeBesieged } from '../js/engine/warStatus.js';
import { nation, skarnRaidFactor, harryChance } from '../js/engine/nations.js';
import { clansMarching } from '../js/engine/clans.js';
import { great, greatActs, tradesWith } from '../js/engine/great.js';
import { describePending } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A Nation-era capital of 84 with stores to arm, the world explored, and the
// Skarn known.
function warGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < 72; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 30, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'spears', 'bows', 'drill');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 1500, wood: 600, stone: 300, goods: 300, coin: 100,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  s.turn = 8;
  s.nationFounded = 4;
  for (const id of Object.keys(s.world.regions)) s.world.regions[id].status = 'explored';
  s.neighbors.skarn.known = true;
  return s;
}

function raise(s, kind = 'spearmen', from = 'capital') {
  return act(s, { type: 'raiseArmy', commanderId: commanderChoices(s)[0].id, kind, from });
}

const unit = (ours, kind, n, worth, id) => ({
  id, kind, name: `${kind} ${id}`, soldiers: n, start: n, power: SOLDIER * worth, ours, broken: false, zone: 'center',
});

test('field battles: numbers and the mix of soldiers decide them, and walls need engines', () => {
  const field = (us, them, opts = {}) => createField({
    region: opts.region || 'valley', foe: opts.foe || 'skarn', foeName: 'the Skarn', us, them, attacker: opts.attacker || 'them', walls: opts.walls || null,
  });
  const state = { rng: 12345 };
  const ours = (kinds) => kinds.map((k, i) => unit(true, k, 10, 2, i + 1));
  const theirs = (kinds) => kinds.map((k, i) => unit(false, k, 10, 2, `t${i}`));
  const stronger = estimateField(state, field(ours(['spearmen', 'spearmen', 'spearmen', 'archers']), theirs(['warriors', 'warriors', 'bowmen'])), 40);
  const weaker = estimateField(state, field(ours(['spearmen', 'spearmen', 'archers']), theirs(['warriors', 'warriors', 'warriors', 'bowmen'])), 40);
  assert.ok(stronger > 0.85, `four companies against three usually win (${stronger})`);
  assert.ok(weaker < 0.2, `three against four usually lose (${weaker})`);
  const walls = { side: 'them', cover: WALL_COVER };
  const storm = (kinds) => estimateField(state, field(ours(kinds), theirs(['warriors', 'warriors', 'bowmen']), { attacker: 'us', walls: { ...walls } }), 40);
  const bare = storm(['spearmen', 'spearmen', 'spearmen', 'spearmen', 'archers', 'archers']);
  const engines = storm(['spearmen', 'spearmen', 'spearmen', 'spearmen', 'archers', 'archers', 'engines', 'engines']);
  assert.ok(engines > bare, `siege engines help storm walls (${bare} to ${engines})`);
  const plains = estimateField(state, field(ours(['spearmen', 'spearmen', 'spearmen', 'archers']), [unit(false, 'horseArchers', 10, 2, 'a'), unit(false, 'horseArchers', 10, 2, 'b'), unit(false, 'lancers', 10, 2, 'c'), unit(false, 'lancers', 10, 2, 'd')], { foe: 'orhai', region: 'plains' }), 40);
  const forest = estimateField(state, field(ours(['spearmen', 'spearmen', 'spearmen', 'archers']), [unit(false, 'horseArchers', 10, 2, 'a'), unit(false, 'horseArchers', 10, 2, 'b'), unit(false, 'lancers', 10, 2, 'c'), unit(false, 'lancers', 10, 2, 'd')], { foe: 'orhai', region: 'valley' }), 40);
  assert.ok(forest > plains, `riders are deadlier on open grass (${plains}) than in the forest (${forest})`);
  const b = field(ours(['spearmen', 'archers']), theirs(['warriors']));
  assert.ok(['won', 'lost'].includes(autoField(state, b)));
  assert.ok(b.round >= 1 && b.round <= 6);
});

test('raising an army takes soldiers from the capital and pays for their arms', () => {
  let s = warGame();
  const before = living(s).length;
  const wood = s.resources.wood;
  s = raise(s);
  assert.equal(s.armies.length, 1);
  const army = s.armies[0];
  assert.equal(armySoldiers(army), 10);
  assert.equal(living(s).length, before - 11, 'ten soldiers and their commander left the capital');
  assert.equal(s.resources.wood, wood - 10);
  assert.equal(army.food, supplyCapacity(s, army), 'it fills its packs from the stores');
  s = act(s, { type: 'raiseCompany', armyId: army.id, kind: 'archers', from: 'capital' });
  assert.equal(s.armies[0].companies.length, 2);
  assert.match(applyAction(s, { type: 'raiseCompany', armyId: army.id, kind: 'cavalry', from: 'capital' }).error, /Cavalry/);
  // The capital keeps 30.
  while (!applyAction(s, { type: 'raiseCompany', armyId: army.id, kind: 'spearmen', from: 'capital' }).error) {
    s = act(s, { type: 'raiseCompany', armyId: army.id, kind: 'spearmen', from: 'capital' });
  }
  assert.ok(living(s).length >= 30);
  const home = living(s).length;
  const soldiers = armySoldiers(s.armies[0]);
  s = act(s, { type: 'disbandArmy', armyId: army.id });
  assert.equal(living(s).length, home + soldiers + 1, 'everyone comes home');
  assert.equal(s.armies.length, 0);
});

test('settlements send companies, and miss them', () => {
  let s = warGame();
  const t = s.settlements[0];
  t.population = 40;
  assert.ok(raiseSources(s).some((x) => x.from === t.id));
  s = raise(s, 'spearmen', String(t.id));
  assert.equal(s.settlements[0].population, 30);
  const reasons = loyaltyTarget(s, s.settlements[0]).reasons.map(([text]) => text);
  assert.ok(reasons.some((r) => /away with your armies/.test(r)));
  s = act(s, { type: 'disbandArmy', armyId: s.armies[0].id });
  assert.equal(s.settlements[0].population, 40);
});

test('soldiers are worth more with drill, iron arms, and a standing army', () => {
  const s = warGame();
  const militia = soldierWorth(s, { training: 'militia', iron: false });
  assert.ok(soldierWorth(s, { training: 'standing', iron: false }) > militia);
  assert.ok(soldierWorth(s, { training: 'levies', iron: false }) < militia);
  assert.ok(soldierWorth(s, { training: 'militia', iron: true }) > militia);
});

test('marching: winter stops it, spring mud slows it, and roads speed it', () => {
  let s = warGame();
  s = raise(s);
  const army = s.armies[0];
  assert.deepEqual(pathTo(s, 'valley', 'steppe'), ['plains', 'steppe']);
  s.turn = 8; // Spring.
  assert.equal(marchSeasons(s, army, 'plains'), 2, 'mud: half a region in spring');
  s.turn = 9; // Summer.
  assert.equal(marchSeasons(s, army, 'steppe'), 2);
  s.turn = 11; // Winter.
  s = act(s, { type: 'armyOrder', armyId: army.id, order: 'march', to: 'plains' });
  const up = armiesUpkeep(s);
  assert.equal(s.armies[0].location, 'valley', 'no march in winter');
  assert.ok(up.events.some((l) => /snow has stopped/.test(l)));
  s.turn = 9;
  armiesUpkeep(s);
  assert.equal(s.armies[0].location, 'plains');
  assert.equal(s.armies[0].order, 'hold');
  assert.ok(inSupply(s, 'plains'), 'the regions next to the valley are within reach of the stores');
  assert.ok(!inSupply(s, 'steppe'));
  s.knowledge.learned.push('logistics');
  assert.ok(inSupply(s, 'steppe'), 'Logistics reaches one region further');
});

test('beyond its supply an army lives on what it carries, and starves when it runs out', () => {
  let s = warGame();
  s = raise(s);
  const army = s.armies[0];
  army.location = 'steppe';
  army.food = 5;
  const up = armiesUpkeep(s);
  assert.ok(up.urgent.some((l) => /ran out of food/.test(l)));
  assert.equal(armySoldiers(s.armies[0]), 9);
  assert.equal(s.armies[0].march.to, 'valley', 'it turns for home');
});

test('declaring war: with a reason, or without one at a cost', () => {
  let s = warGame();
  assert.equal(warReason(s, 'skarn'), null);
  s.lastHarm.skarn = s.turn - 2;
  assert.match(warReason(s, 'skarn'), /raids/);
  s = act(s, { type: 'declareWar', foe: 'skarn' });
  assert.ok(s.wars.skarn);
  assert.ok(!s.unjustWarUntil, 'a just war troubles no one');
  // Without cause, against the Ostrani: their trade ends, and everyone thinks less of you.
  great(s, 'ostrani').met = true;
  great(s, 'ostrani').relation = 30;
  const tellani = s.neighbors.tellani.relation;
  s.neighbors.tellani.known = true;
  assert.ok(tradesWith(s, 'ostrani').length > 0);
  s = act(s, { type: 'declareWar', foe: 'ostrani' });
  assert.ok(s.unjustWarUntil > s.turn);
  assert.equal(tradesWith(s, 'ostrani').length, 0);
  assert.equal(greatActs(s, 'ostrani').length, 0);
  assert.equal(s.neighbors.tellani.relation, tellani - 10);
  const reasons = loyaltyTarget(s, s.settlements[0]).reasons.map(([text]) => text);
  assert.ok(reasons.includes('a war without just cause'));
});

test('a siege pens the Skarn in their hold, starves them, and wins the war', () => {
  let s = warGame();
  s = raise(s);
  s = act(s, { type: 'raiseCompany', armyId: s.armies[0].id, kind: 'spearmen', from: 'capital' });
  s = act(s, { type: 'raiseCompany', armyId: s.armies[0].id, kind: 'archers', from: 'capital' });
  s = act(s, { type: 'declareWar', foe: 'skarn' });
  s = act(s, { type: 'armyStance', armyId: s.armies[0].id, stance: 'commander' });
  assert.match(applyAction(s, { type: 'armyOrder', armyId: s.armies[0].id, order: 'besiege' }).error || '', /^$/);
  s = act(s, { type: 'armyOrder', armyId: s.armies[0].id, order: 'besiege' });
  assert.ok(homeBesieged(s, 'skarn'));
  assert.equal(skarnRaidFactor(s), 0, 'no raids from a besieged hold');
  assert.equal(harryChance(s), 0);
  nation(s, 'skarn').warriors = 12; // Too few to break the siege.
  s.clans.warriors = 0;
  const before = foeForce(s, 'skarn');
  for (let i = 0; i < 8 && !s.wars.skarn.stormed; i++) {
    const out = warSeason(s);
    assert.ok(out.urgent.length);
    s.turn += 1;
  }
  assert.ok(s.wars.skarn.stormed, 'starved out in the end');
  assert.ok(foeForce(s, 'skarn') < before);
  assert.ok(peaceOptions(s, 'skarn').every((o) => !o.why), 'they accept any terms now');
  s = act(s, { type: 'makePeace', foe: 'skarn', terms: 'vassal' });
  assert.ok(s.neighbors.skarn.vassal);
  assert.ok(!s.wars.skarn);
  assert.match(applyAction(s, { type: 'declareWar', foe: 'skarn' }).error, /vassals|peace/);
});

test('peace terms follow the war score; tribute comes each spring', () => {
  let s = warGame();
  s.lastHarm.skarn = s.turn;
  s = act(s, { type: 'declareWar', foe: 'skarn' });
  const why = (id) => peaceOptions(s, 'skarn').find((o) => o.id === id).why;
  assert.equal(why('white'), null);
  assert.match(why('tribute'), /30/);
  s.wars.skarn.score = -30;
  assert.match(why('white'), /-20/);
  assert.ok(peaceOptions(s, 'skarn').some((o) => o.id === 'pay'), 'losing, peace can be bought');
  s.wars.skarn.score = 35;
  s = act(s, { type: 'makePeace', foe: 'skarn', terms: 'tribute' });
  assert.ok(s.neighbors.skarn.peace);
  assert.equal(s.tributes.length, 1);
  s.turn = 11; // The next season is spring.
  const food = s.resources.food;
  s.pendingEvent = null;
  s = act(s, { type: 'endTurn' });
  assert.ok(s.report.events.some((l) => /paid their tribute/.test(l)));
  assert.ok(s.resources.food > food - 400);
});

test('a battle waits for the player, who can deploy and give orders round by round', () => {
  let s = warGame();
  s = raise(s);
  s = act(s, { type: 'raiseCompany', armyId: s.armies[0].id, kind: 'archers', from: 'capital' });
  const lines = meetOnRoad(s, { raiders: 12, from: 'skarn' });
  assert.ok(lines.some((l) => /awaits your orders/.test(l)));
  assert.equal(s.pendingEvent.type, 'field');
  assert.match(applyAction(s, { type: 'endTurn' }).error, /battle/);
  s = act(s, { type: 'fieldDeploy', formation: 'line' });
  for (let i = 0; i < 6 && s.pendingEvent && s.pendingEvent.type === 'field'; i++) {
    s = act(s, { type: 'fieldOrders', orders: { left: 'hold', center: 'hold', right: 'hold' } });
  }
  assert.ok(!s.pendingEvent || s.pendingEvent.type === 'raid', 'the battle ended, or the raiders who beat it go on');
  assert.ok(s.report.urgent.some((l) => /On the road to/.test(l)));
});

test('an army holding the valley meets raiders on the road; the commander can fight it', () => {
  let s = warGame();
  s = raise(s);
  for (let i = 0; i < 3; i++) s = act(s, { type: 'raiseCompany', armyId: s.armies[0].id, kind: 'spearmen', from: 'capital' });
  s = act(s, { type: 'armyStance', armyId: s.armies[0].id, stance: 'commander' });
  const lines = meetOnRoad(s, { raiders: 8, from: 'skarn' });
  assert.ok(lines.some((l) => /won|beaten/.test(l)));
  assert.ok(!s.pendingEvent || s.pendingEvent.type === 'raid');
  s.armies[0].order = 'raid';
  assert.equal(meetOnRoad(s, { raiders: 8, from: 'skarn' }), null, 'only an army holding the valley meets them');
});

test('fight only with good odds: the army falls back instead', () => {
  let s = warGame();
  s = raise(s);
  s = act(s, { type: 'armyStance', armyId: s.armies[0].id, stance: 'withdraw' });
  s.armies[0].location = 'plains';
  const lines = meetOnRoad(s, { raiders: 60, from: 'skarn' });
  assert.equal(lines, null, 'not in the valley');
  s.armies[0].location = 'valley';
  const fled = meetOnRoad(s, { raiders: 60, from: 'skarn' });
  assert.ok(fled.some((l) => /pulled the first army back/.test(l)));
  assert.equal(s.pendingEvent && s.pendingEvent.type, 'raid', 'the raiders go on to the capital');
});

test('at war, Orhai hosts fall on settlements within their reach, unless an army stands there', () => {
  let s = warGame();
  s.world.places.grassSea.known = true;
  s = act(s, { type: 'foundSettlement', placeId: 'grassSea', name: 'Grassmere', settlers: 10, governorId: governorChoices(s)[0].id });
  great(s, 'orhai').met = true;
  s = act(s, { type: 'declareWar', foe: 'orhai' });
  const town = s.settlements.find((t) => t.name === 'Grassmere');
  let sacked = 0;
  for (let i = 0; i < 30; i++) {
    const out = warSeason(s);
    if (out.urgent.some((l) => /sacked Grassmere/.test(l))) sacked += 1;
    town.population = 20;
    s.turn += 1;
  }
  assert.ok(sacked > 0, 'their hosts sack it');
  s = raise(s);
  for (let i = 0; i < 2; i++) s = act(s, { type: 'raiseCompany', armyId: s.armies[0].id, kind: 'spearmen', from: 'capital' });
  s.armies[0].location = 'plains';
  s.armies[0].stance = 'commander';
  let defended = 0;
  for (let i = 0; i < 30 && s.armies.length; i++) {
    const out = warSeason(s);
    if (out.urgent.some((l) => /Before Grassmere/.test(l))) defended += 1;
    s.turn += 1;
    s.armies[0] && (s.armies[0].food = 500);
  }
  assert.ok(defended > 0, 'the army meets them before the town');
});

test('holding the high pass keeps the hill clans out', () => {
  let s = warGame();
  s.clans.warriors = 15;
  assert.equal(clansMarching(s), 15);
  s = raise(s);
  s.armies[0].location = 'hills';
  assert.match(applyAction(s, { type: 'armyOrder', armyId: s.armies[0].id, order: 'holdPass' }).error, /high pass/);
  s.world.places.highPass.known = true;
  s = act(s, { type: 'armyOrder', armyId: s.armies[0].id, order: 'holdPass' });
  assert.ok(passHeld(s));
  assert.equal(clansMarching(s), 0);
});

test('horses: bred in pastures, bought from the Orhai, and needed for cavalry', () => {
  let s = warGame();
  s.buildings.pasture = 4;
  s.knowledge.learned.push('husbandry', 'horseBreeding', 'horseRiding', 'cavalry');
  s.turn = 9;
  s = act(s, { type: 'endTurn' });
  assert.equal(s.resources.horses, 2, 'every 2 pastures raise a horse');
  assert.match(applyAction(s, { type: 'raiseArmy', commanderId: commanderChoices(s)[0].id, kind: 'cavalry', from: 'capital' }).error, /horses/);
  great(s, 'orhai').met = true;
  great(s, 'orhai').treaties.peace = true;
  assert.ok(tradesWith(s, 'orhai').includes('buyHorses'));
  s.resources.horses = 12;
  s = raise(s, 'cavalry');
  assert.equal(s.resources.horses, 2);
});

test('a standing army is paid each season, or melts away', () => {
  let s = warGame();
  s.knowledge.learned.push('mining', 'coinage', 'standingArmy');
  s = raise(s);
  assert.equal(s.armies[0].companies[0].training, 'standing');
  s.resources.coin = 10;
  armiesUpkeep(s);
  assert.equal(s.resources.coin, 8);
  s.resources.coin = 0;
  const out = armiesUpkeep(s);
  assert.ok(out.urgent.some((l) => /could not pay/.test(l)));
  assert.equal(armySoldiers(s.armies[0]), 8);
});

test('a defiant settlement can be brought to heel by an army', () => {
  let s = warGame();
  s = raise(s);
  s.settlements[0].loyalty = 10;
  s.pendingEvent = { type: 'story', id: 'defiance', town: s.settlements[0].id };
  const view = describePending(s);
  assert.ok(view.options.some((o) => o.id === 'army'));
  s = act(s, { type: 'resolveEvent', choice: 'army' });
  assert.equal(s.settlements[0].loyalty, 35);
});

test('the enemy comes in companies of about ten, of the kinds they fight with', () => {
  const s = warGame();
  const units = foeUnits(s, 'orhai', 33);
  assert.equal(units.reduce((n, u) => n + u.soldiers, 0), 33);
  assert.ok(units.every((u) => ['horseArchers', 'lancers'].includes(u.kind)));
  assert.ok(units.every((u) => u.soldiers <= 13));
});

test('saves from version 31 gain armies, wars, and horses', () => {
  const s = warGame();
  for (const key of ['armies', 'nextArmyId', 'nextCompanyId', 'wars', 'warEnded', 'tributes', 'lastHarm']) delete s[key];
  delete s.resources.horses;
  delete s.great.orhai.strength;
  s.version = 31;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.armies, []);
  assert.deepEqual(m.wars, {});
  assert.equal(m.resources.horses, 0);
  assert.equal(m.great.orhai.strength, 50);
});
