// The founding screens: becoming a village, and planning a second settlement.

import { PLACES } from '../../engine/data.js';
import {
  settlementBlocker, settlementSites, settlerRange, governorChoices, settlementProduct, POLICIES, costText,
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

export function foundSettlementScreen() {
  const why = settlementBlocker(state);
  if (why) return `<h1>A new settlement</h1><p>${esc(why)}</p><div class="actions"><button type="button" data-nav="report">Back to the report</button></div>`;
  const sites = settlementSites(state);
  const [lo, hi] = settlerRange(state);
  const governors = governorChoices(state);
  const productWord = { food: 'food', wood: 'wood', stone: 'stone' };
  const settlerOptions = [];
  for (let n = lo; n <= hi; n++) settlerOptions.push(`<option value="${n}"${n === lo ? ' selected' : ''}>${n} settlers</option>`);
  return `<h1>Found a new settlement</h1>
    <p>Some of your people will leave ${esc(state.campName)} to found a second settlement on land you hold. It will run itself under a governor, and send home food, wood, or stone each season. Founding it costs ${esc(costText())}, and begins the Nation era.</p>
    <p class="warning">This cannot be undone: the settlers leave the village for good.</p>
    <form id="settlementForm">
      <fieldset><legend>Where will it stand?</legend>
        ${sites.map((id, i) => `<label class="choice"><input type="radio" name="settlementPlace" value="${id}"${i === 0 ? ' checked' : ''}> ${esc(placeName(state, id))}: it would send home ${productWord[settlementProduct(id)]}. ${esc(PLACES[id].description)}</label>`).join('')}
      </fieldset>
      <p><label for="settlementName">Name the settlement</label>
        <input type="text" id="settlementName" maxlength="30" autocomplete="off" value="${esc(`New ${placeName(state, sites[0])}`)}"></p>
      <p><label for="settlementCount">How many people go</label>
        <select id="settlementCount">${settlerOptions.join('')}</select></p>
      <p class="muted">At least 30 must stay in ${esc(state.campName)}. The council chooses a fair mix of able adults, and stays at home itself unless one of them governs.</p>
      <p><label for="settlementGovernor">Governor</label>
        <select id="settlementGovernor">${governors.map((p) => `<option value="${p.id}">${esc(villagerRow(p))}</option>`).join('')}</select></p>
      <fieldset><legend>What should it do at first?</legend>
        ${Object.entries(POLICIES).map(([key, pol], i) => `<label class="choice"><input type="radio" name="settlementPolicy" value="${key}"${i === 0 ? ' checked' : ''}> ${esc(pol.name)}: ${esc(pol.about)}</label>`).join('')}
      </fieldset>
      <div class="actions">
        <button type="submit" class="primary">Found the settlement</button>
        <button type="button" data-nav="report">Not yet</button>
      </div>
    </form>`;
}
