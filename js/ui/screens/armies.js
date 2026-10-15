// The Armies screen (your armies, raising a new one, and war and peace) and
// the Army screen, which shows one army at a time: its orders, companies,
// commander, and supply.

import {
  KINDS, STANCES, STANCE_ORDER, ARMY_ORDERS, TRAITS, COMPANY_SIZE, FOES,
} from '../../engine/armyData.js';
import {
  armies, armyById, armyLine, supplyLine, companyLine, commanderChoices, commanderWords, commanderTrait,
  raiseSources, availableKinds, raiseCost, costWords, armyBlocker, trainingNow, TRAINING_NAMES, marchTargets,
  marchSeasons, orderBlocker, regionName, inSupply, soldierWorth, lowerFirst,
} from '../../engine/armies.js';
import {
  warStatusLines, warCostWords, warBlocker, peaceOptions, stormOdds,
} from '../../engine/war.js';
import { oddsPhrase } from '../../engine/field.js';
import { hasKnowledge } from '../../engine/state.js';
import {
  state, armyId, esc, plural, capitalize,
} from '../core.js';

function kindOptions(selected = null) {
  return availableKinds(state).map((k) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(KINDS[k].name)}, for ${esc(costWords(raiseCost(state, k)))}</option>`).join('');
}

function sourceOptions() {
  return raiseSources(state).map((src) => `<option value="${src.from}">${esc(src.name)}, which can spare ${src.spare}</option>`).join('');
}

function worthText() {
  const training = trainingNow(state);
  const worth = soldierWorth(state, { training, iron: false });
  return `New companies are ${TRAINING_NAMES[training]}: each soldier is worth ${worth.toFixed(1)} times an ordinary raider${training === 'standing' ? ', and each company costs 2 coin a season' : ''}.`;
}

export function armiesScreen() {
  const list = armies(state);
  let html = `<h1>Armies</h1>
    <p>Armies are raised from the capital and the settlements, in companies of up to ${COMPANY_SIZE}, under a commander. They march across the regions, live on the food they carry, and fight in the field. The war chief still commands at home.</p>
    <h2 id="armiesHeading">Your armies (${list.length})</h2>`;
  if (list.length) {
    html += `<ul class="plain">${list.map((a) => `<li class="card"><p><button type="button" data-action="openArmy" data-army="${a.id}">${esc(a.name)}</button> ${esc(armyLine(state, a, { named: false }))}</p></li>`).join('')}</ul>`;
  } else {
    html += '<p>You have no armies.</p>';
  }
  html += '<h2 id="raiseHeading">Raise an army</h2>';
  const why = armyBlocker(state);
  const leaders = commanderChoices(state).slice(0, 12);
  const sources = raiseSources(state);
  if (why) html += `<p>${esc(why)}</p>`;
  else if (!sources.length) html += `<p>No one can spare a company now. ${esc(state.campName)} keeps at least 30 people, and a settlement can send at most ${hasKnowledge(state, 'levies') ? 'half' : 'three in ten'} of its people.</p>`;
  else if (!leaders.length) html += '<p>No one in the capital is fit to command.</p>';
  else {
    html += `<form id="raiseArmyForm">
      <p>${esc(worthText())}</p>
      <p><label for="armyCommander">Commander</label>
        <select id="armyCommander">${leaders.map((p) => `<option value="${p.id}">${esc(commanderWords(p))}: ${esc(TRAITS[commanderTrait(p)].about)}</option>`).join('')}</select></p>
      <p><label for="armyKind">First company</label>
        <select id="armyKind">${kindOptions()}</select></p>
      <p><label for="armyFrom">Raised from</label>
        <select id="armyFrom">${sourceOptions()}</select></p>
      <p class="muted">The army gathers in the valley, and fills its packs from your stores. You have ${state.resources.food} food, ${state.resources.wood} wood, ${state.resources.goods || 0} goods${state.resources.horses ? `, ${state.resources.horses} horses` : ''}, and ${state.resources.stone || 0} stone.</p>
      <div class="actions"><button type="submit" class="primary">Raise the army</button></div>
    </form>`;
  }
  html += '<h2 id="warsHeading">War and peace</h2>';
  const wars = warStatusLines(state);
  if (!wars.length) html += '<p>Your people know no one to make war on yet.</p>';
  for (const w of wars) {
    html += `<h3 id="war-${w.id}">${esc(w.name)}</h3>`;
    if (w.atWar) {
      html += `<p>${esc(w.line)}</p>`;
      const options = peaceOptions(state, w.id);
      const open = options.filter((o) => !o.why);
      html += `<form id="peaceForm-${w.id}" data-peace="${w.id}"><fieldset><legend>Terms of peace</legend>
        ${open.map((o, i) => `<label class="choice"><input type="radio" name="peace-${w.id}" value="${o.id}"${i === 0 ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}
        ${options.filter((o) => o.why).map((o) => `<p class="muted">Not yet: ${esc(o.label)}${/\.$/.test(o.label) ? '' : '.'} ${esc(o.why)}</p>`).join('')}
        </fieldset>
        ${open.length ? '<div class="actions"><button type="submit">Offer peace on these terms</button></div>' : ''}
      </form>`;
    } else {
      html += `<p>At peace. ${esc(warCostWords(state, w.id))}</p>`;
      const block = warBlocker(state, w.id);
      html += block ? `<p>${esc(block)}</p>` : `<div class="actions"><button type="button" data-action="declareWar" data-foe="${w.id}">Declare war on ${esc(FOES[w.id].name)}</button></div>`;
    }
  }
  return html;
}

function orderChoices(army) {
  const out = [];
  for (const id of Object.keys(ARMY_ORDERS)) {
    if (id === 'march') {
      if (marchTargets(state, army).length) out.push(id);
      continue;
    }
    if (!orderBlocker(state, army, id)) out.push(id);
  }
  return out;
}

export function armyScreen() {
  const army = armyById(state, armyId);
  if (!army) return '<h1>Army</h1><p>That army is no more.</p><div class="actions"><button type="button" data-nav="armies">Back to Armies</button></div>';
  let html = `<h1>${esc(army.name)}</h1>
    <p>${esc(armyLine(state, army, { named: false }))}</p>
    <p>${esc(supplyLine(state, army))}${army.hungry ? ' It went hungry last season.' : ''}</p>`;
  // Orders.
  html += '<h2 id="armyOrdersHeading">Orders</h2>';
  const choices = orderChoices(army);
  const targets = marchTargets(state, army);
  html += `<form id="armyOrderForm" data-army="${army.id}">
    <p><label for="armyOrder">Order</label>
      <select id="armyOrder">${choices.map((id) => `<option value="${id}"${(army.march ? 'march' : army.order) === id ? ' selected' : ''}>${esc(ARMY_ORDERS[id].name)}: ${esc(ARMY_ORDERS[id].about)}</option>`).join('')}</select></p>
    ${targets.length ? `<p><label for="armyMarchTo">Where to march, if marching</label>
      <select id="armyMarchTo">${targets.map((id) => `<option value="${id}"${army.march && army.march.to === id ? ' selected' : ''}>${esc(capitalize(regionName(id)))}: about ${plural(marchSeasons(state, army, id) || 0, 'season', 'seasons')}${inSupply(state, id) ? '' : ', beyond your supply'}</option>`).join('')}</select></p>` : ''}
    <div class="actions"><button type="submit" class="primary">Give the order</button></div>
  </form>`;
  if (army.siege && !army.march) {
    const odds = stormOdds(state, army);
    html += `<p>${odds == null ? '' : esc(`${army.commander ? army.commander.name : 'Your captains'} thinks a storm now is ${oddsPhrase(odds)}.`)}</p>
      <div class="actions"><button type="button" data-action="stormHome" data-army="${army.id}">Storm ${esc(FOES[army.siege.foe].homeName)}</button></div>`;
  }
  html += `<h2 id="armyStanceHeading">When a battle comes</h2>
    <p><label for="armyStance">Battle stance</label>
      <select id="armyStance" data-army-stance="${army.id}">${STANCE_ORDER.map((id) => `<option value="${id}"${army.stance === id ? ' selected' : ''}>${esc(STANCES[id].name)}: ${esc(STANCES[id].about)}</option>`).join('')}</select></p>`;
  // Companies.
  html += `<h2 id="companiesHeading">Companies (${army.companies.length})</h2>
    <ul class="plain">${army.companies.map((c) => `<li class="card"><p>${esc(companyLine(state, c))}</p>
      <p><button type="button" data-action="disbandCompany" data-army="${army.id}" data-company="${c.id}">Send the ${esc(lowerFirst(c.name))} home</button></p></li>`).join('')}</ul>`;
  const sources = raiseSources(state);
  html += '<h2 id="addCompanyHeading">Raise another company</h2>';
  if (!sources.length) html += '<p>No one can spare a company now.</p>';
  else {
    html += `<form id="addCompanyForm" data-army="${army.id}">
      <p class="muted">New companies join in the valley, or in the region of the settlement that raises them. ${esc(worthText())}</p>
      <p><label for="companyKind">Kind</label><select id="companyKind">${kindOptions()}</select></p>
      <p><label for="companyFrom">Raised from</label><select id="companyFrom">${sourceOptions()}</select></p>
      <div class="actions"><button type="submit">Raise the company</button></div>
    </form>`;
  }
  // The commander.
  html += '<h2 id="commanderHeading">Commander</h2>';
  html += army.commander
    ? `<p>${esc(commanderWords(army.commander))}, after ${plural(army.commander.command || 0, 'battle', 'battles')}. ${esc(TRAITS[commanderTrait(army.commander)].about)} Skill grows by one for every two battles; each point makes the army fight 4 percent better.</p>`
    : '<p>The army has no commander: its captains lead it as best they can. Appoint one.</p>';
  const leaders = commanderChoices(state).slice(0, 12);
  if (leaders.length) {
    html += `<p><label for="newCommander">${army.commander ? 'Replace them with' : 'Appoint'}</label>
      <select id="newCommander">${leaders.map((p) => `<option value="${p.id}">${esc(commanderWords(p))}</option>`).join('')}</select>
      <button type="button" data-action="armyCommander" data-army="${army.id}">Appoint</button></p>`;
  }
  html += '<div class="actions">';
  if (army.location === 'valley' && !army.march) html += `<button type="button" data-action="disbandArmy" data-army="${army.id}">Disband the ${esc(army.name.toLowerCase())}</button>`;
  html += '<button type="button" data-nav="armies">Back to Armies</button></div>';
  return html;
}
