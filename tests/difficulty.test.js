import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import { makePerson, migrate, SAVE_VERSION } from '../js/engine/state.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, raidScale } from '../js/engine/difficulty.js';
import { nation } from '../js/engine/nations.js';
import { clanTarget, clans } from '../js/engine/clans.js';
import { skarnGarrison } from '../js/engine/neighbors.js';
import { describePending } from '../js/engine/events.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r;
};

function village(difficulty, seed = 1) {
  const s = newGame({ seed, difficulty });
  for (let i = 0; i < 30; i++) {
    s.people.push(makePerson({ name: `Extra${i}`, note: '', age: 25, skills: { hunting: 3, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 1, palisade: 1, leanTo: 20 });
  s.knowledge.learned.push('farming');
  s.milestoneReached = true;
  s.resources.food = 200;
  s.resources.wood = 100;
  for (const id of ['velari', 'tellani', 'skarn']) s.neighbors[id].known = true;
  return act(s, { type: 'foundVillage' }).state;
}

// Plays a camp with nobody acting until the first raid, and returns its size.
function firstRaid(difficulty) {
  let s = newGame({ seed: 11, difficulty });
  s.resources.food = 400;
  for (let t = 0; t < 40; t++) {
    if (s.pendingEvent && s.pendingEvent.type === 'raid') return s.pendingEvent.raiders;
    if (s.pendingEvent) s = act(s, { type: 'resolveEvent', choice: describePending(s).options[0].id }).state;
    s = act(s, { type: 'endTurn' }).state;
  }
  throw new Error('no raid came');
}

test('new games start on normal; a game can start on any difficulty', () => {
  assert.equal(DEFAULT_DIFFICULTY, 'normal');
  assert.equal(newGame({ seed: 1 }).difficulty, 'normal');
  assert.equal(newGame({ seed: 1, difficulty: 'hard' }).difficulty, 'hard');
  assert.equal(newGame({ seed: 1, difficulty: 'nonsense' }).difficulty, 'normal');
  assert.deepEqual(Object.values(DIFFICULTIES).map((d) => d.raid), [1, 1.25, 1.5, 2]);
});

test('raids on the camp bring more raiders on harder difficulties', () => {
  const easy = firstRaid('easy');
  assert.equal(firstRaid('normal'), Math.round(easy * 1.25));
  assert.equal(firstRaid('hard'), Math.round(easy * 1.5));
  assert.equal(firstRaid('insane'), easy * 2);
});

test('the Skarn keep more warriors under arms, and more hill clansmen come', () => {
  const easy = village('easy');
  const hard = village('hard');
  const ratio = nation(hard, 'skarn').warriors / nation(easy, 'skarn').warriors;
  assert.ok(Math.abs(ratio - 1.5) < 0.1, `about half again as many, got ${ratio.toFixed(2)}`);
  assert.equal(nation(hard, 'velari').warriors, nation(easy, 'velari').warriors, 'other peoples are unchanged');
  easy.resources.food = 1300;
  hard.resources.food = 1300;
  assert.ok(clanTarget(hard) > clanTarget(easy));
});

test('Skarn hold has more defenders before the Skarn are a nation', () => {
  assert.equal(skarnGarrison(newGame({ seed: 1, difficulty: 'easy' })), 9);
  assert.equal(skarnGarrison(newGame({ seed: 1, difficulty: 'insane' })), 18);
});

test('changing difficulty takes effect at once, even in the middle of a raid', () => {
  let s = village('easy');
  nation(s, 'skarn').warriors = 40;
  clans(s).warriors = 10;
  s.pendingEvent = { type: 'raid', raiders: 6, warned: true, from: 'outlaws' };
  const r = act(s, { type: 'setDifficulty', level: 'insane' });
  s = r.state;
  assert.equal(s.difficulty, 'insane');
  assert.equal(raidScale(s), 2);
  assert.equal(nation(s, 'skarn').warriors, 80);
  assert.equal(clans(s).warriors, 20);
  assert.match(r.message, /^Difficulty: Insane\. Twice as many enemies/);
  s = act(s, { type: 'setDifficulty', level: 'normal' }).state;
  assert.equal(nation(s, 'skarn').warriors, 50);
  assert.ok(applyAction(s, { type: 'setDifficulty', level: 'impossible' }).error);
});

test('games saved before difficulty play on as easy', () => {
  const old = JSON.parse(JSON.stringify(newGame({ seed: 2 })));
  old.version = 27;
  delete old.difficulty;
  const s = migrate(old);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.difficulty, 'easy');
});
