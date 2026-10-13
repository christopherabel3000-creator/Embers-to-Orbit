// Formulas for what a person produces at a task. Shared by the season
// resolution (which adds randomness) and the advisors (who forecast).

import { hasDiscovery } from './state.js';

const HUNT_SEASON = [1, 1, 1.1, 0.6];
const FORAGE_BASE = [2, 4, 5, 0];
const WOOD_SEASON = [1, 1, 1, 0.8];

// How effectively someone works, from 0.35 to 1.
export function workFactor(person) {
  let f = 1;
  if (person.health < 40) f *= 0.5;
  if (person.morale < 25) f *= 0.7;
  else if (person.morale < 45) f *= 0.85;
  return f;
}

export function expectedFood(state, person, task, seasonIdx) {
  const s = person.skills;
  let amount = 0;
  if (task === 'hunt') {
    amount = (2 + s.hunting) * HUNT_SEASON[seasonIdx];
    if (hasDiscovery(state, 'huntingGrounds')) amount += 2;
  } else if (task === 'forage') {
    if (seasonIdx === 3) return 0;
    amount = FORAGE_BASE[seasonIdx] + s.foraging * 0.6;
    if (hasDiscovery(state, 'berryThicket')) amount += 2;
  }
  return amount * workFactor(person);
}

export function expectedWood(state, person, task, seasonIdx) {
  if (task !== 'wood') return 0;
  let amount = (4 + person.skills.building * 0.6) * WOOD_SEASON[seasonIdx];
  if (hasDiscovery(state, 'deadfall')) amount += 2;
  return amount * workFactor(person);
}

export function expectedWork(person) {
  return (2 + person.skills.building) * workFactor(person);
}

export function healingPoints(state, person) {
  let points = 10 + person.skills.healing * 5;
  if (state.buildings.healersHut > 0) points *= 1.5;
  if (hasDiscovery(state, 'herbGarden')) points *= 1.25;
  return points * workFactor(person);
}

export function huntInjuryChance(person) {
  return Math.max(0.03, 0.12 - 0.015 * person.skills.hunting);
}

export function scoutSuccessChance(person) {
  return Math.min(0.75, 0.3 + 0.08 * person.skills.scouting) * workFactor(person);
}

// Raid defense strength of a group of defenders.
export function defenseStrength(state, defenders, warned) {
  let total = 0;
  for (const p of defenders) {
    const fitness = Math.max(0.3, p.health / 100);
    total += (4 + p.skills.hunting * 1.5) * fitness;
  }
  if (!warned) total *= 0.75;
  if (state.buildings.palisade > 0) total += 30;
  return total;
}

export function raidAttackStrength(raiders) {
  return raiders * 5;
}
