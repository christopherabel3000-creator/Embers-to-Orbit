// The single entry point for changing the game. Every player decision is
// an action object; applyAction returns a new state and never mutates
// the old one. This keeps saves simple and leaves room for multiplayer.

import {
  TASKS, BUILDINGS, PLACES, KNOWLEDGE, NEIGHBORS,
} from './data.js';
import {
  personById, living, foodNeeded, isKnown, placeName, DEFAULT_ORDERS,
  taskAvailable, hasKnowledge, knowledgeBlocker, knowledgeClosed, allowedTasksFor, lifeStage, inVillage,
} from './state.js';
import { foundVillage, setPriority, setFoodStores } from './village.js';
import {
  claimPlace, nationsActive, freeToWork, owner, rescaleSkarn,
} from './nations.js';
import { DIFFICULTIES, raidScale } from './difficulty.js';
import { setLaw } from './laws.js';
import { sallyOut, payBesiegers } from './siege.js';
import { hireMaster, hireSwords } from './goods.js';
import { giftClans } from './clans.js';
import {
  foundSettlement, setPolicy, setTownRole, setTownDemands, setTownPriority, sendAid, appointGovernor,
} from './settlements.js';
import { resolveSeason } from './season.js';
import { sendExpedition, recallExpedition } from './world.js';
import { greatDiplomacy } from './great.js';
import { resolveRaidPlan } from './raid.js';
import { bestWorkPlan } from './assign.js';
import { queueBlocker, refundFor, refundWords } from './building.js';
import { startNextStudy } from './study.js';
import { applyDiplomacy } from './neighbors.js';
import {
  createBattle, deploy, resolveRound, finishBattle, autoBattle, summarize,
} from './battle.js';
import { resolveStoryEvent } from './events.js';
import { holdFeast } from './stores.js';

export { newGame } from './state.js';

export function applyAction(state, action) {
  const next = structuredClone(state);
  const result = handlers[action.type]
    ? handlers[action.type](next, action)
    : { error: `Unknown action: ${action.type}` };
  if (result && result.error) return { state, error: result.error };
  return { state: next, message: result && result.message };
}

function blocked(state) {
  if (state.gameOver) return { error: 'The game is over. Start a new game.' };
  return null;
}

const COUNCIL_ASSIGNS = 'In the village, the council assigns everyone\'s work each season. Set its priorities on the Village screen.';

const handlers = {
  assign(state, { personId, task }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (inVillage(state)) return { error: COUNCIL_ASSIGNS };
    const p = personById(state, personId);
    if (!p || !p.alive) return { error: 'That person is not in the camp.' };
    if (!TASKS[task]) return { error: 'Unknown task.' };
    if (!taskAvailable(state, task)) return { error: `Your people do not know how to ${TASKS[task].name.toLowerCase()} yet.` };
    if (!allowedTasksFor(state, p).includes(task)) {
      return { error: lifeStage(p) === 'infant' ? `${p.name} is too young to work.` : `${p.name} is too young for that work.` };
    }
    p.task = task;
    p.orderReturn = null; // The player's choice overrides any standing order.
    return { message: `${p.name}: ${TASKS[task].name}.` };
  },

  assignAll(state, { fromTask, task }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (inVillage(state)) return { error: COUNCIL_ASSIGNS };
    if (!TASKS[task]) return { error: 'Unknown task.' };
    if (!taskAvailable(state, task)) return { error: `Your people do not know how to ${TASKS[task].name.toLowerCase()} yet.` };
    const moved = living(state).filter((p) => p.task === fromTask && allowedTasksFor(state, p).includes(task));
    for (const p of moved) {
      p.task = task;
      p.orderReturn = null;
    }
    return { message: `${moved.length} ${moved.length === 1 ? 'person' : 'people'} moved to ${TASKS[task].name.toLowerCase()}.` };
  },

  assignBest(state) {
    const stop = blocked(state);
    if (stop) return stop;
    const plan = bestWorkPlan(state);
    let changed = 0;
    for (const [id, task] of plan) {
      const p = personById(state, id);
      if (p.task !== task) changed += 1;
      p.task = task;
      p.orderReturn = null;
    }
    const counts = {};
    for (const task of plan.values()) counts[task] = (counts[task] || 0) + 1;
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${TASKS[t].name.toLowerCase()} ${n}`)
      .join(', ');
    if (inVillage(state)) return { message: `The council reassigned everyone. ${changed} changed. ${summary}.` };
    return { message: changed ? `Everyone is on their best work. ${changed} changed. ${summary}.` : `Everyone was already on their best work. ${summary}.` };
  },

  foundVillage(state) {
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return foundVillage(state);
  },

  foundSettlement(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return foundSettlement(state, action);
  },

  setSettlementPolicy(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return setPolicy(state, action);
  },

  // ----- The nation's settlements -----
  setTownRole(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return setTownRole(state, action);
  },

  setTownDemands(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return setTownDemands(state, action);
  },

  setTownPriority(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return setTownPriority(state, action);
  },

  sendAid(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return sendAid(state, action);
  },

  sendExpedition(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return sendExpedition(state, action);
  },

  recallExpedition(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    return recallExpedition(state, action);
  },

  appointGovernor(state, action) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return appointGovernor(state, action);
  },

  sallyOut(state) {
    const stop = blocked(state);
    if (stop) return stop;
    return sallyOut(state);
  },

  payBesiegers(state, { goods = false } = {}) {
    const stop = blocked(state);
    if (stop) return stop;
    return payBesiegers(state, { goods });
  },

  hireMaster(state, { skill, pay = 'goods' }) {
    const stop = blocked(state);
    if (stop) return stop;
    return hireMaster(state, skill, pay);
  },

  giftClans(state) {
    const stop = blocked(state);
    if (stop) return stop;
    return giftClans(state);
  },

  hireSwords(state, { pay = 'goods' } = {}) {
    const stop = blocked(state);
    if (stop) return stop;
    return hireSwords(state, pay);
  },

  greatDiplomacy(state, { nationId, act }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return greatDiplomacy(state, nationId, act);
  },

  setLaw(state, { law, option = null }) {
    const stop = blocked(state);
    if (stop) return stop;
    return setLaw(state, law, option || null);
  },

  claimPlace(state, { placeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    return claimPlace(state, placeId);
  },

  setPriority(state, { area, level }) {
    const stop = blocked(state);
    if (stop) return stop;
    return setPriority(state, area, level);
  },

  setFoodStores(state, { choice }) {
    const stop = blocked(state);
    if (stop) return stop;
    return setFoodStores(state, choice);
  },

  queueBuilding(state, { buildingId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const why = queueBlocker(state, buildingId);
    if (why) return { error: why };
    state.buildQueue.push({ id: buildingId, progress: 0, paid: false });
    const b = BUILDINGS[buildingId];
    return { message: `Added a ${b.name.toLowerCase()} to the build queue, in place ${state.buildQueue.length}.` };
  },

  // Older name for adding to the queue.
  startProject(state, action) {
    return handlers.queueBuilding(state, action);
  },

  removeBuilding(state, { index = 0 }) {
    const stop = blocked(state);
    if (stop) return stop;
    const item = state.buildQueue[index];
    if (!item) return { error: 'That building is not in the queue.' };
    const refund = refundFor(item);
    for (const [k, n] of Object.entries(refund)) state.resources[k] = (state.resources[k] || 0) + n;
    state.buildQueue.splice(index, 1);
    const b = BUILDINGS[item.id];
    const back = refundWords(refund);
    return { message: `Removed the ${b.name.toLowerCase()} from the queue.${back ? ` ${back} recovered.` : ''}` };
  },

  // Older name: removes the first building in the queue.
  cancelProject(state) {
    return handlers.removeBuilding(state, { index: 0 });
  },

  moveBuilding(state, { index, by }) {
    const stop = blocked(state);
    if (stop) return stop;
    const to = index + by;
    const q = state.buildQueue;
    if (!q[index] || to < 0 || to >= q.length) return { error: 'It cannot move that way.' };
    [q[index], q[to]] = [q[to], q[index]];
    const b = BUILDINGS[q[to].id];
    return { message: `The ${b.name.toLowerCase()} is now number ${to + 1} of ${q.length}.` };
  },

  resolveRaid(state, { plan, defenderIds = [] }) {
    const stop = blocked(state);
    if (stop) return stop;
    const result = resolveRaidPlan(state, plan, defenderIds);
    if (result.error) return result;
    state.report.urgent.push(...result.lines);
    for (const text of result.lines) state.log.push({ turn: state.turn, date: state.report.title, text });
    return { message: result.lines.join(' ') };
  },

  resolveEvent(state, { choice }) {
    const stop = blocked(state);
    if (stop) return stop;
    const result = resolveStoryEvent(state, choice);
    if (result.error) return result;
    state.report.decisions = [...(state.report.decisions || []), ...result.lines];
    for (const text of result.lines) state.log.push({ turn: state.turn, date: state.report.title, text });
    return { message: result.lines.join(' ') };
  },

  setStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!KNOWLEDGE[knowledgeId]) return { error: 'Unknown discovery.' };
    const why = knowledgeBlocker(state, knowledgeId);
    if (why) return { error: why };
    state.knowledge.current = knowledgeId;
    state.knowledge.queue = state.knowledge.queue.filter((id) => id !== knowledgeId);
    return { message: `Your people will study ${KNOWLEDGE[knowledgeId].name.toLowerCase()}.` };
  },

  // ----- Battles -----
  battleDeploy(state, { assignments }) {
    const stop = blocked(state);
    if (stop) return stop;
    const ev = state.pendingEvent;
    if (!ev || ev.type !== 'raid') return { error: 'There is no battle to fight.' };
    if (!ev.battle) ev.battle = createBattle(state, ev);
    if (ev.battle.phase !== 'deploy') return { error: 'The battle has already begun.' };
    const placed = deploy(state, ev.battle, assignments || {});
    if (placed.error) return placed;
    return { message: 'Your fighters are in position. Give your orders for the first round.' };
  },

  battleOrders(state, { orders }) {
    const stop = blocked(state);
    if (stop) return stop;
    const ev = state.pendingEvent;
    const battle = ev && ev.battle;
    if (!battle || battle.phase !== 'fight') return { error: 'There is no battle underway.' };
    const { lines, outcome } = resolveRound(state, battle, orders || {});
    if (!outcome) return { message: lines.join(' ') };
    const final = [...summarize(state, battle), ...finishBattle(state, battle, outcome)];
    recordBattle(state, final);
    return { message: [...lines, ...final].join(' ') };
  },

  battleAuto(state) {
    const stop = blocked(state);
    if (stop) return stop;
    const ev = state.pendingEvent;
    if (!ev || ev.type !== 'raid') return { error: 'There is no battle to fight.' };
    const result = autoBattle(state, ev);
    if (result.error) return result;
    recordBattle(state, result.lines);
    return { message: result.lines.join(' ') };
  },

  battleRetreat(state) {
    const stop = blocked(state);
    if (stop) return stop;
    const ev = state.pendingEvent;
    const battle = ev && ev.battle;
    if (!battle || battle.phase !== 'fight') return { error: 'There is no battle underway.' };
    const final = [...summarize(state, battle), ...finishBattle(state, battle, 'retreat')];
    recordBattle(state, final);
    return { message: final.join(' ') };
  },

  queueStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const k = state.knowledge;
    if (!KNOWLEDGE[knowledgeId]) return { error: 'Unknown discovery.' };
    if (hasKnowledge(state, knowledgeId)) return { error: 'Already known.' };
    const closed = knowledgeClosed(state, knowledgeId);
    if (closed) return { error: closed };
    if (k.current === knowledgeId || k.queue.includes(knowledgeId)) return { error: `${KNOWLEDGE[knowledgeId].name} is already planned.` };
    k.queue.push(knowledgeId);
    const started = !k.current && startNextStudy(state) === knowledgeId;
    return { message: started
      ? `Your people will study ${KNOWLEDGE[knowledgeId].name.toLowerCase()} now.`
      : `Added ${KNOWLEDGE[knowledgeId].name.toLowerCase()} to the study queue, in place ${k.queue.indexOf(knowledgeId) + 1}.` };
  },

  unqueueStudy(state, { knowledgeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    const k = state.knowledge;
    const i = k.queue.indexOf(knowledgeId);
    if (i === -1) return { error: 'That is not in the study queue.' };
    k.queue.splice(i, 1);
    return { message: `Removed ${KNOWLEDGE[knowledgeId].name.toLowerCase()} from the study queue.` };
  },

  holdFeast(state, { guest = null }) {
    if (state.pendingEvent) return { error: 'Deal with what is happening first.' };
    return holdFeast(state, guest);
  },

  diplomacy(state, { neighborId, act }) {
    const stop = blocked(state);
    if (stop) return stop;
    return applyDiplomacy(state, neighborId, act);
  },

  setWorkSite(state, { task, placeId }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!['hunt', 'forage', 'wood', 'scout', 'quarry'].includes(task)) return { error: 'Unknown task.' };
    if (!isKnown(state, placeId)) return { error: 'You have not found that place yet.' };
    if (task !== 'scout' && !PLACES[placeId].tasks.includes(task)) {
      return { error: `${placeName(state, placeId)} is no place for that work.` };
    }
    state.workSites[task] = placeId;
    const verb = { hunt: 'Hunters will work at', forage: 'Foragers will work at', wood: 'Woodcutters will work at', scout: 'Scouts will explore beyond', quarry: 'Quarriers will work at' }[task];
    // Choosing another people's land on purpose: the council leaves it be.
    state.foreignWorkOk = state.foreignWorkOk || {};
    if (task !== 'scout' && nationsActive(state) && !freeToWork(state, placeId)) {
      state.foreignWorkOk[task] = placeId;
      const who = NEIGHBORS[owner(state, placeId)].name;
      return { message: `${verb} ${placeName(state, placeId)}. It belongs to ${who}, who will be angry every season your people work there. The council will leave it to you.` };
    }
    delete state.foreignWorkOk[task];
    return { message: `${verb} ${placeName(state, placeId)}.` };
  },

  // Allowed at any time, even mid-battle: it shapes what comes next.
  setDifficulty(state, { level }) {
    if (!DIFFICULTIES[level]) return { error: 'Choose easy, normal, hard, or insane.' };
    const d = DIFFICULTIES[level];
    if (state.difficulty === level) return { message: `Difficulty: ${d.name}.` };
    const before = raidScale(state);
    state.difficulty = level;
    rescaleSkarn(state, raidScale(state) / before);
    return { message: `Difficulty: ${d.name}. ${d.about}` };
  },

  setOrder(state, { id, value }) {
    const stop = blocked(state);
    if (stop) return stop;
    if (!(id in DEFAULT_ORDERS)) return { error: 'Unknown order.' };
    if (id === 'foodReserve') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 4) return { error: 'Choose between 0 and 4 seasons.' };
      state.orders.foodReserve = n;
    } else if (id === 'raidPolicy') {
      if (!['ask', 'fightIfLikely', 'auto'].includes(value)) return { error: 'Unknown raid policy.' };
      state.orders.raidPolicy = value;
    } else {
      state.orders[id] = Boolean(value);
    }
    return { message: 'Standing order updated.' };
  },

  endTurn(state) {
    const stop = blocked(state);
    if (stop) return stop;
    if (state.pendingEvent) {
      return { error: state.pendingEvent.type === 'raid'
        ? 'Deal with the raiders before ending the season.'
        : 'A decision is waiting. Make it before ending the season.' };
    }
    resolveSeason(state);
    return { message: `Season ended. It is now ${state.report.title}.` };
  },
};

function recordBattle(state, lines) {
  state.report.urgent.push(...lines);
  for (const text of lines) state.log.push({ turn: state.turn, date: state.report.title, text });
}

// Convenience for tests and the advisors: food needed by everyone now.
export function currentFoodNeed(state) {
  return foodNeeded(living(state));
}
