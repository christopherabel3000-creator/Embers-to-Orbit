// The Advisors screen: advice and standing orders.

import { getAdvice, ADVISOR_ROLES, advisorPerson } from '../../engine/advisors.js';
import { comfortsCost } from '../../engine/goods.js';
import { inVillage } from '../../engine/state.js';
import { state, esc, plural, adviceList } from '../core.js';

export function checkbox(id, checked, label) {
  return `<label class="choice"><input type="checkbox" data-order="${id}"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
}

function ordersFor(role) {
  const o = state.orders;
  if (role === 'steward' && inVillage(state)) {
    const options = [0, 1, 2, 3, 4].map((n) => `<option value="${n}"${o.foodReserve === n ? ' selected' : ''}>${n === 0 ? 'No food order' : plural(n, 'season', 'seasons')}</option>`).join('');
    return `<p>In the village the council sets everyone's work each season, so it covers best work, the fields, winter work, and newcomers.</p>
      <p><label for="order-food">Make sure our food will last at least</label>
      <select id="order-food" data-order="foodReserve">${options}</select></p>
      ${checkbox('harvestFeast', o.harvestFeast, 'Hold a feast once the harvest is in, at the start of winter, if at least 3 seasons of food would be left')}
      ${checkbox('comforts', o.comforts, `Share out goods as comforts each season: 1 goods for every 6 people (${comfortsCost(state)} now). Spirits settle 4 higher. A village of 30 or more that can craft misses them.`)}`;
  }
  if (role === 'healer' && inVillage(state)) {
    return checkbox('autoShelter', o.autoShelter, 'Put a hut at the front of the build queue whenever the shelters are nearly full, behind any building already underway');
  }
  if (role === 'steward') {
    const options = [0, 1, 2, 3, 4].map((n) => `<option value="${n}"${o.foodReserve === n ? ' selected' : ''}>${n === 0 ? 'No food order' : plural(n, 'season', 'seasons')}</option>`).join('');
    return `<p><label for="order-food">Make sure our food will last at least</label>
      <select id="order-food" data-order="foodReserve">${options}</select></p>
      ${checkbox('autoAssign', o.autoAssign, 'At the start of each season, put everyone on their best work, as the button on the People screen does. This also rests the hurt and sick, staffs the fields, and handles winter work and newcomers.')}
      ${checkbox('staffFields', o.staffFields, 'Keep the fields staffed: send people to plant in spring, tend in summer, and harvest in autumn, then send them back to their other work')}
      ${checkbox('harvestFeast', o.harvestFeast, 'Hold a feast once the harvest is in, at the start of winter, if at least 3 seasons of food would be left')}
      ${checkbox('winterForagers', o.winterForagers, 'Foragers hunt during winter, then go back to foraging in spring')}
      ${checkbox('placeNewcomers', o.placeNewcomers, 'Put newcomers to work at what they do best')}`;
  }
  if (role === 'healer') {
    return `${o.autoAssign ? '<p>While the steward is putting everyone on their best work each season, that covers resting the hurt and tending the sick.</p>' : ''}${checkbox('restWhenHurt', o.restWhenHurt, 'Badly hurt people rest until healed, then go back to their work')}
      ${checkbox('autoShelter', o.autoShelter, 'Put a lean-to at the front of the build queue whenever the shelters are nearly full, behind any building already underway')}
      ${checkbox('keepHealer', o.keepHealer, 'Keep someone tending the hurt whenever anyone is hurt')}`;
  }
  if (role !== 'warChief') return '';
  const arms = inVillage(state) ? checkbox('armGuards', o.armGuards, 'Spend 1 goods per guard each season on arms and shields. Armed guards fight a fifth harder.') : '';
  const radio = (value, label) => `<label class="choice"><input type="radio" name="raidPolicy" data-order="raidPolicy" value="${value}"${o.raidPolicy === value ? ' checked' : ''}> ${esc(label)}</label>`;
  return `<fieldset><legend>When raiders come</legend>
    ${radio('ask', 'Ask me every time')}
    ${radio('fightIfLikely', 'Fight if we are likely to win; otherwise ask me')}
    ${radio('auto', 'Decide for me: fight when the odds are even or better, hide when they are not')}
  </fieldset>${arms}`;
}

export function advisorsScreen() {
  const advice = getAdvice(state);
  let html = `<h1>Advisors</h1>
    <p>Your advisors always follow your orders, and they tell you when they think something is going wrong.</p>
    <p>Standing orders are carried out at the start of every season. You can still change anything yourself afterward.</p>`;
  for (const [role, info] of Object.entries(ADVISOR_ROLES)) {
    const person = advisorPerson(state, role);
    if (!person) continue;
    html += `<h2>${esc(info.title)}: ${esc(person.name)}</h2><p class="muted">Watches over ${esc(info.domain)}.</p>`;
    html += adviceList(advice.filter((a) => a.role === role));
    const orders = ordersFor(role);
    if (orders) html += `<h3>${esc(person.name)}'s standing orders</h3>${orders}`;
  }
  return html;
}
