// The World screen (the regions beyond the valley, and the expeditions out
// in them), the Region screen that drills into one, and the form for
// sending an expedition.

import { REGIONS, REGION_ORDER, WORLD_PLACES, SMALL_PEOPLES } from '../../engine/worldData.js';
import {
  regionStatus, regionMapped, regionPlaces, foundIn, expeditionTargets, travelTime, expeditionBlocker,
  leaderChoices, leaderName, travelRation, PARTY_SIZE, EXPLORE_SEASONS, KEEP_HOME,
} from '../../engine/world.js';
import { ROLES, bestRole, landFit } from '../../engine/realm.js';
import { living, hasKnowledge } from '../../engine/state.js';
import {
  state, regionId, esc, plural, listWords,
} from '../core.js';

function regionName(id) {
  return REGIONS[id].name;
}

function neighborsText(id) {
  const known = REGIONS[id].neighbors.filter((n) => regionStatus(state, n) !== 'unknown');
  const unknown = REGIONS[id].neighbors.length - known.length;
  const parts = known.map((n) => regionName(n).toLowerCase());
  if (unknown) parts.push(unknown === 1 ? 'somewhere not yet heard of' : `${unknown} places not yet heard of`);
  return `Borders ${listWords(parts)}.`;
}

function travelText(id) {
  const t = travelTime(state, id);
  const boats = hasKnowledge(state, 'riverBoats');
  if (t) return `${t === 1 ? 'a season\'s' : `${t} seasons'`} travel each way${REGIONS[id].river && !boats ? '; River boats would take them there at once' : ''}`;
  return `with no time lost on the way${REGIONS[id].river && boats ? ', by river boat' : ''}`;
}

function expeditionLine(exp) {
  const where = regionName(exp.region).toLowerCase();
  const stage = exp.stage === 'out' ? `on the way to ${where}, ${plural(exp.left, 'more season', 'more seasons')} to go`
    : exp.stage === 'exploring' ? `exploring ${where}, for ${plural(exp.left, 'more season', 'more seasons')}`
      : `on the way home from ${where}${exp.left > 0 ? `, ${plural(exp.left, 'more season', 'more seasons')} to go` : ', home by the end of this season'}`;
  const found = exp.found.length ? ` Found so far: ${listWords(exp.found.map((id) => WORLD_PLACES[id].name))}.` : '';
  const lost = exp.lost.length ? ` Lost: ${listWords(exp.lost)}.` : '';
  return `${leaderName(exp)}'s party of ${exp.party.length}, ${stage}, with ${exp.food} food left.${found}${lost}`;
}

export function worldScreen() {
  const w = state.world;
  const known = REGION_ORDER.filter((id) => id !== 'valley' && regionStatus(state, id) !== 'unknown');
  const explored = known.filter((id) => regionStatus(state, id) === 'explored');
  const why = expeditionBlocker(state);
  let html = `<h1>World</h1>
    <p>Beyond the forest valley lie other lands. Your people have heard of ${plural(known.length, 'region', 'regions')} and explored ${explored.length}. Expeditions find places to settle, ores and salt, ruins, wonders, and other peoples.</p>
    <h2 id="expeditionsHeading">Expeditions (${w.expeditions.length})</h2>`;
  if (w.expeditions.length) {
    html += `<ul class="plain">${w.expeditions.map((exp) => `<li class="card"><p>${esc(expeditionLine(exp))}</p>
      ${exp.stage !== 'home' ? `<p><button type="button" data-action="recallExpedition" data-expedition="${exp.id}">Call ${esc(leaderName(exp))}'s party home</button></p>` : ''}</li>`).join('')}</ul>`;
  } else {
    html += '<p>None are out.</p>';
  }
  html += why ? `<p>${esc(why)}</p>` : '<div class="actions"><button type="button" data-nav="expedition">Send an expedition</button></div>';
  html += `<h2>Regions</h2><ul class="plain">
    <li class="card"><p><button type="button" data-nav="map">${esc(regionName('valley'))}</button> Your home. ${esc(neighborsText('valley'))}</p></li>
    ${known.map((id) => {
    const status = regionStatus(state, id);
    const found = foundIn(state, id).length;
    const towns = (state.settlements || []).filter((t) => WORLD_PLACES[t.place] && WORLD_PLACES[t.place].region === id);
    const text = status === 'explored'
      ? `Explored: ${found} of ${regionPlaces(id).length} places found${regionMapped(state, id) ? ', and mapped' : ''}.${towns.length ? ` Your ${towns.length === 1 ? 'settlement' : 'settlements'}: ${listWords(towns.map((t) => t.name))}.` : ''} ${neighborsText(id)}`
      : `Heard of, not yet explored: ${REGIONS[id].heard} ${neighborsText(id)}`;
    return `<li class="card"><p><button type="button" data-action="openRegion" data-region="${id}">${esc(regionName(id))}</button> ${esc(text)}</p></li>`;
  }).join('')}
  </ul>`;
  return html;
}

// What a place is good for, in a sentence.
function placeUse(id) {
  const p = WORLD_PLACES[id];
  if (p.kind === 'settle') {
    const role = bestRole(id);
    const what = role === 'mining' ? (p.salt ? 'salt' : p.ore ? `iron ore${hasKnowledge(state, 'mining') ? '' : ', once your people know Mining (stone until then)'}` : 'stone') : null;
    const fit = landFit(role, id);
    return `A place to settle: best for a ${ROLES[role].name.toLowerCase()}${what ? `, which would send home ${what}` : ''}${fit > 1 ? `, and it would do well here` : ''}.${p.harbor ? ' The only place on this coast a harbor could stand.' : ''}`;
  }
  if (p.kind === 'people') {
    const folk = SMALL_PEOPLES[p.people];
    const met = state.world.peoples[p.people];
    return `Home of ${folk.name}${met === 'friends' ? ', your friends, who guide your people here' : met ? ', whom your people have met' : ''}.`;
  }
  if (p.kind === 'wonder') return 'A wonder of the world.';
  if (p.kind === 'ruins') return 'Ruins, already searched.';
  if (p.kind === 'danger') return 'A danger to anyone who travels here.';
  return 'A route through the region.';
}

export function regionScreen() {
  const id = regionId;
  if (!id || !REGIONS[id] || regionStatus(state, id) === 'unknown') return '<h1>Region</h1><p>Your people know nothing of that place.</p><div class="actions"><button type="button" data-nav="world">Back to the World screen</button></div>';
  const r = REGIONS[id];
  const status = regionStatus(state, id);
  const found = foundIn(state, id);
  const all = regionPlaces(id);
  const towns = (state.settlements || []).filter((t) => WORLD_PLACES[t.place] && WORLD_PLACES[t.place].region === id);
  let html = `<h1>${esc(r.name)}</h1>
    <p>${esc(status === 'explored' ? r.description : r.heard)} It lies ${esc(r.dir)}, ${esc(travelText(id))}. ${esc(neighborsText(id))}</p>`;
  if (r.winterPasses) html += '<p>Snow closes the passes in winter: expeditions there wait for spring.</p>';
  if (r.hardWinter) html += '<p>Winters here are the hardest anywhere: expeditions in winter come to harm more often.</p>';
  html += `<h2>Places (${found.length} of ${status === 'explored' ? all.length : 'unknown'})</h2>`;
  if (!found.length) html += `<p>${status === 'explored' ? 'Your expeditions have found nothing here yet.' : 'No one from your nation has been there.'}</p>`;
  else {
    html += `<ul class="plain">${found.map((pid) => {
      const p = WORLD_PLACES[pid];
      const town = towns.find((t) => t.place === pid);
      return `<li class="card"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><p>${esc(placeUse(pid))}</p>
        ${town ? `<p><button type="button" data-action="openTown" data-town="${town.id}">${esc(town.name)}</button> Your settlement here.</p>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  if (status === 'explored' && found.length < all.length) html += `<p>${plural(all.length - found.length, 'place is', 'places are')} still to be found here.</p>`;
  if (found.some((pid) => WORLD_PLACES[pid].kind === 'settle' && !state.world.places[pid].owner)) {
    html += '<p>Settlements can be founded at the places to settle from the Nation screen.</p>';
  }
  html += '<div class="actions"><button type="button" data-nav="world">Back to the World screen</button></div>';
  return html;
}

export function expeditionScreen() {
  const why = expeditionBlocker(state);
  if (why) return `<h1>Send an expedition</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="world">Back to the World screen</button></div>`;
  const targets = expeditionTargets(state);
  const leaders = leaderChoices(state).slice(0, 10); // The ten best scouts.
  const most = Math.min(PARTY_SIZE[1], living(state).length - KEEP_HOME);
  const sizes = [];
  for (let n = PARTY_SIZE[0]; n <= most; n++) sizes.push(n);
  const seasons = [];
  for (let n = EXPLORE_SEASONS[0]; n <= EXPLORE_SEASONS[1]; n++) seasons.push(n);
  const ration = travelRation(state);
  return `<h1>Send an expedition</h1>
    <p>A party sets out from ${esc(state.campName)}, travels to a region, explores it season by season, and comes home with what it found. Choices may come up on the way. Each traveler eats ${ration} food a season${ration === 1 ? ', thanks to salted food' : ''}, and the steward packs food for the whole journey there, the exploring, and the way back. The party's leader and size make finds likelier and the road safer.</p>
    <form id="expeditionForm">
      <fieldset><legend>Where to?</legend>
        ${targets.map((id, i) => `<label class="choice"><input type="radio" name="expeditionRegion" value="${id}"${i === 0 ? ' checked' : ''}> ${esc(regionName(id))}: ${regionStatus(state, id) === 'explored' ? `${foundIn(state, id).length} of ${regionPlaces(id).length} places found` : 'not yet explored'}; ${esc(travelText(id))}.</label>`).join('')}
      </fieldset>
      <p><label for="expeditionLeader">Leader, from your ten best scouts</label>
        <select id="expeditionLeader">${leaders.map((p) => `<option value="${p.id}">${esc(p.name)}, ${p.age}: scouting ${p.skills.scouting}, hunting ${p.skills.hunting}${Object.values(state.advisors).includes(p.id) ? ', on the council' : ''}</option>`).join('')}</select></p>
      <p><label for="expeditionSize">How many go, with the leader</label>
        <select id="expeditionSize">${sizes.map((n) => `<option value="${n}"${n === 4 ? ' selected' : ''}>${n} people</option>`).join('')}</select></p>
      <p><label for="expeditionSeasons">How long they explore</label>
        <select id="expeditionSeasons">${seasons.map((n) => `<option value="${n}"${n === 2 ? ' selected' : ''}>${plural(n, 'season', 'seasons')}</option>`).join('')}</select></p>
      <p class="muted">The rest of the party are the best scouts and hunters who can be spared; the council stays at home unless one of them leads. At least ${KEEP_HOME} must stay in ${esc(state.campName)}. You have ${state.resources.food} food.</p>
      <div class="actions">
        <button type="submit" class="primary">Send the expedition</button>
        <button type="button" data-nav="world">Not yet</button>
      </div>
    </form>`;
}
