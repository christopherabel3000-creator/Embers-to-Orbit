// Who can have children, and how likely births are right now.
// Kept separate so the advisors can read it without import cycles.

import { living, foodNeeded, shelterNeeded, shelterCapacity } from './state.js';

export const CHILDBEARING = [18, 40];

export function parents(state) {
  return living(state).filter((p) => p.age >= CHILDBEARING[0] && p.age <= CHILDBEARING[1] && !p.sick);
}

// What makes the camp ready for children: plenty of food, room in the
// shelters, and good spirits. Returns a chance per season, and the reasons
// births are slowed (for the advisors).
export function birthOutlook(state) {
  const people = living(state);
  const possibleParents = parents(state).length;
  const reasons = [];
  if (possibleParents < 2) return { chance: 0, reasons: ['too few young adults'] };
  // Up to one birth a season, until the Nation era, when a large capital
  // can have several.
  let p = 0.04 * (possibleParents / 2);
  if (state.era !== 'nation') p = Math.min(0.5, p);
  if (state.resources.food < foodNeeded(people) * 2) {
    p *= 0.3;
    reasons.push('food is short');
  } else if (state.resources.food >= foodNeeded(people) * 6) p *= 1.5; // Plenty encourages families.
  if (shelterNeeded(people) + 0.5 > shelterCapacity(state)) {
    p *= 0.5;
    reasons.push('the shelters are full');
  }
  const morale = people.reduce((sum, x) => sum + x.morale, 0) / people.length;
  if (morale < 50) {
    p *= 0.6;
    reasons.push('spirits are low');
  }
  if (state.feastThisSeason) p *= 1.5; // A feast brings families together.
  return { chance: p, reasons };
}

