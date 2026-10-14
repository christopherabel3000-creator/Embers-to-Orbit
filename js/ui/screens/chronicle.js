// The Chronicle screen: traditions, reputation, and seasons past.

import { ERA_NAMES } from '../../engine/data.js';
import { TRADITIONS, traditionProgress, reputationSummary } from '../../engine/legacy.js';
import { personById } from '../../engine/state.js';
import { state, esc } from '../core.js';

export function chronicleScreen() {
  let html = '<h1>Chronicle</h1><p>Your people\'s story: the traditions they have grown into, how others see them, and what has happened.</p>';
  html += `<p>Your people live in ${esc(ERA_NAMES[state.era || 'camp'])}.</p>`;
  const earned = state.traditions || [];
  const heroes = state.heroes || [];
  if (heroes.length) {
    html += `<h2>Heroes</h2><ul>${heroes.map((h) => {
      const p = personById(state, h.id);
      return `<li>${esc(h.name)}, who ${esc(h.deed)}, in Year ${h.year}.${p && p.alive ? '' : ' Remembered.'}</li>`;
    }).join('')}</ul>`;
  }
  html += '<h2>Traditions</h2>';
  if (earned.length) {
    html += `<ul>${earned.map((id) => `<li><strong>${esc(TRADITIONS[id].name)}.</strong> ${esc(TRADITIONS[id].story)} ${esc(TRADITIONS[id].effect)}</li>`).join('')}</ul>`;
  } else {
    html += '<p>None yet. Traditions grow from what your people do again and again.</p>';
  }
  const forming = traditionProgress(state);
  if (forming.length) {
    html += `<h2>Taking shape</h2><ul>${forming.map((t) => `<li>${esc(t.name)}: ${t.have} of ${t.need} ${esc(t.deed)}.</li>`).join('')}</ul>`;
  }
  html += `<h2>Reputation</h2><p>${esc(reputationSummary(state))}</p>`;
  html += '<h2>Seasons past</h2>';
  if (!state.log.length) return `${html}<p>Nothing has happened yet. End your first season to begin the chronicle.</p>`;
  html += '<p>The most recent seasons come first.</p>';
  const groups = [];
  for (const entry of [...state.log].reverse()) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== entry.date) {
      if (groups.length >= 12) break;
      g = { date: entry.date, lines: [] };
      groups.push(g);
    }
    g.lines.push(entry.text);
  }
  for (const g of groups) {
    html += `<h3>${esc(g.date)}</h3><ul>${[...g.lines].reverse().map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  return html;
}
