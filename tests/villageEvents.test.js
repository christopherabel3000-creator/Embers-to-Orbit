import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { living, makePerson } from '../js/engine/state.js';
import { VILLAGE_EVENTS } from '../js/engine/villageEvents.js';
import { describePending, EVENTS } from '../js/engine/events.js';
import { notablePeople } from '../js/engine/village.js';
import { nation } from '../js/engine/nations.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A well-stocked village where every village event is possible.
function richVillage(seed = 1) {
  let s = newGame({ seed });
  for (let i = 0; i < 14; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 2, foraging: 3, building: 3, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 2, palisade: 1, leanTo: 8, pasture: 2 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'weaving');
  s.milestoneReached = true;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  for (const id of ['meadow', 'herbHillside', 'abandonedCamp', 'deerTrails', 'berryThicket', 'velariFields']) s.places[id].known = true;
  s = act(s, { type: 'foundVillage' });
  s = act(s, { type: 'claimPlace', placeId: 'meadow' });
  s.places.herbHillside.owner = 'velari';
  Object.assign(s.resources, { food: 400, wood: 100, stone: 40, goods: 40 });
  s.neighbors.velari.relation = 30;
  s.neighbors.tellani.relation = 30;
  nation(s, 'skarn').warriors = 40;
  s.knowledge.current = 'masonry';
  s.buildQueue = [{ id: 'hut', progress: 0, paid: false }, { id: 'hut', progress: 0, paid: false }, { id: 'granary', progress: 0, paid: false }];
  s.turn = 9; // Summer, Year 3.
  // Put people into a few big working groups.
  living(s).forEach((p, i) => { p.task = ['farm', 'hunt', 'wood', 'craft'][i % 4]; });
  return s;
}

test('every village event can happen in a village, offers choices, and resolves each one', () => {
  for (const [id, ev] of Object.entries(VILLAGE_EVENTS)) {
    const base = richVillage();
    assert.ok(ev.weight(base) > 0, `${id} should be possible`);
    if (!ev.choice) {
      const lines = ev.apply(base);
      assert.ok((lines.urgent || []).length + (lines.events || []).length > 0, id);
      continue;
    }
    base.pendingEvent = { type: 'story', id, ...ev.start(base) };
    const view = describePending(base);
    assert.ok(view.title && view.text && view.options.length >= 2, id);
    for (const option of view.options) {
      const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
      assert.equal(r.error, undefined, `${id}/${option.id}: ${r.error}`);
      assert.equal(r.state.pendingEvent, null);
      assert.ok(r.state.report.decisions.length > 0, `${id}/${option.id}`);
    }
  }
});

test('village events never happen in a camp', () => {
  const camp = newGame({ seed: 1 });
  for (const [id, ev] of Object.entries(VILLAGE_EVENTS)) assert.equal(ev.weight(camp), 0, id);
  assert.ok(Object.keys(VILLAGE_EVENTS).every((id) => id in EVENTS), 'they are part of the event list');
});

test('a hero is remembered, grows in skill, and stays among the notable people', () => {
  const s = richVillage();
  s.pendingEvent = { type: 'story', id: 'heroDeed', ...VILLAGE_EVENTS.heroDeed.start(s) };
  const hero = living(s).find((p) => p.id === s.pendingEvent.person);
  const skill = s.pendingEvent.skill;
  const before = hero.skills[skill];
  const next = act(s, { type: 'resolveEvent', choice: 'cairn' });
  assert.equal(next.heroes.length, 1);
  assert.equal(next.heroes[0].name, hero.name);
  assert.equal(next.resources.stone, 30);
  const after = next.people.find((p) => p.id === hero.id);
  assert.equal(after.skills[skill], Math.min(5, before + 1));
  assert.ok(notablePeople(next).some((p) => p.id === hero.id));
});

test('siding in a rivalry pleases one group and sours the other', () => {
  const s = richVillage();
  s.pendingEvent = { type: 'story', id: 'rivalry', ...VILLAGE_EVENTS.rivalry.start(s) };
  const { a, b } = s.pendingEvent;
  const mood = (st, task) => living(st).filter((p) => p.task === task).reduce((sum, p) => sum + p.morale, 0);
  const next = act(s, { type: 'resolveEvent', choice: 'a' });
  assert.ok(mood(next, a) > mood(s, a));
  assert.ok(mood(next, b) < mood(s, b));
});

test('agreeing with a council member changes the priority', () => {
  const s = richVillage();
  s.pendingEvent = { type: 'story', id: 'councilObjects', ...VILLAGE_EVENTS.councilObjects.start(s) };
  const area = s.pendingEvent.area;
  const next = act(s, { type: 'resolveEvent', choice: 'agree' });
  assert.equal(next.priorities[area], 'high');
});

test('taking in refugees adds people and wins trust; turning them away costs it', () => {
  const s = richVillage();
  s.pendingEvent = { type: 'story', id: 'refugees', ...VILLAGE_EVENTS.refugees.start(s) };
  const { from, count } = s.pendingEvent;
  const all = act(s, { type: 'resolveEvent', choice: 'all' });
  assert.equal(living(all).length, living(s).length + count);
  assert.ok(nation(all, from).trust > nation(s, from).trust);
  const turned = act(s, { type: 'resolveEvent', choice: 'turn' });
  assert.ok(nation(turned, from).trust < nation(s, from).trust);
  s.laws.strangers = 'closed';
  assert.equal(VILLAGE_EVENTS.refugees.weight(s), 0, 'closed gates: no one comes asking');
});

test('a fire can cost shelter, and herd sickness can empty pastures', () => {
  const s = richVillage();
  s.pendingEvent = { type: 'story', id: 'hutFire' };
  const broke = act(s, { type: 'resolveEvent', choice: 'break' });
  assert.equal(broke.buildings.leanTo, s.buildings.leanTo - 2);
  s.pendingEvent = { type: 'story', id: 'herdSickness' };
  const culled = act(s, { type: 'resolveEvent', choice: 'cull' });
  assert.equal(culled.buildings.pasture, 1);
});
