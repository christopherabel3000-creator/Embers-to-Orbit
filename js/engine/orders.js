// Standing orders: rules the player sets once, which advisors carry out at
// the start of every season. The player can still change anything after.

import { TASKS, SHELTER_PER_LEAN_TO, SHELTER_PER_HUT } from './data.js';
import {
  living, seasonIndex, canFight, allowedTasksFor, hasKnowledge, shelterNeeded, shelterCapacity, foodNeeded,
  inVillage,
} from './state.js';
import { advisorPerson, ADVISOR_ROLES, forecastFood, raidOdds } from './advisors.js';
import { expectedFood, farmersNeeded } from './rules.js';
import { resolveRaidPlan } from './raid.js';
import { bestWorkPlan } from './assign.js';
import { feastBlocker, feastCost, holdFeast } from './stores.js';
import { moveOffForeignLand } from './nations.js';

function listNames(people) {
  const names = people.map((p) => p.name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function bestTaskFor(person, seasonIdx) {
  const s = person.skills;
  const options = [
    ['hunt', s.hunting],
    ['forage', seasonIdx === 3 ? -1 : s.foraging],
    ['wood', s.building],
    ['heal', s.healing],
    ['scout', s.scouting],
    ['study', s.learning - 0.5], // A tie goes to more practical work.
  ];
  options.sort((a, b) => b[1] - a[1]);
  return options[0][0];
}

// Moves a person for an order, remembering what they were doing.
function moveFor(person, task, reason) {
  if (!person.orderReturn) person.orderReturn = { task: person.task, reason };
  person.task = task;
}

// Puts a person back to their earlier task if the player has not
// changed their assignment in the meantime.
function returnFrom(person, reason, currentTask) {
  if (!person.orderReturn || person.orderReturn.reason !== reason) return false;
  if (person.task !== currentTask) {
    person.orderReturn = null;
    return false;
  }
  person.task = person.orderReturn.task;
  person.orderReturn = null;
  return true;
}

// The harvest feast only goes ahead if this many seasons of food remain.
export const HARVEST_FEAST_RESERVE = 3;

// Returns { urgent: [...], orders: [...] } lines for the season report.
export function applyStandingOrders(state) {
  const orders = state.orders;
  const urgent = [];
  const done = [];
  const say = (role, text) => {
    const p = advisorPerson(state, role);
    const who = p ? `${p.name}, ${ADVISOR_ROLES[role].title.toLowerCase()}` : `Your ${ADVISOR_ROLES[role].title.toLowerCase()}`;
    done.push(`${who}: ${text}`);
  };
  const s = seasonIndex(state);

  // Raids first, so anyone wounded is then handled by the healer's orders.
  const ev = state.pendingEvent;
  if (ev && ev.type === 'raid' && orders.raidPolicy !== 'ask') {
    const able = living(state).filter(canFight);
    const odds = raidOdds(state, able, ev.warned, ev.raiders);
    let plan = null;
    if (orders.raidPolicy === 'fightIfLikely' && odds.chance >= 0.75) plan = 'fight';
    if (orders.raidPolicy === 'auto') plan = odds.chance >= 0.5 && able.length ? 'fight' : 'hide';
    if (plan) {
      const result = resolveRaidPlan(state, plan, able.map((p) => p.id));
      if (!result.error) {
        const chief = advisorPerson(state, 'warChief');
        urgent.push(`${chief ? chief.name : 'Your war chief'} followed your standing orders and chose to ${plan === 'fight' ? `fight with ${able.length} defenders` : 'hide'}.`);
        urgent.push(...result.lines);
      }
    } else {
      say('warChief', 'the odds are not clearly in our favor, so the raid response is up to you.');
    }
  }
  if (state.gameOver) return { urgent, orders: done };

  const people = living(state);

  // Speaker: the council keeps work off land another people holds, before
  // it sets anyone's work, so the season is planned on land it can use.
  const moved = moveOffForeignLand(state);
  if (moved) say('speaker', moved);

  // Steward: put newcomers to work at what they do best.
  const newcomers = people.filter((p) => p.isNew);
  for (const p of newcomers) delete p.isNew;
  if (orders.placeNewcomers && !orders.autoAssign) {
    for (const p of newcomers.filter((x) => x.task === 'rest')) {
      p.task = bestTaskFor(p, s);
      say('steward', `put ${p.name} to work: ${TASKS[p.task].name.toLowerCase()}.`);
    }
  }

  if (orders.autoAssign || inVillage(state)) {
    // Steward: everyone to their best work. This covers resting the hurt,
    // tending the sick, winter work, and newcomers, so those orders wait.
    const plan = bestWorkPlan(state);
    let changed = 0;
    for (const [id, task] of plan) {
      const p = people.find((x) => x.id === id);
      if (p.task !== task) changed += 1;
      p.task = task;
      p.orderReturn = null;
    }
    if (changed) {
      say('steward', inVillage(state)
        ? `the council set everyone's work for the season; ${changed} changed jobs.`
        : `put everyone on their best work for the season; ${changed} changed jobs.`);
    }
  } else {
    // Healer: the badly hurt rest until they are healthy again.
    const backToWork = people.filter((p) => p.health >= 75 && returnFrom(p, 'hurt', 'rest'));
    if (backToWork.length) say('healer', `${listNames(backToWork)} ${backToWork.length === 1 ? 'has' : 'have'} recovered and gone back to work.`);
    if (orders.restWhenHurt) {
      const sent = people.filter((p) => p.health < 40 && p.task !== 'rest' && p.age >= 5);
      for (const p of sent) moveFor(p, 'rest', 'hurt');
      if (sent.length) say('healer', `sent ${listNames(sent)} to rest until healed.`);
    }

    // Steward: foragers and farmers hunt in winter, then go back in spring.
    if (s === 0) {
      const back = people.filter((p) => returnFrom(p, 'winter', 'hunt'));
      if (back.length) say('steward', `${listNames(back)} went back to the fields and foraging grounds now that spring has come.`);
    }
    if (orders.winterForagers && s === 3) {
      const idle = people.filter((p) => p.task === 'forage' || p.task === 'farm');
      for (const p of idle) moveFor(p, 'hunt', 'winter');
      if (idle.length) say('steward', `nothing grows in winter, so ${listNames(idle)} will hunt until spring.`);
    }

    // Healer: keep someone tending the hurt while anyone is hurt.
    const anyoneHurt = people.some((p) => p.health < 75 || p.sick);
    if (!anyoneHurt) {
      const freed = people.filter((p) => returnFrom(p, 'healer', 'heal'));
      if (freed.length) say('healer', `no one needs tending, so ${listNames(freed)} went back to ${TASKS[freed[0].task].name.toLowerCase()}.`);
    } else if (orders.keepHealer && !people.some((p) => p.task === 'heal')) {
      const candidate = people
        .filter((p) => p.health >= 40 && p.task !== 'rest' && p.age >= 12)
        .sort((a, b) => b.skills.healing - a.skills.healing)[0];
      if (candidate) {
        moveFor(candidate, 'heal', 'healer');
        say('healer', `${candidate.name} will tend the hurt.`);
      }
    }

    // Steward: move people to and from the fields as the year requires.
    if (orders.staffFields && hasKnowledge(state, 'farming')) {
      const need = farmersNeeded(state);
      const farmers = people.filter((p) => p.task === 'farm');
      const work = ['planting', 'tending the grain', 'the harvest'][s] || '';
      if (farmers.length > need) {
        const extra = [...farmers]
          .sort((a, b) => Number(b.orderReturn?.reason === 'fields') - Number(a.orderReturn?.reason === 'fields'))
          .slice(0, farmers.length - need);
        for (const p of extra) {
          if (returnFrom(p, 'fields', 'farm')) continue;
          const fallback = s === 3 ? 'hunt' : 'forage';
          p.task = allowedTasksFor(state, p).includes(fallback) ? fallback : 'rest';
        }
        say('steward', `${listNames(extra)} ${extra.length === 1 ? 'is' : 'are'} not needed in the fields this season and went back to other work.`);
      } else if (farmers.length < need) {
        const from = { forage: 0, rest: 1, wood: 2, scout: 3 };
        const candidates = people
          .filter((p) => p.task in from && p.health >= 40 && !p.sick && allowedTasksFor(state, p).includes('farm')
            && !(p.orderReturn && p.orderReturn.reason === 'hurt'))
          .sort((a, b) => b.skills.foraging - a.skills.foraging || from[a.task] - from[b.task])
          .slice(0, need - farmers.length);
        for (const p of candidates) moveFor(p, 'farm', 'fields');
        if (candidates.length) say('steward', `sent ${listNames(candidates)} to the fields for ${work}.`);
      }
    }
  }

  // Healer: keep shelter in the build queue when the shelters are nearly full.
  // A village builds huts; a camp builds lean-tos.
  if (orders.autoShelter) {
    const coming = state.buildQueue.filter((item) => item.id === 'leanTo').length * SHELTER_PER_LEAN_TO
      + state.buildQueue.filter((item) => item.id === 'hut').length * SHELTER_PER_HUT;
    if (shelterNeeded(people) + 2 > shelterCapacity(state) + coming) {
      const id = inVillage(state) ? 'hut' : 'leanTo';
      // Ahead of everything not yet started, but behind work already underway.
      const at = state.buildQueue.findIndex((item) => !item.paid);
      state.buildQueue.splice(at === -1 ? state.buildQueue.length : at, 0, { id, progress: 0, paid: false });
      say('healer', `the shelters are nearly full, so a ${id === 'hut' ? 'hut' : 'lean-to'} went to the front of the build queue.`);
    }
  }

  // Steward: a feast after the harvest, when there is food to spare.
  if (orders.harvestFeast && s === 3 && !feastBlocker(state)) {
    const cost = feastCost(state);
    if (state.resources.food - cost >= foodNeeded(people) * HARVEST_FEAST_RESERVE) {
      holdFeast(state);
      say('steward', `the harvest is in, so we held a feast with ${cost} food to spare. Spirits are high.`);
    }
  }

  // Steward: make sure food will last the chosen number of seasons.
  if (orders.foodReserve > 0 && !state.siege) { // In a siege there is no food to be had outside.
    const lastsLongEnough = () => {
      const f = forecastFood(state);
      return f.emptyIn === null || f.emptyIn >= orders.foodReserve;
    };
    if (!lastsLongEnough()) {
      const rank = { rest: 0, scout: 1, study: 2, guard: 3, build: 4, wood: 5 };
      const candidates = people
        .filter((p) => p.task in rank && p.health >= 40 && p.age >= 5 && !(p.orderReturn && p.orderReturn.reason === 'hurt'))
        .sort((a, b) => rank[a.task] - rank[b.task]);
      const moved = [];
      for (const p of candidates) {
        if (lastsLongEnough()) break;
        if (p.task === 'wood' && people.filter((x) => x.task === 'wood').length <= 1) continue;
        const hunt = expectedFood(state, p, 'hunt', s);
        const forage = expectedFood(state, p, 'forage', s);
        p.task = forage > hunt || !allowedTasksFor(state, p).includes('hunt') ? 'forage' : 'hunt';
        if (!allowedTasksFor(state, p).includes(p.task)) p.task = 'rest';
        p.orderReturn = null;
        moved.push(p);
      }
      if (moved.length) {
        const hunters = moved.filter((p) => p.task === 'hunt');
        const foragers = moved.filter((p) => p.task === 'forage');
        const parts = [];
        if (hunters.length) parts.push(`${listNames(hunters)} to hunting`);
        if (foragers.length) parts.push(`${listNames(foragers)} to foraging`);
        say('steward', `moved ${parts.join(' and ')} so our food lasts at least ${orders.foodReserve} ${orders.foodReserve === 1 ? 'season' : 'seasons'}.`);
      }
      if (!lastsLongEnough()) {
        say('steward', `even with these changes, our food may not last as long as you ordered. ${inVillage(state) ? 'Lowering priorities on the Village screen would free more hands.' : 'Check the People screen.'}`);
      }
    }
  }

  return { urgent, orders: done };
}
