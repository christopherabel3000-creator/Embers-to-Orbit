// The Map screen: places, work sites, and land.

import { PLACES, NEIGHBORS } from '../../engine/data.js';
import { nationsActive, owner, landsOf, claimLimit, claimBlocker, freeToWork } from '../../engine/nations.js';
import { siteFor } from '../../engine/rules.js';
import {
  placeName, knownPlaces, unexploredNeighbors, abundanceWord, isKnown, wolvesAt, taskAvailable,
} from '../../engine/state.js';
import { state, esc, listWords, plural } from '../core.js';

const SITE_LABELS = {
  hunt: 'Hunters work at',
  forage: 'Foragers work at',
  wood: 'Woodcutters work at',
  quarry: 'Quarriers work at',
};

function siteOptionText(id, task) {
  const name = placeName(state, id);
  if (task === 'scout') {
    const n = unexploredNeighbors(state, id).length;
    return `${name} (${n ? `${n} unexplored ${n === 1 ? 'path' : 'paths'}` : 'all paths explored'})`;
  }
  const bits = [];
  // Land another people holds: working it angers them.
  if (nationsActive(state) && !freeToWork(state, id)) bits.push(`${NEIGHBORS[owner(state, id)].name.replace(/^the /, '')} land`);
  const b = PLACES[id].bonus[task] || 0;
  const unit = { wood: 'wood', quarry: 'stone' }[task] || 'food';
  if (b) bits.push(`${b > 0 ? 'plus' : 'minus'} ${Math.abs(b)} ${unit} per worker`);
  if (task === 'hunt' || task === 'forage') bits.push(`${task === 'hunt' ? 'game' : 'wild food'} ${abundanceWord(state.places[id].abundance[task])}`);
  if (PLACES[id].distance >= 3) bits.push('far');
  if (task === 'hunt' && wolvesAt(state, id)) bits.push('wolves');
  return bits.length ? `${name} (${bits.join(', ')})` : name;
}

export function mapScreen() {
  const known = knownPlaces(state);
  let html = `<h1>Map</h1>
    <p>You know ${plural(known.length, 'place', 'places')}, counting your camp, ${esc(state.campName)}. Scouts find more by exploring the unexplored paths.</p>
    <h2>Work sites</h2>
    <p>Everyone doing the same task works at the same place. Hunting and foraging wear a place down over time; it recovers when left alone.</p>`;
  for (const task of ['hunt', 'forage', 'wood', ...(taskAvailable(state, 'quarry') ? ['quarry'] : [])]) {
    const options = known.filter((id) => PLACES[id].tasks.includes(task));
    html += `<p><label for="site-${task}">${SITE_LABELS[task]}</label>
      <select id="site-${task}" data-site="${task}">${options.map((id) => `<option value="${id}"${siteFor(state, task) === id ? ' selected' : ''}>${esc(siteOptionText(id, task))}</option>`).join('')}</select></p>`;
  }
  html += `<p><label for="site-scout">Scouts explore beyond</label>
    <select id="site-scout" data-site="scout">${known.map((id) => `<option value="${id}"${siteFor(state, 'scout') === id ? ' selected' : ''}>${esc(siteOptionText(id, 'scout'))}</option>`).join('')}</select></p>`;
  if (nationsActive(state)) {
    const held = landsOf(state, 'player').filter((p) => p !== 'camp');
    html += `<h2 id="landsHeading">Your lands</h2>
      <p>Besides ${esc(state.campName)}, your village holds ${held.length ? esc(listWords(held.map((p) => placeName(state, p)))) : 'no other places'}: ${held.length} of the ${claimLimit(state)} it can hold. More people let you hold more. You can claim a place that borders your land and that no one else holds. Working on another people's land angers them, unless you have an open lands pact.</p>`;
  }
  html += '<h2>Places you know</h2><ul class="plain">';
  for (const id of known) {
    const place = PLACES[id];
    const links = place.neighbors.filter((n) => isKnown(state, n)).map((n) => placeName(state, n));
    const unexplored = unexploredNeighbors(state, id).length;
    const linkParts = [...links];
    if (unexplored) linkParts.push(unexplored === 1 ? 'one unexplored path' : `${unexplored} unexplored paths`);
    const conditions = [];
    if (wolvesAt(state, id)) conditions.push('A wolf pack roams here. Hunting is dangerous and poor.');
    if (place.tasks.includes('hunt')) conditions.push(`Game is ${abundanceWord(state.places[id].abundance.hunt)}.`);
    if (place.tasks.includes('forage')) conditions.push(`Wild food is ${abundanceWord(state.places[id].abundance.forage)}.`);
    const workingHere = [];
    if (siteFor(state, 'hunt') === id) workingHere.push('hunters');
    if (siteFor(state, 'forage') === id) workingHere.push('foragers');
    if (siteFor(state, 'wood') === id) workingHere.push('woodcutters');
    if (taskAvailable(state, 'quarry') && siteFor(state, 'quarry') === id) workingHere.push('quarriers');
    const who = nationsActive(state) ? owner(state, id) : null;
    const ownerLine = !nationsActive(state) ? ''
      : who === 'player' ? '<p>Yours.</p>'
        : who ? `<p>Belongs to ${esc(NEIGHBORS[who].name)}.</p>` : '<p>Unclaimed.</p>';
    const canClaim = nationsActive(state) && !who && !claimBlocker(state, id);
    html += `<li class="card"><h3 id="place-${id}">${esc(placeName(state, id))}</h3>
      ${ownerLine}
      <p>${esc(place.description)}${place.distance >= 3 ? ' It is far from camp, so work here goes a little slower.' : ''}</p>
      ${conditions.length ? `<p>${conditions.join(' ')}</p>` : ''}
      <p>Paths lead to ${esc(listWords(linkParts) || 'nowhere new')}.</p>
      ${workingHere.length ? `<p>Your ${esc(listWords(workingHere))} work here.</p>` : ''}
      ${siteFor(state, 'scout') === id ? '<p>Your scouts explore from here.</p>' : ''}
      ${(state.settlements || []).filter((t) => t.place === id).map((t) => `<p>Your settlement of ${esc(t.name)} stands here, with ${plural(t.population, 'person', 'people')}.</p>`).join('')}
      ${canClaim ? `<p><button type="button" data-action="claimPlace" data-place="${id}">Claim ${esc(placeName(state, id))}</button></p>` : ''}
    </li>`;
  }
  html += '</ul>';
  return html;
}
