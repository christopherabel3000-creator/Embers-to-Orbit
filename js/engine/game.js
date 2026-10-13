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
import { bestWorkPlan } from './assign.js';
import { queueBlocker, refundFor } from './building.js';
import { startNextStudy } from './study.js';
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

  assignBest(state) {
    const stop = blocked(state);
    if (stop) return stop;
    const plan = bestWorkPlan(state);
    let changed = 0;
    for (const [id, task] of plan) {
      const p = personById(state, id);
      if (p.task !== task) changed += 1;
      p.task = task;
      p.orderReturn = null;
    }
    const counts = {};
    for (const task of plan.values()) counts[task] = (counts[task] || 0) + 1;
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${TASKS[t].name.toLowerCase()} ${n}`)
      .join(', ');
    return { message: changed ? `Everyone is on their best work. ${changed} changed. ${summary}.` : `Everyone was already on their best work. ${summary}.` };
  },

  queueBuilding(state, { buildingId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const why = queueBlocker(state, buildingId);
    if (why) return { error: why };
    state.buildQueue.push({ id: buildingId, progress: 0, paid: false });
    const b = BUILDINGS[buildingId];
    return { message: `Added a ${b.name.toLowerCase()} to the build queue, in place ${state.buildQueue.length}.` };
  },

  // Older name for adding to the queue.
  startProject(state, action) {
    return handlers.queueBuilding(state, action);
  },

  removeBuilding(state, { index = 0 }) {
    const stop = blocked(state);
    if (stop) return stop;
    const item = state.buildQueue[index];
    if (!item) return { error: 'That building is not in the queue.' };
    const refund = refundFor(item);
    state.resources.wood += refund;
    state.buildQueue.splice(index, 1);
    const b = BUILDINGS[item.id];
    return { message: `Removed the ${b.name.toLowerCase()} from the queue.${refund ? ` ${refund} wood recovered.` : ''}` };
  },

  // Older name: removes the first building in the queue.
  cancelProject(state) {
    return handlers.removeBuilding(state, { index: 0 });
  },

  moveBuilding(state, { index, by }) {
    const stop = blocked(state);
    if (stop) return stop;
    const to = index + by;
    const q = state.buildQueue;
    if (!q[index] || to < 0 || to >= q.length) return { error: 'It cannot move that way.' };
    [q[index], q[to]] = [q[to], q[index]];
    const b = BUILDINGS[q[to].id];
    return { message: `The ${b.name.toLowerCase()} is now number ${to + 1} of ${q.length}.` };
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
    state.knowledge.queue = state.knowledge.queue.filter((id) => id !== knowledgeId);
    return { message: `Your people will study ${KNOWLEDGE[knowledgeId].name.toLowerCase()}.` };
  },

  queueStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const k = state.knowledge;
    if (!KNOWLEDGE[knowledgeId]) return { error: 'Unknown discovery.' };
    if (hasKnowledge(state, knowledgeId)) return { error: 'Already known.' };
    if (k.current === knowledgeId || k.queue.includes(knowledgeId)) return { error: `${KNOWLEDGE[knowledgeId].name} is already planned.` };
    k.queue.push(knowledgeId);
    const started = !k.current && startNextStudy(state) === knowledgeId;
    return { message: started
      ? `Your people will study ${KNOWLEDGE[knowledgeId].name.toLowerCase()} now.`
      : `Added ${KNOWLEDGE[knowledgeId].name.toLowerCase()} to the study queue, in place ${k.queue.indexOf(knowledgeId) + 1}.` };
  },

  unqueueStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const k = state.knowledge;
    const i = k.queue.indexOf(knowledgeId);
    if (i === -1) return { error: 'That is not in the study queue.' };
    k.queue.splice(i, 1);
    return { message: `Removed ${KNOWLEDGE[knowledgeId].name.toLowerCase()} from the study queue.` };
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
