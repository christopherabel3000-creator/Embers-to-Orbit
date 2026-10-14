// The build queue. Builders' work flows through the queue in order: when
// one building is finished, leftover work goes straight into the next.
// Each building's wood is paid when work on it begins.

import { BUILDINGS, KNOWLEDGE } from './data.js';
import { hasKnowledge, eraAtLeast } from './state.js';
import { recordDeed } from './legacy.js';

// What a building costs to start: wood, and for some, stone and goods.
export function buildingCost(id) {
  const b = BUILDINGS[id];
  return { wood: b.cost || 0, stone: b.stone || 0, goods: b.goods || 0 };
}

// "30 wood, 40 stone and 20 goods".
export function costWords(id) {
  const c = buildingCost(id);
  const parts = Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || 'nothing';
}

// What the stores are short of to start a building, after keeping `reserve`
// wood back (for the fires). Empty if it can start.
export function shortfall(state, id, reserveWood = 0) {
  const c = buildingCost(id);
  const have = { wood: state.resources.wood - reserveWood, stone: state.resources.stone || 0, goods: state.resources.goods || 0 };
  return Object.entries(c).filter(([k, n]) => n > have[k]).map(([k, n]) => ({ kind: k, short: n - Math.max(0, have[k]) }));
}

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
  if (b.era && !eraAtLeast(state, b.era)) return `${b.name}s can be built once your camp becomes a village.`;
  if (b.needsBuilding && !state.buildings[b.needsBuilding]) return `A ${b.name.toLowerCase()} needs a ${BUILDINGS[b.needsBuilding].name.toLowerCase()} first.`;
  if (b.requires && !hasKnowledge(state, b.requires)) return `Building a ${b.name.toLowerCase()} needs ${KNOWLEDGE[b.requires].name}.`;
  if (!b.repeatable && state.buildings[id] > 0) return `You already have a ${b.name.toLowerCase()}.`;
  if (!b.repeatable && queuedCount(state, id) > 0) return `A ${b.name.toLowerCase()} is already in the queue.`;
  if (b.max && state.buildings[id] + queuedCount(state, id) >= b.max) return `Your camp has room for ${b.max} at most${queuedCount(state, id) ? ', counting those in the queue' : ''}.`;
  return null;
}

// What is returned when a queued building is removed: all of it if no work
// was done yet, half once work has started. Returns { wood, stone, goods }.
export function refundFor(item) {
  const c = buildingCost(item.id);
  const out = { wood: 0, stone: 0, goods: 0 };
  if (!item.paid) return out;
  for (const k of Object.keys(out)) out[k] = item.progress === 0 ? c[k] : Math.floor(c[k] / 2);
  return out;
}

export function refundWords(refund) {
  const parts = Object.entries(refund).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  return parts.join(', ');
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
      const short = shortfall(state, item.id);
      if (short.length) {
        blocked = { b, id: item.id, short };
        break;
      }
      const c = buildingCost(item.id);
      state.resources.wood -= c.wood;
      state.resources.stone = (state.resources.stone || 0) - c.stone;
      state.resources.goods = (state.resources.goods || 0) - c.goods;
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
    const shortWords = blocked.short.map((x) => `${x.short} ${x.kind}`).join(' and ');
    const fires = afterFires && blocked.short.some((x) => x.kind === 'wood') ? ' after keeping the fires burning' : '';
    events.push(`Building paused: the ${blocked.b.name.toLowerCase()} needs ${costWords(blocked.id)} to start, and you are ${shortWords} short${fires}.`);
  } else if (left >= 1 && work > 0 && !state.buildQueue.length) {
    events.push(`${Math.floor(left)} work went unused because the build queue is empty.`);
  }
  return events;
}
