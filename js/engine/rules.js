// Formulas for what a person produces at a task. Shared by the season
// resolution (which adds randomness) and the advisors (who forecast).

import { PLACES } from './data.js';
import { isKnown } from './state.js';

const HUNT_SEASON = [1, 1, 1.1, 0.6];
const FORAGE_BASE = [2, 4, 5, 0];
const WOOD_SEASON = [1, 1, 1, 0.8];

// How much hunting and foraging use up a place each season, per worker,
// and how much it recovers each season by season of the year.
export const DEPLETION = { hunt: 6, forage: 5 };
export const RECOVERY = { hunt: [10, 10, 8, 4], forage: [12, 12, 6, 0] };

// How effectively someone works, from 0.35 to 1.
export function workFactor(person) {
  let f = 1;
  if (person.health < 40) f *= 0.5;
  if (person.morale < 25) f *= 0.7;
  else if (person.morale < 45) f *= 0.85;
  return f;
}

// The place where everyone doing a task works. Falls back to camp.
export function siteFor(state, task) {
  const id = state.workSites && state.workSites[task];
  if (!id || !isKnown(state, id)) return 'camp';
  if (task !== 'scout' && !PLACES[id].tasks.includes(task)) return 'camp';
  return id;
}

// Hunted-out or picked-over places yield less: from 60 to 100 percent.
export function abundanceFactor(state, placeId, task) {
  return 0.6 + 0.4 * (state.places[placeId].abundance[task] / 100);
}

function distanceFactor(placeId) {
  return PLACES[placeId].distance >= 3 ? 0.9 : 1;
}

function bonus(placeId, task) {
  return PLACES[placeId].bonus[task] || 0;
}

export function expectedFood(state, person, task, seasonIdx) {
  const s = person.skills;
  let amount = 0;
  if (task === 'hunt') {
    const site = siteFor(state, 'hunt');
    amount = (2 + s.hunting) * HUNT_SEASON[seasonIdx] + bonus(site, 'hunt');
    amount *= abundanceFactor(state, site, 'hunt') * distanceFactor(site);
  } else if (task === 'forage') {
    if (seasonIdx === 3) return 0;
    const site = siteFor(state, 'forage');
    amount = FORAGE_BASE[seasonIdx] + s.foraging * 0.6 + bonus(site, 'forage');
    amount *= abundanceFactor(state, site, 'forage') * distanceFactor(site);
  }
  return amount * workFactor(person);
}

export function expectedWood(state, person, task, seasonIdx) {
  if (task !== 'wood') return 0;
  const site = siteFor(state, 'wood');
  let amount = (4 + person.skills.building * 0.6) * WOOD_SEASON[seasonIdx] + bonus(site, 'wood');
  amount *= distanceFactor(site);
  return amount * workFactor(person);
}

export function expectedWork(person) {
  return (2 + person.skills.building) * workFactor(person);
}

export function healingPoints(state, person) {
  let points = 10 + person.skills.healing * 5;
  if (state.buildings.healersHut > 0) points *= 1.5;
  if (isKnown(state, 'herbHillside')) points *= 1.25;
  return points * workFactor(person);
}

// Hunting farther from camp is a little more dangerous.
export function huntInjuryChance(state, person) {
  const extra = 0.02 * Math.max(0, PLACES[siteFor(state, 'hunt')].distance - 1);
  return Math.max(0.03, 0.12 - 0.015 * person.skills.hunting) + extra;
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
