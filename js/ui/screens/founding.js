// The founding screens: becoming a village, and planning a second settlement.

import { PLACES } from '../../engine/data.js';
import {
  ROLES, ROLE_ORDER, DEMANDS, DEMAND_ORDER, bestRole, roleAvailable, settlementById,
} from '../../engine/realm.js';
import {
  settlementBlocker, settlementSites, settlerRange, governorChoices, settlerSources, costText, KEEP_AT_HOME, KEEP_IN_TOWN, inNationEra,
} from '../../engine/settlements.js';
import { living, placeName } from '../../engine/state.js';
import { villageBlocker } from '../../engine/village.js';
import { state, esc, plural } from '../core.js';
import { villagerRow } from '../screens/village.js';

export function foundVillageScreen() {
  const why = villageBlocker(state);
  if (why) return `<h1>Become a village</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="report">Back to the report</button></div>`;
  return `<h1>Become a village?</h1>
    <p>${esc(state.campName)} has ${plural(living(state).length, 'person', 'people')}, fields of its own, and a palisade. The elders say it is time to live as a village. This begins the Settlement era.</p>
    <h2>What changes</h2>
    <ul>
      <li>Your advisors become the village council. Each season the council sets everyone's work, so you no longer assign people one by one.</li>
      <li>You guide the council with priorities: how hard to push building, learning, defense, and exploration. You still run the build and study queues, trade, feasts, and the food reserve.</li>
      <li>The People screen becomes the Village screen, showing your people as groups by their work. Your council and anyone who masters a skill stay named.</li>
      <li>New: guards, who train and stand watch; huts, which shelter 8; and settlers, who come to a village that is well fed and has room.</li>
    </ul>
    <p class="warning">This cannot be undone. You can also wait and keep playing as a camp for as long as you like.</p>
    <div class="actions">
      <button type="button" class="primary" data-action="foundVillage">Become a village</button>
      <button type="button" data-nav="report">Not yet</button>
    </div>`;
}

// Where the settlers for a new settlement come from: 'capital' or a settlement's id.
let foundingFrom = 'capital';

export function setFoundingFrom(value) {
  foundingFrom = value === 'capital' ? 'capital' : Number(value);
}

export function foundSettlementScreen() {
  const why = settlementBlocker(state);
  if (why) return `<h1>A new settlement</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="${inNationEra(state) ? 'nation' : 'report'}">Back</button></div>`;
  const sources = settlerSources(state);
  if (!sources.some((x) => x.from === foundingFrom)) foundingFrom = sources[0].from;
  const sites = settlementSites(state);
  const [lo, hi] = settlerRange(state, foundingFrom);
  const governors = governorChoices(state, foundingFrom);
  const first = !(state.settlements || []).length;
  const whence = foundingFrom === 'capital' ? state.campName : settlementById(state, foundingFrom).name;
  const settlerOptions = [];
  for (let n = lo; n <= hi; n++) settlerOptions.push(`<option value="${n}"${n === lo ? ' selected' : ''}>${n} settlers</option>`);
  const roles = ROLE_ORDER.filter((r) => roleAvailable(state, r));
  return `<h1>Found a new settlement</h1>
    <p>Some of your people will leave to found a new settlement on land your nation holds. It will run itself under a governor, guided by the role and demands you set, and you can change them later on its screen. Founding it costs ${esc(costText())} from the stores of ${esc(state.campName)}${first ? ', and begins the Nation era' : ''}.</p>
    <p class="warning">This cannot be undone: the settlers leave for good.</p>
    <form id="settlementForm">
      ${sources.length > 1 ? `<p><label for="foundingFrom">Where the settlers come from</label>
        <select id="foundingFrom">${sources.map((x) => `<option value="${x.from}"${x.from === foundingFrom ? ' selected' : ''}>${esc(x.name)}${x.from === 'capital' ? ', the capital' : ''}</option>`).join('')}</select></p>` : `<input type="hidden" id="foundingFrom" value="${foundingFrom}">`}
      <fieldset><legend>Where will it stand?</legend>
        ${sites.map((id, i) => `<label class="choice"><input type="radio" name="settlementPlace" value="${id}"${i === 0 ? ' checked' : ''}> ${esc(placeName(state, id))}: best for a ${esc(ROLES[bestRole(id)].name.toLowerCase())}. ${esc(PLACES[id].description)}</label>`).join('')}
      </fieldset>
      <p><label for="settlementName">Name the settlement</label>
        <input type="text" id="settlementName" maxlength="30" autocomplete="off" value="${esc(`New ${placeName(state, sites[0])}`)}"></p>
      <p><label for="settlementCount">How many people go from ${esc(whence)}</label>
        <select id="settlementCount">${settlerOptions.join('')}</select></p>
      <p class="muted">${foundingFrom === 'capital' ? `At least ${KEEP_AT_HOME} must stay in ${esc(state.campName)}. The council chooses a fair mix of able adults, and stays at home itself unless one of them governs.` : `At least ${KEEP_IN_TOWN} must stay in ${esc(whence)}.`}</p>
      <p><label for="settlementGovernor">Governor</label>
        <select id="settlementGovernor">${governors.map((p) => `<option value="${p.id}">${esc(villagerRow(p))}</option>`).join('')}</select></p>
      <fieldset><legend>Its role</legend>
        <label class="choice"><input type="radio" name="settlementRole" value="" checked> Whatever its land is best for, as each place says above.</label>
        ${roles.map((r) => `<label class="choice"><input type="radio" name="settlementRole" value="${r}"> ${esc(ROLES[r].name)}: ${esc(ROLES[r].about)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>Its demands</legend>
        ${DEMAND_ORDER.map((d) => `<label class="choice"><input type="radio" name="settlementDemands" value="${d}"${d === 'normal' ? ' checked' : ''}> ${esc(DEMANDS[d].name)}: ${esc(DEMANDS[d].about)}</label>`).join('')}
      </fieldset>
      <div class="actions">
        <button type="submit" class="primary">Found the settlement</button>
        <button type="button" data-nav="${inNationEra(state) ? 'nation' : 'report'}">Not yet</button>
      </div>
    </form>`;
}
