// Resolving a raid, whether the player decides or a standing order does.

import { living, personById, canFight } from './state.js';
import { defenseStrength, raidAttackStrength } from './rules.js';
import { randomBetween, randomInt, chance } from './rng.js';
import { refreshAdvisors } from './advisors.js';
import { gainExperience } from './skills.js';
import { meet, changeRelation } from './neighbors.js';

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
  if (plan === 'hide') {
    lines.push(ev.warned
      ? 'Your people hid what they could and slipped into the trees until the raiders left.'
      : 'Caught by surprise, your people grabbed what they could and fled into the trees.');
    lines.push(ev.warned ? loseShare(0.2, 0.15) : loseShare(0.35, 0.25));
    for (const p of all) p.morale = Math.max(0, p.morale - 6);
  } else if (plan === 'fight') {
    const defenders = defenderIds.map((id) => personById(state, id)).filter((p) => p && p.alive && p.age >= 12);
    if (defenders.length === 0) return { error: 'Choose at least one defender, or choose to hide.' };
    const defense = defenseStrength(state, defenders, ev.warned);
    const attack = raidAttackStrength(ev.raiders) * randomBetween(state, 0.85, 1.15);
    const won = defense >= attack;
    const injured = [];
    for (const p of defenders) {
      if (chance(state, won ? 0.15 : 0.4)) {
        p.health = Math.max(0, p.health - randomInt(state, won ? 20 : 30, won ? 35 : 55));
        injured.push(p);
      }
    }
    if (won) {
      lines.push(`${defenders.length} defenders drove the raiders off${state.buildings.palisade ? ' from behind the palisade' : ''}.`);
      for (const p of all) p.morale = Math.min(100, p.morale + 8);
    } else {
      lines.push('The defenders were overwhelmed.');
      lines.push(loseShare(0.4, 0.3));
      for (const p of all) p.morale = Math.max(0, p.morale - 10);
    }
    if (injured.length) lines.push(`Wounded in the fighting: ${injured.map((p) => p.name).join(', ')}.`);
    // Real fighting teaches fast: each defender gains two seasons' practice.
    const hardened = defenders.filter((p) => p.health > 0 && gainExperience(p, 'hunting', 2));
    if (hardened.length) lines.push(`The fight hardened ${hardened.map((p) => `${p.name} (hunting ${p.skills.hunting})`).join(', ')}.`);
    for (const p of injured.filter((x) => x.health <= 0)) {
      p.alive = false;
      lines.push(`${p.name} was killed.`);
    }
    if (ev.from !== 'outlaws') {
      if (meet(state, 'skarn', { contact: false })) {
        lines.push('After the fighting, a wounded raider told your people who they were: the Skarn, from a fortified hold in the rocky hills. You can now deal with them on the Neighbors screen.');
      }
      if (won) changeRelation(state, 'skarn', -5);
    }
  } else {
    return { error: 'Choose to fight or hide.' };
  }
  state.pendingEvent = null;
  refreshAdvisors(state);
  if (living(state).length === 0) state.gameOver = true;
  return { lines };
}
