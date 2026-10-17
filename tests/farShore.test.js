import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  makePerson, living, migrate, SAVE_VERSION,
} from '../js/engine/state.js';
import { governorChoices } from '../js/engine/settlements.js';
import {
  farShoreSeason, initialFarShore, shipyards, buildShipBlocker, seaPath, fleetTargets, fleetById, stormChance,
  footholdGather, footholdLasts, scoutTargets, farShoreAdvice, shipsAfloat, VOYAGE_CROSSING, FOOTHOLD_START_FOOD,
} from '../js/engine/farShore.js';
import { SHIP, SHORE_PLACES } from '../js/engine/farShoreData.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A nation with a port at the Grey headland and its harbor built, whose
// voyage has just sailed with a crew of 12.
function seaGame(seed = 1) {
  let s = newGame({ seed, difficulty: 'normal' });
  for (let i = 0; i < 70; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: i % 5 === 0 ? 4 : 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 3, palisade: 1, leanTo: 40, meetingHall: 1 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw', 'smoking', 'weaving', 'kilns', 'markets', 'irrigation', 'masonry', 'writing', 'riverBoats', 'shipbuilding', 'harbors', 'navigation', 'coinage');
  s.milestoneReached = true;
  s.places.meadow.known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  Object.assign(s.resources, {
    food: 2000, wood: 800, stone: 300, goods: 300, coin: 300, iron: 100,
  });
  s = act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Haven', settlers: 10, governorId: governorChoices(s)[0].id,
  });
  s.pendingEvent = null;
  const port = s.settlements[0];
  Object.assign(port, { place: 'greyHeadland', role: 'port' });
  port.buildings.works = { port: 1 };
  s.turn = 40;
  s.era = 'discovery';
  const crew = living(s).filter((p) => !Object.values(s.advisors).includes(p.id)).slice(0, 12);
  const ids = new Set(crew.map((p) => p.id));
  s.people = s.people.filter((p) => !ids.has(p.id));
  s.voyage = { sent: s.turn, captain: crew[0].name, crew: crew.map((p) => ({ ...p, task: 'voyage' })) };
  s.farShore = initialFarShore(s);
  return s;
}

function landed(seed = 1) {
  const s = seaGame(seed);
  s.turn += VOYAGE_CROSSING;
  farShoreSeason(s);
  return s;
}

// Runs the far shore's seasons only.
function seasons(s, n) {
  const out = { urgent: [], events: [], routine: [] };
  for (let i = 0; i < n; i++) {
    s.turn += 1;
    const r = farShoreSeason(s);
    for (const k of Object.keys(out)) out[k].push(...r[k]);
  }
  return out;
}

test('the voyage lands after its crossing, and its crew holds a foothold at Landfall cove', () => {
  const s = seaGame();
  assert.equal(s.farShore.landed, false);
  const early = farShoreSeason(s);
  assert.equal(early.urgent.length, 0);
  s.turn += VOYAGE_CROSSING;
  const out = farShoreSeason(s);
  assert.ok(out.urgent.some((l) => /^Land! After 2 seasons on the open sea/.test(l)));
  const f = s.farShore.foothold;
  assert.equal(f.place, 'landfallCove');
  assert.equal(f.people.length, 12);
  assert.equal(f.food, FOOTHOLD_START_FOOD);
  assert.equal(s.farShore.places.landfallCove, true);
  assert.equal(s.farShore.waters.openSea, 'charted');
  assert.equal(s.farShore.waters.westernIsles, 'heard');
  assert.equal(s.farShore.regions.greatRiver, 'heard');
  // The ship comes home two seasons later.
  const home = seasons(s, VOYAGE_CROSSING);
  assert.equal(s.farShore.ships, 1);
  assert.ok(home.urgent.some((l) => /Your first ship is home/.test(l)));
});

test('a port with its harbor builds merchant ships, one at a time', () => {
  let s = landed();
  const port = s.settlements[0];
  assert.deepEqual(shipyards(s).map((t) => t.id), [port.id]);
  assert.equal(buildShipBlocker(s, port), null);
  const before = { ...s.resources };
  s = act(s, { type: 'buildShip', settlementId: port.id });
  for (const [k, n] of Object.entries(SHIP.cost)) assert.equal(s.resources[k], before[k] - n);
  assert.match(buildShipBlocker(s, s.settlements[0]), /is building a ship/);
  const built = seasons(s, SHIP.seasons);
  assert.ok(built.events.some((l) => /launched a merchant ship/.test(l)));
  assert.equal(s.farShore.shipsBuilt, 1);
});

test('each ship costs coin to keep, and an unpaid ship in harbor is sold', () => {
  const s = landed();
  s.farShore.shipHome = null;
  s.farShore.ships = 3;
  const coin = s.resources.coin;
  seasons(s, 1);
  assert.equal(s.resources.coin, coin - 3 * SHIP.upkeep);
  s.resources.coin = 0;
  const out = seasons(s, 1);
  assert.equal(s.farShore.ships, 2);
  assert.ok(out.urgent.some((l) => /a ship in the harbor was sold off/.test(l)));
});

test('a fleet forms under a captain from the capital, loads cargo at home, and comes back into port', () => {
  let s = landed();
  s.farShore.ships = 2;
  const people = living(s).length;
  const captain = living(s).find((p) => p.skills.scouting === 4 && !Object.values(s.advisors).includes(p.id));
  s = act(s, { type: 'formFleet', captainId: captain.id, ships: 2 });
  const fleet = s.farShore.fleets[0];
  assert.equal(fleet.name, 'The first fleet');
  assert.equal(living(s).length, people - 1);
  assert.match(applyAction(s, { type: 'loadFleet', fleetId: fleet.id, food: 200 }).error, /can carry 120 food/);
  s = act(s, { type: 'loadFleet', fleetId: fleet.id, food: 100, people: 5 });
  assert.equal(fleetById(s, fleet.id).cargo.people.length, 5);
  assert.equal(living(s).length, people - 6);
  s = act(s, { type: 'disbandFleet', fleetId: fleet.id });
  assert.equal(s.farShore.ships, 2);
  assert.equal(living(s).length, people);
});

test('fleets sail only through waters and coasts you know', () => {
  let s = landed();
  s.farShore.ships = 1;
  s = act(s, { type: 'formFleet', captainId: living(s).find((p) => !Object.values(s.advisors).includes(p.id)).id, ships: 1 });
  const fleet = s.farShore.fleets[0];
  assert.deepEqual(seaPath(s, 'homeWaters', 'landfall'), ['openSea', 'farWaters', 'landfall']);
  assert.ok(fleetTargets(s, fleet).includes('westernIsles'), 'heard of, so a fleet can sail to chart it');
  assert.ok(!fleetTargets(s, fleet).includes('southBays'), 'not yet heard of');
  assert.match(applyAction(s, { type: 'setCourse', fleetId: fleet.id, to: 'southBays' }).error, /no way there/);
});

test('a fleet carries food and settlers to the foothold, and charts coasts and the isles', () => {
  let s = landed();
  s.farShore.ships = 2;
  s.farShore.waters.openSea = 'charted';
  const captain = living(s).find((p) => !Object.values(s.advisors).includes(p.id));
  captain.skills.scouting = 15; // A master navigator: no storms in this test.
  s = act(s, { type: 'formFleet', captainId: captain.id, ships: 2 });
  const id = s.farShore.fleets[0].id;
  s = act(s, { type: 'loadFleet', fleetId: id, food: 100, people: 6 });
  s = act(s, { type: 'setCourse', fleetId: id, to: 'landfall' });
  const food = s.farShore.foothold.food;
  const out = seasons(s, 3);
  assert.equal(fleetById(s, id).location, 'landfall');
  assert.equal(s.farShore.foothold.people.length, 18);
  assert.ok(s.farShore.foothold.food > food);
  assert.ok(out.events.some((l) => /landed 100 food and 6 settlers at the foothold/.test(l)));
  // At anchor it charts the coast's places, one a season.
  const out2 = seasons(s, 2);
  assert.ok(s.farShore.places.saltMeadow && s.farShore.places.whaleStrand);
  assert.ok(out2.events.some((l) => /found Salt meadow/.test(l)));
  assert.equal(s.farShore.regions.landfall, 'explored');
  // To the isles: charted place by place.
  s = act(s, { type: 'setCourse', fleetId: id, to: 'westernIsles' });
  seasons(s, 6);
  assert.equal(s.farShore.waters.westernIsles, 'charted');
  assert.ok(s.farShore.places.fogIsle && s.farShore.places.birdRock && s.farShore.places.wreckersReef);
});

test('storms find fleets on the open sea, twice as often in winter, less with a skilled captain', () => {
  const s = landed();
  const fleet = { captain: { skills: { scouting: 0 } } };
  s.turn = 41; // Spring is turn 40; turn 41 is summer.
  const summer = stormChance(s, 'openSea', fleet);
  s.turn = 43;
  assert.ok(Math.abs(stormChance(s, 'openSea', fleet) - summer * 2) < 1e-9);
  assert.ok(stormChance(s, 'openSea', { captain: { skills: { scouting: 5 } } }) < stormChance(s, 'openSea', fleet));
  assert.equal(stormChance(s, 'homeWaters', fleet), 0);
  assert.ok(stormChance(s, 'westernIsles', fleet) < stormChance(s, 'openSea', fleet));
});

test('storms can sink ships, and a fleet that loses its last ship is lost with its captain', () => {
  let lost = false;
  for (let seed = 1; seed <= 60 && !lost; seed++) {
    let s = landed(seed);
    s.farShore.ships = 1;
    s = act(s, { type: 'formFleet', captainId: living(s).find((p) => !Object.values(s.advisors).includes(p.id)).id, ships: 1 });
    const id = s.farShore.fleets[0].id;
    for (let trip = 0; trip < 10 && fleetById(s, id); trip++) {
      const f = fleetById(s, id);
      s = act(s, { type: 'setCourse', fleetId: id, to: f.location === 'homeWaters' ? 'farWaters' : 'homeWaters' });
      const out = seasons(s, 4);
      if (out.urgent.some((l) => /was lost in a storm/.test(l))) lost = true;
    }
    if (lost) assert.ok(s.farShore.shipsLost >= 1);
  }
  assert.ok(lost, 'over many crossings, some fleet should be lost');
});

test('the foothold feeds itself, but starves without food and can be lost', () => {
  const s = landed();
  const f = s.farShore.foothold;
  assert.ok(footholdGather(s) > 0);
  for (const p of f.people) { p.skills.hunting = 0; p.skills.foraging = 0; }
  f.people.push(...Array.from({ length: 20 }, (_, i) => makePerson({ name: `Extra${i}`, note: '', age: 3, skills: {} }, s.nextPersonId++, 'foothold'))); // Children eat, and cannot gather.
  assert.ok(footholdLasts(s) != null);
  f.food = 30;
  assert.ok(farShoreAdvice(s).some(([role, , text]) => role === 'steward' && /has food for/.test(text)));
  f.food = 0;
  const out = seasons(s, 12);
  assert.ok(out.urgent.some((l) => /ran out of food/.test(l)));
  assert.equal(s.farShore.foothold, null);
  assert.ok(out.urgent.some((l) => /is gone: none of its people are left/.test(l)));
});

test('settlers carried to a coast with no foothold make a new one', () => {
  let s = landed();
  s.farShore.foothold = null;
  s.farShore.ships = 1;
  const captain = living(s).find((p) => !Object.values(s.advisors).includes(p.id));
  captain.skills.scouting = 15;
  s = act(s, { type: 'formFleet', captainId: captain.id, ships: 1 });
  const id = s.farShore.fleets[0].id;
  s = act(s, { type: 'loadFleet', fleetId: id, food: 60, people: 5 });
  s = act(s, { type: 'setCourse', fleetId: id, to: 'landfall' });
  const out = seasons(s, 3);
  assert.ok(s.farShore.foothold);
  assert.equal(s.farShore.foothold.people.length, 5);
  assert.ok(out.events.some((l) => /have made a foothold at Landfall cove/.test(l)));
});

test('the foothold\'s scouts explore inland, and find a people\'s homeland', () => {
  let s = landed();
  assert.deepEqual(scoutTargets(s).sort(), ['fjords', 'greatRiver', 'landfall', 'tallForest']);
  s = act(s, { type: 'sendScouts', region: 'tallForest' });
  assert.match(applyAction(s, { type: 'sendScouts', region: 'fjords' }).error, /already out/);
  const out = seasons(s, 2);
  assert.equal(s.farShore.regions.tallForest, 'explored');
  assert.ok(s.farShore.places.ossirenHalls && s.farShore.places.greatTrees);
  assert.equal(s.farShore.regions.highPlateau, 'heard');
  assert.ok(out.events.some((l) => /Your scouts came back/.test(l)));
  assert.ok(s.farShore.peoples.ossiren.contactPending);
});

test('meeting a people of the far shore is a decision; friendly neighbors trade food to the foothold', () => {
  let s = landed();
  s.farShore.peoples.tavari.contactPending = true;
  maybeStartEvent(s);
  assert.equal(s.pendingEvent.id, 'farContact');
  const view = describePending(s);
  assert.match(view.title, /The Tavari/);
  assert.deepEqual(view.options.map((o) => o.id), ['gifts', 'trade', 'wary']);
  const wary = act(s, { type: 'resolveEvent', choice: 'wary' });
  assert.equal(wary.farShore.peoples.tavari.relation, 10);
  const without = footholdGather(s);
  s = act(s, { type: 'resolveEvent', choice: 'gifts' });
  assert.ok(s.farShore.peoples.tavari.met);
  assert.equal(s.farShore.peoples.tavari.relation, 35);
  assert.ok(s.farShore.places.tavariTowns);
  assert.equal(footholdGather(s), without + 8);
});

test('the Tavari, near the landfall, find the foothold on their own in time', () => {
  const s = landed();
  seasons(s, 30);
  assert.ok(s.farShore.peoples.tavari.contactPending);
  assert.ok(!s.farShore.peoples.ondari.contactPending, 'the Ondari live far inland');
});

test('the speaker points out waters to chart and lands to scout', () => {
  const s = landed();
  const advice = farShoreAdvice(s);
  assert.ok(advice.some(([role, , text]) => role === 'speaker' && /speak of the western isles/.test(text)));
  assert.ok(advice.some(([role, , text]) => role === 'speaker' && /scouts could explore/.test(text)));
});

test('saves from version 36 in the Age of Discovery gain the sea, and land next season', () => {
  const s = seaGame();
  delete s.farShore;
  s.version = 36;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.farShore.arrives, s.turn + 1);
  assert.equal(shipsAfloat(m), 0);
  assert.ok(SHORE_PLACES.landfallCove.harbor);
});
