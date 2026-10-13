// Resolving a raid, whether the player decides or a standing order does.

import { living } from './state.js';
import { refreshAdvisors } from './advisors.js';
import {
  createBattle, formationPlan, warChiefFormation, autoBattle,
} from './battle.js';

// Returns { error } or { lines } describing what happened.
export function resolveRaidPlan(state, plan, defenderIds = []) {
  const ev = state.pendingEvent;
  if (!ev || ev.type !== 'raid') return { error: 'There is no raid to respond to.' };
  const lines = [];
  const res = state.resources;
  const loseShare = (foodShare, woodShare) => {
    const f = Math.floor(res.food * foodShare);
    const w = Math.floor(res.wood * woodShare);
    res.food -= f;
    res.wood -= w;
    return `The raiders took ${f} food and ${w} wood.`;
  };
  const all = living(state);
  if (plan === 'hide' && ev.side === 'attack') {
    state.pendingEvent = null;
    return { lines: ['You called off the attack on Skarn hold.'] };
  }
  if (plan === 'hide') {
    lines.push(ev.warned
      ? 'Your people hid what they could and slipped into the trees until the raiders left.'
      : 'Caught by surprise, your people grabbed what they could and fled into the trees.');
    lines.push(ev.warned ? loseShare(0.2, 0.15) : loseShare(0.35, 0.25));
    for (const p of all) p.morale = Math.max(0, p.morale - 6);
  } else if (plan === 'fight') {
    // The war chief fights the battle with the chosen defenders.
    const chosen = new Set(defenderIds);
    const battle = ev.battle || createBattle(state, ev);
    if (battle.phase !== 'deploy') return { error: 'The battle has already begun.' };
    const formation = formationPlan(state, battle, warChiefFormation(battle));
    const assignments = Object.fromEntries(Object.entries(formation).filter(([id]) => chosen.has(Number(id))));
    if (!Object.keys(assignments).length) return { error: 'Choose at least one defender, or choose to hide.' };
    const result = autoBattle(state, { ...ev, battle }, assignments);
    if (result.error) return result;
    return { lines: result.lines };
  } else {
    return { error: 'Choose to fight or hide.' };
  }
  state.pendingEvent = null;
  refreshAdvisors(state);
  if (living(state).length === 0) state.gameOver = true;
  return { lines };
}
