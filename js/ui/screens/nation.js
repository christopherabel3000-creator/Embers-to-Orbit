// The Nation screen (every settlement on one line) and the Settlement
// screen, which drills into one of them.

import { ADVISOR_ROLES } from '../../engine/advisors.js';
import { SKILLS, placeData, NEIGHBORS } from '../../engine/data.js';
import { taxRate } from '../../engine/laws.js';
import { soldiersFromTown } from '../../engine/armies.js';
import {
  ROLES, ROLE_ORDER, DEMANDS, DEMAND_ORDER, TOWN_PRIORITIES, MAKER_NAMES, homeRoom,
  settlementById, townGroups, expectedShipment, governorFactor, governorSkill, loyaltyWord, loyaltyTarget,
  landFit, bestRole, roleAvailable, hasRoad, far, keepingAll, worksLevel, garrisonHelp, nationPopulation, UNROADED_LOSS, LOYALTY_BASE,
  wagesDue, wagesPaid,
} from '../../engine/realm.js';
import {
  settlementBlocker, governorCandidates, aidCost, aidBlocker, projectName, projectWork,
} from '../../engine/settlements.js';
import { living, placeName, year, hasKnowledge } from '../../engine/state.js';
import {
  state, townId, esc, capitalize, plural,
} from '../core.js';

// What a settlement sends home, or does instead, in a sentence.
function sendsText(t) {
  if (keepingAll(state, t)) return 'It keeps all it makes until next year, as you allowed.';
  if (t.role === 'fortress') {
    const g = townGroups(state, t);
    return `Its garrison of ${plural(g.guards, 'soldier', 'soldiers')} would send ${garrisonHelp(state, t)} to meet raiders on the road to ${state.campName}.`;
  }
  const ship = expectedShipment(state, t);
  return `It sends home about ${ship.amount} ${ship.kind} a season${ship.lost ? `, and ${ship.lost} more is lost on the way for want of a road` : ''}.`;
}

function townLine(t) {
  const g = t.governor;
  return `${ROLES[t.role].name}, ${plural(t.population, 'person', 'people')}, ${loyaltyWord(t.loyalty)} (loyalty ${t.loyalty}), governed by ${g ? g.name : 'no one'}. ${sendsText(t)}`;
}

export function nationScreen() {
  const towns = state.settlements || [];
  const capitalPeople = living(state).length;
  const why = settlementBlocker(state);
  const roads = state.buildings.road || 0;
  let html = `<h1>Nation</h1>
    <p>${plural(nationPopulation(state, capitalPeople), 'person', 'people')} in ${plural(towns.length + 1, 'settlement', 'settlements')}. ${esc(state.campName)} is your capital. Each other settlement runs itself under its governor, guided by the role and priorities you set on its screen.</p>
    <h2>Settlements (${towns.length + 1})</h2>
    <ul class="plain">
      <li class="card"><p><button type="button" data-nav="people">${esc(state.campName)}</button> The capital: ${plural(capitalPeople, 'person', 'people')}, run by the council. Its priorities are on the Village screen.</p></li>
      ${towns.map((t) => `<li class="card"><p><button type="button" data-action="openTown" data-town="${t.id}">${esc(t.name)}</button> ${esc(townLine(t))}</p></li>`).join('')}
    </ul>
    <h2 id="newTownHeading">A new settlement</h2>
    <p>${why ? esc(why) : 'Your nation is ready to found another settlement, on a place it holds.'}</p>
    ${why ? '' : '<div class="actions"><button type="button" data-nav="foundSettlement">Plan a new settlement</button></div>'}`;
  if (towns.length && (hasKnowledge(state, 'coinage') || taxRate(state))) {
    const due = wagesDue(state);
    html += `<h2>The treasury</h2><p>Coin: ${state.resources.coin || 0}.${due ? ` Paying the governors costs ${due} coin a season, 1 each; paid governors' settlements are 5 more loyal.${wagesPaid(state) ? ' They were paid last season.' : ' They went unpaid last season.'}` : ''} ${taxRate(state) ? `Taxes bring in 1 coin a season for every ${taxRate(state)} people, at a cost in loyalty and spirits.` : hasKnowledge(state, 'taxes') ? 'There are no taxes; a law on taxes can be made on the Village screen.' : ''}</p>`;
  }
  if (towns.length) {
    html += `<h2>Roads</h2><p>${roads >= towns.length ? 'Every settlement has a road to the capital.' : `${roads ? `${roads} of ${towns.length} settlements ${roads === 1 ? 'has' : 'have'}` : 'No settlement has'} a road to the capital. ${hasKnowledge(state, 'roads') ? 'Roads are built on the Build screen, in the order the settlements were founded.' : 'Your people could learn to build them: see Roads on the Knowledge screen.'} Without one, a settlement two or more places away loses ${Math.round(UNROADED_LOSS * 100)} percent of what it sends home on the way.`}</p>`;
  }
  return html;
}

function select(id, data, options, current, aboutId) {
  return `<select id="${id}" ${data} aria-describedby="${aboutId}">${options.map(([value, label]) => `<option value="${value}"${value === current ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
}

// ", where they are steward" for a council member in the capital.
function councilPost(p) {
  const post = Object.entries(ADVISOR_ROLES).find(([role]) => state.advisors[role] === p.id);
  return post ? `, where ${p.name} is ${post[1].title.toLowerCase()}; another would take the post` : '';
}

function notableRow(p) {
  const best = SKILLS.filter((k) => p.skills[k] >= 3).sort((a, b) => p.skills[b] - p.skills[a]);
  return `${p.name}, ${p.age}${best.length ? `: ${best.map((k) => `${k} ${p.skills[k]}`).join(', ')}` : ''}.`;
}

function landText(t) {
  const best = bestRole(t.place);
  const fit = landFit(t.role, t.place);
  const fitWord = fit >= 1.2 ? 'suits it well' : fit >= 1 ? 'suits it' : 'suits it poorly';
  return `${placeName(state, t.place)} ${fitWord}${best !== t.role ? `; the land is best for a ${ROLES[best].name.toLowerCase()}` : ''}.`;
}

export function settlementScreen() {
  const t = settlementById(state, townId);
  if (!t) return '<h1>Settlement</h1><p>That settlement is gone.</p><p><button type="button" data-nav="nation">Back to the Nation screen</button></p>';
  const g = townGroups(state, t);
  const gov = t.governor;
  const skill = governorSkill(t);
  const { target, reasons } = loyaltyTarget(state, t);
  const roleOptions = ROLE_ORDER.filter((r) => roleAvailable(state, r, t.place) || r === t.role).map((r) => [r, ROLES[r].name]);
  const candidates = governorCandidates(state, t);
  let html = `<h1>${esc(t.name)}</h1>
    <p>A ${esc(ROLES[t.role].name.toLowerCase())} at ${esc(placeName(state, t.place))}, founded in Year ${year(state, t.founded - state.turn)}: ${plural(t.population, 'person', 'people')}, ${loyaltyWord(t.loyalty)} (loyalty ${t.loyalty}).</p>
    <p>${esc(sendsText(t))} ${esc(landText(t))}</p>
    ${t.federated ? `<p>Home of ${esc(NEIGHBORS[t.federated].name)}, who joined your nation as a free people. They will not bear heavy demands.</p>` : ''}
    <h2>Role and demands</h2>
    <p><label for="townRole">Role</label>
      ${select('townRole', `data-town-role="${t.id}"`, roleOptions, t.role, 'townRole-about')}
      <span id="townRole-about" class="muted"> ${esc(ROLES[t.role].about)}</span></p>
    <p><label for="townDemands">Demands</label>
      ${select('townDemands', `data-town-demands="${t.id}"`, DEMAND_ORDER.filter((d) => !(t.federated && d === 'heavy')).map((d) => [d, DEMANDS[d].name]), t.demands, 'townDemands-about')}
      <span id="townDemands-about" class="muted"> ${esc(DEMANDS[t.demands].about)}</span></p>
    <h2>Priorities</h2>
    ${Object.entries(TOWN_PRIORITIES).map(([area, info]) => `<p><label for="townPriority-${area}">${esc(info.name)}</label>
      ${select(`townPriority-${area}`, `data-town-priority="${area}" data-town="${t.id}"`, ['low', 'normal', 'high'].map((l) => [l, capitalize(l)]), t.priorities[area], `townPriority-${area}-about`)}
      <span id="townPriority-${area}-about" class="muted"> ${esc(info.about)}</span></p>`).join('')}
    <h2 id="governorHeading">Governor</h2>
    <p>${esc(gov.name)}, ${gov.age}: ${skill} ${gov.skills[skill]}, learning ${gov.skills.learning}. Governing since Year ${year(state, t.governorSince - state.turn)}. A ${esc(ROLES[t.role].name.toLowerCase())} needs a governor skilled in ${skill} and learning: under ${esc(gov.name)} it brings in ${Math.round(governorFactor(t, state) * 100)} percent, where a novice would get 85 and a master of both 130. Governors grow more skilled with every season.</p>`;
  if (candidates.length) {
    html += `<p><label for="newGovernor">Another governor</label>
      <select id="newGovernor">${candidates.map((p) => `<option value="${p.id}">${esc(notableRow(p))}${t.notables.includes(p) ? ` Lives in ${esc(t.name)}.` : ` Lives in ${esc(state.campName)}${councilPost(p)}.`}</option>`).join('')}</select></p>
      <p><button type="button" data-action="appointGovernor" data-town="${t.id}">Make them governor of ${esc(t.name)}</button></p>
      <p class="muted">${esc(gov.name)} would come home to ${esc(state.campName)}. A loyal settlement misses its old governor; a discontent one welcomes the change.</p>`;
  }
  html += `<h2 id="loyaltyHeading">Loyalty</h2>
    <p>Loyalty ${t.loyalty}, ${loyaltyWord(t.loyalty)}. Each season it moves a quarter of the way toward ${target}: a base of ${LOYALTY_BASE}${reasons.length ? ', changed by these' : ', with nothing to change it'}.</p>
    ${reasons.length ? `<ul>${reasons.map(([text, n]) => `<li>${esc(capitalize(text))}: ${n > 0 ? 'plus' : 'minus'} ${Math.abs(n)}.</li>`).join('')}</ul>` : ''}
    <p class="muted">Devoted settlements (75 or more) send home a tenth more; restless ones (below 55) 15 percent less; discontent ones (below 40) 40 percent less, and grow half as fast. Below 20, a settlement defies you.</p>
    <h3>Aid</h3>
    <p>Once a year, aid from the capital lifts its loyalty by 10, and its people stop feeling neglected.</p>`;
  const aid = ['food', 'goods'].map((kind) => [kind, aidBlocker(state, t, kind)]);
  const wait = aid.find(([, why]) => why && /this past year/.test(why));
  if (wait) html += `<p>${esc(wait[1])}</p>`;
  else {
    html += `<div class="actions">${aid.filter(([, why]) => !why).map(([kind]) => `<button type="button" data-action="sendAid" data-town="${t.id}" data-kind="${kind}">Send ${aidCost(t, kind)} ${kind}</button>`).join('')}</div>`;
    for (const [, why] of aid.filter(([, w]) => w)) html += `<p>${esc(why)}</p>`;
  }
  const groupRows = [
    [MAKER_NAMES[t.role], g.makers], ['Guards', g.guards], ['Scholars', g.scholars], ['Healers', g.healers], ['Builders', g.builders], ['Children and elders', g.young],
  ].filter(([, n]) => n > 0);
  const soldiers = soldiersFromTown(state, t);
  html += `<h2>Groups</h2><ul>${groupRows.map(([name, n]) => `<li>${esc(name)}: ${n}.</li>`).join('')}${soldiers ? `<li>Away with your armies: ${soldiers}.</li>` : ''}</ul>`;
  const b = t.buildings;
  const level = worksLevel(t);
  const built = [
    `Homes: ${b.homes}, room for ${b.homes * homeRoom(state)}.`,
    b.stoneWall ? 'A stone wall.' : b.palisade ? 'A palisade.' : 'No walls yet.',
    `${capitalize(ROLES[t.role].works)}: ${level ? `level ${level} of 3, ${level * 15} percent more from its role` : 'not yet built'}.`,
    b.hall ? 'A hall, where its people gather: loyalty 5 higher.' : null,
    b.keep ? 'A stone keep: its soldiers do half again as much, and it holds out far longer against a host.' : null,
    hasRoad(state, t) ? `A road to ${state.campName}.` : far(t) ? `No road to ${state.campName}.` : null,
  ].filter(Boolean);
  html += `<h2>Buildings</h2><ul>${built.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p>${t.project ? `Now building ${esc(projectName(t, t.project.id))}: ${Math.floor(t.project.progress)} of ${projectWork(t, t.project.id)} work done.` : 'The governor has nothing to build right now.'} The governor builds homes as it grows, walls, its works, and a hall.</p>`;
  html += `<h2>Notable people (${t.notables.length + 1})</h2>
    <ul><li>${esc(notableRow(gov))} Governor.</li>${t.notables.map((p) => `<li>${esc(notableRow(p))}</li>`).join('')}</ul>
    <p class="muted">${esc(placeData(t.place).description)}</p>
    <div class="actions"><button type="button" data-nav="nation">Back to the Nation screen</button></div>`;
  return html;
}
