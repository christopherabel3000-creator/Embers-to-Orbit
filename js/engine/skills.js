// Skills improve with practice. Every season of work at a task earns
// experience in that task's skill. Early levels come quickly; mastery
// takes years.

export const MAX_SKILL = 5;

// Seasons of practice needed to go from a level to the next one.
export function experienceNeeded(level) {
  return 3 + 2 * level;
}

// Adds experience and returns the new level if the person improved.
export function gainExperience(person, skill, amount = 1) {
  if (!skill || person.skills[skill] >= MAX_SKILL) return null;
  if (!person.xp) person.xp = {};
  person.xp[skill] = (person.xp[skill] || 0) + amount;
  const need = experienceNeeded(person.skills[skill]);
  if (person.xp[skill] < need) return null;
  person.xp[skill] -= need;
  person.skills[skill] += 1;
  if (person.skills[skill] >= MAX_SKILL) person.xp[skill] = 0;
  return person.skills[skill];
}

// Roughly how many more seasons of practice until the next level.
export function seasonsToNextLevel(person, skill) {
  if (!skill || person.skills[skill] >= MAX_SKILL) return null;
  const have = (person.xp && person.xp[skill]) || 0;
  return Math.max(1, Math.ceil(experienceNeeded(person.skills[skill]) - have));
}
