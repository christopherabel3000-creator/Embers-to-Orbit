// The build queue. Builders' work flows through the queue in order: when
// one building is finished, leftover work goes straight into the next.
// Each building's wood is paid when work on it begins.

import { BUILDINGS, KNOWLEDGE } from './data.js';
import { hasKnowledge } from './state.js';
import { plural } from './util.js';
import { recordDeed } from './legacy.js';

export function queuedCount(state, id) {
  return state.buildQueue.filter((item) => item.id === id).length;
}

export function remainingQueueWork(state) {
  return state.buildQueue.reduce((sum, item) => sum + BUILDINGS[item.id].work - item.progress, 0);
}

// Why this building cannot be added to the queue, or null if it can.
export function queueBlocker(state, id) {
  const b = BUILDINGS[id];
  if (!b) return 'Unknown building.';
  if (b.requires && !hasKnowledge(state, b.requires)) return `Building a ${b.name.toLowerCase()} needs ${KNOWLEDGE[b.requires].name}.`;
  if (!b.repeatable && state.buildings[id] > 0) return `You already have a ${b.name.toLowerCase()}.`;
  if (!b.repeatable && queuedCount(state, id) > 0) return `A ${b.name.toLowerCase()} is already in the queue.`;
  if (b.max && state.buildings[id] + queuedCount(state, id) >= b.max) return `Your camp has room for ${b.max} at most${queuedCount(state, id) ? ', counting those in the queue' : ''}.`;
  return null;
}

// Wood returned when a queued building is removed: all of it if no work
// was done yet, half once work has started.
export function refundFor(item) {
  if (!item.paid) return 0;
  const cost = BUILDINGS[item.id].cost;
  return item.progress === 0 ? cost : Math.floor(cost / 2);
}

// Applies a season of builders' work. Returns report lines.
export function applyBuildWork(state, work, { afterFires = false } = {}) {
  const events = [];
  const finished = [];
  let blocked = null;
  let left = work;
  while (left > 0 && state.buildQueue.length) {
    const item = state.buildQueue[0];
    const b = BUILDINGS[item.id];
    if (!item.paid) {
      if (state.resources.wood < b.cost) {
        blocked = { b, short: b.cost - state.resources.wood };
        break;
      }
      state.resources.wood -= b.cost;
      item.paid = true;
    }
    const used = Math.min(b.work - item.progress, left);
    item.progress += used;
    left -= used;
    if (item.progress >= b.work - 1e-9) {
      state.buildings[item.id] += 1;
      state.buildQueue.shift();
      recordDeed(state, 'built');
      finished.push(b);
    }
  }
  for (const b of finished) events.push(`Finished: ${b.name.toLowerCase()}. ${b.description}`);
  const current = state.buildQueue[0];
  if (current && current.progress > 0 && !blocked) {
    const b = BUILDINGS[current.id];
    events.push(`Work continues on the ${b.name.toLowerCase()}: ${Math.floor(current.progress)} of ${b.work} done.`);
  }
  if (blocked) {
    events.push(`Building paused: the ${blocked.b.name.toLowerCase()} needs ${blocked.b.cost} wood to start, and you are ${plural(blocked.short, 'wood', 'wood')} short${afterFires ? ' after keeping the fires burning' : ''}.`);
  } else if (left >= 1 && work > 0 && !state.buildQueue.length) {
    events.push(`${Math.floor(left)} work went unused because the build queue is empty.`);
  }
  return events;
}
