import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson } from '../js/engine/state.js';
import {
  nation, freeToWork, bestFreeSite, moveOffForeignLand,
} from '../js/engine/nations.js';
import { applyStandingOrders } from '../js/engine/orders.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r;
};

function village(seed = 1) {
  const s = newGame({ seed });
  for (let i = 0; i < 8; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 6 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 200;
  s.resources.wood = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  for (const id of ['meadow', 'berryThicket', 'beaverPonds', 'deerTrails']) s.places[id].known = true;
  return act(s, { type: 'foundVillage' }).state;
}

test('when a people claims land the village works, the council moves the work and the speaker says so', () => {
  const s = village();
  s.workSites.forage = 'beaverPonds';
  s.places.beaverPonds.owner = 'tellani';
  const line = moveOffForeignLand(s);
  assert.notEqual(s.workSites.forage, 'beaverPonds');
  assert.ok(freeToWork(s, s.workSites.forage));
  assert.match(line, /^Beaver ponds belongs to the Tellani now, so the council moved the foragers to /);
  assert.match(line, /open lands pact/);
  assert.equal(moveOffForeignLand(s), null, 'nothing more to move');
});

test('the council picks the best place it can work freely', () => {
  const s = village();
  s.places.beaverPonds.owner = 'tellani';
  s.places.berryThicket.owner = 'tellani';
  const best = bestFreeSite(s, 'forage');
  assert.ok(freeToWork(s, best));
  assert.equal(best, 'meadow', 'the North meadow forages best of what is left');
  assert.equal(bestFreeSite(s, 'quarry'), 'riverbank', 'river stones beat the loose stones about camp');
  s.places.riverbank.owner = 'tellani';
  assert.equal(bestFreeSite(s, 'quarry'), 'camp', 'the camp is always there');
});

test('the move happens with the standing orders, before the council sets work', () => {
  let s = village();
  s.workSites.hunt = 'deerTrails';
  s.places.deerTrails.owner = 'skarn';
  const out = applyStandingOrders(s);
  assert.notEqual(s.workSites.hunt, 'deerTrails');
  assert.ok(out.orders.some((l) => /speaker: Deer trails belongs to the Skarn now, so the council moved the hunters/.test(l)), out.orders.join(' | '));
  // A season later, no one is angered.
  living(s).forEach((p) => { if (p.task === 'rest') p.task = 'hunt'; });
  s = act(s, { type: 'endTurn' }).state;
  assert.ok(!s.report.events.some((l) => /land that belongs to/.test(l)), s.report.events.join(' | '));
});

test('land the player chose on purpose is left alone', () => {
  let s = village();
  s.places.beaverPonds.owner = 'tellani';
  const r = act(s, { type: 'setWorkSite', task: 'forage', placeId: 'beaverPonds' });
  s = r.state;
  assert.match(r.message, /belongs to the Tellani, who will be angry every season/);
  assert.equal(s.foreignWorkOk.forage, 'beaverPonds');
  assert.equal(moveOffForeignLand(s), null);
  assert.equal(s.workSites.forage, 'beaverPonds');
  // Choosing free land again clears the choice.
  s = act(s, { type: 'setWorkSite', task: 'forage', placeId: 'meadow' }).state;
  assert.equal(s.foreignWorkOk.forage, undefined);
});

test('an open lands pact lets the work stay; ending it moves the work', () => {
  const s = village();
  s.workSites.forage = 'beaverPonds';
  s.places.beaverPonds.owner = 'tellani';
  nation(s, 'tellani').treaties.openLands = true;
  assert.equal(moveOffForeignLand(s), null);
  assert.equal(s.workSites.forage, 'beaverPonds');
  nation(s, 'tellani').treaties.openLands = false;
  assert.ok(moveOffForeignLand(s));
  assert.notEqual(s.workSites.forage, 'beaverPonds');
});

test('a camp has no foreign land to move from', () => {
  const s = newGame({ seed: 5 });
  s.places.beaverPonds.known = true;
  s.workSites.forage = 'beaverPonds';
  assert.equal(moveOffForeignLand(s), null);
  assert.equal(s.workSites.forage, 'beaverPonds');
});
