import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION,
} from '../js/engine/state.js';
import {
  incomeLine, upkeepLine, skillLine,
} from '../js/engine/report.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

function village() {
  const s = newGame({ seed: 3 });
  for (let i = 0; i < 18; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 8 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 300;
  s.resources.wood = 100;
  s.resources.goods = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' });
}

test('a season\'s work and upkeep go in a few routine lines, after the news', () => {
  let s = newGame({ seed: 4 });
  s.turn = 2; // Autumn: the fires are lit.
  s.resources.wood = 60;
  s.resources.food = 90;
  const people = living(s);
  people[0].task = 'hunt';
  people[1].task = 'wood';
  s = act(s, { type: 'endTurn' });
  const r = s.report;
  assert.ok(r.routine.some((l) => /^Brought in: \d+ food from hunting and foraging and \d+ wood\./.test(l)), r.routine.join(' | '));
  assert.ok(r.routine.some((l) => /^Used: \d+ wood for the fires\./.test(l)), r.routine.join(' | '));
  assert.ok(!r.events.some((l) => /brought in|gathered \d+ wood|fires burned|spoiled in storage/.test(l)), 'none of it is repeated with the news');
  assert.ok(!s.log.some((l) => r.routine.includes(l.text)), 'the Chronicle keeps the news, not the routine');
});

test('income and upkeep each fit in one line', () => {
  assert.equal(
    incomeLine({ food: 38, herds: 18, wood: 12, stone: 18, goods: 8, foodWorkers: 9 }),
    'Brought in: 38 food from hunting and foraging, 18 food from the herds, 12 wood, 18 stone and 8 goods.',
  );
  assert.equal(incomeLine({ food: 0, wood: 5, foodWorkers: 2 }), 'Brought in: 5 wood. Hunters and foragers found nothing.');
  assert.equal(incomeLine({}), null);
  assert.equal(
    upkeepLine({ fires: 18, comforts: 6, arms: 3, spoiled: 5 }),
    'Used: 18 wood for the fires, 6 goods for comforts and 3 goods to arm the guards. 5 food spoiled in storage.',
  );
  assert.equal(upkeepLine({ spoiled: 4 }), '4 food spoiled in storage.');
  assert.equal(upkeepLine({}), null);
});

test('a village\'s comforts and arms are reported with the upkeep, not as news', () => {
  let s = village();
  s.orders.armGuards = true;
  living(s)[0].task = 'guard';
  s = act(s, { type: 'endTurn' });
  assert.ok(s.report.routine.some((l) => /goods for comforts/.test(l)), s.report.routine.join(' | '));
  assert.ok(!s.report.events.some((l) => /shared out|arms and shields/.test(l)));
});

test('skill gains are grouped by skill; a village names only its best', () => {
  const camp = newGame({ seed: 1 });
  const gains = [
    { name: 'Ash', skill: 'foraging', level: 5 },
    { name: 'Vale', skill: 'foraging', level: 5 },
    { name: 'Hesta', skill: 'foraging', level: 4 },
    { name: 'Briar', skill: 'foraging', level: 3 },
    { name: 'Bram', skill: 'foraging', level: 3 },
    { name: 'Rhosyn', skill: 'building', level: 4 },
    { name: 'Wren', skill: 'hunting', level: 2 },
  ];
  assert.equal(
    skillLine(camp, gains),
    'Skills grew. Hunting: Wren to 2. Foraging: Ash and Vale to 5, Hesta to 4 and Briar and Bram to 3. Building: Rhosyn to 4.',
  );
  const v = village();
  assert.equal(
    skillLine(v, gains),
    'Skills grew. Hunting: 1 person a level. Foraging: Ash and Vale to 5, Hesta to 4 and 2 others a level. Building: Rhosyn to 4.',
  );
  assert.equal(skillLine(camp, []), null);
});

test('version 24 saves gain an empty routine and no chosen foreign land', () => {
  const old = JSON.parse(JSON.stringify(newGame({ seed: 2 })));
  old.version = 24;
  delete old.foreignWorkOk;
  delete old.report.routine;
  const s = migrate(old);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.foreignWorkOk, {});
  assert.deepEqual(s.report.routine, []);
});
