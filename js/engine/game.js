// The single entry point for changing the game. Every player decision is
// an action object; applyAction returns a new state and never mutates
// the old one. This keeps saves simple and leaves room for multiplayer.

import { TASKS, BUILDINGS } from './data.js';
import { personById, living, foodNeeded } from './state.js';
import { resolveSeason } from './season.js';
import { defenseStrength, raidAttackStrength } from './rules.js';
import { randomBetween, randomInt, chance } from './rng.js';
import { refreshAdvisors } from './advisors.js';

export { newGame } from './state.js';

export function applyAction(state, action) {
  const next = structuredClone(state);
  const result = handlers[action.type]
    ? handlers[action.type](next, action)
    : { error: `Unknown action: ${action.type}` };
  if (result && result.error) return { state, error: result.error };
  return { state: next, message: result && result.message };
}

function blocked(state) {
  if (state.gameOver) return { error: 'The game is over. Start a new game.' };
  return null;
}

const handlers = {
  assign(state, { personId, task }) {
    const stop = blocked(state);
    if (stop) return stop;
    const p = personById(state, personId);
    if (!p || !p.alive) return { error: 'That person is not in the camp.' };
    if (!TASKS[task]) return { error: 'Unknown task.' };
    p.task = task;
    return { message: `${p.name}: ${TASKS[task].name}.` };
  },

  assignAll(state, { fromTask, task }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!TASKS[task]) return { error: 'Unknown task.' };
    const moved = living(state).filter((p) => p.task === fromTask);
    for (const p of moved) p.task = task;
    return { message: `${moved.length} ${moved.length === 1 ? 'person' : 'people'} moved to ${TASKS[task].name.toLowerCase()}.` };
  },

  startProject(state, { buildingId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const b = BUILDINGS[buildingId];
    if (!b) return { error: 'Unknown building.' };
    if (state.project) return { error: 'Another project is already underway. Cancel it first.' };
    if (!b.repeatable && state.buildings[buildingId] > 0) return { error: `You already have a ${b.name.toLowerCase()}.` };
    if (state.resources.wood < b.cost) return { error: `Not enough wood. The ${b.name.toLowerCase()} needs ${b.cost} and you have ${state.resources.wood}.` };
    state.resources.wood -= b.cost;
    state.project = { id: buildingId, progress: 0 };
    return { message: `Started building a ${b.name.toLowerCase()}. ${b.cost} wood used.` };
  },

  cancelProject(state) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!state.project) return { error: 'No project to cancel.' };
    const b = BUILDINGS[state.project.id];
    const refund = state.project.progress === 0 ? b.cost : Math.floor(b.cost / 2);
    state.resources.wood += refund;
    state.project = null;
    return { message: `Cancelled the ${b.name.toLowerCase()}. ${refund} wood recovered.` };
  },

  resolveRaid(state, { plan, defenderIds = [] }) {
    const stop = blocked(state);
    if (stop) return stop;
    const ev = state.pendingEvent;
    if (!ev || ev.type !== 'raid') return { error: 'There is no raid to respond to.' };
    const lines = [];
    const res = state.resources;
    const loseShare = (foodShare, woodShare) => {
      const f = Math.floor(res.food * foodShare);
      const w = Math.floor(res.wood * woodShare);
      res.food -= f;
      res.wood -= w;
      return `The raiders took ${f} food and ${w} wood.`;
    };
    const all = living(state);
    if (plan === 'hide') {
      lines.push(ev.warned
        ? 'Your people hid what they could and slipped into the trees until the raiders left.'
        : 'Caught by surprise, your people grabbed what they could and fled into the trees.');
      lines.push(ev.warned ? loseShare(0.2, 0.15) : loseShare(0.35, 0.25));
      for (const p of all) p.morale = Math.max(0, p.morale - 6);
    } else if (plan === 'fight') {
      const defenders = defenderIds.map((id) => personById(state, id)).filter((p) => p && p.alive);
      if (defenders.length === 0) return { error: 'Choose at least one defender, or choose to hide.' };
      const defense = defenseStrength(state, defenders, ev.warned);
      const attack = raidAttackStrength(ev.raiders) * randomBetween(state, 0.85, 1.15);
      const won = defense >= attack;
      const injured = [];
      for (const p of defenders) {
        if (chance(state, won ? 0.15 : 0.4)) {
          p.health = Math.max(0, p.health - randomInt(state, won ? 20 : 30, won ? 35 : 55));
          injured.push(p);
        }
      }
      if (won) {
        lines.push(`${defenders.length} defenders drove the raiders off${state.buildings.palisade ? ' from behind the palisade' : ''}.`);
        for (const p of all) p.morale = Math.min(100, p.morale + 8);
      } else {
        lines.push(`The defenders were overwhelmed.`);
        lines.push(loseShare(0.4, 0.3));
        for (const p of all) p.morale = Math.max(0, p.morale - 10);
      }
      if (injured.length) lines.push(`Wounded in the fighting: ${injured.map((p) => p.name).join(', ')}.`);
      const killed = injured.filter((p) => p.health <= 0);
      for (const p of killed) {
        p.alive = false;
        lines.push(`${p.name} was killed.`);
      }
    } else {
      return { error: 'Choose to fight or hide.' };
    }
    state.pendingEvent = null;
    refreshAdvisors(state);
    if (living(state).length === 0) state.gameOver = true;
    state.report.urgent.push(...lines);
    for (const text of lines) state.log.push({ turn: state.turn, date: state.report.title, text });
    return { message: lines.join(' ') };
  },

  endTurn(state) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) return { error: 'Deal with the raiders before ending the season.' };
    resolveSeason(state);
    return { message: `Season ended. It is now ${state.report.title}.` };
  },
};

// Convenience for tests and the advisors: food needed by everyone now.
export function currentFoodNeed(state) {
  return foodNeeded(living(state).length);
}
