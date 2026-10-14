import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson } from '../js/engine/state.js';
import {
  nation, owner, landsOf, claimBlocker, valleyYear, borderFriction, skarnBand, alliedHelpers,
  treatyBlocker, trustWord, nationsActive,
} from '../js/engine/nations.js';
import { effectiveBaseline } from '../js/engine/legacy.js';
import { diplomacyOptions, skarnGarrison } from '../js/engine/neighbors.js';
import { describePending } from '../js/engine/events.js';
import { finishBattle, createBattle } from '../js/engine/battle.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
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
  for (const id of ['velariFields', 'meadow', 'herbHillside', 'abandonedCamp', 'deerTrails', 'raiderTrail', 'berryThicket', 'beaverPonds']) s.places[id].known = true;
  return act(s, { type: 'foundVillage' });
}

test('the valley peoples become nations when the camp becomes a village', () => {
  const camp = newGame({ seed: 1 });
  assert.ok(!nationsActive(camp));
  const s = village();
  assert.ok(nationsActive(s));
  for (const id of ['velari', 'tellani', 'skarn']) {
    assert.ok(nation(s, id).population > 0);
    assert.ok(nation(s, id).warriors > 0);
  }
  assert.equal(owner(s, 'camp'), 'player');
  assert.equal(owner(s, 'velariFields'), 'velari');
  assert.equal(owner(s, 'skarnHold'), 'skarn');
  assert.ok(nation(s, 'skarn').warriors > nation(s, 'velari').warriors, 'the Skarn keep more of their people under arms');
});

test('each spring the nations grow and claim land outward from home', () => {
  const s = village();
  s.turn = 8; // Spring.
  const before = nation(s, 'velari').population;
  for (let i = 0; i < 6; i++) valleyYear(s);
  assert.ok(nation(s, 'velari').population > before);
  assert.equal(owner(s, 'herbHillside'), 'velari', 'the Velari reach the herb hillside first');
  assert.ok(landsOf(s, 'skarn').includes('raiderTrail'));
});

test('the village can claim land that borders its own, up to a limit', () => {
  let s = village();
  assert.equal(claimBlocker(s, 'meadow'), null);
  assert.match(claimBlocker(s, 'herbHillside'), /border land you already hold/);
  const relation = s.neighbors.velari.relation;
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  assert.equal(owner(s, 'meadow'), 'player');
  assert.ok(s.neighbors.velari.relation < relation, 'the Velari wanted the meadow');
  assert.equal(claimBlocker(s, 'herbHillside'), null, 'now it borders the meadow');
  assert.match(claimBlocker(s, 'velariFields'), /belongs to the Velari/);
  s = act(s, { type: 'claimPlace', placeId: 'herbHillside' });
  s = act(s, { type: 'claimPlace', placeId: 'abandonedCamp' });
  s = act(s, { type: 'claimPlace', placeId: 'riverbank' }); // The fourth: 20 people may hold 4.
  assert.match(claimBlocker(s, 'berryThicket'), /can hold 4/);
  assert.match(applyAction(newGame({ seed: 1 }), { type: 'claimPlace', placeId: 'riverbank' }).error, /village/);
});

test('a nation will not claim land the village already holds', () => {
  let s = village();
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  s = act(s, { type: 'claimPlace', placeId: 'herbHillside' });
  s.turn = 8;
  for (let i = 0; i < 10; i++) valleyYear(s);
  assert.equal(owner(s, 'herbHillside'), 'player');
  assert.equal(owner(s, 'abandonedCamp'), 'velari');
});

test('working another people\'s land angers them, unless they share it', () => {
  const s = village();
  s.places.herbHillside.owner = 'velari';
  s.workSites.forage = 'herbHillside';
  living(s)[0].task = 'forage';
  const before = s.neighbors.velari.relation;
  const lines = borderFriction(s);
  assert.ok(s.neighbors.velari.relation < before);
  assert.match(lines[0], /belongs to the Velari/);
  nation(s, 'velari').treaties.openLands = true;
  assert.equal(borderFriction(s).length, 0);
});

test('treaties need good relations and trust; a trade pact improves trades', () => {
  let s = village();
  assert.match(treatyBlocker(s, 'tellani', 'trade'), /Relations must be at least 20/);
  s.neighbors.tellani.relation = 30;
  assert.equal(treatyBlocker(s, 'tellani', 'trade'), null);
  assert.match(treatyBlocker(s, 'skarn', 'trade'), /never agree/);
  const deal = () => Number(diplomacyOptions(s, 'tellani').find((o) => o.key === 'foodForWood').label.match(/for (\d+) wood/)[1]);
  const before = deal();
  s = act(s, { type: 'diplomacy', neighborId: 'tellani', act: 'treaty-trade' });
  assert.equal(nation(s, 'tellani').treaties.trade, true);
  assert.ok(deal() > before);
  assert.ok(effectiveBaseline(s, 'tellani') > effectiveBaseline(village(), 'tellani'));
  s.turn += 1;
  s = act(s, { type: 'diplomacy', neighborId: 'tellani', act: 'end-trade' });
  assert.equal(nation(s, 'tellani').treaties.trade, false);
});

test('allies turn back raiders, and call for help when the Skarn attack them', () => {
  const s = village();
  nation(s, 'velari').treaties.alliance = true;
  assert.ok(alliedHelpers(s) > 0);
  s.turn = 8;
  nation(s, 'skarn').warriors = 30;
  nation(s, 'velari').warriors = 1;
  nation(s, 'tellani').warriors = 50; // The Skarn pick on the weaker people.
  let called = false;
  for (let i = 0; i < 30 && !called; i++) {
    s.pendingEvent = null;
    valleyYear(s);
    called = Boolean(s.pendingEvent && s.pendingEvent.id === 'allyCall');
  }
  assert.ok(called, 'the Velari called on their ally');
  const view = describePending(s);
  assert.ok(view.options.some((o) => o.id === 'send'));
  const trust = nation(s, 'velari').trust;
  const sent = act(s, { type: 'resolveEvent', choice: 'send' });
  assert.ok(nation(sent, 'velari').trust > trust);
  assert.ok(nation(sent, 'velari').memory.some((m) => /came to their aid/.test(m.text)));
  const refused = act(s, { type: 'resolveEvent', choice: 'refuse' });
  assert.ok(nation(refused, 'velari').trust < trust);
  assert.ok(nation(refused, 'velari').memory.some((m) => m.kind === 'broken'));
});

test('Skarn war bands come from their warriors, and their dead are lost to them', () => {
  const s = village();
  nation(s, 'skarn').warriors = 40;
  const bands = Array.from({ length: 20 }, () => skarnBand(s));
  assert.ok(bands.every((b) => b >= 20 && b <= 32));
  assert.equal(skarnGarrison(s), 28);
  const ev = { type: 'raid', raiders: 10, warned: true, from: 'skarn' };
  const battle = createBattle(s, ev);
  battle.enemy = { left: 2, center: 2, right: 0 };
  battle.fought = [];
  s.pendingEvent = { ...ev, battle };
  const lines = finishBattle(s, battle, 'victory');
  assert.equal(nation(s, 'skarn').warriors, 34);
  assert.ok(lines.some((l) => /lost 6 warriors/.test(l)));
});

test('attacking the Skarn during a truce breaks your word', () => {
  let s = village();
  s.places.skarnHold.known = true;
  s.neighbors.skarn.truceUntil = s.turn + 4;
  const trust = nation(s, 'skarn').trust;
  s = act(s, { type: 'diplomacy', neighborId: 'skarn', act: 'attack' });
  assert.ok(nation(s, 'skarn').trust <= trust - 30);
  assert.ok(nation(s, 'skarn').memory.some((m) => /broke the truce/.test(m.text)));
  assert.match(trustWord(nation(s, 'skarn').trust), /distrust|liar/);
});

test('older village saves gain their nations at the next season', () => {
  let s = village();
  for (const id of ['velari', 'tellani', 'skarn']) delete s.neighbors[id].nation;
  for (const p of Object.values(s.places)) delete p.owner;
  s = act(s, { type: 'endTurn' });
  assert.ok(nation(s, 'skarn'));
  assert.equal(owner(s, 'camp'), 'player');
});

test('a village with nations plays on for years', () => {
  let s = village(5);
  for (let i = 0; i < 40 && !s.gameOver; i++) {
    if (s.pendingEvent && s.pendingEvent.type === 'story') s = act(s, { type: 'resolveEvent', choice: describePending(s).options[0].id });
    if (s.pendingEvent && s.pendingEvent.type === 'raid') {
      const fought = applyAction(s, { type: 'battleAuto' });
      s = fought.error ? act(s, { type: 'resolveRaid', plan: 'hide' }) : fought.state; // No one fit to fight: hide.
    }
    if (s.gameOver) break;
    s = act(s, { type: 'endTurn' });
  }
  assert.ok(s.turn >= 40 || s.gameOver);
});
