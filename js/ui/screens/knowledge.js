// The Knowledge screen: discoveries and the study queue.

import { KNOWLEDGE, KNOWLEDGE_ORDER, BRANCHES } from '../../engine/data.js';
import { studyPoints } from '../../engine/rules.js';
import { townStudy } from '../../engine/realm.js';
import { living, hasKnowledge, knowledgeBlocker, inVillage, knowledgeClosed } from '../../engine/state.js';
import { state, esc, plural } from '../core.js';

export function knowledgeScreen() {
  const k = state.knowledge;
  const studiers = living(state).filter((p) => p.task === 'study');
  const home = Math.round(studiers.reduce((sum, p) => sum + studyPoints(p, state), 0));
  const towns = Math.round(townStudy(state));
  const rate = home + towns;
  const townWords = (state.settlements || []).length
    ? ` Scholars in your other settlements add about ${towns} more, for ${rate} in all; each settlement's learning priority is on its screen.`
    : '';
  let html = `<h1>Knowledge</h1>
    <p>${inVillage(state) ? 'Scholars make discoveries; the learning priority on the Village screen sets how many study.' : 'People set to Study on the People screen make discoveries.'} ${plural(studiers.length, 'person is', 'people are')} studying in ${esc(state.campName)}, for about ${home} points a season.${townWords} Points left over from one discovery go straight into the next one in the queue.</p>
    <h2>Current study</h2>`;
  if (k.current) {
    const item = KNOWLEDGE[k.current];
    const done = Math.floor(k.progress[k.current] || 0);
    const seasons = rate ? Math.ceil((item.cost - done) / rate) : null;
    html += `<p>${esc(item.name)}: ${done} of ${item.cost} points.${seasons ? ` About ${plural(seasons, 'more season', 'more seasons')}.` : ' No one is studying it.'}</p>`;
  } else {
    html += '<p>Nothing chosen. Pick a discovery below.</p>';
  }
  html += `<h2 id="studyQueueHeading">Study queue (${k.queue.length})</h2>`;
  if (!k.queue.length) {
    html += '<p>Empty. Discoveries in the queue start one after another, as soon as each is possible.</p>';
  } else {
    html += `<ol class="plain">${k.queue.map((id, i) => {
      const why = knowledgeBlocker(state, id);
      return `<li class="card"><p><strong>${i + 1}. ${esc(KNOWLEDGE[id].name)}.</strong> ${KNOWLEDGE[id].cost} points.${why ? ` Waiting: ${esc(why)}` : ''}</p>
        <p><button type="button" data-action="unqueueStudy" data-knowledge="${id}">Remove ${esc(KNOWLEDGE[id].name.toLowerCase())} from the queue</button></p></li>`;
    }).join('')}</ol>`;
  }
  const planned = (id) => k.current === id || k.queue.includes(id);
  const open = KNOWLEDGE_ORDER.filter((id) => !knowledgeBlocker(state, id) && !planned(id));
  const closed = KNOWLEDGE_ORDER.filter((id) => !hasKnowledge(state, id) && knowledgeClosed(state, id));
  const locked = KNOWLEDGE_ORDER.filter((id) => !hasKnowledge(state, id) && knowledgeBlocker(state, id) && !knowledgeClosed(state, id) && !planned(id));
  const known = KNOWLEDGE_ORDER.filter((id) => hasKnowledge(state, id));
  // Discoveries grouped by branch of the research tree, each under its own heading.
  const byBranch = (ids, card) => Object.entries(BRANCHES)
    .map(([branch, title]) => [title, ids.filter((id) => KNOWLEDGE[id].branch === branch)])
    .filter(([, list]) => list.length)
    .map(([title, list]) => `<h3>${esc(title)}</h3><ul class="plain">${list.map(card).join('')}</ul>`)
    .join('');
  html += '<h2>Ready to study</h2>';
  if (!open.length) html += '<p>Nothing else right now.</p>';
  html += byBranch(open, (id) => {
    const item = KNOWLEDGE[id];
    const done = Math.floor(k.progress[id] || 0);
    const name = item.name.toLowerCase();
    return `<li class="card"><h4>${esc(item.name)}</h4>
      <p>${esc(item.effect)}</p>
      <p>Costs ${item.cost} points.${done ? ` ${done} points already done.` : ''}</p>
      <div class="actions">
        <button type="button" data-action="setStudy" data-knowledge="${id}">Study ${esc(name)} now</button>
        <button type="button" data-action="queueStudy" data-knowledge="${id}">Add ${esc(name)} to the queue</button>
      </div>
    </li>`;
  });
  if (locked.length) {
    html += '<h2>Not yet possible</h2>';
    html += byBranch(locked, (id) => `<li class="card"><h4>${esc(KNOWLEDGE[id].name)}</h4>
      <p>${esc(KNOWLEDGE[id].effect)}</p>
      <p>${esc(knowledgeBlocker(state, id))} Costs ${KNOWLEDGE[id].cost} points.</p>
      <p><button type="button" data-action="queueStudy" data-knowledge="${id}">Add ${esc(KNOWLEDGE[id].name.toLowerCase())} to the queue, to start when possible</button></p></li>`);
  }
  if (known.length) {
    html += `<h2>Known (${known.length})</h2><ul>${known.map((id) => `<li>${esc(KNOWLEDGE[id].name)}, ${esc(BRANCHES[KNOWLEDGE[id].branch].toLowerCase())}: ${esc(KNOWLEDGE[id].effect)}</li>`).join('')}</ul>`;
  }
  if (closed.length) {
    html += `<h2>Closed off by your choices</h2><ul>${closed.map((id) => `<li>${esc(KNOWLEDGE[id].name)}: ${esc(knowledgeClosed(state, id))}</li>`).join('')}</ul>`;
  }
  return html;
}
