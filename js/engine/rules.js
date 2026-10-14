// Formulas for what a person produces at a task. Shared by the season
// resolution (which adds randomness) and the advisors (who forecast).

import { PLACES } from './data.js';
import { hasTradition } from './legacy.js';
import {
  isKnown, wolvesAt, hasKnowledge, living, seasonIndex, fieldPlots, hasCondition,
} from './state.js';

const HUNT_SEASON = [1, 1, 1.1, 0.6];
const FORAGE_BASE = [2, 4, 5, 0];
const WOOD_SEASON = [1, 1, 1, 0.8];

// How much hunting and foraging use up a place each season, per worker,
// and how much it recovers each season by season of the year.
export const DEPLETION = { hunt: 6, forage: 5 };
export const RECOVERY = { hunt: [10, 10, 8, 4], forage: [12, 12, 6, 0] };

// People in high spirits work a little better.
export const HIGH_SPIRITS = 70;

// How effectively someone works, from 0 (an infant) to 1.1.
export function workFactor(person) {
  let f = 1;
  if (person.health < 40) f *= 0.5;
  if (person.sick) f *= 0.5;
  // Age: children do light work at half strength, youths at three quarters,
  // and strength fades in old age.
  const age = person.age ?? 30;
  if (age < 5) return 0;
  if (age < 12) f *= 0.5;
  else if (age < 16) f *= 0.75;
  else if (age >= 65) f *= 0.7;
  else if (age >= 55) f *= 0.85;
  if (person.morale < 25) f *= 0.7;
  else if (person.morale < 45) f *= 0.85;
  else if (person.morale >= HIGH_SPIRITS) f *= 1.1;
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
    if (hasKnowledge(state, 'spears')) amount += 1;
    if (hasKnowledge(state, 'bows')) amount += 1;
    if (hasTradition(state, 'hunting')) amount += 1;
    amount *= abundanceFactor(state, site, 'hunt') * distanceFactor(site);
    if (wolvesAt(state, site)) amount *= 0.7; // Wolves scare off and take the game.
    if (hasCondition(state, 'hardWinter')) amount *= 0.7; // Deep snow; the game hides.
  } else if (task === 'forage') {
    if (seasonIdx === 3) return 0;
    const site = siteFor(state, 'forage');
    amount = FORAGE_BASE[seasonIdx] + s.foraging * 0.6 + bonus(site, 'forage');
    amount *= abundanceFactor(state, site, 'forage') * distanceFactor(site);
    if (hasCondition(state, 'drought')) amount *= 0.6;
  }
  return amount * workFactor(person);
}

export function expectedWood(state, person, task, seasonIdx) {
  if (task !== 'wood') return 0;
  const site = siteFor(state, 'wood');
  let amount = (4 + person.skills.building * 0.6) * WOOD_SEASON[seasonIdx] + bonus(site, 'wood');
  if (hasKnowledge(state, 'stoneTools')) amount += 1;
  amount *= distanceFactor(site);
  return amount * workFactor(person);
}

// Stone a quarrier cuts in a season.
export function expectedStone(state, person) {
  const site = siteFor(state, 'quarry');
  let amount = 2 + person.skills.building * 0.5 + bonus(site, 'quarry');
  if (hasKnowledge(state, 'stoneTools')) amount += 1;
  amount *= distanceFactor(site);
  return Math.max(0, amount) * workFactor(person);
}

// Goods a crafter makes in a season.
export function expectedGoods(state, person) {
  let amount = 1 + person.skills.building * 0.4;
  if (hasKnowledge(state, 'kilns')) amount += 1;
  if (state.buildings.workshop > 0) amount += 1;
  return amount * workFactor(person);
}

// Food from pastures each season.
export const FOOD_PER_PASTURE = 6;

export function expectedWork(person, state = null) {
  const tools = state && hasKnowledge(state, 'stoneTools') ? 1 : 0;
  const masters = state && hasTradition(state, 'builders') ? 1 : 0;
  return (2 + person.skills.building + tools + masters) * workFactor(person);
}

// Study points a person adds toward the current discovery each season.
export function studyPoints(person, state = null) {
  const love = state && hasTradition(state, 'learning') ? 1 : 0;
  const elders = state && hasKnowledge(state, 'elders') ? 1 : 0;
  return (2 + person.skills.learning + love + elders) * workFactor(person);
}

// ----- Farming -----
// Each farmer can plant 2 plots in spring, and tend or harvest 3 plots in
// summer or autumn. A fully tended plot yields 10 food; an untended one 6.
export const PLANT_PER_FARMER = 2;
export const TEND_PER_FARMER = 3;
export const HARVEST_PER_FARMER = 3;

export function farmerCapacity(people, perFarmer) {
  return people.filter((p) => p.task === 'farm')
    .reduce((sum, p) => sum + perFarmer * workFactor(p), 0);
}

// How many farmers the fields can use this season.
export function farmersNeeded(state) {
  const s = seasonIndex(state);
  const plots = fieldPlots(state);
  if (!plots || s === 3) return 0;
  if (s === 0) return Math.ceil((plots - state.farm.planted) / PLANT_PER_FARMER);
  if (s === 1) return Math.ceil(state.farm.planted / TEND_PER_FARMER);
  return Math.ceil(state.farm.planted / HARVEST_PER_FARMER);
}

export function foodPerPlot(tendedFraction, state = null) {
  const base = 6 + 4 * tendedFraction + (state && hasTradition(state, 'seasons') ? 1 : 0)
    + (state && hasKnowledge(state, 'irrigation') ? 2 : 0);
  if (!state || !hasCondition(state, 'drought')) return base;
  return base * (hasKnowledge(state, 'irrigation') ? 0.8 : 0.6); // Ditches soften a drought.
}

// Food the coming autumn harvest should bring, with current farmers.
export function expectedHarvest(state) {
  const s = seasonIndex(state);
  if (s === 3) return 0;
  const people = living(state);
  let planted = state.farm.planted;
  if (s === 0) planted = Math.min(fieldPlots(state), planted + Math.floor(farmerCapacity(people, PLANT_PER_FARMER)));
  if (planted === 0) return 0;
  let tended = state.farm.tended;
  if (s <= 1) tended = Math.min(planted, farmerCapacity(people, TEND_PER_FARMER));
  const harvested = Math.min(planted, farmerCapacity(people, HARVEST_PER_FARMER));
  const perPlot = foodPerPlot(tended / planted, state);
  return harvested * perPlot + (planted - harvested) * perPlot * 0.5;
}

export function healingPoints(state, person) {
  let points = 10 + person.skills.healing * 5;
  if (state.buildings.healersHut > 0) points *= 1.5;
  if (isKnown(state, 'herbHillside')) points *= 1.25;
  if (hasKnowledge(state, 'medicine')) points *= 1.2;
  return points * workFactor(person);
}

// Hunting farther from camp is a little more dangerous.
export function huntInjuryChance(state, person) {
  const site = siteFor(state, 'hunt');
  let extra = 0.02 * Math.max(0, PLACES[site].distance - 1);
  if (wolvesAt(state, site)) extra += 0.15;
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
    total += (4 + p.skills.hunting * 1.5 + (hasKnowledge(state, 'spears') ? 1.5 : 0)) * fitness;
  }
  if (!warned) total *= 0.75;
  if (state.buildings.palisade > 0) total += 30;
  return total;
}

export function raidAttackStrength(raiders) {
  return raiders * 5;
}
