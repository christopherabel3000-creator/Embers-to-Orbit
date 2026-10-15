// A field battle between one of your armies and an enemy: deploying the
// companies, then orders for each round, or the commander fights it.

import {
  fieldView, fieldFormation, commanderOrders, oddsPhrase, FIELD_FORMATIONS, FIELD_ROUNDS,
} from '../../engine/field.js';
import { FIELD_ORDERS, FIELD_ZONES, ZONE_WORDS, KINDS } from '../../engine/armyData.js';
import { armyById } from '../../engine/armies.js';
import { pendingField, fieldOdds } from '../../engine/war.js';
import { WEATHER } from '../../engine/weather.js';
import {
  $main, state, esc, capitalize, listWords, plural,
} from '../core.js';

const POSITIONS = { left: 'Left flank', center: 'Center', right: 'Right flank', reserve: 'Reserve' };

function commanderName(army) {
  return army && army.commander ? army.commander.name : 'your captains';
}

function groundText(view, battle) {
  const weather = WEATHER[battle.weather] ? WEATHER[battle.weather].name : battle.weather;
  const whose = battle.walls && battle.walls.side === 'them' ? 'Their walls' : 'The walls behind your soldiers';
  const walls = view.walls == null ? '' : view.walls > 0 ? ` ${whose} turn aside about ${view.walls} percent of the harm.` : ` ${whose} are broken open.`;
  return `The ground: ${view.terrain}. The weather: ${weather}.${walls}`;
}

export function fieldScreen() {
  const ev = pendingField(state);
  const battle = ev.battle;
  return battle.phase === 'deploy' ? deployScreen(ev) : roundScreen(ev);
}

function deployScreen(ev) {
  const battle = ev.battle;
  const army = armyById(state, ev.armyId);
  const view = fieldView(battle);
  const odds = fieldOdds(state);
  const lead = commanderName(army);
  const suggested = battle.seen ? 'match' : 'reserve';
  const plan = fieldFormation(battle, suggested);
  let html = `<h1>${esc(battle.title || 'Battle')}</h1>
    <p class="urgent">${esc(ev.text)}</p>
    <h2>The enemy</h2>
    <ul>${view.zones.filter((z) => z.zone !== 'reserve').map((z) => `<li>${esc(capitalize(z.name))}: ${esc(z.theirs)}.</li>`).join('')}</ul>
    <p>${esc(groundText(view, battle))}</p>
    <h2>${esc(capitalize(lead))}'s advice</h2>
    <p>If we fight, we are ${esc(oddsPhrase(odds))}. Best formation: ${esc(FIELD_FORMATIONS[suggested].name.toLowerCase())}.</p>
    <h2>Quick choices</h2>
    <div class="actions">
      <button type="button" class="primary" data-action="fieldAuto">Let ${esc(lead)} command the battle</button>
      <button type="button" data-action="fieldWithdraw">${ev.context === 'storm' ? 'Call off the storm' : 'Pull back without fighting'}</button>
    </div>
    <h2>Command it yourself</h2>
    <form id="fieldDeployForm">
      <p><label for="fieldFormation">Formation</label>
        <select id="fieldFormation">${Object.entries(FIELD_FORMATIONS).map(([id, f]) => `<option value="${id}"${id === suggested ? ' selected' : ''}>${esc(f.name)}: ${esc(f.about)}</option>`).join('')}</select></p>
      <p><button type="button" data-action="fieldArrange">Arrange the companies in this formation</button></p>
      <fieldset><legend>Positions</legend>`;
  for (const u of battle.us) {
    html += `<p><label for="pos-c${u.id}">${esc(u.name)}, ${plural(u.soldiers, 'soldier', 'soldiers')}</label>
      <select id="pos-c${u.id}" data-company="${u.id}">${Object.entries(POSITIONS).map(([z, label]) => `<option value="${z}"${plan[u.id] === z ? ' selected' : ''}>${label}</option>`).join('')}</select></p>`;
  }
  html += `</fieldset>
      <p id="fieldSummary" aria-live="polite">${esc(fieldSummary(plan))}</p>
      <div class="actions"><button type="submit" class="primary">Take positions</button></div>
    </form>`;
  return html;
}

export function fieldSummary(plan) {
  const counts = { left: 0, center: 0, right: 0, reserve: 0 };
  for (const z of Object.values(plan)) if (z in counts) counts[z] += 1;
  return `Companies: left flank ${counts.left}, center ${counts.center}, right flank ${counts.right}, reserve ${counts.reserve}.`;
}

export function readFieldPlan() {
  const plan = {};
  for (const sel of $main.querySelectorAll('select[data-company]')) plan[sel.dataset.company] = sel.value;
  return plan;
}

function roundScreen(ev) {
  const battle = ev.battle;
  const army = armyById(state, ev.armyId);
  const view = fieldView(battle);
  const lead = commanderName(army);
  const advice = commanderOrders(battle);
  let html = `<h1>${esc(battle.title || 'Battle')}, round ${battle.round + 1} of ${FIELD_ROUNDS}</h1>
    <p>${plural(view.us, 'soldier', 'soldiers')} of yours and about ${view.them} of theirs still in the fight.</p>`;
  if (battle.lastLines && battle.lastLines.length) html += `<h2>Last round</h2><ul>${battle.lastLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  html += '<h2>The field</h2>';
  for (const z of view.zones) {
    html += `<h3>${esc(capitalize(z.name))}</h3>
      <p>Yours: ${z.ours.length ? esc(listWords(z.ours)) : 'none'}. Enemy: ${esc(z.theirs)}.</p>`;
  }
  html += `<p>${esc(groundText(view, battle))}</p>`;
  const adviceWords = FIELD_ZONES.filter((z) => advice[z]).map((z) => `${ZONE_WORDS[z]}, ${FIELD_ORDERS[advice[z]].name.toLowerCase()}`);
  if (advice.reserve && advice.reserve !== 'stay') adviceWords.push(`the reserve to join the ${ZONE_WORDS[advice.reserve]}`);
  html += `<h2>${esc(capitalize(lead))}'s advice</h2><p>${esc(adviceWords.length ? capitalize(adviceWords.join('; ')) : 'Hold steady')}.</p>
    <form id="fieldOrdersForm"><fieldset><legend>Orders for this round</legend>`;
  for (const z of view.zones.filter((x) => x.zone !== 'reserve' && x.orders.length)) {
    html += `<p><label for="forder-${z.zone}">${esc(capitalize(z.name))}</label>
      <select id="forder-${z.zone}" data-field-zone="${z.zone}">${z.orders.map((o) => `<option value="${o}"${advice[z.zone] === o ? ' selected' : ''}>${esc(FIELD_ORDERS[o].name)}: ${esc(FIELD_ORDERS[o].about)}</option>`).join('')}</select></p>`;
  }
  const reserve = view.zones.find((z) => z.zone === 'reserve');
  const movable = battle.us.filter((u) => u.zone === 'reserve' && !u.broken && u.soldiers > 0 && !KINDS[u.kind].siege);
  if (reserve && movable.length) {
    const opts = [['stay', 'Stay in reserve'], ...FIELD_ZONES.map((z) => [z, `Join the ${ZONE_WORDS[z]}`])];
    html += `<p><label for="forder-reserve">Reserve: ${esc(listWords(movable.map((u) => u.name)))}</label>
      <select id="forder-reserve" data-field-zone="reserve">${opts.map(([v, l]) => `<option value="${v}"${(advice.reserve || 'stay') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></p>`;
  }
  const engines = battle.us.some((u) => KINDS[u.kind].siege && !u.broken);
  html += `</fieldset>
      ${engines ? '<p class="muted">Siege engines stay in the reserve and batter any walls each round.</p>' : ''}
      <div class="actions">
        <button type="submit" class="primary">Give orders</button>
        <button type="button" data-action="fieldAuto">Let ${esc(lead)} finish the battle</button>
        <button type="button" data-action="fieldWithdraw">Pull back and abandon the fight</button>
      </div>
    </form>`;
  return html;
}
