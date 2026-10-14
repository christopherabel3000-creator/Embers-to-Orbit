// Resolving a raid, whether the player decides or a standing order does.

import { living, personById, placeName } from './state.js';
import { chance, randomInt } from './rng.js';
import { clamp, listNames } from './util.js';
import { refreshAdvisors } from './advisors.js';
import { recordDeed, hasTradition } from './legacy.js';
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
  if (plan === 'hide' && ev.ambush) {
    // Scatter: the workers run for home. Some are hurt on the way, and the
    // place is lost to them for the season.
    const reinforcements = new Set(ev.reinforcements || []);
    const workers = (ev.eligible || []).filter((id) => !reinforcements.has(id))
      .map((id) => personById(state, id)).filter((p) => p && p.alive);
    const hurt = workers.filter(() => chance(state, 0.4));
    for (const p of hurt) p.health = clamp(p.health - randomInt(state, 15, 30));
    state.harried = ev.ambush.place;
    state.pendingEvent = null;
    refreshAdvisors(state);
    const who = { hunt: 'hunters', forage: 'foragers', wood: 'woodcutters', quarry: 'quarriers' }[ev.ambush.task] || 'workers';
    return { lines: [`Your ${who} scattered and ran for home.${hurt.length ? ` ${listNames(hurt)} ${hurt.length === 1 ? 'was' : 'were'} hurt on the way.` : ''} Anyone working at ${placeName(state, ev.ambush.place)} this season will bring back half as much.`] };
  }
  if (plan === 'hide' && ev.sally) {
    state.pendingEvent = null;
    return { lines: ['Your fighters stayed behind the walls. The siege goes on.'] };
  }
  if (plan === 'hide') {
    lines.push(ev.warned
      ? 'Your people hid what they could and slipped into the trees until the raiders left.'
      : 'Caught by surprise, your people grabbed what they could and fled into the trees.');
    const half = hasTradition(state, 'hidden') ? 0.5 : 1;
    if (ev.host) {
      // A great host has time to strip the village bare.
      const g = Math.floor((res.goods || 0) * 0.3 * half);
      res.goods = (res.goods || 0) - g;
      lines.push(`${loseShare(0.4 * half, 0.3 * half).replace(' wood.', ` wood${g ? `, and ${g} goods` : ''}.`)} A great host has time to take its fill.`);
    } else {
      lines.push(ev.warned ? loseShare(0.2 * half, 0.15 * half) : loseShare(0.35 * half, 0.25 * half));
    }
    recordDeed(state, 'hid');
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
