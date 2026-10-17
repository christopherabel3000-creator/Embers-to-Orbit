// The Village screen: council priorities, groups by work, laws, hiring, and
// other settlements.

import {
  TASK_ORDER, SKILLS, PRIORITY_AREAS, PRIORITY_LEVELS, LAWS, LAW_ORDER, FOOD_STORE_CHOICES,
} from '../../engine/data.js';
import {
  hireBlocker, swordsBlocker, swordsActive, HIRE_MASTER_COST, SWORDS_COST, SWORDS_COUNT, HIRE_MASTER_COIN, SWORDS_COIN,
} from '../../engine/goods.js';
import {
  inviteBlocker, inviteAffordable, inviteCost, INVITE_FOOD_SEASONS, INVITE_PER,
} from '../../engine/invite.js';
import { lawsAvailable, lawAvailable, seasonsUntilChange } from '../../engine/laws.js';
import {
  living, shelterCapacity, foodNeeded, hasKnowledge, eraAtLeast, lifeStage, taskAvailable, foodStoreTarget, foodStocked,
} from '../../engine/state.js';
import { groups, notablePeople, GROUP_NAMES } from '../../engine/village.js';
import {
  state, esc, capitalize, plural, listWords,
} from '../core.js';
import { advisorTitleFor, workSitesSentence, farmSentence, personStatus } from '../screens/people.js';

function settlementLines() {
  const list = state.settlements || [];
  if (!list.length) return '';
  return `<h2 id="settlementsHeading">Other settlements (${list.length})</h2>
    <p>${esc(listWords(list.map((t) => t.name)))} ${list.length === 1 ? 'runs itself' : 'run themselves'} under ${list.length === 1 ? 'its governor' : 'their governors'}. Set their roles and priorities on the Nation screen.</p>
    <div class="actions"><button type="button" data-nav="nation">Nation</button></div>`;
}

function priorityControl(area) {
  const info = PRIORITY_AREAS[area];
  const current = state.priorities[area] || 'normal';
  const options = PRIORITY_LEVELS.map((lvl) => `<option value="${lvl}"${lvl === current ? ' selected' : ''}>${capitalize(lvl)}</option>`).join('');
  return `<p><label for="priority-${area}">${esc(info.name)}</label>
    <select id="priority-${area}" data-priority="${area}" aria-describedby="priority-${area}-about">${options}</select>
    <span id="priority-${area}-about" class="muted"> ${esc(info.about)}</span></p>`;
}

// How much food the council keeps before spare hands turn to building and crafts.
function foodStoresControl() {
  const current = state.foodStores ?? 8;
  const options = FOOD_STORE_CHOICES.map((c) => `<option value="${c}"${c === current ? ' selected' : ''}>${c === 'full' ? 'As much as the stores hold' : `About ${c} seasons`}</option>`).join('');
  const need = foodNeeded(living(state));
  const food = state.resources.food;
  const seasons = need ? Math.floor(food / need) : 0;
  const status = foodStocked(state)
    ? 'The stores are full enough: the council sows only what they need, and spare hands build and make goods.'
    : 'Below that, the council plants the fields to fill them, and spare hands gather food.';
  return `<p><label for="foodStores">Food stores</label>
    <select id="foodStores" data-food-stores aria-describedby="foodStores-about">${options}</select>
    <span id="foodStores-about" class="muted"> How much food the council keeps before it stops growing more. Now ${food} food, about ${plural(seasons, 'season', 'seasons')}; it aims for ${foodStoreTarget(state)}. ${status}</span></p>`;
}

function lawEffectText(law) {
  const option = state.laws[law];
  return option ? LAWS[law].options[option].effect : 'Keeping to custom: no special effect.';
}

function lawControl(law) {
  const def = LAWS[law];
  const current = state.laws[law] || '';
  const wait = seasonsUntilChange(state, law);
  const options = [['', 'Keep to custom'], ...Object.entries(def.options).map(([key, o]) => [key, o.name])]
    .map(([key, name]) => `<option value="${key}"${key === current ? ' selected' : ''}>${esc(name)}</option>`).join('');
  return `<p><label for="law-${law}">${esc(def.name)}</label>
    <select id="law-${law}" data-law="${law}" aria-describedby="law-${law}-about">${options}</select>
    <span id="law-${law}-about" class="muted"> ${esc(lawEffectText(law))}${wait ? ` It can change again in ${plural(wait, 'season', 'seasons')}.` : ''}</span></p>`;
}

const MASTER_NAMES = {
  hunting: 'A master hunter', foraging: 'A master forager', building: 'A master builder',
  healing: 'A master healer', scouting: 'A master scout', learning: 'A master scholar',
};

function hireSection() {
  const goods = state.resources.goods || 0;
  if (!taskAvailable(state, 'craft') && !goods) return '';
  const coin = hasKnowledge(state, 'coinage');
  // Hire buttons, in goods and, with Coinage, in coin.
  const buttons = (action, blocker, label, goodsCost, coinCost) => {
    const ways = [['goods', goodsCost], ...(coin ? [['coin', coinCost]] : [])];
    const ready = ways.filter(([pay]) => !blocker(state, pay));
    if (!ready.length) return `<p>${esc(blocker(state, 'goods'))}</p>`;
    return `<div class="actions">${ready.map(([pay, n]) => `<button type="button" data-action="${action}" data-pay="${pay}">${esc(label)} for ${n} ${pay}</button>`).join('')}</div>`;
  };
  return `<h2 id="hireHeading">Hire</h2>
    <p>You have ${goods} goods${coin ? ` and ${state.resources.coin || 0} coin` : ''}. ${coin ? 'Goods or coin buy' : 'Goods buy'} help from beyond the hills.</p>
    <p><label for="hireSkill">Hire a master, once a year</label>
      <select id="hireSkill">${SKILLS.map((k) => `<option value="${k}">${esc(MASTER_NAMES[k])}</option>`).join('')}</select></p>
    ${buttons('hireMaster', hireBlocker, 'Hire this master', HIRE_MASTER_COST, HIRE_MASTER_COIN)}
    <p>${SWORDS_COUNT} sell-swords will guard the roads for a year, meeting raiders before they reach the village and harrying besiegers.</p>
    ${swordsActive(state) ? `<p>${esc(swordsBlocker(state))}</p>` : buttons('hireSwords', swordsBlocker, 'Hire the sell-swords', SWORDS_COST, SWORDS_COIN)}`;
}

// In the Nation era, with Coinage: coin pays settlers' passage to the capital.
function inviteSection() {
  if (!eraAtLeast(state, 'nation') || !hasKnowledge(state, 'coinage')) return '';
  const cost = inviteCost(state);
  const order = state.orders.inviteReserve;
  const intro = `<h2 id="inviteHeading">Invite settlers</h2>
    <p>Settlers from beyond the valley will come to ${esc(state.campName)} for ${cost} coin each. The price rises by 1 coin for every ${INVITE_PER} people in the capital. One party can come each season, as many as the homes and stores can take: a spare place in the homes, and ${INVITE_FOOD_SEASONS} seasons of food for everyone. You have ${state.resources.coin || 0} coin.</p>
    <p class="muted">${order == null ? 'Your steward can invite them each season under a standing order on the Advisors screen.' : `Under your standing order, your steward invites them each season, keeping ${order} coin in the treasury.`}</p>`;
  const why = inviteBlocker(state);
  if (why) return `${intro}<p>${esc(why)}</p>`;
  const most = inviteAffordable(state);
  if (most < 1) return `${intro}<p>Each settler's passage costs ${cost} coin.</p>`;
  const options = Array.from({ length: most }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === most ? ' selected' : ''}>${plural(n, 'settler', 'settlers')}, ${n * cost} coin</option>`).join('');
  return `${intro}
    <p><label for="inviteCount">How many to invite this season</label>
      <select id="inviteCount">${options}</select></p>
    <div class="actions"><button type="button" data-action="inviteSettlers">Invite them</button></div>`;
}

function lawsSection() {
  if (!lawsAvailable(state)) {
    return '<h2>Laws</h2><p>Once your people learn Oral law, the village can make laws here.</p>';
  }
  const available = LAW_ORDER.filter((law) => lawAvailable(state, law));
  const choices = available.map((law) => {
    const opts = Object.values(LAWS[law].options);
    return `<li><strong>${esc(LAWS[law].name)}.</strong> ${opts.map((o) => `${esc(o.name)}: ${esc(o.effect)}`).join(' ')}</li>`;
  }).join('');
  return `<h2 id="lawsHeading">Laws</h2>
    <p>Each law can change once a year.${state.buildings.meetingHall > 0 ? ' Your meeting hall lets the village talk changes through, so no one grumbles.' : ' Without a meeting hall, every change makes people grumble, and spirits dip.'}</p>
    ${available.map(lawControl).join('')}
    ${available.length < LAW_ORDER.length ? `<p class="muted">More laws come with Law codes and Taxes, in the Nation era.</p>` : ''}
    <details><summary>What each law does</summary><ul>${choices}</ul></details>`;
}

function groupLine(g) {
  const skill = g.skill && g.avgSkill !== null ? `, average ${g.skill} ${g.avgSkill.toFixed(1)}` : '';
  const hurt = g.hurt ? `, ${g.hurt} badly hurt or sick` : '';
  return `${g.name}: ${g.count}${skill}${hurt}.`;
}

export function villagerRow(p) {
  const role = advisorTitleFor(p);
  const group = GROUP_NAMES[p.task] ? GROUP_NAMES[p.task].toLowerCase().replace(/s$/, '') : p.task;
  const work = lifeStage(p) === 'infant' ? 'too young to work' : p.task === 'rest' ? 'resting' : group;
  const best = SKILLS.filter((k) => p.skills[k] === Math.max(...SKILLS.map((x) => p.skills[x])) && p.skills[k] > 0);
  return `${p.name}${role ? `, ${role}` : ''}: ${work}, ${personStatus(p)}${best.length ? `, best at ${best.join(' and ')} (${p.skills[best[0]]})` : ''}.`;
}

export function villageScreen() {
  const people = living(state);
  const young = people.filter((p) => p.age < 16);
  const g = groups(state);
  const notable = notablePeople(state);
  let html = `<h1>Village</h1>
    <p>${plural(people.length, 'person', 'people')} live in ${esc(state.campName)}${young.length ? `, ${young.length} of them young` : ''}. Food needed this season: ${foodNeeded(people)}. Shelter for ${shelterCapacity(state)}.</p>
    <p>${esc(workSitesSentence())} Change work sites on the Map screen.</p>
    ${hasKnowledge(state, 'farming') ? `<p>${esc(farmSentence())}</p>` : ''}
    <h2 id="prioritiesHeading">Council priorities</h2>
    <p>The council covers the essentials first: tending the hurt, the fields, and firewood for the fires. Then it follows these priorities, and puts everyone else on food and wood by their skill, or on building and crafts once the food stores are full. The food reserve order on the Advisors screen keeps the stores safe.</p>
    ${foodStoresControl()}
    ${Object.keys(PRIORITY_AREAS).map(priorityControl).join('')}
    <p><button type="button" data-action="assignBest">Have the council reassign everyone now</button></p>
    <p class="muted">Otherwise the council reassigns everyone at the start of each season.</p>
    ${lawsSection()}
    ${hireSection()}
    ${inviteSection()}
    ${settlementLines()}
    <h2>Groups (${g.length})</h2>
    <ul>${g.map((x) => `<li>${esc(groupLine(x))}</li>`).join('')}</ul>
    <h2>Notable people (${notable.length})</h2>
    <p class="muted">The council, the village's heroes, and anyone who has mastered a skill.</p>
    <ul>${notable.map((p) => `<li>${esc(villagerRow(p))}</li>`).join('')}</ul>
    ${state.capitalCounted ? `<p class="muted">${esc(state.campName)} counts its people by group now, as your settlements do; only its notable people are named.</p>` : `<details>
      <summary>Everyone in the village (${people.length})</summary>
      <ul>${[...people].sort((a, b) => TASK_ORDER.indexOf(a.task) - TASK_ORDER.indexOf(b.task) || a.name.localeCompare(b.name)).map((p) => `<li>${esc(villagerRow(p))}</li>`).join('')}</ul>
    </details>`}`;
  return html;
}
