// Raids and battles: deployment and each round.

import { advisorPerson, raidOdds } from '../../engine/advisors.js';
import { battleView, FORMATIONS, ORDER_NAMES } from '../../engine/battle.js';
import { living, healthWord, canFight } from '../../engine/state.js';
import { $main, state, esc, capitalize, listWords, plural } from '../core.js';

const POSITION_NAMES = {
  left: 'Left flank', center: 'Center', right: 'Right flank', reserve: 'Reserve', out: 'Stay behind',
};

export function raidScreen() {
  const view = battleView(state);
  return view.phase === 'deploy' ? deployScreen(view) : battleRoundScreen(view);
}

export function deployScreen(view) {
  const ev = state.pendingEvent;
  const attack = view.side === 'attack';
  const chief = advisorPerson(state, 'warChief');
  const chiefName = chief ? chief.name : 'your war chief';
  const odds = raidOdds(state, living(state).filter(canFight), ev.warned, ev.raiders);
  const total = view.enemyTotal;
  const sally = Boolean(ev.sally);
  let html = attack
    ? `<h1>March on Skarn hold</h1>
      <p>About ${total} Skarn warriors hold the walls. Choose who goes and where they stand.</p>`
    : sally ? `<h1>Sally out</h1>
      <p>About ${total} Skarn besiege ${esc(state.campName)}. Choose who goes out through the gate to fight them in the open, and where they stand.</p>`
    : `<h1>Raiders!</h1>
      <p class="urgent">${ev.warned
        ? `Scouts spotted ${total} ${esc(view.foe)} heading for ${esc(state.campName)}. There is time to prepare.`
        : `About ${total} ${esc(view.foe)} are at the edge of ${esc(state.campName)}, and they caught you by surprise.`}</p>`;
  html += `<h2>The enemy</h2><ul>${view.enemyLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  if (view.terrain.length) html += `<h2>The ground</h2><ul>${view.terrain.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  html += `<h2>War chief's advice</h2>
    <p>${chief ? `${esc(chief.name)} says: ` : ''}if everyone able fights, we are ${odds.word}. Best formation: ${esc(FORMATIONS[view.suggestedFormation].toLowerCase())}.</p>
    <h2>Quick choices</h2>
    <div class="actions">
      <button type="button" class="primary" data-action="battleAuto">Let ${esc(chiefName)} command the battle</button>
      <button type="button" data-action="${attack || sally ? 'callOff' : 'hide'}">${attack ? 'Call off the attack' : sally ? 'Stay behind the walls after all' : 'Hide what you can and flee into the trees. Nobody gets hurt, but the raiders take some food and wood.'}</button>
    </div>
    <h2>Command it yourself</h2>
    <form id="deployForm">
      <p><label for="formation">Formation</label>
        <select id="formation">${Object.entries(FORMATIONS).map(([id, label]) => `<option value="${id}"${id === view.suggestedFormation ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></p>
      <p><button type="button" data-action="applyFormation">Arrange fighters in this formation</button></p>
      <fieldset><legend>Positions</legend>`;
  for (const f of view.fighters) {
    const where = view.plan[f.id] || 'out';
    html += `<p><label for="pos-${f.id}">${esc(f.name)}${f.archer ? ', archer' : ''}, hunting ${f.hunting}, ${healthWord(f.health)}${f.sick ? ', sick' : ''}</label>
      <select id="pos-${f.id}" data-position="${f.id}">${Object.entries(POSITION_NAMES).map(([z, label]) => `<option value="${z}"${z === where ? ' selected' : ''}>${label}</option>`).join('')}</select></p>`;
  }
  html += `</fieldset>
      <p id="deploySummary" aria-live="polite">${esc(positionSummary(view.plan))}</p>
      <div class="actions"><button type="submit" class="primary">Take positions</button></div>
    </form>`;
  return html;
}

export function positionSummary(plan) {
  const counts = { left: 0, center: 0, right: 0, reserve: 0 };
  for (const z of Object.values(plan)) if (z in counts) counts[z] += 1;
  return `Left flank ${counts.left}, center ${counts.center}, right flank ${counts.right}, reserve ${counts.reserve}.`;
}

export function readPositions() {
  const plan = {};
  for (const sel of $main.querySelectorAll('select[data-position]')) plan[sel.dataset.position] = sel.value;
  return plan;
}

export function battleRoundScreen(view) {
  const chief = advisorPerson(state, 'warChief');
  const chiefName = chief ? chief.name : 'your war chief';
  let html = `<h1>Battle, round ${view.round} of ${view.maxRounds}</h1>
    <p>${view.enemyTotal} ${esc(view.foe)} still on the field.${view.loot.food || view.loot.wood ? ` They have carried off ${view.loot.food} food and ${view.loot.wood} wood so far.` : ''}</p>`;
  if (view.lastRound.length) html += `<h2>Last round</h2><ul>${view.lastRound.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  html += '<h2>The field</h2>';
  for (const z of view.zones) {
    html += `<h3>${esc(capitalize(z.name))}</h3>
      <p>${z.people.length ? `Yours: ${esc(listWords(z.people))}, ${esc(z.odds)}.` : 'None of yours.'} Enemy: ${z.enemy || 'none'}${z.enemyArchers ? `, ${z.enemyArchers === 1 ? '1 of them an archer' : `${z.enemyArchers} of them archers`}` : ''}.${z.breached ? ' The defenses are broken here.' : ''}</p>`;
  }
  html += `<h3>Reserve</h3><p>${view.reserve.length ? esc(listWords(view.reserve)) : 'Empty.'}</p>`;
  if (view.terrain.length) html += `<details><summary>The ground</summary><ul>${view.terrain.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
  html += `<h2>War chief's advice</h2><p>${esc(chiefName)} suggests: ${esc(view.adviceText || 'hold steady')}.</p>
    <form id="ordersForm"><fieldset><legend>Orders for this round</legend>`;
  for (const z of view.zones.filter((x) => x.orders.length)) {
    html += `<p><label for="order-${z.zone}">${esc(capitalize(z.name))}, ${plural(z.people.length, 'fighter', 'fighters')}</label>
      <select id="order-${z.zone}" data-zone="${z.zone}">${z.orders.map((o) => `<option value="${o}"${view.advice[z.zone] === o ? ' selected' : ''}>${esc(ORDER_NAMES[o])}</option>`).join('')}</select></p>`;
  }
  if (view.reserve.length) {
    const opts = [['stay', 'Stay in reserve'], ...view.zones.map((z) => [z.zone, `Join the ${z.name}`])];
    html += `<p><label for="order-reserve">Reserve, ${plural(view.reserve.length, 'fighter', 'fighters')}</label>
      <select id="order-reserve" data-zone="reserve">${opts.map(([v, l]) => `<option value="${v}"${view.advice.reserve === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></p>`;
  }
  html += `</fieldset>
      <div class="actions">
        <button type="submit" class="primary">Give orders</button>
        <button type="button" data-action="battleAuto">Let ${esc(chiefName)} finish the battle</button>
        <button type="button" data-action="battleRetreat">Retreat and abandon the fight</button>
      </div>
    </form>`;
  return html;
}
