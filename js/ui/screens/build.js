// The Build screen: buildings and the build queue.

import {
  remainingQueueWork, queueBlocker, queuedCount, refundFor, refundWords, costWords, shortfall,
} from '../../engine/building.js';
import { BUILDINGS, BUILDING_ORDER } from '../../engine/data.js';
import { expectedWork } from '../../engine/rules.js';
import {
  living, shelterCapacity, hasKnowledge, inVillage, eraAtLeast, taskAvailable,
} from '../../engine/state.js';
import { state, esc, plural } from '../core.js';

// "15 wood and 8 work", or "30 wood, 30 stone and 20 goods, and 20 work".
function costAndWork(id) {
  const words = costWords(id);
  return `${words}${words.includes(' and ') ? ',' : ''} and ${BUILDINGS[id].work} work`;
}

export function buildScreen() {
  const people = living(state);
  const builders = people.filter((p) => p.task === 'build');
  const workRate = Math.round(builders.reduce((sum, p) => sum + expectedWork(p, state), 0));
  const remaining = Math.ceil(remainingQueueWork(state));
  const q = state.buildQueue;
  let html = `<h1>Build</h1>
    <p>Wood: ${state.resources.wood}.${taskAvailable(state, 'quarry') || state.resources.stone ? ` Stone: ${state.resources.stone || 0}.` : ''}${taskAvailable(state, 'craft') || state.resources.goods ? ` Goods: ${state.resources.goods || 0}.` : ''} Shelter for ${shelterCapacity(state)}, and ${plural(people.length, 'person', 'people')} in ${inVillage(state) ? 'the village' : 'camp'}.</p>
    <p>${plural(builders.length, 'builder', 'builders')}, about ${workRate} work per season.${q.length ? ` The queue needs ${remaining} more work${workRate ? `: about ${plural(Math.max(1, Math.ceil(remaining / workRate)), 'season', 'seasons')}` : ''}.` : ''} Work left over from one building goes straight into the next.</p>
    <h2 id="queueHeading">Build queue (${q.length})</h2>`;
  if (!q.length) {
    html += '<p>Empty. Add buildings below. Wood is paid when work on each one begins.</p>';
  } else {
    html += '<ol class="plain">';
    q.forEach((item, i) => {
      const b = BUILDINGS[item.id];
      const name = b.name.toLowerCase();
      const status = item.paid
        ? `${Math.floor(item.progress)} of ${b.work} work done.`
        : `Not started. Needs ${costAndWork(item.id)}.${i === 0 && shortfall(state, item.id).length ? ` Still short of ${shortfall(state, item.id).map((x) => `${x.short} ${x.kind}`).join(' and ')}.` : ''}`;
      html += `<li class="card"><p id="queue-item-${i}" tabindex="-1"><strong>${i + 1}. ${esc(b.name)}.</strong> ${esc(status)}</p>
        <div class="actions">
          ${i > 0 ? `<button type="button" data-action="moveBuilding" data-index="${i}" data-by="-1">Move ${esc(name)} up</button>` : ''}
          ${i < q.length - 1 ? `<button type="button" data-action="moveBuilding" data-index="${i}" data-by="1">Move ${esc(name)} down</button>` : ''}
          <button type="button" data-action="removeBuilding" data-index="${i}">Remove ${esc(name)}${item.paid && refundWords(refundFor(item)) ? `, recovering ${refundWords(refundFor(item))}` : ''}</button>
        </div></li>`;
    });
    html += '</ol>';
  }
  html += '<h2>Buildings</h2><ul class="plain">';
  for (const id of BUILDING_ORDER) {
    const b = BUILDINGS[id];
    if (b.requires && !hasKnowledge(state, b.requires)) continue;
    if (b.era && !eraAtLeast(state, b.era)) continue;
    const owned = state.buildings[id];
    const status = b.repeatable ? `You have ${owned}.` : owned ? 'Built.' : 'Not built.';
    const why = queueBlocker(state, id);
    const next = id === 'road' ? (state.settlements || [])[(state.buildings.road || 0) + queuedCount(state, 'road')] : null;
    html += `<li class="card"><h3>${esc(b.name)}</h3>
      <p>${esc(b.description)}${next ? ` The next would reach ${esc(next.name)}.` : ''}</p>
      <p>${status} Costs ${costAndWork(id)}.</p>
      ${why ? (!b.max && (owned || queuedCount(state, id)) ? '' : `<p>${esc(why)}</p>`) : `<p><button type="button" data-action="queueBuilding" data-building="${id}">Add ${esc(b.name.toLowerCase())} to the queue</button></p>`}
      ${!b.repeatable && queuedCount(state, id) ? '<p>In the build queue.</p>' : ''}
    </li>`;
  }
  html += '</ul>';
  return html;
}
