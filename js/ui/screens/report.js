// The Report screen: the season report, the stores and feasts, and the big steps
// (becoming a village, a second settlement) when they are possible.

import { getAdvice } from '../../engine/advisors.js';
import { estimateBattle } from '../../engine/battle.js';
import { NEIGHBORS, LEAN_TIMES } from '../../engine/data.js';
import { settlementBlocker, MIN_VILLAGE } from '../../engine/settlements.js';
import { ransom, ransomGoods, sallyEvent } from '../../engine/siege.js';
import {
  living, foodNeeded, storageCapacity, leanTimesNow, inVillage, taskAvailable,
} from '../../engine/state.js';
import {
  feastBlocker, feastCost, feastGuests, FEAST_GUEST_FOOD, feastLift, fullFeastLift, feastsInARow, feastExpected,
} from '../../engine/stores.js';
import { villageBlocker } from '../../engine/village.js';
import { weatherLine, weatherNow } from '../../engine/weather.js';
import { state, esc, plural, adviceList } from '../core.js';

export function reportScreen() {
  const r = state.report;
  const title = r.finished ? `${r.title}` : r.title;
  let html = `<h1>Report: ${esc(title)}</h1>`;
  if (r.finished) html += `<p class="muted">What happened during ${esc(r.finished)}.</p>`;
  if (r.urgent.length) {
    html += `<h2>Urgent</h2><ul>${r.urgent.map((t) => `<li class="urgent">${esc(t)}</li>`).join('')}</ul>`;
  }
  if (r.decisions && r.decisions.length) {
    html += `<h2>Your decision</h2><ul>${r.decisions.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (r.events.length) {
    html += `<h2>${r.finished ? 'What happened' : 'Your story begins'}</h2><ul>${r.events.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (r.routine && r.routine.length) {
    html += `<h2>The season's work</h2><ul>${r.routine.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  if (state.gameOver) {
    html += `<div class="actions"><button type="button" class="primary" data-action="showNewGame">Start a new game</button></div>`;
    return html;
  }
  if (r.orders && r.orders.length) {
    html += `<h2>Standing orders carried out</h2><ul>${r.orders.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }
  html += `<h2>Advisors</h2>${adviceList(getAdvice(state))}`;
  if (state.siege) {
    const chance = estimateBattle(state, sallyEvent(state), null, 12);
    const word = chance >= 0.75 ? 'likely to win' : chance >= 0.45 ? 'an even fight' : 'likely to lose';
    const cost = ransom(state);
    const weather = weatherLine(weatherNow(state));
    html += `<h2 id="siegeHeading">Siege</h2>
      <p>About ${state.siege.raiders} Skarn surround ${esc(state.campName)}. They have supplies for about ${plural(state.siege.supplies, 'more season', 'more seasons')}, and lose some to hunger each season. While they stay, no one can work outside the walls, and each season they burn a third of what is sown (and any harvest standing in the fields), drive off the herds of a pasture, and strip the land around the village.</p>
      <p>Sallying out means fighting them in the open, with no walls, against besiegers dug in behind stakes and ditches. The war chief thinks that would be ${word}.${weather ? ` ${esc(weather)}` : ''}</p>
      <div class="actions">
        <button type="button" data-action="sallyOut">Sally out and fight them</button>
        ${state.resources.food >= cost ? `<button type="button" data-action="payBesiegers">Pay them ${cost} food to leave</button>` : `<p>They would leave for ${cost} food, and you have ${state.resources.food}.</p>`}
        ${(state.resources.goods || 0) >= ransomGoods(state) ? `<button type="button" data-action="payBesiegers" data-goods="1">Pay them ${ransomGoods(state)} goods to leave</button>` : ''}
      </div>
      <p class="muted">Or wait: end the season, and the siege goes on.</p>`;
  }
  html += storesSection();
  if (inVillage(state) && !(state.settlements || []).length && living(state).length >= MIN_VILLAGE - 10) {
    const why = settlementBlocker(state);
    html += `<h2>A second settlement</h2>
      <p>Founding a second settlement on land your village holds will end the Settlement era and begin the Nation era.${why ? ` ${esc(why)}` : ' Your village is ready.'}</p>
      ${why ? '' : '<div class="actions"><button type="button" data-nav="foundSettlement">Plan a new settlement</button></div>'}`;
  } else if ((state.settlements || []).length && !settlementBlocker(state)) {
    html += `<h2>A new settlement</h2>
      <p>Your nation could found another settlement. The Nation screen shows every settlement.</p>
      <div class="actions"><button type="button" data-nav="foundSettlement">Plan a new settlement</button></div>`;
  }
  if (!villageBlocker(state)) {
    html += `<h2>Become a village</h2>
      <p>${esc(state.campName)} has grown into a true settlement. Your people could become a village whenever you choose. It is a big change, and it cannot be undone.</p>
      <div class="actions"><button type="button" data-nav="foundVillage">Consider becoming a village</button></div>`;
  }
  html += `<div class="actions"><button type="button" data-nav="people">${inVillage(state) ? 'Village and priorities' : 'Assign people'}</button>${(state.settlements || []).length ? '<button type="button" data-nav="nation">Nation</button>' : ''}<button type="button" data-nav="build">Build</button></div>`;
  return html;
}

// In a village, feasts are a custom: what the next one would do.
function feastCustomText() {
  const lift = feastLift(state);
  const row = feastsInARow(state);
  const now = lift < fullFeastLift(state)
    ? `After ${plural(row, 'feast', 'feasts')} in a row, the next would lift spirits by ${lift}, where a first feast lifts them by ${fullFeastLift(state)}.`
    : `The next feast would lift spirits by ${lift}.`;
  return `In a village, a yearly feast becomes a custom: each feast in a year in a row lifts spirits less, and once your people expect one, a year without a feast lowers their spirits. ${now}${feastExpected(state) ? ' Your people expect their yearly feast.' : ''}`;
}

// The food stores, lean times, and feasts.
function storesSection() {
  const people = living(state);
  const food = state.resources.food;
  const room = storageCapacity(state);
  const need = foodNeeded(people);
  const seasons = need ? Math.floor(food / need) : 0;
  let html = `<h2 id="storesHeading">Stores</h2>
    <p>Food: ${food}, with room for ${room}. That feeds everyone for ${plural(seasons, 'season', 'seasons')}. Food beyond the room rots quickly; each storehouse adds room for 150.</p>`;
  const extras = [];
  if (taskAvailable(state, 'quarry') || state.resources.stone) extras.push(`Stone: ${state.resources.stone || 0}, cut by quarriers.`);
  if (taskAvailable(state, 'craft') || state.resources.goods) extras.push(`Goods: ${state.resources.goods || 0}, made by crafters, for trade, fine gifts, and grand buildings.`);
  if (state.buildings.pasture) extras.push(`Pastures give ${state.buildings.pasture * 6} food every season.`);
  if (extras.length) html += `<p>${esc(extras.join(' '))}</p>`;
  const lean = leanTimesNow(state);
  if (lean.length) html += `<ul>${lean.map((c) => `<li>${esc(LEAN_TIMES[c.id].name)}: ${esc(LEAN_TIMES[c.id].effect)}</li>`).join('')}</ul>`;
  const cost = feastCost(state);
  const why = feastBlocker(state);
  html += `<h3>Feast</h3><p>A feast costs ${cost} food, 3 for each person. It lifts everyone's spirits, and people in high spirits work better. Families grow closer, so a child is more likely. You can hold one feast a year, and invite a neighboring people for ${FEAST_GUEST_FOOD} food more to win their goodwill.</p>`;
  if (inVillage(state)) html += `<p>${esc(feastCustomText())}</p>`;
  if (why) {
    html += `<p id="feastStatus">${esc(why)}</p>`;
  } else {
    const guests = feastGuests(state).filter((id) => !feastBlocker(state, id));
    html += `<div class="actions"><button type="button" data-action="holdFeast">Hold a feast for ${cost} food</button>${guests.map((id) => `<button type="button" data-action="holdFeast" data-guest="${id}">Feast with ${esc(NEIGHBORS[id].name)} for ${feastCost(state, id)} food</button>`).join('')}</div>`;
  }
  return html;
}
