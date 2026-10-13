// The single entry point for changing the game. Every player decision is
// an action object; applyAction returns a new state and never mutates
// the old one. This keeps saves simple and leaves room for multiplayer.

import { TASKS, BUILDINGS, PLACES, KNOWLEDGE } from './data.js';
import {
  personById, living, foodNeeded, isKnown, placeName, DEFAULT_ORDERS,
  taskAvailable, hasKnowledge, knowledgeBlocker, allowedTasksFor, lifeStage,
} from './state.js';
import { resolveSeason } from './season.js';
import { resolveRaidPlan } from './raid.js';
import { resolveStoryEvent } from './events.js';

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
    if (!taskAvailable(state, task)) return { error: `Your people do not know how to ${TASKS[task].name.toLowerCase()} yet.` };
    if (!allowedTasksFor(state, p).includes(task)) {
      return { error: lifeStage(p) === 'infant' ? `${p.name} is too young to work.` : `${p.name} is too young for that work.` };
    }
    p.task = task;
    p.orderReturn = null; // The player's choice overrides any standing order.
    return { message: `${p.name}: ${TASKS[task].name}.` };
  },

  assignAll(state, { fromTask, task }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!TASKS[task]) return { error: 'Unknown task.' };
    if (!taskAvailable(state, task)) return { error: `Your people do not know how to ${TASKS[task].name.toLowerCase()} yet.` };
    const moved = living(state).filter((p) => p.task === fromTask && allowedTasksFor(state, p).includes(task));
    for (const p of moved) {
      p.task = task;
      p.orderReturn = null;
    }
    return { message: `${moved.length} ${moved.length === 1 ? 'person' : 'people'} moved to ${TASKS[task].name.toLowerCase()}.` };
  },

  startProject(state, { buildingId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const b = BUILDINGS[buildingId];
    if (!b) return { error: 'Unknown building.' };
    if (b.requires && !hasKnowledge(state, b.requires)) return { error: `Building a ${b.name.toLowerCase()} needs ${KNOWLEDGE[b.requires].name}.` };
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
    const result = resolveRaidPlan(state, plan, defenderIds);
    if (result.error) return result;
    state.report.urgent.push(...result.lines);
    for (const text of result.lines) state.log.push({ turn: state.turn, date: state.report.title, text });
    return { message: result.lines.join(' ') };
  },

  resolveEvent(state, { choice }) {
    const stop = blocked(state);
    if (stop) return stop;
    const result = resolveStoryEvent(state, choice);
    if (result.error) return result;
    state.report.decisions = [...(state.report.decisions || []), ...result.lines];
    for (const text of result.lines) state.log.push({ turn: state.turn, date: state.report.title, text });
    return { message: result.lines.join(' ') };
  },

  setStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!KNOWLEDGE[knowledgeId]) return { error: 'Unknown discovery.' };
    const why = knowledgeBlocker(state, knowledgeId);
    if (why) return { error: why };
    state.knowledge.current = knowledgeId;
    return { message: `Your people will study ${KNOWLEDGE[knowledgeId].name.toLowerCase()}.` };
  },

  setWorkSite(state, { task, placeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!['hunt', 'forage', 'wood', 'scout'].includes(task)) return { error: 'Unknown task.' };
    if (!isKnown(state, placeId)) return { error: 'You have not found that place yet.' };
    if (task !== 'scout' && !PLACES[placeId].tasks.includes(task)) {
      return { error: `${placeName(state, placeId)} is no place for that work.` };
    }
    state.workSites[task] = placeId;
    const verb = { hunt: 'Hunters will work at', forage: 'Foragers will work at', wood: 'Woodcutters will work at', scout: 'Scouts will explore beyond' }[task];
    return { message: `${verb} ${placeName(state, placeId)}.` };
  },

  setOrder(state, { id, value }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!(id in DEFAULT_ORDERS)) return { error: 'Unknown order.' };
    if (id === 'foodReserve') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 4) return { error: 'Choose between 0 and 4 seasons.' };
      state.orders.foodReserve = n;
    } else if (id === 'raidPolicy') {
      if (!['ask', 'fightIfLikely', 'auto'].includes(value)) return { error: 'Unknown raid policy.' };
      state.orders.raidPolicy = value;
    } else {
      state.orders[id] = Boolean(value);
    }
    return { message: 'Standing order updated.' };
  },

  endTurn(state) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) {
      return { error: state.pendingEvent.type === 'raid'
        ? 'Deal with the raiders before ending the season.'
        : 'A decision is waiting. Make it before ending the season.' };
    }
    resolveSeason(state);
    return { message: `Season ended. It is now ${state.report.title}.` };
  },
};

// Convenience for tests and the advisors: food needed by everyone now.
export function currentFoodNeed(state) {
  return foodNeeded(living(state));
}
