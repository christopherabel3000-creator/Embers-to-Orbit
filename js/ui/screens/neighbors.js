// The Neighbors screen: the valley peoples, diplomacy, and treaties.

import { advisorPerson } from '../../engine/advisors.js';
import { clansLine, clanGiftBlocker, clanGiftCost, clansQuiet } from '../../engine/clans.js';
import { NEIGHBORS, TREATIES, TREATY_ORDER } from '../../engine/data.js';
import { reputationSummary, attitudeLines } from '../../engine/legacy.js';
import { nationSummary, trustWord, valleyLines, skarnArmsWord } from '../../engine/nations.js';
import { diplomacyOptions } from '../../engine/neighbors.js';
import { peaceStatus } from '../../engine/peace.js';
import {
  placeName, isKnown, metNeighbors, relationWord, year,
} from '../../engine/state.js';
import { GREAT_NATIONS, GREAT_ORDER, GREAT_TREATIES } from '../../engine/greatData.js';
import {
  greatActs, greatRegard, greatTarget, routeIncome, tributeCost, orhaiRaidChance, inOrhaiReach,
} from '../../engine/great.js';
import { REGIONS } from '../../engine/worldData.js';
import { state, esc, capitalize, listWords, plural } from '../core.js';

function nationSection(id) {
  const nat = state.neighbors[id].nation;
  const treaties = TREATY_ORDER.filter((k) => nat.treaties[k]).map((k) => TREATIES[k].name.toLowerCase());
  const memory = [...nat.memory].reverse().slice(0, 5);
  return `<h3>Their nation</h3>
    <p>${esc(nationSummary(state, id))}</p>
    <p>Trust: ${esc(trustWord(nat.trust))} (${nat.trust}).${treaties.length ? ` Treaties in force: ${esc(listWords(treaties))}.` : ' No treaties.'}</p>
    ${memory.length ? `<p>They remember that you:</p><ul>${memory.map((m) => `<li>${esc(m.text)}${m.kind === 'broken' ? ' (a broken promise)' : ''}.</li>`).join('')}</ul>` : ''}
    ${id === 'skarn' ? skarnWarSection() : ''}`;
}

// The Skarn's arms, and the hill clans who march with them.
function skarnWarSection() {
  let html = `<p>Their warriors are ${esc(skarnArmsWord(state))}.</p>`;
  const line = clansLine(state);
  if (!line) return html;
  html += `<h3 id="clansHeading">The hill clans</h3><p>${esc(line)}</p>`;
  const why = clanGiftBlocker(state);
  if (!why) {
    html += `<p><button type="button" data-action="giftClans">Send ${clanGiftCost(state)} goods to the clan chiefs: half go home, and the rest keep away from your village for two years</button></p>`;
  } else if (!clansQuiet(state)) {
    html += `<p>${esc(why)}</p>`;
  }
  return html;
}

export function neighborsScreen() {
  const met = metNeighbors(state);
  const speaker = advisorPerson(state, 'speaker');
  let html = `<h1>Neighbors</h1>`;
  if (!met.length) {
    return `${html}<p>Your people know of no one else yet. Scouts exploring far from camp may find other peoples, and others may find you.</p>`;
  }
  html += `<p>${esc(reputationSummary(state))}</p>`;
  html += `<p>Each season you can send envoys to each people once${speaker ? `, led by ${esc(speaker.name)}, your speaker` : ''}. Relations run from hostile to close friends, and slowly drift toward each people's nature, shifted by your reputation.</p>`;
  for (const id of met) {
    const def = NEIGHBORS[id];
    const n = state.neighbors[id];
    if (n.joined) {
      const town = (state.settlements || []).find((t) => t.federated === id);
      html += `<h2 id="neighbor-${id}">${esc(def.title)}</h2>
        <p>Part of your nation since Year ${year(state, n.joinedTurn - state.turn)}.${town ? ` They live at ${esc(town.name)}, a settlement of yours, governed by their chief, ${esc(town.governor.name)}.` : ''}</p>
        ${town ? `<p><button type="button" data-action="openTown" data-town="${town.id}">${esc(town.name)}</button></p>` : ''}`;
      continue;
    }
    const opts = diplomacyOptions(state, id);
    const ready = opts.filter((o) => o.ok);
    const blocked = opts.filter((o) => !o.ok);
    let status = '';
    if (id === 'skarn' && n.vassal) status = ` They are your vassals: they pay you tribute each spring and keep the peace, for as long as they think you stronger.`;
    else if (id === 'skarn' && n.peace) status = ` You are at peace with them. ${peaceStatus(state)}`;
    else if (id === 'skarn' && n.truceUntil > state.turn) status = ` A truce holds for ${plural(n.truceUntil - state.turn, 'more season', 'more seasons')}.`;
    html += `<h2 id="neighbor-${id}">${esc(def.title)}</h2>
      <p>Relations: ${relationWord(n.relation)} (${n.relation}).${status}</p>
      ${attitudeLines(state, id).map((l) => `<p>${esc(l)}</p>`).join('')}
      <p>${esc(capitalize(def.temperament))}. ${esc(def.description)}</p>
      ${id === 'skarn' && n.chief ? `<p>Their chief: ${esc(n.chief)}.</p>` : ''}
      <p>Home: ${esc(placeName(state, def.home))}${isKnown(state, def.home) ? '' : ', a place your scouts have not found'}. They want ${esc(def.wants)}, and offer ${esc(def.offers)}.</p>
      ${n.nation ? nationSection(id) : ''}
      <h3>Envoys this season</h3>`;
    if (n.lastEnvoy === state.turn) html += '<p>Your envoys have already visited them this season.</p>';
    else if (!ready.length) html += '<p>Nothing you can offer them right now.</p>';
    if (ready.length) {
      html += `<div class="actions">${ready.map((o) => `<button type="button" data-action="diplomacy" data-neighbor="${id}" data-act="${o.key}">${esc(o.label)}</button>`).join('')}</div>`;
    }
    const notNow = blocked.filter((o) => n.lastEnvoy !== state.turn);
    if (notNow.length) {
      html += `<p>Not possible now:</p><ul>${notNow.map((o) => `<li>${esc(o.label)}. ${esc(o.why)}</li>`).join('')}</ul>`;
    }
  }
  const valley = state.neighbors.skarn.nation ? valleyLines(state, relationWord) : [];
  if (valley.length) {
    html += `<h2>Between the peoples</h2>
      <p>How the nations feel about each other. Skarn raids embitter their victims; quarrels can bring the Velari and Tellani to blows.</p>
      <ul>${valley.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  html += greatSection();
  return html;
}

// The great nations beyond the valley: rumors, then envoys once met.
function greatSection() {
  const heard = GREAT_ORDER.filter((id) => state.great && state.great[id].heard);
  if (!heard.length) return '';
  let html = `<h2 id="greatHeading">Beyond the valley</h2>
    <p>The great nations beyond the valley. Each season you can send one envoy to each nation you have met.</p>`;
  for (const id of heard) {
    const def = GREAT_NATIONS[id];
    const g = state.great[id];
    if (!g.met) {
      html += `<h3 id="great-${id}">${esc(def.title)}</h3><p>Known only by rumor: ${esc(def.rumor)} An expedition to ${esc(REGIONS[def.homeland].name.toLowerCase())} would find them.</p>`;
      continue;
    }
    const regard = greatRegard(state, id);
    const ties = [g.embassy ? 'an embassy' : null, ...Object.entries(GREAT_TREATIES).filter(([k]) => g.treaties[k]).map(([, t]) => t.phrase), g.married ? 'a marriage between your ruling families' : null, g.route ? `a trade route bringing ${routeIncome(state, id)} coin a season` : null].filter(Boolean);
    const acts = greatActs(state, id);
    const ready = acts.filter((a) => !a.why);
    const notNow = acts.filter((a) => a.why);
    html += `<h3 id="great-${id}">${esc(def.title)}</h3>
      <p>Relations: ${relationWord(g.relation)} (${g.relation}), drifting toward ${greatTarget(state, id)}. Trust: ${esc(trustWord(g.trust))} (${g.trust}).</p>
      ${regard.length ? `<p>What moves them: ${esc(listWords(regard.map(([text, n]) => `${text} (${n > 0 ? 'plus' : 'minus'} ${Math.abs(n)})`)))}.</p>` : ''}
      <p>${esc(def.description)} ${esc(def.values)}</p>
      <p>They want ${esc(def.wants)}, and offer ${esc(def.offers)}. ${esc(def.signature)}</p>
      <p>${ties.length ? `Between you: ${esc(listWords(ties))}.` : 'Nothing binds you yet.'}</p>
      ${id === 'orhai' ? `<p>${esc(orhaiStatus())}</p>` : ''}
      ${g.memory.length ? `<p>They remember that you ${esc(listWords([...g.memory].reverse().slice(0, 4)))}.</p>` : ''}`;
    if (g.lastEnvoy === state.turn) html += '<p>Your envoy has already gone to them this season.</p>';
    else if (ready.length) html += `<div class="actions">${ready.map((a) => `<button type="button" data-action="greatDiplomacy" data-nation="${id}" data-act="${a.act}">${esc(a.label)}</button>`).join('')}</div>`;
    if (g.lastEnvoy !== state.turn && notNow.length) html += `<p>Not possible now:</p><ul>${notNow.map((a) => `<li>${esc(a.label)}. ${esc(a.why)}</li>`).join('')}</ul>`;
  }
  return html;
}

function orhaiStatus() {
  const g = state.great.orhai;
  if (g.treaties.peace) return 'Under the peace pact, their riders leave your settlements alone.';
  if (g.paidUntil > state.turn) return `Your tribute keeps their riders away for ${plural(g.paidUntil - state.turn, 'more season', 'more seasons')}. Next year they will ask for ${tributeCost(state)} coin.`;
  const reach = (state.settlements || []).filter(inOrhaiReach);
  return reach.length
    ? `Their riders may fall on your settlements within their reach (${listWords(reach.map((t) => t.name))}): about ${Math.round(orhaiRaidChance(state) * 100)} percent each season.${g.angryUntil > state.turn ? ' They are angry, and come more often.' : ''}`
    : 'None of your settlements stands within reach of their riders, on the plains or the desert edge.';
}
