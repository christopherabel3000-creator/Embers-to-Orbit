import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, canFight,
} from '../js/engine/state.js';
import {
  createBattle, deploy, resolveRound, enemyWord, zoneOrders, warChiefOrders, formationPlan, SKARN_TACTICS_ARMS,
} from '../js/engine/battle.js';
import {
  drawWeather, weatherEffects, WEATHER_ODDS, WEATHER,
} from '../js/engine/weather.js';
import { raidSpotted } from '../js/engine/season.js';
import { maybeHarry, nation, skarnArms } from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 12; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2 + (i % 3), foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.wood = 100;
  s.neighbors.skarn.known = true;
  return act(s, { type: 'foundVillage' });
}

// ----- weather -----

test('each season draws only its own kinds of weather', () => {
  const s = newGame({ seed: 7 });
  for (let season = 0; season < 4; season++) {
    s.turn = season;
    const seen = new Set();
    for (let i = 0; i < 300; i++) seen.add(drawWeather(s));
    assert.deepEqual([...seen].sort(), Object.keys(WEATHER_ODDS[season]).sort(), `season ${season}`);
    for (const kind of seen) assert.ok(WEATHER[kind]);
  }
});

test('weather blunts arrows and charges, tires fighters, and makes wounds deadlier', () => {
  assert.deepEqual(weatherEffects('clear'), { arrows: 1, charge: 1, all: 1, woundExtra: 0 });
  assert.equal(weatherEffects('rain').arrows, 0.5);
  assert.equal(weatherEffects('rain').charge, 0.85);
  assert.equal(weatherEffects('fog').arrows, 0.7);
  assert.equal(weatherEffects('snow').all, 0.9);
  assert.equal(weatherEffects('snow').woundExtra, 5);
  assert.equal(weatherEffects('heat', 2).all, 1);
  assert.equal(weatherEffects('heat', 3).all, 0.85);
});

test('a battle is fought in the season\'s weather, and fog hides the enemy\'s numbers', () => {
  const s = village();
  s.weather = 'fog';
  const b = createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'skarn' });
  assert.equal(b.weather, 'fog');
  assert.equal(enemyWord(b, 4), 'about 4', 'warned, but the fog hides how many');
  s.weather = 'clear';
  assert.equal(enemyWord(createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'skarn' }), 4), '4');
});

test('in fog the watchtower sees nothing; guards on the paths still do', () => {
  const s = newGame({ seed: 2 });
  s.buildings.watchtower = 1;
  assert.equal(raidSpotted(s, false), true);
  s.weather = 'fog';
  assert.equal(raidSpotted(s, false), false);
  living(s)[0].task = 'guard';
  living(s)[1].task = 'guard';
  assert.equal(raidSpotted(s, false), true);
});

// ----- shield walls and braced spears -----

test('shield walls need Shields and drill; braced spears need Fire-hardened spears', () => {
  const s = village();
  assert.ok(!zoneOrders(s, 'left').includes('shieldWall'));
  assert.ok(!zoneOrders(s, 'left').includes('brace'));
  s.knowledge.learned.push('drill', 'spears');
  assert.ok(zoneOrders(s, 'left').includes('shieldWall'));
  assert.ok(zoneOrders(s, 'center').includes('brace'));
  assert.ok(!zoneOrders(s, 'center').includes('flank'));
});

// A one-zone fight: our fighters in the center against `enemy` Skarn there,
// `archers` of them archers. Returns the harm we took and the Skarn who fell,
// averaged over many trials.
function centerFight(order, { enemy = 10, archers = 0, trials = 60 } = {}) {
  let harm = 0;
  let fallen = 0;
  for (let t = 0; t < trials; t++) {
    const s = village(t + 1);
    s.knowledge.learned.push('drill', 'spears');
    const b = createBattle(s, { type: 'raid', raiders: enemy, warned: true, from: 'skarn' });
    b.terrain.palisade = false;
    b.terrain.treeline = null;
    b.enemy = { left: 0, center: enemy, right: 0 };
    b.enemyZoneStart = { ...b.enemy };
    b.archers = { left: 0, center: archers, right: 0 };
    const fighters = living(s).filter(canFight).slice(0, 8);
    deploy(s, b, Object.fromEntries(fighters.map((p) => [p.id, 'center'])));
    const before = fighters.reduce((sum, p) => sum + p.health, 0);
    resolveRound(s, b, { center: order });
    harm += before - fighters.reduce((sum, p) => sum + Math.max(0, p.health), 0);
    fallen += enemy - b.enemy.center;
  }
  return { harm: harm / trials, fallen: fallen / trials };
}

test('a shield wall takes far less harm from archers, and strikes back weakly', () => {
  const hold = centerFight('hold', { archers: 10 });
  const wall = centerFight('shieldWall', { archers: 10 });
  assert.ok(wall.harm < hold.harm * 0.7, `shield wall ${wall.harm.toFixed(1)} vs hold ${hold.harm.toFixed(1)}`);
  assert.ok(wall.fallen < hold.fallen, 'it strikes back weakly');
});

test('braced spears strike charging warriors far harder than holding does', () => {
  const hold = centerFight('hold', { enemy: 8 });
  const brace = centerFight('brace', { enemy: 8 });
  assert.ok(brace.fallen > hold.fallen * 1.3, `brace ${brace.fallen.toFixed(1)} vs hold ${hold.fallen.toFixed(1)} fallen`);
});

test('the war chief locks shields against archers and braces spears in the open', () => {
  const s = village();
  s.knowledge.learned.push('drill', 'spears');
  const b = createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'skarn' });
  b.terrain.palisade = false;
  deploy(s, b, formationPlan(s, b, 'even'));
  b.enemy = { left: 4, center: 4, right: 4 };
  b.archers = { left: 4, center: 0, right: 0 };
  // Strong enough not to attack anywhere.
  b.foeStrength = 40;
  const orders = warChiefOrders(s, b);
  assert.equal(orders.left, 'shieldWall', 'all archers on the left');
  assert.equal(orders.center, 'brace', 'warriors in the center, no walls');
});

test('well-armed Skarn bands use the new tactics', () => {
  const s = village();
  const young = createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'skarn' });
  assert.equal(young.foeTactics, false);
  s.turn = s.villageFounded + 4 * 6; // Six years a nation.
  assert.ok(skarnArms(s) >= SKARN_TACTICS_ARMS);
  assert.equal(createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'skarn' }).foeTactics, true);
  assert.equal(createBattle(s, { type: 'raid', raiders: 12, warned: true, from: 'clans' }).foeTactics, false, 'hill clansmen fight the old way');
});

// ----- ambushes -----

// A village whose hunters work at the deer trails, with strong Skarn.
function ambushVillage(seed) {
  const s = village(seed);
  s.places.deerTrails.known = true;
  s.workSites.hunt = 'deerTrails';
  const people = living(s);
  people.slice(0, 5).forEach((p) => { p.task = 'hunt'; });
  people.slice(5, 7).forEach((p) => { p.task = 'guard'; });
  nation(s, 'skarn').warriors = 40;
  return s;
}

function findAmbush() {
  for (let seed = 1; seed < 400; seed++) {
    const s = ambushVillage(seed);
    s.rng = seed * 7919;
    const lines = maybeHarry(s);
    if (s.pendingEvent && s.pendingEvent.ambush) return { s, lines };
  }
  throw new Error('no ambush found');
}

test('strong Skarn ambush workers afield: only those working there fight, guards join from the reserve', () => {
  const { s, lines } = findAmbush();
  const ev = s.pendingEvent;
  assert.match(lines[0], /^Ambush! About \d+ Skarn warriors fell on your hunters at Deer trails/);
  const hunters = living(s).filter((p) => p.task === 'hunt').map((p) => p.id);
  assert.ok(hunters.every((id) => ev.eligible.includes(id)));
  const onWatch = living(s).filter((p) => p.task === 'guard' && p.health >= 40).length;
  assert.equal(ev.reinforcements.length, Math.ceil(onWatch / 2), 'half the guards on watch come running');
  ev.battle = createBattle(s, ev);
  assert.equal(ev.battle.terrain.palisade, false, 'no walls out there');
  const plan = formationPlan(s, ev.battle, 'even');
  assert.deepEqual(Object.keys(plan).map(Number).sort(), [...ev.eligible].sort());
  assert.equal(plan[ev.reinforcements[0]], 'reserve');
  // Someone back at the village cannot be placed.
  const stayed = living(s).find((p) => !ev.eligible.includes(p.id) && canFight(p));
  const placed = deploy(s, ev.battle, { ...plan, [stayed.id]: 'center' });
  assert.ok(placed.ok);
  assert.ok(!ev.battle.fought.includes(stayed.id));
});

test('scattering from an ambush loses the season\'s work there', () => {
  const { s } = findAmbush();
  s.pendingEvent.battle = createBattle(s, s.pendingEvent);
  const r = applyAction(s, { type: 'resolveRaid', plan: 'hide' });
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.state.pendingEvent, null);
  assert.equal(r.state.harried, 'deerTrails');
  assert.ok(r.state.report.urgent.some((l) => /hunters scattered and ran for home/.test(l)), r.state.report.urgent.join(' | '));
});

test('fighting an ambush ends with the workers holding the place or driven from it', () => {
  const { s } = findAmbush();
  s.pendingEvent.battle = createBattle(s, s.pendingEvent);
  const r = applyAction(s, { type: 'battleAuto' });
  assert.equal(r.error, undefined, r.error);
  const text = r.state.report.urgent.join(' ');
  assert.match(text, /fought off the ambush at Deer trails|were driven from Deer trails/);
  assert.doesNotMatch(text, /took \d+ food/, 'ambushers never reach the stores');
});

test('version 26 saves start in clear weather', () => {
  const old = JSON.parse(JSON.stringify(newGame({ seed: 2 })));
  old.version = 26;
  delete old.weather;
  const s = migrate(old);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.weather, 'clear');
});
