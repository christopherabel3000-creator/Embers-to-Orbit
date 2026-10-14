// The study queue. Study points flow into the current discovery; when it
// is made, leftover points go straight into the next ready one in the queue.

import { KNOWLEDGE } from './data.js';
import { knowledgeBlocker } from './state.js';
import { recordDeed } from './legacy.js';

// Starts the first queued discovery that is ready. Returns its id or null.
export function startNextStudy(state) {
  const k = state.knowledge;
  if (k.current) return k.current;
  const index = k.queue.findIndex((id) => !knowledgeBlocker(state, id));
  if (index === -1) return null;
  k.current = k.queue.splice(index, 1)[0];
  return k.current;
}

// Applies a season of study points. Returns { urgent, events }.
export function applyStudy(state, points) {
  const out = { urgent: [], events: [] };
  const k = state.knowledge;
  if (!k.current) startNextStudy(state);
  if (!k.current) {
    out.events.push('Your people studied, but without a goal their ideas went nowhere. Choose a discovery on the Knowledge screen.');
    return out;
  }
  let left = points;
  while (left > 0 && k.current) {
    const item = KNOWLEDGE[k.current];
    const done = k.progress[k.current] || 0;
    const used = Math.min(item.cost - done, left);
    k.progress[k.current] = done + used;
    left -= used;
    if (k.progress[k.current] >= item.cost - 1e-9) {
      k.learned.push(k.current);
      recordDeed(state, 'discoveries');
      // A choice closes off its alternatives for good.
      for (const other of item.excludes || []) {
        k.queue = k.queue.filter((id) => id !== other);
        delete k.progress[other];
      }
      delete k.progress[k.current];
      k.current = null;
      out.urgent.push(`Discovery: ${item.name}. ${item.effect}`);
      const next = startNextStudy(state);
      if (next) out.events.push(`Your people moved on to study ${KNOWLEDGE[next].name.toLowerCase()}.`);
    }
  }
  if (k.current && k.progress[k.current]) {
    const item = KNOWLEDGE[k.current];
    out.events.push(`Study of ${item.name.toLowerCase()} is ${Math.floor((k.progress[k.current] / item.cost) * 100)} percent done.`);
  }
  return out;
}
