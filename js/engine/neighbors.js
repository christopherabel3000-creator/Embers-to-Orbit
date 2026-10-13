// Neighbors: the other peoples of the valley. Relations, diplomacy, and
// how the Skarn shape raids. One diplomatic act per neighbor per season.

import { NEIGHBORS, NEIGHBOR_ORDER } from './data.js';
import {
  hasKnowledge, isKnown, living, canFight, year,
} from './state.js';
import { createBattle } from './battle.js';

// Warriors defending Skarn hold. Their numbers grow with the years.
export function skarnGarrison(state) {
  return 8 + year(state);
}

export function neighbor(state, id) {
  return state.neighbors[id];
}

export function changeRelation(state, id, delta) {
  const n = state.neighbors[id];
  n.relation = Math.max(-100, Math.min(100, Math.round(n.relation + delta)));
}

// Marks a people as known. Returns true if they were new.
export function meet(state, id, { contact = true } = {}) {
  const n = state.neighbors[id];
  if (n.known) return false;
  n.known = true;
  if (contact) n.contactPending = true;
  return true;
}

// Relations drift slowly back toward each people's nature.
export function driftRelations(state) {
  for (const id of NEIGHBOR_ORDER) {
    const n = state.neighbors[id];
    const base = NEIGHBORS[id].baseline;
    if (n.relation > base) n.relation -= 1;
    else if (n.relation < base) n.relation += 1;
  }
}

export function skarnAtPeace(state) {
  const sk = state.neighbors.skarn;
  return sk.peace || sk.truceUntil > state.turn;
}

// How much more or less likely raids are, given relations with the Skarn.
// With peace or a truce, only the occasional band of outlaws remains.
export function raidModifier(state) {
  const sk = state.neighbors.skarn;
  let m = 1;
  if (skarnAtPeace(state)) m = 0.3;
  else if (sk.known) {
    if (sk.relation < -40) m = 1.5;
    else if (sk.relation < -10) m = 1;
    else if (sk.relation < 25) m = 0.6;
    else m = 0.3;
  }
  if (state.raidThreat) m += 1; // The Skarn have promised to come.
  return m;
}

function tradeAmount(state, id, kind) {
  const base = NEIGHBORS[id].trades[kind];
  return Math.max(8, Math.round(base + state.neighbors[id].relation / 10));
}

// Everything the player could try with a neighbor this season. Each option
// says whether it is possible right now, and if not, why not.
export function diplomacyOptions(state, id) {
  const n = state.neighbors[id];
  const def = NEIGHBORS[id];
  const r = state.resources;
  const spoken = n.lastEnvoy === state.turn;
  const opts = [];
  const add = (key, label, ok, why) => opts.push({ key, label, ok: ok && !spoken, why: spoken ? 'Your envoys have already visited them this season.' : (ok ? null : why) });
  const refuses = n.relation <= -60;
  add('giftFood', 'Send a gift of 10 food', r.food >= 10 && !refuses, refuses ? 'They will not receive your envoys.' : 'You need 10 food.');
  add('giftWood', 'Send a gift of 10 wood', r.wood >= 10 && !refuses, refuses ? 'They will not receive your envoys.' : 'You need 10 wood.');
  if (def.trades.woodForFood) {
    const get = tradeAmount(state, id, 'woodForFood');
    add('woodForFood', `Trade 20 wood for ${get} food`, r.wood >= 20 && n.relation >= -10, n.relation < -10 ? 'They will not trade until relations improve.' : 'You need 20 wood.');
  }
  if (def.trades.foodForWood) {
    const get = tradeAmount(state, id, 'foodForWood');
    add('foodForWood', `Trade 20 food for ${get} wood`, r.food >= 20 && n.relation >= -10, n.relation < -10 ? 'They will not trade until relations improve.' : 'You need 20 food.');
  }
  if (id === 'velari' && !hasKnowledge(state, 'farming')) {
    add('learnFarming', 'Ask them to teach your people farming', n.relation >= 40, 'They would only share their ways with close friends. Relations must be at least 40.');
  }
  if (id === 'skarn' && !n.peace) {
    const fighters = living(state).filter(canFight).length;
    add('attack', `Lead an attack on Skarn hold. About ${skarnGarrison(state)} warriors defend it, behind their walls. Costs 10 food for the march.`,
      isKnown(state, 'skarnHold') && fighters >= 4 && r.food >= 10,
      !isKnown(state, 'skarnHold') ? 'Your scouts have not found Skarn hold.' : fighters < 4 ? 'You need at least 4 people fit to fight.' : 'You need 10 food for the march.');
    add('tribute', 'Pay 20 food in tribute for a year without raids', r.food >= 20, 'You need 20 food.');
    add('peace', 'Propose a lasting peace', n.relation >= 10, 'They would laugh at you. Relations must be at least 10.');
  }
  return opts;
}

// Carries out a diplomatic act. Returns { error } or { message }.
export function applyDiplomacy(state, id, key) {
  const def = NEIGHBORS[id];
  const n = state.neighbors[id];
  if (!def || !n || !n.known) return { error: 'You have not met that people.' };
  const option = diplomacyOptions(state, id).find((o) => o.key === key);
  if (!option) return { error: 'That is not possible with them.' };
  if (!option.ok) return { error: option.why };
  const r = state.resources;
  n.lastEnvoy = state.turn;
  const them = def.name;
  switch (key) {
    case 'giftFood':
      r.food -= 10;
      changeRelation(state, id, def.giftValue);
      return { message: `Your envoys carried 10 food to ${them}. They were pleased.` };
    case 'giftWood':
      r.wood -= 10;
      changeRelation(state, id, def.giftValue);
      return { message: `Your envoys carried 10 wood to ${them}. They were pleased.` };
    case 'woodForFood': {
      const get = tradeAmount(state, id, 'woodForFood');
      r.wood -= 20;
      r.food += get;
      changeRelation(state, id, 2);
      return { message: `You traded 20 wood to ${them} for ${get} food.` };
    }
    case 'foodForWood': {
      const get = tradeAmount(state, id, 'foodForWood');
      r.food -= 20;
      r.wood += get;
      changeRelation(state, id, 2);
      return { message: `You traded 20 food to ${them} for ${get} wood.` };
    }
    case 'learnFarming':
      state.knowledge.learned.push('farming');
      state.knowledge.queue = state.knowledge.queue.filter((k) => k !== 'farming');
      if (state.knowledge.current === 'farming') state.knowledge.current = null;
      delete state.knowledge.progress.farming;
      return { message: 'The Velari taught your people to plant, tend, and harvest grain, and sent seed for your first fields. Discovery: Farming. You can now build fields and set people to farm.' };
    case 'tribute':
      r.food -= 20;
      n.truceUntil = state.turn + 4;
      changeRelation(state, id, 5);
      return { message: 'The Skarn took your 20 food and promised a year without raids.' };
    case 'attack':
      r.food -= 10;
      state.pendingEvent = { type: 'raid', side: 'attack', raiders: skarnGarrison(state), warned: true, from: 'skarn' };
      state.pendingEvent.battle = createBattle(state, state.pendingEvent);
      return { message: 'Your fighters are gathering for the march on Skarn hold. Choose who goes and where they stand.' };
    case 'peace':
      n.peace = true;
      changeRelation(state, id, 10);
      state.raidThreat = false;
      return { message: 'The Skarn chiefs agreed to a lasting peace. Their warriors will leave your camp alone. Only the odd band of outlaws remains.' };
    default:
      return { error: 'That is not possible with them.' };
  }
}
