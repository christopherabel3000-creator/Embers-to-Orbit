// The Fleets screen: the foothold on the far shore, your shipyards, the
// ships in your harbor, and your fleets at sea.

import {
  SHORE_PLACES, SHORE_REGIONS, SHIP,
} from '../../engine/farShoreData.js';
import {
  shipyards, buildShipBlocker, shipCostWords, captainChoices, formFleetBlocker, fleetTargets, nodeName, loadBlocker,
  footholdGather, footholdLasts, scoutTargets, scoutBlocker, scoutParty, shipsAfloat, stormChance,
} from '../../engine/farShore.js';
import { living } from '../../engine/state.js';
import {
  state, esc, plural, lowerFirst,
} from '../core.js';

function footholdSection(fs) {
  let html = '<h2 id="footholdHeading">The foothold</h2>';
  const f = fs.foothold;
  if (!fs.landed) return `${html}<p>Your first ship is still on the open sea.</p>`;
  if (!f) return `${html}<p>You have no foothold on the far shore. A fleet carrying at least 4 settlers can make one on any coast you know.</p>`;
  const lasts = footholdLasts(state);
  const gather = footholdGather(state);
  html += `<p>At ${esc(SHORE_PLACES[f.place].name)}, on ${esc(lowerFirst(SHORE_REGIONS[f.region].name))}: ${plural(f.people.length, 'person', 'people')}, with ${f.food} food in store. They gather about ${gather} food a season${lasts != null ? `, less than they eat: it lasts about ${plural(lasts, 'season', 'seasons')}` : ', enough to live on'}.</p>`;
  if (f.scouting) {
    const names = f.people.filter((p) => f.scouting.ids.includes(p.id)).map((p) => p.name);
    html += `<p>${esc(names.join(', '))} ${names.length === 1 ? 'is' : 'are'} scouting ${esc(lowerFirst(SHORE_REGIONS[f.scouting.region].name))}, back in ${plural(Math.max(0, f.scouting.returns - state.turn), 'season', 'seasons')}.</p>`;
  } else {
    const why = scoutBlocker(state);
    if (why) html += `<p>${esc(why)}</p>`;
    else {
      const party = scoutParty(state);
      html += `<p><label for="scoutRegion">Send scouts to explore</label>
        <select id="scoutRegion">${scoutTargets(state).map((id) => `<option value="${id}">${esc(SHORE_REGIONS[id].name)}</option>`).join('')}</select></p>
        <p class="muted">${esc(party.map((p) => p.name).join(', '))} would go, for 2 seasons.</p>
        <div class="actions"><button type="button" data-action="sendScouts">Send the scouts</button></div>`;
    }
  }
  html += `<details><summary>The foothold's people (${f.people.length})</summary><ul>${f.people.map((p) => `<li>${esc(p.name)}, ${p.age}: hunting ${p.skills.hunting || 0}, foraging ${p.skills.foraging || 0}, scouting ${p.skills.scouting || 0}${p.health < 100 ? `, health ${p.health}` : ''}.</li>`).join('')}</ul></details>`;
  return html;
}

function yardsSection(fs) {
  let html = `<h2 id="yardsHeading">Shipyards</h2>
    <p>A merchant ship takes ${esc(shipCostWords())}, and ${plural(SHIP.seasons, 'season', 'seasons')} to build, and costs ${SHIP.upkeep} coin a season to keep. Each carries ${SHIP.food} food or ${SHIP.people} people. You have ${plural(shipsAfloat(state), 'ship', 'ships')}.</p>`;
  const yards = shipyards(state);
  if (!yards.length) return `${html}<p>None of your ports has a harbor yet.</p>`;
  for (const t of yards) {
    const why = buildShipBlocker(state, t);
    html += why ? `<p>${esc(t.name)}: ${esc(why)}</p>` : `<p>${esc(t.name)} can build a ship.</p><div class="actions"><button type="button" data-action="buildShip" data-town="${t.id}">Build a merchant ship at ${esc(t.name)}</button></div>`;
  }
  return html;
}

function harborSection(fs) {
  let html = `<h2 id="harborHeading">In your harbor</h2><p>${plural(fs.ships, 'ship', 'ships')} in port.</p>`;
  const why = formFleetBlocker(state);
  if (why) return `${html}<p>${esc(why)}</p>`;
  const captains = captainChoices(state).slice(0, 12);
  html += `<p><label for="fleetCaptain">Captain</label>
      <select id="fleetCaptain">${captains.map((p) => `<option value="${p.id}">${esc(p.name)}, ${p.age}: scouting ${p.skills.scouting || 0}, learning ${p.skills.learning || 0}</option>`).join('')}</select></p>
    <p><label for="fleetShips">Ships</label>
      <select id="fleetShips">${Array.from({ length: fs.ships }, (_, i) => i + 1).map((n) => `<option value="${n}"${n === fs.ships ? ' selected' : ''}>${plural(n, 'ship', 'ships')}</option>`).join('')}</select></p>
    <p class="muted">A skilled scout makes a better captain: storms find their fleets less often.</p>
    <div class="actions"><button type="button" data-action="formFleet">Form a fleet</button></div>`;
  return html;
}

function fleetSection(fleet) {
  const where = lowerFirst(nodeName(fleet.location));
  const cargo = [fleet.cargo.food ? `${fleet.cargo.food} food` : null, fleet.cargo.people.length ? plural(fleet.cargo.people.length, 'settler', 'settlers') : null].filter(Boolean);
  const course = fleet.route.length ? ` Under sail for ${lowerFirst(nodeName(fleet.route[fleet.route.length - 1]))}, ${plural(fleet.route.length, 'more season', 'more seasons')} at sea.` : ' At anchor.';
  const storm = fleet.route.length ? Math.round(100 * stormChance(state, fleet.route[0], fleet)) : 0;
  let html = `<h3 id="fleet-${fleet.id}">${esc(fleet.name)}</h3>
    <p>${plural(fleet.ships, 'ship', 'ships')} under ${esc(fleet.captain.name)}, in ${esc(where)}.${esc(course)}${storm ? ` About ${storm} percent chance of a storm this season.` : ''} Carrying ${esc(cargo.length ? cargo.join(' and ') : 'nothing')}.</p>`;
  const targets = fleetTargets(state, fleet);
  if (targets.length) {
    html += `<p><label for="course-${fleet.id}">Sail to</label>
      <select id="course-${fleet.id}">${targets.map((id) => `<option value="${id}">${esc(nodeName(id))}</option>`).join('')}</select></p>
      <div class="actions"><button type="button" data-action="setCourse" data-fleet="${fleet.id}">Set the course</button></div>`;
  }
  if (!loadBlocker(state, fleet)) {
    const foodRoom = Math.min(fleet.ships * SHIP.food - fleet.cargo.food, state.resources.food);
    const peopleRoom = Math.min(fleet.ships * SHIP.people - fleet.cargo.people.length, Math.max(0, living(state).length - 30));
    const foodSteps = Array.from({ length: Math.floor(foodRoom / 20) + 1 }, (_, i) => i * 20);
    html += `<p><label for="loadFood-${fleet.id}">Food to take on</label>
        <select id="loadFood-${fleet.id}">${foodSteps.map((n) => `<option value="${n}">${n} food</option>`).join('')}</select></p>
      <p><label for="loadPeople-${fleet.id}">Settlers to take on</label>
        <select id="loadPeople-${fleet.id}">${Array.from({ length: peopleRoom + 1 }, (_, i) => i).map((n) => `<option value="${n}">${plural(n, 'settler', 'settlers')}</option>`).join('')}</select></p>
      <div class="actions"><button type="button" data-action="loadFleet" data-fleet="${fleet.id}">Take on the cargo</button>
        <button type="button" data-action="disbandFleet" data-fleet="${fleet.id}">Bring the fleet into port</button></div>
      <p class="muted">Cargo is landed at the foothold when the fleet reaches its coast. Settlers landed on a coast with no foothold make a new one, if there are at least 4.</p>`;
  }
  return html;
}

export function fleetsScreen() {
  const fs = state.farShore;
  let html = '<h1>Fleets</h1>';
  if (!fs) return `${html}<p>Ships cross the open sea in the Age of Discovery, which begins with your first voyage.</p>`;
  html += `<p>Your ships cross the open sea in fleets, under a captain. Fleets chart the waters and the far shore's coasts, and carry food and settlers to your foothold. The World screen describes the sea and the far shore.</p>
    ${footholdSection(fs)}
    ${yardsSection(fs)}
    ${harborSection(fs)}
    <h2 id="fleetsHeading">Your fleets (${fs.fleets.length})</h2>
    ${fs.fleets.length ? fs.fleets.map(fleetSection).join('') : '<p>No fleets are at sea.</p>'}`;
  return html;
}
